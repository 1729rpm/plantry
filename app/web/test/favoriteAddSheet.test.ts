import { describe, expect, it } from "vitest";
import { allDishes } from "../src/lib/library.js";
import { favoriteAddResults } from "../src/components/FavoriteAddSheet.js";

// The add-a-favorite sheet's search corpus: the whole library, minus dishes
// already favorited, narrowed by the query. Picking a row (or the custom
// free-text row) saves and closes; the sheet no longer toggles rows.

const none = new Set<number>();

describe("favoriteAddResults", () => {
  it("returns the whole library for an empty query when nothing is favorited", () => {
    expect(favoriteAddResults(allDishes, "", none).length).toBe(allDishes.length);
    expect(favoriteAddResults(allDishes, "   ", none).length).toBe(allDishes.length);
  });

  it("excludes dishes already on the favorites list", () => {
    const taken = new Set<number>([allDishes[0].id, allDishes[1].id]);
    const results = favoriteAddResults(allDishes, "", taken);
    expect(results.length).toBe(allDishes.length - 2);
    expect(results.some((d) => taken.has(d.id))).toBe(false);
  });

  it("sorts results by name ascending", () => {
    const names = favoriteAddResults(allDishes, "", none).map((d) => d.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sorted);
  });

  it("narrows to dishes whose name matches every query token", () => {
    const target = allDishes[0];
    const token = target.name.split(/\s+/)[0];
    const results = favoriteAddResults(allDishes, token, none);
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((d) => d.name.toLowerCase().includes(token.toLowerCase()))).toBe(true);
  });

  it("reaches an inactive dish when one exists (favorites ignore active/season)", () => {
    const inactive = allDishes.find((d) => d.active !== "Yes");
    if (!inactive) return; // library may be all-active; skip without failing
    const results = favoriteAddResults(allDishes, inactive.name, none);
    expect(results.some((d) => d.id === inactive.id)).toBe(true);
  });
});
