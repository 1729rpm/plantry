// Wishlist screen. A sub-view of Explore (opened from the Explore header, not a
// tab and not a Sheet). It renders two sections over live Convex data:
//
//   1. Favorites: the household's standing "we want this regularly" list. Each
//      current favorite is a row (photo, name, meta) with a 44px remove target;
//      an "Add a favorite" button opens FavoriteAddSheet (search over the whole
//      library). A favorite surfaces about once a week in the generated menu.
//   2. Saved for next week: the nextWeekQueue, finally visible. Each queued dish
//      shows its saved reason, who saved it, and when, and is removable; removing
//      it drops it from next week's generation and surfaces in the Changes feed.
//
// The two queries (listFavorites, listQueuedNextWeek) are subscribed ONLY while
// this screen is mounted, which is only while the wishlist sub-view is open. A
// user who never opens the wishlist never subscribes, so the Explore tab is
// unaffected (and today's production, where the Stream A queries do not yet
// exist, can never hit a missing-function error from the Explore tab).
//
// Removals are optimistic: the row hides immediately and reverts on failure. The
// live subscription then confirms the drop; a prune effect clears the optimistic
// marker once the query no longer carries the row, so nothing flashes back.

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { anyApi } from "convex/server";
import type { Dish } from "@plantry/engine";
import type { Identity } from "../lib/types.js";
import { dishById, dishMetaLine, dishPhotoUrl } from "../lib/library.js";
import { Card, SectionLabel, Thumb } from "./primitives.js";
import { FavoriteAddSheet } from "./FavoriteAddSheet.js";

// The exact empty-state copy: one sentence each, teaching the loop. Exported so
// a test pins the wording (and its no-dash cleanliness) to the spec.
export const FAVORITES_EMPTY = "Favorites show up about once a week in the generated menu.";
export const QUEUE_EMPTY = "Saved dishes get placed into next week's menu, oldest first.";

// Raw favorites row from queries/favorites.ts:listFavorites (createdAt ascending).
export interface FavoriteRow {
  _id: string;
  createdAt: number;
  author: Identity;
  dishId: number;
}

// Raw nextWeekQueue row from queries/nextWeekQueue.ts:listQueuedNextWeek
// (status "queued", createdAt ascending, so placement order reads top-down).
export interface QueueRow {
  _id: string;
  createdAt: number;
  author: Identity;
  dishId: number;
  reason: string;
}

export interface ResolvedFavorite {
  id: string;
  dishId: number;
  name: string;
  meta: string;
  dish: Dish | undefined;
}

export interface ResolvedQueueItem {
  id: string;
  dishId: number;
  name: string;
  reason: string;
  savedMeta: string;
  dish: Dish | undefined;
}

const WHEN_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// Short local-calendar date for a saved-at timestamp, e.g. "Jul 13". Local time
// on both construction and formatting, so it is stable regardless of the host
// timezone (mirrors the local-date discipline in lib/days.ts).
export function formatWhen(ms: number): string {
  const d = new Date(ms);
  return `${WHEN_MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function authorLabel(author: Identity): string {
  return author === "rajat" ? "Rajat" : "Tuhina";
}

// Resolve raw favorites rows to display models against the baked library. A row
// whose dish is not in the library degrades to a plain fallback name rather than
// dropping out, so a stale favorite is still removable.
export function resolveFavoriteRows(rows: readonly FavoriteRow[]): ResolvedFavorite[] {
  return rows.map((r) => {
    const dish = dishById(r.dishId);
    return {
      id: r._id,
      dishId: r.dishId,
      name: dish?.name ?? "From the library",
      meta: dishMetaLine(dish),
      dish,
    };
  });
}

// Resolve raw queue rows to display models: dish from the baked library, the
// saved reason, and a "Saved by <who> · <when>" meta line.
export function resolveQueueRows(rows: readonly QueueRow[]): ResolvedQueueItem[] {
  return rows.map((r) => {
    const dish = dishById(r.dishId);
    return {
      id: r._id,
      dishId: r.dishId,
      name: dish?.name ?? "From the library",
      reason: r.reason,
      savedMeta: `Saved by ${authorLabel(r.author)} · ${formatWhen(r.createdAt)}`,
      dish,
    };
  });
}

interface WishlistScreenProps {
  identity: Identity;
  onBack: () => void;
}

export function WishlistScreen({ identity, onBack }: WishlistScreenProps) {
  // Subscribed only while this screen is mounted (only while the wishlist is
  // open). undefined = loading; [] = loaded-empty.
  const favoritesRaw = useQuery(anyApi.queries.favorites.listFavorites, {}) as
    | FavoriteRow[]
    | undefined;
  const queueRaw = useQuery(anyApi.queries.nextWeekQueue.listQueuedNextWeek, {}) as
    | QueueRow[]
    | undefined;

  const removeFavorite = useMutation(anyApi.favorites.removeFavorite);
  const removeFromNextWeekQueue = useMutation(
    anyApi.nextWeekQueueMutations.removeFromNextWeekQueue,
  );

  const [addOpen, setAddOpen] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);
  // Optimistic-removal markers: favorite dish ids and queue row ids hidden the
  // instant the user taps remove, pruned once the subscription confirms the drop
  // and reverted on failure.
  const [pendingFav, setPendingFav] = useState<Set<number>>(() => new Set());
  const [pendingQueue, setPendingQueue] = useState<Set<string>>(() => new Set());

  const favorites = useMemo(
    () => (favoritesRaw ? resolveFavoriteRows(favoritesRaw) : []),
    [favoritesRaw],
  );
  const queue = useMemo(() => (queueRaw ? resolveQueueRows(queueRaw) : []), [queueRaw]);

  // The live favorite id set, for the add sheet's selected state.
  const favoriteDishIds = useMemo(() => new Set(favorites.map((f) => f.dishId)), [favorites]);

  // Prune optimistic markers once the live data no longer carries the row (the
  // removal is confirmed), so a marker never lingers to hide a re-added dish.
  useEffect(() => {
    setPendingFav((prev) => {
      if (prev.size === 0) return prev;
      const live = new Set(favorites.map((f) => f.dishId));
      const next = new Set([...prev].filter((id) => live.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [favorites]);

  useEffect(() => {
    setPendingQueue((prev) => {
      if (prev.size === 0) return prev;
      const live = new Set(queue.map((q) => q.id));
      const next = new Set([...prev].filter((id) => live.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [queue]);

  const shownFavorites = favorites.filter((f) => !pendingFav.has(f.dishId));
  const shownQueue = queue.filter((q) => !pendingQueue.has(q.id));

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast((cur) => (cur === message ? null : cur)), 2600);
  }

  async function handleRemoveFavorite(fav: ResolvedFavorite) {
    setPendingFav((prev) => new Set(prev).add(fav.dishId));
    try {
      const result = (await removeFavorite({ author: identity, dishId: fav.dishId })) as
        | { ok: true }
        | { ok: false; reason: string };
      if (result?.ok) return; // prune effect drops the marker when the query updates
      // Already gone (a race): leave it hidden, the live query will agree.
      if (result && result.reason === "not-a-favorite") return;
      revertPendingFav(fav.dishId);
      showToast("Something is off. Try again.");
    } catch (err) {
      console.error("removeFavorite threw", err);
      revertPendingFav(fav.dishId);
      showToast("Something is off. Try again.");
    }
  }

  function revertPendingFav(dishId: number) {
    setPendingFav((prev) => {
      const next = new Set(prev);
      next.delete(dishId);
      return next;
    });
  }

  async function handleRemoveQueued(item: ResolvedQueueItem) {
    setPendingQueue((prev) => new Set(prev).add(item.id));
    try {
      // The contract does not document a result union for this mutation (it sets
      // the row dropped and writes the Changes-feed row), so a resolved call is
      // success; only an exception reverts.
      await removeFromNextWeekQueue({ author: identity, queueId: item.id });
    } catch (err) {
      console.error("removeFromNextWeekQueue threw", err);
      setPendingQueue((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
      showToast("Something is off. Try again.");
    }
  }

  return (
    <div className="screen__scroll">
      <div className="wishlist__header">
        <button
          type="button"
          className="wishlist__back"
          aria-label="Back to explore"
          onClick={onBack}
        >
          &lsaquo;
        </button>
        <div>
          <div className="wishlist__title">Wishlist</div>
          <div className="wishlist__sub">Favorites and dishes saved for next week</div>
        </div>
      </div>

      <div className="wishlist__body">
        <Card className="wishlist__section">
          <SectionLabel>Favorites</SectionLabel>
          {favoritesRaw === undefined ? (
            <div className="wishlist__empty">Loading favorites...</div>
          ) : shownFavorites.length === 0 ? (
            <div className="wishlist__empty">{FAVORITES_EMPTY}</div>
          ) : (
            <div className="wishlist__rows">
              {shownFavorites.map((fav) => (
                <FavoriteItem key={fav.id} fav={fav} onRemove={() => handleRemoveFavorite(fav)} />
              ))}
            </div>
          )}
          <button type="button" className="wishlist__add" onClick={() => setAddOpen(true)}>
            Add a favorite
          </button>
        </Card>

        <Card className="wishlist__section">
          <SectionLabel>Saved for next week</SectionLabel>
          {queueRaw === undefined ? (
            <div className="wishlist__empty">Loading saved dishes...</div>
          ) : shownQueue.length === 0 ? (
            <div className="wishlist__empty">{QUEUE_EMPTY}</div>
          ) : (
            <div className="wishlist__rows">
              {shownQueue.map((item) => (
                <QueueItem key={item.id} item={item} onRemove={() => handleRemoveQueued(item)} />
              ))}
            </div>
          )}
        </Card>
      </div>

      {addOpen && (
        <FavoriteAddSheet
          identity={identity}
          favoriteDishIds={favoriteDishIds}
          showToast={showToast}
          onClose={() => setAddOpen(false)}
        />
      )}

      {toast && (
        <div className="explore__toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

function FavoriteItem({ fav, onRemove }: { fav: ResolvedFavorite; onRemove: () => void }) {
  const photo = dishPhotoUrl(fav.dish);
  return (
    <div className="wishlist__row">
      <Thumb src={photo} size={44} alt="" />
      <div className="wishlist__row-body">
        <div className="wishlist__row-name">{fav.name}</div>
        <div className="wishlist__row-meta">{fav.meta}</div>
      </div>
      <RemoveButton label={`Remove ${fav.name} from favorites`} onClick={onRemove} />
    </div>
  );
}

function QueueItem({ item, onRemove }: { item: ResolvedQueueItem; onRemove: () => void }) {
  const photo = dishPhotoUrl(item.dish);
  return (
    <div className="wishlist__row">
      <Thumb src={photo} size={44} alt="" />
      <div className="wishlist__row-body">
        <div className="wishlist__row-name">{item.name}</div>
        <div className="wishlist__row-reason">&ldquo;{item.reason}&rdquo;</div>
        <div className="wishlist__row-meta">{item.savedMeta}</div>
      </div>
      <RemoveButton label={`Remove ${item.name} from next week`} onClick={onRemove} />
    </div>
  );
}

// A 44px remove tap target with a single-stroke inline X (no icon library, per
// engineering.md §1). Inherits its quiet color from the button rule in CSS.
function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="wishlist__remove" aria-label={label} onClick={onClick}>
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path
          d="M4 4 L12 12 M12 4 L4 12"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
