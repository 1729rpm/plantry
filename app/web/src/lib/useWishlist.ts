// Shared wishlist state. The wishlist is a single shared Convex table
// (queries.wishlist.listWishlist + wishlist.addToWishlist /
// wishlist.removeFromWishlist, owned by Stream A). Three surfaces read it: the
// Explore card hearts, the Explore/Yours dish sheet toggle, and the Menu dish
// detail sheet's "Mark as wishlist" button. Centralising the subscription and
// the optimistic toggle here keeps one source of truth for "is this dish
// wishlisted" and one optimistic model, instead of three near-identical copies.
//
// The toggle is optimistic: the desired state wins immediately, reconciles away
// once the live subscription agrees, and reverts on a hard failure. A race the
// server reports (already-wishlisted / not-wishlisted) is treated as reconciled,
// not an error, since the live set will settle to the same place.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { anyApi } from "convex/server";
import type { Identity } from "./types.js";

// Raw wishlist row from queries/wishlist.ts:listWishlist (createdAt ascending).
export interface WishlistRow {
  _id: string;
  createdAt: number;
  author: Identity;
  dishId: number;
}

// Add / remove result unions (Stream A's binding contract).
type AddResult = { ok: true; wishlistId: string } | { ok: false; reason: string };
type RemoveResult = { ok: true } | { ok: false; reason: string };

export interface WishlistApi {
  // undefined while the subscription loads; [] once loaded-empty.
  rows: WishlistRow[] | undefined;
  loading: boolean;
  // Optimism-aware membership test for a dish.
  isWishlisted: (dishId: number) => boolean;
  // One-tap add/remove. `dishName` drives the confirming toast copy.
  toggle: (dishId: number, dishName: string) => Promise<void>;
}

// Toast copy, exported so a test can pin the wording (and its no-dash form).
export function wishlistAddedToast(dishName: string): string {
  return `${dishName} is on your wishlist`;
}
export function wishlistRemovedToast(dishName: string): string {
  return `Removed ${dishName} from your wishlist`;
}

export function useWishlist(identity: Identity, showToast: (message: string) => void): WishlistApi {
  const rows = useQuery(anyApi.queries.wishlist.listWishlist, {}) as WishlistRow[] | undefined;
  const add = useMutation(anyApi.wishlist.addToWishlist);
  const remove = useMutation(anyApi.wishlist.removeFromWishlist);

  // dishId -> desired wishlist state while a toggle is in flight.
  const [optimistic, setOptimistic] = useState<Map<number, boolean>>(() => new Map());

  const liveIds = useMemo(() => new Set((rows ?? []).map((r) => r.dishId)), [rows]);

  // Drop an optimistic entry once the live set agrees with it, so a row does not
  // flash back on the beat between the mutation resolving and the subscription
  // updating.
  useEffect(() => {
    setOptimistic((prev) => {
      if (prev.size === 0) return prev;
      let changed = false;
      const next = new Map(prev);
      for (const [id, desired] of prev) {
        if (liveIds.has(id) === desired) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [liveIds]);

  const isWishlisted = useCallback(
    (dishId: number): boolean => {
      const pending = optimistic.get(dishId);
      if (pending !== undefined) return pending;
      return liveIds.has(dishId);
    },
    [optimistic, liveIds],
  );

  const clearOptimistic = useCallback((dishId: number) => {
    setOptimistic((prev) => {
      if (!prev.has(dishId)) return prev;
      const next = new Map(prev);
      next.delete(dishId);
      return next;
    });
  }, []);

  const toggle = useCallback(
    async (dishId: number, dishName: string) => {
      const desired = !isWishlisted(dishId);
      setOptimistic((prev) => new Map(prev).set(dishId, desired));
      try {
        const result = (
          desired
            ? await add({ author: identity, dishId })
            : await remove({ author: identity, dishId })
        ) as AddResult | RemoveResult;
        if (result?.ok) {
          showToast(desired ? wishlistAddedToast(dishName) : wishlistRemovedToast(dishName));
          return; // reconcile effect prunes the marker when the query settles
        }
        // A race the server already settled the other way (already-wishlisted /
        // not-wishlisted): drop the overlay, let the live set stand, no error.
        if (
          result &&
          (result.reason === "already-wishlisted" || result.reason === "not-wishlisted")
        ) {
          clearOptimistic(dishId);
          return;
        }
        clearOptimistic(dishId);
        showToast("Something is off. Try again.");
      } catch (err) {
        console.error("wishlist toggle threw", err);
        clearOptimistic(dishId);
        showToast("Something is off. Try again.");
      }
    },
    [add, remove, identity, isWishlisted, clearOptimistic, showToast],
  );

  return { rows, loading: rows === undefined, isWishlisted, toggle };
}
