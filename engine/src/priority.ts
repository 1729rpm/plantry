import type { Dish, Ingredient, MenuHistoryRow } from "./data/schemas.js";
import {
  DEFAULT_LEFTOVER_THRESHOLD_GRAMS,
  rankByConsolidation,
  type IngredientLedger,
} from "./consolidation.js";
import { lastCookedMap } from "./historyRows.js";

/**
 * §4 step 1 frequency window: the number of most recent WEEK-RECORDS (distinct
 * `weekStart` values present in history) whose rows feed a dish's eaten-count.
 * Ten weeks, not season-scoped (`features/engine-v4.md` §2 D3).
 */
export const FREQUENCY_WINDOW_WEEKS = 10;

/**
 * §4 step 1 saturating cap (`features/engine-v4.md` §10.2). A dish's frequency
 * credit is `min(eatenCount, 3)` over the window rather than the raw count. This
 * is the whole anti-carousel mechanism: an unbounded count means the leader's
 * lead grows every week it wins, so nothing can ever dislodge it and each
 * position converges to a fixed cycle. Capping the credit puts the household's
 * whole proven repertoire on the same top rung, and the longest-unused tiebreak
 * below it then does real rotation work among them. Proven dishes still lead
 * (credit 3 beats credit 0), but which proven dish leads this week is decided by
 * recency, not by an ever-growing incumbency score.
 */
export const FREQUENCY_CREDIT_CAP = 3;

/**
 * §4 step 2 repeat guard: a dish cooked within this many days before a slot's
 * date is excluded from that slot's pool. Seven days, so the guard spans one full
 * weekly cycle.
 */
export const REPEAT_GUARD_DAYS = 7;

/** Day-of-week offsets from a week's Monday, for day-granular history dates. */
const DAY_OFFSET: Record<MenuHistoryRow["day"], number> = {
  Monday: 0,
  Tuesday: 1,
  Wednesday: 2,
  Thursday: 3,
  Friday: 4,
  Saturday: 5,
  Sunday: 6,
};

/** ISO date `n` days after `iso`, computed in UTC so it is timezone-stable. */
function addDays(iso: string, days: number): string {
  const base = new Date(`${iso}T00:00:00Z`);
  return new Date(base.getTime() + days * 86400000).toISOString().slice(0, 10);
}

/**
 * The actual calendar date a history row refers to. History rows are keyed by
 * the week's Monday plus a day name, so the eaten date is `weekStart + dayOffset`.
 * `lastCookedMap` deliberately works at week granularity (it answers "which week
 * was this last cooked in"); the §4 step 2 guard needs day granularity, because a
 * guard that rounds to whole weeks would exclude everything eaten last week and
 * so forbid the household's repertoire from ever recurring week to week.
 */
function lastCookedDateMap(history: readonly MenuHistoryRow[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const row of history) {
    const date = addDays(row.weekStart, DAY_OFFSET[row.day] ?? 0);
    const existing = map.get(row.dishId);
    if (existing === undefined || date > existing) map.set(row.dishId, date);
  }
  return map;
}

/**
 * §4 step 1 frequency credits: dish id to saturating eaten-count credit over the
 * `FREQUENCY_WINDOW_WEEKS` most recent week-records in `history`.
 *
 * The window is counted in WEEK-RECORDS, not calendar weeks: it takes the ten
 * largest distinct `weekStart` values actually present, so a gap in the record
 * (a skipped or unfinalized week) does not silently shrink the window.
 *
 * The credit is the dish's raw eaten count inside the window, saturated at
 * `FREQUENCY_CREDIT_CAP`. Never-cooked dishes are absent from the map and read
 * as credit 0.
 *
 * Nothing else contributes. §10.5 proposed a cold-start retention credit here,
 * an extra point for a dish the exploration slot introduced and the household
 * kept, so it would re-enter at 2 rather than 1; it is deferred out of this
 * phase (§11.3). Earning it requires the exploration role to survive finalize
 * into the archive row, which is new schema surface, and the mechanism has no
 * evidence behind it yet. Reading a provenance value nothing writes would ship
 * the type without the behaviour, which is worse than shipping neither. Stream
 * B's result (the widened breakfast pool is reachable but unserved) is the
 * evidence to revisit it with (§12.3).
 */
export function frequencyCreditMap(
  history: readonly MenuHistoryRow[],
  options: { windowWeeks?: number; cap?: number } = {},
): Map<number, number> {
  const windowWeeks = options.windowWeeks ?? FREQUENCY_WINDOW_WEEKS;
  const cap = options.cap ?? FREQUENCY_CREDIT_CAP;

  const weekStarts = [...new Set(history.map((row) => row.weekStart))].sort();
  const window = new Set(weekStarts.slice(Math.max(0, weekStarts.length - windowWeeks)));

  const counts = new Map<number, number>();
  for (const row of history) {
    if (!window.has(row.weekStart)) continue;
    counts.set(row.dishId, (counts.get(row.dishId) ?? 0) + 1);
  }

  const credits = new Map<number, number>();
  for (const [dishId, count] of counts) {
    credits.set(dishId, Math.min(count, cap));
  }
  return credits;
}

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
   * §4 step 5 within-week recency: ids of dishes already placed in an earlier
   * slot of the week being generated. Any non-exempt candidate whose id is in
   * this set is demoted below the fresh (not-yet-placed) candidates, dominating
   * steps 1 to 5 so a broad pool's favourite cannot win every slot identically.
   * Build it with `withinWeekRecencySet` so the demotion honours the §4
   * exemption (lunch carbs). Undefined or empty leaves the step a no-op,
   * so every existing caller is unchanged.
   */
  withinWeekDishIds?: ReadonlySet<number>;
  /**
   * §4 step 6 within-week protein diversity (HP mains only): the set of protein
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
  /**
   * §4 step 2 repeat guard: the calendar date of the slot being ranked (ISO
   * `YYYY-MM-DD`). Any non-exempt candidate cooked within `REPEAT_GUARD_DAYS`
   * before it is excluded from the pool, relaxing when the guard would empty the
   * pool. UNDEFINED LEAVES THE GUARD OFF, which is why it is optional: the guard
   * needs a per-slot date that only the generation loop knows, so callers that
   * rank without a slot context (the swap picker, isolated rankCandidates calls)
   * keep their current behaviour rather than guessing a date.
   */
  slotDate?: string;
}

const LUNCH_CARB_CATEGORIES = new Set(["Chapati", "Rice"]);

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
 * §4 recency exemption: lunch carbs (Category in {Chapati, Rice}) are exempt
 * from the longest-unused tiebreak, the step 2 repeat guard, and step 5
 * within-week recency. They pass through with a neutral rank so no recency step
 * reorders them relative to each other or to non-exempt dishes; this is what
 * lets Roti recur across every lunch, which is intended.
 *
 * Lunch carbs are the ONLY exempt role. The exemption is narrow on purpose: a
 * role exempt from both recency mechanisms has nothing at all opposing its
 * frequency count, so its leader is mathematically unassailable and the role
 * becomes an absorbing state. Roti earns the exemption because a deliberate
 * daily staple is exactly the intended outcome there; nothing else does.
 */
function isRecencyExempt(dish: Dish): boolean {
  return LUNCH_CARB_CATEGORIES.has(dish.category);
}

/**
 * Build the §4 step 5 within-week demotion set from the dishes already placed
 * earlier in the week being generated. Exempt dishes (lunch carbs) are left out
 * so they stay free to repeat. Shared by the generateWeek loop and the
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
 * §4 step 1 PRIMARY sort: saturating frequency, highest credit first
 * (`features/engine-v4.md` §10.2). A STABLE sort on the credit alone, which is
 * what makes the tiebreak chain work: whatever order the pool arrives in is
 * preserved inside each credit group, so running this immediately after
 * `byLongestUnused` yields exactly "frequency descending, then longest unused".
 *
 * This is the step that changes what the engine is choosing FOR. Longest-unused
 * ranking proposes the dish the household has avoided longest, which is an
 * anti-preference chooser and the root cause of the weekly swap churn. Frequency
 * proposes what they actually cook. The saturation (see `FREQUENCY_CREDIT_CAP`)
 * is what stops that flipping into an incumbency lock: the proven repertoire all
 * ties at the cap and rotates on recency underneath.
 *
 * No exemption list. Lunch carbs are exempt from RECENCY, not from frequency:
 * roti has by far the largest count in the record, so frequency ranking is
 * exactly what keeps it leading its pool.
 */
export function bySaturatingFrequency(pool: Dish[], history: readonly MenuHistoryRow[]): Dish[] {
  const credits = frequencyCreditMap(history);
  const decorated = pool.map((dish, index) => ({
    dish,
    index,
    credit: credits.get(dish.id) ?? 0,
  }));
  decorated.sort((a, b) => {
    if (a.credit !== b.credit) return b.credit - a.credit;
    return a.index - b.index;
  });
  return decorated.map((d) => d.dish);
}

/**
 * §4 step 2 repeat guard (`features/engine-v4.md` §3.4 step 3, as amended by
 * §10.2): EXCLUDE any candidate cooked within `REPEAT_GUARD_DAYS` before this
 * slot's date. Unlike every other step in this module this is a filter, not a
 * reordering, because a demotion is not enough: under frequency ranking the
 * leader would otherwise simply win again the next day.
 *
 * Exempt: lunch carbs only. The plate rule 2 protein side LOST its exemption in
 * §10.2, because the exempt-from-everything roles between them served 43 percent
 * of all placements from six dishes in the simulation.
 *
 * Relaxation: if the guard would leave the pool empty, the pool is returned
 * unchanged so the slot still fills. A thin pool is a composition problem, not a
 * reason to ship a hole in the plate (same principle as the step 2 and step 5
 * fresh-alternative fallbacks).
 *
 * `slotDate` undefined leaves the step a no-op, so the swap picker and every
 * caller that ranks without a slot context is unchanged.
 */
export function byRepeatGuard(
  pool: Dish[],
  history: readonly MenuHistoryRow[],
  slotDate: string | undefined,
): Dish[] {
  if (slotDate === undefined) return pool;
  const lastCooked = lastCookedDateMap(history);
  const cutoff = addDays(slotDate, -REPEAT_GUARD_DAYS);
  const kept = pool.filter((dish) => {
    if (isRecencyExempt(dish)) return true;
    const date = lastCooked.get(dish.id);
    if (date === undefined) return true;
    // Inclusive at the far edge: a dish cooked exactly REPEAT_GUARD_DAYS ago is
    // still blocked, so a weekly slot cannot simply re-serve last week's winner
    // on the same weekday. It clears the guard one day later, which is the
    // "returns 8 days later" behaviour §3.4 describes.
    return date < cutoff || date > slotDate;
  });
  // Guard emptied the pool → relax it for this pool so the slot fills.
  if (kept.length === 0) return pool;
  return kept;
}

/**
 * §4 step 1 tiebreak: sort the pool oldest last-cooked date first. A dish that
 * has never been cooked counts as the longest unused. Recency-exempt dishes
 * (lunch carbs) keep their input position; the sort treats any comparison
 * touching an exempt dish as a tie so stable order is preserved.
 *
 * This is no longer the primary sort. It runs BENEATH `bySaturatingFrequency`,
 * where it is the rotation engine: with the household's proven repertoire tied
 * at the frequency cap, longest-unused decides which of them leads this week.
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
 * §4 step 5: within-week recency. A candidate already placed earlier in the
 * week being generated (its id is in `withinWeekDishIds`) is treated as the
 * most-recently-used dish, so it sinks below every fresh (not-yet-placed)
 * candidate. Applied near-last and as a stable partition, it dominates steps 1
 * to 3: a dish that consolidation (step 3) re-promoted is still pushed below the
 * fresh alternatives, so a broad pool's top candidate cannot win every Mon/Wed/
 * Fri slot identically.
 * Exempt dishes (lunch carbs) are never in the demotion set, so they keep their
 * place. Fallback: if every candidate has already been placed this week,
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
 * §4 step 6: within-week protein diversity for HP mains. A candidate whose
 * protein family (`proteinFamily`) already appeared as an HP main earlier in the
 * week (its family is in `usedProteinFamilies`) is softly deprioritised below
 * the fresh-protein candidates, so a week's HP mains spread across proteins
 * rather than repeating chicken or paneer while fish/prawn/mutton/egg never
 * surface. This is the protein-level analogue of step 5's dish-level recency,
 * scoped to HP mains: it runs as the terminal partition so it dominates the
 * earlier tie-breaks the same way step 5 does. It is a SOFT preference, never a
 * hard constraint: if every candidate's protein family already appeared (no
 * fresh-protein alternative), the pool is returned unchanged so the slot still
 * fills (mirrors the step 2 and step 5 fresh-alternative fallbacks). It never
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
 * Build the §4 step 6 used-protein set from the dishes already placed this week
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
 * §4 selection priority. Composes the steps in order; each step is a STABLE
 * reordering of the whole pool, so a step applied LATER dominates the ones before
 * it and the ones before it survive as its tiebreaks. Reading the pipeline bottom
 * up therefore gives the precedence, strongest first:
 *
 *   protein diversity > within-week recency > same-day ingredient >
 *   SATURATING FREQUENCY > longest unused > ingredient consolidation
 *
 * with the repeat guard sitting outside the chain entirely, as a filter applied
 * to the pool before any of it runs.
 *
 * Frequency is the primary CHOOSER (what does this household actually cook), and
 * every step above it is a spreader that stops one answer monopolising a role:
 * the guard blocks a same-week repeat outright, within-week recency sinks a dish
 * already placed this week, and protein diversity sinks an already-spent protein.
 * That layering is the §10.2 fix. Frequency alone converges to a fixed cycle;
 * frequency capped, guarded, and spread does not.
 *
 * Ingredient consolidation stays in the chain BELOW frequency (it was above it
 * before this rewrite): it is a genuine tiebreak among dishes the household cooks
 * equally often, but it must never outrank frequency, because it is a
 * deterministic function of the week's earlier picks and would otherwise become
 * the rotation driver in frequency's place. `features/engine-v4.md` §3.4 retires
 * this step outright; that retirement is NOT implemented here (see the PR
 * diagnosis card).
 *
 * Step 4 (favorites) is not a ranking partition: favorites are a guaranteed
 * placement pass (`planFavorites`, pinned in `generateWeek` exactly like a §6
 * request), so they never enter this per-pool ranking. Cuisine is likewise a §3
 * meal-level composition concern, not a §4 one. Returns a stable permutation of
 * the (possibly guard-filtered) input pool.
 */
export function rankCandidates(args: RankCandidatesArgs): Dish[] {
  const guarded = byRepeatGuard(args.pool, args.history, args.slotDate);
  const consolidated = byIngredientConsolidation(guarded, args.consolidationContext);
  const longestUnused = byLongestUnused(consolidated, args.history);
  const frequency = bySaturatingFrequency(longestUnused, args.history);
  const sameDay = byNoSameDayPrimaryIngredient(frequency, args.sameDayBreakfastPrimaryIngredient);
  const withinWeek = byWithinWeekRecency(sameDay, args.withinWeekDishIds);
  return byProteinDiversity(withinWeek, args.usedHpMainProteinFamilies);
}
