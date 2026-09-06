import type { Dish } from "./data/schemas.js";
import type { Meal } from "./eligibility.js";

/**
 * Picker ranking (docs/engine.md §5 Picker ranking, as v6 carries it forward,
 * `features/engine-v6.md` §12).
 *
 * The swap and add pickers rank the broad pool with their own deterministic
 * rule, distinct from generation. The picker answers a different question: given
 * the broad, non-restrictive pool (every Active, in-season dish, per Principle 4,
 * the meal-slot pool is generic across meal-time, the fruit-slot pool is
 * Category=Fruit), which alternatives should surface first when a user opens the
 * "Replace with..." or "Add a dish" sheet?
 *
 * This module does NOT read meal-time: it ignores its `meal` arg and orders the
 * pre-filtered pool purely on on-the-day vs not-on-the-day, then on the recency
 * tier. The default lead with slot-meal-matching dishes is a stable partition the
 * caller (`app/convex/swap.ts` `getSlotAlternatives`) applies after ranking.
 *
 * The ranking is a HEAD followed by a TAIL.
 *
 * HEAD ("fits this day"): dishes NOT already placed on that day (so the picker
 * never offers a dish the day already has). Within the head, dishes are ordered
 * by a deterministic LEXICOGRAPHIC comparison on the tuple
 *
 *   (recencyTier, id)   — lower wins
 *
 *   - recencyTier: binary and record-derived (§12). A dish already on this
 *     week's plate is tier 1; every other dish is tier 0, the better tier. So
 *     the head reads "not placed this week first, then dish id". The caller
 *     supplies the tier directly as `placedThisWeek`, the set of dish ids the
 *     live week already carries; the picker derives nothing from a cooking
 *     history, because under v6 the seed history and `weekArchive` are not the
 *     record (§13). Past record weeks are deliberately out of scope too: a swap
 *     is a deliberate user choice, and the only thing the picker owes the user
 *     is not re-offering what is already on the plate.
 *
 *   - id: dish id ascending, the final total tie-break.
 *
 * The protein-band-distance term that used to sit between the two is gone (§12):
 * it ordered within a tier by how close a candidate's per-person protein sat to
 * the outgoing dish's, and v6 removes it along with the `outgoingDish`,
 * `ingredients` and `catalog` arguments that fed it.
 *
 * TAIL: every other dish in the pool (i.e. dishes already on the day, which the
 * head excluded). The tail keeps the broad pool complete (Principle 4: the
 * picker is non-restrictive; nothing is dropped) while pushing same-day repeats
 * below fresh options. The tail is ordered by the same tuple comparison so it is
 * internally deterministic too.
 *
 * DETERMINISM: no RNG anywhere. Every tie resolves through the fixed tuple
 * chain:
 *   1. recencyTier (0 not placed this week, 1 placed this week)
 *   2. dish id ascending (the final, total tie-break)
 *
 * This module ranks; it does NOT filter the pool. The broad-pool eligibility
 * filter (Active + season, plus the meal-slot's non-Fruit / the fruit-slot's
 * Category=Fruit invariant) stays in the caller (`app/convex/swap.ts`
 * `getSlotAlternatives`), non-restrictive per Principle 4.
 */

export interface PickerRankingArgs {
  /**
   * The broad, non-restrictive pool already filtered by the caller (Active +
   * in-season, plus the slot's category invariant). This module ranks but never
   * filters it.
   */
  pool: Dish[];
  /**
   * The slot's meal-time. Accepted for signature stability but NOT read: the
   * head/tail split is purely on-the-day vs not-on-the-day. Meal-time leads are a
   * caller-side stable partition applied after ranking (`getSlotAlternatives`).
   */
  meal: Meal;
  /**
   * Dishes already placed on the same day as the slot. Used to split the head
   * (fresh, not-on-day options) from the tail (same-day repeats). Pass the
   * empty array when nothing is on the day yet (a fresh add).
   */
  dishesOnDay: Dish[];
  /**
   * The §12 recency tier: dish ids already placed anywhere on this week's live
   * plate. These sort after everything else within their group. The caller
   * excludes the slot and position being ranked, so a slot's own current pick
   * does not count against itself. Pass an empty set for a week with nothing on
   * it yet; the ranking then collapses to dish id ascending.
   */
  placedThisWeek: ReadonlySet<number>;
}

/**
 * The binary §12 recency tier for one dish: 0 when the dish is not on this
 * week's plate (the better tier), 1 when it is.
 */
function recencyTier(dish: Dish, placedThisWeek: ReadonlySet<number>): number {
  return placedThisWeek.has(dish.id) ? 1 : 0;
}

/**
 * Rank a broad swap/add pool deterministically. Returns a stable permutation of
 * the input pool: head (fresh, not-on-day) then tail (same-day repeats), each
 * ordered by recency tier then dish id. No dish is dropped; no RNG is used.
 */
export function rankPickerAlternatives(args: PickerRankingArgs): Dish[] {
  const { pool, dishesOnDay, placedThisWeek } = args;

  const onDayIds = new Set(dishesOnDay.map((d) => d.id));

  // Split head (not already on the day) from tail (same-day repeats). The pool
  // is assumed already eligibility-filtered by the caller; we do not re-filter,
  // and we do not read meal-time (the `meal` arg is unused).
  const head: Dish[] = [];
  const tail: Dish[] = [];
  for (const dish of pool) {
    if (onDayIds.has(dish.id)) tail.push(dish);
    else head.push(dish);
  }

  function sortGroup(group: Dish[]): Dish[] {
    return [...group].sort((a, b) => {
      // Lexicographic on (recencyTier, id). The tier is dominant; id is the
      // final total tie-break, so the order is total and stable.
      const tierDiff = recencyTier(a, placedThisWeek) - recencyTier(b, placedThisWeek);
      if (tierDiff !== 0) return tierDiff;
      return a.id - b.id;
    });
  }

  return [...sortGroup(head), ...sortGroup(tail)];
}
