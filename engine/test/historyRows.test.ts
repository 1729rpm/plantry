import { describe, it, expect } from "vitest";
import { deriveHistoryRows } from "../src/historyRows.js";
import type { GeneratedWeek } from "../src/generateWeek.js";
import type { Dish } from "../src/data/schemas.js";

/**
 * docs/engine.md §6 Skipped days, finalize half. `deriveHistoryRows` derives the
 * menu-history append from a generated week and is skip-aware: a skipped day
 * keeps its dishes in the week but contributes zero history rows.
 *
 * The §3.3 Fruit of the day lives on `day.fruit` (outside `slots`); it is logged
 * as its own `meal:"Fruit"` row, after that day's slot rows, so the cross-week
 * fruit rotation selector sees fruit recency.
 */

let nextId = 1;
function makeDish(name: string): Dish {
  return {
    id: nextId++,
    name,
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
  };
}

function makeFruit(name: string): Dish {
  return { ...makeDish(name), category: "Fruit", tags: ["fruit"], primaryIngredient: name };
}

function makeWeek(): GeneratedWeek {
  nextId = 1;
  const monB = makeDish("Poha");
  const monL = makeDish("Dal");
  const monFruit = makeFruit("Apple");
  const friL = makeDish("Rajma");
  const friFruit = makeFruit("Banana");
  return {
    weekStart: "2026-06-15",
    days: [
      {
        day: "Mon",
        slots: [
          { day: "Mon", meal: "Breakfast", dishes: [monB] },
          { day: "Mon", meal: "Lunch", dishes: [monL] },
        ],
        fruit: monFruit,
      },
      {
        day: "Fri",
        slots: [{ day: "Fri", meal: "Lunch", dishes: [friL] }],
        fruit: friFruit,
      },
    ],
    droppedDishIds: [],
    incidents: [],
  };
}

describe("§6 deriveHistoryRows", () => {
  it("derives one row per picked dish plus a Fruit row per day, after that day's slot rows", () => {
    const rows = deriveHistoryRows({ week: makeWeek() });
    expect(rows).toEqual([
      { weekStart: "2026-06-15", day: "Monday", meal: "Breakfast", dishName: "Poha", dishId: 1 },
      { weekStart: "2026-06-15", day: "Monday", meal: "Lunch", dishName: "Dal", dishId: 2 },
      { weekStart: "2026-06-15", day: "Monday", meal: "Fruit", dishName: "Apple", dishId: 3 },
      { weekStart: "2026-06-15", day: "Friday", meal: "Lunch", dishName: "Rajma", dishId: 4 },
      { weekStart: "2026-06-15", day: "Friday", meal: "Fruit", dishName: "Banana", dishId: 5 },
    ]);
  });

  it("emits no Fruit row when a day has no day.fruit", () => {
    const week = makeWeek();
    delete week.days[0].fruit;
    const rows = deriveHistoryRows({ week });
    // Monday now contributes only its two slot rows; Friday's fruit remains.
    expect(rows.filter((r) => r.meal === "Fruit").map((r) => r.dishName)).toEqual(["Banana"]);
  });

  it("defaults to no days skipped (existing callers unchanged)", () => {
    const withDefault = deriveHistoryRows({ week: makeWeek() });
    const withEmpty = deriveHistoryRows({ week: makeWeek(), skippedDays: [] });
    expect(withDefault).toEqual(withEmpty);
  });

  it("excludes a skipped day's rows including its fruit; the dishes stay in the week", () => {
    const week = makeWeek();
    const rows = deriveHistoryRows({ week, skippedDays: ["Fri"] });
    // Fri (Rajma + Banana) is gone from history; Mon's three rows remain.
    expect(rows.map((r) => r.dishName)).toEqual(["Poha", "Dal", "Apple"]);
    // A skipped day contributes no Fruit row.
    expect(rows.some((r) => r.meal === "Fruit" && r.dishName === "Banana")).toBe(false);
    // The week itself is untouched (restore is lossless): Fri still present.
    expect(week.days.some((d) => d.day === "Fri")).toBe(true);
  });

  it("a fully skipped week derives zero rows", () => {
    const rows = deriveHistoryRows({ week: makeWeek(), skippedDays: ["Mon", "Fri"] });
    expect(rows).toEqual([]);
  });
});
