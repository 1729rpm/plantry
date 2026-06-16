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

// ── Picker-sheet flat chips (swap, add-a-dish) ───────────────────────────────
// The pickers keep the simple flat chip row: the meal dimension is already fixed
// by the slot or the add-a-dish meal selector, so they only offer the two
// dish-quality quick filters. (Explore uses the richer nested filter below.)
export const DISH_FILTERS = ["Easy to cook", "Healthy"] as const;
export type DishFilter = (typeof DISH_FILTERS)[number];

// The chips the picker sheets render (all of them; the meal dimension is fixed).
export const PICKER_FILTERS: DishFilter[] = ["Easy to cook", "Healthy"];

/** Does a dish satisfy every active picker chip? Multi-select is an AND across
 *  the selected chips. */
export function dishMatchesFilters(dish: Dish, filters: DishFilter[]): boolean {
  if (filters.includes("Easy to cook") && dish.complexity !== "Easy") return false;
  if (filters.includes("Healthy") && !dishIsHealthy(dish)) return false;
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
