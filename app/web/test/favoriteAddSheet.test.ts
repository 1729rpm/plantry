import { describe, expect, it } from "vitest";
import { allDishes } from "../src/lib/library.js";
import { computeSelected, favoriteAddResults } from "../src/components/FavoriteAddSheet.js";

// The add-a-favorite sheet's pure logic: which rows read as selected (the live
// favorite set plus an optimistic overlay) and the search corpus (the whole
// library, so every dish is reachable).

describe("computeSelected", () => {
  const favorites = new Set<number>([10, 20]);

  it("reflects the live favorite set when no toggle is in flight", () => {
    const optimistic = new Map<number, boolean>();
    expect(computeSelected(10, favorites, optimistic)).toBe(true);
    expect(computeSelected(30, favorites, optimistic)).toBe(false);
  });

  it("lets an optimistic add win over a not-yet-favorite dish", () => {
    const optimistic = new Map<number, boolean>([[30, true]]);
    expect(computeSelected(30, favorites, optimistic)).toBe(true);
  });

  it("lets an optimistic remove win over a live favorite", () => {
    const optimistic = new Map<number, boolean>([[10, false]]);
    expect(computeSelected(10, favorites, optimistic)).toBe(false);
  });
});

describe("favoriteAddResults", () => {
  it("returns the whole library for an empty query, so every dish is reachable", () => {
    expect(favoriteAddResults(allDishes, "").length).toBe(allDishes.length);
    expect(favoriteAddResults(allDishes, "   ").length).toBe(allDishes.length);
  });

  it("sorts results by name ascending", () => {
    const names = favoriteAddResults(allDishes, "").map((d) => d.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sorted);
  });

  it("narrows to dishes whose name matches every query token", () => {
    const target = allDishes[0];
    const token = target.name.split(/\s+/)[0];
    const results = favoriteAddResults(allDishes, token);
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((d) => d.name.toLowerCase().includes(token.toLowerCase()))).toBe(true);
  });

  it("reaches an inactive dish when one exists (favorites ignore active/season)", () => {
    const inactive = allDishes.find((d) => d.active !== "Yes");
    if (!inactive) return; // library may be all-active; skip without failing
    const results = favoriteAddResults(allDishes, inactive.name);
    expect(results.some((d) => d.id === inactive.id)).toBe(true);
  });
});
