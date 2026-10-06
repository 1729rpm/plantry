import type { Doc } from "../_generated/dataModel.js";
import type { SlotMeal } from "./meals.js";

/**
 * The `weekArchive` row derivation (`docs/engineering.md` §3, §16).
 *
 * Generation archives every earlier `currentWeek` row that has no archive row
 * yet, so a week's archive row is its state as of the next generation. The
 * archive is provenance only: nothing reads it, and the engine's record is the
 * live `currentWeek` rows (`lib/record.ts`).
 *
 * This module is pure and imports no library and no Convex server code (both
 * imports above are type-only), so it can be unit tested in isolation. The
 * caller passes the baked library's names as a map.
 */

type ShortDay = Doc<"currentWeek">["slots"][number]["day"];
export type ArchiveDay = Doc<"weekArchive">["rows"][number]["day"];
export type ArchiveMeal = Doc<"weekArchive">["rows"][number]["meal"];
export type ArchiveRow = Doc<"weekArchive">["rows"][number];

/** The subset of a `currentWeek` doc the derivation reads. */
export type ArchiveSource = Pick<Doc<"currentWeek">, "slots" | "skippedDays">;

const LONG_DAY: Record<ShortDay, ArchiveDay> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
};

// Keyed by the exhaustive `SlotMeal` (the schema's slot-meal source of truth):
// adding a new slot meal to `slotMealValidator` forces a new entry here at
// compile time, instead of silently archiving the slot under a missing key at
// runtime.
const CAP_MEAL: Record<SlotMeal, ArchiveMeal> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  fruit: "Fruit",
};

/**
 * Converts one stored `currentWeek` row into its `weekArchive` rows.
 *
 * Pure: no database, no clock, no library. Rows follow slot order and then
 * position order, so the archive reads the way the week was cooked. Exclusions:
 *
 *   1. A day named in `skippedDays` contributes nothing. A skipped day was not
 *      cooked; its slots stay intact on the live row so restore is lossless,
 *      which is why the filter happens here.
 *   2. A pick with a null `dishId` (a free-text custom one-off) contributes
 *      nothing: an archive row keys on a library dish id and name, and a
 *      one-off has neither.
 *   3. A pick whose id is not in `nameById` is skipped defensively (the swap
 *      and add mutations only write library ids, so real data never hits it).
 *
 * The standalone fruit slot archives with `meal: "Fruit"`. A week with no
 * eligible picks yields an empty array; the caller still writes a row for it
 * so the week is never rescanned.
 */
export function archiveRowsFromDoc(
  doc: ArchiveSource,
  nameById: ReadonlyMap<number, string>,
): ArchiveRow[] {
  const skipped = new Set<ShortDay>((doc.skippedDays ?? []).map((entry) => entry.day));

  const rows: ArchiveRow[] = [];
  for (const slot of doc.slots) {
    if (skipped.has(slot.day)) continue;
    for (const pick of slot.dishes) {
      if (pick.dishId === null) continue;
      const dishName = nameById.get(pick.dishId);
      if (dishName === undefined) continue;
      rows.push({
        day: LONG_DAY[slot.day],
        meal: CAP_MEAL[slot.meal],
        dishName,
        dishId: pick.dishId,
      });
    }
  }
  return rows;
}
