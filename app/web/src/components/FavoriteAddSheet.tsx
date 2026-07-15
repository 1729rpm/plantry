// Add-a-favorite sheet. A search over the WHOLE baked library (favorites are a
// standing household list, independent of season or active state, so this
// searches `allDishes`, not the season-narrowed addablePool the day-editor Add
// sheet uses), narrowed to dishes not already favorited. Any non-empty query
// also offers a dashed "Add {query} as a favorite" row for a custom free-text
// name not in the library (the "Avocado toast every week" case). Picking either
// saves immediately (attributed, toast) and closes the sheet. Modeled on
// AddDishSheet.tsx: the shared Sheet primitive (so it joins the module-level
// browser-Back history-marker system), SearchField, matchesQuery, and DishRow.

import { useMemo, useState } from "react";
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
  // The live favorite dish ids from the parent's listFavorites subscription. A
  // dish already on the list is excluded from the results (it is not re-addable).
  favoriteDishIds: ReadonlySet<number>;
  // Save a free-text custom favorite (owned by the parent's useFavorites hook so
  // the list updates in one place). Resolves true on success.
  onAddCustom: (label: string) => Promise<boolean>;
  // Reuse the parent's single toast surface so there is one toast system.
  showToast: (message: string) => void;
  onClose: () => void;
}

// The library, name-sorted, narrowed to dishes not already favorited and
// matching the search text. Empty query shows the whole addable library. Pure
// over its inputs.
export function favoriteAddResults(
  dishes: readonly Dish[],
  query: string,
  favoriteIds: ReadonlySet<number>,
): Dish[] {
  const needle = query.trim();
  const addable = dishes.filter((d) => !favoriteIds.has(d.id));
  const matched = needle === "" ? addable : addable.filter((d) => matchesQuery(d.name, query));
  return matched.sort((a, b) => a.name.localeCompare(b.name));
}

export function FavoriteAddSheet({
  identity,
  favoriteDishIds,
  onAddCustom,
  showToast,
  onClose,
}: FavoriteAddSheetProps) {
  const addFavorite = useMutation(anyApi.favorites.addFavorite);

  const [q, setQ] = useState<string>("");
  const trimmed = q.trim();

  const results = useMemo(
    () => favoriteAddResults(allDishes, q, favoriteDishIds),
    [q, favoriteDishIds],
  );

  async function pickLibrary(dish: Dish) {
    try {
      const result = (await addFavorite({ author: identity, dishId: dish.id })) as
        | { ok: true }
        | { ok: false; reason: string };
      if (result?.ok || (result && result.reason === "already-favorite")) {
        showToast(`Added ${dish.name} to favorites`);
        onClose();
        return;
      }
      showToast("Something is off. Try again.");
    } catch (err) {
      console.error("addFavorite threw", err);
      showToast("Something is off. Try again.");
    }
  }

  async function pickCustom() {
    if (!trimmed) return;
    const ok = await onAddCustom(trimmed);
    if (ok) onClose();
  }

  return (
    <Sheet onClose={onClose} tall picker>
      <div className="reason__title">Add a favorite</div>
      <div className="reason__hint">{"A favorite gets a place in every week's menu"}</div>
      <SearchField
        value={q}
        onChange={setQ}
        placeholder="Search the library, or type a dish"
        autoFocus
      />
      {trimmed && (
        <button type="button" className="fav-add__custom" onClick={pickCustom}>
          Add &ldquo;{trimmed}&rdquo; as a favorite
        </button>
      )}
      {results.length === 0 ? (
        <div className="picker__hint">
          {trimmed
            ? "Nothing in the library matches. Add it as its own dish above."
            : "The whole library is already in your favorites."}
        </div>
      ) : (
        <div className="picker__results">
          {results.map((d) => (
            <button
              key={d.id}
              type="button"
              className="picker__row fav-add__row"
              onClick={() => pickLibrary(d)}
            >
              <DishRow
                pick={{
                  dishId: d.id,
                  customLabel: null,
                  source: "swapped",
                  author: "system",
                  updatedAt: 0,
                }}
              />
            </button>
          ))}
        </div>
      )}
    </Sheet>
  );
}
