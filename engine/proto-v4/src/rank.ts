import type { Dish } from "../../src/data/schemas.js";
import type { FrequencyIndex } from "./frequency.js";
import { eatenCount } from "./frequency.js";
import type { GuardIndex } from "./guard.js";
import { cookedWithinGuard } from "./guard.js";
// §4.6 protein-family normalization is UNCHANGED in v4 ("the protein-family
// normalization table stays; plate rule 6 reads it"), so it is reused verbatim from v3.
import { proteinFamily } from "../../src/priority.js";

/**
 * §3.4 Selection, the v4 ranker.
 *
 * Step 1 (favorites pinning) is a placement pass upstream; what reaches here is a set of
 * pinned dish ids that lead the pool for this one position. Steps 2 to 5 are implemented
 * here:
 *
 *   2. frequency-first, eaten-count descending over the 10-week window
 *   3. the seven-day repeat guard (a hard exclusion that relaxes when it empties the pool)
 *   4. within-week no-repeat (a demotion with the same fresh-alternative fallback v3 uses)
 *   5. tiebreaks: longest unused, then dish id ascending
 *
 * Two positions rank differently, per the spec:
 *
 *   - `mode: "exploration"` (Friday's Indian companion) ranks by PURE longest-unused with
 *     never-cooked first, instead of steps 2 and 3.
 *   - `mode: "fruit"` ranks by eaten-count descending with a longest-unused tiebreak and
 *     keeps its full recency exemption.
 *
 * Determinism: every comparison bottoms out in dish id ascending, and no step consults
 * input order. No RNG anywhere.
 */

export type RankMode = "frequency" | "exploration" | "fruit";

export interface RankArgs {
  pool: Dish[];
  mode: RankMode;
  frequency: FrequencyIndex;
  guard: GuardIndex;
  lastCooked: Map<number, string>;
  /** The calendar date of the slot being filled, the guard's reference point. */
  slotDate: string;
  /** Dish ids already placed in this week (step 4). */
  withinWeekDishIds: ReadonlySet<number>;
  /**
   * True when this position is exempt from the guard and from within-week no-repeat:
   * lunch carbs, fruit, and the plate rule 2 protein side.
   */
  recencyExempt: boolean;
  /** §3.4 step 1: dish ids pinned into this position by the favorites pass. */
  pinnedDishIds?: ReadonlySet<number>;
  /**
   * Plate rule 7: dish ids a already-placed dish named through `pairsWith`. They lead
   * the pool, below an explicit favorite pin but above every ranking step.
   */
  preferDishIds?: ReadonlySet<number>;
  /**
   * Plate rule 6, same-day protein-family dedup: the protein family of the same day's
   * breakfast main. A candidate in that family is deprioritised, with the usual
   * fresh-alternative fallback (if every candidate matches, the pool is unchanged).
   */
  demoteProteinFamily?: string;
}

export interface RankResult {
  ranked: Dish[];
  /** True when the guard emptied the pool and had to be relaxed (a reportable incident). */
  guardRelaxed: boolean;
}

/** Sort key for "longest unused, never-cooked first, then id ascending". */
function compareLongestUnused(a: Dish, b: Dish, lastCooked: Map<number, string>): number {
  const aDate = lastCooked.get(a.id);
  const bDate = lastCooked.get(b.id);
  if (aDate === undefined && bDate !== undefined) return -1;
  if (bDate === undefined && aDate !== undefined) return 1;
  if (aDate !== undefined && bDate !== undefined && aDate !== bDate) return aDate < bDate ? -1 : 1;
  return a.id - b.id;
}

export function rank(args: RankArgs): RankResult {
  const { pool, mode, frequency, guard, lastCooked, slotDate, withinWeekDishIds, recencyExempt } =
    args;
  const pinned = args.pinnedDishIds ?? new Set<number>();

  if (pool.length === 0) return { ranked: [], guardRelaxed: false };

  // Step 3: the seven-day guard. Hard exclusion, relaxed if it empties the pool.
  // Fruit and the exemption list skip it; the exploration slot replaces it.
  let guardRelaxed = false;
  let working = pool;
  if (mode === "frequency" && !recencyExempt) {
    const kept = pool.filter((d) => pinned.has(d.id) || !cookedWithinGuard(guard, d.id, slotDate));
    if (kept.length === 0) {
      guardRelaxed = true;
    } else {
      working = kept;
      if (kept.length < pool.length && kept.every((d) => pinned.has(d.id))) {
        // Every survivor is a pin, so the guard effectively emptied the free pool.
        guardRelaxed = true;
      }
    }
  }

  // Steps 2 and 5, or the exploration / fruit orderings.
  const sorted = [...working].sort((a, b) => {
    if (mode === "exploration") {
      return compareLongestUnused(a, b, lastCooked);
    }
    // "frequency" and "fruit" share the same primary key: eaten-count descending.
    const fa = eatenCount(frequency, a.id);
    const fb = eatenCount(frequency, b.id);
    if (fa !== fb) return fb - fa;
    return compareLongestUnused(a, b, lastCooked);
  });

  // Step 4: within-week no-repeat, a stable demotion with the fresh-alternative fallback.
  let ordered = sorted;
  if (!recencyExempt && withinWeekDishIds.size > 0) {
    const fresh: Dish[] = [];
    const placed: Dish[] = [];
    for (const d of sorted) {
      if (withinWeekDishIds.has(d.id) && !pinned.has(d.id)) placed.push(d);
      else fresh.push(d);
    }
    if (fresh.length > 0) ordered = [...fresh, ...placed];
  }

  // Plate rule 6: same-day protein-family dedup. A stable partition with the
  // fresh-alternative fallback, so it dominates the ranking steps but never empties
  // the position.
  if (args.demoteProteinFamily !== undefined) {
    const target = args.demoteProteinFamily;
    const fresh: Dish[] = [];
    const repeat: Dish[] = [];
    for (const d of ordered) {
      if (proteinFamily(d) === target && !pinned.has(d.id)) repeat.push(d);
      else fresh.push(d);
    }
    if (fresh.length > 0) ordered = [...fresh, ...repeat];
  }

  // Plate rule 7: a `pairsWith` partner leads the pool, below an explicit favorite pin.
  const preferred = args.preferDishIds;
  if (preferred && preferred.size > 0) {
    const lead: Dish[] = [];
    const rest: Dish[] = [];
    for (const d of ordered) {
      if (preferred.has(d.id) && !pinned.has(d.id)) lead.push(d);
      else rest.push(d);
    }
    if (lead.length > 0) {
      lead.sort((a, b) => a.id - b.id);
      ordered = [...lead, ...rest];
    }
  }

  // Step 1: pinned favorites lead the position regardless of every step above.
  if (pinned.size > 0) {
    const pins: Dish[] = [];
    const rest: Dish[] = [];
    for (const d of ordered) {
      if (pinned.has(d.id)) pins.push(d);
      else rest.push(d);
    }
    if (pins.length > 0) {
      pins.sort((a, b) => a.id - b.id);
      ordered = [...pins, ...rest];
    }
  }

  return { ranked: ordered, guardRelaxed };
}

/** Convenience: the top-ranked dish, or undefined for an empty pool. */
export function pickTop(args: RankArgs): { dish?: Dish; guardRelaxed: boolean } {
  const result = rank(args);
  return { dish: result.ranked[0], guardRelaxed: result.guardRelaxed };
}
