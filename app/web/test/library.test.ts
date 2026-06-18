import { describe, expect, it } from "vitest";
import type { Dish } from "@plantry/engine";
import {
  addablePool,
  complexityShortLabel,
  exploreCardTags,
  swapPickerVisible,
} from "../src/lib/library.js";

// A minimal valid Dish; each test overrides only the fields it exercises. The
// helpers under test read complexity / prepMinutes / tags / category / satiety,
// so the rest is filler that keeps the type happy.
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

describe("exploreCardTags — difficulty pill", () => {
  it("is always present and first", () => {
    const tags = exploreCardTags(dish({ tags: [], prepMinutes: 0, satiety: "Low" }));
    expect(tags[0]).toMatchObject({ kind: "difficulty" });
  });

  it("uses the concise label + variant per complexity", () => {
    expect(exploreCardTags(dish({ complexity: "Easy" }))[0]).toMatchObject({
      label: "Easy",
      variant: "easy",
    });
    expect(exploreCardTags(dish({ complexity: "Medium" }))[0]).toMatchObject({
      label: "Medium",
      variant: "medium",
    });
    expect(exploreCardTags(dish({ complexity: "Hard" }))[0]).toMatchObject({
      label: "Hard",
      variant: "hard",
    });
  });
});

describe("exploreCardTags — prep-time pill", () => {
  it("shows '{prepMinutes} min' when present", () => {
    const labels = exploreCardTags(dish({ prepMinutes: 25 })).map((t) => t.label);
    expect(labels).toContain("25 min");
  });

  it("is omitted when prepMinutes is 0", () => {
    const labels = exploreCardTags(dish({ prepMinutes: 0 })).map((t) => t.label);
    expect(labels.some((l) => l.endsWith(" min"))).toBe(false);
  });
});

describe("exploreCardTags — descriptor priority", () => {
  it("maps the HP tag to 'High protein'", () => {
    const labels = exploreCardTags(dish({ tags: ["HP"] })).map((t) => t.label);
    expect(labels).toContain("High protein");
  });

  it("maps category 'Complete meal' to 'Complete meal'", () => {
    const labels = exploreCardTags(dish({ category: "Complete meal", tags: [] })).map(
      (t) => t.label,
    );
    expect(labels).toContain("Complete meal");
  });

  it("maps the complete_meal tag to 'Complete meal'", () => {
    const labels = exploreCardTags(dish({ tags: ["complete_meal"] })).map((t) => t.label);
    expect(labels).toContain("Complete meal");
  });

  it("shows the cuisine field (e.g. 'Italian') as the descriptor", () => {
    const labels = exploreCardTags(dish({ cuisine: "Italian" })).map((t) => t.label);
    expect(labels).toContain("Italian");
  });

  it("does NOT show the default Indian cuisine as a descriptor", () => {
    const labels = exploreCardTags(dish({ cuisine: "Indian", satiety: "Low" })).map((t) => t.label);
    expect(labels).not.toContain("Indian");
  });

  it("maps satiety High to 'Filling'", () => {
    const labels = exploreCardTags(dish({ tags: [], satiety: "High" })).map((t) => t.label);
    expect(labels).toContain("Filling");
  });

  it("shows only ONE descriptor", () => {
    // HP, complete_meal, an international cuisine, and High satiety all apply.
    const tags = exploreCardTags(
      dish({
        tags: ["HP", "complete_meal"],
        category: "Complete meal",
        cuisine: "Italian",
        satiety: "High",
      }),
    );
    const descriptors = tags.filter((t) => t.kind === "neutral" && !t.label.endsWith(" min"));
    expect(descriptors).toHaveLength(1);
  });

  it("lets HP win over the cuisine field when both apply", () => {
    const labels = exploreCardTags(dish({ tags: ["HP"], cuisine: "Italian" })).map((t) => t.label);
    expect(labels).toContain("High protein");
    expect(labels).not.toContain("Italian");
  });
});

describe("exploreCardTags — empty tags degrade gracefully", () => {
  it("gets difficulty + prep, no raw code, no empty label", () => {
    const tags = exploreCardTags(dish({ tags: [], satiety: "Low", prepMinutes: 15 }));
    const labels = tags.map((t) => t.label);
    expect(labels).toEqual(["Easy", "15 min"]);
    expect(labels.every((l) => l.length > 0)).toBe(true);
  });

  it("adds Filling when satiety is High and tags are empty", () => {
    const labels = exploreCardTags(dish({ tags: [], satiety: "High", prepMinutes: 0 })).map(
      (t) => t.label,
    );
    expect(labels).toEqual(["Easy", "Filling"]);
  });
});

describe("complexityShortLabel", () => {
  it("returns Easy / Medium / Hard", () => {
    expect(complexityShortLabel("Easy")).toBe("Easy");
    expect(complexityShortLabel("Medium")).toBe("Medium");
    expect(complexityShortLabel("Hard")).toBe("Hard");
  });

  it("returns a safe default for undefined", () => {
    expect(complexityShortLabel(undefined)).toBe("Easy");
  });
});

describe("addablePool — generic across meal-time, non-fruit, addableMeals-gated", () => {
  // addablePool reads the live baked library (not an injected fixture), so these
  // tests assert structural invariants over the real pool rather than exact
  // counts (counts move as the library grows; the invariants do not). A fixed
  // in-season date keeps the season filter from varying with the wall clock; the
  // library's staples are `seasons: "All"`, so they survive any week.
  const WEEK = "2026-06-15"; // Monsoon in Bangalore; "All"-season dishes always in.

  it("is generic: a both-meals pool contains BOTH breakfast and lunch dishes", () => {
    const pool = addablePool(WEEK, ["breakfast", "lunch"]);
    expect(pool.some((d) => d.time === "Breakfast")).toBe(true);
    expect(pool.some((d) => d.time === "Lunch")).toBe(true);
  });

  it("excludes the Fruit category from a meal pool", () => {
    const pool = addablePool(WEEK, ["breakfast", "lunch"]);
    expect(pool.some((d) => d.category === "Fruit")).toBe(false);
  });

  it("only ever surfaces Active dishes", () => {
    const pool = addablePool(WEEK, ["breakfast", "lunch"]);
    expect(pool.every((d) => d.active === "Yes")).toBe(true);
  });

  it("stays name-sorted", () => {
    const pool = addablePool(WEEK, ["breakfast", "lunch"]);
    const names = pool.map((d) => d.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it("respects addableMeals: a lunch-only day excludes every breakfast dish", () => {
    // Saturday is lunch-only (decision 4): a breakfast dish has no slot to route
    // to, so it must not appear. Assert the gating invariant structurally rather
    // than against a hard-coded dish id (a single dish's meal-time can flip; the
    // invariant does not): the lunch-only pool is non-empty AND every dish in it
    // is a lunch dish (i.e. no breakfast dish survives the gate).
    const lunchOnly = addablePool(WEEK, ["lunch"]);
    expect(lunchOnly.length).toBeGreaterThan(0);
    expect(lunchOnly.some((d) => d.time === "Lunch")).toBe(true);
    expect(lunchOnly.every((d) => d.time === "Lunch")).toBe(true);
    expect(lunchOnly.some((d) => d.time === "Breakfast")).toBe(false);
  });

  it("respects addableMeals: a breakfast-only set excludes every lunch dish", () => {
    // Symmetric to the lunch-only case: the breakfast-only pool is non-empty AND
    // every dish in it is a breakfast dish, so no lunch dish leaks through the
    // gate. Property-based, so a single dish's meal-time flip cannot rot it.
    const breakfastOnly = addablePool(WEEK, ["breakfast"]);
    expect(breakfastOnly.length).toBeGreaterThan(0);
    expect(breakfastOnly.some((d) => d.time === "Breakfast")).toBe(true);
    expect(breakfastOnly.every((d) => d.time === "Breakfast")).toBe(true);
    expect(breakfastOnly.some((d) => d.time === "Lunch")).toBe(false);
  });

  it("an empty addableMeals set yields an empty pool", () => {
    expect(addablePool(WEEK, [])).toEqual([]);
  });
});

describe("swapPickerVisible — search and filters reach the full pool, suggestions stay short", () => {
  // The ranked pool comes from getSlotAlternatives in recency order. Roti is the
  // recently-cooked staple that ranks LAST, the exact case from the bug report:
  // it falls outside any short suggestion cap, so a name search (even with a
  // filter active) must still find it. Roti is also "Easy" so it survives the
  // "Easy to cook" chip; the harder dishes earlier in the pool do not.
  // The "Healthy" chip now reads the engine-derived flag (engine.md §11), keyed
  // on dish id against the baked live library, not a tag. So the dish that must
  // satisfy "Healthy" uses a real healthy library id (9, "Mushroom matar"); the
  // others use ids the engine does not flag healthy. Names are still arbitrary
  // (the substring search tests key on the fixture name, not the library name).
  const pool: Dish[] = [
    dish({ id: 10, name: "Rajma", complexity: "Hard" }),
    dish({ id: 11, name: "Chole", complexity: "Medium" }),
    dish({ id: 12, name: "Bhindi", complexity: "Easy" }),
    dish({ id: 9, name: "Aloo Gobi", complexity: "Easy" }),
    dish({ id: 103, name: "Roti", complexity: "Easy" }),
  ];

  it("with no query and no filter, shows only the top `suggestedCap` ranked dishes", () => {
    const visible = swapPickerVisible(pool, "", [], 3);
    expect(visible.map((d) => d.id)).toEqual([10, 11, 12]);
  });

  it("never truncates the default view when the pool is shorter than the cap", () => {
    const visible = swapPickerVisible(pool, "", [], 60);
    expect(visible).toHaveLength(pool.length);
  });

  it("with a query, searches the WHOLE pool, not just the suggested head", () => {
    // "roti" ranks last and would be cut by any short cap; search must find it.
    const visible = swapPickerVisible(pool, "roti", [], 3);
    expect(visible.map((d) => d.id)).toEqual([103]);
  });

  it("matches case-insensitively on a name substring", () => {
    expect(swapPickerVisible(pool, "ROT", [], 3).map((d) => d.id)).toEqual([103]);
    expect(swapPickerVisible(pool, "OO", [], 3).map((d) => d.name)).toEqual(["Aloo Gobi"]);
  });

  it("ignores surrounding whitespace in the query", () => {
    expect(swapPickerVisible(pool, "  roti  ", [], 3).map((d) => d.id)).toEqual([103]);
  });

  it("returns an empty list when nothing matches the query", () => {
    expect(swapPickerVisible(pool, "zzz", [], 3)).toEqual([]);
  });

  it("an active filter narrows the WHOLE pool, not just the suggested head", () => {
    // "Easy to cook" must reach the easy dishes throughout the ranked pool
    // (Bhindi, Aloo Gobi, AND Roti at the bottom), not stop at the top cap.
    const visible = swapPickerVisible(pool, "", ["Easy to cook"], 1);
    expect(visible.map((d) => d.id)).toEqual([12, 9, 103]);
  });

  it("finds a bottom-ranked staple by name even with a filter active", () => {
    // The exact latent blind spot: a recently-cooked staple (Roti) that ranks
    // last is still reachable by name with "Easy to cook" selected.
    const visible = swapPickerVisible(pool, "roti", ["Easy to cook"], 1);
    expect(visible.map((d) => d.id)).toEqual([103]);
  });

  it("ANDs the query and the filters together", () => {
    // Roti is Easy, so it survives the chip; Rajma is Hard, so the chip drops it
    // even though its name matches the query.
    expect(swapPickerVisible(pool, "ra", ["Easy to cook"], 12)).toEqual([]);
    expect(swapPickerVisible(pool, "ra", [], 12).map((d) => d.id)).toEqual([10]);
  });

  it("ANDs multiple filters (Healthy + Easy)", () => {
    // Only id 9 is both Easy (fixture) and engine-derived Healthy (live library).
    const visible = swapPickerVisible(pool, "", ["Easy to cook", "Healthy"], 12);
    expect(visible.map((d) => d.id)).toEqual([9]);
  });

  it("supports the meal-time pills (the pool is now generic across meal-time)", () => {
    // The breakfast/lunch picker pool mixes meal-times, so a meal pill is a real
    // filter. A "Lunch" pill keeps lunch dishes; a "Breakfast" pill keeps only
    // the lone breakfast dish. (Roti id 103 is breakfast in the live library.)
    const mixed: Dish[] = [
      dish({ id: 10, name: "Rajma", time: "Lunch" }),
      dish({ id: 103, name: "Roti", time: "Breakfast" }),
    ];
    expect(swapPickerVisible(mixed, "", ["Lunch"], 12).map((d) => d.id)).toEqual([10]);
    expect(swapPickerVisible(mixed, "", ["Breakfast"], 12).map((d) => d.id)).toEqual([103]);
    // Both meal pills selected is an OR within the dimension: everything passes.
    expect(swapPickerVisible(mixed, "", ["Breakfast", "Lunch"], 12).map((d) => d.id)).toEqual([
      10, 103,
    ]);
  });

  it("applies the suggested cap only when BOTH query and filters are empty", () => {
    // A query alone returns all matches (no cap)...
    expect(swapPickerVisible(pool, "a", [], 1).length).toBeGreaterThan(1);
    // ...a filter alone returns all matches (no cap)...
    expect(swapPickerVisible(pool, "", ["Easy to cook"], 1).length).toBeGreaterThan(1);
    // ...only the empty/empty default view is capped.
    expect(swapPickerVisible(pool, "", [], 1)).toHaveLength(1);
  });
});
