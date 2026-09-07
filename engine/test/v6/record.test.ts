/**
 * §2 record derivation, tested against the household's own eight served weeks.
 *
 * Every case here is a fixture that fails without the rule it guards, not a
 * restatement of the implementation: the occasion denominators, the scope split that
 * keeps Saturday out of the weekday pools, the "absent, not rate zero" rule, the
 * fruit season fallback, the occupation memory, and the swap-away list.
 *
 * Stream D owns `engine/test/v6/loadRecordFixture.ts`; until it exists the fixtures
 * are read here with `readFileSync` and a type assertion, as the stream brief says.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Dish } from "../../src/data/schemas.js";
import type { Pick, RecordWeek, Scope } from "../../src/v6/types.js";
import {
  deriveOccasionSeries,
  deriveRecordStats,
  eatenCountIn,
  presenceDaysOf,
  rateIn,
  frozenRatesStats,
  scopeOfPick,
  seasonOfWeek,
  weekdayLunchRolesOf,
} from "../../src/v6/record.js";
import { loadLiveData } from "../loadLive.js";

const fixturesDir = resolve(dirname(fileURLToPath(import.meta.url)), "fixtures");

function loadFixture(name: string): RecordWeek[] {
  return JSON.parse(readFileSync(resolve(fixturesDir, `${name}.json`), "utf8")) as RecordWeek[];
}

const library: Dish[] = loadLiveData().library;
const record = loadFixture("record-8weeks");
const reconcileRecord = loadFixture("record-reconcile");

function idOf(name: string): number {
  const dish = library.find((candidate) => candidate.name.toLowerCase() === name.toLowerCase());
  if (!dish) throw new Error(`no library dish named ${name}`);
  return dish.id;
}

const FISH_TIKKA = idOf("Fish tikka");
const SINGAPORE_NOODLES = idOf("Singapore noodles");
const MANGO = idOf("Mango bowl");
const ONION_TOMATO_SALAD = idOf("Onion tomato salad");
const ROTI = idOf("Roti");
const ALOO_MATAR = idOf("Aloo matar");
const GRILLED_CHICKEN = idOf("Grilled chicken breast");
const CUCUMBER_RAITA = idOf("Cucumber raita");
const KHICHDI = idOf("Khichdi");
const POHA = idOf("Poha");
const BOILED_EGGS = idOf("Boiled eggs");

/** The record's own totals, restated so an accidental fixture edit fails loudly. */
describe("the 8-week record fixture", () => {
  it("carries the sanity totals of features/as-eaten-8-weeks.md", () => {
    expect(record).toHaveLength(8);
    const days = record.reduce((sum, week) => sum + 6 - week.skippedDays.length, 0);
    expect(days).toBe(44);
    const picks = record.flatMap((week) => week.picks);
    const breakfastDays = new Set(
      picks.filter((pick) => pick.meal === "breakfast").map((pick) => pick.day),
    );
    expect(breakfastDays.has("Sat")).toBe(false);
    expect(picks.filter((pick) => pick.meal === "fruit")).toHaveLength(44);
    expect(
      picks.filter((pick) => pick.meal === "lunch" && pick.dishId === FISH_TIKKA),
    ).toHaveLength(7);
    expect(picks.filter((pick) => pick.dishId === MANGO)).toHaveLength(11);
    expect(record.every((week) => week.generatedPlan === null)).toBe(true);
    expect(record.map((week) => week.weekStart)).not.toContain("2026-07-27");
  });
});

describe("scopeOfPick", () => {
  it("splits Saturday lunch away from the weekday lunch scope", () => {
    expect(scopeOfPick({ day: "Tue", meal: "lunch", dishId: 1 })).toBe("weekdayLunch");
    expect(scopeOfPick({ day: "Sat", meal: "lunch", dishId: 1 })).toBe("saturday");
    expect(scopeOfPick({ day: "Fri", meal: "breakfast", dishId: 1 })).toBe("weekdayBreakfast");
    expect(scopeOfPick({ day: "Sat", meal: "fruit", dishId: 1 })).toBe("fruit");
  });

  it("gives a Saturday breakfast no scope, because the schedule has none", () => {
    expect(scopeOfPick({ day: "Sat", meal: "breakfast", dishId: 1 })).toBeNull();
  });
});

describe("occasions (§2.2)", () => {
  it("counts non-skipped days of the right kind, not weeks", () => {
    const stats = deriveRecordStats(record, library, "Monsoon");
    expect(stats.weeks).toBe(8);
    // 8 weeks x 5 weekdays, minus the 4 skipped weekdays (W1 Fri, W7 Mon and Tue, W8 Mon).
    expect(stats.occasions.weekdayBreakfast).toBe(36);
    expect(stats.occasions.weekdayLunch).toBe(36);
    expect(stats.occasions.saturday).toBe(8);
    expect(stats.occasions.fruit).toBe(44);
    expect(stats.seasonDayOccasions).toEqual({ Monsoon: 44 });
  });

  it("ignores a Saturday breakfast row entirely", () => {
    const week: RecordWeek = {
      weekStart: "2026-06-15",
      picks: [{ day: "Sat", meal: "breakfast", dishId: ROTI }],
      skippedDays: [],
      generatedPlan: null,
    };
    const stats = deriveRecordStats([week], library, "Monsoon");
    expect(stats.perDish.has(ROTI)).toBe(false);
  });

  it("sums the per-week occasion series back to the totals", () => {
    const stats = deriveRecordStats(record, library, "Monsoon");
    const series = deriveOccasionSeries(record, "Monsoon");
    expect(series).toHaveLength(8);
    for (const scope of ["weekdayBreakfast", "weekdayLunch", "saturday", "fruit"] as Scope[]) {
      const summed = series.reduce((sum, week) => sum + week.occasions[scope], 0);
      expect(summed).toBe(stats.occasions[scope]);
    }
  });
});

describe("rates are per occasion and per scope (§2.2)", () => {
  const stats = deriveRecordStats(record, library, "Monsoon");

  it("divides a dish's weekday-lunch rows by the weekday-lunch occasions", () => {
    // Fish tikka has 7 as-eaten lunch rows, but one of them is the Saturday of
    // 2026-07-06, which §2.2 scopes to Saturday. Six weekday rows over 36 weekday
    // lunch occasions; the Saturday row is one over eight Saturdays.
    expect(eatenCountIn(stats, FISH_TIKKA, "weekdayLunch")).toBe(6);
    expect(rateIn(stats, FISH_TIKKA, "weekdayLunch")).toBeCloseTo(6 / 36, 10);
    expect(eatenCountIn(stats, FISH_TIKKA, "saturday")).toBe(1);
    expect(rateIn(stats, FISH_TIKKA, "saturday")).toBeCloseTo(1 / 8, 10);
  });

  it("leaves a scope the dish never occupied absent, not present at rate zero", () => {
    // Singapore noodles is a weekday lunch twice and never a Saturday main, so it
    // must not compete for the Saturday treat at rate zero.
    const dish = stats.perDish.get(SINGAPORE_NOODLES);
    expect(dish).toBeDefined();
    expect(eatenCountIn(stats, SINGAPORE_NOODLES, "weekdayLunch")).toBe(2);
    expect(rateIn(stats, SINGAPORE_NOODLES, "saturday")).toBeUndefined();
    expect(Object.keys((dish as { rate: object }).rate)).toEqual(["weekdayLunch"]);
    expect(rateIn(stats, FISH_TIKKA, "weekdayBreakfast")).toBeUndefined();
  });

  it("never yields NaN for a present dish", () => {
    for (const [, dish] of stats.perDish) {
      for (const value of Object.values(dish.rate)) {
        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBeGreaterThan(0);
      }
    }
  });

  it("records the dish's most recent as-eaten week", () => {
    expect(stats.perDish.get(FISH_TIKKA)?.lastEatenWeek).toBe("2026-08-03");
    expect(stats.perDish.get(MANGO)?.lastEatenWeek).toBe("2026-08-03");
  });
});

describe("the fruit scope is season-scoped, with an all-season fallback (§2.2)", () => {
  const weekOf = (weekStart: string, picks: Pick[]): RecordWeek => ({
    weekStart,
    picks,
    skippedDays: [],
    generatedPlan: null,
  });
  // Two Summer weeks in which mango is the fruit every day, and two Monsoon weeks in
  // which it never is. The two seasons must therefore give mango two different rates,
  // and an unobserved Winter must give it the blend of both.
  const mixed: RecordWeek[] = [
    weekOf(
      "2026-04-06",
      (["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const).map((day) => ({
        day,
        meal: "fruit" as const,
        dishId: MANGO,
      })),
    ),
    weekOf(
      "2026-04-13",
      (["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const).map((day) => ({
        day,
        meal: "fruit" as const,
        dishId: MANGO,
      })),
    ),
    weekOf("2026-06-01", [{ day: "Mon", meal: "fruit", dishId: idOf("Banana bowl") }]),
    weekOf("2026-06-08", [{ day: "Mon", meal: "fruit", dishId: idOf("Banana bowl") }]),
  ];

  it("measures a fruit against its own season's day occasions", () => {
    const summer = deriveRecordStats(mixed, library, "Summer");
    expect(summer.occasions.fruit).toBe(12);
    expect(rateIn(summer, MANGO, "fruit")).toBeCloseTo(12 / 12, 10);

    const monsoon = deriveRecordStats(mixed, library, "Monsoon");
    expect(monsoon.occasions.fruit).toBe(12);
    // Mango has no Monsoon row here, so it is absent from the Monsoon fruit pool.
    expect(rateIn(monsoon, MANGO, "fruit")).toBeUndefined();
  });

  it("falls back to the all-season rate when the season has no record occasions", () => {
    const winter = deriveRecordStats(mixed, library, "Winter");
    expect(winter.seasonDayOccasions.Winter).toBeUndefined();
    // All 24 day occasions of the record, and all 12 mango rows.
    expect(winter.occasions.fruit).toBe(24);
    expect(rateIn(winter, MANGO, "fruit")).toBeCloseTo(12 / 24, 10);
    // The fallback rate differs from the in-season rate: without the fallback the
    // Winter pool would collapse to id order at rate zero.
    expect(rateIn(winter, MANGO, "fruit")).not.toBeCloseTo(
      rateIn(deriveRecordStats(mixed, library, "Summer"), MANGO, "fruit") as number,
      10,
    );
  });

  it("keeps the per-season breakdown unscoped, whatever season is asked for", () => {
    const monsoon = deriveRecordStats(mixed, library, "Monsoon");
    expect(monsoon.perDish.get(MANGO)?.seasonCount).toEqual({ Summer: 12 });
  });

  it("reads a week's season off its Monday", () => {
    expect(seasonOfWeek("2026-04-06")).toBe("Summer");
    expect(seasonOfWeek("2026-06-15")).toBe("Monsoon");
    expect(seasonOfWeek("2026-11-30")).toBe("Winter");
  });
});

describe("the occupation memory (§6 step 5)", () => {
  const stats = deriveRecordStats(record, library, "Monsoon");

  it("holds the most recent week and the week count per (day, meal)", () => {
    // Mango was the Wednesday fruit in the weeks of 06-15, 06-22, 07-06 and 07-20.
    const occupation = stats.perDish.get(MANGO)?.occupations.get("Wed:fruit");
    expect(occupation).toEqual({ lastWeek: "2026-07-20", count: 4 });
  });

  it("has no key for a slot the dish never occupied", () => {
    expect(stats.perDish.get(SINGAPORE_NOODLES)?.occupations.has("Sat:lunch")).toBe(false);
  });
});

describe("swappedOut is exactly the plan-minus-eaten set", () => {
  it("lists the plan picks no as-eaten row matched", () => {
    const stats = deriveRecordStats(reconcileRecord, library, "Monsoon");
    expect(stats.swappedOut).toEqual([
      // 2026-08-17: fish tikka was planned and the household ate a gravy instead.
      { day: "Mon", meal: "lunch", dishId: FISH_TIKKA },
      // 2026-08-31: the whole Tuesday plate was planned and the day was skipped.
      { day: "Tue", meal: "breakfast", dishId: idOf("Boiled eggs") },
      { day: "Tue", meal: "lunch", dishId: ROTI },
      { day: "Tue", meal: "lunch", dishId: FISH_TIKKA },
      { day: "Tue", meal: "fruit", dishId: MANGO },
    ]);
  });

  it("does not call a dish the household moved to another weekday a swap-away", () => {
    // The week of 2026-09-07 has every plate moved between Monday and Wednesday and
    // nothing else changed. Matching on the exact (day, meal, dish) triple would
    // report eight swap-aways here and charge eight servings twice.
    const week = reconcileRecord.find((row) => row.weekStart === "2026-09-07") as RecordWeek;
    const stats = deriveRecordStats([week], library, "Monsoon");
    expect(stats.swappedOut).toEqual([]);
  });

  it("is empty for a record week that carries no plan", () => {
    expect(deriveRecordStats(record, library, "Monsoon").swappedOut).toEqual([]);
  });
});

describe("the sinceFirstEaten rate variant (§14 item 1)", () => {
  it("divides by the occasions from the dish's first as-eaten week onward", () => {
    // Fish tikka's first weekday lunch is the week of 2026-06-22, so the 4 weekday
    // occasions of 2026-06-15 (its Friday was skipped) leave the denominator: 6 rows
    // over 32 occasions instead of 36.
    const variant = deriveRecordStats(record, library, "Monsoon", {
      rateFormula: "sinceFirstEaten",
    });
    expect(rateIn(variant, FISH_TIKKA, "weekdayLunch")).toBeCloseTo(6 / 32, 10);
    const specified = deriveRecordStats(record, library, "Monsoon");
    expect(rateIn(specified, FISH_TIKKA, "weekdayLunch")).toBeCloseTo(6 / 36, 10);
  });
});

describe("determinism (§10)", () => {
  it("derives byte-identical statistics from the same record twice", () => {
    const shuffled = [...record].reverse();
    const a = deriveRecordStats(record, library, "Monsoon");
    const b = deriveRecordStats(shuffled, library, "Monsoon");
    const serialize = (stats: ReturnType<typeof deriveRecordStats>) =>
      JSON.stringify(
        [...stats.perDish].map(([dishId, dish]) => [
          dishId,
          dish.eatenCount,
          dish.rate,
          dish.lastEatenWeek,
          [...dish.occupations],
          dish.seasonCount,
        ]),
      );
    expect(serialize(a)).toBe(serialize(b));
    expect([...a.perDish.keys()]).toEqual([...a.perDish.keys()].sort((x, y) => x - y));
  });

  it("ignores a pick whose dish the library does not carry", () => {
    const week: RecordWeek = {
      weekStart: "2026-06-15",
      picks: [
        { day: "Mon", meal: "lunch", dishId: 999_999 },
        { day: "Mon", meal: "lunch", dishId: ONION_TOMATO_SALAD },
      ],
      skippedDays: [],
      generatedPlan: null,
    };
    const stats = deriveRecordStats([week], library, "Monsoon");
    expect([...stats.perDish.keys()]).toEqual([ONION_TOMATO_SALAD]);
  });
});

// ---------------------------------------------------------------------------
// §3.2 presence rates and §6 step 5's exploration weekday memory
// ---------------------------------------------------------------------------

describe("§3.2 presence rates", () => {
  /**
   * Two weekday lunches on Monday and Tuesday, one of them three items and one of
   * them two, and one Saturday of three items. The rates are what §3.2's presence
   * ledgers accrue against, so they are asserted as exact fractions of the scope's
   * occasions and not as a shape.
   */
  const week = (weekStart: string, picks: Pick[]): RecordWeek => ({
    weekStart,
    picks,
    skippedDays: ["Wed", "Thu", "Fri"],
    generatedPlan: null,
  });

  it("counts a lunch of three or more picks as carrying the optional element", () => {
    const stats = deriveRecordStats(
      [
        week("2026-06-01", [
          { day: "Mon", meal: "lunch", dishId: FISH_TIKKA },
          { day: "Mon", meal: "lunch", dishId: ROTI },
          { day: "Mon", meal: "lunch", dishId: ONION_TOMATO_SALAD },
          { day: "Tue", meal: "lunch", dishId: FISH_TIKKA },
          { day: "Tue", meal: "lunch", dishId: ROTI },
          { day: "Sat", meal: "lunch", dishId: FISH_TIKKA },
          { day: "Sat", meal: "lunch", dishId: ROTI },
          { day: "Sat", meal: "lunch", dishId: ONION_TOMATO_SALAD },
        ]),
      ],
      library,
      "Summer",
    );
    expect(stats.occasions.weekdayLunch).toBe(2);
    expect(stats.occasions.saturday).toBe(1);
    expect(stats.presenceRate.weekdayLunch).toBeCloseTo(0.5, 10);
    expect(stats.presenceRate.saturday).toBeCloseTo(1, 10);
  });

  it("does not give the breakfast small item a presence rate: it stays on the dish rule", () => {
    const stats = deriveRecordStats([...record], library, "Monsoon");
    expect(stats.presenceRate.weekdayBreakfast).toBeUndefined();
    expect(stats.presenceRate.fruit).toBeUndefined();
    expect(stats.presenceRate.weekdayLunch).toBeGreaterThan(0);
    expect(stats.presenceRate.saturday).toBeGreaterThan(0);
  });

  it("excludes a skipped day from both sides of the rate", () => {
    const stats = deriveRecordStats(
      [
        {
          weekStart: "2026-06-01",
          picks: [
            { day: "Mon", meal: "lunch", dishId: FISH_TIKKA },
            { day: "Mon", meal: "lunch", dishId: ROTI },
            { day: "Mon", meal: "lunch", dishId: ONION_TOMATO_SALAD },
          ],
          skippedDays: ["Mon", "Tue", "Wed", "Thu", "Sat"],
          generatedPlan: null,
        },
      ],
      library,
      "Summer",
    );
    expect(stats.occasions.weekdayLunch).toBe(1);
    expect(stats.presenceRate.weekdayLunch).toBe(0);
  });
});

/**
 * §3.2's presence classification, the adversarial cases.
 *
 * The record carries picks and not roles, so the classification has to read the
 * optional companion off the plate. Each case here is a plate the plate-size
 * reading gets wrong, and the number the ledger accrues against would be wrong by
 * exactly that much.
 */
describe("§3.2 presence, the weekday companion classification", () => {
  const weekOf = (picks: Pick[]): RecordWeek[] => [
    {
      weekStart: "2026-06-01",
      picks,
      skippedDays: ["Tue", "Wed", "Thu", "Fri"],
      generatedPlan: null,
    },
  ];
  const rateOf = (picks: Pick[]): number =>
    deriveRecordStats(weekOf(picks), library, "Summer").presenceRate.weekdayLunch ?? -1;

  it("reads a §5.1 protein-floor append as a floor item, not as presence", () => {
    // Monday: a meatless breakfast, a meatless gravy star, a carb, and a plain
    // protein. That is exactly the plate the day-scoped floor produces, and the
    // slot was never asked for a companion.
    expect(
      rateOf([
        { day: "Mon", meal: "breakfast", dishId: POHA },
        { day: "Mon", meal: "lunch", dishId: ALOO_MATAR },
        { day: "Mon", meal: "lunch", dishId: ROTI },
        { day: "Mon", meal: "lunch", dishId: GRILLED_CHICKEN },
      ]),
    ).toBe(0);
  });

  it("counts a raita on the same plate as presence", () => {
    expect(
      rateOf([
        { day: "Mon", meal: "breakfast", dishId: POHA },
        { day: "Mon", meal: "lunch", dishId: ALOO_MATAR },
        { day: "Mon", meal: "lunch", dishId: ROTI },
        { day: "Mon", meal: "lunch", dishId: CUCUMBER_RAITA },
      ]),
    ).toBe(1);
  });

  it("counts the companion on a four-item plate the floor appended to", () => {
    // Star, carb, raita, and then the floor: the plate carried a companion and a
    // floor append, and subtracting the append still leaves the companion.
    expect(
      rateOf([
        { day: "Mon", meal: "breakfast", dishId: POHA },
        { day: "Mon", meal: "lunch", dishId: ALOO_MATAR },
        { day: "Mon", meal: "lunch", dishId: ROTI },
        { day: "Mon", meal: "lunch", dishId: CUCUMBER_RAITA },
        { day: "Mon", meal: "lunch", dishId: GRILLED_CHICKEN },
      ]),
    ).toBe(1);
  });

  it("does not read a dry-protein star beside a companion as a floor day", () => {
    // Fish tikka leads, the day carries no other protein, and the plate still has
    // a salad on it. Reading the star as the floor append would lose that salad,
    // which is the failure the "what is left must still be a plate" clause blocks.
    expect(
      rateOf([
        { day: "Mon", meal: "breakfast", dishId: POHA },
        { day: "Mon", meal: "lunch", dishId: FISH_TIKKA },
        { day: "Mon", meal: "lunch", dishId: ROTI },
        { day: "Mon", meal: "lunch", dishId: ONION_TOMATO_SALAD },
      ]),
    ).toBe(1);
  });

  it("counts a complete plate's companion, which is only two picks", () => {
    // §5.1: a true complete plate stays solo or takes one Accompaniment companion.
    // Plate size cannot see that companion; the structural reading can.
    expect(
      rateOf([
        { day: "Mon", meal: "lunch", dishId: KHICHDI },
        { day: "Mon", meal: "lunch", dishId: ONION_TOMATO_SALAD },
      ]),
    ).toBe(1);
    expect(rateOf([{ day: "Mon", meal: "lunch", dishId: KHICHDI }])).toBe(0);
  });

  it("reads the dry protein beside a carb-forward international main as its partner", () => {
    // §5.1 gives that register exactly one plain protein and nothing else, so the
    // plate carried no companion even though the breakfast makes it no floor day.
    expect(
      rateOf([
        { day: "Mon", meal: "breakfast", dishId: BOILED_EGGS },
        { day: "Mon", meal: "lunch", dishId: SINGAPORE_NOODLES },
        { day: "Mon", meal: "lunch", dishId: FISH_TIKKA },
      ]),
    ).toBe(0);
  });

  it("classifies a plate the same way whichever order its picks arrive in (§10)", () => {
    const picks: Pick[] = [
      { day: "Mon", meal: "breakfast", dishId: POHA },
      { day: "Mon", meal: "lunch", dishId: ALOO_MATAR },
      { day: "Mon", meal: "lunch", dishId: ROTI },
      { day: "Mon", meal: "lunch", dishId: GRILLED_CHICKEN },
    ];
    expect(rateOf([...picks].reverse())).toBe(rateOf(picks));
    expect([...presenceDaysOf(picks, "weekdayLunch", [...library].reverse())]).toEqual([
      ...presenceDaysOf(picks, "weekdayLunch", library),
    ]);
  });
});

/**
 * The same plate reading, named role by role. §3.2's presence rate is one line over
 * it, so a wrong lead here would move threshold 11 and the companion ledger with it.
 */
describe("§5.1 roles, read off a record plate", () => {
  const dishOf = (id: number): Dish => {
    const dish = library.find((candidate) => candidate.id === id);
    if (!dish) throw new Error(`no library dish with id ${id}`);
    return dish;
  };
  const rolesOf = (lunch: number[], breakfast: number[] = []): string[] =>
    weekdayLunchRolesOf(lunch.map(dishOf), breakfast.map(dishOf));

  it("gives the star to the gravy and the companion to the dry protein beside it", () => {
    // The household's own record: fish tikka takes 5 of its 6 weekday-lunch rows
    // beside a dal or a gravy and leads none of them. §5.1's protein floor and its
    // carb-forward partner both make a plain protein the thing beside the main.
    expect(rolesOf([FISH_TIKKA, ALOO_MATAR, ROTI], [BOILED_EGGS])).toEqual([
      "companion",
      "star",
      "carb",
    ]);
  });

  it("gives the star to the dry protein when nothing more substantial is there", () => {
    expect(rolesOf([FISH_TIKKA, ROTI], [BOILED_EGGS])).toEqual(["star", "carb"]);
  });

  it("gives the star to a self-sufficient main over a gravy", () => {
    // §5.1: a true complete plate carries the meal, so the gravy beside it is what
    // accompanies it.
    expect(rolesOf([KHICHDI, ALOO_MATAR])).toEqual(["star", "companion"]);
  });

  it("reads the plain protein beside a carb-forward international main as its partner", () => {
    expect(rolesOf([SINGAPORE_NOODLES, FISH_TIKKA], [BOILED_EGGS])).toEqual(["star", "partner"]);
  });

  it("takes the protein-floor append off before anything else", () => {
    expect(rolesOf([ALOO_MATAR, ROTI, GRILLED_CHICKEN], [POHA])).toEqual(["star", "carb", "floor"]);
  });

  it("still spends one structural position on a plate with no star-eligible pick", () => {
    // Degenerate, but it is what keeps this reading and §3.2's presence rate one
    // quantity: a carb and an accompaniment is a plate with no companion.
    const roles = rolesOf([ROTI, ONION_TOMATO_SALAD]);
    expect(roles).toContain("star");
    expect(roles).not.toContain("companion");
  });

  it("is order-independent, so the record's pick order never leaks in (§10)", () => {
    const plate = [FISH_TIKKA, ALOO_MATAR, ROTI];
    expect([...rolesOf([...plate].reverse())].reverse()).toEqual(rolesOf(plate));
  });

  it("agrees with §3.2's presence rate on every plate, because it is one reading", () => {
    for (const plate of [
      [ALOO_MATAR, ROTI, CUCUMBER_RAITA],
      [ALOO_MATAR, ROTI, GRILLED_CHICKEN],
      [KHICHDI, ONION_TOMATO_SALAD],
      [KHICHDI],
      [SINGAPORE_NOODLES, FISH_TIKKA],
      [ROTI, ONION_TOMATO_SALAD],
    ]) {
      const picks: Pick[] = [
        { day: "Mon", meal: "breakfast", dishId: POHA },
        ...plate.map((dishId) => ({ day: "Mon" as const, meal: "lunch" as const, dishId })),
      ];
      const days = presenceDaysOf(picks, "weekdayLunch", library);
      expect(rolesOf(plate, [POHA]).includes("companion")).toBe(days.has("Mon"));
    }
  });
});

describe("§6 step 5, the exploration slot's weekday memory", () => {
  const plannedWeek = (weekStart: string, plan: Pick[], eaten: Pick[] = plan): RecordWeek => ({
    weekStart,
    picks: eaten,
    skippedDays: [],
    generatedPlan: plan,
  });

  it("reads a never-before-eaten weekday lunch plan pick as an exploration placement", () => {
    const stats = deriveRecordStats(
      [
        plannedWeek("2026-06-01", [
          { day: "Mon", meal: "lunch", dishId: FISH_TIKKA },
          { day: "Fri", meal: "lunch", dishId: SINGAPORE_NOODLES },
        ]),
        // Week two repeats both dishes: neither is novel any more, so the memory
        // must still say Friday, not update to whatever week two placed.
        plannedWeek("2026-06-08", [
          { day: "Tue", meal: "lunch", dishId: SINGAPORE_NOODLES },
          { day: "Wed", meal: "lunch", dishId: FISH_TIKKA },
        ]),
      ],
      library,
      "Summer",
    );
    expect([...stats.explorationWeekdays.entries()]).toEqual([
      ["Mon", "2026-06-01"],
      ["Fri", "2026-06-01"],
    ]);
  });

  it("ignores a never-eaten fruit, which enters through §9's overflow door and not §7", () => {
    const stats = deriveRecordStats(
      [
        plannedWeek("2026-06-01", [
          { day: "Mon", meal: "fruit", dishId: MANGO },
          { day: "Tue", meal: "lunch", dishId: FISH_TIKKA },
        ]),
      ],
      library,
      "Summer",
    );
    expect([...stats.explorationWeekdays.keys()]).toEqual(["Tue"]);
  });

  it("ignores a Saturday lunch pick: §7 puts the slot on a weekday", () => {
    const stats = deriveRecordStats(
      [plannedWeek("2026-06-01", [{ day: "Sat", meal: "lunch", dishId: FISH_TIKKA }])],
      library,
      "Summer",
    );
    expect(stats.explorationWeekdays.size).toBe(0);
  });

  it("keys the memory Monday-first, so two derivations serialize identically (§10)", () => {
    const weeks = [
      plannedWeek("2026-06-01", [{ day: "Fri", meal: "lunch", dishId: SINGAPORE_NOODLES }]),
      plannedWeek("2026-06-08", [{ day: "Mon", meal: "lunch", dishId: FISH_TIKKA }]),
    ];
    const forward = deriveRecordStats(weeks, library, "Summer");
    const reversed = deriveRecordStats([...weeks].reverse(), library, "Summer");
    expect([...forward.explorationWeekdays.keys()]).toEqual(["Mon", "Fri"]);
    expect(JSON.stringify([...reversed.explorationWeekdays])).toBe(
      JSON.stringify([...forward.explorationWeekdays]),
    );
  });
});

/**
 * §11's frozen run, built. The invariant these fixtures guard is the one the run
 * exists for and the one it broke: it must freeze every rate at the cutover record,
 * and it must **not** freeze the memories §6 step 5 places by, because a frozen
 * least-recently-used memory resolves the same day every week of the horizon and
 * reports that as a slot lock.
 *
 * So each fixture below is a record whose post-cutover weeks move a memory, and the
 * assertion is that the merged stats moved with it while the rates did not.
 */
describe("§11's frozen run: rates frozen, memories live", () => {
  const week = (weekStart: string, picks: Pick[], plan: Pick[] | null = null): RecordWeek => ({
    weekStart,
    picks,
    skippedDays: [],
    generatedPlan: plan,
  });

  /** Two weeks before cutover, two after. The two halves place the same dishes on different days. */
  const before = [
    week("2026-06-01", [
      { day: "Mon", meal: "lunch", dishId: ALOO_MATAR },
      { day: "Mon", meal: "lunch", dishId: ROTI },
      { day: "Mon", meal: "lunch", dishId: CUCUMBER_RAITA },
    ]),
    week("2026-06-08", [
      { day: "Mon", meal: "lunch", dishId: ALOO_MATAR },
      { day: "Mon", meal: "lunch", dishId: ROTI },
    ]),
  ];
  const after = [
    ...before,
    week(
      "2026-06-15",
      [
        { day: "Thu", meal: "lunch", dishId: ALOO_MATAR },
        { day: "Thu", meal: "lunch", dishId: ROTI },
      ],
      [
        { day: "Thu", meal: "lunch", dishId: ALOO_MATAR },
        { day: "Thu", meal: "lunch", dishId: ROTI },
      ],
    ),
    // Singapore noodles has no as-eaten row in either earlier week, so this is an
    // exploration placement and it moves the exploration slot's weekday memory.
    week(
      "2026-06-22",
      [
        { day: "Fri", meal: "lunch", dishId: SINGAPORE_NOODLES },
        { day: "Fri", meal: "lunch", dishId: FISH_TIKKA },
      ],
      [
        { day: "Fri", meal: "lunch", dishId: SINGAPORE_NOODLES },
        { day: "Fri", meal: "lunch", dishId: FISH_TIKKA },
      ],
    ),
  ];

  const frozen = deriveRecordStats(before, library, "Summer");
  const live = deriveRecordStats(after, library, "Summer");
  const merged = frozenRatesStats(frozen, live);

  it("freezes the rates, the eaten counts, and the occasions they are computed from", () => {
    expect(merged.weeks).toBe(frozen.weeks);
    expect(merged.occasions).toEqual(frozen.occasions);
    expect(rateIn(merged, ALOO_MATAR, "weekdayLunch")).toBe(
      rateIn(frozen, ALOO_MATAR, "weekdayLunch"),
    );
    expect(eatenCountIn(merged, ALOO_MATAR, "weekdayLunch")).toBe(2);
    // The live record has three rows for it, so a merge that leaked the live rate
    // would fail here and the frozen run would be measuring the self-feed.
    expect(eatenCountIn(live, ALOO_MATAR, "weekdayLunch")).toBe(3);
    expect(rateIn(merged, ALOO_MATAR, "weekdayLunch")).not.toBe(
      rateIn(live, ALOO_MATAR, "weekdayLunch"),
    );
  });

  it("does not freeze the occupation memory §6 step 5 places by", () => {
    // The Thursday of week three: frozen, the memory is Monday alone forever, and
    // that is the shape that reported a banana bowl locked to Monday 23 of 41 weeks.
    expect([...(frozen.perDish.get(ALOO_MATAR)?.occupations.keys() ?? [])]).toEqual(["Mon:lunch"]);
    expect([...(merged.perDish.get(ALOO_MATAR)?.occupations.keys() ?? [])]).toEqual([
      "Mon:lunch",
      "Thu:lunch",
    ]);
    expect(merged.perDish.get(ALOO_MATAR)?.occupations.get("Mon:lunch")?.count).toBe(2);
  });

  it("does not freeze the exploration slot's own weekday memory", () => {
    expect([...frozen.explorationWeekdays.keys()]).toEqual([]);
    expect([...merged.explorationWeekdays.entries()]).toEqual([
      ...live.explorationWeekdays.entries(),
    ]);
    expect(merged.explorationWeekdays.get("Fri")).toBe("2026-06-22");
  });

  it("freezes §3.2's presence rates, because presence is a rate", () => {
    // The adversarial half: the two records genuinely disagree here, so a merge
    // that leaked the live presence rate through would let the engine's own output
    // move the bar §11 threshold 11 measures it against.
    expect(live.presenceRate.weekdayLunch).not.toBe(frozen.presenceRate.weekdayLunch);
    expect(merged.presenceRate).toEqual(frozen.presenceRate);
    expect(merged.presenceRate.weekdayLunch).toBe(frozen.presenceRate.weekdayLunch);
    expect(merged.presenceRate.weekdayLunch).not.toBe(live.presenceRate.weekdayLunch);
  });

  it("does not freeze the swap-away list", () => {
    expect(merged.swappedOut).toEqual(live.swappedOut);
  });

  it("gives a dish first eaten after cutover its memory but no rate", () => {
    // §2.2 reads an absent scope key as absence, not as rate zero, so freezing is
    // exactly this: the dish sits in no pool, and its occupation memory costs
    // nothing until something else puts it on a plate.
    const entry = merged.perDish.get(SINGAPORE_NOODLES);
    expect(entry).toBeDefined();
    expect(entry?.eatenCount).toEqual({});
    expect(rateIn(merged, SINGAPORE_NOODLES, "weekdayLunch")).toBeUndefined();
    expect([...(entry?.occupations.keys() ?? [])]).toEqual(["Fri:lunch"]);
  });

  it("is deterministic over the union of the two dish maps (§10)", () => {
    const again = frozenRatesStats(
      deriveRecordStats([...before].reverse(), library, "Summer"),
      deriveRecordStats([...after].reverse(), library, "Summer"),
    );
    expect([...again.perDish.keys()]).toEqual([...merged.perDish.keys()]);
    expect([...again.perDish.keys()]).toEqual([...again.perDish.keys()].sort((a, b) => a - b));
  });
});
