import { describe, it, expect } from "vitest";
import { buildFrequencyIndex, eatenCount, FREQUENCY_WINDOW_WEEKS } from "../src/frequency.js";
import { buildGuardIndex, buildLastCookedIndex, cookedWithinGuard } from "../src/guard.js";
import { rank } from "../src/rank.js";
import { dialFor, planFavoritesV4 } from "../src/favoritesV4.js";
import { generateWeekV4 } from "../src/generateWeekV4.js";
import { buildPools } from "../src/pool.js";
import { baselineLibrary, dish, row } from "./fixtures.js";
import type { Dish, MenuHistoryRow } from "../../src/data/schemas.js";
import type { Day, Meal } from "../../src/eligibility.js";

/** One test per §3.4 selection step, plus the exploration slot and the fruit ranking. */

const WEEK = "2026-08-17";

function rankArgs(
  pool: Dish[],
  history: MenuHistoryRow[],
  overrides: Partial<Parameters<typeof rank>[0]> = {},
) {
  return {
    pool,
    mode: "frequency" as const,
    frequency: buildFrequencyIndex(history),
    guard: buildGuardIndex(history),
    lastCooked: buildLastCookedIndex(history),
    slotDate: "2026-08-17",
    withinWeekDishIds: new Set<number>(),
    recencyExempt: false,
    ...overrides,
  };
}

describe("§3.4 step 1: favorites pinning and the timesPerWeek dial", () => {
  const slots: { day: Day; meal: Meal }[] = [
    { day: "Mon", meal: "Breakfast" },
    { day: "Mon", meal: "Lunch" },
    { day: "Tue", meal: "Breakfast" },
    { day: "Tue", meal: "Lunch" },
    { day: "Wed", meal: "Breakfast" },
    { day: "Wed", meal: "Lunch" },
    { day: "Thu", meal: "Breakfast" },
    { day: "Thu", meal: "Lunch" },
    { day: "Fri", meal: "Breakfast" },
    { day: "Fri", meal: "Lunch" },
    { day: "Sat", meal: "Lunch" },
  ];

  it("caps the dial at 2 and reads an absent dial as 1", () => {
    expect(dialFor({ dishId: 1 })).toBe(1);
    expect(dialFor({ dishId: 1, timesPerWeek: 2 })).toBe(2);
    expect(dialFor({ dishId: 1, timesPerWeek: 9 })).toBe(2);
  });

  it("pins each favorite into one slot per week, spread across distinct days", () => {
    const library = baselineLibrary();
    const pools = buildPools(library, "Monsoon");
    const { pins, unplaced } = planFavoritesV4({
      favorites: [{ dishId: 10 }, { dishId: 11 }],
      slots,
      library,
      pools,
    });
    expect(unplaced).toHaveLength(0);
    expect(pins).toHaveLength(2);
    expect(new Set(pins.map((p) => p.day)).size).toBe(2);
  });

  it("a dial of 2 enters the favorite twice and yields two placements when slots allow", () => {
    const library = baselineLibrary();
    const pools = buildPools(library, "Monsoon");
    const { pins } = planFavoritesV4({
      favorites: [{ dishId: 10, timesPerWeek: 2 }],
      slots,
      library,
      pools,
    });
    expect(pins.filter((p) => p.dishId === 10)).toHaveLength(2);
  });

  it("all dials at 1 is identical to plain pinning", () => {
    const library = baselineLibrary();
    const pools = buildPools(library, "Monsoon");
    const favs = [{ dishId: 10 }, { dishId: 22 }];
    const a = planFavoritesV4({ favorites: favs, slots, library, pools });
    const b = planFavoritesV4({
      favorites: favs.map((f) => ({ ...f, timesPerWeek: 1 })),
      slots,
      library,
      pools,
    });
    expect(a).toEqual(b);
  });

  it("a shortfall reports through the unplaced path rather than forcing a placement", () => {
    const library = baselineLibrary();
    const pools = buildPools(library, "Monsoon");
    const { pins, unplaced } = planFavoritesV4({
      favorites: [{ dishId: 9999 }],
      slots,
      library,
      pools,
    });
    expect(pins).toHaveLength(0);
    expect(unplaced[0].dishId).toBe(9999);
  });

  it("a pinned favorite leads its position regardless of the guard and the frequency order", () => {
    const pool = [dish({ id: 1, name: "A" }), dish({ id: 2, name: "B" })];
    const history = [row("2026-08-10", "Monday", "Lunch", pool[0])];
    const result = rank(
      rankArgs(pool, history, { pinnedDishIds: new Set([1]), slotDate: "2026-08-17" }),
    );
    expect(result.ranked[0].id).toBe(1);
  });
});

describe("§3.4 step 2: frequency-first ranking", () => {
  it("orders candidates by eaten count descending over the window", () => {
    const a = dish({ id: 1, name: "A" });
    const b = dish({ id: 2, name: "B" });
    const history = [
      row("2026-06-01", "Monday", "Lunch", b),
      row("2026-06-08", "Monday", "Lunch", a),
      row("2026-06-15", "Monday", "Lunch", a),
    ];
    const result = rank(rankArgs([b, a], history, { slotDate: "2026-08-17" }));
    expect(result.ranked.map((d) => d.id)).toEqual([1, 2]);
  });

  it("counts only the 10 most recent week-records (D3)", () => {
    const a = dish({ id: 1, name: "A" });
    const history: MenuHistoryRow[] = [];
    // A is eaten heavily 12 weeks ago, which is outside the window.
    for (let i = 0; i < 5; i += 1) history.push(row("2026-01-05", "Monday", "Lunch", a));
    for (let i = 0; i < FREQUENCY_WINDOW_WEEKS; i += 1) {
      const week = `2026-0${i < 3 ? "3" : "4"}-${String(2 + i * 7).padStart(2, "0")}`;
      history.push(row(week, "Monday", "Lunch", dish({ id: 100 + i, name: `X${i}` })));
    }
    const index = buildFrequencyIndex(history);
    expect(index.windowWeeks).toHaveLength(FREQUENCY_WINDOW_WEEKS);
    expect(eatenCount(index, 1)).toBe(0);
  });
});

describe("§3.4 step 3: the seven-day repeat guard", () => {
  it("excludes a candidate cooked within the last seven days", () => {
    const a = dish({ id: 1, name: "A" });
    // Week of Monday 2026-08-10, Friday row resolves to the calendar date 2026-08-14.
    const guard = buildGuardIndex([row("2026-08-10", "Friday", "Lunch", a)]);
    expect(cookedWithinGuard(guard, 1, "2026-08-17")).toBe(true); // 3 days later
    expect(cookedWithinGuard(guard, 1, "2026-08-21")).toBe(true); // 7 days later
    expect(cookedWithinGuard(guard, 1, "2026-08-22")).toBe(false); // 8 days later
  });

  it("keeps a fresh candidate and drops the recently cooked one", () => {
    const a = dish({ id: 1, name: "A" });
    const b = dish({ id: 2, name: "B" });
    // A is both the frequency winner and inside the guard window, so B must win.
    const history = [
      row("2026-08-10", "Monday", "Lunch", a),
      row("2026-08-10", "Tuesday", "Lunch", a),
    ];
    const result = rank(rankArgs([a, b], history, { slotDate: "2026-08-17" }));
    expect(result.ranked[0].id).toBe(2);
    expect(result.guardRelaxed).toBe(false);
  });

  it("relaxes when it would empty the pool, and reports the relaxation", () => {
    const a = dish({ id: 1, name: "A" });
    const history = [row("2026-08-10", "Monday", "Lunch", a)];
    const result = rank(rankArgs([a], history, { slotDate: "2026-08-17" }));
    expect(result.ranked.map((d) => d.id)).toEqual([1]);
    expect(result.guardRelaxed).toBe(true);
  });

  it("exempts lunch carbs, fruit and the rule 2 protein side", () => {
    const carb = dish({ id: 30, name: "Roti", category: "Chapati" });
    const history = [row("2026-08-10", "Monday", "Lunch", carb)];
    const result = rank(rankArgs([carb], history, { slotDate: "2026-08-17", recencyExempt: true }));
    expect(result.guardRelaxed).toBe(false);
    expect(result.ranked[0].id).toBe(30);
  });
});

describe("§3.4 step 4: within-week no-repeat", () => {
  it("demotes a dish already placed this week below a fresh alternative", () => {
    const a = dish({ id: 1, name: "A" });
    const b = dish({ id: 2, name: "B" });
    const history = [
      row("2026-06-01", "Monday", "Lunch", a),
      row("2026-06-08", "Monday", "Lunch", a),
    ];
    const result = rank(
      rankArgs([a, b], history, { slotDate: "2026-08-17", withinWeekDishIds: new Set([1]) }),
    );
    expect(result.ranked[0].id).toBe(2);
  });

  it("allows the repeat when every candidate has already been placed", () => {
    const a = dish({ id: 1, name: "A" });
    const result = rank(
      rankArgs([a], [], { slotDate: "2026-08-17", withinWeekDishIds: new Set([1]) }),
    );
    expect(result.ranked.map((d) => d.id)).toEqual([1]);
  });
});

describe("§3.4 step 5: tiebreaks", () => {
  it("breaks an equal frequency by longest unused, never-cooked first", () => {
    const a = dish({ id: 1, name: "A" });
    const b = dish({ id: 2, name: "B" });
    // A was cooked once, but outside the 10-week frequency window, so both score zero
    // and the tiebreak decides: B has never been cooked, so B leads.
    const history: MenuHistoryRow[] = [row("2026-01-05", "Monday", "Lunch", a)];
    for (let i = 0; i < FREQUENCY_WINDOW_WEEKS; i += 1) {
      history.push(
        row(
          `2026-0${4 + Math.floor(i / 4)}-0${(i % 4) + 1}`,
          "Monday",
          "Lunch",
          dish({ id: 100 + i, name: `X${i}` }),
        ),
      );
    }
    const result = rank(rankArgs([a, b], history, { slotDate: "2026-08-17" }));
    expect(result.ranked[0].id).toBe(2);
  });

  it("breaks a remaining tie by dish id ascending, independent of input order", () => {
    const a = dish({ id: 7, name: "A" });
    const b = dish({ id: 3, name: "B" });
    const forwards = rank(rankArgs([a, b], [], {})).ranked.map((d) => d.id);
    const backwards = rank(rankArgs([b, a], [], {})).ranked.map((d) => d.id);
    expect(forwards).toEqual([3, 7]);
    expect(backwards).toEqual([3, 7]);
  });
});

describe("§3.4 the exploration slot (D1)", () => {
  it("ranks by pure longest-unused with never-cooked first, ignoring frequency", () => {
    const proven = dish({ id: 1, name: "Proven" });
    const novel = dish({ id: 2, name: "Novel" });
    const history = [
      row("2026-08-03", "Monday", "Lunch", proven),
      row("2026-08-03", "Tuesday", "Lunch", proven),
      row("2026-08-03", "Wednesday", "Lunch", proven),
    ];
    const freq = rank(rankArgs([proven, novel], history, { slotDate: "2026-08-17" }));
    expect(freq.ranked[0].id).toBe(1);
    const explore = rank(
      rankArgs([proven, novel], history, { slotDate: "2026-08-17", mode: "exploration" }),
    );
    expect(explore.ranked[0].id).toBe(2);
  });

  it("lands on exactly one position per week, Friday's Indian companion", () => {
    const { week } = generateWeekV4({
      library: baselineLibrary(),
      history: [],
      weekStart: WEEK,
      season: "Monsoon",
      favorites: [],
    });
    const exploration = week.days.flatMap((d) =>
      d.lunch.filter((p) => p.role === "exploration").map((p) => ({ day: d.day, p })),
    );
    expect(exploration).toHaveLength(1);
    expect(exploration[0].day).toBe("Fri");
  });
});

describe("§3.4 fruit ranking", () => {
  it("ranks in-season fruit by eaten count descending, longest-unused tiebreak", () => {
    const apple = dish({
      id: 70,
      name: "Apple bowl",
      category: "Fruit",
      time: "Breakfast",
      tags: ["fruit"],
    });
    const pear = dish({
      id: 71,
      name: "Pear bowl",
      category: "Fruit",
      time: "Breakfast",
      tags: ["fruit"],
    });
    const history = [
      row("2026-08-03", "Monday", "Fruit", pear),
      row("2026-08-03", "Tuesday", "Fruit", pear),
      row("2026-08-03", "Wednesday", "Fruit", apple),
    ];
    const result = rank(
      rankArgs([apple, pear], history, {
        mode: "fruit",
        recencyExempt: true,
        slotDate: "2026-08-17",
      }),
    );
    expect(result.ranked[0].id).toBe(71);
  });

  it("keeps its full recency exemption, so the top fruit recurs across the week", () => {
    const { week } = generateWeekV4({
      library: baselineLibrary(),
      history: [],
      weekStart: WEEK,
      season: "Monsoon",
      favorites: [],
    });
    const fruits = week.days.map((d) => d.fruit!.dish.id);
    expect(new Set(fruits).size).toBe(1);
  });
});

describe("determinism", () => {
  it("produces identical output on a repeated run", () => {
    const args = {
      library: baselineLibrary(),
      history: [] as MenuHistoryRow[],
      weekStart: WEEK,
      season: "Monsoon" as const,
      favorites: [{ dishId: 10 }],
    };
    const a = generateWeekV4(args);
    const b = generateWeekV4(args);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("is independent of library input order", () => {
    const forwards = generateWeekV4({
      library: baselineLibrary(),
      history: [],
      weekStart: WEEK,
      season: "Monsoon",
      favorites: [],
    });
    const backwards = generateWeekV4({
      library: [...baselineLibrary()].reverse(),
      history: [],
      weekStart: WEEK,
      season: "Monsoon",
      favorites: [],
    });
    expect(JSON.stringify(forwards.week)).toBe(JSON.stringify(backwards.week));
  });
});
