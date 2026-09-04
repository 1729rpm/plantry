/**
 * The v6 record derivation (`features/engine-v6.md` §2, §2.1, §2.2).
 *
 * One pure function turns the household record (every as-eaten row of every served
 * week, swaps applied and skipped days excluded) into the statistics selection
 * reads: per-scope occasion counts, per-dish eaten counts and rates, the
 * weekday-occupation memory §6 step 5 places by, the per-season fruit counts §9
 * ranks by, and the swap-away list the §11 gate's corrected run replays.
 *
 * Nothing here reads the clock, a random source, or the filesystem. Every map is
 * built in a fixed order (dish id ascending, then scope in `SCOPES` order) so that
 * two derivations of the same record serialize identically (§10).
 *
 * Two readings of §2 and §3 that the spec does not spell out, and that this module
 * and `ledger.ts` both hold to:
 *
 * 1. A plan pick and an as-eaten pick match as a **multiset match on (scope, dish id)
 *    within the week**, not on the exact (day, meal, dish) triple. This governs both
 *    `swappedOut` here and reconciliation in `ledger.ts`: a dish the engine placed on
 *    Monday and the household ate on Wednesday is one serving in one scope, so it is
 *    neither a swap-away nor a swap-in.
 * 2. **The fruit scope is season-scoped in both directions.** A fruit row from a week
 *    outside the requested season is not counted toward `eatenCount.fruit` and is not
 *    charged, because the rate it would move is measured over in-season occasions
 *    only. The §2.2 all-season fallback overrides this whenever the requested season
 *    has no record occasions at all. `seasonCount`, `lastEatenWeek` and the
 *    occupation memory stay unscoped: they are dish-level memory, not rates.
 */

import type { Dish, Season } from "../data/schemas.js";
import type {
  Day,
  DishOccupation,
  DishStats,
  Pick,
  RecordStats,
  RecordWeek,
  Scope,
} from "./types.js";

/** The four §2.2 scopes in their canonical order. Every scope loop uses this order. */
export const SCOPES: readonly Scope[] = ["weekdayBreakfast", "weekdayLunch", "saturday", "fruit"];

/** Monday to Friday, the days that carry a weekday breakfast and a weekday lunch (§4). */
const WEEKDAYS: readonly Day[] = ["Mon", "Tue", "Wed", "Thu", "Fri"];

/** The three seasons in a fixed order, so per-season maps serialize identically (§10). */
const SEASONS: readonly Season[] = ["Summer", "Monsoon", "Winter"];

/**
 * The season a record week belongs to, read off the month of its `weekStart`
 * (Bangalore: Summer is March to May, Monsoon June to September, Winter October to
 * February; the same split the backend already applies in `app/convex/generateWeek.ts`).
 *
 * A week is assigned one season by its Monday, not day by day, so a week that
 * straddles a month boundary counts wholly in the season of its Monday. §2.2 speaks
 * of "fruit rows whose week falls in the current season", which is this rule.
 */
export function seasonOfWeek(weekStart: string): Season {
  const month = Number(weekStart.slice(5, 7));
  if (month >= 3 && month <= 5) return "Summer";
  if (month >= 6 && month <= 9) return "Monsoon";
  return "Winter";
}

/**
 * The §2.2 scope a pick belongs to, or null when the pick occupies no scope.
 *
 * Saturday has no breakfast in the §4 schedule, so a Saturday breakfast row (if one
 * ever appears in the data) belongs to no scope and is ignored everywhere: it is
 * neither an occasion, nor an eaten row, nor a charge.
 */
export function scopeOfPick(pick: Pick): Scope | null {
  if (pick.meal === "fruit") return "fruit";
  if (pick.day === "Sat") return pick.meal === "lunch" ? "saturday" : null;
  return pick.meal === "breakfast" ? "weekdayBreakfast" : "weekdayLunch";
}

/** The occasions one record week contributes to each scope (§2.2). */
export interface WeekOccasions {
  /** ISO Monday of the week. */
  weekStart: string;
  /** The season the week falls in, by its Monday. */
  season: Season;
  /**
   * Non-skipped occasions of each scope in this week. `fruit` already carries the
   * §2.2 season rule: in-season weeks only, or every week when the requested season
   * has no record occasions at all and the all-season fallback applies.
   */
  occasions: Record<Scope, number>;
  /** Non-skipped days of the week, Monday to Saturday: the all-season fruit denominator. */
  dayOccasions: number;
}

/**
 * The record's occasions week by week, ascending by `weekStart`.
 *
 * `RecordStats` carries only the totals, but the §3 cold start needs the occasions
 * that fall between a dish's last-eaten week and the cutover week, so the series is
 * derived separately and handed to `seedLedger`.
 */
export type OccasionSeries = readonly WeekOccasions[];

/** Options that change how a rate is computed. Production passes nothing. */
export interface DeriveRecordStatsOptions {
  /**
   * §14 item 1, run as a §11 gate variant. `occasions` (the default, and what §2.2
   * specifies) divides by every occasion in the record; `sinceFirstEaten` divides by
   * the occasions from the dish's first as-eaten week onward, so a rising new staple
   * is not diluted by the record's full length.
   */
  rateFormula?: "occasions" | "sinceFirstEaten";
}

function byWeekStart(a: { weekStart: string }, b: { weekStart: string }): number {
  return a.weekStart < b.weekStart ? -1 : a.weekStart > b.weekStart ? 1 : 0;
}

/** Deterministic pick order inside a week: schedule day, then meal, then dish id. */
const DAY_ORDER: readonly Day[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MEAL_ORDER = ["breakfast", "lunch", "fruit"] as const;

export function comparePicks(a: Pick, b: Pick): number {
  const day = DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day);
  if (day !== 0) return day;
  const meal = MEAL_ORDER.indexOf(a.meal) - MEAL_ORDER.indexOf(b.meal);
  if (meal !== 0) return meal;
  return a.dishId - b.dishId;
}

function emptyScopeCounts(): Record<Scope, number> {
  return { weekdayBreakfast: 0, weekdayLunch: 0, saturday: 0, fruit: 0 };
}

interface SeriesBuild {
  series: WeekOccasions[];
  /** In-season day occasions per season, across the whole record (§2.2). */
  seasonDayOccasions: Partial<Record<Season, number>>;
  /**
   * True when the requested season has zero record occasions, so §2.2's last
   * paragraph applies and the fruit scope falls back to the all-season rate.
   */
  fruitAllSeason: boolean;
}

function buildSeries(record: readonly RecordWeek[], season: Season): SeriesBuild {
  const sorted = [...record].sort(byWeekStart);
  const perWeek = sorted.map((week) => {
    const skipped = new Set<Day>(week.skippedDays);
    const weekdays = WEEKDAYS.filter((day) => !skipped.has(day)).length;
    const saturday = skipped.has("Sat") ? 0 : 1;
    return {
      weekStart: week.weekStart,
      season: seasonOfWeek(week.weekStart),
      weekdays,
      saturday,
      dayOccasions: weekdays + saturday,
    };
  });

  const seasonDayOccasions: Partial<Record<Season, number>> = {};
  for (const s of SEASONS) {
    const days = perWeek
      .filter((week) => week.season === s)
      .reduce((sum, week) => sum + week.dayOccasions, 0);
    if (days > 0) seasonDayOccasions[s] = days;
  }
  const fruitAllSeason = (seasonDayOccasions[season] ?? 0) === 0;

  const series = perWeek.map((week) => ({
    weekStart: week.weekStart,
    season: week.season,
    dayOccasions: week.dayOccasions,
    occasions: {
      weekdayBreakfast: week.weekdays,
      weekdayLunch: week.weekdays,
      saturday: week.saturday,
      fruit: fruitAllSeason || week.season === season ? week.dayOccasions : 0,
    },
  }));

  return { series, seasonDayOccasions, fruitAllSeason };
}

/**
 * The record's per-week occasions, ascending, with the §2.2 fruit season rule
 * already applied for `season`. Summing the series reproduces `RecordStats.occasions`.
 */
export function deriveOccasionSeries(
  record: readonly RecordWeek[],
  season: Season,
): OccasionSeries {
  return buildSeries(record, season).series;
}

interface DishAccumulator {
  eaten: Partial<Record<Scope, number>>;
  seasonCount: Partial<Record<Season, number>>;
  firstEatenWeek: string | null;
  lastEatenWeek: string | null;
  occupations: Map<string, { lastWeek: string; weeks: Set<string> }>;
}

function accumulatorFor(map: Map<number, DishAccumulator>, dishId: number): DishAccumulator {
  const existing = map.get(dishId);
  if (existing) return existing;
  const fresh: DishAccumulator = {
    eaten: {},
    seasonCount: {},
    firstEatenWeek: null,
    lastEatenWeek: null,
    occupations: new Map(),
  };
  map.set(dishId, fresh);
  return fresh;
}

/**
 * The picks of one week that count, in a deterministic order: every pick that
 * occupies a scope, whose dish the library knows, and (for the fruit scope) whose
 * week falls in the season the stats are scoped to.
 *
 * The fruit filter is the same one `reconcile` applies when charging: the fruit
 * ledger is season-scoped, so a mango eaten in Summer neither accrues nor is
 * charged against a Monsoon ledger. When the all-season fallback is in force no
 * fruit row is filtered out, because then every week counts.
 */
function countedPicks(
  picks: readonly Pick[],
  weekSeason: Season,
  season: Season,
  known: ReadonlySet<number>,
  fruitAllSeason: boolean,
  skippedDays: readonly Day[],
): Array<{ pick: Pick; scope: Scope }> {
  const skipped = new Set<Day>(skippedDays);
  const out: Array<{ pick: Pick; scope: Scope }> = [];
  for (const pick of [...picks].sort(comparePicks)) {
    if (skipped.has(pick.day)) continue;
    if (!known.has(pick.dishId)) continue;
    const scope = scopeOfPick(pick);
    if (scope === null) continue;
    if (scope === "fruit" && !fruitAllSeason && weekSeason !== season) continue;
    out.push({ pick, scope });
  }
  return out;
}

/**
 * §2: everything selection derives from the record.
 *
 * `record` is every record week (weeks earlier than the one being generated); it
 * need not be sorted. `season` scopes the fruit statistics: `occasions.fruit`,
 * every dish's `eatenCount.fruit`, and every dish's `rate.fruit` are measured over
 * the record's in-season weeks, falling back to the whole record when the season has
 * no record occasions (§2.2, last paragraph). `seasonCount` always carries the full
 * per-season breakdown, unscoped, so a caller can recompute any season's rate.
 *
 * A dish absent from a scope has **no key** in `eatenCount` and `rate` for it, which
 * is how §2.2's "absent, not present at rate zero" is represented. The `Record<Scope,
 * number>` shape in `types.ts` therefore reads as a partial map at runtime; every
 * consumer must treat a missing key as absence rather than as zero. (The shape is
 * fixed by the type contract, so it is not narrowed here; see the PR note.)
 *
 * Picks whose dish the library does not carry are ignored: a pick with no library
 * identity contributes no row, exactly as §2.1 says of a custom one-off.
 */
export function deriveRecordStats(
  record: readonly RecordWeek[],
  library: readonly Dish[],
  season: Season,
  options: DeriveRecordStatsOptions = {},
): RecordStats {
  const rateFormula = options.rateFormula ?? "occasions";
  const { series, seasonDayOccasions, fruitAllSeason } = buildSeries(record, season);
  const known = new Set(library.map((dish) => dish.id));
  const fruitDishIds = new Set(
    library.filter((dish) => dish.category === "Fruit").map((dish) => dish.id),
  );
  const sorted = [...record].sort(byWeekStart);

  const occasions = emptyScopeCounts();
  for (const week of series) {
    for (const scope of SCOPES) occasions[scope] += week.occasions[scope];
  }

  const accumulators = new Map<number, DishAccumulator>();
  const swappedOut: Pick[] = [];

  for (const week of sorted) {
    const weekSeason = seasonOfWeek(week.weekStart);
    const skipped = new Set<Day>(week.skippedDays);

    // Every scoped, library-known pick feeds the dish-level memory (last eaten week,
    // occupations, per-season fruit counts), whatever season it falls in. Only the
    // picks the requested season counts feed `eatenCount`, which is the numerator of
    // the season-scoped fruit rate; the weekday and Saturday scopes are not
    // season-scoped, so every one of their picks counts.
    for (const pick of [...week.picks].sort(comparePicks)) {
      if (skipped.has(pick.day)) continue;
      if (!known.has(pick.dishId)) continue;
      const scope = scopeOfPick(pick);
      if (scope === null) continue;

      const acc = accumulatorFor(accumulators, pick.dishId);
      if (acc.firstEatenWeek === null || week.weekStart < acc.firstEatenWeek) {
        acc.firstEatenWeek = week.weekStart;
      }
      if (acc.lastEatenWeek === null || week.weekStart > acc.lastEatenWeek) {
        acc.lastEatenWeek = week.weekStart;
      }
      const slot = `${pick.day}:${pick.meal}`;
      const occupation = acc.occupations.get(slot) ?? {
        lastWeek: week.weekStart,
        weeks: new Set(),
      };
      if (week.weekStart > occupation.lastWeek) occupation.lastWeek = week.weekStart;
      occupation.weeks.add(week.weekStart);
      acc.occupations.set(slot, occupation);
      if (fruitDishIds.has(pick.dishId)) {
        acc.seasonCount[weekSeason] = (acc.seasonCount[weekSeason] ?? 0) + 1;
      }

      if (scope === "fruit" && !fruitAllSeason && weekSeason !== season) continue;
      acc.eaten[scope] = (acc.eaten[scope] ?? 0) + 1;
    }

    if (week.generatedPlan !== null) {
      const eaten = countedPicks(
        week.picks,
        weekSeason,
        season,
        known,
        fruitAllSeason,
        week.skippedDays,
      );
      const planned = countedPicks(
        week.generatedPlan,
        weekSeason,
        season,
        known,
        fruitAllSeason,
        [],
      );
      swappedOut.push(...unmatchedPlanPicks(planned, eaten));
    }
  }

  const perDish = new Map<number, DishStats>();
  for (const dishId of [...accumulators.keys()].sort((a, b) => a - b)) {
    const acc = accumulators.get(dishId) as DishAccumulator;
    perDish.set(dishId, {
      eatenCount: partialScopeRecord(acc.eaten),
      rate: partialScopeRecord(rateOf(acc, series, occasions, rateFormula)),
      lastEatenWeek: acc.lastEatenWeek,
      occupations: buildOccupations(acc.occupations),
      seasonCount: orderedSeasonCount(acc.seasonCount),
    });
  }

  return {
    weeks: record.length,
    occasions,
    seasonDayOccasions,
    perDish,
    swappedOut,
  };
}

/**
 * The plan picks of a week that no as-eaten pick matched: what the household swapped
 * away after generation (§11's corrected run reads this list).
 *
 * Matching is a **multiset match on (scope, dish id) within the week**, not on the
 * exact (day, meal, dish) triple. A dish the engine placed on Monday and the
 * household ate on Wednesday is the same serving in the same scope, so it is not a
 * swap-away and its as-eaten row is not a swap-in; charging it a second time at
 * reconciliation would take two servings out of the ledger for one meal. Placing the
 * same dish twice in a scope and eating it once leaves exactly one plan pick
 * unmatched, which is the intended charge.
 */
function unmatchedPlanPicks(
  planned: ReadonlyArray<{ pick: Pick; scope: Scope }>,
  eaten: ReadonlyArray<{ pick: Pick; scope: Scope }>,
): Pick[] {
  const remaining = new Map<string, number>();
  for (const { pick, scope } of eaten) {
    const key = `${pick.dishId}:${scope}`;
    remaining.set(key, (remaining.get(key) ?? 0) + 1);
  }
  const out: Pick[] = [];
  for (const { pick, scope } of planned) {
    const key = `${pick.dishId}:${scope}`;
    const left = remaining.get(key) ?? 0;
    if (left > 0) {
      remaining.set(key, left - 1);
      continue;
    }
    out.push({ day: pick.day, meal: pick.meal, dishId: pick.dishId });
  }
  return out;
}

/**
 * The as-eaten picks of a week that the week's plan did not contain: the household's
 * swap-ins, which §3 charges at reconciliation. The mirror of `unmatchedPlanPicks`,
 * and it uses the same multiset match, so the two lists are consistent by construction.
 */
export function unmatchedEatenPicks(
  eaten: ReadonlyArray<{ pick: Pick; scope: Scope }>,
  planned: ReadonlyArray<{ pick: Pick; scope: Scope }>,
): Array<{ pick: Pick; scope: Scope }> {
  const remaining = new Map<string, number>();
  for (const { pick, scope } of planned) {
    const key = `${pick.dishId}:${scope}`;
    remaining.set(key, (remaining.get(key) ?? 0) + 1);
  }
  const out: Array<{ pick: Pick; scope: Scope }> = [];
  for (const entry of eaten) {
    const key = `${entry.pick.dishId}:${entry.scope}`;
    const left = remaining.get(key) ?? 0;
    if (left > 0) {
      remaining.set(key, left - 1);
      continue;
    }
    out.push(entry);
  }
  return out;
}

/**
 * The picks of one week that count, for `reconcile` (§3) and for the replay's plan
 * charges.
 *
 * `kind` decides which list is read and whether the week's skipped days apply. An
 * as-eaten row on a skipped day is not a row at all (§2.1: the record is the week's
 * slot state "minus every day named in its `skippedDays`"), while a plan pick on a
 * day the household later skipped stays: the engine placed it and §3 charged it, and
 * §3's no-refund rule keeps that charge.
 */
export function countedPicksOfWeek(
  week: RecordWeek,
  kind: "eaten" | "planned",
  library: readonly Dish[],
  season: Season,
  fruitAllSeason: boolean,
): Array<{ pick: Pick; scope: Scope }> {
  const known = new Set(library.map((dish) => dish.id));
  const picks = kind === "eaten" ? week.picks : (week.generatedPlan ?? []);
  return countedPicks(
    picks,
    seasonOfWeek(week.weekStart),
    season,
    known,
    fruitAllSeason,
    kind === "eaten" ? week.skippedDays : [],
  );
}

/** Whether the requested season has no record occasions, so §2.2's fallback is in force. */
export function isFruitAllSeasonFallback(record: readonly RecordWeek[], season: Season): boolean {
  return buildSeries(record, season).fruitAllSeason;
}

function rateOf(
  acc: DishAccumulator,
  series: OccasionSeries,
  occasions: Record<Scope, number>,
  rateFormula: "occasions" | "sinceFirstEaten",
): Partial<Record<Scope, number>> {
  const rate: Partial<Record<Scope, number>> = {};
  for (const scope of SCOPES) {
    const eaten = acc.eaten[scope];
    if (eaten === undefined) continue;
    const denominator =
      rateFormula === "sinceFirstEaten" && acc.firstEatenWeek !== null
        ? series
            .filter((week) => week.weekStart >= (acc.firstEatenWeek as string))
            .reduce((sum, week) => sum + week.occasions[scope], 0)
        : occasions[scope];
    if (denominator <= 0) continue;
    rate[scope] = eaten / denominator;
  }
  return rate;
}

/**
 * Cast a partial scope map to the `Record<Scope, number>` the type contract names.
 *
 * §2.2 requires absence, not rate zero, and `types.ts` (stream A0's, not editable
 * here) types the field as total. The runtime object is deliberately partial; the
 * cast is the one place that is acknowledged.
 */
function partialScopeRecord(partial: Partial<Record<Scope, number>>): Record<Scope, number> {
  const out: Partial<Record<Scope, number>> = {};
  for (const scope of SCOPES) {
    const value = partial[scope];
    if (value !== undefined) out[scope] = value;
  }
  return out as Record<Scope, number>;
}

function orderedSeasonCount(
  counts: Partial<Record<Season, number>>,
): Partial<Record<Season, number>> {
  const out: Partial<Record<Season, number>> = {};
  for (const s of SEASONS) {
    const value = counts[s];
    if (value !== undefined) out[s] = value;
  }
  return out;
}

function buildOccupations(
  raw: Map<string, { lastWeek: string; weeks: Set<string> }>,
): Map<string, DishOccupation> {
  const out = new Map<string, DishOccupation>();
  for (const key of [...raw.keys()].sort()) {
    const entry = raw.get(key) as { lastWeek: string; weeks: Set<string> };
    out.set(key, { lastWeek: entry.lastWeek, count: entry.weeks.size });
  }
  return out;
}

/** The rate a dish carries in a scope, or undefined when the dish is absent from it (§2.2). */
export function rateIn(stats: RecordStats, dishId: number, scope: Scope): number | undefined {
  const dish = stats.perDish.get(dishId);
  if (!dish) return undefined;
  return (dish.rate as Partial<Record<Scope, number>>)[scope];
}

/** The as-eaten rows a dish carries in a scope, or undefined when it is absent from it. */
export function eatenCountIn(stats: RecordStats, dishId: number, scope: Scope): number | undefined {
  const dish = stats.perDish.get(dishId);
  if (!dish) return undefined;
  return (dish.eatenCount as Partial<Record<Scope, number>>)[scope];
}
