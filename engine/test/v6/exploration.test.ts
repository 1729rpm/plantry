import { describe, it, expect } from "vitest";
import type { Dish } from "../../src/data/schemas.js";
import {
  candidatePool,
  demotedFamilies,
  pickExploration,
  rankExploreV6,
} from "../../src/v6/exploration.js";
import type { PoolProvider } from "../../src/v6/place.js";
import type { Day, DishStats, Ledger, Pick, RecordStats, RecordWeek } from "../../src/v6/types.js";

/**
 * `features/engine-v6.md` §7, the novelty channel: exactly one weekday lunch
 * placement a week is the only door a never-eaten dish enters through. The
 * candidate pool is Active, in-season, Lunch time, `eatenCount` zero in every
 * scope, and not explored-and-uneaten inside the trailing 8 generated weeks; the
 * affinity score is computed over record rows of the candidate's own meal type;
 * and a protein family already served at or above its record rate over those 8
 * weeks is demoted below every other candidate.
 */

function makeDish(overrides: Partial<Dish> & { id: number }): Dish {
  return {
    name: `Dish ${overrides.id}`,
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

function dishStats(weekdayLunch: number, weekdayBreakfast = 0): DishStats {
  return {
    eatenCount: { weekdayBreakfast, weekdayLunch, saturday: 0, fruit: 0 },
    rate: { weekdayBreakfast: 0, weekdayLunch: 0, saturday: 0, fruit: 0 },
    lastEatenWeek: null,
    occupations: new Map(),
    seasonCount: {},
  };
}

function makeStats(
  eaten: Array<[number, number] | [number, number, number]>,
  occasions: { weekdayLunch: number; weekdayBreakfast?: number },
): RecordStats {
  const perDish = new Map<number, DishStats>();
  for (const [dishId, lunch, breakfast] of eaten) {
    perDish.set(dishId, dishStats(lunch, breakfast ?? 0));
  }
  return {
    weeks: 12,
    occasions: {
      weekdayBreakfast: occasions.weekdayBreakfast ?? occasions.weekdayLunch,
      weekdayLunch: occasions.weekdayLunch,
      saturday: 0,
      fruit: 0,
    },
    seasonDayOccasions: {},
    perDish,
    swappedOut: [],
  };
}

const WEEKDAYS: Day[] = ["Mon", "Tue", "Wed", "Thu", "Fri"];

function weekOf(weekStart: string, lunchIds: number[], breakfastIds: number[] = []): RecordWeek {
  const picks: Pick[] = [];
  lunchIds.forEach((dishId, index) => picks.push({ day: WEEKDAYS[index], meal: "lunch", dishId }));
  breakfastIds.forEach((dishId, index) =>
    picks.push({ day: WEEKDAYS[index], meal: "breakfast", dishId }),
  );
  return { weekStart, picks, skippedDays: [], generatedPlan: null };
}

function mondayOf(index: number): string {
  // Deterministic ascending ISO Mondays; only their order matters here.
  const day = 1 + index * 7;
  return `2026-01-${String(day).padStart(2, "0")}`;
}

const emptyLedger: Ledger = { deficits: new Map() };
const emptyProvider: PoolProvider = () => [];

describe("§7 the affinity score is computed over the candidate's own meal type", () => {
  // The household eats egg every weekday morning and almost never at lunch: 1
  // egg lunch in 44. Scored over the whole record egg reads as the most familiar
  // ingredient there is, which is exactly the defect §7's amendment names.
  const eggBreakfast = makeDish({ id: 1, time: "Breakfast", primaryIngredient: "Egg" });
  const paneerLunch = makeDish({ id: 2, primaryIngredient: "Paneer" });
  const eggLunch = makeDish({ id: 3, primaryIngredient: "Egg" });
  const eggCandidate = makeDish({ id: 10, primaryIngredient: "Egg", name: "Egg curry" });
  const paneerCandidate = makeDish({ id: 11, primaryIngredient: "Paneer", name: "Paneer tikka" });
  const library = [eggBreakfast, paneerLunch, eggLunch, eggCandidate, paneerCandidate];

  // Nine weeks: 44 weekday lunches (43 paneer, 1 egg) and 45 egg breakfasts.
  const record: RecordWeek[] = [];
  for (let week = 0; week < 9; week += 1) {
    const lunches = [2, 2, 2, 2, 2];
    if (week === 0) lunches[4] = 3;
    record.push(weekOf(mondayOf(week), lunches.slice(0, week === 8 ? 4 : 5), [1, 1, 1, 1, 1]));
  }
  const stats = makeStats(
    [
      [1, 0, 45],
      [2, 43],
      [3, 1],
    ],
    { weekdayLunch: 44, weekdayBreakfast: 45 },
  );

  it("does not let egg top the lunch affinity, because egg is one lunch in 44", () => {
    const ranked = rankExploreV6(stats, library, "Summer", record, { mealTimes: ["Lunch"] });
    expect(ranked.map((entry) => entry.dish.id)).toEqual([11, 10]);

    const paneer = ranked.find((entry) => entry.dish.id === 11);
    const egg = ranked.find((entry) => entry.dish.id === 10);
    expect(paneer?.signals.sharedIngredient).toBe(1);
    expect(egg?.signals.sharedIngredient).toBeLessThan(0.05);
  });

  it("still reads egg as the most familiar BREAKFAST ingredient, so the scoping is what changed", () => {
    const breakfastCandidate = makeDish({
      id: 12,
      time: "Breakfast",
      primaryIngredient: "Egg",
      name: "Egg akuri",
    });
    const ranked = rankExploreV6(stats, [...library, breakfastCandidate], "Summer", record, {
      mealTimes: ["Breakfast"],
    });
    expect(ranked[0].dish.id).toBe(12);
    expect(ranked[0].signals.sharedIngredient).toBe(1);
  });

  it("picks the paneer candidate for the weekday lunch slot", () => {
    const pick = pickExploration({
      library,
      stats,
      record,
      season: "Summer",
      ledger: emptyLedger,
      provider: emptyProvider,
    });
    expect(pick?.dish.id).toBe(11);
    expect(pick?.family).toBe("Paneer");
    expect(pick?.role).toBe("star");
  });
});

describe("§7 spacing: a candidate explored and not eaten waits 8 weeks", () => {
  const staple = makeDish({ id: 2, primaryIngredient: "Paneer" });
  const explored = makeDish({ id: 20, primaryIngredient: "Prawn", name: "Prawn ghee roast" });
  const other = makeDish({ id: 21, primaryIngredient: "Fish", name: "Fish moilee" });
  const library = [staple, explored, other];
  const stats = makeStats([[2, 40]], { weekdayLunch: 40 });

  /** `count` generated weeks; the first one offered dish 20 and the household did not eat it. */
  function generatedRecord(count: number): RecordWeek[] {
    const weeks: RecordWeek[] = [];
    for (let index = 0; index < count; index += 1) {
      const plan: Pick[] = WEEKDAYS.map((day) => ({ day, meal: "lunch" as const, dishId: 2 }));
      const picks: Pick[] = WEEKDAYS.map((day) => ({ day, meal: "lunch" as const, dishId: 2 }));
      if (index === 0) plan[4] = { day: "Fri", meal: "lunch", dishId: 20 };
      weeks.push({ weekStart: mondayOf(index), picks, skippedDays: [], generatedPlan: plan });
    }
    return weeks;
  }

  it("keeps the swapped-away candidate out while it sits inside the trailing 8 weeks", () => {
    const record = generatedRecord(8);
    const pool = candidatePool({ library, stats, season: "Summer", mealTimes: ["Lunch"], record });
    expect(pool.map((dish) => dish.id)).toEqual([21]);

    const pick = pickExploration({
      library,
      stats,
      record,
      season: "Summer",
      ledger: emptyLedger,
      provider: emptyProvider,
    });
    expect(pick?.dish.id).toBe(21);
  });

  it("re-proposes it once the exploring week falls out of the window", () => {
    const record = generatedRecord(9);
    const pool = candidatePool({ library, stats, season: "Summer", mealTimes: ["Lunch"], record });
    expect(pool.map((dish) => dish.id)).toEqual([20, 21]);
  });

  it("never spaces out a candidate the household actually ate, because it is no longer a candidate", () => {
    const record = generatedRecord(8);
    // The same dish, planned AND eaten, is not explored-and-uneaten.
    record[0].picks.push({ day: "Fri", meal: "lunch", dishId: 20 });
    const pool = candidatePool({ library, stats, season: "Summer", mealTimes: ["Lunch"], record });
    expect(pool.map((dish) => dish.id)).toEqual([20, 21]);
  });
});

describe("§7 the family governor", () => {
  // Twelve record weeks of lunches: paneer 36, fish 12, chicken 12 over 60
  // occasions, so paneer's record rate is 0.6 and fish's is 0.2. The trailing 8
  // generated plans ran paneer at 0.8 and fish at 0, so paneer is at or above
  // its rate and fish is not.
  const paneer1 = makeDish({ id: 1, primaryIngredient: "Paneer" });
  const paneer2 = makeDish({ id: 2, primaryIngredient: "Paneer" });
  const paneer3 = makeDish({ id: 3, primaryIngredient: "Paneer" });
  const fish = makeDish({ id: 4, primaryIngredient: "Fish" });
  const chicken = makeDish({ id: 5, primaryIngredient: "Chicken" });
  const paneerCandidate = makeDish({ id: 30, primaryIngredient: "Paneer", name: "Paneer korma" });
  const fishCandidate = makeDish({ id: 31, primaryIngredient: "Fish", name: "Fish curry" });
  const library = [paneer1, paneer2, paneer3, fish, chicken, paneerCandidate, fishCandidate];

  const record: RecordWeek[] = [];
  for (let week = 0; week < 12; week += 1) {
    const picks: Pick[] = [1, 2, 3, 4, 5].map((dishId, index) => ({
      day: WEEKDAYS[index],
      meal: "lunch" as const,
      dishId,
    }));
    const generatedPlan: Pick[] | null =
      week >= 4
        ? [1, 2, 3, 1, 5].map((dishId, index) => ({
            day: WEEKDAYS[index],
            meal: "lunch" as const,
            dishId,
          }))
        : null;
    record.push({ weekStart: mondayOf(week), picks, skippedDays: [], generatedPlan });
  }

  const stats = makeStats(
    [
      [1, 12],
      [2, 12],
      [3, 12],
      [4, 12],
      [5, 12],
    ],
    { weekdayLunch: 60 },
  );

  it("names the at-rate families and leaves the under-rate one alone", () => {
    const demoted = demotedFamilies(record, library, stats);
    expect(demoted.has("Paneer")).toBe(true);
    expect(demoted.has("Fish")).toBe(false);
  });

  it("demotes the at-rate family's candidate below every other candidate", () => {
    // Paneer outscores fish on affinity (36 lunch rows against 12), so without
    // the governor the paneer candidate wins outright.
    const ranked = rankExploreV6(stats, library, "Summer", record, { mealTimes: ["Lunch"] });
    expect(ranked[0].dish.id).toBe(30);

    const pick = pickExploration({
      library,
      stats,
      record,
      season: "Summer",
      ledger: emptyLedger,
      provider: emptyProvider,
    });
    expect(pick?.dish.id).toBe(31);
    expect(pick?.family).toBe("Fish");
  });

  it("stops demoting when the §11 governor-off variant is set", () => {
    const pick = pickExploration({
      library,
      stats,
      record,
      season: "Summer",
      ledger: emptyLedger,
      provider: emptyProvider,
      variant: { familyGovernor: false },
    });
    expect(pick?.dish.id).toBe(30);
    expect(pick?.family).toBe("Paneer");
  });

  it("demotes nothing before the first generated week, so a cold start is unbiased", () => {
    const coldRecord = record.map((week) => ({ ...week, generatedPlan: null }));
    expect(demotedFamilies(coldRecord, library, stats).size).toBe(0);
  });
});

describe("§7 the candidate pool and the shape of a placeable pick", () => {
  const stats = makeStats([[1, 5]], { weekdayLunch: 20 });

  it("excludes repertoire dishes, inactive dishes, and out-of-season dishes", () => {
    const library = [
      makeDish({ id: 1 }),
      makeDish({ id: 2, active: "No" }),
      makeDish({ id: 3, seasons: ["Winter"] }),
      makeDish({ id: 4 }),
    ];
    const pool = candidatePool({ library, stats, season: "Summer", mealTimes: ["Lunch"] });
    expect(pool.map((dish) => dish.id)).toEqual([4]);
  });

  it("excludes an id already pinned into this week's plan", () => {
    const library = [makeDish({ id: 4 }), makeDish({ id: 5 })];
    const pool = candidatePool({
      library,
      stats,
      season: "Summer",
      mealTimes: ["Lunch"],
      exclude: new Set([4]),
    });
    expect(pool.map((dish) => dish.id)).toEqual([5]);
  });

  it("returns null when no candidate has a weekday lunch shape", () => {
    // A Category Bread lunch dish is neither a star nor a companion (§5.1).
    const library = [makeDish({ id: 7, category: "Bread", primaryIngredient: "Wheat" })];
    const pick = pickExploration({
      library,
      stats,
      record: [],
      season: "Summer",
      ledger: emptyLedger,
      provider: emptyProvider,
    });
    expect(pick).toBeNull();
  });

  it("takes an Accompaniment candidate as a companion, never as a star", () => {
    const library = [makeDish({ id: 8, category: "Accompaniment", primaryIngredient: "Cucumber" })];
    const pick = pickExploration({
      library,
      stats,
      record: [],
      season: "Summer",
      ledger: emptyLedger,
      provider: emptyProvider,
    });
    expect(pick?.role).toBe("companion");
  });

  it("is input-order independent and ties break by dish id ascending", () => {
    const library = [makeDish({ id: 40 }), makeDish({ id: 41 }), makeDish({ id: 42 })];
    const forward = rankExploreV6(stats, library, "Summer", [], { mealTimes: ["Lunch"] });
    const reversed = rankExploreV6(stats, [...library].reverse(), "Summer", [], {
      mealTimes: ["Lunch"],
    });
    expect(forward.map((entry) => entry.dish.id)).toEqual([40, 41, 42]);
    expect(reversed.map((entry) => entry.dish.id)).toEqual(forward.map((entry) => entry.dish.id));
  });
});
