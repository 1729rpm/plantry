import { v, type Infer } from "convex/values";

/**
 * Single source of truth for the lowercase meal types that flow through the live
 * `currentWeek`. Two distinct sets live here; do not collapse them:
 *
 *   - `slotMealValidator` / `SlotMeal` — the full set of `meal` values a stored
 *     `currentWeek.slots` row can carry: "breakfast" | "lunch" | "fruit". The
 *     §3.3 Fruit of the day (docs/engine.md §3.3) is flattened into `slots` as a
 *     standalone `meal: "fruit"` slot by `generateWeek.ts`, so any code that
 *     reads or iterates the live slots sees this wider set. This validator is the
 *     schema's source of truth for `currentWeek.slots[].meal` (see `schema.ts`),
 *     so the TS type and the runtime validator can never drift, and any new slot
 *     meal added here forces every exhaustive `Record<SlotMeal, …>` / switch over
 *     slot meals to be updated before it compiles.
 *
 *   - `mealTimeValidator` / `MealTime` — the narrower set a user can *target*
 *     when adding or swapping a meal: "breakfast" | "lunch". Fruit is swap-only
 *     via its own slot, and custom dishes are breakfast/lunch only (fruit is
 *     category-locked, no custom dish), so the add/delete/recipe/custom call
 *     boundaries draw their `meal` arg from this set, not from `SlotMeal`.
 *
 * The same distinction is described inline at the `swap.ts` call sites; this is
 * the type-level expression of it.
 */
export const slotMealValidator = v.union(
  v.literal("breakfast"),
  v.literal("lunch"),
  v.literal("fruit"),
);
export type SlotMeal = Infer<typeof slotMealValidator>;

export const mealTimeValidator = v.union(v.literal("breakfast"), v.literal("lunch"));
export type MealTime = Infer<typeof mealTimeValidator>;
