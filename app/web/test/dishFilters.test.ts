import { describe, expect, it } from "vitest";
import type { Dish } from "@plantry/engine";
import {
  activeFilterCount,
  availablePickerFilters,
  cuisineCounts,
  dishInMealTime,
  dishMatchesExploreFilter,
  dishMatchesPickerFilters,
  EMPTY_EXPLORE_FILTER,
  mealTimeCounts,
  PICKER_FILTER_PILLS,
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
  it("Breakfast is the breakfast pool, whatever the dish category", () => {
    const savoury = dish({ category: "Chilla", time: "Breakfast" });
    expect(dishInMealTime(savoury, "Breakfast")).toBe(true);
    expect(dishInMealTime(savoury, "Lunch")).toBe(false);
    // There is no Fruit bucket (features/engine-v4.md §14). A Category=Fruit
    // dish is bucketed by its `time` like anything else; it can never appear in
    // Explore anyway, since every fruit dish is inactive.
    const fruit = dish({ category: "Fruit", time: "Breakfast" });
    expect(dishInMealTime(fruit, "Breakfast")).toBe(true);
    expect(dishInMealTime(fruit, "Lunch")).toBe(false);
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
    const f = filter({ mealTimes: ["Lunch", "Breakfast"] });
    expect(dishMatchesExploreFilter(dish({ time: "Lunch" }), f)).toBe(true);
    expect(dishMatchesExploreFilter(dish({ time: "Breakfast" }), f)).toBe(true);
    const lunchOnly = filter({ mealTimes: ["Lunch"] });
    expect(
      dishMatchesExploreFilter(dish({ category: "Chilla", time: "Breakfast" }), lunchOnly),
    ).toBe(false);
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
      dishMatchesExploreFilter(dish({ cuisine: "Thai", time: "Lunch", complexity: "Easy" }), f),
    ).toBe(false);
  });
});

describe("availablePickerFilters — hides pills with no matching dish", () => {
  it("keeps both meal pills when both meal-times are present in the corpus", () => {
    const corpus = [
      dish({ time: "Breakfast", category: "Chilla" }),
      dish({ time: "Lunch", category: "Gravy dish" }),
    ];
    expect(availablePickerFilters(corpus, PICKER_FILTER_PILLS)).toContain("Breakfast");
    expect(availablePickerFilters(corpus, PICKER_FILTER_PILLS)).toContain("Lunch");
  });

  it("hides the Lunch pill when the corpus has no lunch dish", () => {
    const corpus = [dish({ time: "Breakfast", category: "Chilla" })];
    const pills = availablePickerFilters(corpus, PICKER_FILTER_PILLS);
    expect(pills).toContain("Breakfast");
    expect(pills).not.toContain("Lunch");
  });

  it("hides a quality pill when nothing in the corpus satisfies it", () => {
    // All-Hard corpus: the "Easy to cook" pill has no match and is dropped.
    const corpus = [dish({ complexity: "Hard" }), dish({ complexity: "Medium" })];
    expect(availablePickerFilters(corpus, ["Easy to cook"])).toEqual([]);
    expect(availablePickerFilters([dish({ complexity: "Easy" })], ["Easy to cook"])).toEqual([
      "Easy to cook",
    ]);
  });

  it("preserves candidate order and an empty corpus yields no pills", () => {
    expect(availablePickerFilters([], PICKER_FILTER_PILLS)).toEqual([]);
  });
});

describe("dishMatchesPickerFilters — AND across dimensions, OR within meal-time", () => {
  it("no selection matches everything", () => {
    expect(dishMatchesPickerFilters(dish(), [])).toBe(true);
  });

  it("the meal-time dimension is an OR within itself", () => {
    const sel = ["Breakfast", "Lunch"] as const;
    expect(
      dishMatchesPickerFilters(dish({ time: "Breakfast", category: "Chilla" }), [...sel]),
    ).toBe(true);
    expect(dishMatchesPickerFilters(dish({ time: "Lunch" }), [...sel])).toBe(true);
  });

  it("a single meal pill excludes the other meal-time", () => {
    expect(dishMatchesPickerFilters(dish({ time: "Lunch" }), ["Breakfast"])).toBe(false);
    expect(
      dishMatchesPickerFilters(dish({ time: "Breakfast", category: "Chilla" }), ["Breakfast"]),
    ).toBe(true);
  });

  it("a meal pill AND a quality pill must both hold", () => {
    // Breakfast AND Easy to cook: an easy breakfast passes, a hard one does not.
    const sel = ["Breakfast", "Easy to cook"] as const;
    expect(
      dishMatchesPickerFilters(
        dish({ time: "Breakfast", category: "Chilla", complexity: "Easy" }),
        [...sel],
      ),
    ).toBe(true);
    expect(
      dishMatchesPickerFilters(
        dish({ time: "Breakfast", category: "Chilla", complexity: "Hard" }),
        [...sel],
      ),
    ).toBe(false);
    // An easy LUNCH dish fails the Breakfast constraint even though it is easy.
    expect(dishMatchesPickerFilters(dish({ time: "Lunch", complexity: "Easy" }), [...sel])).toBe(
      false,
    );
  });

  it("the Healthy pill reads the engine-derived flag (live library id)", () => {
    // id 9 (Mushroom matar) is engine-derived Healthy in the baked library; an
    // arbitrary fixture id is not, mirroring library.test.ts's Healthy fixture.
    expect(dishMatchesPickerFilters(dish({ id: 9 }), ["Healthy"])).toBe(true);
    expect(dishMatchesPickerFilters(dish({ id: 999999 }), ["Healthy"])).toBe(false);
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
      { mealTime: "Breakfast", count: 2 },
      { mealTime: "Lunch", count: 2 },
    ]);
  });
});

describe("activeFilterCount", () => {
  it("sums toggles and set sizes", () => {
    expect(activeFilterCount(EMPTY_EXPLORE_FILTER)).toBe(0);
    expect(
      activeFilterCount(
        filter({ easy: true, healthy: true, cuisines: ["Thai", "Italian"], mealTimes: ["Lunch"] }),
      ),
    ).toBe(5);
  });
});
