import type {
  CatalogIngredient,
  Dish,
  Ingredient,
  MenuHistoryRow,
  Season,
} from "./data/schemas.js";
import { eligibleDishes } from "./eligibility.js";
import { dishProtein, proteinBand } from "./nutrition.js";

/**
 * Explore ranking (docs/engine.md §7 Explore ranking).
 *
 * Ranks the ELIGIBLE (active, in-season), NEVER-COOKED dishes "familiar but new":
 * dishes the household has not had yet but that resemble what it actually cooks,
 * so the Explore tab surfaces novelty that still fits the household's habits
 * rather than random unseen dishes.
 *
 * Three affinity signals, each normalised to [0, 1] (1 = strongest affinity):
 *
 *   1. shared-primary-ingredient frequency. How dominant this dish's
 *      `primaryIngredient` is in cooking history: the share of cooked dishes
 *      whose primary ingredient matches, divided by the most-cooked primary
 *      ingredient's share, so the single most-cooked ingredient scores 1.0. A
 *      paneer dish scores high in a paneer-heavy history.
 *
 *   2. protein-band proximity. Closeness of this dish's per-person protein
 *      (§11 nutrition) to the household's COOKED-MEDIAN protein, measured in
 *      fixed `PROTEIN_BAND_WIDTH_GRAMS` bands: `1 / (1 + bandDistance)`, so a
 *      dish in the median band scores 1.0 and the score decays with distance. A
 *      dish in the household's usual protein range scores high.
 *
 *   3. category familiarity. How common this dish's `category` is in history,
 *      normalised the same way as signal 1 (most-cooked category = 1.0).
 *
 * COMBINED SCORE = the equal-weight sum of the three signals (no RNG). Dishes
 * rank by combined score descending, ties broken by dish id ascending, so the
 * ranking is fully deterministic and input-order-independent.
 *
 * DOMINANT-AFFINITY KEY. Each ranked dish also carries the single signal that
 * contributed most to its score, as a STRUCTURED KEY (`shared-ingredient` /
 * `protein-match` / `familiar-category`), NOT UI prose (Principle 7: display
 * decoupled from structure). The UI phrases the "why it fits" line from the key;
 * no sentence text leaks out of the engine. Ties between equal signal values
 * resolve by a fixed priority order (shared-ingredient, then protein-match, then
 * familiar-category), so the key is deterministic too.
 *
 * Pure function: same inputs always produce the same ranking. Powers the
 * Explore tab (§7).
 */

/**
 * ============================================================================
 * The weekly exploration slot (`features/engine-v4.md` §10.5)
 * ============================================================================
 *
 * Distinct from `rankExplore` below, which powers the Explore TAB. This is the
 * one position per generated week that is deliberately ranked for novelty rather
 * than for what the household already eats, so the repertoire can grow without
 * anyone going looking for a new dish.
 *
 * Two rules, both of which exist because of measured failures:
 *
 *   - It ROTATES across the week's companion positions rather than sitting on
 *     Friday. A fixed novelty position is a fixed position: the same weekday's
 *     companion is the only one that ever sees a new dish, so 19 of 20 explored
 *     dishes were served exactly once in 25 weeks and coverage stalled at 52 of
 *     261 active dishes.
 *   - Rule 7 (`pairsWith`) can no longer consume it. Rule 7 took the single
 *     novelty slot on 6 of 25 Fridays, which is a quarter of the year's
 *     discovery budget spent on a pairing the household already knows.
 *
 * This slot is DISCOVERY ONLY. §10.5 paired it with a retention credit in §4
 * step 1 (an explored dish the household kept would re-enter ranking at credit 2
 * rather than 1); that half is deferred out of this phase (§11.3) because it
 * needs the exploration role persisted through finalize, and because the
 * mechanism has no evidence behind it yet. Until it returns, a dish this slot
 * introduces re-enters at credit 1 like any other once-eaten dish, and its route
 * back onto a plate is the §4.7 guard opening a slot for it, or a human signal
 * (a favorite, the wishlist, a swap).
 */

/** A companion position that is eligible to carry the week's exploration slot. */
export interface ExplorationPosition {
  /** Short day name, e.g. "Wed". */
  day: string;
  /** Meal the position sits in. */
  meal: string;
  /** Index of the position within its slot's pick order. */
  index: number;
}

/** Whole weeks between the epoch and an ISO Monday; the rotation counter. */
function weekIndex(weekStart: string): number {
  return Math.floor(new Date(`${weekStart}T00:00:00Z`).getTime() / (7 * 86400000));
}

/**
 * Pick which of this week's companion positions carries the exploration slot.
 *
 * Deterministic and RNG-free (the engine has no randomness anywhere), but it
 * advances by one position per calendar week, so over a run every companion
 * position takes its turn. The rotation is keyed on the week's absolute index
 * rather than on a counter carried in state, so a regenerated week always lands
 * on the same position and two runs of the same week agree.
 *
 * Callers pass the positions in a stable order (schedule order). An empty list
 * returns undefined, which means "this week has no exploration slot" and is the
 * correct answer for a week whose composition produced no companion positions.
 */
export function chooseExplorationPosition(args: {
  weekStart: string;
  positions: readonly ExplorationPosition[];
}): ExplorationPosition | undefined {
  const { weekStart, positions } = args;
  if (positions.length === 0) return undefined;
  const index = ((weekIndex(weekStart) % positions.length) + positions.length) % positions.length;
  return positions[index];
}

/**
 * Rank a pool for the exploration slot: PURE longest-unused with never-cooked
 * first. Deliberately ignores both the saturating frequency credit and the
 * repeat guard, because this is the one position whose whole job is to propose
 * something the household has not eaten. Applying frequency here would rank the
 * proven repertoire first and there would be no discovery at all; applying the
 * guard is pointless when the leading candidates have never been cooked.
 *
 * Ties (including the never-cooked dishes, which all tie) break by dish id
 * ascending, so the ranking is deterministic and input-order-independent.
 */
export function rankExploration(pool: Dish[], history: MenuHistoryRow[]): Dish[] {
  const lastCooked = new Map<number, string>();
  for (const row of history) {
    const existing = lastCooked.get(row.dishId);
    if (existing === undefined || row.weekStart > existing)
      lastCooked.set(row.dishId, row.weekStart);
  }
  return [...pool].sort((a, b) => {
    const aDate = lastCooked.get(a.id);
    const bDate = lastCooked.get(b.id);
    if (aDate === undefined && bDate !== undefined) return -1;
    if (bDate === undefined && aDate !== undefined) return 1;
    if (aDate !== undefined && bDate !== undefined && aDate !== bDate)
      return aDate < bDate ? -1 : 1;
    return a.id - b.id;
  });
}

/** The structured "why it fits" key. The UI phrases it; the engine never does. */
export type ExploreAffinityKey = "shared-ingredient" | "protein-match" | "familiar-category";

/** Fixed dominant-affinity tie-break order (Principle 7: deterministic key). */
const AFFINITY_PRIORITY: ExploreAffinityKey[] = [
  "shared-ingredient",
  "protein-match",
  "familiar-category",
];

export interface ExploreRankedDish {
  dish: Dish;
  /** Equal-weight sum of the three normalised affinity signals. */
  score: number;
  /** The three normalised signals (each in [0, 1]), for transparency/testing. */
  signals: {
    sharedIngredient: number;
    proteinMatch: number;
    familiarCategory: number;
  };
  /** The single signal that contributed most; the UI phrases the line from it. */
  dominantAffinity: ExploreAffinityKey;
}

export interface RankExploreArgs {
  library: Dish[];
  history: MenuHistoryRow[];
  season: Season;
  /** Per-dish ingredient rows for the whole library, for protein derivation. */
  ingredients: Ingredient[];
  /** Ingredient catalog, the per-100g macro source for protein derivation. */
  catalog: CatalogIngredient[];
}

/** Set of dish ids that appear anywhere in cooking history (= "cooked"). */
function cookedDishIds(history: MenuHistoryRow[]): Set<number> {
  const ids = new Set<number>();
  for (const row of history) ids.add(row.dishId);
  return ids;
}

/** Median of a numeric list (lower-middle for even counts); 0 for an empty list. */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor((sorted.length - 1) / 2);
  return sorted[mid];
}

/**
 * Count each value's frequency in a list and return a name -> [0,1] map
 * normalised so the most frequent value scores 1.0. An empty list yields an
 * empty map (every lookup then reads as 0).
 */
function normalisedFrequency(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let max = 0;
  for (const c of counts.values()) if (c > max) max = c;
  const out = new Map<string, number>();
  if (max === 0) return out;
  for (const [name, count] of counts) out.set(name, count / max);
  return out;
}

/**
 * Rank the eligible, never-cooked dishes familiar-but-new. Returns the full
 * ranked list (the caller decides how many to show). Deterministic: score
 * descending, then id ascending. Pure: inputs are never mutated.
 */
export function rankExplore(args: RankExploreArgs): ExploreRankedDish[] {
  const { library, history, season, ingredients, catalog } = args;

  const ingredientsByDishId = new Map<number, Ingredient[]>();
  for (const row of ingredients) {
    const list = ingredientsByDishId.get(row.dishId);
    if (list) list.push(row);
    else ingredientsByDishId.set(row.dishId, [row]);
  }

  // Cooking-history profile: which primary ingredients, categories, and protein
  // bands the household actually cooks. Built from the library rows the history
  // references (history rows carry only id + name, so we join back to the dish).
  const dishById = new Map<number, Dish>();
  for (const dish of library) dishById.set(dish.id, dish);
  const cooked = cookedDishIds(history);

  const cookedPrimaries: string[] = [];
  const cookedCategories: string[] = [];
  const cookedProteins: number[] = [];
  for (const id of cooked) {
    const dish = dishById.get(id);
    if (!dish) continue;
    cookedPrimaries.push(dish.primaryIngredient);
    cookedCategories.push(dish.category);
    cookedProteins.push(dishProtein(dish, ingredientsByDishId, catalog));
  }

  const primaryFreq = normalisedFrequency(cookedPrimaries);
  const categoryFreq = normalisedFrequency(cookedCategories);
  const medianBand = proteinBand(median(cookedProteins));

  // Eligible (active, in-season) AND never-cooked. The slot argument only feeds
  // the active+season filter; meal-time is not narrowed here (Explore spans both).
  const eligible = eligibleDishes({
    library,
    history,
    season,
    slot: { day: "Mon", meal: "Lunch" },
  });
  const candidates = eligible.filter((d) => !cooked.has(d.id));

  const ranked: ExploreRankedDish[] = candidates.map((dish) => {
    const sharedIngredient = primaryFreq.get(dish.primaryIngredient) ?? 0;
    const familiarCategory = categoryFreq.get(dish.category) ?? 0;
    const band = proteinBand(dishProtein(dish, ingredientsByDishId, catalog));
    const proteinMatch = 1 / (1 + Math.abs(band - medianBand));

    const signals = { sharedIngredient, proteinMatch, familiarCategory };
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
      signals,
      dominantAffinity,
    };
  });

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.dish.id - b.dish.id;
  });
  return ranked;
}
