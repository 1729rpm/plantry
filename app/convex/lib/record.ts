import type { Doc } from "../_generated/dataModel.js";
import type { QueryCtx } from "../_generated/server.js";
import type { V6Day as Day, V6Pick as Pick, RecordWeek } from "@plantry/engine";

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
 * The three shapes this module speaks are the engine's own, re-exported here so
 * every backend caller keeps importing them from one place.
 *
 * They were declared locally when this file was written (stream E1), because the
 * engine package's root index did not yet carry the v6 surface. It does now, so
 * the mirror is gone: `Day` and `Pick` leave the engine aliased as `V6Day` and
 * `V6Pick` (the production engine already exports both names), and `RecordWeek`
 * comes through unaliased. Aliasing them back to the short names here keeps this
 * module's callers unchanged and keeps the aliasing in exactly one place.
 *
 * What the shapes mean, all per `features/engine-v6.md`: a `Day` is one of the six
 * days the engine schedules (Sunday is never generated); a `Pick` is one as-eaten
 * pick or one engine placement, whose `meal` is the stored slot's own meal, so the
 * standalone fruit slot passes through as `"fruit"` rather than being folded into
 * breakfast or lunch (§2.2 keeps the fruit scope separate all the way down); a
 * `RecordWeek` is one record week as the backend hands it over (§2.1).
 */
export type { Day, Pick, RecordWeek };

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
