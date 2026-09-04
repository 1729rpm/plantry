import type { CatalogIngredient, Dish, Ingredient, MealTime, Season } from "../data/schemas.js";
import { dishProtein, proteinBand } from "../nutrition.js";
import { proteinFamilyV6, type PoolProvider } from "./place.js";
import type {
  GenerateWeekV6Variant,
  Ledger,
  PickRole,
  RecordStats,
  RecordWeek,
  Scope,
} from "./types.js";

/**
 * v6 §7: exploration, the novelty channel.
 *
 * Exactly one placement a week, into a weekday lunch position, is the only door
 * through which a never-eaten dish enters a menu. Everything else in v6 is
 * record-matching, so this module is the one sanctioned exception, and it is a
 * product dial rather than a mechanism the rest of the engine depends on.
 *
 * The affinity score is the familiar-but-new score of `engine/src/explore.ts`
 * (shared-primary-ingredient frequency, protein-band proximity to the household
 * median, category familiarity, equal-weight sum, id tiebreak). Its arithmetic
 * is COPIED here rather than imported: stream H deletes `explore.ts` at cutover,
 * and v6 changes what the score is computed over. Two differences from the
 * original, both from §7's amendment:
 *
 *   1. The profile is built from RECORD ROWS of the candidate's own meal type,
 *      not from the whole cooking history. Scored over everything, egg read as
 *      the most familiar lunch ingredient because it dominates breakfast, and
 *      egg-led lunches ran at five times the household's rate; over lunch rows,
 *      egg is one lunch in 44.
 *   2. Frequencies count rows, not distinct dishes. "One lunch in 44" is a row
 *      count, and a dish the household eats weekly should read as more familiar
 *      than one it ate once.
 *
 * Pure and deterministic: no clock, no RNG, ties bottom out at dish id ascending.
 */

/** The structured "why it fits" key, unchanged from `explore.ts` so the UI's line keeps working. */
export type ExploreAffinityKey = "shared-ingredient" | "protein-match" | "familiar-category";

/** Fixed dominant-affinity tiebreak order, unchanged from `explore.ts`. */
const AFFINITY_PRIORITY: ExploreAffinityKey[] = [
  "shared-ingredient",
  "protein-match",
  "familiar-category",
];

/** One ranked candidate. Same shape `explore.ts` returns, so the Explore surface is unchanged. */
export interface ExploreRankedDishV6 {
  dish: Dish;
  /** Equal-weight sum of the three normalised affinity signals. */
  score: number;
  signals: {
    sharedIngredient: number;
    proteinMatch: number;
    familiarCategory: number;
  };
  /** The single signal that contributed most; the UI phrases the line from it. */
  dominantAffinity: ExploreAffinityKey;
}

/**
 * The per-dish macro inputs the protein-band signal needs. Optional throughout:
 * `RecordStats` carries no macros and the v6 spec derives protein from the
 * ingredient rows and the catalog (`docs/engine.md` §11), so a caller that has
 * not loaded them gets a score built from the other two signals, with every
 * candidate's `proteinMatch` at zero rather than a fabricated value.
 */
export interface NutritionInputs {
  ingredients: Ingredient[];
  catalog: CatalogIngredient[];
}

/** How many trailing generated weeks the §7 spacing rule and the family governor read. */
export const EXPLORATION_WINDOW_WEEKS = 8;

// ---------------------------------------------------------------------------
// The candidate pool (§7)
// ---------------------------------------------------------------------------

function isActive(dish: Dish): boolean {
  return dish.active === "Yes";
}

function inSeason(dish: Dish, season: Season): boolean {
  return dish.seasons === "All" || dish.seasons.includes(season);
}

/**
 * A candidate is a dish with no as-eaten row in any scope (§2.2): never a
 * repertoire member, so it never enters an ordinary position pool and can only
 * arrive through this channel or the §9 fruit overflow.
 */
function isCandidate(dishId: number, stats: RecordStats): boolean {
  const entry = stats.perDish.get(dishId);
  if (!entry) return true;
  return Object.values(entry.eatenCount).every((count) => count === 0);
}

/** The trailing generated weeks the §7 window reads, oldest first. */
function trailingGeneratedWeeks(record: readonly RecordWeek[]): RecordWeek[] {
  return record.filter((week) => week.generatedPlan !== null).slice(-EXPLORATION_WINDOW_WEEKS);
}

/**
 * §7 spacing: dish ids explored and not eaten inside the trailing window.
 *
 * A dish that a week's `generatedPlan` contains and that week's as-eaten picks
 * do not is a dish the household was offered and did not eat. It is not
 * re-proposed for 8 generated weeks, which is what stops the channel from
 * pushing the same rejected dish week after week.
 */
export function exploredAndUneaten(record: readonly RecordWeek[]): Set<number> {
  const ids = new Set<number>();
  for (const week of trailingGeneratedWeeks(record)) {
    const eaten = new Set(week.picks.map((pick) => pick.dishId));
    for (const planned of week.generatedPlan ?? []) {
      if (!eaten.has(planned.dishId)) ids.add(planned.dishId);
    }
  }
  return ids;
}

export interface CandidatePoolArgs {
  library: Dish[];
  stats: RecordStats;
  season: Season;
  /** Restrict to these meal times. §7's placement pool is Lunch only. */
  mealTimes?: readonly MealTime[];
  /** Record weeks, ascending. Omit to skip the §7 spacing filter (the Explore surface does). */
  record?: readonly RecordWeek[];
  /** Ids already in this week's plan (a favorite pinned in §6 step 2, say). */
  exclude?: ReadonlySet<number>;
}

/** Every Active, in-season candidate of the requested meal times, id ascending. */
export function candidatePool(args: CandidatePoolArgs): Dish[] {
  const { library, stats, season, mealTimes, record, exclude } = args;
  const blocked = record ? exploredAndUneaten(record) : new Set<number>();
  return library
    .filter(
      (dish) =>
        isActive(dish) &&
        inSeason(dish, season) &&
        (mealTimes === undefined || mealTimes.includes(dish.time)) &&
        isCandidate(dish.id, stats) &&
        !blocked.has(dish.id) &&
        !(exclude?.has(dish.id) ?? false),
    )
    .sort((a, b) => a.id - b.id);
}

// ---------------------------------------------------------------------------
// The affinity score (§7), computed over record rows of one meal type
// ---------------------------------------------------------------------------

/**
 * Count each value's frequency and normalise so the most frequent scores 1.0.
 * Copied from `engine/src/explore.ts`; an empty list yields an empty map, so
 * every lookup then reads as zero.
 */
function normalisedFrequency(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  let max = 0;
  for (const count of counts.values()) if (count > max) max = count;
  const out = new Map<string, number>();
  if (max === 0) return out;
  for (const [name, count] of counts) out.set(name, count / max);
  return out;
}

/** Median of a numeric list (lower-middle for even counts); zero for an empty list. Copied from `explore.ts`. */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)];
}

/** The scope whose record rows score a candidate of this meal time (§7's "own meal type"). */
function scopeForMealTime(time: MealTime): Scope {
  return time === "Lunch" ? "weekdayLunch" : "weekdayBreakfast";
}

interface AffinityProfile {
  primaryFreq: Map<string, number>;
  categoryFreq: Map<string, number>;
  medianBand: number;
}

/**
 * Build the affinity profile of one scope from the record's as-eaten rows.
 *
 * Weekday rows only: Saturday is its own register (§2.2) and the treat plate is
 * not what a weekday lunch candidate should look like.
 */
function buildProfile(
  scope: Scope,
  record: readonly RecordWeek[],
  dishById: ReadonlyMap<number, Dish>,
  ingredientsByDishId: Map<number, Ingredient[]>,
  catalog: CatalogIngredient[] | undefined,
): AffinityProfile {
  const wantedMeal = scope === "weekdayLunch" ? "lunch" : "breakfast";
  const primaries: string[] = [];
  const categories: string[] = [];
  const proteins: number[] = [];
  for (const week of record) {
    for (const pick of week.picks) {
      if (pick.meal !== wantedMeal || pick.day === "Sat") continue;
      const dish = dishById.get(pick.dishId);
      if (!dish) continue;
      primaries.push(dish.primaryIngredient);
      categories.push(dish.category);
      if (catalog) proteins.push(dishProtein(dish, ingredientsByDishId, catalog));
    }
  }
  return {
    primaryFreq: normalisedFrequency(primaries),
    categoryFreq: normalisedFrequency(categories),
    medianBand: proteinBand(median(proteins)),
  };
}

function scoreDish(
  dish: Dish,
  profile: AffinityProfile,
  ingredientsByDishId: Map<number, Ingredient[]>,
  catalog: CatalogIngredient[] | undefined,
): ExploreRankedDishV6 {
  const sharedIngredient = profile.primaryFreq.get(dish.primaryIngredient) ?? 0;
  const familiarCategory = profile.categoryFreq.get(dish.category) ?? 0;
  const proteinMatch = catalog
    ? 1 /
      (1 +
        Math.abs(proteinBand(dishProtein(dish, ingredientsByDishId, catalog)) - profile.medianBand))
    : 0;

  const byKey: Record<ExploreAffinityKey, number> = {
    "shared-ingredient": sharedIngredient,
    "protein-match": proteinMatch,
    "familiar-category": familiarCategory,
  };
  let dominantAffinity: ExploreAffinityKey = AFFINITY_PRIORITY[0];
  for (const key of AFFINITY_PRIORITY) {
    if (byKey[key] > byKey[dominantAffinity]) dominantAffinity = key;
  }

  return {
    dish,
    score: sharedIngredient + proteinMatch + familiarCategory,
    signals: { sharedIngredient, proteinMatch, familiarCategory },
    dominantAffinity,
  };
}

function indexIngredients(ingredients: Ingredient[] | undefined): Map<number, Ingredient[]> {
  const byDishId = new Map<number, Ingredient[]>();
  for (const row of ingredients ?? []) {
    const list = byDishId.get(row.dishId);
    if (list) list.push(row);
    else byDishId.set(row.dishId, [row]);
  }
  return byDishId;
}

export interface RankExploreV6Options {
  /** Macro inputs for the protein-band signal. Without them that signal reads zero for every dish. */
  nutrition?: NutritionInputs;
  /**
   * Meal times to rank. Defaults to both, because the Explore surface shows
   * novelty across the whole library; §7's placement pool passes `["Lunch"]`.
   * Each candidate is scored against the record rows of its OWN meal type,
   * which is what §7's amendment asks for.
   */
  mealTimes?: readonly MealTime[];
}

/**
 * Rank the whole candidate pool familiar-but-new, for the Explore surface.
 *
 * The §7 spacing window and the family governor are deliberately absent: they
 * govern what the ENGINE proposes, not what the household is allowed to browse.
 */
export function rankExploreV6(
  stats: RecordStats,
  library: Dish[],
  season: Season,
  record: readonly RecordWeek[] = [],
  options: RankExploreV6Options = {},
): ExploreRankedDishV6[] {
  const mealTimes = options.mealTimes ?? (["Breakfast", "Lunch"] as const);
  const dishById = new Map<number, Dish>();
  for (const dish of library) dishById.set(dish.id, dish);
  const ingredientsByDishId = indexIngredients(options.nutrition?.ingredients);
  const catalog = options.nutrition?.catalog;

  const profiles = new Map<Scope, AffinityProfile>();
  const profileFor = (time: MealTime): AffinityProfile => {
    const scope = scopeForMealTime(time);
    const cached = profiles.get(scope);
    if (cached) return cached;
    const built = buildProfile(scope, record, dishById, ingredientsByDishId, catalog);
    profiles.set(scope, built);
    return built;
  };

  const ranked = candidatePool({ library, stats, season, mealTimes }).map((dish) =>
    scoreDish(dish, profileFor(dish.time), ingredientsByDishId, catalog),
  );

  ranked.sort((a, b) => (b.score !== a.score ? b.score - a.score : a.dish.id - b.dish.id));
  return ranked;
}

// ---------------------------------------------------------------------------
// The family governor (§7)
// ---------------------------------------------------------------------------

/**
 * Protein families served at or above their record rate over the trailing 8
 * generated weeks. A candidate in one of these families is demoted below every
 * other candidate, so novelty does not pile more paneer onto a week that
 * already carries the household's share of it.
 *
 * Both sides are measured per occasion (§2.2): the recent side over the weekday
 * lunch placements of the trailing generated plans, the record side over the
 * record's weekday lunch occasions. A family with no recent placement is never
 * demoted, which is the guard that keeps the governor from demoting every
 * never-served family at once (0 is not "at or above" a rate of 0 in any sense
 * §7 intends).
 */
export function demotedFamilies(
  record: readonly RecordWeek[],
  library: Dish[],
  stats: RecordStats,
): Set<string> {
  const dishById = new Map<number, Dish>();
  for (const dish of library) dishById.set(dish.id, dish);

  let recentSlots = 0;
  const recentByFamily = new Map<string, number>();
  for (const week of trailingGeneratedWeeks(record)) {
    for (const planned of week.generatedPlan ?? []) {
      if (planned.meal !== "lunch" || planned.day === "Sat") continue;
      recentSlots += 1;
      const dish = dishById.get(planned.dishId);
      if (!dish) continue;
      const family = proteinFamilyV6(dish);
      recentByFamily.set(family, (recentByFamily.get(family) ?? 0) + 1);
    }
  }
  if (recentSlots === 0) return new Set<string>();

  const recordByFamily = new Map<string, number>();
  for (const [dishId, dishStats] of stats.perDish) {
    const dish = dishById.get(dishId);
    if (!dish) continue;
    const family = proteinFamilyV6(dish);
    const eaten = dishStats.eatenCount.weekdayLunch;
    if (eaten > 0) recordByFamily.set(family, (recordByFamily.get(family) ?? 0) + eaten);
  }
  const occasions = stats.occasions.weekdayLunch;

  const demoted = new Set<string>();
  for (const [family, count] of recentByFamily) {
    const recentRate = count / recentSlots;
    const recordRate = occasions > 0 ? (recordByFamily.get(family) ?? 0) / occasions : 0;
    if (recentRate >= recordRate) demoted.add(family);
  }
  return demoted;
}

// ---------------------------------------------------------------------------
// The pick (§6 step 3, §7)
// ---------------------------------------------------------------------------

/**
 * Which weekday lunch position a candidate's shape can fill (§5.1).
 *
 * The star pool is the HP-tagged dishes and Category Gravy dish, Keto, and
 * Complete meal; Accompaniment dishes are companions, never stars. A candidate
 * is not in any pool by definition (§2.2), so this is a SHAPE test rather than
 * a pool-membership test: it asks whether the slot could legitimately hold the
 * dish once the plate is built around it in §6 step 4.
 */
export function lunchRoleFor(dish: Dish): PickRole | null {
  if (dish.time !== "Lunch") return null;
  if (dish.category === "Accompaniment") return "companion";
  if (
    dish.tags.includes("HP") ||
    dish.category === "Gravy dish" ||
    dish.category === "Keto" ||
    dish.category === "Complete meal"
  ) {
    return "star";
  }
  if (dish.category === "Dry dish") return "companion";
  return null;
}

export interface PickExplorationArgs {
  library: Dish[];
  stats: RecordStats;
  /** Every record week before the week being generated, ascending. */
  record: readonly RecordWeek[];
  season: Season;
  /**
   * The replayed ledger. Part of the fixed §6 signature so stream D can call
   * every step alike; a candidate has no ledger entry by §2.2, so the pick does
   * not read it.
   */
  ledger: Ledger;
  /**
   * Stream B's ranked pools. Part of the fixed signature for the same reason:
   * the exploration pick is chosen by affinity, not by deficit, so it does not
   * consult a pool.
   */
  provider: PoolProvider;
  /** Ids already in this week's plan (§6 step 2's pinned favorites). */
  exclude?: ReadonlySet<number>;
  variant?: GenerateWeekV6Variant;
  /** Macro inputs for the protein-band signal (see `NutritionInputs`). */
  nutrition?: NutritionInputs;
}

export interface ExplorationPick {
  dish: Dish;
  family: string;
  role: PickRole;
}

/**
 * §6 step 3: the single exploration placement, or null when nothing fits.
 *
 * The candidate pool is ranked by affinity, the family governor pushes at-rate
 * families below everything else, and the first candidate whose shape a weekday
 * lunch position accepts wins. If no candidate exists, or none has a lunch
 * shape, the week runs no exploration placement, which §7 explicitly allows.
 */
export function pickExploration(args: PickExplorationArgs): ExplorationPick | null {
  const { library, stats, record, season, exclude, variant, nutrition } = args;

  const candidates = candidatePool({
    library,
    stats,
    season,
    mealTimes: ["Lunch"],
    record,
    exclude,
  });
  if (candidates.length === 0) return null;

  const dishById = new Map<number, Dish>();
  for (const dish of library) dishById.set(dish.id, dish);
  const ingredientsByDishId = indexIngredients(nutrition?.ingredients);
  const profile = buildProfile(
    "weekdayLunch",
    record,
    dishById,
    ingredientsByDishId,
    nutrition?.catalog,
  );

  const governorOn = variant?.familyGovernor !== false;
  const demoted = governorOn ? demotedFamilies(record, library, stats) : new Set<string>();

  const ranked = candidates
    .map((dish) => ({
      scored: scoreDish(dish, profile, ingredientsByDishId, nutrition?.catalog),
      family: proteinFamilyV6(dish),
    }))
    .sort((a, b) => {
      const demotedA = demoted.has(a.family) ? 1 : 0;
      const demotedB = demoted.has(b.family) ? 1 : 0;
      if (demotedA !== demotedB) return demotedA - demotedB;
      if (b.scored.score !== a.scored.score) return b.scored.score - a.scored.score;
      return a.scored.dish.id - b.scored.dish.id;
    });

  for (const entry of ranked) {
    const role = lunchRoleFor(entry.scored.dish);
    if (role !== null) return { dish: entry.scored.dish, family: entry.family, role };
  }
  return null;
}
