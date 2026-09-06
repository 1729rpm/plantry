import type { MenuHistoryRow } from "./data/schemas.js";
import type { Day } from "./eligibility.js";

/**
 * The short-day to long-day mapping, and nothing else.
 *
 * This module used to derive the finalize history rows for a generated week
 * (`deriveHistoryRows`) and the last-cooked map the v3 recency rules read
 * (`lastCookedMap`). v6 retires both: the record is the persisted `currentWeek`
 * rows, derived in `engine/src/v6/record.ts`, and the seed history is no longer
 * a signal (`features/engine-v6.md` §13). The finalize archive append is derived
 * Convex-side from the live slots (`app/convex/weekMutations.ts`), because the
 * live week carries swapped and custom picks a generated week does not.
 *
 * What survives is the day-label mapping, which `engine/src/v6/generateWeekV6.ts`
 * uses for its incident messages. It keeps its home here so the mapping has one
 * definition.
 */

const LONG_DAY: Record<Day, MenuHistoryRow["day"]> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
};

/** Map a short day name (Mon..Sat) to its long form (Monday..Saturday). */
export function toLongDay(day: Day): MenuHistoryRow["day"] {
  return LONG_DAY[day];
}
