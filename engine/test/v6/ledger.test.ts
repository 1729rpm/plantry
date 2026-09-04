/**
 * §3 and §3.1: the deficit ledger and its replay.
 *
 * The structural-pool predicate is stream B's (`isStructuralPoolDish` in
 * `pools.ts`); it is not imported here. `structuralPoolIds` below is a **test-local**
 * approximation on the fields §5 names, enough to distinguish a lunch star, a carb, a
 * breakfast main, a Saturday treat, a dessert and a fruit from a companion-only dish.
 * `seedLedger` and `replayLedger` take the id set as a parameter, so stream D wires
 * B's real predicate in without touching this module.
 *
 * Stream D owns `engine/test/v6/loadRecordFixture.ts`; until it exists the fixtures
 * are read here with `readFileSync` and a type assertion, as the stream brief says.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Dish, Season } from "../../src/data/schemas.js";
import type { Ledger, RecordWeek } from "../../src/v6/types.js";
import {
  PLANNED_OCCASIONS,
  accrue,
  charge,
  deficitIn,
  emptyLedger,
  reconcile,
  refund,
  replayLedger,
  seedLedger,
} from "../../src/v6/ledger.js";
import { deriveOccasionSeries, deriveRecordStats, rateIn } from "../../src/v6/record.js";
import { loadLiveData } from "../loadLive.js";

const fixturesDir = resolve(dirname(fileURLToPath(import.meta.url)), "fixtures");

function loadFixture(name: string): RecordWeek[] {
  return JSON.parse(readFileSync(resolve(fixturesDir, `${name}.json`), "utf8")) as RecordWeek[];
}

const library: Dish[] = loadLiveData().library;
const record = loadFixture("record-8weeks");
const reconcileRecord = loadFixture("record-reconcile");
const SEASON: Season = "Monsoon";

/** The week after the record's last served week: where the cold start sits. */
const CUTOVER = "2026-08-17";

function idOf(name: string): number {
  const dish = library.find((candidate) => candidate.name.toLowerCase() === name.toLowerCase());
  if (!dish) throw new Error(`no library dish named ${name}`);
  return dish.id;
}

const FISH_TIKKA = idOf("Fish tikka");
const MANGO = idOf("Mango bowl");
const ONION_TOMATO_SALAD = idOf("Onion tomato salad");
const CHICKEN_MASALA_GRAVY = idOf("Chicken masala gravy");
const ROTI = idOf("Roti");
const BREAD_OMELETTE = idOf("Bread omelette");

/**
 * A test-local stand-in for stream B's `isStructuralPoolDish`, on the fields §5
 * names: lunch stars (HP-tagged, or Gravy dish, Keto or Complete meal at Lunch),
 * carbs (Rice, Chapati or Bread at Lunch), breakfast mains (§5.2: a Breakfast dish
 * that is not an Accompaniment and not a bare Bread or Paratha carb), desserts and
 * fruit. Saturday treats reach the set through the record: any dish the record shows
 * as a Saturday main is structural in its Saturday scope.
 */
function structuralPoolIds(dishes: readonly Dish[]): Set<number> {
  const ids = new Set<number>();
  for (const dish of dishes) {
    const star =
      dish.time === "Lunch" &&
      (dish.tags.includes("HP") ||
        dish.category === "Gravy dish" ||
        dish.category === "Keto" ||
        dish.category === "Complete meal");
    const carb =
      dish.time === "Lunch" &&
      (dish.category === "Rice" || dish.category === "Chapati" || dish.category === "Bread");
    const bareCarb =
      (dish.category === "Bread" || dish.category === "Paratha") &&
      !dish.tags.includes("complete_carb");
    const breakfastMain =
      dish.time === "Breakfast" && dish.category !== "Accompaniment" && !bareCarb;
    if (star || carb || breakfastMain || dish.category === "Dessert" || dish.category === "Fruit") {
      ids.add(dish.id);
    }
  }
  return ids;
}

const STRUCTURAL = structuralPoolIds(library);
const ELIGIBLE = new Set(
  library
    .filter(
      (dish) => dish.active === "Yes" && (dish.seasons === "All" || dish.seasons.includes(SEASON)),
    )
    .map((dish) => dish.id),
);

const stats = deriveRecordStats(record, library, SEASON);
const series = deriveOccasionSeries(record, SEASON);

function serialize(ledger: Ledger): string {
  return JSON.stringify([...ledger.deficits]);
}

describe("the cold start (§3)", () => {
  const seeded = seedLedger(stats, CUTOVER, STRUCTURAL, 1, series);

  it("backdates accrual from the dish's last as-eaten week", () => {
    // Fish tikka last ate on 2026-08-03; the one week between then and the cutover
    // (2026-08-10, whose Monday was skipped) carries 4 weekday lunch occasions.
    const rate = rateIn(stats, FISH_TIKKA, "weekdayLunch") as number;
    expect(deficitIn(seeded, FISH_TIKKA, "weekdayLunch")).toBeCloseTo(rate * 4, 10);
    expect(deficitIn(seeded, FISH_TIKKA, "weekdayLunch")).toBeLessThan(1);
  });

  it("caps the seed at one banked serving", () => {
    // Mango's fruit rate is 11/44; the 5 non-skipped days of 2026-08-10 would bank
    // 1.25 servings, which the cap holds at 1.
    const rate = rateIn(stats, MANGO, "fruit") as number;
    expect(rate * 5).toBeGreaterThan(1);
    expect(deficitIn(seeded, MANGO, "fruit")).toBe(1);
  });

  it("seeds a companion-only dish at zero", () => {
    // Onion tomato salad is a Category Accompaniment: an optional-slot dish, and §3
    // seeds only structural pools, so it starts flat however long ago it was eaten.
    expect(STRUCTURAL.has(ONION_TOMATO_SALAD)).toBe(false);
    expect(deficitIn(seeded, ONION_TOMATO_SALAD, "weekdayLunch")).toBe(0);
  });

  it("gives a dish no entry in a scope it is absent from", () => {
    expect(deficitIn(seeded, FISH_TIKKA, "weekdayBreakfast")).toBeUndefined();
    expect(deficitIn(seeded, MANGO, "weekdayLunch")).toBeUndefined();
  });

  it("seeds optional pools too under the seedOptionalPools variant", () => {
    const everything = new Set(stats.perDish.keys());
    const wide = seedLedger(stats, CUTOVER, everything, 1, series);
    expect(deficitIn(wide, ONION_TOMATO_SALAD, "weekdayLunch")).toBeGreaterThan(0);
  });

  it("caps a whole scope at one week of the pool's combined rate under the pool cap", () => {
    const pooled = seedLedger(stats, CUTOVER, STRUCTURAL, "pool", series);
    const budget =
      [...stats.perDish.keys()]
        .filter((dishId) => STRUCTURAL.has(dishId))
        .reduce((sum, dishId) => sum + (rateIn(stats, dishId, "weekdayLunch") ?? 0), 0) *
      PLANNED_OCCASIONS.weekdayLunch;
    const total = [...pooled.deficits]
      .filter(([key]) => key.endsWith(":weekdayLunch") && STRUCTURAL.has(Number(key.split(":")[0])))
      .reduce((sum, [, value]) => sum + value, 0);
    expect(total).toBeLessThanOrEqual(budget + 1e-9);
    expect(total).toBeGreaterThan(0);
  });
});

describe("accrual (§3)", () => {
  it("adds rate x planned occasions in every scope the dish is present in", () => {
    const after = accrue(emptyLedger(), stats, ELIGIBLE, PLANNED_OCCASIONS);
    const lunchRate = rateIn(stats, FISH_TIKKA, "weekdayLunch") as number;
    const saturdayRate = rateIn(stats, FISH_TIKKA, "saturday") as number;
    expect(deficitIn(after, FISH_TIKKA, "weekdayLunch")).toBeCloseTo(lunchRate * 5, 10);
    expect(deficitIn(after, FISH_TIKKA, "saturday")).toBeCloseTo(saturdayRate * 1, 10);
  });

  it("freezes an ineligible dish's deficit instead of decaying it", () => {
    const seeded = seedLedger(stats, CUTOVER, STRUCTURAL, 1, series);
    const before = deficitIn(seeded, FISH_TIKKA, "weekdayLunch") as number;
    const withoutFish = new Set(ELIGIBLE);
    withoutFish.delete(FISH_TIKKA);
    const after = accrue(seeded, stats, withoutFish, PLANNED_OCCASIONS);
    expect(deficitIn(after, FISH_TIKKA, "weekdayLunch")).toBe(before);
    // Every other dish still moved, so the freeze is the dish's and not the ledger's.
    expect(deficitIn(after, ROTI, "weekdayLunch")).toBeGreaterThan(
      deficitIn(seeded, ROTI, "weekdayLunch") as number,
    );
  });

  it("does not accrue a scope the dish is absent from", () => {
    const after = accrue(emptyLedger(), stats, ELIGIBLE, PLANNED_OCCASIONS);
    expect(deficitIn(after, MANGO, "weekdayLunch")).toBeUndefined();
  });
});

describe("charge and refund (§3)", () => {
  it("takes one serving out and puts one back, without mutating the input", () => {
    const start = accrue(emptyLedger(), stats, ELIGIBLE, PLANNED_OCCASIONS);
    const before = deficitIn(start, FISH_TIKKA, "weekdayLunch") as number;
    const charged = charge(start, FISH_TIKKA, "weekdayLunch");
    expect(deficitIn(charged, FISH_TIKKA, "weekdayLunch")).toBeCloseTo(before - 1, 10);
    expect(deficitIn(start, FISH_TIKKA, "weekdayLunch")).toBe(before);
    expect(deficitIn(refund(charged, FISH_TIKKA, "weekdayLunch"), FISH_TIKKA, "weekdayLunch")).toBe(
      before,
    );
  });

  it("charges a dish that had no ledger in the scope down to minus one", () => {
    expect(deficitIn(charge(emptyLedger(), 42, "saturday"), 42, "saturday")).toBe(-1);
  });

  it("charges only the scope the dish was placed in", () => {
    const charged = charge(emptyLedger(), FISH_TIKKA, "saturday");
    expect(deficitIn(charged, FISH_TIKKA, "weekdayLunch")).toBeUndefined();
  });
});

describe("reconciliation (§3)", () => {
  const week = reconcileRecord.find((row) => row.weekStart === "2026-08-17") as RecordWeek;

  it("charges a swap-in the plan did not contain", () => {
    // The plan led Monday lunch with fish tikka; the household ate a chicken gravy.
    const after = reconcile(emptyLedger(), week, library, SEASON);
    expect(deficitIn(after, CHICKEN_MASALA_GRAVY, "weekdayLunch")).toBe(-1);
  });

  it("leaves a placed-then-swapped-out dish charged, with no refund", () => {
    // The engine charged fish tikka when it placed it. Reconciliation must not give
    // that serving back: the placement consumed its turn (§3, no refund).
    const placed = charge(emptyLedger(), FISH_TIKKA, "weekdayLunch");
    const after = reconcile(placed, week, library, SEASON);
    expect(deficitIn(after, FISH_TIKKA, "weekdayLunch")).toBe(-1);
  });

  it("does not charge a dish the plan already contained", () => {
    const after = reconcile(emptyLedger(), week, library, SEASON);
    expect(deficitIn(after, ROTI, "weekdayLunch")).toBeUndefined();
    expect(deficitIn(after, BREAD_OMELETTE, "weekdayBreakfast")).toBeUndefined();
    expect(deficitIn(after, MANGO, "fruit")).toBeUndefined();
  });

  it("does not charge twice for a dish the household moved to another weekday", () => {
    // The week of 2026-09-07 moved every plate between Monday and Wednesday. Matching
    // on the exact (day, meal, dish) triple would charge all eight servings again.
    const moved = reconcileRecord.find((row) => row.weekStart === "2026-09-07") as RecordWeek;
    expect(reconcile(emptyLedger(), moved, library, SEASON).deficits.size).toBe(0);
  });

  it("does not charge an as-eaten row on a skipped day", () => {
    const skipped: RecordWeek = {
      weekStart: "2026-08-17",
      picks: [{ day: "Tue", meal: "lunch", dishId: CHICKEN_MASALA_GRAVY }],
      skippedDays: ["Tue"],
      generatedPlan: [],
    };
    expect(reconcile(emptyLedger(), skipped, library, SEASON).deficits.size).toBe(0);
  });

  it("charges every as-eaten row of a week that carries no plan", () => {
    const planless: RecordWeek = { ...week, generatedPlan: null };
    const after = reconcile(emptyLedger(), planless, library, SEASON);
    expect(deficitIn(after, ROTI, "weekdayLunch")).toBe(-1);
    expect(deficitIn(after, CHICKEN_MASALA_GRAVY, "weekdayLunch")).toBe(-1);
  });
});

describe("the replay (§3.1)", () => {
  const full = [...record, ...reconcileRecord];

  it("is byte-identical across two calls with the same inputs", () => {
    const args = {
      record: full,
      library,
      season: SEASON,
      cutoverWeek: CUTOVER,
      structuralDishIds: STRUCTURAL,
      weekStart: "2026-09-14",
    };
    expect(serialize(replayLedger(args))).toBe(serialize(replayLedger({ ...args })));
  });

  it("does not depend on the order the record weeks arrive in", () => {
    const args = {
      library,
      season: SEASON,
      cutoverWeek: CUTOVER,
      structuralDishIds: STRUCTURAL,
      weekStart: "2026-09-14",
    };
    expect(serialize(replayLedger({ ...args, record: full }))).toBe(
      serialize(replayLedger({ ...args, record: [...full].reverse() })),
    );
  });

  it("charges the placements the engine made and the swap-ins the household added", () => {
    const ledger = replayLedger({
      record: full,
      library,
      season: SEASON,
      cutoverWeek: CUTOVER,
      structuralDishIds: STRUCTURAL,
      weekStart: "2026-08-24",
    });
    // The week of 2026-08-17 placed fish tikka and the household swapped it for a
    // chicken gravy: one charge each, and no refund for the swap-away.
    const noWeek = replayLedger({
      record,
      library,
      season: SEASON,
      cutoverWeek: CUTOVER,
      structuralDishIds: STRUCTURAL,
      weekStart: "2026-08-24",
    });
    const fishDelta =
      (deficitIn(noWeek, FISH_TIKKA, "weekdayLunch") as number) -
      (deficitIn(ledger, FISH_TIKKA, "weekdayLunch") as number);
    expect(fishDelta).toBeCloseTo(1, 10);
    expect(deficitIn(ledger, CHICKEN_MASALA_GRAVY, "weekdayLunch")).toBeCloseTo(
      (deficitIn(noWeek, CHICKEN_MASALA_GRAVY, "weekdayLunch") as number) - 1,
      10,
    );
  });

  it("accrues only for a week with no record row", () => {
    // The record has no row for 2026-08-24, so that week must add exactly one week of
    // accrual and charge nothing.
    const base = {
      record: full,
      library,
      season: SEASON,
      cutoverWeek: CUTOVER,
      structuralDishIds: STRUCTURAL,
    };
    const throughGap = replayLedger({ ...base, weekStart: "2026-08-24" });
    const pastGap = replayLedger({ ...base, weekStart: "2026-08-31" });
    const statsBeforeGap = deriveRecordStats(
      full.filter((week) => week.weekStart < "2026-08-24"),
      library,
      SEASON,
    );
    const expected = accrue(throughGap, statsBeforeGap, ELIGIBLE, PLANNED_OCCASIONS);
    expect(serialize(pastGap)).toBe(serialize(expected));
  });

  it("stops before the generating week, leaving its accrual to the caller", () => {
    const base = {
      record,
      library,
      season: SEASON,
      cutoverWeek: CUTOVER,
      structuralDishIds: STRUCTURAL,
    };
    // With no record week at or after the cutover, replaying up to the cutover week
    // itself is exactly the seed.
    const atCutover = replayLedger({ ...base, weekStart: CUTOVER });
    const seeded = seedLedger(stats, CUTOVER, STRUCTURAL, 1, series);
    expect(serialize(atCutover)).toBe(serialize(seeded));
  });

  it("holds rates at the cutover record under the frozenRates variant", () => {
    const base = {
      record: full,
      library,
      season: SEASON,
      cutoverWeek: CUTOVER,
      structuralDishIds: STRUCTURAL,
      weekStart: "2026-09-14",
    };
    const frozen = replayLedger({ ...base, variant: { frozenRates: true } });
    const live = replayLedger(base);
    expect(serialize(frozen)).not.toBe(serialize(live));
    // Frozen rates never see the swap-ins of the weeks after cutover, so a dish the
    // household added after cutover accrues in the live run and not in the frozen one.
    expect(deficitIn(frozen, CHICKEN_MASALA_GRAVY, "weekdayLunch")).toBeLessThan(
      deficitIn(live, CHICKEN_MASALA_GRAVY, "weekdayLunch") as number,
    );
  });

  it("honours the coldStartCap variant", () => {
    const base = {
      record,
      library,
      season: SEASON,
      cutoverWeek: CUTOVER,
      structuralDishIds: STRUCTURAL,
      weekStart: CUTOVER,
    };
    expect(deficitIn(replayLedger(base), MANGO, "fruit")).toBe(1);
    expect(deficitIn(replayLedger({ ...base, variant: { coldStartCap: 2 } }), MANGO, "fruit")).toBe(
      (rateIn(stats, MANGO, "fruit") as number) * 5,
    );
    expect(deficitIn(replayLedger({ ...base, variant: { coldStartCap: 0 } }), MANGO, "fruit")).toBe(
      0,
    );
  });

  it("honours the seedOptionalPools variant", () => {
    const base = {
      record,
      library,
      season: SEASON,
      cutoverWeek: CUTOVER,
      structuralDishIds: STRUCTURAL,
      weekStart: CUTOVER,
    };
    expect(deficitIn(replayLedger(base), ONION_TOMATO_SALAD, "weekdayLunch")).toBe(0);
    expect(
      deficitIn(
        replayLedger({ ...base, variant: { seedOptionalPools: true } }),
        ONION_TOMATO_SALAD,
        "weekdayLunch",
      ),
    ).toBeGreaterThan(0);
  });

  it("honours the sinceFirstEaten rate variant", () => {
    const base = {
      record,
      library,
      season: SEASON,
      cutoverWeek: CUTOVER,
      structuralDishIds: STRUCTURAL,
      weekStart: "2026-08-24",
    };
    const specified = replayLedger(base);
    const variant = replayLedger({ ...base, variant: { rateFormula: "sinceFirstEaten" } });
    expect(serialize(specified)).not.toBe(serialize(variant));
    // Fish tikka's first weekday lunch is a week into the record, so the shorter
    // denominator raises its rate and therefore its accrual.
    expect(deficitIn(variant, FISH_TIKKA, "weekdayLunch")).toBeGreaterThan(
      deficitIn(specified, FISH_TIKKA, "weekdayLunch") as number,
    );
  });
});
