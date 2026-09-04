/**
 * The v6 deficit ledger (`features/engine-v6.md` §3, §3.1).
 *
 * Selection is rate-deficit scheduling: every repertoire dish carries one number per
 * scope, how far behind its own eaten rate the engine is. No table holds those
 * numbers. The ledger is a pure function of persisted data, replayed from the
 * cutover week on every generation: seed, then accrue, charge placements, and charge
 * the as-eaten rows the plan did not contain, week by week.
 *
 * Every operation here returns a **new** `Ledger`; nothing mutates its input. Every
 * returned ledger's `deficits` map is rebuilt in one fixed key order (dish id
 * ascending, then scope in `SCOPES` order), so two ledgers holding the same numbers
 * serialize identically (§10).
 */

import type { Dish, Season } from "../data/schemas.js";
import type { GenerateWeekV6Variant, Ledger, RecordStats, RecordWeek, Scope } from "./types.js";
import {
  SCOPES,
  countedPicksOfWeek,
  deriveOccasionSeries,
  deriveRecordStats,
  isFruitAllSeasonFallback,
  rateIn,
  unmatchedEatenPicks,
  type OccasionSeries,
} from "./record.js";

/**
 * Occasions of each scope in one generated week (§2.2, the schedule column): five
 * weekday breakfasts, five weekday lunches, one Saturday, six fruits. This is what
 * accrual multiplies a rate by, and it is a property of the §4 schedule, not of the
 * record.
 */
export const PLANNED_OCCASIONS: Record<Scope, number> = {
  weekdayBreakfast: 5,
  weekdayLunch: 5,
  saturday: 1,
  fruit: 6,
};

/** The §3 cold-start cap: at most one banked serving per dish. */
export const DEFAULT_COLD_START_CAP = 1;

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

function utcOf(iso: string): number {
  const year = Number(iso.slice(0, 4));
  const month = Number(iso.slice(5, 7));
  const day = Number(iso.slice(8, 10));
  return Date.UTC(year, month - 1, day);
}

/** Whole weeks from `from` to `to`; negative when `to` precedes `from`. */
function weeksBetween(from: string, to: string): number {
  return Math.round((utcOf(to) - utcOf(from)) / MS_PER_WEEK);
}

/** The ISO Monday `count` weeks after `weekStart`. */
export function addWeeks(weekStart: string, count: number): string {
  return new Date(utcOf(weekStart) + count * MS_PER_WEEK).toISOString().slice(0, 10);
}

/** `Active` and in season: the §3 accrual gate. A dish outside it freezes. */
export function isEligibleDish(dish: Dish, season: Season): boolean {
  if (dish.active !== "Yes") return false;
  return dish.seasons === "All" || dish.seasons.includes(season);
}

function ledgerKey(dishId: number, scope: Scope): string {
  return `${dishId}:${scope}`;
}

function compareKeys(a: string, b: string): number {
  const aColon = a.lastIndexOf(":");
  const bColon = b.lastIndexOf(":");
  const dish = Number(a.slice(0, aColon)) - Number(b.slice(0, bColon));
  if (dish !== 0) return dish;
  return (
    SCOPES.indexOf(a.slice(aColon + 1) as Scope) - SCOPES.indexOf(b.slice(bColon + 1) as Scope)
  );
}

/**
 * Build the immutable ledger snapshot every operation returns: the same entries in
 * one canonical key order, so `JSON.stringify([...ledger.deficits])` is a stable
 * fingerprint of the ledger's value (§10, and the §11 harness's replay check).
 */
function freeze(entries: ReadonlyMap<string, number>): Ledger {
  const deficits = new Map<string, number>();
  for (const key of [...entries.keys()].sort(compareKeys)) {
    deficits.set(key, entries.get(key) as number);
  }
  return { deficits };
}

/** An empty ledger: no dish has a deficit in any scope. */
export function emptyLedger(): Ledger {
  return { deficits: new Map() };
}

/** The deficit a dish carries in a scope, or undefined when it has no ledger there. */
export function deficitIn(ledger: Ledger, dishId: number, scope: Scope): number | undefined {
  return ledger.deficits.get(ledgerKey(dishId, scope));
}

/**
 * The occasions of one scope between a dish's last as-eaten week (exclusive) and the
 * cutover week (exclusive): the multiplier of the §3 cold start's backdated accrual.
 *
 * With the record's occasion series this is exact. Without it (a caller that passes
 * only `RecordStats`) it is estimated from the record's own occasion density,
 * `occasions[scope] / weeks` per week, which is exact for a record with no skipped
 * days and slightly generous otherwise. `replayLedger` always passes the series.
 */
function occasionsSinceLastEaten(
  stats: RecordStats,
  lastEatenWeek: string | null,
  cutoverWeek: string,
  scope: Scope,
  series: OccasionSeries | undefined,
): number {
  if (lastEatenWeek === null) return 0;
  if (series) {
    return series
      .filter((week) => week.weekStart > lastEatenWeek && week.weekStart < cutoverWeek)
      .reduce((sum, week) => sum + week.occasions[scope], 0);
  }
  const gap = Math.max(0, weeksBetween(lastEatenWeek, cutoverWeek) - 1);
  const density = stats.weeks > 0 ? stats.occasions[scope] / stats.weeks : 0;
  return gap * density;
}

/**
 * §3's cold start: at the cutover week, seed each dish's deficit by backdated
 * accrual, `min(rate x occasionsSinceLastEaten, cap)`.
 *
 * The seed applies only to dishes in `structuralDishIds` (the pools a plate always
 * fills: lunch stars, carbs, breakfast mains, Saturday treats, desserts, fruit).
 * Every other dish that is present in a scope is seeded at zero, so it starts
 * accruing from the cutover week without a banked transient. The structural
 * predicate itself is stream B's `isStructuralPoolDish`; this module never computes
 * it, it receives the resulting id set.
 *
 * `cap`:
 * - a number caps each dish's seed at that many servings (the spec's value is 1);
 * - `"pool"` is the §11 variant: **no per-dish cap; instead each scope's total
 *   seeded deficit is capped at that scope's pool budget, defined as the sum over
 *   the scope's seeded (structural) dishes of `rate[scope] x PLANNED_OCCASIONS[scope]`,
 *   which is one generated week's worth of the pool's combined rate. When the raw
 *   seed total for a scope exceeds its budget, every seeded value in that scope is
 *   multiplied by `budget / rawTotal`, one uniform factor, so the pool banks exactly
 *   one week and the relative order of the seeds is untouched.** Under budget,
 *   nothing is scaled.
 *
 * `series` is the record's occasion series (`deriveOccasionSeries`) for the same
 * record `stats` was derived from; see `occasionsSinceLastEaten` for what its
 * absence costs.
 */
export function seedLedger(
  stats: RecordStats,
  cutoverWeek: string,
  structuralDishIds: ReadonlySet<number>,
  cap: number | "pool",
  series?: OccasionSeries,
): Ledger {
  const raw = new Map<string, number>();
  const seeded = new Set<string>();
  const scopeOfKey = new Map<string, Scope>();
  const budget: Record<Scope, number> = {
    weekdayBreakfast: 0,
    weekdayLunch: 0,
    saturday: 0,
    fruit: 0,
  };

  for (const dishId of [...stats.perDish.keys()].sort((a, b) => a - b)) {
    const dish = stats.perDish.get(dishId);
    if (!dish) continue;
    const structural = structuralDishIds.has(dishId);
    for (const scope of SCOPES) {
      const rate = rateIn(stats, dishId, scope);
      if (rate === undefined) continue;
      const key = ledgerKey(dishId, scope);
      if (!structural) {
        raw.set(key, 0);
        continue;
      }
      const occasions = occasionsSinceLastEaten(
        stats,
        dish.lastEatenWeek,
        cutoverWeek,
        scope,
        series,
      );
      raw.set(key, rate * occasions);
      seeded.add(key);
      scopeOfKey.set(key, scope);
      budget[scope] += rate * PLANNED_OCCASIONS[scope];
    }
  }

  if (cap === "pool") {
    const rawTotal: Record<Scope, number> = {
      weekdayBreakfast: 0,
      weekdayLunch: 0,
      saturday: 0,
      fruit: 0,
    };
    for (const key of seeded) rawTotal[scopeOfKey.get(key) as Scope] += raw.get(key) as number;
    for (const key of seeded) {
      const scope = scopeOfKey.get(key) as Scope;
      const total = rawTotal[scope];
      if (total <= budget[scope] || total <= 0) continue;
      raw.set(key, (raw.get(key) as number) * (budget[scope] / total));
    }
  } else {
    for (const key of seeded) raw.set(key, Math.min(raw.get(key) as number, cap));
  }

  return freeze(raw);
}

/**
 * §3's accrual: before generating a week, every eligible dish gains
 * `rate x plannedOccasions[scope]` in each scope it is present in.
 *
 * A dish outside `eligibleDishIds` (inactive, out of season, or in no v6 pool at
 * all) is skipped entirely: its deficit neither grows nor decays, it freezes until
 * it returns. A dish present in a scope but with no ledger entry yet (an
 * optional-pool dish seeded at zero, or one whose first as-eaten row has just
 * landed) gains its entry here.
 */
export function accrue(
  ledger: Ledger,
  stats: RecordStats,
  eligibleDishIds: ReadonlySet<number>,
  plannedOccasions: Record<Scope, number>,
): Ledger {
  const next = new Map(ledger.deficits);
  for (const dishId of [...stats.perDish.keys()].sort((a, b) => a - b)) {
    if (!eligibleDishIds.has(dishId)) continue;
    for (const scope of SCOPES) {
      const rate = rateIn(stats, dishId, scope);
      if (rate === undefined) continue;
      const planned = plannedOccasions[scope] ?? 0;
      const key = ledgerKey(dishId, scope);
      next.set(key, (next.get(key) ?? 0) + rate * planned);
    }
  }
  return freeze(next);
}

/**
 * §3's charge: one serving out of the dish's ledger in the scope it was served in.
 *
 * Charging a dish that has no ledger entry in the scope creates one at -1. That is
 * the reconciliation case: a hand swap-in the record has never carried before is
 * pushed below every accruing dish so it is not immediately re-proposed.
 */
export function charge(ledger: Ledger, dishId: number, scope: Scope): Ledger {
  const next = new Map(ledger.deficits);
  const key = ledgerKey(dishId, scope);
  next.set(key, (next.get(key) ?? 0) - 1);
  return freeze(next);
}

/**
 * The inverse of `charge`, for engine-internal repairs only.
 *
 * §6 step 6's constraint pass may replace a dish it just placed; that placement's
 * charge is refunded and the replacement is charged. The §3 no-refund rule applies
 * to household swap-outs, which are not repairs: a dish the household removed keeps
 * its charge.
 */
export function refund(ledger: Ledger, dishId: number, scope: Scope): Ledger {
  const next = new Map(ledger.deficits);
  const key = ledgerKey(dishId, scope);
  next.set(key, (next.get(key) ?? 0) + 1);
  return freeze(next);
}

/**
 * §3's reconciliation: when a record week closes, charge every as-eaten row the
 * week's `generatedPlan` did not contain (the household's swap-ins).
 *
 * A dish the engine placed and the household swapped out keeps its charge; nothing
 * is refunded here. Matching is a multiset match on (scope, dish id) within the
 * week, so a dish the engine put on Monday and the household ate on Wednesday is not
 * charged twice for one serving (see `unmatchedEatenPicks`).
 *
 * A week whose `generatedPlan` is null has no recorded placements, so nothing was
 * charged for it at generation time and every as-eaten row is charged here; the
 * books balance either way, one charge per serving.
 *
 * `season` scopes the fruit rows: the fruit ledger is season-scoped (§2.2), so a
 * mango eaten in a Summer week is not charged against a Monsoon-scoped ledger it
 * never accrues in. `fruitAllSeason` is the §2.2 fallback flag (true when the
 * requested season has no record occasions at all, so every week's fruit rows
 * count); `replayLedger` passes the record's real value, and it defaults to false
 * for a caller holding only one week.
 */
export function reconcile(
  ledger: Ledger,
  week: RecordWeek,
  library: readonly Dish[],
  season: Season,
  fruitAllSeason = false,
): Ledger {
  const eaten = countedPicksOfWeek(week.picks, week.weekStart, library, season, fruitAllSeason);
  const planned = countedPicksOfWeek(
    week.generatedPlan ?? [],
    week.weekStart,
    library,
    season,
    fruitAllSeason,
  );
  let next = ledger;
  for (const entry of unmatchedEatenPicks(eaten, planned)) {
    next = charge(next, entry.pick.dishId, entry.scope);
  }
  return next;
}

/** Everything `replayLedger` reads. */
export interface ReplayLedgerArgs {
  /** Every record week before the week being generated; need not be sorted (§2.1). */
  record: RecordWeek[];
  library: Dish[];
  season: Season;
  /** The first week the engine generated: where the cold start sits (§3, §12). */
  cutoverWeek: string;
  /** Stream B's structural-pool dish ids; only these are seeded (§3). */
  structuralDishIds: ReadonlySet<number>;
  /** §11 gate variants. Production passes nothing. */
  variant?: GenerateWeekV6Variant;
  /**
   * The week being generated. Replay stops **before** it: the caller accrues the
   * generating week itself after replay, because that accrual uses the same stats
   * the caller is about to select from.
   *
   * Optional and additive to the shape the phase plan fixed. Without it the replay
   * runs through the last record week, which is right whenever the generating week
   * directly follows the record; passing it also replays the accrual of any gap
   * weeks between the last record row and the generating week (§3.1's "a week with
   * no `currentWeek` row accrues only").
   */
  weekStart?: string;
}

/**
 * §3.1: the whole ledger, replayed from persisted data.
 *
 * Seed at `cutoverWeek` from the record before it, then walk one week at a time from
 * the cutover week up to (not including) the generating week. Each step accrues
 * against the record as it stood before that week, charges what the engine placed
 * that week, and reconciles that week's as-eaten rows. A week with no record row
 * accrues only.
 *
 * Variants honoured (§11): `frozenRates` (every accrual uses the cutover record's
 * rates instead of re-deriving them), `coldStartCap` (the seed cap, per dish or
 * `"pool"`), `seedOptionalPools` (seed every dish present in a scope, not only the
 * structural ones), and `rateFormula` (§14 item 1). `familyGovernor` is stream C's
 * and is not read here.
 *
 * Weeks are walked in seven-day steps from `cutoverWeek`, which assumes every
 * `weekStart` in the record is a Monday aligned with the cutover week, as the
 * backend writes them.
 */
export function replayLedger(args: ReplayLedgerArgs): Ledger {
  const { record, library, season, cutoverWeek, structuralDishIds, variant } = args;
  const rateFormula = variant?.rateFormula;
  const sorted = [...record].sort((a, b) =>
    a.weekStart < b.weekStart ? -1 : a.weekStart > b.weekStart ? 1 : 0,
  );

  const before = sorted.filter((week) => week.weekStart < cutoverWeek);
  const cutoverStats = deriveRecordStats(before, library, season, { rateFormula });
  const seedSet = variant?.seedOptionalPools
    ? new Set(cutoverStats.perDish.keys())
    : structuralDishIds;
  const cap = variant?.coldStartCap ?? DEFAULT_COLD_START_CAP;
  let ledger = seedLedger(
    cutoverStats,
    cutoverWeek,
    seedSet,
    cap,
    deriveOccasionSeries(before, season),
  );

  const eligibleDishIds = new Set(
    library.filter((dish) => isEligibleDish(dish, season)).map((dish) => dish.id),
  );
  const lastRecordWeek = sorted.length > 0 ? sorted[sorted.length - 1].weekStart : cutoverWeek;
  const stop =
    args.weekStart ?? addWeeks(lastRecordWeek > cutoverWeek ? lastRecordWeek : cutoverWeek, 1);

  // §2.2's fallback is a property of the record as a whole, not of one week, so it is
  // read once and held for the whole replay rather than flipping partway through.
  const fruitAllSeason = isFruitAllSeasonFallback(sorted, season);

  for (let week = cutoverWeek; week < stop; week = addWeeks(week, 1)) {
    const stats = variant?.frozenRates
      ? cutoverStats
      : deriveRecordStats(
          sorted.filter((row) => row.weekStart < week),
          library,
          season,
          { rateFormula },
        );
    ledger = accrue(ledger, stats, eligibleDishIds, PLANNED_OCCASIONS);

    const row = sorted.find((candidate) => candidate.weekStart === week);
    if (!row) continue;

    const planned = countedPicksOfWeek(
      row.generatedPlan ?? [],
      row.weekStart,
      library,
      season,
      fruitAllSeason,
    );
    for (const entry of planned) ledger = charge(ledger, entry.pick.dishId, entry.scope);
    ledger = reconcile(ledger, row, library, season, fruitAllSeason);
  }

  return ledger;
}
