import { v, type Infer } from "convex/values";

/**
 * Single source of truth for the lowercase meal types that flow through the live
 * `currentWeek`. Two distinct sets live here; do not collapse them:
 *
 *   - `slotMealValidator` / `SlotMeal` — the full set of `meal` values a stored
 *     `currentWeek.slots` row can carry: "breakfast" | "lunch" | "fruit". This
 *     validator is the schema's source of truth for `currentWeek.slots[].meal`
 *     (see `schema.ts`), so the TS type and the runtime validator can never
 *     drift, and any new slot meal added here forces every exhaustive
 *     `Record<SlotMeal, …>` / switch over slot meals to be updated before it
 *     compiles.
 *
 *     **"fruit" is a READ-ONLY LEGACY value.** The Fruit of the day is removed
 *     (`features/engine-v4.md` §14): nothing generates, swaps into, or renders a
 *     fruit slot any more. The literal STAYS because Convex validates every
 *     existing document against the schema on deploy and production holds real
 *     `meal:"fruit"` slot rows written before the removal; dropping it fails the
 *     deploy outright. Readers must keep tolerating a fruit row and skip it.
 *
 *   - `mealTimeValidator` / `MealTime` — the set a user can *target* when adding
 *     or swapping a meal: "breakfast" | "lunch". These are the only meals that
 *     exist going forward, so every call boundary (add, delete, recipe, custom,
 *     swap) draws its `meal` arg from this set, not from `SlotMeal`.
 *
 * The same distinction is described inline at the `swap.ts` call sites; this is
 * the type-level expression of it.
 */
export const slotMealValidator = v.union(
  v.literal("breakfast"),
  v.literal("lunch"),
  // Read-only legacy: stored fruit slots must keep validating. Never written.
  v.literal("fruit"),
);
export type SlotMeal = Infer<typeof slotMealValidator>;

export const mealTimeValidator = v.union(v.literal("breakfast"), v.literal("lunch"));
export type MealTime = Infer<typeof mealTimeValidator>;
