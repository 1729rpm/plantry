import { describe, it, expect } from "vitest";
import { deriveHistoryRows, lastCookedMap } from "../src/historyRows.js";
import type { GeneratedWeek } from "../src/generateWeek.js";
import type { Dish, MenuHistoryRow } from "../src/data/schemas.js";

/**
 * docs/engine.md §6 Skipped days, finalize half. `deriveHistoryRows` derives the
 * menu-history append from a generated week and is skip-aware: a skipped day
 * keeps its dishes in the week but contributes zero history rows.
 *
 * A generated day holds breakfast and lunch slots and nothing else (§3.3 is
 * retired), so every derived row is Breakfast or Lunch. Legacy `meal:"Fruit"`
 * rows are still in the stored record and must still READ cleanly; the last
 * describe block asserts that.
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

function makeWeek(): GeneratedWeek {
  nextId = 1;
  const monB = makeDish("Poha");
  const monL = makeDish("Dal");
  const friL = makeDish("Rajma");
  return {
    weekStart: "2026-06-15",
    days: [
      {
        day: "Mon",
        slots: [
          { day: "Mon", meal: "Breakfast", dishes: [monB] },
          { day: "Mon", meal: "Lunch", dishes: [monL] },
        ],
      },
      {
        day: "Fri",
        slots: [{ day: "Fri", meal: "Lunch", dishes: [friL] }],
      },
    ],
    incidents: [],
    unplacedFavorites: [],
  };
}

describe("§6 deriveHistoryRows", () => {
  it("derives one row per picked dish, in slot order", () => {
    const rows = deriveHistoryRows({ week: makeWeek() });
    expect(rows).toEqual([
      { weekStart: "2026-06-15", day: "Monday", meal: "Breakfast", dishName: "Poha", dishId: 1 },
      { weekStart: "2026-06-15", day: "Monday", meal: "Lunch", dishName: "Dal", dishId: 2 },
      { weekStart: "2026-06-15", day: "Friday", meal: "Lunch", dishName: "Rajma", dishId: 3 },
    ]);
  });

  it("derives only Breakfast and Lunch rows: §3.3 is retired, so no Fruit row is ever written", () => {
    const rows = deriveHistoryRows({ week: makeWeek() });
    expect(rows.every((r) => r.meal === "Breakfast" || r.meal === "Lunch")).toBe(true);
  });

  it("defaults to no days skipped (existing callers unchanged)", () => {
    const withDefault = deriveHistoryRows({ week: makeWeek() });
    const withEmpty = deriveHistoryRows({ week: makeWeek(), skippedDays: [] });
    expect(withDefault).toEqual(withEmpty);
  });

  it("excludes a skipped day's rows; the dishes stay in the week", () => {
    const week = makeWeek();
    const rows = deriveHistoryRows({ week, skippedDays: ["Fri"] });
    // Fri (Rajma) is gone from history; Mon's two rows remain.
    expect(rows.map((r) => r.dishName)).toEqual(["Poha", "Dal"]);
    // The week itself is untouched (restore is lossless): Fri still present.
    expect(week.days.some((d) => d.day === "Fri")).toBe(true);
  });

  it("a fully skipped week derives zero rows", () => {
    const rows = deriveHistoryRows({ week: makeWeek(), skippedDays: ["Mon", "Fri"] });
    expect(rows).toEqual([]);
  });
});

describe('legacy meal:"Fruit" rows still read (features/engine-v4.md §14.3)', () => {
  // The retired Fruit of the day wrote its own `meal:"Fruit"` history rows, and
  // they are still in data/menu_history.md and in the weekArchive table. The
  // archive is the eaten record and the only training signal §4 has, so it is
  // never rewritten; every reader must keep tolerating those rows.
  const legacyHistory: MenuHistoryRow[] = [
    { weekStart: "2026-06-08", day: "Monday", meal: "Breakfast", dishName: "Poha", dishId: 1 },
    { weekStart: "2026-06-08", day: "Monday", meal: "Fruit", dishName: "Banana bowl", dishId: 154 },
    {
      weekStart: "2026-06-15",
      day: "Tuesday",
      meal: "Fruit",
      dishName: "Banana bowl",
      dishId: 154,
    },
    { weekStart: "2026-06-15", day: "Friday", meal: "Lunch", dishName: "Rajma", dishId: 2 },
  ];

  it("lastCookedMap reads a Fruit row like any other, keeping the most recent weekStart", () => {
    const map = lastCookedMap(legacyHistory);
    expect(map.get(154)).toBe("2026-06-15");
    expect(map.get(1)).toBe("2026-06-08");
    expect(map.get(2)).toBe("2026-06-15");
  });

  it("a week generated alongside legacy Fruit rows still derives no Fruit row", () => {
    const rows = deriveHistoryRows({ week: makeWeek() });
    expect(rows.some((r) => r.meal === "Fruit")).toBe(false);
  });
});
