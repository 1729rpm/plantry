import type { Dish, Ingredient, MenuHistoryRow } from "./data/schemas.js";
import {
  DEFAULT_LEFTOVER_THRESHOLD_GRAMS,
  rankByConsolidation,
  type IngredientLedger,
} from "./consolidation.js";
import { lastCookedMap } from "./historyRows.js";

/**
 * Context for §4 step 3 (delegates to §10 ingredient consolidation). When
 * `ledger` is null/undefined the step is a no-op so callers with no ledger
 * (engine harnesses, isolated rankCandidates calls) keep the legacy
 * behaviour. Soft consolidation (the named fresh-produce list in §10) is
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
   * §10 ingredient-consolidation context (ledger + ingredient table). Undefined
   * leaves step 3 a no-op; null is also accepted for callers that explicitly
   * disable consolidation. See `ConsolidationContext`.
   */
  consolidationContext?: ConsolidationContext | null;
  /**
   * §4 step 5 within-week cuisine diversity: the count of non-Indian dishes
   * (`cuisine !== "Indian"`) already placed in an earlier slot of the week being
   * generated. While this count is below `WEEKLY_NON_INDIAN_TARGET`, the
   * cuisine-diversity step ranks non-Indian candidates above Indian ones in each
   * slot's pool; at or above the target the step is a no-op. Build it with
   * `placedNonIndianCount`. Undefined leaves the step a no-op (treated as below
   * target only when supplied), so every existing caller is unchanged.
   */
  placedNonIndianCount?: number;
  /**
   * §4 step 6 within-week recency: ids of dishes already placed in an earlier
   * slot of the week being generated. Any non-exempt candidate whose id is in
   * this set is demoted below the fresh (not-yet-placed) candidates, dominating
   * steps 1 to 5 so a broad pool's favourite cannot win every slot identically.
   * Build it with `withinWeekRecencySet` so the demotion honours the §4
   * exemptions (fruit, lunch carbs). Undefined or empty leaves the step a no-op,
   * so every existing caller is unchanged.
   */
  withinWeekDishIds?: ReadonlySet<number>;
  /**
   * §4 step 7 within-week protein diversity (HP mains only): the set of protein
   * families (`proteinFamily`) already placed as an HP main earlier in the week.
   * Supplied only when this slot is ranking an HP-main pool. A candidate whose
   * protein family is in this set is softly deprioritised below fresh-protein
   * candidates, so a week's HP mains spread across proteins (fish/prawn/mutton/
   * egg get a fair shot) rather than repeating chicken or paneer. Soft with
   * fallback: if every candidate's protein already appeared, the pool is returned
   * unchanged (the slot still fills). Undefined leaves the step a no-op. Build it
   * with `proteinFamiliesUsedAsHpMain`.
   */
  usedHpMainProteinFamilies?: ReadonlySet<string>;
}

const LUNCH_CARB_CATEGORIES = new Set(["Chapati", "Rice"]);

/**
 * §4 step 5 within-week cuisine diversity: how many non-Indian dishes the week
 * aims for. While fewer than this many non-Indian dishes have been placed in the
 * week being generated, the cuisine-diversity step partitions each slot's pool so
 * non-Indian candidates rank above Indian ones; at or above this count the step
 * is a no-op, which is what bounds the effect to "slightly". Tunable in one place.
 * Keep this in lockstep with docs/engine.md §4 step 5.
 */
export const WEEKLY_NON_INDIAN_TARGET = 3;

/**
 * §4 cuisine test: a dish is non-Indian when its `cuisine` property is anything
 * other than "Indian". Dishes carrying no international cuisine are tagged
 * `Indian` in the library (docs/engine.md §12), so this single comparison
 * partitions the pool. Property-based: keyed on the `cuisine` field, never on
 * dish names or ids.
 */
function isNonIndian(dish: Dish): boolean {
  return dish.cuisine !== "Indian";
}

/**
 * §4.6 protein-family normalization. Collapses `primaryIngredient` values that
 * are the same protein for diversity purposes onto one canonical family label,
 * so the within-week protein-diversity rule (`byProteinDiversity`) treats them
 * as one protein. The only non-identity collapses are the chicken cuts (Chicken,
 * Chicken Breast, Chicken Keema all read as Chicken) and the soya forms
 * (Soyabean Chunk, Soya Chunk, Soyabean, Soya all read as Soyabean Chunk); every
 * other protein maps to itself by falling through to the raw value. Keep this
 * mapping in lockstep with docs/engine.md §4.6.
 */
const PROTEIN_FAMILY: Record<string, string> = {
  Chicken: "Chicken",
  "Chicken Breast": "Chicken",
  "Chicken Keema": "Chicken",
  "Soyabean Chunk": "Soyabean Chunk",
  "Soya Chunk": "Soyabean Chunk",
  Soyabean: "Soyabean Chunk",
  Soya: "Soyabean Chunk",
};

/**
 * Normalize a dish's `primaryIngredient` to its protein family for §4.6
 * within-week protein diversity. Unmapped ingredients (paneer, fish, prawn,
 * mutton, egg, chickpea, and any non-protein primary like couscous) pass through
 * unchanged, so they are each their own family. Property-based: keyed on the
 * ingredient label, never on dish names.
 */
export function proteinFamily(dish: Dish): string {
  return PROTEIN_FAMILY[dish.primaryIngredient] ?? dish.primaryIngredient;
}

/**
 * §4 recency exemption: dishes with the `fruit` tag and lunch carbs (Category
 * in {Chapati, Rice}) are exempt from both step 1 (longest unused) and step 6
 * (within-week recency). They pass through with a neutral rank so neither step
 * reorders them relative to each other or to non-exempt dishes; this is what
 * lets fruit-tagged dishes recur Mon/Wed/Fri and Roti recur across lunches.
 */
function isRecencyExempt(dish: Dish): boolean {
  if (dish.tags.includes("fruit")) return true;
  if (LUNCH_CARB_CATEGORIES.has(dish.category)) return true;
  return false;
}

/**
 * Build the §4 step 6 within-week demotion set from the dishes already placed
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
 * §4 step 3: ingredient consolidation (delegates to §10). When no
 * consolidation context is supplied this is a no-op, matching the pre-consolidation
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
 * §4 step 5: within-week cuisine diversity. A soft, target-gated partition that
 * nudges a small, fixed number of non-Indian dishes into each week without
 * flipping the menu international. While the week has placed fewer than
 * `WEEKLY_NON_INDIAN_TARGET` non-Indian dishes (`placedNonIndianCount` below the
 * target), non-Indian candidates (`cuisine !== "Indian"`) rank above Indian ones,
 * stable within each group; once the target is met the step is a no-op, so the
 * rest of the week ranks exactly as before. This is what bounds the effect to
 * "slightly": ~`WEEKLY_NON_INDIAN_TARGET` international dishes a week, every other
 * slot unchanged.
 *
 * It sits after Preferred=Yes (step 4), so in the at-most-`target` slots where it
 * fires it can promote a non-Indian candidate above a Preferred=Yes Indian dish.
 * It stays subordinate to the two dominant terminal partitions (within-week
 * recency, within-week protein diversity), which run after it, so it can never
 * force a dish repeat or an HP-protein clash just to hit the cuisine target.
 *
 * Within the promoted non-Indian group, Preferred=Yes dishes rank first: a stable
 * sub-sort keyed on the `preferred` property (never dish names), so that when a
 * companion data pass marks the international dishes Rajat actually likes as
 * `preferred: Yes`, those float to the top of the promotion ahead of the rest of
 * the non-Indian pool. The Indian group is left untouched. This is purely an
 * intra-group ordering: it promotes no new dish (the non-Indian/Indian split is
 * unchanged) and is inert while every international dish is `preferred: No` (the
 * default), which is the case until that data pass lands.
 *
 * Soft with a fresh-alternative fallback, mirroring steps 2, 6, and 7: if the
 * pool has no non-Indian candidate (an all-Indian lunch-carb pool, a
 * Category=Fruit pool), promoting none equals promoting all, so the pool is
 * returned unchanged. This is why fruit slots and lunch-carb slots need no
 * explicit exemption: they hold no non-Indian candidate, so the step never
 * touches them. It never narrows §3 composition eligibility and never empties a
 * slot. Undefined `placedNonIndianCount` leaves the step a no-op, so every
 * existing caller is unchanged.
 */
export function byCuisineDiversity(pool: Dish[], placedNonIndianCount: number | undefined): Dish[] {
  // No-op once the target is met (or when the count is not supplied at all).
  if (placedNonIndianCount === undefined) return pool;
  if (placedNonIndianCount >= WEEKLY_NON_INDIAN_TARGET) return pool;
  const nonIndian: Dish[] = [];
  const indian: Dish[] = [];
  for (const dish of pool) {
    if (isNonIndian(dish)) {
      nonIndian.push(dish);
    } else {
      indian.push(dish);
    }
  }
  // No non-Indian candidate → no diversity gain available; leave the pool as is
  // (fresh-alternative fallback). This makes fruit and lunch-carb pools no-ops
  // with no explicit exemption.
  if (nonIndian.length === 0) return pool;
  // Within the promoted non-Indian group, Preferred=Yes ranks first. Stable
  // sub-sort keyed on the `preferred` property: the relative order of the
  // previous step is preserved inside each of the Yes / No sub-groups. The
  // Indian group is unchanged.
  const preferredNonIndian: Dish[] = [];
  const otherNonIndian: Dish[] = [];
  for (const dish of nonIndian) {
    if (dish.preferred === "Yes") {
      preferredNonIndian.push(dish);
    } else {
      otherNonIndian.push(dish);
    }
  }
  return [...preferredNonIndian, ...otherNonIndian, ...indian];
}

/**
 * Build the §4 step 5 placed-non-Indian count from the dishes already placed
 * this week. Counts every non-Indian dish (`cuisine !== "Indian"`), with no
 * exemptions: a non-Indian fruit or lunch carb still counts toward the week's
 * cuisine target, since the target is about the week's overall cuisine mix.
 * Shared by the generateWeek loop and the single-slot picker
 * (rankCandidatesForSlot), so the count has one definition, not two. Pass the
 * running list of this-week picks; the returned number feeds
 * `RankCandidatesArgs.placedNonIndianCount`.
 */
export function placedNonIndianCount(picks: Dish[]): number {
  let count = 0;
  for (const dish of picks) {
    if (isNonIndian(dish)) count += 1;
  }
  return count;
}

/**
 * §4 step 6: within-week recency. A candidate already placed earlier in the
 * week being generated (its id is in `withinWeekDishIds`) is treated as the
 * most-recently-used dish, so it sinks below every fresh (not-yet-placed)
 * candidate. Applied near-last and as a stable partition, it dominates steps 1
 * to 5: a dish that consolidation (step 3), Preferred=Yes (step 4), or cuisine
 * diversity (step 5) re-promoted is still pushed below the fresh alternatives,
 * so a broad pool's favourite cannot win every Mon/Wed/Fri slot identically.
 * Exempt dishes (fruit, lunch carbs) are never in the demotion set, so they keep
 * their place. Fallback: if every candidate has already been placed this week,
 * demoting them all equals demoting none, so the pool is returned unchanged and
 * the repeat is allowed (mirrors the step 2 fresh-alternative fallback).
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
 * §4 step 7: within-week protein diversity for HP mains. A candidate whose
 * protein family (`proteinFamily`) already appeared as an HP main earlier in the
 * week (its family is in `usedProteinFamilies`) is softly deprioritised below
 * the fresh-protein candidates, so a week's HP mains spread across proteins
 * rather than repeating chicken or paneer while fish/prawn/mutton/egg never
 * surface. This is the protein-level analogue of step 6's dish-level recency,
 * scoped to HP mains: it runs as the terminal partition so it dominates the
 * earlier tie-breaks the same way step 6 does. It is a SOFT preference, never a
 * hard constraint: if every candidate's protein family already appeared (no
 * fresh-protein alternative), the pool is returned unchanged so the slot still
 * fills (mirrors the step 2 and step 6 fresh-alternative fallbacks). It never
 * touches §3 composition eligibility or the recency exemptions. Undefined or
 * empty `usedProteinFamilies` leaves the step a no-op, so non-HP-main pools and
 * every pre-Cluster-E caller are unchanged.
 */
export function byProteinDiversity(
  pool: Dish[],
  usedProteinFamilies: ReadonlySet<string> | undefined,
): Dish[] {
  if (!usedProteinFamilies || usedProteinFamilies.size === 0) return pool;
  const fresh: Dish[] = [];
  const repeat: Dish[] = [];
  for (const dish of pool) {
    // Scoped to HP mains: only an HP-main candidate whose protein family was
    // already spent is deprioritised. A non-HP-main candidate (or an HP main on
    // a fresh protein) stays in the fresh group, so the rule never reorders by
    // a non-main dish's incidental primaryIngredient.
    if (isHpMain(dish) && usedProteinFamilies.has(proteinFamily(dish))) {
      repeat.push(dish);
    } else {
      fresh.push(dish);
    }
  }
  // No fresh protein remains → no diversity gain; allow the repeat (soft rule).
  if (fresh.length === 0) return pool;
  return [...fresh, ...repeat];
}

/**
 * Build the §4 step 7 used-protein set from the dishes already placed this week
 * that were HP mains. Only `HP`-tagged Gravy/Dry/Complete meal dishes count as
 * mains; HP accompaniments and non-HP picks are ignored, so the set captures
 * exactly the protein the week's HP mains have already spent. Pass the running
 * list of this-week picks; the returned set feeds
 * `RankCandidatesArgs.usedHpMainProteinFamilies`.
 */
export function proteinFamiliesUsedAsHpMain(picks: Dish[]): Set<string> {
  const set = new Set<string>();
  for (const dish of picks) {
    if (isHpMain(dish)) set.add(proteinFamily(dish));
  }
  return set;
}

/**
 * An HP main is an `HP`-tagged dish that occupies a meal's protein-main slot:
 * a Gravy dish, Dry dish, or Complete meal. HP accompaniments (e.g. a chicken
 * salad side) are HP-tagged but are not mains, so they neither consume nor are
 * governed by §4.6 protein diversity (the §3 one-HP-per-meal rule already keeps
 * them off an HP-main meal). Keto HP dishes are the Menu 2 / Menu 4 protein lead
 * and count as mains too.
 */
export function isHpMain(dish: Dish): boolean {
  if (!dish.tags.includes("HP")) return false;
  return (
    dish.category === "Gravy dish" ||
    dish.category === "Dry dish" ||
    dish.category === "Complete meal" ||
    dish.category === "Keto"
  );
}

/**
 * §4 selection priority. Composes the steps in order; each step takes the output
 * of the previous as its input, so ties from step N are broken by step N+1.
 * Step 5 (within-week cuisine diversity) is a soft, target-gated nudge that sits
 * after Preferred=Yes but before the two dominant terminal partitions, step 6
 * (within-week recency) and step 7 (within-week protein diversity, HP mains
 * only). Those run after all the tie-breaks so an already-placed dish sinks
 * below a fresh one and a repeated protein sinks below a fresh one; running them
 * after cuisine diversity keeps cuisine subordinate, so it can never force a
 * dish repeat or an HP-protein clash to hit its target. Returns a stable
 * permutation of the input pool.
 */
export function rankCandidates(args: RankCandidatesArgs): Dish[] {
  const step1 = byLongestUnused(args.pool, args.history);
  const step2 = byNoSameDayPrimaryIngredient(step1, args.sameDayBreakfastPrimaryIngredient);
  const step3 = byIngredientConsolidation(step2, args.consolidationContext);
  const step4 = byPreferredYes(step3);
  const step5 = byCuisineDiversity(step4, args.placedNonIndianCount);
  const step6 = byWithinWeekRecency(step5, args.withinWeekDishIds);
  const step7 = byProteinDiversity(step6, args.usedHpMainProteinFamilies);
  return step7;
}
