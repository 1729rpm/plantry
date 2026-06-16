// Frontend-local type aliases for slice 1. These mirror the Convex schema
// for currentWeek but are duplicated here so app/web does not need a TS
// project reference to app/convex (the generated client uses anyApi at
// runtime; types come from convex/_generated/dataModel only when wired).

export type Identity = "rajat" | "tuhina";

export type ShortDay = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";
/**
 * A meal slot the editor can swap a dish in. Breakfast and lunch are the
 * full-editing meals (swap, add, delete, custom one-off). The Fruit of the day
 * is swap-only (one fruit per day; no add/delete/one-off), so it is in `Meal`
 * for the swap flow while the editor gates add/delete on `MealTime` below.
 */
export type Meal = "breakfast" | "lunch" | "fruit";
/**
 * The breakfast/lunch meals: the slots that support the full editing family
 * (swap, add, delete, custom one-off). The Fruit of the day is deliberately
 * excluded so add/delete/one-off stay off it (swap only, this PR's scope).
 */
export type MealTime = "breakfast" | "lunch";
/**
 * The meal value a stored `currentWeek` slot can carry. Same set as `Meal`: the
 * standalone Fruit of the day (docs/engine.md §3.3) is one Category=Fruit dish
 * per day Mon-Sat, its own section outside breakfast/lunch and outside the §9
 * item cap. System-picked at generation, swappable (only) in the editor.
 */
export type SlotMeal = Meal;
export type SlotSource = "generated" | "swapped" | "custom";
export type SlotAuthor = "rajat" | "tuhina" | "system";

/**
 * One picked dish at one position within a (day, meal) slot. Per-position
 * source/author/updatedAt let the slow loop attribute who changed which dish
 * within a multi-dish meal.
 */
export interface DishPick {
  dishId: number | null;
  customLabel: string | null;
  source: SlotSource;
  author: SlotAuthor;
  updatedAt: number;
  /**
   * Share preference: when true, this dish's recipe sheet rides along in the
   * shared image family (the swipe-rail share, slice 8.1). Lives on the week
   * document, so it resets when a new week is generated (Decision #10). Optional
   * and additive, mirroring the Convex schema; absent reads as not included.
   */
  includeRecipe?: boolean;
}

/**
 * One (day, meal) slot. `dishes` is the position-ordered list of picks:
 * lead first (e.g. HP for Menu 1, complete_meal for Menu 3), then partners
 * and the lunch carb where applicable. Mon/Wed/Fri lunch holds 3 picks, Tue/
 * Thu lunch 4 picks, Sat lunch 3, Mon/Wed/Fri breakfast 2, Tue/Thu breakfast 1.
 */
export interface WeekSlot {
  day: ShortDay;
  meal: SlotMeal;
  dishes: DishPick[];
}

/**
 * A day the household marked skipped (eating out or away). The day's dishes stay
 * in `slots` so restore is lossless; the Menu screen renders the reason in place
 * of meals, and the skip-aware grocery query drops the day's ingredients.
 */
export interface SkippedDay {
  day: ShortDay;
  reason: string;
  author: Identity;
  skippedAt: number;
}

export interface CurrentWeek {
  weekStart: string;
  status: "draft" | "final";
  slots: WeekSlot[];
  skippedDays?: SkippedDay[];
  version: number;
}

export interface CachedWeek {
  cachedAt: number;
  week: CurrentWeek;
}
