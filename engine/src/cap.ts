import type { Dish } from "./data/schemas.js";

/**
 * docs/engine.md §9, the whole-day budget.
 *
 * This module used to hold a post-hoc item cap (5 items per weekday, 3 on
 * Saturday) that trimmed a composed day back into range, dropping picks in a
 * role-aware order. That is retired (`features/engine-v4.md` §10.1): the cap
 * premise was false, because a menu that has already been composed is the wrong
 * place to discover it is too much work. The day is now composed TO a budget and
 * nothing is ever dropped, so this module supplies the budget primitives the
 * composition path spends rather than a trimmer the composition path feeds.
 *
 * The file keeps its name because docs/engine.md §13 pairs §9 with `cap.ts`.
 */

/**
 * §9 whole-day prep budget: the summed `prepMinutes` of a day's breakfast and
 * lunch items. The Fruit of the day (§3.3) is outside it, exactly as it was
 * outside the retired item cap.
 *
 * 120 minutes is the household's busiest observed day, so the budget sits AT the
 * envelope of what they have actually cooked rather than above it. This is the
 * binding constraint: at observed prep times a five- or six-item day runs out of
 * minutes before it runs out of item slots.
 */
export const DAY_PREP_BUDGET_MINUTES = 120;

/**
 * §9 item backstop: the most breakfast + lunch items a day may carry, fruit
 * excluded. Six, against a largest observed day of five, so it keeps one item of
 * headroom and is a backstop rather than the thing that sizes the plate. Uniform
 * across the week: the old 3-item Saturday cap is retired, so Saturday can carry
 * a proper weekend lunch.
 */
export const DAY_MAX_ITEMS = 6;

/** A day's spend so far. Breakfast composes first, then the same day's lunch. */
export interface DayBudget {
  /** Summed `prepMinutes` of the day's breakfast and lunch items placed so far. */
  minutesUsed: number;
  /** Count of breakfast and lunch items placed so far. Fruit is not counted. */
  itemsUsed: number;
}

/** A day with nothing placed yet. */
export function emptyDayBudget(): DayBudget {
  return { minutesUsed: 0, itemsUsed: 0 };
}

/**
 * Would placing `dish` keep the day inside both limits? The two limits are
 * checked together because §10.1 states them together: a candidate that would
 * breach EITHER is skipped for the next candidate that fits.
 */
export function fitsDayBudget(budget: DayBudget, dish: Dish): boolean {
  return (
    budget.itemsUsed + 1 <= DAY_MAX_ITEMS &&
    budget.minutesUsed + dish.prepMinutes <= DAY_PREP_BUDGET_MINUTES
  );
}

/** The budget after placing `dish`. Pure: returns a new value. */
export function spendDayBudget(budget: DayBudget, dish: Dish): DayBudget {
  return {
    minutesUsed: budget.minutesUsed + dish.prepMinutes,
    itemsUsed: budget.itemsUsed + 1,
  };
}

/** Item slots still available on the day, never negative. */
export function dayBudgetItemsLeft(budget: DayBudget): number {
  return Math.max(DAY_MAX_ITEMS - budget.itemsUsed, 0);
}
