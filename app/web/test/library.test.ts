import { describe, expect, it } from "vitest";
import type { Dish } from "@plantry/engine";
import { complexityShortLabel, exploreCardTags, swapPickerVisible } from "../src/lib/library.js";

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

  it("title-cases a cuisine tag like 'italian' to 'Italian'", () => {
    const labels = exploreCardTags(dish({ tags: ["italian"] })).map((t) => t.label);
    expect(labels).toContain("Italian");
  });

  it("maps satiety High to 'Filling'", () => {
    const labels = exploreCardTags(dish({ tags: [], satiety: "High" })).map((t) => t.label);
    expect(labels).toContain("Filling");
  });

  it("shows only ONE descriptor", () => {
    // HP, complete_meal, a cuisine tag, and High satiety all apply at once.
    const tags = exploreCardTags(
      dish({
        tags: ["HP", "complete_meal", "italian"],
        category: "Complete meal",
        satiety: "High",
      }),
    );
    const descriptors = tags.filter((t) => t.kind === "neutral" && !t.label.endsWith(" min"));
    expect(descriptors).toHaveLength(1);
  });

  it("lets HP win over a cuisine tag when both are present", () => {
    const labels = exploreCardTags(dish({ tags: ["italian", "HP"] })).map((t) => t.label);
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

describe("swapPickerVisible — search and filters reach the full pool, suggestions stay short", () => {
  // The ranked pool comes from getSlotAlternatives in recency order. Roti is the
  // recently-cooked staple that ranks LAST, the exact case from the bug report:
  // it falls outside any short suggestion cap, so a name search (even with a
  // filter active) must still find it. Roti is also "Easy" so it survives the
  // "Easy to cook" chip; the harder dishes earlier in the pool do not.
  const pool: Dish[] = [
    dish({ id: 10, name: "Rajma", complexity: "Hard" }),
    dish({ id: 11, name: "Chole", complexity: "Medium" }),
    dish({ id: 12, name: "Bhindi", complexity: "Easy" }),
    dish({ id: 13, name: "Aloo Gobi", complexity: "Easy", tags: ["healthy"] }),
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
    expect(visible.map((d) => d.id)).toEqual([12, 13, 103]);
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
    // Only Aloo Gobi is both Easy and tagged healthy.
    const visible = swapPickerVisible(pool, "", ["Easy to cook", "Healthy"], 12);
    expect(visible.map((d) => d.id)).toEqual([13]);
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
