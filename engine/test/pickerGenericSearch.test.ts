import { describe, it, expect } from "vitest";
import { rankPickerAlternatives } from "../src/pickerRanking.js";
import type { Dish } from "../src/data/schemas.js";

/**
 * Generic-search picker (`features/picker-generic-search.md`, Stream 2). The
 * relaxed picker logic lives in `app/convex/swap.ts`, whose workspace has no test
 * runner; these tests guard the two pure contracts that swap.ts relies on, at the
 * engine layer CI actually exercises. They mirror exactly what
 * `getSlotAlternatives` does:
 *   1. The broad meal-slot pool is generic across meal-time and excludes Fruit.
 *   2. After `rankPickerAlternatives`, the caller stable-partitions so slot-meal-
 *      matching dishes lead and cross-meal dishes follow, each group keeping its
 *      ranked order.
 *
 * This file is the engine-layer analogue of `broadPoolRanking.test.ts`; the
 * convex handler's reject paths (cross-meal accepted, Fruit rejected from a meal
 * slot, fruit slot rejects non-fruit) are not covered here because the convex
 * package has no runner. See the PR diagnosis card.
 */

let nextId = 1;
function makeDish(overrides: Partial<Dish> = {}): Dish {
  const id = nextId++;
  return {
    id,
    name: `Dish ${id}`,
    category: "Gravy dish",
    time: "Lunch",
    tags: [],
    primaryIngredient: "Paneer",
    preferred: "No",
    active: "Yes",
    satiety: "Medium",
    prepMinutes: 30,
    seasons: "All",
    cuisine: "Indian",
    ...overrides,
  };
}

/**
 * The broad meal-slot pool predicate from `app/convex/swap.ts` `broadPool`
 * (breakfast/lunch branch): Active + in-season + not Fruit, generic across
 * meal-time. Kept inline (not imported) because the convex module is not part of
 * the engine build; this is the contract the caller must uphold.
 */
function broadMealPool(library: Dish[], season: string): Dish[] {
  return library.filter((d) => {
    if (d.active !== "Yes") return false;
    if (d.category === "Fruit") return false;
    if (d.seasons === "All") return true;
    return (d.seasons as string[]).includes(season);
  });
}

/**
 * The slot-meal-first stable partition from `getSlotAlternatives`: slot-meal-
 * matching dishes lead, cross-meal follow, each group preserving input order.
 */
function partitionSlotMealFirst(ranked: Dish[], engineMeal: "Breakfast" | "Lunch"): Dish[] {
  const slotMeal: Dish[] = [];
  const crossMeal: Dish[] = [];
  for (const dish of ranked) {
    if (dish.time === engineMeal) slotMeal.push(dish);
    else crossMeal.push(dish);
  }
  return [...slotMeal, ...crossMeal];
}

describe("generic-search broad meal-slot pool", () => {
  it("is generic across meal-time: a breakfast dish is in a lunch slot's pool", () => {
    nextId = 1;
    const breakfastDish = makeDish({ name: "Pav", time: "Breakfast" });
    const lunchDish = makeDish({ name: "Rajma", time: "Lunch" });
    const pool = broadMealPool([breakfastDish, lunchDish], "Monsoon");
    const ids = pool.map((d) => d.id);
    // Both reachable from any meal slot — no meal-time filter.
    expect(ids).toContain(breakfastDish.id);
    expect(ids).toContain(lunchDish.id);
  });

  it("excludes Fruit, drops inactive and out-of-season dishes", () => {
    nextId = 1;
    const keep = makeDish({ name: "Idli", time: "Breakfast" });
    const fruit = makeDish({ name: "Mango", category: "Fruit", time: "Breakfast" });
    const inactive = makeDish({ name: "Old", active: "No" });
    const offSeason = makeDish({ name: "Winter Only", seasons: ["Winter"] });
    const pool = broadMealPool([keep, fruit, inactive, offSeason], "Monsoon");
    const ids = pool.map((d) => d.id);
    expect(ids).toContain(keep.id);
    expect(ids).not.toContain(fruit.id);
    expect(ids).not.toContain(inactive.id);
    expect(ids).not.toContain(offSeason.id);
  });
});

describe("generic-search slot-meal-first partition", () => {
  it("leads with slot-meal-matching dishes, cross-meal dishes follow", () => {
    nextId = 1;
    // A generic lunch-slot pool mixing both meal-times. None on the day, none
    // cooked, so rankPickerAlternatives orders purely by id (the recency tier
    // ties) and we can reason about the partition deterministically.
    const lunchA = makeDish({ name: "Lunch A", time: "Lunch" });
    const breakfastA = makeDish({ name: "Breakfast A", time: "Breakfast" });
    const lunchB = makeDish({ name: "Lunch B", time: "Lunch" });
    const breakfastB = makeDish({ name: "Breakfast B", time: "Breakfast" });
    const pool = [lunchA, breakfastA, lunchB, breakfastB];

    const ranked = rankPickerAlternatives({
      pool,
      meal: "Lunch",
      dishesOnDay: [],
      history: [],
    });
    const partitioned = partitionSlotMealFirst(ranked, "Lunch");
    const ids = partitioned.map((d) => d.id);

    // Every lunch (slot-meal) dish precedes every breakfast (cross-meal) dish.
    const lastSlotMeal = Math.max(ids.indexOf(lunchA.id), ids.indexOf(lunchB.id));
    const firstCrossMeal = Math.min(ids.indexOf(breakfastA.id), ids.indexOf(breakfastB.id));
    expect(lastSlotMeal).toBeLessThan(firstCrossMeal);
    // The partition is stable: each group keeps its ranked (here id-ascending) order.
    expect(ids.indexOf(lunchA.id)).toBeLessThan(ids.indexOf(lunchB.id));
    expect(ids.indexOf(breakfastA.id)).toBeLessThan(ids.indexOf(breakfastB.id));
    // Nothing is dropped — the full pool is still returned.
    expect(new Set(ids)).toEqual(new Set([lunchA.id, breakfastA.id, lunchB.id, breakfastB.id]));
  });

  it("a cross-meal dish is reachable in the partitioned result (searchable)", () => {
    nextId = 1;
    // From a lunch slot, a breakfast dish (e.g. Pav) is still present after the
    // partition — it follows the lunch dishes rather than being filtered out.
    const pav = makeDish({ name: "Pav", time: "Breakfast" });
    const rajma = makeDish({ name: "Rajma", time: "Lunch" });
    const pool = broadMealPool([pav, rajma], "Monsoon");
    const ranked = rankPickerAlternatives({ pool, meal: "Lunch", dishesOnDay: [], history: [] });
    const partitioned = partitionSlotMealFirst(ranked, "Lunch");
    const ids = partitioned.map((d) => d.id);
    expect(ids).toContain(pav.id);
    // Slot-meal (Rajma) leads the cross-meal (Pav).
    expect(ids.indexOf(rajma.id)).toBeLessThan(ids.indexOf(pav.id));
  });
});
