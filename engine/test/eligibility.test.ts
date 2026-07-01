import { describe, it, expect } from "vitest";
import { eligibleDishes } from "../src/eligibility.js";
import type { Dish, MenuHistoryRow, Season, SeasonsField } from "../src/data/schemas.js";

let nextId = 1;

function makeDish(overrides: Partial<Dish> = {}): Dish {
  return {
    id: nextId++,
    name: `Dish ${nextId}`,
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

const emptyHistory: MenuHistoryRow[] = [];
const monLunch = { day: "Mon", meal: "Lunch" } as const;

describe("eligibleDishes — docs/engine.md §1", () => {
  describe("Active=Yes filter", () => {
    it("includes dishes with active=Yes", () => {
      const dish = makeDish({ active: "Yes" });
      const result = eligibleDishes({
        library: [dish],
        history: emptyHistory,
        season: "Summer",
        slot: monLunch,
      });
      expect(result).toEqual([dish]);
    });

    it("excludes dishes with active=No", () => {
      const inactive = makeDish({ active: "No" });
      const result = eligibleDishes({
        library: [inactive],
        history: emptyHistory,
        season: "Summer",
        slot: monLunch,
      });
      expect(result).toEqual([]);
    });

    it("returns only the active subset from a mixed library", () => {
      const active = makeDish({ active: "Yes", name: "active" });
      const inactive = makeDish({ active: "No", name: "inactive" });
      const result = eligibleDishes({
        library: [active, inactive],
        history: emptyHistory,
        season: "Summer",
        slot: monLunch,
      });
      expect(result).toEqual([active]);
    });
  });

  describe("Seasons match (Bangalore seasons)", () => {
    it("includes Seasons=All dishes in every season", () => {
      const evergreen = makeDish({ seasons: "All" });
      for (const season of ["Summer", "Monsoon", "Winter"] as Season[]) {
        const result = eligibleDishes({
          library: [evergreen],
          history: emptyHistory,
          season,
          slot: monLunch,
        });
        expect(result).toEqual([evergreen]);
      }
    });

    it("includes a season-listed dish when the current season is in its list", () => {
      const summerDish = makeDish({ seasons: ["Summer"] });
      const result = eligibleDishes({
        library: [summerDish],
        history: emptyHistory,
        season: "Summer",
        slot: monLunch,
      });
      expect(result).toEqual([summerDish]);
    });

    it("excludes a dish whose Seasons list does not include the current season", () => {
      const winterOnly = makeDish({ seasons: ["Winter"] });
      const result = eligibleDishes({
        library: [winterOnly],
        history: emptyHistory,
        season: "Summer",
        slot: monLunch,
      });
      expect(result).toEqual([]);
    });

    it("includes a dish whose Seasons list contains the current season among others", () => {
      const monsoonWinter = makeDish({ seasons: ["Monsoon", "Winter"] });
      const result = eligibleDishes({
        library: [monsoonWinter],
        history: emptyHistory,
        season: "Winter",
        slot: monLunch,
      });
      expect(result).toEqual([monsoonWinter]);
    });
  });

  describe("Both pillars combined", () => {
    it("excludes a dish that is in-season but inactive", () => {
      const inactiveInSeason = makeDish({
        active: "No",
        seasons: ["Summer"],
      });
      const result = eligibleDishes({
        library: [inactiveInSeason],
        history: emptyHistory,
        season: "Summer",
        slot: monLunch,
      });
      expect(result).toEqual([]);
    });

    it("excludes a dish that is active but out of season", () => {
      const activeWinter = makeDish({ active: "Yes", seasons: ["Winter"] });
      const result = eligibleDishes({
        library: [activeWinter],
        history: emptyHistory,
        season: "Summer",
        slot: monLunch,
      });
      expect(result).toEqual([]);
    });

    it("includes a dish that is both active and in season", () => {
      const ok = makeDish({ active: "Yes", seasons: ["Summer", "Monsoon"] });
      const result = eligibleDishes({
        library: [ok],
        history: emptyHistory,
        season: "Monsoon",
        slot: monLunch,
      });
      expect(result).toEqual([ok]);
    });
  });

  describe("Result properties", () => {
    it("preserves the library order of eligible dishes", () => {
      const a = makeDish({ name: "a" });
      const b = makeDish({ name: "b", active: "No" });
      const c = makeDish({ name: "c" });
      const d = makeDish({ name: "d", seasons: ["Winter"] });
      const e = makeDish({ name: "e" });
      const result = eligibleDishes({
        library: [a, b, c, d, e],
        history: emptyHistory,
        season: "Summer",
        slot: monLunch,
      });
      expect(result).toEqual([a, c, e]);
    });

    it("returns an empty array when the library is empty", () => {
      const result = eligibleDishes({
        library: [],
        history: emptyHistory,
        season: "Summer",
        slot: monLunch,
      });
      expect(result).toEqual([]);
    });

    it("returns a subset of the library (no synthesised dishes)", () => {
      const dishes: Dish[] = [
        makeDish(),
        makeDish({ active: "No" }),
        makeDish({ seasons: ["Winter"] }),
        makeDish({ seasons: ["Summer", "Monsoon"] }),
      ];
      const result = eligibleDishes({
        library: dishes,
        history: emptyHistory,
        season: "Summer",
        slot: monLunch,
      });
      for (const dish of result) {
        expect(dishes).toContain(dish);
      }
    });

    it("is a pure filter: every result satisfies both §1 predicates for the given season", () => {
      const seasonLists: SeasonsField[] = [
        "All",
        ["Summer"],
        ["Monsoon"],
        ["Winter"],
        ["Summer", "Monsoon"],
        ["Monsoon", "Winter"],
        ["Summer", "Winter"],
      ];
      const dishes: Dish[] = [];
      for (const seasons of seasonLists) {
        dishes.push(makeDish({ seasons, active: "Yes" }));
        dishes.push(makeDish({ seasons, active: "No" }));
      }
      for (const season of ["Summer", "Monsoon", "Winter"] as Season[]) {
        const result = eligibleDishes({
          library: dishes,
          history: emptyHistory,
          season,
          slot: monLunch,
        });
        for (const dish of result) {
          expect(dish.active).toBe("Yes");
          const seasonOk = dish.seasons === "All" || dish.seasons.includes(season);
          expect(seasonOk).toBe(true);
        }
      }
    });
  });
});
