// Add-a-favorite sheet. A generic search over the WHOLE baked library so every
// dish is reachable (favorites are a standing household list, independent of
// season or active state, so this searches `allDishes`, not the season-narrowed
// addablePool the day-editor Add sheet uses). Each result row shows a
// filled/selected state when the dish is already a favorite and tapping a row
// toggles it: an un-favorited dish is added, an already-favorite one is removed
// (Rajat: "the existing dishes are also shown"). The toggle is optimistic; the
// row flips immediately and reverts on failure, and an add raises a toast.
// Modeled on AddDishSheet.tsx: the shared Sheet primitive (so it joins the
// module-level browser-Back history-marker system), SearchField, matchesQuery,
// and DishRow.

import { useEffect, useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { anyApi } from "convex/server";
import type { Dish } from "@plantry/engine";
import type { Identity } from "../lib/types.js";
import { allDishes } from "../lib/library.js";
import { matchesQuery } from "../lib/search.js";
import { Sheet, SearchField } from "./primitives.js";
import { DishRow } from "./DishRow.js";

interface FavoriteAddSheetProps {
  identity: Identity;
  // The live favorite dish ids from the parent's listFavorites subscription.
  // Drives each row's baseline selected state; the local optimistic overlay
  // below sits on top of it for in-flight toggles.
  favoriteDishIds: ReadonlySet<number>;
  // Reuse the parent's single toast surface so there is one toast system.
  showToast: (message: string) => void;
  onClose: () => void;
}

// Whether a dish reads as a favorite right now: the optimistic overlay wins for
// an in-flight toggle, otherwise the live favorite set decides. Pure so the
// selected-state logic is unit-tested without a render.
export function computeSelected(
  dishId: number,
  favoriteIds: ReadonlySet<number>,
  optimistic: ReadonlyMap<number, boolean>,
): boolean {
  const pending = optimistic.get(dishId);
  if (pending !== undefined) return pending;
  return favoriteIds.has(dishId);
}

// The library, name-sorted, narrowed by the search text only. Empty query shows
// the whole library (every dish reachable). Pure over its inputs.
export function favoriteAddResults(dishes: readonly Dish[], query: string): Dish[] {
  const needle = query.trim();
  const matched =
    needle === "" ? dishes.slice() : dishes.filter((d) => matchesQuery(d.name, query));
  return matched.sort((a, b) => a.name.localeCompare(b.name));
}

export function FavoriteAddSheet({
  identity,
  favoriteDishIds,
  showToast,
  onClose,
}: FavoriteAddSheetProps) {
  const addFavorite = useMutation(anyApi.favorites.addFavorite);
  const removeFavorite = useMutation(anyApi.favorites.removeFavorite);

  const [q, setQ] = useState<string>("");
  // Optimistic overlay: dishId -> desired favorite state while a toggle is in
  // flight. Reconciled away by the effect below once the live set catches up,
  // and reverted immediately on a failed mutation.
  const [optimistic, setOptimistic] = useState<Map<number, boolean>>(() => new Map());

  const results = useMemo(() => favoriteAddResults(allDishes, q), [q]);

  // Drop an optimistic entry once the live favorite set agrees with it, so the
  // row does not flash back to its old state on the beat between the mutation
  // resolving and the subscription updating. Only prunes entries reality has
  // caught up to; a still-pending or reverted entry is left alone.
  useEffect(() => {
    setOptimistic((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const [id, desired] of prev) {
        if (favoriteDishIds.has(id) === desired) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [favoriteDishIds]);

  function clearOptimistic(dishId: number) {
    setOptimistic((prev) => {
      if (!prev.has(dishId)) return prev;
      const next = new Map(prev);
      next.delete(dishId);
      return next;
    });
  }

  async function toggle(dish: Dish) {
    const desired = !computeSelected(dish.id, favoriteDishIds, optimistic);
    setOptimistic((prev) => new Map(prev).set(dish.id, desired));
    try {
      const result = (
        desired
          ? await addFavorite({ author: identity, dishId: dish.id })
          : await removeFavorite({ author: identity, dishId: dish.id })
      ) as { ok: true } | { ok: false; reason: string };
      if (result?.ok) {
        if (desired) showToast(`Added ${dish.name} to favorites`);
        // Leave the optimistic entry for the reconcile effect to prune when the
        // live set updates; that avoids a flash if the subscription lags a beat.
        return;
      }
      // The mutation reports the dish is already in the desired state (a
      // duplicate tap racing the subscription). Treat as reconciled: drop the
      // overlay and let the live set stand, no error toast.
      clearOptimistic(dish.id);
    } catch (err) {
      console.error("favorite toggle threw", err);
      clearOptimistic(dish.id);
      showToast("Something is off. Try again.");
    }
  }

  return (
    <Sheet onClose={onClose} tall picker>
      <div className="reason__title">Add a favorite</div>
      <div className="reason__hint">
        Search the whole library; tap a dish to add it, tap a favorite to remove it
      </div>
      <SearchField value={q} onChange={setQ} placeholder="Search all dishes" autoFocus />
      {results.length === 0 ? (
        <div className="picker__hint">No dish matches your search.</div>
      ) : (
        <div className="picker__results">
          {results.map((d) => {
            const selected = computeSelected(d.id, favoriteDishIds, optimistic);
            return (
              <button
                key={d.id}
                type="button"
                className={`picker__row fav-add__row${selected ? " fav-add__row--selected" : ""}`}
                aria-pressed={selected}
                onClick={() => toggle(d)}
              >
                <DishRow
                  pick={{
                    dishId: d.id,
                    customLabel: null,
                    source: "swapped",
                    author: "system",
                    updatedAt: 0,
                  }}
                  trailing={<FavoriteMark selected={selected} />}
                />
              </button>
            );
          })}
        </div>
      )}
    </Sheet>
  );
}

// The trailing selected marker on a result row: a filled heart when the dish is
// a favorite, an outline heart otherwise. Single-stroke inline SVG (no icon
// library, per engineering.md §1); inherits color via currentColor.
function FavoriteMark({ selected }: { selected: boolean }) {
  return (
    <span className={`fav-add__mark${selected ? " fav-add__mark--on" : ""}`} aria-hidden="true">
      <svg
        width="20"
        height="20"
        viewBox="0 0 22 22"
        fill={selected ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M11 18.5C11 18.5 3.5 14 3.5 8.75A3.75 3.75 0 0 1 11 6.5a3.75 3.75 0 0 1 7.5 2.25C18.5 14 11 18.5 11 18.5Z" />
      </svg>
    </span>
  );
}
