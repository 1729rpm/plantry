import type { Dish, Season } from "../data/schemas.js";
import type { PoolProvider } from "./place.js";
import type { PickRole, PlanPick, Scope } from "./types.js";

/**
 * v6 §8 and §6 step 2: pin every favorite into exactly one slot of the week.
 *
 * The favorites table keeps its product guarantee: every favorites-list dish is
 * pinned into exactly one slot of its meal type in every generated week, oldest
 * added first, never breaking a hard composition rule, and an unplaceable
 * favorite is reported rather than forced. v6 drops the v5 pool exclusion and
 * the recency exemption: the deficit ledger (§3) already lets a high-rate
 * favorite earn a second placement and stops a low-rate one from over-repeating.
 *
 * Spreading the pinned favorites across distinct days is not this module's job:
 * §6 step 5 (`assignDays` in `place.ts`) assigns days, with pinned favorites
 * first in the priority order, and its one-plate-per-weekday supply is what
 * makes "exactly one slot each, on distinct days" hold.
 *
 * Charging the deficit is the caller's job too: stream D applies stream A's
 * `charge` to every returned pick, so pinning charges like any other placement.
 *
 * Pure and deterministic. Favorites are processed in the order given (the
 * favorites table's `createdAt` ascending), which is the only ordering §8 names.
 */

/** One pinned favorite: a plan pick with no day yet, carrying `origin: "favorite"`. */
export type PinnedFavorite = Omit<PlanPick, "day">;

export interface PinFavoritesArgs {
  /** The favorites table's library dish ids, `createdAt` ascending (§8). */
  favoriteDishIds: readonly number[];
  library: Dish[];
  season: Season;
  /** Stream B's ranked role pools; membership is what "a slot accepts this dish" means. */
  provider: PoolProvider;
}

export interface PinFavoritesResult {
  pinned: PinnedFavorite[];
  /** Dish ids §8 could not place, in the order they were tried. Reported, never forced. */
  unplaceable: number[];
}

/**
 * The positions a favorite of each meal type may take, in preference order.
 *
 * `capacity` is how many of that position a generated week holds, which is what
 * stops §8 from pinning six lunch stars into five weekday lunches. The weekday
 * counts are §4's schedule: five weekday breakfasts and five weekday lunches,
 * each with one main or star and at most one small item or companion. Saturday
 * holds one treat, so a favorite that lives only in the Saturday-scoped pool
 * (§5.4) still has one place to go.
 */
interface Position {
  role: PickRole;
  scope: Scope;
  meal: "breakfast" | "lunch";
  capacity: number;
}

const BREAKFAST_MAIN: Position = {
  role: "breakfast-main",
  scope: "weekdayBreakfast",
  meal: "breakfast",
  capacity: 5,
};
const BREAKFAST_SMALL: Position = {
  role: "breakfast-small",
  scope: "weekdayBreakfast",
  meal: "breakfast",
  capacity: 5,
};
const LUNCH_STAR: Position = {
  role: "star",
  scope: "weekdayLunch",
  meal: "lunch",
  capacity: 5,
};
const LUNCH_COMPANION: Position = {
  role: "companion",
  scope: "weekdayLunch",
  meal: "lunch",
  capacity: 5,
};
const SATURDAY_TREAT: Position = {
  role: "treat",
  scope: "saturday",
  meal: "lunch",
  capacity: 1,
};

/**
 * The positions to try for a dish, by its meal type and category (§5.1, §5.2).
 *
 * A Category Accompaniment dish is a companion or a breakfast small item, never
 * a star and never a breakfast main (§5.1: "Accompaniment dishes are
 * companions, never stars"), so its preference order is inverted. Everything
 * else leads with the structural position of its meal.
 */
function positionsFor(dish: Dish): Position[] {
  if (dish.time === "Breakfast") {
    return dish.category === "Accompaniment"
      ? [BREAKFAST_SMALL]
      : [BREAKFAST_MAIN, BREAKFAST_SMALL];
  }
  return dish.category === "Accompaniment"
    ? [LUNCH_COMPANION]
    : [LUNCH_STAR, LUNCH_COMPANION, SATURDAY_TREAT];
}

function isEligible(dish: Dish, season: Season): boolean {
  if (dish.active !== "Yes") return false;
  return dish.seasons === "All" || dish.seasons.includes(season);
}

/**
 * §6 step 2. Place every favorite into exactly one slot of its meal type.
 *
 * A favorite is placed into the first position (in `positionsFor` order) whose
 * pool contains it and that still has room this week. Pool membership is the
 * acceptance test: stream B's pools are already gated by Active, in-season, and
 * presence in the scope (§3.2), and they encode the composition definitions of
 * §5.1 and §5.2, so a dish in a role's pool is a dish that role can legitimately
 * hold. A favorite in no pool of its meal type, or one whose every position is
 * already full, is reported as unplaceable.
 *
 * A dish listed twice in the favorites table is pinned once: "exactly one slot"
 * is the guarantee, and a duplicated row is not a second guarantee.
 */
export function pinFavorites(args: PinFavoritesArgs): PinFavoritesResult {
  const { favoriteDishIds, library, season, provider } = args;

  const dishById = new Map<number, Dish>();
  for (const dish of library) dishById.set(dish.id, dish);

  const pinned: PinnedFavorite[] = [];
  const unplaceable: number[] = [];
  const placed = new Set<number>();
  const seen = new Set<number>();
  const used = new Map<PickRole, number>();

  for (const dishId of favoriteDishIds) {
    if (seen.has(dishId)) continue;
    seen.add(dishId);

    const dish = dishById.get(dishId);
    if (!dish || !isEligible(dish, season)) {
      unplaceable.push(dishId);
      continue;
    }

    const position = positionsFor(dish).find((candidate) => {
      if ((used.get(candidate.role) ?? 0) >= candidate.capacity) return false;
      return provider(candidate.role, candidate.scope, placed).some(
        (entry) => entry.dish.id === dishId,
      );
    });

    if (!position) {
      unplaceable.push(dishId);
      continue;
    }

    used.set(position.role, (used.get(position.role) ?? 0) + 1);
    placed.add(dishId);
    pinned.push({
      meal: position.meal,
      dishId,
      role: position.role,
      scope: position.scope,
      origin: "favorite",
    });
  }

  return { pinned, unplaceable };
}
