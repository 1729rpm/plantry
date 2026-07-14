import type { Dish, MenuHistoryRow, Season } from "./data/schemas.js";
import type { Day, Meal } from "./eligibility.js";
import type { SlotPlan } from "./schedule.js";
import { slotAcceptsDish, slotKey } from "./requests.js";

/**
 * §4 step 4 favorites: guaranteed weekly placement (`features/wishlist-favorites-v2`).
 *
 * A favorite is no longer a ranking tiebreak (the retired `byFavorites` / capped
 * promotion). It is now a guarantee: every library favorite the household keeps is
 * pinned into exactly one slot of every generated week, spread across distinct days,
 * with composition locks always winning. This module is the PURE PLANNER for that
 * pass, structurally parallel to the §6 request planner (`planRequests`): it reads
 * the schedule, library, season, and history and returns, per favorite, either a
 * (day, meal) slot to pin into or a report that it could not be placed. `generateWeek`
 * then pins each placement exactly the way it pins a §6 request (front of the
 * accepting slot's ranked pool, overriding §4 recency for that one position).
 *
 * Contract (docs/engine.md §4 step 4):
 *
 *   - Every library favorite is placed into one slot whose §3 composition accepts it
 *     (it appears in a position pool of that slot's candidate set), respecting the
 *     dish's meal: a breakfast favorite lands in a breakfast slot, a lunch favorite in
 *     a lunch plate. Meal routing is implicit: a wrong-meal dish never appears in a
 *     slot's pools, so `slotAcceptsDish` rejects it.
 *   - Favorites spread across distinct days where feasible: each favorite prefers an
 *     accepting slot on a day that holds no favorite yet, so two favorites are never
 *     forced onto one day while another day is open.
 *   - Favorites are resolved oldest-added first (the caller passes the Convex
 *     `favorites` rows ordered by `createdAt` ascending). When the full set cannot all
 *     be placed under the locks or capacity, the oldest win and the rest are reported
 *     in `unplacedDishIds`. The pass never breaks a composition lock to force a
 *     favorite; it only pins into slots that already accept the dish.
 *   - A favorite whose id is not in the library (a stale id; custom/free-text
 *     favorites are not passed here at all) is reported unplaced, never crashes.
 *
 * The pass is a no-op for an empty favorite set: no pins, no reports, so generation is
 * byte-identical to a household with no favorites.
 */

/** A single favorite resolved to the slot it will be pinned into. */
export interface FavoritePlacement {
  dishId: number;
  day: Day;
  meal: Meal;
}

export interface PlanFavoritesArgs {
  /**
   * Library favorite dish ids the generation must place, ordered oldest-added
   * first (Convex `favorites` rows sorted by `createdAt` ascending). Order is
   * load-bearing: when not all fit, the oldest win.
   */
  favoriteDishIds: readonly number[];
  /** The (already substitution-rewritten) week schedule generateWeek will run. */
  schedule: SlotPlan[];
  library: Dish[];
  history: MenuHistoryRow[];
  season: Season;
  /**
   * Slots already claimed by a §3.2 substitution lead or a §6 request. A favorite
   * never displaces either; it takes the next accepting free slot instead.
   */
  reservedSlots?: ReadonlySet<string>;
}

export interface PlanFavoritesResult {
  /** One placement per favorite that found an accepting, free slot. */
  placements: FavoritePlacement[];
  /**
   * Favorite ids the pass could not place this week (no accepting free slot, or an
   * id absent from the library), in the input's oldest-first order. The caller logs
   * one incident naming them; the engine never forces a favorite into an
   * incompatible slot.
   */
  unplacedDishIds: number[];
}

/**
 * Plan the guaranteed favorite placements against the schedule. Pure: no RNG, no
 * mutation of inputs. Each favorite is resolved in order to a slot whose composition
 * accepts it and that is not reserved or already claimed by an earlier favorite,
 * preferring a day that holds no favorite yet so the week's favorites spread out. A
 * favorite that finds no accepting free slot is reported unplaced and not pinned.
 */
export function planFavorites(args: PlanFavoritesArgs): PlanFavoritesResult {
  const { favoriteDishIds, schedule, library, history, season } = args;
  const reserved = new Set(args.reservedSlots ?? []);
  const placements: FavoritePlacement[] = [];
  const unplacedDishIds: number[] = [];

  // Slots taken by an earlier favorite in this same plan, so two favorites never
  // land on one slot.
  const takenSlots = new Set<string>();
  // Days that already hold a favorite, so the next favorite prefers a fresh day
  // (the distinct-days spread).
  const daysWithFavorite = new Set<Day>();
  // Lunch carbs pinned by earlier favorites, so a later Rice favorite sees the §3.1
  // "Rice at most once" cap the same way generation will.
  const pinnedLunchCarbs: Dish[] = [];
  // Dedupe defensively: the Convex `favorites` table is one row per dish, but a
  // stale caller must never place one favorite twice.
  const seen = new Set<number>();

  for (const dishId of favoriteDishIds) {
    if (seen.has(dishId)) continue;
    seen.add(dishId);

    const dish = library.find((d) => d.id === dishId);
    if (!dish) {
      unplacedDishIds.push(dishId);
      continue;
    }

    const accepting = schedule.filter((slot) => {
      const key = slotKey(slot.day, slot.meal);
      if (reserved.has(key) || takenSlots.has(key)) return false;
      return slotAcceptsDish({
        slot,
        dishId,
        library,
        history,
        season,
        weekLunchCarbs: pinnedLunchCarbs,
      });
    });

    if (accepting.length === 0) {
      unplacedDishIds.push(dishId);
      continue;
    }

    // Distinct-days spread: prefer the first accepting slot on a day that holds no
    // favorite yet; fall back to the first accepting slot when every accepting day
    // already carries one (feasibility, not a hard rule).
    const chosen = accepting.find((slot) => !daysWithFavorite.has(slot.day)) ?? accepting[0];
    takenSlots.add(slotKey(chosen.day, chosen.meal));
    daysWithFavorite.add(chosen.day);
    if (dish.category === "Chapati" || dish.category === "Rice") {
      pinnedLunchCarbs.push(dish);
    }
    placements.push({ dishId, day: chosen.day, meal: chosen.meal });
  }

  return { placements, unplacedDishIds };
}
