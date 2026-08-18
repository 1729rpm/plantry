// Frontend-local type aliases for slice 1. These mirror the Convex schema
// for currentWeek but are duplicated here so app/web does not need a TS
// project reference to app/convex (the generated client uses anyApi at
// runtime; types come from convex/_generated/dataModel only when wired).

export type Identity = "rajat" | "tuhina";

export type ShortDay = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";
/**
 * A meal slot the editor can act on. Breakfast and lunch are the only meals: they
 * support the full editing family (swap, add, delete, custom one-off).
 */
export type Meal = "breakfast" | "lunch";
/** Alias kept for the call sites that name the editable set explicitly. */
export type MealTime = Meal;
/**
 * The meal value a stored `currentWeek` slot can carry. Wider than `Meal` by one
 * READ-ONLY LEGACY value: a week generated before the Fruit of the day was
 * removed (`features/engine-v4.md` §14) still holds `meal:"fruit"` slots, and the
 * Convex schema keeps the literal because dropping it would fail the deploy.
 * Nothing writes one and no surface renders one; every reader filters it out.
 */
export type SlotMeal = Meal | "fruit";
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
 * A slot the app renders. Same shape as `WeekSlot` with the legacy fruit meal
 * narrowed away; produced by filtering on `isRenderableSlotMeal`, which is where
 * a pre-§14 week's fruit slot drops out.
 */
export interface RenderableWeekSlot extends WeekSlot {
  meal: Meal;
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
