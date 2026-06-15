// Shared quick-filter vocabulary and matching for the dish surfaces that offer
// filter chips: the Explore feed and the two picker sheets (swap, add-a-dish).
// Keeping the semantics in one place means a chip means exactly the same thing
// wherever it appears. "Easy to cook" reads the dish complexity; "Healthy"
// reads the (forward-looking) `healthy` tag (a filter-only tag with no rule
// semantics, so the chip is inert until that tag is populated rather than
// guessing health from other fields); "Breakfast"/"Lunch" read the meal-time.

import type { Dish } from "@plantry/engine";

// The full filter set, mirrored from the Explore feed. Each surface renders the
// subset that is meaningful there (the pickers drop the meal chips because the
// meal is already fixed by the slot or by the add-a-dish meal selector).
export const DISH_FILTERS = ["Easy to cook", "Healthy", "Breakfast", "Lunch"] as const;
export type DishFilter = (typeof DISH_FILTERS)[number];

// The chips the picker sheets render. The meal dimension is already fixed on
// both pickers (the swap slot's meal; the add-a-dish meal selector), so the
// Breakfast/Lunch chips would be redundant controls and are dropped.
export const PICKER_FILTERS: DishFilter[] = ["Easy to cook", "Healthy"];

/** Does a dish satisfy every active filter? Multi-select is an AND across the
 *  selected chips, matching the Explore feed. */
export function dishMatchesFilters(dish: Dish, filters: DishFilter[]): boolean {
  if (filters.includes("Easy to cook") && dish.complexity !== "Easy") return false;
  if (filters.includes("Healthy") && !dish.tags.some((t) => t.toLowerCase() === "healthy"))
    return false;
  if (filters.includes("Breakfast") && dish.time !== "Breakfast") return false;
  if (filters.includes("Lunch") && dish.time !== "Lunch") return false;
  return true;
}
