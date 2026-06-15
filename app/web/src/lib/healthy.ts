// The engine-derived "Healthy" flag for the dish library, the single source of
// truth behind the Explore and picker "Healthy" filter chip. Health is NOT a
// stored dish field and the thresholds are NOT re-implemented here: this module
// runs the engine's deriveDishMacros over the baked catalog + ingredient rows
// (engine.md §11) and exposes the resulting boolean. Correcting an ingredient's
// macros in the catalog re-bakes the library and re-derives this flag.

import { catalog, dishes, ingredients } from "@plantry/engine/library";
import { deriveDishMacros } from "@plantry/engine";
import type { Dish } from "@plantry/engine";

// Group ingredient rows by dish once, then derive each dish's macros and keep
// only the ids the engine flags healthy. Built at module load over the static
// baked library, so a lookup is O(1).
const rowsByDish = new Map<number, (typeof ingredients)[number][]>();
for (const row of ingredients) {
  const list = rowsByDish.get(row.dishId) ?? [];
  list.push(row);
  rowsByDish.set(row.dishId, list);
}

const HEALTHY_DISH_IDS = new Set<number>();
for (const dish of dishes) {
  const rows = rowsByDish.get(dish.id) ?? [];
  if (deriveDishMacros(rows, catalog).healthy) HEALTHY_DISH_IDS.add(dish.id);
}

/** Whether the engine derives this dish as Healthy (engine.md §11). */
export function dishIsHealthy(dish: Dish): boolean {
  return HEALTHY_DISH_IDS.has(dish.id);
}
