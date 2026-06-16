import { describe, expect, it } from "vitest";
import type { Dish } from "@plantry/engine";
import {
  activeFilterCount,
  cuisineCounts,
  dishInMealTime,
  dishMatchesExploreFilter,
  EMPTY_EXPLORE_FILTER,
  mealTimeCounts,
  type ExploreFilterState,
} from "../src/lib/dishFilters.js";

function dish(overrides: Partial<Dish> = {}): Dish {
  return {
    id: 1,
    name: "Test dish",
    category: "Dry dish",
    time: "Lunch",
    tags: [],
    primaryIngredient: "Paneer",
    preferred: "No",
    active: "Yes",
    satiety: "Medium",
    prepMinutes: 20,
    seasons: "All",
    cuisine: "Indian",
    complexity: "Easy",
    ...overrides,
  };
}

function filter(overrides: Partial<ExploreFilterState> = {}): ExploreFilterState {
  return { ...EMPTY_EXPLORE_FILTER, ...overrides };
}

describe("dishInMealTime — non-overlapping buckets", () => {
  it("Fruit of the day is the Fruit category", () => {
    const fruit = dish({ category: "Fruit", time: "Breakfast" });
    expect(dishInMealTime(fruit, "Fruit of the day")).toBe(true);
    // A fruit bowl is NOT counted under Breakfast (buckets do not double-count).
    expect(dishInMealTime(fruit, "Breakfast")).toBe(false);
  });

  it("Breakfast is the non-fruit breakfast pool", () => {
    const savoury = dish({ category: "Chilla", time: "Breakfast" });
    expect(dishInMealTime(savoury, "Breakfast")).toBe(true);
    expect(dishInMealTime(savoury, "Fruit of the day")).toBe(false);
    expect(dishInMealTime(savoury, "Lunch")).toBe(false);
  });

  it("Lunch is the lunch pool", () => {
    const lunch = dish({ time: "Lunch", category: "Gravy dish" });
    expect(dishInMealTime(lunch, "Lunch")).toBe(true);
    expect(dishInMealTime(lunch, "Breakfast")).toBe(false);
  });
});

describe("dishMatchesExploreFilter — AND across dimensions, OR within sets", () => {
  it("empty filter matches everything", () => {
    expect(dishMatchesExploreFilter(dish(), EMPTY_EXPLORE_FILTER)).toBe(true);
  });

  it("Easy toggle excludes non-Easy dishes", () => {
    expect(dishMatchesExploreFilter(dish({ complexity: "Hard" }), filter({ easy: true }))).toBe(
      false,
    );
    expect(dishMatchesExploreFilter(dish({ complexity: "Easy" }), filter({ easy: true }))).toBe(
      true,
    );
  });

  it("cuisine set is an OR within the dimension", () => {
    const f = filter({ cuisines: ["Italian", "Thai"] });
    expect(dishMatchesExploreFilter(dish({ cuisine: "Italian" }), f)).toBe(true);
    expect(dishMatchesExploreFilter(dish({ cuisine: "Thai" }), f)).toBe(true);
    expect(dishMatchesExploreFilter(dish({ cuisine: "Indian" }), f)).toBe(false);
  });

  it("meal-time set is an OR within the dimension", () => {
    const f = filter({ mealTimes: ["Lunch", "Fruit of the day"] });
    expect(dishMatchesExploreFilter(dish({ time: "Lunch" }), f)).toBe(true);
    expect(dishMatchesExploreFilter(dish({ category: "Fruit", time: "Breakfast" }), f)).toBe(true);
    expect(dishMatchesExploreFilter(dish({ category: "Chilla", time: "Breakfast" }), f)).toBe(
      false,
    );
  });

  it("dimensions AND-combine", () => {
    // Italian AND Lunch AND Easy: all three must hold.
    const f = filter({ cuisines: ["Italian"], mealTimes: ["Lunch"], easy: true });
    expect(
      dishMatchesExploreFilter(dish({ cuisine: "Italian", time: "Lunch", complexity: "Easy" }), f),
    ).toBe(true);
    expect(
      dishMatchesExploreFilter(dish({ cuisine: "Italian", time: "Lunch", complexity: "Hard" }), f),
    ).toBe(false);
    expect(
      dishMatchesExploreFilter(
        dish({ cuisine: "Thai", time: "Lunch", complexity: "Easy" }),
        f,
      ),
    ).toBe(false);
  });
});

describe("cuisineCounts", () => {
  it("counts per cuisine, sorted by count desc then name asc", () => {
    const pool = [
      dish({ cuisine: "Indian" }),
      dish({ cuisine: "Indian" }),
      dish({ cuisine: "Thai" }),
      dish({ cuisine: "Italian" }),
    ];
    expect(cuisineCounts(pool)).toEqual([
      { cuisine: "Indian", count: 2 },
      { cuisine: "Italian", count: 1 },
      { cuisine: "Thai", count: 1 },
    ]);
  });
});

describe("mealTimeCounts", () => {
  it("counts each bucket in MEAL_TIMES order", () => {
    const pool = [
      dish({ time: "Breakfast", category: "Chilla" }),
      dish({ time: "Lunch", category: "Gravy dish" }),
      dish({ time: "Lunch", category: "Rice" }),
      dish({ time: "Breakfast", category: "Fruit" }),
    ];
    expect(mealTimeCounts(pool)).toEqual([
      { mealTime: "Breakfast", count: 1 },
      { mealTime: "Lunch", count: 2 },
      { mealTime: "Fruit of the day", count: 1 },
    ]);
  });
});

describe("activeFilterCount", () => {
  it("sums toggles and set sizes", () => {
    expect(activeFilterCount(EMPTY_EXPLORE_FILTER)).toBe(0);
    expect(
      activeFilterCount(filter({ easy: true, healthy: true, cuisines: ["Thai", "Italian"], mealTimes: ["Lunch"] })),
    ).toBe(5);
  });
});
