import type { Dish } from "../../src/data/schemas.js";
import type { Day, Meal } from "../../src/eligibility.js";
import type { Pools } from "./pool.js";
import { slotAcceptsDish } from "./composeV4.js";
import type { FavoriteInput } from "./types.js";

/**
 * §3.4 step 1: favorites pinning, with the `timesPerWeek` dial.
 *
 * The v3 pass (`engine/src/favorites.ts`) is reused in SHAPE, not by import: v4 changes
 * the slot-acceptance predicate (new templates) and adds the dial, so the planner is
 * rewritten here. The contract it keeps from v3:
 *
 *   - every library favorite is pinned into one slot per week
 *   - favorites spread across distinct days where feasible
 *   - oldest-added first; when not all fit, the oldest win
 *   - a favorite that finds no accepting free slot is reported, never forced
 *
 * What v4 adds: `timesPerWeek` (1 or 2, capped at 2, absent reads as 1). A dial of 2
 * enters the favorite into the pinning pass twice. The pass runs in ROUNDS rather than
 * placing both copies of a dialed favorite back to back, so a dialed favorite cannot
 * starve a later favorite of its first placement. That reading is a judgment call
 * recorded in run-notes.md; the spec says only "enters the favorite into the pinning
 * pass twice".
 *
 * With all dials at 1 the pass runs exactly one round, which is byte-identical to plain
 * pinning, as the spec requires.
 */

export const MAX_TIMES_PER_WEEK = 2;

export interface FavoritePin {
  dishId: number;
  day: Day;
  meal: Meal;
}

export interface PlanFavoritesV4Result {
  pins: FavoritePin[];
  /** One entry per copy that found no accepting free slot, oldest-first. */
  unplaced: { dishId: number; reason: string }[];
}

interface Slot {
  day: Day;
  meal: Meal;
}

function slotKey(day: Day, meal: Meal): string {
  return `${day}:${meal}`;
}

export function dialFor(fav: FavoriteInput): number {
  const raw = fav.timesPerWeek ?? 1;
  if (!Number.isFinite(raw) || raw < 1) return 1;
  return Math.min(Math.trunc(raw), MAX_TIMES_PER_WEEK);
}

export function planFavoritesV4(args: {
  /** Favorites in oldest-added order (Convex `createdAt` ascending). */
  favorites: readonly FavoriteInput[];
  /** Schedule slots in generation order. */
  slots: readonly Slot[];
  library: Dish[];
  pools: Pools;
}): PlanFavoritesV4Result {
  const { favorites, slots, library, pools } = args;
  const pins: FavoritePin[] = [];
  const unplaced: { dishId: number; reason: string }[] = [];

  const taken = new Set<string>();
  const daysWithFavorite = new Set<Day>();

  const maxRounds = favorites.reduce((m, f) => Math.max(m, dialFor(f)), 1);

  for (let round = 0; round < maxRounds; round += 1) {
    for (const fav of favorites) {
      if (dialFor(fav) <= round) continue;

      const dish = library.find((d) => d.id === fav.dishId);
      if (!dish) {
        unplaced.push({ dishId: fav.dishId, reason: "dish id not in library" });
        continue;
      }

      const accepting = slots.filter((slot) => {
        if (taken.has(slotKey(slot.day, slot.meal))) return false;
        return slotAcceptsDish(slot.day, slot.meal, pools, fav.dishId);
      });

      if (accepting.length === 0) {
        unplaced.push({
          dishId: fav.dishId,
          reason:
            round === 0
              ? "no free slot whose composition accepts the dish"
              : "no free slot for the second dialed placement",
        });
        continue;
      }

      const chosen = accepting.find((s) => !daysWithFavorite.has(s.day)) ?? accepting[0];
      taken.add(slotKey(chosen.day, chosen.meal));
      daysWithFavorite.add(chosen.day);
      pins.push({ dishId: fav.dishId, day: chosen.day, meal: chosen.meal });
    }
  }

  return { pins, unplaced };
}
