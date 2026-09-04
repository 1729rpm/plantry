/**
 * The §11 verification gate (`features/engine-v6.md` §11).
 *
 * The gate is part of the v6 spec, not a convenience: "a rule correct in
 * isolation can be wrong in interaction, and only a long self-feeding simulation
 * shows it". This harness runs the built engine self-feeding for 60 weeks from a
 * record fixture, measures every §11 threshold on weeks 20 to 60, and writes
 * `features/engine-v6-gate-report.md`.
 *
 * Three runs, per §11:
 *
 * - **Frozen.** Rates fixed at the cutover record for the whole horizon, so a
 *   family that fails here needs an engine fix rather than a drift fix.
 * - **Self-feeding.** The production path: every generated week becomes a record
 *   week with its `generatedPlan` set and its picks eaten, unedited.
 * - **Corrected.** The self-feeding run with the record's own swap-away list
 *   replayed, so §3's reconciliation branch executes at least once.
 *
 * Four measurement variants run alongside: the cold-start cap at 0.5 and at pool
 * level, the family governor off, and the §14 rate-formula variant.
 *
 * **The harness streams a line per simulated week.** A 60-week run is slow enough
 * that a silent process looks hung, and the agent watchdog kills a command that
 * says nothing for ten minutes.
 *
 * Everything here is measurement. It never writes to production, never touches
 * `data/`, and the report it writes is a working artifact, not a committed one.
 *
 * Usage: `npm run gate [record-fixture] [weeks]`, where the fixture is a bare
 * name under `engine/test/v6/fixtures` or a path to a `RecordWeek[]` JSON file
 * (which is what stream E1's `recordExport:exportRecord` produces from prod).
 */

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CatalogIngredient, Dish, Ingredient, Season } from "../src/data/schemas.js";
import {
  catalogToPackSizes,
  dishFilesToLibrary,
  parseIngredientCatalog,
} from "../src/data/parse.js";
import { loadDishFiles } from "./bake.js";
import { generateWeekV6 } from "../src/v6/generateWeekV6.js";
import { deriveRecordStats, seasonOfWeek } from "../src/v6/record.js";
import { addWeeks, isEligibleDish } from "../src/v6/ledger.js";
import { isLunchStar, isStandaloneEggMain } from "../src/v6/pools.js";
import { proteinFamily } from "../src/v6/compose.js";
import type {
  Day,
  GeneratedWeekV6,
  GenerateWeekV6Variant,
  Pick,
  PickRole,
  RecordWeek,
} from "../src/v6/types.js";
import { loadRecordFixture } from "../test/v6/loadRecordFixture.js";

// ---------------------------------------------------------------------------
// Shape of a simulation
// ---------------------------------------------------------------------------

const WEEKDAYS: readonly Day[] = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const ALL_DAYS: readonly Day[] = [...WEEKDAYS, "Sat"];

/** §11: the horizon is weeks 20 to 60, the steady state. The warm-up is not measured. */
export const HORIZON_FROM = 20;
export const DEFAULT_WEEKS = 60;

export interface GateData {
  library: Dish[];
  ingredients: Ingredient[];
  catalog: CatalogIngredient[];
}

export interface SimulateArgs {
  data: GateData;
  /** The seed record: the household's served weeks. */
  record: RecordWeek[];
  weeks: number;
  variant?: GenerateWeekV6Variant;
  /**
   * The corrected run's swap-away dish ids (§11): every dish the household
   * removed after generation in the served weeks. A generated week that proposes
   * one of these has that pick removed from its **eaten** picks; the plan keeps
   * it, which is exactly the §3 no-refund case.
   */
  swapAway?: ReadonlySet<number>;
  /** Called once per simulated week so a long run is never silent. */
  onWeek?: (index: number, weekStart: string, week: GeneratedWeekV6) => void;
}

export interface SimulatedWeek {
  /** 1-based index within the run. */
  index: number;
  weekStart: string;
  season: Season;
  week: GeneratedWeekV6;
  /** The picks the household is modelled as having eaten (the plan, minus swap-aways). */
  eaten: Pick[];
}

/**
 * Run the engine self-feeding for `weeks` weeks from the seed record.
 *
 * Each generated week becomes a record week: its `generatedPlan` is what the
 * engine placed and its `picks` are what the household ate, which in the frozen
 * and self-feeding runs is the same list and in the corrected run is that list
 * minus the household's swap-aways.
 */
export function simulate(args: SimulateArgs): SimulatedWeek[] {
  const { data, weeks, variant, swapAway, onWeek } = args;
  const seed = [...args.record].sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1));
  const first =
    seed.length > 0 ? addWeeks(seed[seed.length - 1].weekStart, 1) : addWeeks("2026-01-05", 0);

  const record: RecordWeek[] = [...seed];
  const out: SimulatedWeek[] = [];
  for (let index = 0; index < weeks; index += 1) {
    const weekStart = addWeeks(first, index);
    const season = seasonOfWeek(weekStart);
    const week = generateWeekV6({
      weekStart,
      season,
      library: data.library,
      record,
      favoriteDishIds: [],
      variant,
      nutrition: { ingredients: data.ingredients, catalog: data.catalog },
    });
    const eaten =
      swapAway && swapAway.size > 0
        ? week.generatedPlan.filter((pick) => !swapAway.has(pick.dishId))
        : week.generatedPlan;
    record.push({
      weekStart,
      picks: eaten,
      skippedDays: [],
      generatedPlan: week.generatedPlan,
    });
    out.push({ index: index + 1, weekStart, season, week, eaten });
    onWeek?.(index + 1, weekStart, week);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Families (§11 threshold 1), keyed on library fields and never on dish names
// ---------------------------------------------------------------------------

export const FAMILIES = [
  "chicken",
  "paneer",
  "egg",
  "fish",
  "prawn",
  "mutton",
  "dal-family",
  "international",
  "plain roti",
  "specialty roti",
  "salad",
  "raita/curd",
] as const;
export type FamilyKey = (typeof FAMILIES)[number];

/**
 * The pulses that make a star a dal-family lunch (§5.1: dal, kadhi, chole, rajma,
 * sambar). The star test is what keeps missi roti (a Chapati) and hummus (an
 * Accompaniment) out, both of which share a pulse primary ingredient.
 */
const PULSES = new Set([
  "Toor Dal",
  "Moong Dal",
  "Masoor Dal",
  "Chana Dal",
  "Black Urad",
  "Kidney Bean",
  "Chickpea",
  "Sprout",
]);

/** The animal proteins §11 threshold 13 counts a weekday lunch as carrying. */
const ANIMAL_PRIMARIES = new Set([
  "Chicken",
  "Chicken Breast",
  "Chicken Keema",
  "Fish",
  "Prawn",
  "Mutton",
  "Egg",
]);

/** Every tracked family a dish belongs to. A dish may belong to more than one. */
export function familiesOf(dish: Dish): FamilyKey[] {
  const out: FamilyKey[] = [];
  const primary = dish.primaryIngredient;
  if (proteinFamily(primary) === "Chicken") out.push("chicken");
  if (primary === "Paneer") out.push("paneer");
  if (primary === "Egg") out.push("egg");
  if (primary === "Fish") out.push("fish");
  if (primary === "Prawn") out.push("prawn");
  if (primary === "Mutton") out.push("mutton");
  if (PULSES.has(primary) && isLunchStar(dish)) out.push("dal-family");
  if (dish.cuisine !== "Indian") out.push("international");
  if (dish.category === "Chapati") {
    out.push(primary === "Wheat Flour" ? "plain roti" : "specialty roti");
  }
  if (dish.category === "Accompaniment" && dish.time === "Lunch") {
    out.push(primary === "Curd" ? "raita/curd" : "salad");
  }
  return out;
}

/** One week reduced to what the thresholds read. */
interface WeekView {
  index: number;
  weekStart: string;
  season: Season;
  /** Every breakfast and lunch pick, in day and pick order. */
  meals: Array<{ day: Day; meal: "breakfast" | "lunch"; dishes: Dish[] }>;
  fruits: Array<{ day: Day; dish: Dish }>;
  week: GeneratedWeekV6;
}

function viewOf(simulated: SimulatedWeek, dishById: ReadonlyMap<number, Dish>): WeekView {
  const meals: WeekView["meals"] = [];
  const fruits: WeekView["fruits"] = [];
  for (const day of simulated.week.days) {
    for (const slot of day.slots) {
      meals.push({
        day: day.day as Day,
        meal: slot.meal === "Breakfast" ? "breakfast" : "lunch",
        dishes: slot.dishes,
      });
    }
    if (day.fruit) fruits.push({ day: day.day as Day, dish: day.fruit });
  }
  void dishById;
  return {
    index: simulated.index,
    weekStart: simulated.weekStart,
    season: simulated.season,
    meals,
    fruits,
    week: simulated.week,
  };
}

// ---------------------------------------------------------------------------
// Measurement helpers
// ---------------------------------------------------------------------------

/**
 * Family rates per occasion, the one comparison §11 makes ("every rate is
 * compared per occasion served against per occasion eaten").
 *
 * The denominator is every non-skipped breakfast, lunch and Saturday occasion in
 * the weeks measured (eleven in a full week); the fruit scope is left out because
 * no tracked family is a fruit. The same function measures the record and the
 * simulation, which is what makes the two numbers comparable.
 */
function familyRates(
  weeks: ReadonlyArray<{ picks: readonly Pick[]; skippedDays: readonly Day[] }>,
  dishById: ReadonlyMap<number, Dish>,
): { rates: Map<FamilyKey, number>; occasions: number } {
  let occasions = 0;
  const counts = new Map<FamilyKey, number>();
  for (const week of weeks) {
    const skipped = new Set<Day>(week.skippedDays);
    const weekdays = WEEKDAYS.filter((day) => !skipped.has(day)).length;
    occasions += weekdays * 2 + (skipped.has("Sat") ? 0 : 1);
    for (const pick of week.picks) {
      if (pick.meal === "fruit") continue;
      if (skipped.has(pick.day)) continue;
      const dish = dishById.get(pick.dishId);
      if (!dish) continue;
      for (const family of familiesOf(dish)) counts.set(family, (counts.get(family) ?? 0) + 1);
    }
  }
  const rates = new Map<FamilyKey, number>();
  for (const family of FAMILIES) {
    rates.set(family, occasions > 0 ? (counts.get(family) ?? 0) / occasions : 0);
  }
  return { rates, occasions };
}

/** Week-over-week dish-set Jaccard, averaged: |A n B| / |A u B| over consecutive weeks. */
function averageJaccard(weeks: ReadonlyArray<ReadonlySet<number>>): number {
  if (weeks.length < 2) return 0;
  let total = 0;
  for (let index = 0; index + 1 < weeks.length; index += 1) {
    const a = weeks[index];
    const b = weeks[index + 1];
    let shared = 0;
    for (const id of a) if (b.has(id)) shared += 1;
    const union = a.size + b.size - shared;
    total += union > 0 ? shared / union : 0;
  }
  return total / (weeks.length - 1);
}

function percentDelta(served: number, reference: number): number {
  if (reference === 0) return served === 0 ? 0 : Number.POSITIVE_INFINITY;
  return ((served - reference) / reference) * 100;
}

function fmt(value: number, digits = 3): string {
  if (!Number.isFinite(value)) return "n/a";
  return value.toFixed(digits);
}

function signed(value: number): string {
  if (!Number.isFinite(value)) return "n/a";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

// ---------------------------------------------------------------------------
// The thresholds
// ---------------------------------------------------------------------------

export interface ThresholdResult {
  id: number;
  name: string;
  /** null for a threshold this run cannot measure (too short a horizon, say). */
  pass: boolean | null;
  lines: string[];
  /** One line naming the cause, present only when the threshold failed. */
  diagnosis?: string;
  /**
   * The threshold reduced to one comparable number, so a caller (the CI-sized
   * gate test) can guard against a collapse rather than only against a flipped
   * boolean. `worseWhen` says which direction is worse.
   */
  metric?: { value: number; bound: number; worseWhen: "above" | "below" };
}

export interface RunReport {
  label: string;
  weeks: number;
  thresholds: ThresholdResult[];
  /** §11 threshold 13: reported, never gated. */
  reported: string[];
}

export interface MeasureArgs {
  label: string;
  data: GateData;
  /** The seed record the run started from, for the record-side baselines. */
  seed: RecordWeek[];
  simulated: SimulatedWeek[];
}

export function measureRun(args: MeasureArgs): RunReport {
  const { label, data, seed, simulated } = args;
  const dishById = new Map<number, Dish>();
  for (const dish of data.library) dishById.set(dish.id, dish);

  const views = simulated.map((entry) => viewOf(entry, dishById));
  const horizon = views.filter((view) => view.index >= HORIZON_FROM);
  const horizonWeeks = horizon.length;
  const thresholds: ThresholdResult[] = [];
  const reported: string[] = [];

  const weekdayLunches = (view: WeekView) =>
    view.meals.filter((meal) => meal.meal === "lunch" && meal.day !== "Sat");
  const saturdayLunch = (view: WeekView) =>
    view.meals.find((meal) => meal.meal === "lunch" && meal.day === "Sat");
  const breakfasts = (view: WeekView) => view.meals.filter((meal) => meal.meal === "breakfast");

  // -- 1. Distribution fidelity ---------------------------------------------

  const recordRates = familyRates(seed, dishById).rates;
  const servedRates = familyRates(
    horizon.map((view) => ({
      picks: view.week.generatedPlan,
      skippedDays: [] as Day[],
    })),
    dishById,
  ).rates;

  {
    const lines: string[] = [];
    let failures = 0;
    let measured = 0;
    for (const family of FAMILIES) {
      const record = recordRates.get(family) ?? 0;
      const served = servedRates.get(family) ?? 0;
      if (record === 0) {
        lines.push(`${family}: no record rows, served ${fmt(served)} per occasion, not gated`);
        continue;
      }
      measured += 1;
      const delta = percentDelta(served, record);
      const ok = Math.abs(delta) <= 25;
      if (!ok) failures += 1;
      lines.push(
        `${family}: served ${fmt(served)} vs record ${fmt(record)} (${signed(delta)}) ${ok ? "PASS" : "FAIL"}`,
      );
    }
    thresholds.push({
      id: 1,
      name: "Distribution fidelity (within 25 percent of the record rate, per occasion)",
      pass: failures === 0,
      metric: { value: failures, bound: 0, worseWhen: "above" },
      lines: [`${measured - failures} of ${measured} tracked families inside the bar`, ...lines],
      diagnosis:
        failures > 0
          ? `${failures} tracked ${failures === 1 ? "family is" : "families are"} outside the 25 percent bar; the summed dish rates of those pools do not reproduce the record.`
          : undefined,
    });
  }

  // -- 2. Lunch-main uniqueness ---------------------------------------------

  {
    const mains = horizon.map((view) =>
      weekdayLunches(view)
        .map((meal) => meal.dishes[0]?.id)
        .filter((id): id is number => id !== undefined),
    );
    let worst = 1;
    let windows = 0;
    for (let start = 0; start + 8 <= mains.length; start += 1) {
      const window = mains.slice(start, start + 8).flat();
      if (window.length === 0) continue;
      windows += 1;
      const ratio = new Set(window).size / window.length;
      if (ratio < worst) worst = ratio;
    }
    const pass = windows === 0 ? null : worst >= 0.65;
    thresholds.push({
      id: 2,
      name: "Lunch-main uniqueness (65 percent distinct over any rolling 8 weeks)",
      pass,
      metric: { value: worst, bound: 0.65, worseWhen: "below" },
      lines: [
        windows === 0
          ? "horizon shorter than one 8-week window, not measurable"
          : `worst rolling window ${(worst * 100).toFixed(1)} percent distinct across ${windows} windows (household baseline 77)`,
      ],
      diagnosis:
        pass === false
          ? `Weekday lunch stars repeat inside an 8-week window: ${(worst * 100).toFixed(1)} percent distinct against a 65 percent floor.`
          : undefined,
    });
  }

  // -- 3. Overlap band -------------------------------------------------------

  {
    const baseline = averageJaccard(
      seed.map((week) => new Set(week.picks.map((pick) => pick.dishId))),
    );
    const served = averageJaccard(
      horizon.map((view) => new Set(view.week.generatedPlan.map((pick) => pick.dishId))),
    );
    const pass = Math.abs(served - baseline) <= 0.05;
    thresholds.push({
      id: 3,
      name: "Overlap band (week-over-week Jaccard within 0.05 of the record baseline)",
      pass,
      metric: { value: Math.abs(served - baseline), bound: 0.05, worseWhen: "above" },
      lines: [
        `served ${fmt(served)} against the record's own ${fmt(baseline)} by the same method, delta ${fmt(served - baseline)}`,
      ],
      diagnosis: !pass
        ? served > baseline
          ? `Consecutive weeks share more dishes than the household's own weeks do (${fmt(served)} against ${fmt(baseline)}): the rotation is tighter than the record.`
          : `Consecutive weeks share fewer dishes than the household's own weeks do (${fmt(served)} against ${fmt(baseline)}): the rotation is looser than the record.`
        : undefined,
    });
  }

  // -- 4. Slot anti-lock -----------------------------------------------------

  {
    const half = horizonWeeks / 2;
    const slotCounts = new Map<string, number>();
    const categoryCounts = new Map<string, number>();
    const scopeRows = new Map<string, number>();
    let weekdayOccasions = 0;
    let saturdayOccasions = 0;
    let fruitOccasions = 0;

    for (const view of horizon) {
      weekdayOccasions += 5;
      saturdayOccasions += 1;
      fruitOccasions += 6;
      const seenSlots = new Set<string>();
      const seenCategories = new Set<string>();
      for (const pick of view.week.generatedPlan) {
        const dish = dishById.get(pick.dishId);
        if (!dish) continue;
        const scope =
          pick.meal === "fruit"
            ? "fruit"
            : pick.day === "Sat"
              ? "saturday"
              : pick.meal === "breakfast"
                ? "weekdayBreakfast"
                : "weekdayLunch";
        scopeRows.set(`${dish.id}:${scope}`, (scopeRows.get(`${dish.id}:${scope}`) ?? 0) + 1);
        seenSlots.add(`${dish.id}|${pick.day}|${pick.meal}`);
        if (pick.day === "Sat") continue; // §11: Saturday's own scope is excepted here
        for (const label of ["international", "specialty roti"] as const) {
          if (familiesOf(dish).includes(label))
            seenCategories.add(`${label}|${pick.day}|${pick.meal}`);
        }
        if (dish.category === "Accompaniment" && dish.time === "Breakfast") {
          seenCategories.add(`chutney|${pick.day}|${pick.meal}`);
        }
      }
      for (const key of seenSlots) slotCounts.set(key, (slotCounts.get(key) ?? 0) + 1);
      for (const key of seenCategories) {
        categoryCounts.set(key, (categoryCounts.get(key) ?? 0) + 1);
      }
    }

    const occasionsOf = (scope: string): number =>
      scope === "saturday"
        ? saturdayOccasions
        : scope === "fruit"
          ? fruitOccasions
          : weekdayOccasions;

    const dishLocks: string[] = [];
    for (const [key, count] of slotCounts) {
      if (count <= half) continue;
      const [idText, day, meal] = key.split("|");
      const dish = dishById.get(Number(idText));
      if (!dish) continue;
      // §4 anchor 2: the Thursday egg is meant to hold that slot.
      if (
        day === "Thu" &&
        meal === "breakfast" &&
        proteinFamily(dish.primaryIngredient) === "Egg"
      ) {
        continue;
      }
      const scope =
        meal === "fruit"
          ? "fruit"
          : day === "Sat"
            ? "saturday"
            : meal === "breakfast"
              ? "weekdayBreakfast"
              : "weekdayLunch";
      // §11: a dish whose rate arithmetically forces majority occupancy is exempt.
      // Every scope's planned occasions equal its weekly slots, so "a rate above
      // half its role's weekly slots" reduces to a per-occasion rate above 0.5.
      const rate = (scopeRows.get(`${dish.id}:${scope}`) ?? 0) / Math.max(1, occasionsOf(scope));
      if (rate > 0.5) continue;
      dishLocks.push(`${dish.name} holds ${day} ${meal} in ${count} of ${horizonWeeks} weeks`);
    }

    const categoryLocks: string[] = [];
    let worstCategory = 0;
    for (const [key, count] of categoryCounts) {
      if (count > worstCategory) worstCategory = count;
      if (count <= half) continue;
      const [label, day, meal] = key.split("|");
      categoryLocks.push(
        `${label} is day-locked to ${day} ${meal} in ${count} of ${horizonWeeks} weeks`,
      );
    }

    const pass = dishLocks.length === 0 && categoryLocks.length === 0;
    thresholds.push({
      id: 4,
      name: "Slot anti-lock (no dish or category holds one weekday-meal slot in over half the horizon)",
      pass,
      metric: { value: dishLocks.length + categoryLocks.length, bound: 0, worseWhen: "above" },
      lines: pass
        ? [`no non-exempt dish lock; worst category run ${worstCategory} of ${horizonWeeks} weeks`]
        : [...dishLocks, ...categoryLocks],
      diagnosis: !pass
        ? `${dishLocks.length} dish and ${categoryLocks.length} category slot locks: least-recently-used day assignment is not moving these picks off their weekday.`
        : undefined,
    });
  }

  // -- 5. Saturday -----------------------------------------------------------

  {
    const finalRecord: RecordWeek[] = [
      ...seed,
      ...simulated.map((entry) => ({
        weekStart: entry.weekStart,
        picks: entry.eaten,
        skippedDays: [] as Day[],
        generatedPlan: entry.week.generatedPlan,
      })),
    ];
    const finalSeason = simulated.length > 0 ? simulated[simulated.length - 1].season : "Monsoon";
    const finalStats = deriveRecordStats(finalRecord, data.library, finalSeason);
    let treatPoolSize = 0;
    for (const [dishId, dishStats] of finalStats.perDish) {
      const dish = dishById.get(dishId);
      if (!dish || !isLunchStar(dish)) continue;
      if ((dishStats.eatenCount.saturday ?? 0) > 0) treatPoolSize += 1;
    }
    const window = Math.min(8, Math.max(1, treatPoolSize));

    const treats = horizon.map((view) => saturdayLunch(view)?.dishes[0]?.id ?? null);
    const repeats: string[] = [];
    for (let start = 0; start + window <= treats.length; start += 1) {
      const slice = treats.slice(start, start + window).filter((id): id is number => id !== null);
      if (new Set(slice).size !== slice.length) {
        repeats.push(`weeks ${HORIZON_FROM + start} to ${HORIZON_FROM + start + window - 1}`);
      }
    }
    const dessertWeeks = horizon.filter((view) =>
      (saturdayLunch(view)?.dishes ?? []).some((dish) => dish.category === "Dessert"),
    ).length;
    const pass = repeats.length === 0 && dessertWeeks === horizonWeeks;
    thresholds.push({
      id: 5,
      name: "Saturday (no treat repeat inside a rolling window, dessert on every Saturday)",
      pass,
      metric: {
        value: repeats.length + (horizonWeeks - dessertWeeks),
        bound: 0,
        worseWhen: "above",
      },
      lines: [
        `treat pool ${treatPoolSize} dishes, rolling window ${window}; ${repeats.length === 0 ? "no repeat" : `repeats in ${repeats.length} windows (${repeats.slice(0, 3).join(", ")})`}`,
        `dessert on ${dessertWeeks} of ${horizonWeeks} Saturdays`,
      ],
      diagnosis: !pass
        ? repeats.length > 0
          ? `A treat main repeats inside a ${window}-Saturday window; the Saturday-scoped deficits are not spreading the pool.`
          : `${horizonWeeks - dessertWeeks} Saturdays carry no dessert, which §5.4 makes structural.`
        : undefined,
    });
  }

  // -- 6. Fruit --------------------------------------------------------------

  {
    const problems: string[] = [];
    let measured = 0;
    let thin = 0;
    for (const view of horizon) {
      const eligible = data.library.filter(
        (dish) => dish.category === "Fruit" && isEligibleDish(dish, view.season),
      ).length;
      const ids = view.fruits.map((entry) => entry.dish.id);
      if (eligible < 4) {
        thin += 1;
      } else {
        measured += 1;
        const distinct = new Set(ids).size;
        if (distinct < 4) problems.push(`week ${view.index}: only ${distinct} distinct fruits`);
        const counts = new Map<number, number>();
        for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
        for (const [id, count] of counts) {
          if (count > 2) {
            problems.push(`week ${view.index}: ${dishById.get(id)?.name} appears ${count} times`);
          }
        }
      }
      if (eligible >= 6) {
        for (let day = 0; day + 1 < view.fruits.length; day += 1) {
          if (view.fruits[day].dish.id === view.fruits[day + 1].dish.id) {
            problems.push(
              `week ${view.index}: ${view.fruits[day].dish.name} on consecutive days ${view.fruits[day].day} and ${view.fruits[day + 1].day}`,
            );
          }
        }
      }
    }
    const pass = problems.length === 0;
    thresholds.push({
      id: 6,
      name: "Fruit (4 distinct a week, none more than twice, no consecutive repeat)",
      pass,
      metric: { value: problems.length, bound: 0, worseWhen: "above" },
      lines: [
        `${measured} weeks measured, ${thin} weeks under a thin in-season pool and exempt`,
        ...(pass ? ["no violations"] : problems.slice(0, 8)),
      ],
      diagnosis: !pass
        ? `${problems.length} fruit violations; §9's season pool is not carrying six distinct bowls a week.`
        : undefined,
    });
  }

  // -- 7. Coverage -----------------------------------------------------------

  {
    const startStats = deriveRecordStats(
      seed,
      data.library,
      simulated.length > 0 ? simulated[0].season : "Monsoon",
    );
    const tracked: number[] = [];
    for (const [dishId, dishStats] of startStats.perDish) {
      const total = Object.values(dishStats.eatenCount).reduce(
        (sum, count) => sum + (count ?? 0),
        0,
      );
      if (total >= 2) tracked.push(dishId);
    }
    const servedIn = views.map((view) => new Set(view.week.generatedPlan.map((p) => p.dishId)));
    const misses: string[] = [];
    for (const dishId of tracked) {
      const dish = dishById.get(dishId);
      if (!dish) continue;
      for (let start = 0; start + 20 <= views.length; start += 1) {
        const window = views.slice(start, start + 20);
        if (!window.every((view) => isEligibleDish(dish, view.season))) continue;
        const served = window.some((_, offset) => servedIn[start + offset].has(dishId));
        if (!served) {
          misses.push(`${dish.name} unserved across weeks ${start + 1} to ${start + 20}`);
          break;
        }
      }
    }
    const pass = views.length >= 20 ? misses.length === 0 : null;
    thresholds.push({
      id: 7,
      name: "Coverage (every dish eaten twice or more at start is served in any eligible 20-week window)",
      pass,
      lines: [
        `${tracked.length} dishes tracked; ${misses.length} with an unserved 20-week window`,
        ...misses.slice(0, 8),
      ],
      diagnosis:
        pass === false
          ? `${misses.length} record dishes go 20 eligible weeks unserved; their deficits are not accruing past the pool leaders.`
          : undefined,
    });
  }

  // -- 8. International persistence -----------------------------------------

  {
    const perWeek = horizon.map(
      (view) =>
        weekdayLunches(view).filter(
          (meal) => meal.dishes[0] !== undefined && meal.dishes[0].cuisine !== "Indian",
        ).length,
    );
    const windows: number[] = [];
    for (let start = 0; start + 10 <= perWeek.length; start += 1) {
      windows.push(perWeek.slice(start, start + 10).reduce((a, b) => a + b, 0) / 10);
    }
    const low = windows.length > 0 ? Math.min(...windows) : 0;
    const high = windows.length > 0 ? Math.max(...windows) : 0;
    const zeroWindows = windows.filter((value) => value === 0).length;
    const pass = windows.length === 0 ? null : low >= 0.75 && high <= 1.75 && zeroWindows === 0;
    thresholds.push({
      id: 8,
      name: "International persistence (0.75 to 1.75 weekday stars per week in every 10-week window)",
      pass,
      lines: [
        windows.length === 0
          ? "horizon shorter than one 10-week window, not measurable"
          : `${windows.length} windows, ${fmt(low, 2)} to ${fmt(high, 2)} per week, ${zeroWindows} at zero`,
      ],
      diagnosis:
        pass === false
          ? `Weekday international stars run ${fmt(low, 2)} to ${fmt(high, 2)} a week against the 0.75 to 1.75 band.`
          : undefined,
    });
  }

  // -- 9. Breakfast and forms ------------------------------------------------

  {
    const mains = views.map((view) =>
      breakfasts(view)
        .map((meal) => meal.dishes[0]?.id)
        .filter((id): id is number => id !== undefined),
    );
    let worstDistinct = Number.POSITIVE_INFINITY;
    let windows = 0;
    for (let start = 0; start + 25 <= mains.length; start += 1) {
      windows += 1;
      const distinct = new Set(mains.slice(start, start + 25).flat()).size;
      if (distinct < worstDistinct) worstDistinct = distinct;
    }
    const eggMornings = horizon.filter((view) =>
      breakfasts(view).some((meal) => meal.dishes[0] && isStandaloneEggMain(meal.dishes[0])),
    ).length;
    const dalLunches = horizon.reduce(
      (sum, view) =>
        sum +
        weekdayLunches(view).filter(
          (meal) => meal.dishes[0] && familiesOf(meal.dishes[0]).includes("dal-family"),
        ).length,
      0,
    );
    const pass = windows === 0 ? null : worstDistinct >= 10 && eggMornings > 0 && dalLunches > 0;
    thresholds.push({
      id: 9,
      name: "Breakfast and forms (10 distinct mains per 25 weeks, boiled-egg mornings, dal-led lunches)",
      pass,
      lines: [
        windows === 0
          ? "horizon shorter than one 25-week window, not measurable"
          : `worst 25-week window ${worstDistinct} distinct breakfast mains`,
        `${eggMornings} weeks with a standalone boiled-egg breakfast, ${dalLunches} dal-led weekday lunches in the horizon`,
      ],
      diagnosis:
        pass === false
          ? `Breakfast variety or a named form is missing: ${worstDistinct} distinct mains, ${eggMornings} egg mornings, ${dalLunches} dal lunches.`
          : undefined,
    });
  }

  // -- 10. Plate size and effort --------------------------------------------

  {
    let lunchDays = 0;
    let four = 0;
    let five = 0;
    const over120: string[] = [];
    let over150 = 0;
    for (const view of horizon) {
      for (const meal of weekdayLunches(view)) {
        lunchDays += 1;
        if (meal.dishes.length === 4) four += 1;
        if (meal.dishes.length >= 5) five += 1;
      }
      for (const day of ALL_DAYS) {
        const minutes = view.meals
          .filter((meal) => meal.day === day)
          .flatMap((meal) => meal.dishes)
          .reduce((sum, dish) => sum + dish.prepMinutes, 0);
        if (minutes > 150) over150 += 1;
        if (minutes > 120) over120.push(`${view.weekStart} ${day} ${minutes} minutes`);
      }
    }
    const fourPct = lunchDays > 0 ? (four / lunchDays) * 100 : 0;
    const pass = fourPct < 10 && five === 0 && over150 === 0;
    thresholds.push({
      id: 10,
      name: "Plate size and effort (4-item lunches under 10 percent, no 5-item lunch, no day over 150 minutes)",
      pass,
      metric: { value: fourPct + five * 100 + over150 * 100, bound: 10, worseWhen: "above" },
      lines: [
        `4-item lunches ${fourPct.toFixed(1)} percent of ${lunchDays} weekday lunches, 5-item ${five}`,
        `${over120.length} days over the 120-minute prep ceiling (reported), ${over150} over 150`,
        ...over120.slice(0, 5),
      ],
      diagnosis: !pass
        ? `Plates run large or long: ${fourPct.toFixed(1)} percent 4-item lunches, ${five} 5-item lunches, ${over150} days over 150 minutes.`
        : undefined,
    });
  }

  // -- 11. Presence rates ----------------------------------------------------

  {
    const presence = (
      weeks: ReadonlyArray<{ picks: readonly Pick[]; skippedDays: readonly Day[] }>,
    ): { small: number; companion: number; accompaniment: number } => {
      let breakfastSlots = 0;
      let breakfastWithSmall = 0;
      let lunchSlots = 0;
      let lunchWithCompanion = 0;
      let saturdays = 0;
      let saturdayWithThird = 0;
      for (const week of weeks) {
        const skipped = new Set<Day>(week.skippedDays);
        const bySlot = new Map<string, number>();
        for (const pick of week.picks) {
          if (pick.meal === "fruit" || skipped.has(pick.day)) continue;
          const key = `${pick.day}|${pick.meal}`;
          bySlot.set(key, (bySlot.get(key) ?? 0) + 1);
        }
        for (const day of WEEKDAYS) {
          if (skipped.has(day)) continue;
          breakfastSlots += 1;
          if ((bySlot.get(`${day}|breakfast`) ?? 0) >= 2) breakfastWithSmall += 1;
          lunchSlots += 1;
          if ((bySlot.get(`${day}|lunch`) ?? 0) >= 3) lunchWithCompanion += 1;
        }
        if (!skipped.has("Sat")) {
          saturdays += 1;
          if ((bySlot.get("Sat|lunch") ?? 0) >= 3) saturdayWithThird += 1;
        }
      }
      return {
        small: breakfastSlots > 0 ? breakfastWithSmall / breakfastSlots : 0,
        companion: lunchSlots > 0 ? lunchWithCompanion / lunchSlots : 0,
        accompaniment: saturdays > 0 ? saturdayWithThird / saturdays : 0,
      };
    };

    const recordPresence = presence(seed);
    const servedPresence = presence(
      horizon.map((view) => ({ picks: view.week.generatedPlan, skippedDays: [] as Day[] })),
    );
    const rows: Array<[string, number, number]> = [
      ["breakfast small item", servedPresence.small, recordPresence.small],
      ["weekday companion", servedPresence.companion, recordPresence.companion],
      ["Saturday accompaniment", servedPresence.accompaniment, recordPresence.accompaniment],
    ];
    const lines: string[] = [];
    let failures = 0;
    for (const [name, served, record] of rows) {
      const delta = percentDelta(served, record);
      const ok = record === 0 ? true : Math.abs(delta) <= 25;
      if (!ok) failures += 1;
      lines.push(
        `${name}: served ${fmt(served)} vs record ${fmt(record)} (${signed(delta)}) ${ok ? "PASS" : "FAIL"}`,
      );
    }
    thresholds.push({
      id: 11,
      name: "Presence rates (each optional slot within 25 percent of the record's presence rate)",
      pass: failures === 0,
      metric: { value: failures, bound: 0, worseWhen: "above" },
      lines,
      diagnosis:
        failures > 0
          ? `${failures} optional slots sit outside the 25 percent bar, which is what arms §3.2's reopening trigger.`
          : undefined,
    });
  }

  // -- 12. Drift bound -------------------------------------------------------

  {
    const early = horizon.filter((view) => view.index < 40);
    const late = horizon.filter((view) => view.index >= 40);
    const asWeeks = (list: WeekView[]) =>
      list.map((view) => ({ picks: view.week.generatedPlan, skippedDays: [] as Day[] }));
    const earlyRates = familyRates(asWeeks(early), dishById).rates;
    const lateRates = familyRates(asWeeks(late), dishById).rates;
    const lines: string[] = [];
    let failures = 0;
    let measured = 0;
    if (early.length === 0 || late.length === 0) {
      thresholds.push({
        id: 12,
        name: "Drift bound (weeks 40 to 60 within 10 percent of weeks 20 to 40)",
        pass: null,
        lines: ["horizon does not span both windows, not measurable"],
      });
    } else {
      for (const family of FAMILIES) {
        const first = earlyRates.get(family) ?? 0;
        const second = lateRates.get(family) ?? 0;
        if (first === 0 && second === 0) continue;
        measured += 1;
        const delta = percentDelta(second, first);
        const ok = Number.isFinite(delta) && Math.abs(delta) <= 10;
        if (!ok) failures += 1;
        lines.push(
          `${family}: ${fmt(first)} then ${fmt(second)} (${signed(delta)}) ${ok ? "PASS" : "FAIL"}`,
        );
      }
      thresholds.push({
        id: 12,
        name: "Drift bound (weeks 40 to 60 within 10 percent of weeks 20 to 40)",
        pass: failures === 0,
        lines: [`${measured - failures} of ${measured} families inside the bar`, ...lines],
        diagnosis:
          failures > 0
            ? `${failures} families move more than 10 percent between the two halves of the horizon: the self-feed is still ratcheting.`
            : undefined,
      });
    }
  }

  // -- 13. Reported, not gated ----------------------------------------------

  {
    const novelty = horizon.filter((view) => view.week.diagnostics.exploration !== null).length;
    reported.push(
      `Novelty placements: ${novelty} in ${horizonWeeks} weeks (${fmt(novelty / Math.max(1, horizonWeeks), 2)} a week)`,
    );

    let noAnimal = 0;
    let lunches = 0;
    for (const view of horizon) {
      for (const meal of weekdayLunches(view)) {
        lunches += 1;
        if (!meal.dishes.some((dish) => ANIMAL_PRIMARIES.has(dish.primaryIngredient)))
          noAnimal += 1;
      }
    }
    reported.push(
      `Weekday lunches with no animal protein: ${noAnimal} of ${lunches} (${((noAnimal / Math.max(1, lunches)) * 100).toFixed(1)} percent)`,
    );

    const shapes = new Map<number, number>();
    for (const view of horizon) {
      const size = saturdayLunch(view)?.dishes.length ?? 0;
      shapes.set(size, (shapes.get(size) ?? 0) + 1);
    }
    reported.push(
      `Saturday plate shape: ${[...shapes.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([size, count]) => `${size} items x ${count}`)
        .join(", ")}`,
    );

    const fills = new Map<PickRole, number>();
    for (const view of horizon) {
      for (const [role, count] of Object.entries(view.week.diagnostics.negativeDeficitFills)) {
        fills.set(role as PickRole, (fills.get(role as PickRole) ?? 0) + (count ?? 0));
      }
    }
    reported.push(
      `Negative-deficit fills per week: ${
        fills.size === 0
          ? "none"
          : [...fills.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([role, count]) => `${role} ${fmt(count / Math.max(1, horizonWeeks), 2)}`)
              .join(", ")
      }`,
    );

    const byFamily = new Map<string, number>();
    for (const view of horizon) {
      for (const pick of view.week.generatedPlan) {
        const dish = dishById.get(pick.dishId);
        if (!dish) continue;
        const family = proteinFamily(dish.primaryIngredient);
        byFamily.set(family, (byFamily.get(family) ?? 0) + 1);
      }
    }
    reported.push(
      `Picks by protein family (top 10): ${[...byFamily.entries()]
        .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
        .slice(0, 10)
        .map(([family, count]) => `${family} ${count}`)
        .join(", ")}`,
    );

    const repairCounts = new Map<string, number>();
    for (const view of horizon) {
      for (const repair of view.week.diagnostics.repairs) {
        repairCounts.set(repair.constraint, (repairCounts.get(repair.constraint) ?? 0) + 1);
      }
    }
    reported.push(
      `Constraint repairs: ${
        repairCounts.size === 0
          ? "none"
          : [...repairCounts.entries()]
              .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
              .map(([reason, count]) => `${reason} ${count}`)
              .join(", ")
      }`,
    );
  }

  return { label, weeks: simulated.length, thresholds, reported };
}

// ---------------------------------------------------------------------------
// The report
// ---------------------------------------------------------------------------

function verdict(pass: boolean | null): string {
  if (pass === null) return "NOT MEASURED";
  return pass ? "PASS" : "FAIL";
}

export function renderReport(reports: RunReport[], preamble: string[]): string {
  const lines: string[] = ["# Engine v6 gate report", ""];
  lines.push(...preamble, "");
  lines.push("## Summary", "");
  lines.push("| Run | Thresholds passed | Failed | Not measured |");
  lines.push("| --- | --- | --- | --- |");
  for (const report of reports) {
    const passed = report.thresholds.filter((entry) => entry.pass === true).length;
    const failed = report.thresholds.filter((entry) => entry.pass === false).length;
    const skipped = report.thresholds.filter((entry) => entry.pass === null).length;
    lines.push(`| ${report.label} | ${passed} | ${failed} | ${skipped} |`);
  }
  lines.push("");

  for (const report of reports) {
    lines.push(`## ${report.label} (${report.weeks} weeks)`, "");
    for (const threshold of report.thresholds) {
      lines.push(`**${threshold.id}. ${threshold.name}: ${verdict(threshold.pass)}**`, "");
      for (const line of threshold.lines) lines.push(`- ${line}`);
      if (threshold.diagnosis) lines.push("", `Diagnosis: ${threshold.diagnosis}`);
      lines.push("");
    }
    lines.push("**13. Reported, not gated**", "");
    for (const line of report.reported) lines.push(`- ${line}`);
    lines.push("");
  }
  return lines.join("\n");
}

/** One line of the PASS or FAIL summary the PR body quotes. */
export function summaryLines(reports: RunReport[]): string[] {
  const out: string[] = [];
  for (const report of reports) {
    for (const threshold of report.thresholds) {
      out.push(`${report.label} | ${threshold.id}. ${threshold.name}: ${verdict(threshold.pass)}`);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

// Compiled, this file lives at engine/dist/scripts/gate.js, so the repo root is
// three levels up. It is only ever run from there (`npm run gate` builds first).
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

export function loadGateData(dataDir: string): GateData {
  const dishFiles = loadDishFiles(resolve(dataDir, "dishes"));
  const { dishes, ingredients } = dishFilesToLibrary(dishFiles);
  const catalog = parseIngredientCatalog(readFileSync(resolve(dataDir, "ingredients.md"), "utf8"));
  // Parsed for parity with the bake load path; the gate does not read pack sizes.
  catalogToPackSizes(catalog);
  return { library: dishes, ingredients, catalog };
}

interface RunSpec {
  label: string;
  variant?: GenerateWeekV6Variant;
  corrected?: boolean;
}

/** The three §11 runs, then the four measurement variants, in the spec's order. */
const RUN_SPECS: RunSpec[] = [
  { label: "1. Frozen", variant: { frozenRates: true } },
  { label: "2. Self-feeding" },
  { label: "3. Corrected", corrected: true },
  { label: "Variant: cold-start cap 0.5", variant: { coldStartCap: 0.5 } },
  { label: "Variant: cold-start cap pool-level", variant: { coldStartCap: "pool" } },
  { label: "Variant: family governor off", variant: { familyGovernor: false } },
  { label: "Variant: rate formula sinceFirstEaten", variant: { rateFormula: "sinceFirstEaten" } },
];

export function runGate(options: { fixture: string; weeks: number; dataDir: string }): {
  markdown: string;
  reports: RunReport[];
} {
  const data = loadGateData(options.dataDir);
  const seed = loadRecordFixture(options.fixture, data.library);
  const seedStats = deriveRecordStats(
    seed,
    data.library,
    seasonOfWeek(seed.length > 0 ? seed[seed.length - 1].weekStart : "2026-06-15"),
  );
  const swapAway = new Set(seedStats.swappedOut.map((pick) => pick.dishId));

  const preamble = [
    `Generated by \`npm run gate\` against the built engine, ${options.weeks} weeks self-feeding from \`${options.fixture}\` (${seed.length} record weeks).`,
    "",
    `All thresholds are measured on weeks ${HORIZON_FROM} to ${options.weeks}, the steady state (§11). Rates are per occasion.`,
    "",
    "Counting definitions the spec leaves to the harness, stated so the numbers are reproducible:",
    "",
    "- A family's rate is its as-eaten (or as-served) rows divided by the breakfast, lunch and Saturday occasions of the weeks measured. Fruit rows are excluded; no tracked family is a fruit.",
    "- Families are keyed on library fields, never on dish names: chicken is the §4.6 chicken family, dal-family is a lunch star whose primary ingredient is a pulse, international is a non-Indian cuisine, plain roti is Category Chapati with a Wheat Flour primary and specialty roti is every other Chapati, raita/curd is a Lunch-time Accompaniment with a Curd primary and salad is every other Lunch-time Accompaniment.",
    "- Lunch-main uniqueness counts weekday lunch stars only; Saturday is its own register (§2.2).",
    "- The Jaccard baseline is re-measured by this harness's own method on the record weeks (§11 threshold 3's amendment), over the whole dish set of each week, fruit included.",
    "- Threshold 4's arithmetic exemption reduces to a per-occasion rate above 0.5, because every scope's planned occasions equal its weekly slots.",
    "- Presence (threshold 11) is measured by pick count on both sides, because the record carries no roles: a breakfast with two or more picks has a small item, a weekday lunch with three or more has a companion, a Saturday with three or more has an accompaniment.",
    "",
    swapAway.size === 0
      ? "The corrected run has **no swap-away rows to replay**: every week of this fixture predates cutover and carries no `generatedPlan`, so §2's swap-away list is empty and run 3 is identical to run 2. It becomes a distinct run as soon as the fixture is a prod export that carries generated plans."
      : `The corrected run replays ${swapAway.size} swap-away dish ids from the record.`,
  ];

  const reports: RunReport[] = [];
  for (const spec of RUN_SPECS) {
    process.stdout.write(`gate: ${spec.label}\n`);
    const simulated = simulate({
      data,
      record: seed,
      weeks: options.weeks,
      variant: spec.variant,
      swapAway: spec.corrected ? swapAway : undefined,
      onWeek: (index, weekStart, week) => {
        process.stdout.write(
          `gate:   week ${String(index).padStart(2, " ")}/${options.weeks} ${weekStart} ` +
            `${week.generatedPlan.length} picks, ` +
            `${week.diagnostics.exploration ? "1" : "0"} novelty, ` +
            `${week.diagnostics.repairs.length} repairs\n`,
        );
      },
    });
    reports.push(measureRun({ label: spec.label, data, seed, simulated }));
  }

  return { markdown: renderReport(reports, preamble), reports };
}

function isEntrypoint(): boolean {
  if (!process.argv[1]) return false;
  try {
    return resolve(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isEntrypoint()) {
  const fixture = process.argv[2] ?? "record-8weeks";
  const weeks = Number(process.argv[3] ?? DEFAULT_WEEKS);
  const started = Date.now();
  const { markdown, reports } = runGate({
    fixture,
    weeks,
    dataDir: resolve(repoRoot, "data"),
  });
  const outPath = resolve(repoRoot, "features/engine-v6-gate-report.md");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${markdown}\n`, "utf8");
  process.stdout.write("\n");
  for (const line of summaryLines(reports)) process.stdout.write(`${line}\n`);
  process.stdout.write(
    `\ngate: wrote ${outPath} in ${((Date.now() - started) / 1000).toFixed(1)}s\n`,
  );
}
