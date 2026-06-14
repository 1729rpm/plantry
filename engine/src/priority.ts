import type { Dish, Ingredient, MenuHistoryRow } from "./data/schemas.js";
import {
  DEFAULT_LEFTOVER_THRESHOLD_GRAMS,
  rankByConsolidation,
  type IngredientLedger,
} from "./consolidation.js";

/**
 * Context for §4 step 3 (delegates to §6 ingredient consolidation). When
 * `ledger` is null/undefined the step is a no-op so callers with no ledger
 * (engine harnesses, isolated rankCandidates calls) keep the legacy
 * behaviour. Soft consolidation (the named fresh-produce list in §6) is
 * optional and applied as a secondary tiebreak within hard-score groups.
 */
export interface ConsolidationContext {
  ledger: IngredientLedger;
  ingredients: Ingredient[];
  thresholdGrams?: number;
  lastFreshItemsUsed?: ReadonlySet<string>;
}

export interface RankCandidatesArgs {
  pool: Dish[];
  history: MenuHistoryRow[];
  /**
   * The Primary Ingredient of breakfast on the same day as the slot being
   * ranked. Used by step 2 to deprioritise lunch candidates that repeat the
   * morning's headline ingredient. Undefined for slots without a same-day
   * breakfast (Saturday lunch) or when the breakfast slot has not been
   * decided yet.
   */
  sameDayBreakfastPrimaryIngredient?: string;
  /**
   * §6 ingredient-consolidation context (ledger + ingredient table). Undefined
   * leaves step 3 a no-op; null is also accepted for callers that explicitly
   * disable consolidation. See `ConsolidationContext`.
   */
  consolidationContext?: ConsolidationContext | null;
  /**
   * §4 step 5 within-week recency: ids of dishes already placed in an earlier
   * slot of the week being generated. Any non-exempt candidate whose id is in
   * this set is demoted below the fresh (not-yet-placed) candidates, dominating
   * steps 1 to 4 so a broad pool's favourite cannot win every slot identically.
   * Build it with `withinWeekRecencySet` so the demotion honours the §4
   * exemptions (fruit, lunch carbs). Undefined or empty leaves the step a no-op,
   * so every existing caller is unchanged.
   */
  withinWeekDishIds?: ReadonlySet<number>;
}

const LUNCH_CARB_CATEGORIES = new Set(["Chapati", "Rice"]);

/**
 * §4 recency exemption: dishes with the `fruit` tag and lunch carbs (Category
 * in {Chapati, Rice}) are exempt from both step 1 (longest unused) and step 5
 * (within-week recency). They pass through with a neutral rank so neither step
 * reorders them relative to each other or to non-exempt dishes; this is what
 * lets Seasonal fruit recur Mon/Wed/Fri and Roti recur across lunches.
 */
function isRecencyExempt(dish: Dish): boolean {
  if (dish.tags.includes("fruit")) return true;
  if (LUNCH_CARB_CATEGORIES.has(dish.category)) return true;
  return false;
}

/**
 * Build the §4 step 5 within-week demotion set from the dishes already placed
 * earlier in the week being generated. Exempt dishes (fruit, lunch carbs) are
 * left out so they stay free to repeat. Shared by the generateWeek loop and the
 * single-slot picker (rankCandidatesForSlot), so the within-week recency rule
 * has one definition, not two. Pass the running list of this-week picks; the
 * returned set feeds `RankCandidatesArgs.withinWeekDishIds`.
 */
export function withinWeekRecencySet(picks: Dish[]): Set<number> {
  const set = new Set<number>();
  for (const dish of picks) {
    if (!isRecencyExempt(dish)) set.add(dish.id);
  }
  return set;
}

/** Last-cooked date per dish id, taken from the most recent matching history row. */
function lastCookedMap(history: MenuHistoryRow[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const row of history) {
    const existing = map.get(row.dishId);
    if (existing === undefined || row.weekStart > existing) {
      map.set(row.dishId, row.weekStart);
    }
  }
  return map;
}

/**
 * §4 step 1: sort the pool oldest last-cooked date first. A dish that has
 * never been cooked counts as the longest unused. Recency-exempt dishes
 * (fruit-tagged, lunch carbs) keep their input position; the sort treats any
 * comparison touching an exempt dish as a tie so stable order is preserved.
 */
export function byLongestUnused(pool: Dish[], history: MenuHistoryRow[]): Dish[] {
  const lastCooked = lastCookedMap(history);
  // Decorate with original index so we can do a stable sort by hand; Array.sort
  // is not guaranteed stable across engines older than ES2019, and being
  // explicit here also documents the tie semantics.
  const decorated = pool.map((dish, index) => ({ dish, index }));
  decorated.sort((a, b) => {
    const aExempt = isRecencyExempt(a.dish);
    const bExempt = isRecencyExempt(b.dish);
    // Either side exempt → neutral; preserve input order via index tiebreak.
    if (aExempt || bExempt) {
      return a.index - b.index;
    }
    const aDate = lastCooked.get(a.dish.id);
    const bDate = lastCooked.get(b.dish.id);
    // Never-cooked counts as longest unused → comes first.
    if (aDate === undefined && bDate === undefined) return a.index - b.index;
    if (aDate === undefined) return -1;
    if (bDate === undefined) return 1;
    if (aDate < bDate) return -1;
    if (aDate > bDate) return 1;
    return a.index - b.index;
  });
  return decorated.map((d) => d.dish);
}

/**
 * §4 step 2: if a candidate's Primary Ingredient matches the same day's
 * breakfast Primary Ingredient, push it to the bottom of the pool while
 * preserving the prior-step order among the kept-above and pushed-below
 * groups. If no `sameDayBreakfastPrimaryIngredient` is supplied (Saturday
 * lunch, or the breakfast slot has not been resolved yet), the step is a
 * no-op. If every candidate matches, pushing them all to the bottom is the
 * same as pushing none; the pool is returned unchanged so §4's "if no viable
 * alternative remains, allow the repeat" fallback holds without special
 * casing further down.
 */
export function byNoSameDayPrimaryIngredient(
  pool: Dish[],
  sameDayBreakfastPrimaryIngredient: string | undefined,
): Dish[] {
  if (sameDayBreakfastPrimaryIngredient === undefined) return pool;
  const target = sameDayBreakfastPrimaryIngredient;
  const kept: Dish[] = [];
  const pushedDown: Dish[] = [];
  for (const dish of pool) {
    if (dish.primaryIngredient === target) {
      pushedDown.push(dish);
    } else {
      kept.push(dish);
    }
  }
  // Fallback: every candidate would be deprioritised → §4 allows the repeat.
  if (kept.length === 0) return pool;
  return [...kept, ...pushedDown];
}

/**
 * §4 step 3: ingredient consolidation (delegates to §6). When no
 * consolidation context is supplied this is a no-op, matching the pre-§6
 * behaviour. With a ledger, candidates that consume above-threshold
 * leftovers rank above those that do not; soft consolidation on the named
 * fresh-produce list is a secondary tiebreak.
 */
export function byIngredientConsolidation(
  pool: Dish[],
  context: ConsolidationContext | null | undefined,
): Dish[] {
  if (!context) return pool;
  return rankByConsolidation(pool, context.ledger, context.ingredients, {
    thresholdGrams: context.thresholdGrams ?? DEFAULT_LEFTOVER_THRESHOLD_GRAMS,
    lastFreshItemsUsed: context.lastFreshItemsUsed,
  });
}

/** Backwards-compatible alias retained for callers of the slice-4 placeholder. */
export const byConsolidationStub = byIngredientConsolidation;

/**
 * §4 step 4: Preferred=Yes ranks above Preferred=No. Stable: within each group
 * the order from the previous step is preserved.
 */
export function byPreferredYes(pool: Dish[]): Dish[] {
  const yes: Dish[] = [];
  const no: Dish[] = [];
  for (const dish of pool) {
    if (dish.preferred === "Yes") {
      yes.push(dish);
    } else {
      no.push(dish);
    }
  }
  return [...yes, ...no];
}

/**
 * §4 step 5: within-week recency. A candidate already placed earlier in the
 * week being generated (its id is in `withinWeekDishIds`) is treated as the
 * most-recently-used dish, so it sinks below every fresh (not-yet-placed)
 * candidate. Applied last and as a stable partition, it dominates steps 1 to 4:
 * a dish that consolidation (step 3) or Preferred=Yes (step 4) re-promoted is
 * still pushed below the fresh alternatives, so a broad pool's favourite cannot
 * win every Mon/Wed/Fri slot identically. Exempt dishes (fruit, lunch carbs)
 * are never in the demotion set, so they keep their place. Fallback: if every
 * candidate has already been placed this week, demoting them all equals demoting
 * none, so the pool is returned unchanged and the repeat is allowed (mirrors the
 * step 2 fresh-alternative fallback).
 */
export function byWithinWeekRecency(
  pool: Dish[],
  withinWeekDishIds: ReadonlySet<number> | undefined,
): Dish[] {
  if (!withinWeekDishIds || withinWeekDishIds.size === 0) return pool;
  const fresh: Dish[] = [];
  const placed: Dish[] = [];
  for (const dish of pool) {
    if (withinWeekDishIds.has(dish.id) && !isRecencyExempt(dish)) {
      placed.push(dish);
    } else {
      fresh.push(dish);
    }
  }
  // Every candidate already placed → no fresh alternative; allow the repeat.
  if (fresh.length === 0) return pool;
  return [...fresh, ...placed];
}

/**
 * §4 selection priority. Composes the five steps in order; each step takes the
 * output of the previous as its input, so ties from step N are broken by step
 * N+1. Step 5 (within-week recency) is the dominant terminal partition: it runs
 * after all tie-breaks so an already-placed dish always sinks below a fresh one.
 * Returns a stable permutation of the input pool.
 */
export function rankCandidates(args: RankCandidatesArgs): Dish[] {
  const step1 = byLongestUnused(args.pool, args.history);
  const step2 = byNoSameDayPrimaryIngredient(step1, args.sameDayBreakfastPrimaryIngredient);
  const step3 = byIngredientConsolidation(step2, args.consolidationContext);
  const step4 = byPreferredYes(step3);
  const step5 = byWithinWeekRecency(step4, args.withinWeekDishIds);
  return step5;
}
