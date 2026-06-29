import type { MenuHistoryRow } from "./data/schemas.js";
import type { Day, Meal } from "./eligibility.js";
import type { GeneratedWeek } from "./generateWeek.js";

/**
 * History-row derivation (docs/engine.md §8 Skipped days). On finalize, a
 * week's picked dishes append to the historical record
 * (docs/product.md §3 item 4); that record drives the §4 recency rule on later
 * weeks. This pure function derives those `MenuHistoryRow` rows from a generated
 * week.
 *
 * Skipped days are skip-aware: a skipped day keeps its dishes in the data (so a
 * restore is lossless) but contributes NO history rows, because the dishes were
 * not cooked, so recency must not see them. Pass the skipped days via the
 * optional `skippedDays`; the default (none skipped) leaves every caller's
 * behaviour unchanged (pure, additive).
 *
 * Custom one-offs (dishes with no library id) are not part of the generated
 * `GeneratedWeek` shape, which only carries library `Dish` objects; the
 * Convex-side finalize is responsible for excluding custom picks from the
 * archive. This engine function operates on the generated week only.
 */

/**
 * Short day name (Mon..Sat) to the long form a `MenuHistoryRow` carries
 * (Monday..Saturday). The single home for this mapping; generateWeek's history
 * rows resolve through `toLongDay` rather than keeping their own copy.
 */
const LONG_DAY: Record<Day, MenuHistoryRow["day"]> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
};

/** Map a short day name to the long form a `MenuHistoryRow` carries. */
export function toLongDay(day: Day): MenuHistoryRow["day"] {
  return LONG_DAY[day];
}

const CAP_MEAL: Record<Meal, MenuHistoryRow["meal"]> = {
  Breakfast: "Breakfast",
  Lunch: "Lunch",
};

export interface DeriveHistoryRowsArgs {
  week: GeneratedWeek;
  /**
   * Days excluded from the history append (a fast-loop skip). Defaults to none,
   * so existing callers are unchanged. Dishes on a skipped day stay in `week`
   * but produce zero history rows here.
   */
  skippedDays?: ReadonlyArray<Day>;
}

/**
 * Derive the finalize history rows for a generated week, one row per picked
 * dish in (day, meal, pick) order. Skipped days contribute zero rows.
 */
export function deriveHistoryRows(args: DeriveHistoryRowsArgs): MenuHistoryRow[] {
  const { week, skippedDays } = args;
  const skipped = new Set<Day>(skippedDays ?? []);

  const rows: MenuHistoryRow[] = [];
  for (const day of week.days) {
    if (skipped.has(day.day)) continue;
    for (const slot of day.slots) {
      for (const dish of slot.dishes) {
        rows.push({
          weekStart: week.weekStart,
          day: LONG_DAY[day.day],
          meal: CAP_MEAL[slot.meal],
          dishName: dish.name,
          dishId: dish.id,
        });
      }
    }
    // §3.3 Fruit of the day lives outside `slots` on `day.fruit`. Log it as its
    // own `meal:"Fruit"` row (after the day's slot rows) so cross-week fruit
    // rotation (`orderFruitByLongestUnused` via `lastCookedMap`) sees fruit
    // recency. Skip-aware: a skipped day already `continue`d above.
    if (day.fruit !== undefined) {
      rows.push({
        weekStart: week.weekStart,
        day: LONG_DAY[day.day],
        meal: "Fruit",
        dishName: day.fruit.name,
        dishId: day.fruit.id,
      });
    }
  }
  return rows;
}

/**
 * Last-cooked weekStart per dish id, taken from the most recent matching history
 * row (the largest `weekStart` seen for that id). This is the recency primitive
 * the §4 selection ranker (`priority.byLongestUnused`), the §5 picker recency
 * tier (`pickerRanking`), the composition substitution scan, and the §3.3 fruit
 * rotation all build on, so it lives in one place. A dish absent from the map has
 * never been cooked; callers treat "no entry" as longest unused.
 */
export function lastCookedMap(history: MenuHistoryRow[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const row of history) {
    const existing = map.get(row.dishId);
    if (existing === undefined || row.weekStart > existing) {
      map.set(row.dishId, row.weekStart);
    }
  }
  return map;
}
