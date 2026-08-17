import type { Dish, Season } from "../../src/data/schemas.js";
import type { Day } from "../../src/eligibility.js";

/**
 * The structural role the engine assigned a pick. The evaluators' output contract
 * fixes this vocabulary, so it is a closed union rather than free text.
 *
 * - `protein-main`     the slot's lead (Indian plate lead, standalone lead, Saturday lead)
 * - `carb`             a lunch carb (Chapati/Rice pool, or the neutral steamed rice)
 * - `companion`        a plate companion (Indian companion, standalone veg side)
 * - `protein-floor`    a protein placed to satisfy plate rule 2, including the
 *                      breakfast HP Keto attach side and the Saturday protein side
 * - `breakfast-main`   the single Mon-Fri breakfast main
 * - `breakfast-accompaniment` the chilla/paratha chutney
 * - `dessert`          a Category=Dessert pick (Saturday third position)
 * - `fruit`            the Fruit of the day
 * - `exploration`      the one weekly exploration position (Friday's first Indian companion)
 */
export type Role =
  | "protein-main"
  | "carb"
  | "companion"
  | "protein-floor"
  | "breakfast-main"
  | "breakfast-accompaniment"
  | "dessert"
  | "fruit"
  | "exploration";

export interface Pick {
  dish: Dish;
  role: Role;
}

export interface DayPlan {
  day: Day;
  /** ISO date of this day, derived from the week's Monday. */
  date: string;
  fruit?: Pick;
  breakfast: Pick[];
  lunch: Pick[];
}

export interface WeekPlan {
  weekStart: string;
  season: Season;
  days: DayPlan[];
}

/**
 * Every warning a run produces. `kind` is a closed vocabulary so the incidents
 * file can be grouped without string archaeology.
 */
export type IncidentKind =
  | "empty-pool"
  | "protein-floor-unfilled"
  | "cap-exceeded"
  | "unplaced-favorite"
  | "pairs-with-unavailable"
  | "guard-relaxation"
  | "hp-source-conflict"
  | "standalone-over-two-items";

export interface Incident {
  weekStart: string;
  day?: Day;
  /** The slot the incident belongs to, e.g. "Lunch:companion" or "Breakfast:main". */
  slot?: string;
  kind: IncidentKind;
  reason: string;
  dishId?: number;
  dishName?: string;
}

/** A favorite as the engine consumes it: a library dish id plus the §3.4 dial. */
export interface FavoriteInput {
  dishId: number;
  /** §3.4 step 1 dial. 1 or 2, capped at 2. Absent reads as 1. */
  timesPerWeek?: number;
}
