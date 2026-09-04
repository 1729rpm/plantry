import type { Doc } from "../_generated/dataModel.js";
import type { QueryCtx } from "../_generated/server.js";
import type { SlotMeal } from "./meals.js";

/**
 * The household record, read out of `currentWeek` (`features/engine-v6.md` §2.1).
 *
 * The v6 engine's primary signal is what the household actually ate, not what the
 * engine proposed. That record lives in one place: the live `currentWeek` rows,
 * with every swap, add, and delete already applied to `slots`. `weekArchive` is
 * NOT the source. Finalize snapshots a week at the moment of finalizing and the
 * household keeps editing after that moment, so the archive under-reports as-eaten
 * rows for edited weeks. The archive stays where it is for the picker and Explore
 * surfaces until those move onto the record too (§12).
 */

/**
 * The six days the engine schedules. Sunday is never generated.
 *
 * Mirrors `Day` in `engine/src/v6/types.ts`. The engine package's `exports` map
 * does not expose the `v6/types` path today (stream D owns the root index), so the
 * two shapes in this file are declared locally with identical field names, and
 * stream E2 swaps them for the engine export once D has landed.
 */
export type Day = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";

/**
 * One as-eaten pick, or one engine placement. Same shape for both (§2.1, §6).
 *
 * Mirrors `Pick` in `engine/src/v6/types.ts`. `meal` is the stored slot's own
 * meal, so the standalone fruit slot passes through as `"fruit"` rather than being
 * folded into breakfast or lunch: the fruit scope is separate all the way down (§2.2).
 */
export interface Pick {
  day: Day;
  meal: SlotMeal;
  dishId: number;
}

/**
 * One record week as the backend hands it to the engine (§2.1).
 *
 * Mirrors `RecordWeek` in `engine/src/v6/types.ts`.
 */
export interface RecordWeek {
  /** ISO date of the Monday that anchors the week. */
  weekStart: string;
  /** As-eaten picks: live slot state, skipped days and custom picks excluded. */
  picks: Pick[];
  /** Days the household skipped; they contribute no occasions and no rows (§2.2). */
  skippedDays: Day[];
  /**
   * What the engine placed when the row was written (§12), or null for weeks
   * written before cutover, which are read as record-only weeks.
   */
  generatedPlan: Pick[] | null;
}

/**
 * Converts one stored `currentWeek` row into its as-eaten `RecordWeek` (§2.1).
 *
 * Pure: no database, no clock, no library. Three reductions, in this order:
 *
 *   1. Every pick of every slot becomes a `{ day, meal, dishId }`, in slot order
 *      and then position order, so the output is stable for a given row.
 *   2. Picks on a day named in `skippedDays` are dropped. A skipped day was not
 *      cooked, so it contributes no as-eaten row (and no occasion, which is the
 *      engine's job to count). The stored `slots` are left alone by the skip
 *      mutation so that restore is lossless, which is exactly why the filter has
 *      to happen here rather than being read off the slots.
 *   3. Picks with a null `dishId` are dropped. A free-text custom one-off has no
 *      library identity, so it contributes nothing until it is promoted to a
 *      library dish and its slot re-pointed at the new id (`promoteCustomPick`).
 *
 * `generatedPlan` passes through untouched, or comes back null when the row predates
 * the v6 cutover. The week still counts as one record week even when every day of
 * it was skipped: the record counts weeks, and occasions inside them, separately.
 */
export function recordWeekFromDoc(doc: Doc<"currentWeek">): RecordWeek {
  const skippedDays: Day[] = (doc.skippedDays ?? []).map((entry) => entry.day);
  const skipped = new Set<Day>(skippedDays);

  const picks: Pick[] = [];
  for (const slot of doc.slots) {
    if (skipped.has(slot.day)) continue;
    for (const pick of slot.dishes) {
      if (pick.dishId === null) continue;
      picks.push({ day: slot.day, meal: slot.meal, dishId: pick.dishId });
    }
  }

  return {
    weekStart: doc.weekStart,
    picks,
    skippedDays,
    generatedPlan: doc.generatedPlan ?? null,
  };
}

/**
 * Loads every record week before `beforeWeekStart`, ascending by `weekStart` (§2.1).
 *
 * A record week is any `currentWeek` row whose `weekStart` is earlier than the week
 * being generated, WHATEVER its `status`: a draft week the household has been eating
 * out of all week is as much a record of what was eaten as a finalized one, and
 * waiting for finalize would silently drop the most recent week from the signal.
 *
 * The `by_weekStart` index range gives the ascending order for free (Convex returns
 * an index range in index order), so no sort is needed and the read touches only the
 * rows in range. The record is cumulative and never windowed (§2), so callers pass
 * only the upper bound.
 *
 * Takes a `QueryCtx`, which a `MutationCtx` also satisfies (a mutation's `db` is a
 * writer, and a writer is a reader), so both the export query and the generation
 * mutation can call it.
 */
export async function loadRecord(ctx: QueryCtx, beforeWeekStart: string): Promise<RecordWeek[]> {
  const docs = await ctx.db
    .query("currentWeek")
    .withIndex("by_weekStart", (q) => q.lt("weekStart", beforeWeekStart))
    .collect();
  return docs.map(recordWeekFromDoc);
}
