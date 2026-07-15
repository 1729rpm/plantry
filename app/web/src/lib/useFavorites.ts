// Shared favorites state. Favorites are a shared Convex table
// (queries.favorites.listFavorites + favorites.addFavorite /
// favorites.addCustomFavorite / favorites.removeFavorite /
// favorites.removeFavoriteById, owned by Stream A). A favorite is either a
// library dish (dishId set) or a free-text custom name (customLabel set); the
// engine only pins library favorites, custom ones are a display-only reminder.
//
// Two surfaces read favorites: the Yours tab (full rows, remove per row, the
// add sheet) and the Menu dish action sheet ("Mark as favorite" on a library
// dish). Centralising the subscription + optimistic model here keeps one source
// of truth for "is this dish a favorite" and one remove path that dispatches to
// the right mutation by row shape.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { anyApi } from "convex/server";
import type { Identity } from "./types.js";

// Raw favorites row from queries/favorites.ts:listFavorites (createdAt
// ascending). Exactly one of dishId / customLabel is set on a valid row.
export interface FavoriteRow {
  _id: string;
  createdAt: number;
  author: Identity;
  dishId?: number;
  customLabel?: string;
}

type AddResult = { ok: true; favoriteId: string } | { ok: false; reason: string };
type RemoveResult = { ok: true } | { ok: false; reason: string };

export interface FavoritesApi {
  // undefined while loading; [] once loaded-empty. Optimistically-removed rows
  // are already filtered out (hidden the instant the user taps remove).
  rows: FavoriteRow[] | undefined;
  loading: boolean;
  // The live library-favorite dish ids, for the add sheet's exclusion set.
  libraryIds: ReadonlySet<number>;
  // Optimism-aware membership test for a library dish.
  isFavorite: (dishId: number) => boolean;
  // One-tap add/remove of a LIBRARY favorite (the action sheet). Toasts.
  toggleLibrary: (dishId: number, dishName: string) => Promise<void>;
  // Save a free-text custom favorite (the add sheet's custom row).
  addCustom: (label: string) => Promise<boolean>;
  // Remove a favorite row (library or custom), dispatching by shape. Optimistic.
  remove: (row: FavoriteRow, dishName: string) => Promise<void>;
}

export function useFavorites(
  identity: Identity,
  showToast: (message: string) => void,
): FavoritesApi {
  const rawRows = useQuery(anyApi.queries.favorites.listFavorites, {}) as
    | FavoriteRow[]
    | undefined;
  const addFavorite = useMutation(anyApi.favorites.addFavorite);
  const addCustomFavorite = useMutation(anyApi.favorites.addCustomFavorite);
  const removeFavorite = useMutation(anyApi.favorites.removeFavorite);
  const removeFavoriteById = useMutation(anyApi.favorites.removeFavoriteById);

  // dishId -> desired library-favorite state while a toggle is in flight.
  const [optimistic, setOptimistic] = useState<Map<number, boolean>>(() => new Map());
  // Row _ids optimistically hidden the instant the user taps remove.
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());

  const liveLibraryIds = useMemo(
    () =>
      new Set(
        (rawRows ?? [])
          .filter((r) => typeof r.dishId === "number")
          .map((r) => r.dishId as number),
      ),
    [rawRows],
  );

  // Prune optimistic toggles once the live set agrees.
  useEffect(() => {
    setOptimistic((prev) => {
      if (prev.size === 0) return prev;
      let changed = false;
      const next = new Map(prev);
      for (const [id, desired] of prev) {
        if (liveLibraryIds.has(id) === desired) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [liveLibraryIds]);

  // Prune hidden markers once the live rows no longer carry the row.
  useEffect(() => {
    setHidden((prev) => {
      if (prev.size === 0) return prev;
      const live = new Set((rawRows ?? []).map((r) => r._id));
      const next = new Set([...prev].filter((id) => live.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [rawRows]);

  const rows = useMemo(
    () => (rawRows ? rawRows.filter((r) => !hidden.has(r._id)) : undefined),
    [rawRows, hidden],
  );

  const isFavorite = useCallback(
    (dishId: number): boolean => {
      const pending = optimistic.get(dishId);
      if (pending !== undefined) return pending;
      return liveLibraryIds.has(dishId);
    },
    [optimistic, liveLibraryIds],
  );

  const clearOptimistic = useCallback((dishId: number) => {
    setOptimistic((prev) => {
      if (!prev.has(dishId)) return prev;
      const next = new Map(prev);
      next.delete(dishId);
      return next;
    });
  }, []);

  const toggleLibrary = useCallback(
    async (dishId: number, dishName: string) => {
      const desired = !isFavorite(dishId);
      setOptimistic((prev) => new Map(prev).set(dishId, desired));
      try {
        const result = (
          desired
            ? await addFavorite({ author: identity, dishId })
            : await removeFavorite({ author: identity, dishId })
        ) as AddResult | RemoveResult;
        if (result?.ok) {
          showToast(
            desired ? `Added ${dishName} to favorites` : `Removed ${dishName} from favorites`,
          );
          return;
        }
        if (
          result &&
          (result.reason === "already-favorite" || result.reason === "not-a-favorite")
        ) {
          clearOptimistic(dishId);
          return;
        }
        clearOptimistic(dishId);
        showToast("Something is off. Try again.");
      } catch (err) {
        console.error("favorite toggle threw", err);
        clearOptimistic(dishId);
        showToast("Something is off. Try again.");
      }
    },
    [addFavorite, removeFavorite, identity, isFavorite, clearOptimistic, showToast],
  );

  const addCustom = useCallback(
    async (label: string): Promise<boolean> => {
      const trimmed = label.trim();
      if (!trimmed) return false;
      try {
        const result = (await addCustomFavorite({
          author: identity,
          customLabel: trimmed,
        })) as AddResult;
        if (result?.ok) {
          showToast(`Added ${trimmed} to favorites`);
          return true;
        }
        if (result?.reason === "already-favorite") {
          showToast(`${trimmed} is already a favorite`);
          return true;
        }
        showToast("Something is off. Try again.");
        return false;
      } catch (err) {
        console.error("addCustomFavorite threw", err);
        showToast("Something is off. Try again.");
        return false;
      }
    },
    [addCustomFavorite, identity, showToast],
  );

  const remove = useCallback(
    async (row: FavoriteRow, dishName: string) => {
      setHidden((prev) => new Set(prev).add(row._id));
      try {
        const result = (
          typeof row.dishId === "number"
            ? await removeFavorite({ author: identity, dishId: row.dishId })
            : await removeFavoriteById({ favoriteId: row._id })
        ) as RemoveResult;
        if (result?.ok) {
          showToast(`Removed ${dishName} from favorites`);
          return; // prune effect drops the marker when the query settles
        }
        // Already gone (a race): leave it hidden, the live query will agree.
        if (
          result &&
          (result.reason === "not-a-favorite" || result.reason === "no-such-favorite")
        ) {
          return;
        }
        revertHidden(row._id);
        showToast("Something is off. Try again.");
      } catch (err) {
        console.error("removeFavorite threw", err);
        revertHidden(row._id);
        showToast("Something is off. Try again.");
      }
    },
    [removeFavorite, removeFavoriteById, identity, showToast],
  );

  function revertHidden(id: string) {
    setHidden((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  return {
    rows,
    loading: rawRows === undefined,
    libraryIds: liveLibraryIds,
    isFavorite,
    toggleLibrary,
    addCustom,
    remove,
  };
}
