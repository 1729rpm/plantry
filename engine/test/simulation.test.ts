import { describe, it, expect } from "vitest";
import { generateWeek } from "../src/generateWeek.js";
import { deriveHistoryRows } from "../src/historyRows.js";
import { aggregateGroceryList, type GroceryDayPicks } from "../src/groceryList.js";
import { loadLiveData } from "./loadLive.js";
import { isHpMain, proteinFamily, FAVORITE_WEEKLY_CAP } from "../src/priority.js";
import { eligibleDishes } from "../src/eligibility.js";
import type { Day } from "../src/eligibility.js";
import type { Dish, MenuHistoryRow, Season } from "../src/data/schemas.js";

/**
 * Forward simulation harness (docs/engine.md §9 spec-code parity: "the
 * simulation harness exercises all sections end-to-end against
 * data/menu_history.md plus four to six weeks of forward simulation"). Each
 * week: generate, finalize (append derived history rows), feed history forward,
 * build the grocery list. One week is a skipped-day week, exercising §6: a
 * skipped day keeps its dishes in the generated week but contributes nothing to
 * the grocery list and nothing to the history append.
 *
 * Determinism: a fixed RNG drives the Saturday alternation, so the run is
 * reproducible. The skipped-day week's property assertions are the §6 contract:
 * skipped days contribute zero grocery rows and zero history rows.
 */

const WEEKDAY_ORDER: Day[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Deterministic 0..1 RNG (a simple LCG), so the simulation is reproducible. */
function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function seasonOf(weekStart: string): Season {
  const month = Number.parseInt(weekStart.slice(5, 7), 10);
  if (month >= 3 && month <= 5) return "Summer";
  if (month >= 6 && month <= 9) return "Monsoon";
  return "Winter";
}

/** Flatten a generated week's days into day-tagged picks for the grocery list. */
function weekDayPicks(week: ReturnType<typeof generateWeek>): GroceryDayPicks[] {
  return week.days.map((d) => ({
    day: d.day,
    dishes: d.slots.flatMap((s) => s.dishes),
  }));
}

/** Consecutive Mondays from a start ISO date. */
function mondays(start: string, count: number): string[] {
  const out: string[] = [];
  const base = new Date(`${start}T00:00:00Z`);
  for (let i = 0; i < count; i += 1) {
    const d = new Date(base.getTime() + i * 7 * 24 * 60 * 60 * 1000);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

describe("forward simulation harness", () => {
  const { library, ingredients, packSizes, catalog, history: seedHistory } = loadLiveData();

  // Five forward weeks starting from a fixed Monday. Week index 2 (the third
  // week) is the skipped-day week, skipping Friday.
  const WEEKS = 5;
  const SKIPPED_WEEK_INDEX = 2;
  const SKIPPED_DAY: Day = "Fri";
  const weekStarts = mondays("2026-06-15", WEEKS);

  it("runs five forward weeks, each a full valid menu, history accumulating", () => {
    const rng = makeRng(42);
    let history: MenuHistoryRow[] = [...seedHistory];
    let lastSaturdayMenu: 3 | 4 | null = null;

    for (let i = 0; i < WEEKS; i += 1) {
      const weekStart = weekStarts[i];
      const season = seasonOf(weekStart);
      const week = generateWeek({
        weekStart,
        library,
        history,
        season,
        ingredients,
        packSizes,
        rng,
        lastSaturdayMenu,
      });

      // Every scheduled day produces at least one dish.
      for (const day of week.days) {
        const total = day.slots.reduce((sum, s) => sum + s.dishes.length, 0);
        expect(total).toBeGreaterThan(0);
      }

      // §4 step 5 within-week recency (Cluster A): no non-exempt dish appears
      // 3+ times in any generated week. Only fruit-tagged dishes and lunch carbs
      // (Chapati, Rice) are exempt and may recur (fruit-tagged dishes, Roti).
      const dishCounts = new Map<number, { count: number; dish: Dish }>();
      for (const day of week.days) {
        for (const slot of day.slots) {
          for (const dish of slot.dishes) {
            const e = dishCounts.get(dish.id) ?? { count: 0, dish };
            e.count += 1;
            dishCounts.set(dish.id, e);
          }
        }
      }
      for (const { count, dish } of dishCounts.values()) {
        const exempt =
          dish.tags.includes("fruit") || dish.category === "Chapati" || dish.category === "Rice";
        if (exempt) continue;
        expect(count, `week ${weekStart}: ${dish.name} appears ${count}x`).toBeLessThan(3);
      }

      // Finalize: append derived history rows. The skipped week skips Friday.
      const skippedDays = i === SKIPPED_WEEK_INDEX ? [SKIPPED_DAY] : [];
      const rows = deriveHistoryRows({ week, skippedDays });
      history = [...history, ...rows];

      // Track Saturday menu form for next week's alternation.
      const satLunch = week.days
        .find((d) => d.day === "Sat")
        ?.slots.find((s) => s.meal === "Lunch");
      if (satLunch && satLunch.dishes.length > 0) {
        // Menu 3 leads with complete_meal+HP, Menu 4 with complete_meal (non-HP).
        const lead = satLunch.dishes[0];
        lastSaturdayMenu = lead.tags.includes("HP") ? 3 : 4;
      }
    }

    // History grew by roughly five weeks of rows (minus the skipped Friday).
    expect(history.length).toBeGreaterThan(seedHistory.length);
  });

  it("Cluster D: no meal across the five-week sim carries more than one HP dish", () => {
    const rng = makeRng(42);
    let history: MenuHistoryRow[] = [...seedHistory];
    let lastSaturdayMenu: 3 | 4 | null = null;

    for (let i = 0; i < WEEKS; i += 1) {
      const weekStart = weekStarts[i];
      const week = generateWeek({
        weekStart,
        library,
        history,
        season: seasonOf(weekStart),
        ingredients,
        packSizes,
        rng,
        lastSaturdayMenu,
      });

      // §3 one-HP-per-meal: every slot (a day's breakfast or a day's lunch)
      // carries at most one HP-tagged dish. The thin-pool fallback can in
      // principle yield two, but the live library's broad companion pools make
      // that not occur, so we assert the strict invariant here.
      for (const day of week.days) {
        for (const slot of day.slots) {
          const hpCount = slot.dishes.filter((d) => d.tags.includes("HP")).length;
          expect(
            hpCount,
            `week ${weekStart} ${day.day} ${slot.meal}: ${hpCount} HP dishes ` +
              `(${slot.dishes.map((d) => d.name).join(", ")})`,
          ).toBeLessThanOrEqual(1);
        }
      }

      history = [...history, ...deriveHistoryRows({ week })];
      const satLunch = week.days
        .find((d) => d.day === "Sat")
        ?.slots.find((s) => s.meal === "Lunch");
      if (satLunch && satLunch.dishes.length > 0) {
        lastSaturdayMenu = satLunch.dishes[0].tags.includes("HP") ? 3 : 4;
      }
    }
  });

  it("Cluster E: no single protein is the HP main 3+ times in a week when alternatives exist", () => {
    const rng = makeRng(42);
    let history: MenuHistoryRow[] = [...seedHistory];
    let lastSaturdayMenu: 3 | 4 | null = null;

    for (let i = 0; i < WEEKS; i += 1) {
      const weekStart = weekStarts[i];
      const week = generateWeek({
        weekStart,
        library,
        history,
        season: seasonOf(weekStart),
        ingredients,
        packSizes,
        rng,
        lastSaturdayMenu,
      });

      // The week's HP mains, normalized to protein families. The HP main of a
      // meal is its first HP-main dish (Gravy/Dry/Complete meal/Keto + HP tag).
      const hpMainFamilies: string[] = [];
      for (const day of week.days) {
        for (const slot of day.slots) {
          const main = slot.dishes.find((d) => isHpMain(d));
          if (main) hpMainFamilies.push(proteinFamily(main));
        }
      }
      const familyCounts = new Map<string, number>();
      for (const fam of hpMainFamilies) {
        familyCounts.set(fam, (familyCounts.get(fam) ?? 0) + 1);
      }

      // The live Monsoon library has many proteins (chicken, paneer, egg, fish,
      // prawn, mutton, soya, chickpea), so alternative HP-main proteins always
      // have eligible candidates. The soft §4.6 rule must keep any one protein
      // under 3 HP-main appearances per week.
      for (const [fam, count] of familyCounts) {
        expect(
          count,
          `week ${weekStart}: protein ${fam} is the HP main ${count} times`,
        ).toBeLessThan(3);
      }

      // Sanity: the week genuinely uses multiple proteins (so the assertion is
      // not vacuously satisfied by an HP-poor week).
      expect(familyCounts.size).toBeGreaterThanOrEqual(2);

      history = [...history, ...deriveHistoryRows({ week })];
      const satLunch = week.days
        .find((d) => d.day === "Sat")
        ?.slots.find((s) => s.meal === "Lunch");
      if (satLunch && satLunch.dishes.length > 0) {
        lastSaturdayMenu = satLunch.dishes[0].tags.includes("HP") ? 3 : 4;
      }
    }
  });

  it("property: a skipped day contributes zero grocery rows and zero history rows", () => {
    const rng = makeRng(7);
    const weekStart = weekStarts[SKIPPED_WEEK_INDEX];
    const season = seasonOf(weekStart);
    const week = generateWeek({
      weekStart,
      library,
      history: seedHistory,
      season,
      ingredients,
      packSizes,
      rng,
    });

    // The skipped day really has generated dishes (so the property is non-trivial).
    const skippedDay = week.days.find((d) => d.day === SKIPPED_DAY);
    expect(skippedDay).toBeDefined();
    const skippedDishIds = (skippedDay?.slots ?? []).flatMap((s) => s.dishes.map((d) => d.id));
    expect(skippedDishIds.length).toBeGreaterThan(0);

    // History rows: none reference the skipped day.
    const skippedRows = deriveHistoryRows({ week, skippedDays: [SKIPPED_DAY] });
    expect(skippedRows.some((r) => r.day === "Friday")).toBe(false);

    // The dropped rows are exactly the skipped day's rows: its slot dishes plus
    // its §3.3 Fruit of the day (logged as a `meal:"Fruit"` row), which a skipped
    // day also drops.
    const fullRows = deriveHistoryRows({ week });
    const skippedSlotDishes = (skippedDay?.slots ?? []).reduce(
      (sum, s) => sum + s.dishes.length,
      0,
    );
    const skippedFruitRows = skippedDay?.fruit ? 1 : 0;
    expect(fullRows.length - skippedRows.length).toBe(skippedSlotDishes + skippedFruitRows);

    // Grocery list: ingredients unique to the skipped day disappear.
    const days = weekDayPicks(week);
    const withSkip = aggregateGroceryList({
      days,
      skippedDays: [SKIPPED_DAY],
      ingredients,
      packSizes,
      catalog,
    });
    const withoutSkip = aggregateGroceryList({ days, ingredients, packSizes, catalog });

    // Build the set of ingredient names that ONLY the skipped day's dishes use.
    const ingByDish = new Map<number, Set<string>>();
    for (const r of ingredients) {
      const set = ingByDish.get(r.dishId) ?? new Set<string>();
      set.add(r.ingredient);
      ingByDish.set(r.dishId, set);
    }
    const skippedIngredients = new Set<string>();
    for (const id of skippedDishIds) {
      for (const name of ingByDish.get(id) ?? []) skippedIngredients.add(name);
    }
    const otherDishIds = week.days
      .filter((d) => d.day !== SKIPPED_DAY)
      .flatMap((d) => d.slots.flatMap((s) => s.dishes.map((dish) => dish.id)));
    const keptIngredients = new Set<string>();
    for (const id of otherDishIds) {
      for (const name of ingByDish.get(id) ?? []) keptIngredients.add(name);
    }
    const onlySkippedIngredients = [...skippedIngredients].filter(
      (name) => !keptIngredients.has(name),
    );

    const namesIn = (list: typeof withSkip) =>
      new Set(list.groups.flatMap((g) => g.items.map((i) => i.ingredient)));
    const withSkipNames = namesIn(withSkip);
    const withoutSkipNames = namesIn(withoutSkip);

    // Every ingredient unique to the skipped day is present without the skip and
    // absent with it.
    for (const name of onlySkippedIngredients) {
      expect(withoutSkipNames.has(name)).toBe(true);
      expect(withSkipNames.has(name)).toBe(false);
    }
  });

  it("is deterministic: same seed reproduces the same five-week run", () => {
    function run(seed: number): number[] {
      const rng = makeRng(seed);
      let history: MenuHistoryRow[] = [...seedHistory];
      const ids: number[] = [];
      for (let i = 0; i < WEEKS; i += 1) {
        const weekStart = weekStarts[i];
        const week = generateWeek({
          weekStart,
          library,
          history,
          season: seasonOf(weekStart),
          ingredients,
          packSizes,
          rng,
        });
        for (const day of week.days) {
          for (const slot of day.slots) {
            for (const dish of slot.dishes) ids.push(dish.id);
          }
        }
        history = [...history, ...deriveHistoryRows({ week })];
      }
      return ids;
    }
    expect(run(99)).toEqual(run(99));
  });

  it("emits days in canonical Mon..Sat order each week", () => {
    const rng = makeRng(3);
    const week = generateWeek({
      weekStart: weekStarts[0],
      library,
      history: seedHistory,
      season: seasonOf(weekStarts[0]),
      ingredients,
      packSizes,
      rng,
    });
    const order = week.days.map((d) => d.day);
    const expected = WEEKDAY_ORDER.filter((d) => order.includes(d));
    expect(order).toEqual(expected);
  });
});

/**
 * §4 step 4 favorites fixture (features/wishlist.md §3). Generates a Monsoon week
 * against the live library with a favorites set and asserts the three feature
 * contracts: (a) a favorite absent from last week's history lands this week, (b)
 * no favorite repeats within one week (emergent from §4 step 5 within-week
 * recency, no due-date arithmetic), and (c) at most FAVORITE_WEEKLY_CAP favorite
 * placements per generated week, so a long favorites list cannot swamp rotation.
 *
 * Favorites are drawn from the live eligible pool so the fixture tracks the real
 * library, not hand-built dishes: a set of non-exempt HP-main lunch dishes, which
 * the favorites step promotes into the weekday protein-lead positions. Non-exempt
 * so within-week recency (step 5) genuinely governs their repeats (fruit and
 * lunch carbs are recency-exempt and would be allowed to recur).
 */
describe("favorites frequency (features/wishlist.md §3)", () => {
  const { library, ingredients, packSizes, history: seedHistory } = loadLiveData();
  const weekStart = "2026-06-15"; // Monsoon
  const season = seasonOf(weekStart);

  // Eligible Monsoon dishes for both meals. The lunch HP mains (HP-tagged
  // Gravy/Dry/Complete meal/Keto) land as the weekday protein lead, so a favorite
  // among them reliably surfaces when promoted.
  const eligibleLunch = eligibleDishes({
    library,
    history: seedHistory,
    season,
    slot: { day: "Mon", meal: "Lunch" },
  });
  const eligibleBreakfast = eligibleDishes({
    library,
    history: seedHistory,
    season,
    slot: { day: "Mon", meal: "Breakfast" },
  });
  const eligibleAll = [
    ...new Map([...eligibleBreakfast, ...eligibleLunch].map((d) => [d.id, d])).values(),
  ];
  const favoriteMains = eligibleLunch.filter((d) => isHpMain(d));

  // Dish ids cooked in the most recent history week: a favorite drawn from
  // outside this set is genuinely "absent last week".
  const lastWeekStart = seedHistory.reduce((max, r) => (r.weekStart > max ? r.weekStart : max), "");
  const lastWeekDishIds = new Set(
    seedHistory.filter((r) => r.weekStart === lastWeekStart).map((r) => r.dishId),
  );

  function generate(favoriteDishIds?: ReadonlySet<number>) {
    return generateWeek({
      weekStart,
      library,
      history: seedHistory,
      season,
      ingredients,
      packSizes,
      rng: makeRng(42),
      favoriteDishIds,
    });
  }

  /** Every dish id placed in the week, one entry per placement (repeats counted). */
  function placedDishIds(week: ReturnType<typeof generateWeek>): number[] {
    return week.days.flatMap((d) => d.slots.flatMap((s) => s.dishes.map((dish) => dish.id)));
  }

  it("(a) a favorite absent from last week's history lands this week", () => {
    // Favorite several eligible HP mains that were not cooked last week. Promotion
    // (§4 step 4) surfaces at least one of them into this week's menu, so a
    // favorite the household wants lands without any due-date arithmetic.
    const absentLastWeek = favoriteMains.filter((d) => !lastWeekDishIds.has(d.id)).slice(0, 12);
    expect(absentLastWeek.length, "expected eligible favorites absent last week").toBeGreaterThan(
      0,
    );
    const favoriteDishIds = new Set(absentLastWeek.map((d) => d.id));
    const placed = new Set(placedDishIds(generate(favoriteDishIds)));
    const landed = absentLastWeek.filter((d) => placed.has(d.id));
    expect(landed.length, "no favorite absent last week landed").toBeGreaterThan(0);
    // Every landed favorite was genuinely absent from last week's history.
    for (const d of landed) expect(lastWeekDishIds.has(d.id)).toBe(false);
  });

  it("(b) no favorite repeats within one week", () => {
    // A broad favorites set of eligible HP mains; within-week recency (§4 step 5)
    // must keep each favorite to at most one placement in the week, so the weekly
    // cadence is emergent, no favorite twice in one week.
    const favoriteDishIds = new Set(favoriteMains.map((d) => d.id));
    const week = generate(favoriteDishIds);
    const counts = new Map<number, number>();
    for (const id of placedDishIds(week)) {
      if (favoriteDishIds.has(id)) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    for (const [id, count] of counts) {
      const dish = library.find((d) => d.id === id);
      expect(count, `favorite ${dish?.name} (${id}) placed ${count}x in one week`).toBeLessThan(2);
    }
  });

  it("(c) promotion stops after FAVORITE_WEEKLY_CAP placements", () => {
    // Isolate promotion from natural rotation: favorite only eligible dishes that
    // do NOT appear in the unfavorited week, so every favorite placement is a pure
    // promotion (the favorites step, not longest-unused, put it there). The weekly
    // budget then caps promotion at FAVORITE_WEEKLY_CAP: byFavorites no-ops once
    // the count reaches the cap, so no further favorite is promoted this week.
    const naturalIds = new Set(placedDishIds(generate()));
    const promotionOnly = eligibleAll.filter((d) => !naturalIds.has(d.id));
    // Far more promotable favorites than the cap, so the cap is the binding limit.
    expect(promotionOnly.length).toBeGreaterThan(FAVORITE_WEEKLY_CAP);
    const favoriteDishIds = new Set(promotionOnly.map((d) => d.id));
    const favoritePlacements = placedDishIds(generate(favoriteDishIds)).filter((id) =>
      favoriteDishIds.has(id),
    ).length;
    expect(favoritePlacements).toBe(FAVORITE_WEEKLY_CAP);
  });
});
