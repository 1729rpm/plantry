import { describe, it, expect } from "vitest";
import {
  DAY_MAX_ITEMS,
  DAY_PREP_BUDGET_MINUTES,
  dayBudgetItemsLeft,
  emptyDayBudget,
  fitsDayBudget,
  spendDayBudget,
} from "../src/cap.js";
import type { Dish } from "../src/data/schemas.js";

/**
 * docs/engine.md §9, the whole-day budget (`features/engine-v4.md` §10.1).
 *
 * The post-hoc item cap this module used to hold is retired: a composed day is
 * never trimmed, so there is no drop order left to test. What is tested here is
 * the budget the composition path spends, plus the two numbers themselves, which
 * are the household's observed envelope and are therefore worth pinning.
 */

function dish(overrides: Partial<Dish> & { id: number; prepMinutes: number }): Dish {
  return {
    id: overrides.id,
    name: `Dish ${overrides.id}`,
    category: "Dry dish",
    time: "Lunch",
    tags: [],
    primaryIngredient: "Mixed Veg",
    preferred: "No",
    active: "Yes",
    satiety: "Medium",
    prepMinutes: overrides.prepMinutes,
    seasons: "All",
    cuisine: "Indian",
    ...overrides,
  } as Dish;
}

describe("day budget — docs/engine.md §9", () => {
  describe("the two numbers", () => {
    it("is 120 minutes, the household's busiest observed day", () => {
      expect(DAY_PREP_BUDGET_MINUTES).toBe(120);
    });

    it("is 6 items, one above the household's largest observed day", () => {
      expect(DAY_MAX_ITEMS).toBe(6);
    });
  });

  describe("emptyDayBudget", () => {
    it("starts a day at zero minutes and zero items", () => {
      expect(emptyDayBudget()).toEqual({ minutesUsed: 0, itemsUsed: 0 });
    });

    it("returns a fresh value each call (no shared mutable day state)", () => {
      const a = emptyDayBudget();
      const b = emptyDayBudget();
      expect(a).not.toBe(b);
    });
  });

  describe("fitsDayBudget", () => {
    it("accepts a dish that leaves the day inside both limits", () => {
      expect(fitsDayBudget({ minutesUsed: 60, itemsUsed: 3 }, dish({ id: 1, prepMinutes: 30 }))).toBe(
        true,
      );
    });

    it("accepts a dish that lands exactly on the minute budget", () => {
      expect(fitsDayBudget({ minutesUsed: 90, itemsUsed: 3 }, dish({ id: 1, prepMinutes: 30 }))).toBe(
        true,
      );
    });

    it("rejects a dish that would breach the minute budget by one minute", () => {
      expect(fitsDayBudget({ minutesUsed: 90, itemsUsed: 3 }, dish({ id: 1, prepMinutes: 31 }))).toBe(
        false,
      );
    });

    it("accepts a dish that lands exactly on the item backstop", () => {
      expect(fitsDayBudget({ minutesUsed: 10, itemsUsed: 5 }, dish({ id: 1, prepMinutes: 5 }))).toBe(
        true,
      );
    });

    it("rejects a dish that would breach the item backstop, however quick", () => {
      expect(fitsDayBudget({ minutesUsed: 10, itemsUsed: 6 }, dish({ id: 1, prepMinutes: 0 }))).toBe(
        false,
      );
    });

    it("checks both limits together: either one breaching is a no", () => {
      const budget = { minutesUsed: 115, itemsUsed: 6 };
      expect(fitsDayBudget(budget, dish({ id: 1, prepMinutes: 1 }))).toBe(false);
    });
  });

  describe("spendDayBudget", () => {
    it("adds the dish's prep minutes and one item", () => {
      expect(spendDayBudget({ minutesUsed: 20, itemsUsed: 1 }, dish({ id: 1, prepMinutes: 25 }))).toEqual(
        { minutesUsed: 45, itemsUsed: 2 },
      );
    });

    it("is pure: the input budget is not mutated", () => {
      const before = { minutesUsed: 20, itemsUsed: 1 };
      spendDayBudget(before, dish({ id: 1, prepMinutes: 25 }));
      expect(before).toEqual({ minutesUsed: 20, itemsUsed: 1 });
    });

    it("folds over a day: breakfast then lunch accumulate into one total", () => {
      const day = [10, 5, 30, 25, 20].reduce(
        (budget, prepMinutes, index) => spendDayBudget(budget, dish({ id: index, prepMinutes })),
        emptyDayBudget(),
      );
      expect(day).toEqual({ minutesUsed: 90, itemsUsed: 5 });
    });
  });

  describe("dayBudgetItemsLeft", () => {
    it("reports the slots still available", () => {
      expect(dayBudgetItemsLeft({ minutesUsed: 0, itemsUsed: 2 })).toBe(4);
    });

    it("never goes negative", () => {
      expect(dayBudgetItemsLeft({ minutesUsed: 0, itemsUsed: 9 })).toBe(0);
    });
  });
});
