import type { Dish } from "./data/schemas.js";
import type { Day, Meal } from "./eligibility.js";

/**
 * The generated-week output shape.
 *
 * These three interfaces are the contract between the engine and everything
 * downstream of it: `engine/src/v6/types.ts` extends `GeneratedWeek` as
 * `GeneratedWeekV6`, `engine/src/v6/generateWeekV6.ts` builds the day and slot
 * arrays, and `app/convex/generateWeek.ts` converts a generated week into the
 * `currentWeek` row. The module carries the shape and nothing else; the
 * generation that fills it lives in `engine/src/v6/`.
 */

export interface GeneratedWeekSlot {
  day: Day;
  meal: Meal;
  /**
   * Dishes picked for this slot in pick order: the lead item first (the star for
   * a lunch, the main for a breakfast), then its companions, then the carb where
   * applicable.
   */
  dishes: Dish[];
}

export interface GeneratedWeekDay {
  day: Day;
  slots: GeneratedWeekSlot[];
  /**
   * Fruit of the day, when the engine places one. Its own section, outside the
   * breakfast/lunch `slots` and outside the item cap, so it never appears in
   * `slots` and is never a cap-drop candidate.
   */
  fruit?: Dish;
}

export interface GeneratedWeek {
  weekStart: string;
  days: GeneratedWeekDay[];
  /** Dish ids dropped by the item cap, in the order they were dropped. */
  droppedDishIds: number[];
  /** Human-readable warnings ("Friday over cap (5), dropped: ..."). */
  incidents: string[];
  /**
   * Library favorite ids the guaranteed placement pass could not land this week,
   * in oldest-first order. The engine never breaks a composition lock to force a
   * favorite; it reports the unplaced ones so the Convex layer can log one
   * incident per generated week naming them. Empty when every favorite landed
   * (and always empty for a run with no favorites).
   */
  unplacedFavorites: number[];
}
