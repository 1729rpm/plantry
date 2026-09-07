import { describe, it, expect } from "vitest";
import {
  breakfastMainCarriesChutney,
  excludeHpIfMealHasHp,
  isCuisineNeutral,
  isHp,
  isSelfSufficientMain,
} from "../src/composition.js";
import type { Dish } from "../src/data/schemas.js";

/**
 * The §3 composition predicates that survive into v6 (`features/engine-v6.md`
 * §12). The menu-form candidate sets these used to sit beside belonged to the v3
 * selection engine and are gone; v6 builds its plates from role pools, whose own
 * tests live under `engine/test/v6/`.
 *
 * Every case asserts the predicate keys on a tag or a category, never on a dish
 * name, so the rule holds for any dish the library later gains.
 */

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

describe("composition predicates — docs/engine.md §3, carried into v6 §12", () => {
  describe("§3 R1 self-sufficient main signal", () => {
    it("isSelfSufficientMain is the union of complete_meal-tag and Category=Complete meal", () => {
      const tagged = makeDish({ category: "Gravy dish", tags: ["complete_meal"] });
      const categoried = makeDish({ category: "Complete meal", tags: [] });
      const both = makeDish({ category: "Complete meal", tags: ["complete_meal"] });
      const neither = makeDish({ category: "Gravy dish", tags: [] });
      expect(isSelfSufficientMain(tagged)).toBe(true);
      // White-sauce-pasta case: Category=Complete meal but NOT complete_meal-tagged.
      expect(isSelfSufficientMain(categoried)).toBe(true);
      expect(isSelfSufficientMain(both)).toBe(true);
      expect(isSelfSufficientMain(neither)).toBe(false);
    });
  });

  describe("§3 dish-driven breakfast chutney signal", () => {
    it("breakfastMainCarriesChutney is true only for a Chilla or Paratha main", () => {
      // Keyed on category, not on the complete_carb tag, so it fires wherever the
      // main lands. Bread (served alone) and Complete meal mains carry no chutney.
      expect(breakfastMainCarriesChutney(makeDish({ category: "Chilla" }))).toBe(true);
      expect(breakfastMainCarriesChutney(makeDish({ category: "Paratha" }))).toBe(true);
      expect(breakfastMainCarriesChutney(makeDish({ category: "Bread" }))).toBe(false);
      expect(breakfastMainCarriesChutney(makeDish({ category: "Complete meal" }))).toBe(false);
    });
  });

  describe("§3 cuisine-register signal", () => {
    it("isCuisineNeutral keys on the tag, not on the cuisine field", () => {
      expect(isCuisineNeutral(makeDish({ tags: ["cuisine_neutral"] }))).toBe(true);
      expect(isCuisineNeutral(makeDish({ tags: ["HP"] }))).toBe(false);
      expect(isCuisineNeutral(makeDish({ cuisine: "Thai", tags: [] }))).toBe(false);
    });
  });

  describe("§3 one-HP-per-meal filter", () => {
    it("isHp keys on the HP tag, not on names", () => {
      expect(isHp(makeDish({ tags: ["HP"] }))).toBe(true);
      expect(isHp(makeDish({ tags: [] }))).toBe(false);
      expect(isHp(makeDish({ tags: ["complete_meal"] }))).toBe(false);
    });

    it("is a no-op when the meal does not yet hold an HP dish", () => {
      const hp = makeDish({ tags: ["HP"], category: "Accompaniment" });
      const plain = makeDish({ category: "Accompaniment" });
      expect(excludeHpIfMealHasHp([hp, plain], false)).toEqual([hp, plain]);
    });

    it("drops HP-tagged dishes once the meal holds an HP dish", () => {
      const hp = makeDish({
        tags: ["HP"],
        category: "Accompaniment",
        primaryIngredient: "Chicken",
      });
      const plain = makeDish({ category: "Accompaniment" });
      expect(excludeHpIfMealHasHp([hp, plain], true)).toEqual([plain]);
    });

    it("is property-based: a paneer HP side is dropped exactly as a chicken one", () => {
      const hpPaneer = makeDish({
        tags: ["HP"],
        category: "Accompaniment",
        primaryIngredient: "Paneer",
      });
      const plain = makeDish({ category: "Accompaniment" });
      const out = excludeHpIfMealHasHp([hpPaneer, plain], true);
      expect(out).toEqual([plain]);
      expect(out.some((d) => d.tags.includes("HP"))).toBe(false);
    });

    it("thin-pool fallback: returns the unfiltered pool when every candidate is HP", () => {
      const hpA = makeDish({ tags: ["HP"], category: "Accompaniment" });
      const hpB = makeDish({ tags: ["HP"], category: "Accompaniment" });
      // No non-HP candidate exists, so the slot still fills (a second HP side
      // beats an incomplete meal). Documented fallback.
      expect(excludeHpIfMealHasHp([hpA, hpB], true)).toEqual([hpA, hpB]);
    });
  });
});
