// Shared quick-filter vocabulary and matching for the dish surfaces that offer
// filters: the Explore feed and the two picker sheets (swap, add-a-dish).
// Keeping the semantics in one place means a filter means exactly the same thing
// wherever it appears. "Easy to cook" reads the dish complexity; "Healthy"
// reads the engine-derived `healthy` flag (engine.md §11: at least 25 percent of
// calories from protein AND at least 3 g of fibre per person, calories via
// Atwater), resolved through dishIsHealthy so the threshold lives only in the
// engine; the meal-time and cuisine filters read the dish's meal-time, category,
// and first-class `cuisine` field.

import type { Dish } from "@plantry/engine";
import { dishIsHealthy } from "./healthy.js";

// ── Picker-sheet quality chips (the fruit slot) ──────────────────────────────
// The fruit slot's Replace picker keeps the simple quality-only chip row: its
// pool is already category-locked to Fruit (the generic-search relaxation does
// not apply there), so the meal dimension is meaningless and it offers only the
// two dish-quality quick filters. (Explore uses the richer nested filter below;
// the breakfast/lunch pickers use the dynamic picker vocabulary further down.)
export const DISH_FILTERS = ["Easy to cook", "Healthy"] as const;
export type DishFilter = (typeof DISH_FILTERS)[number];

// The chips the fruit-slot picker renders (quality only; the pool is Fruit-only).
export const PICKER_FILTERS: DishFilter[] = ["Easy to cook", "Healthy"];

/** Does a dish satisfy every active picker chip? Multi-select is an AND across
 *  the selected chips. */
export function dishMatchesFilters(dish: Dish, filters: DishFilter[]): boolean {
  if (filters.includes("Easy to cook") && dish.complexity !== "Easy") return false;
  if (filters.includes("Healthy") && !dishIsHealthy(dish)) return false;
  return true;
}

// ── Dynamic picker filters (breakfast/lunch swap + add-a-dish) ────────────────
// The breakfast/lunch pickers search a generic pool that mixes both meal-times
// (a breakfast dish is reachable from a lunch slot's Replace and vice versa,
// feature picker-generic-search), so their chip row needs the meal-time pills
// alongside the two quality pills. Two things make this row "dynamic":
//   1. Vocabulary: the meal-time pills (Breakfast, Lunch) are a real filter
//      dimension here, not a fixed slot, because the pool spans both.
//   2. Visibility: a pill is only offered when the current results actually
//      contain a matching dish (availablePickerFilters), so the Lunch pill is
//      hidden when there are no lunch items on screen.
// The combining rule mirrors Explore: AND across the two dimensions (meal-time
// vs quality), OR within the meal-time dimension (Breakfast OR Lunch). Selecting
// both meal pills therefore widens (matches either), while a meal pill plus a
// quality pill narrows (must satisfy both).
export const PICKER_PILLS = ["Breakfast", "Lunch", "Easy to cook", "Healthy"] as const;
export type PickerPill = (typeof PICKER_PILLS)[number];

// The full candidate set the breakfast/lunch pickers draw from. A surface passes
// a subset to availablePickerFilters; the fruit slot does not use this vocabulary
// (it keeps PICKER_FILTERS, quality only).
export const PICKER_FILTER_PILLS: PickerPill[] = ["Breakfast", "Lunch", "Easy to cook", "Healthy"];

// The picker pills that select on the meal-time dimension. Everything else is a
// quality pill. Kept as one list so the AND-across / OR-within split below has a
// single source of truth.
const PICKER_MEAL_PILLS: PickerPill[] = ["Breakfast", "Lunch"];

function isMealPill(pill: PickerPill): pill is "Breakfast" | "Lunch" {
  return (PICKER_MEAL_PILLS as PickerPill[]).includes(pill);
}

/** Does a dish match a single picker pill? Meal pills read the dish's meal-time
 *  (via dishInMealTime, so the buckets stay consistent with Explore); quality
 *  pills read complexity / the engine-derived healthy flag. */
function dishMatchesPickerPill(dish: Dish, pill: PickerPill): boolean {
  if (pill === "Breakfast" || pill === "Lunch") return dishInMealTime(dish, pill);
  if (pill === "Easy to cook") return dish.complexity === "Easy";
  return dishIsHealthy(dish); // "Healthy"
}

/**
 * The candidate pills that have at least one matching dish in `corpus`. This is
 * the "hide the pill when nothing matches it" rule: the Lunch pill is dropped
 * when the current results contain no lunch dish, both meal pills survive when
 * both meal-times are present, and a quality pill is dropped when nothing in the
 * corpus satisfies it. Candidate order is preserved.
 */
export function availablePickerFilters(corpus: Dish[], candidates: PickerPill[]): PickerPill[] {
  return candidates.filter((pill) => corpus.some((d) => dishMatchesPickerPill(d, pill)));
}

/**
 * Does a dish satisfy the selected picker pills? AND across the two dimensions
 * (meal-time vs quality), OR within the meal-time dimension. An empty meal-time
 * selection is "no constraint on meal-time" (both meal-times pass); each selected
 * quality pill is an independent AND constraint. So {Breakfast, Lunch} matches a
 * dish of either meal-time, while {Breakfast, Easy to cook} matches only an easy
 * breakfast dish.
 */
export function dishMatchesPickerFilters(dish: Dish, selected: PickerPill[]): boolean {
  const mealPills = selected.filter(isMealPill);
  if (mealPills.length > 0 && !mealPills.some((p) => dishMatchesPickerPill(dish, p))) {
    return false;
  }
  for (const pill of selected) {
    if (isMealPill(pill)) continue; // handled as an OR group above
    if (!dishMatchesPickerPill(dish, pill)) return false;
  }
  return true;
}

// ── Explore nested filter ────────────────────────────────────────────────────
// Explore's filter is multi-dimensional: two quick toggles, a multi-select set
// of cuisines, and a multi-select set of meal times. Combining rule: AND across
// the dimensions, OR within each multi-select set. An empty set means "no
// constraint on that dimension" (show everything).

/** The three meal-time buckets Explore offers. Distinct and non-overlapping:
 *  Fruit of the day is the Fruit category (Stream D), Breakfast is the savoury
 *  breakfast pool (Fruit category excluded so the buckets do not double-count),
 *  Lunch is the lunch pool. */
export const MEAL_TIMES = ["Breakfast", "Lunch", "Fruit of the day"] as const;
export type MealTimeFilter = (typeof MEAL_TIMES)[number];

export interface ExploreFilterState {
  easy: boolean;
  healthy: boolean;
  /** Selected cuisine names (the `cuisine` field values). Empty = any cuisine. */
  cuisines: string[];
  /** Selected meal-time buckets. Empty = any meal time. */
  mealTimes: MealTimeFilter[];
}

export const EMPTY_EXPLORE_FILTER: ExploreFilterState = {
  easy: false,
  healthy: false,
  cuisines: [],
  mealTimes: [],
};

/** The cuisine displayed for a dish (its first-class field). One place so the
 *  display rule stays consistent across the filter panel and any other surface. */
export function cuisineOf(dish: Dish): string {
  return dish.cuisine;
}

/** Does a dish fall in a given meal-time bucket? Buckets are non-overlapping:
 *  Fruit of the day is the Fruit category, Breakfast is the non-fruit breakfast
 *  pool, Lunch is the lunch pool. */
export function dishInMealTime(dish: Dish, mealTime: MealTimeFilter): boolean {
  if (mealTime === "Fruit of the day") return dish.category === "Fruit";
  if (mealTime === "Breakfast") return dish.time === "Breakfast" && dish.category !== "Fruit";
  return dish.time === "Lunch";
}

/** Does a dish satisfy the full Explore filter? AND across dimensions, OR within
 *  the cuisine and meal-time multi-selects. */
export function dishMatchesExploreFilter(dish: Dish, state: ExploreFilterState): boolean {
  if (state.easy && dish.complexity !== "Easy") return false;
  if (state.healthy && !dishIsHealthy(dish)) return false;
  if (state.cuisines.length > 0 && !state.cuisines.includes(cuisineOf(dish))) return false;
  if (state.mealTimes.length > 0 && !state.mealTimes.some((m) => dishInMealTime(dish, m))) {
    return false;
  }
  return true;
}

/** How many filter dimensions are active, for the collapsed-row count badge and
 *  the "Clear" affordance. */
export function activeFilterCount(state: ExploreFilterState): number {
  return (
    (state.easy ? 1 : 0) + (state.healthy ? 1 : 0) + state.cuisines.length + state.mealTimes.length
  );
}

/** Count dishes per cuisine across a pool, for the cuisine sub-panel's per-row
 *  counts. Returns rows sorted by count desc, then name asc, so the densest
 *  cuisines lead and ties are alphabetical. */
export function cuisineCounts(pool: Dish[]): Array<{ cuisine: string; count: number }> {
  const counts = new Map<string, number>();
  for (const dish of pool) {
    const c = cuisineOf(dish);
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([cuisine, count]) => ({ cuisine, count }))
    .sort((a, b) => b.count - a.count || a.cuisine.localeCompare(b.cuisine));
}

/** Count dishes per meal-time bucket across a pool, for the meal-time sub-panel's
 *  per-row counts. In MEAL_TIMES order (Breakfast, Lunch, Fruit of the day). */
export function mealTimeCounts(pool: Dish[]): Array<{ mealTime: MealTimeFilter; count: number }> {
  return MEAL_TIMES.map((mealTime) => ({
    mealTime,
    count: pool.filter((d) => dishInMealTime(d, mealTime)).length,
  }));
}
