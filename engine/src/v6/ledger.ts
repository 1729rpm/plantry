/**
 * The v6 deficit ledger (`features/engine-v6.md` §3, §3.1).
 *
 * Selection is rate-deficit scheduling: every repertoire dish carries one number per
 * scope, how far behind its own eaten rate the engine is. No table holds those
 * numbers. The ledger is a pure function of persisted data, replayed from the
 * cutover week on every generation: seed, then accrue, charge placements, and charge
 * the as-eaten rows the plan did not contain, week by week.
 *
 * §3.2's two slot-level presence ledgers (the weekday lunch companion slot and the
 * Saturday third-item slot) ride in the same map under reserved keys, so they are
 * seeded, accrued, charged, and replayed by exactly the same machinery, with no
 * second structure to keep in step.
 *
 * Every operation here returns a **new** `Ledger`; nothing mutates its input. Every
 * returned ledger's `deficits` map is rebuilt in one fixed key order (dish id
 * ascending, then scope in `SCOPES` order), so two ledgers holding the same numbers
 * serialize identically (§10).
 *
 * Two readings of §3 that the spec does not spell out, and that this module and
 * `record.ts` both hold to:
 *
 * 1. Reconciliation matches an as-eaten pick to a plan pick as a **multiset match on
 *    (scope, dish id) within the week**, not on the exact (day, meal, dish) triple.
 *    §3 charges "every as-eaten dish the engine did not place", and the engine did
 *    place a dish it put on Monday that the household ate on Wednesday; charging it
 *    again would take two servings out of the ledger for one meal.
 * 2. **Fruit charges are season-filtered.** The fruit scope is season-scoped (§2.2),
 *    so a mango eaten in a Summer week is not charged against a Monsoon-scoped ledger
 *    it never accrues in. The §2.2 all-season fallback overrides the filter, and each
 *    replayed week is filtered in its own season, not the generating week's.
 */

import type { Dish, Season } from "../data/schemas.js";
import type {
  Day,
  GenerateWeekV6Variant,
  Ledger,
  Pick,
  RecordStats,
  RecordWeek,
  Scope,
} from "./types.js";
import {
  PRESENCE_SCOPES,
  SCOPES,
  countedPicksOfWeek,
  deriveOccasionSeries,
  deriveRecordStats,
  frozenRatesStats,
  isFruitAllSeasonFallback,
  presenceDaysOf,
  rateIn,
  seasonOfWeek,
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

/**
 * The reserved prefix §3.2's presence ledgers live under. It cannot collide with a
 * dish key, whose first segment is always a decimal dish id.
 */
const PRESENCE_PREFIX = "presence:";

/**
 * The §3.2 presence-ledger key for a slot: `` `presence:${scope}` ``.
 *
 * Two of these exist, `presence:weekdayLunch` (the weekday lunch companion slot)
 * and `presence:saturday` (the Saturday third-item slot). They hold the slot's
 * presence deficit rather than any dish's, and they share `Ledger.deficits` so that
 * §3.1's replay carries them with no second structure to seed, accrue, or persist.
 */
export function presenceKey(scope: Scope): string {
  return `${PRESENCE_PREFIX}${scope}`;
}

/** The presence deficit of a §3.2 slot, or 0 when the ledger has no entry for it yet. */
export function presenceDeficitIn(ledger: Ledger, scope: Scope): number {
  return ledger.deficits.get(presenceKey(scope)) ?? 0;
}

/**
 * Key order: the reserved presence keys first, in `PRESENCE_SCOPES` order, then the
 * dish keys by dish id ascending and scope in `SCOPES` order. Total and independent
 * of insertion order, which is what makes a serialized ledger a stable fingerprint
 * (§10).
 */
function compareKeys(a: string, b: string): number {
  const aReserved = a.startsWith(PRESENCE_PREFIX);
  const bReserved = b.startsWith(PRESENCE_PREFIX);
  if (aReserved || bReserved) {
    if (aReserved !== bReserved) return aReserved ? -1 : 1;
    return (
      PRESENCE_SCOPES.indexOf(a.slice(PRESENCE_PREFIX.length) as Scope) -
      PRESENCE_SCOPES.indexOf(b.slice(PRESENCE_PREFIX.length) as Scope)
    );
  }
  const aColon = a.lastIndexOf(":");
  const bColon = b.lastIndexOf(":");
  const dish = Number(a.slice(0, aColon)) - Number(b.slice(0, bColon));
  if (dish !== 0) return dish;
  return (
    SCOPES.indexOf(a.slice(aColon + 1) as Scope) - SCOPES.indexOf(b.slice(bColon + 1) as Scope)
  );
}

/**
 * The days of a pick list on which the §3.2 optional element was present, for one
 * scope.
 *
 * One line of delegation to `record.ts`, which owns the presence definition (its
 * module doc comment states it): any third item on a Saturday, and on a weekday
 * lunch a third item that is not the §5.1 protein-floor append. The replay charges
 * by the same reading the record's rate is measured with, so a presence ledger
 * accrued from the record is paid down by exactly the occasions the record would
 * have counted.
 */
export function presenceDays(
  picks: readonly Pick[],
  scope: Scope,
  library: readonly Dish[],
): Set<Day> {
  return presenceDaysOf(picks, scope, library);
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

  // §3.2: the presence ledgers are seeded at zero, never backdated. A slot has no
  // "last served" week to accrue from, and seeding one would bank a transient of
  // exactly the kind §3's cold-start amendment removed from the optional pools.
  for (const scope of PRESENCE_SCOPES) raw.set(presenceKey(scope), 0);

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
  // §3.2: each presence ledger accrues its scope's record presence rate times the
  // scope's planned occasions, on the same clock as a dish's deficit. A scope the
  // record has no occasions for accrues nothing, exactly as an absent rate does.
  for (const scope of PRESENCE_SCOPES) {
    const rate = stats.presenceRate[scope];
    if (rate === undefined) continue;
    const key = presenceKey(scope);
    next.set(key, (next.get(key) ?? 0) + rate * (plannedOccasions[scope] ?? 0));
  }
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
 * §3.2's presence charge: one occasion out of a slot's presence ledger.
 *
 * Charged once per planned occasion whose plate carried the optional element. On
 * Saturday that is any third item, the structural dry-protein partner and the
 * special protein beside an everyday base included (§5.4 gives those forms the
 * third item's place, so they consume the slot's presence just as an accompaniment
 * would). On a weekday lunch it is the companion and only the companion: the §5.1
 * protein-floor append is a safety net that fires when the day carries no protein
 * at all, so it is not the optional element and does not spend the slot's budget.
 */
export function chargePresence(ledger: Ledger, scope: Scope): Ledger {
  const next = new Map(ledger.deficits);
  const key = presenceKey(scope);
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
  const eaten = countedPicksOfWeek(week, "eaten", library, season, fruitAllSeason);
  const planned = countedPicksOfWeek(week, "planned", library, season, fruitAllSeason);
  let next = ledger;
  for (const entry of unmatchedEatenPicks(eaten, planned)) {
    next = charge(next, entry.pick.dishId, entry.scope);
  }
  // §3.2: a hand-added optional element is charged at reconciliation, and a removed
  // one keeps its charge, exactly as §3 treats a dish. So an occasion the household
  // ate a third item on that the plan did not carry is charged here, and an occasion
  // the plan carried one on that the household stripped is not refunded (it was
  // charged by `chargePlanPresence` and stays charged).
  const eatenPicks = eaten.map((entry) => entry.pick);
  const plannedPicks = planned.map((entry) => entry.pick);
  for (const scope of PRESENCE_SCOPES) {
    const fromPlan = presenceDays(plannedPicks, scope, library);
    for (const day of presenceDays(eatenPicks, scope, library)) {
      if (!fromPlan.has(day)) next = chargePresence(next, scope);
    }
  }
  return next;
}

/**
 * §3.2's presence charge for what the engine placed in a record week: one charge per
 * planned occasion whose plate carried the optional element.
 *
 * The mirror of the dish plan charges in §3.1's replay, and it runs beside them so
 * the two ledgers stay on one clock. A week with no `generatedPlan` charges nothing
 * here; `reconcile` then charges every occasion the household's own plates carried,
 * which is the same one-charge-per-occasion bookkeeping from the other side.
 */
export function chargePlanPresence(
  ledger: Ledger,
  week: RecordWeek,
  library: readonly Dish[],
  season: Season,
  fruitAllSeason = false,
): Ledger {
  const planned = countedPicksOfWeek(week, "planned", library, season, fruitAllSeason).map(
    (entry) => entry.pick,
  );
  let next = ledger;
  for (const scope of PRESENCE_SCOPES) {
    const occasions = presenceDays(planned, scope, library).size;
    for (let index = 0; index < occasions; index += 1) next = chargePresence(next, scope);
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
 * **Every replayed week is replayed in its own season.** A replay can span a season
 * boundary, and §3 says an out-of-season dish neither accrues nor decays while §2.2
 * scopes fruit rates by the season the week falls in. So each iteration derives its
 * own `seasonOfWeek(week)` and uses it for that week's eligibility set, for the stats
 * it accrues against, for the plan charges, for reconciliation, and for the §2.2
 * fruit fallback evaluated against the record as it stood before that week. The
 * `season` argument names the **generating** week's season, must agree with
 * `seasonOfWeek(weekStart)`, and is never applied to a replayed week. Without this a
 * replay run in Summer would accrue every Summer-only dish through the intervening
 * Monsoon and Winter weeks and bank dozens of servings for it.
 *
 * Variants honoured (§11): `frozenRates` (every accrual uses the cutover **record**'s
 * rates, §3.2's slot presence rates included, while the memories the record carries
 * track the record as it stands, the split `frozenRatesStats` states; the fruit season scope is
 * still evaluated per replayed week's season against the fixed record, and each
 * season's rate derivation is cached so the loop stays cheap),
 * `coldStartCap` (the seed cap, per dish or `"pool"`), `seedOptionalPools` (seed every
 * dish present in a scope, not only the structural ones), and `rateFormula` (§14
 * item 1). `familyGovernor` is stream C's and is not read here.
 *
 * The cold start is seeded in the **cutover week's** season for the same reason: the
 * seed is the backdated accrual the cutover week would have had, and the first
 * iteration of the loop is that week.
 *
 * Weeks are walked in seven-day steps from `cutoverWeek`, which assumes every
 * `weekStart` in the record is a Monday aligned with the cutover week, as the
 * backend writes them.
 */
export function replayLedger(args: ReplayLedgerArgs): Ledger {
  const { record, library, season, cutoverWeek, structuralDishIds, variant } = args;
  if (args.weekStart !== undefined && seasonOfWeek(args.weekStart) !== season) {
    throw new Error(
      `replayLedger: season ${season} is not the season of the generating week ${args.weekStart}`,
    );
  }
  const rateFormula = variant?.rateFormula;
  const sorted = [...record].sort((a, b) =>
    a.weekStart < b.weekStart ? -1 : a.weekStart > b.weekStart ? 1 : 0,
  );

  const before = sorted.filter((week) => week.weekStart < cutoverWeek);
  const cutoverSeason = seasonOfWeek(cutoverWeek);
  const cutoverStats = deriveRecordStats(before, library, cutoverSeason, { rateFormula });
  const seedSet = variant?.seedOptionalPools
    ? new Set(cutoverStats.perDish.keys())
    : structuralDishIds;
  const cap = variant?.coldStartCap ?? DEFAULT_COLD_START_CAP;
  let ledger = seedLedger(
    cutoverStats,
    cutoverWeek,
    seedSet,
    cap,
    deriveOccasionSeries(before, cutoverSeason),
  );

  const eligibleBySeason = new Map<Season, Set<number>>();
  const eligibleIn = (weekSeason: Season): ReadonlySet<number> => {
    const cached = eligibleBySeason.get(weekSeason);
    if (cached) return cached;
    const ids = new Set(
      library.filter((dish) => isEligibleDish(dish, weekSeason)).map((dish) => dish.id),
    );
    eligibleBySeason.set(weekSeason, ids);
    return ids;
  };

  // The frozen run fixes the record, not the season, so it needs one derivation per
  // season the replay crosses rather than one for the whole run. Only the rate side
  // is cached: the memories the frozen run reads live are re-derived per week below,
  // exactly as every other run derives them.
  const frozen = new Map<Season, { stats: RecordStats; fruitAllSeason: boolean }>();
  const frozenIn = (weekSeason: Season): { stats: RecordStats; fruitAllSeason: boolean } => {
    const cached = frozen.get(weekSeason);
    if (cached) return cached;
    const derived = {
      stats: deriveRecordStats(before, library, weekSeason, { rateFormula }),
      fruitAllSeason: isFruitAllSeasonFallback(before, weekSeason),
    };
    frozen.set(weekSeason, derived);
    return derived;
  };

  const lastRecordWeek = sorted.length > 0 ? sorted[sorted.length - 1].weekStart : cutoverWeek;
  const stop =
    args.weekStart ?? addWeeks(lastRecordWeek > cutoverWeek ? lastRecordWeek : cutoverWeek, 1);

  for (let week = cutoverWeek; week < stop; week = addWeeks(week, 1)) {
    const weekSeason = seasonOfWeek(week);
    let stats: RecordStats;
    let fruitAllSeason: boolean;
    const asItStood = sorted.filter((row) => row.weekStart < week);
    if (variant?.frozenRates) {
      // §11's frozen run freezes every rate, not the memories. `accrue` reads
      // §3.2's presence rate off these stats too, and presence is a rate, so it is
      // frozen with the dish rates: a presence ledger whose target tracked the live
      // record would let the engine's own output move the bar this control measures
      // it against. `frozenRatesStats` states the whole split.
      const rates = frozenIn(weekSeason);
      stats = frozenRatesStats(
        rates.stats,
        deriveRecordStats(asItStood, library, weekSeason, { rateFormula }),
      );
      fruitAllSeason = rates.fruitAllSeason;
    } else {
      stats = deriveRecordStats(asItStood, library, weekSeason, { rateFormula });
      fruitAllSeason = isFruitAllSeasonFallback(asItStood, weekSeason);
    }
    ledger = accrue(ledger, stats, eligibleIn(weekSeason), PLANNED_OCCASIONS);

    const row = sorted.find((candidate) => candidate.weekStart === week);
    if (!row) continue;

    const planned = countedPicksOfWeek(row, "planned", library, weekSeason, fruitAllSeason);
    for (const entry of planned) ledger = charge(ledger, entry.pick.dishId, entry.scope);
    ledger = chargePlanPresence(ledger, row, library, weekSeason, fruitAllSeason);
    ledger = reconcile(ledger, row, library, weekSeason, fruitAllSeason);
  }

  return ledger;
}
