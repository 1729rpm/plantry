// Yours screen. The fourth tab (replacing the old Changes tab), home of the
// household's two shared lists:
//
//   1. Your favorites: dishes (or free-text custom names) the household wants in
//      every generated week. Each row shows who added it; a dashed "Add a
//      favorite" button opens the add sheet (library search + custom free-text).
//   2. Your wishlist: a shared "save it to try" list. Each row shows a photo, who
//      added it, a "Use" pill that places it into the week (the existing day
//      picker), and a remove button. Tapping the row body opens the dish detail
//      sheet in explore context.
//
// Both lists are shared Convex tables read through the useFavorites / useWishlist
// hooks (optimistic add/remove, one toast surface here). This screen replaces the
// old Explore wishlist sub-view (WishlistScreen), which is deleted.

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { anyApi } from "convex/server";
import type { CurrentWeek, Identity, Meal, ShortDay } from "../lib/types.js";
import { dishById, dishPhotoUrl } from "../lib/library.js";
import { dayLabel } from "../lib/days.js";
import { useFavorites, type FavoriteRow } from "../lib/useFavorites.js";
import { useWishlist, type WishlistRow } from "../lib/useWishlist.js";
import { Card, SectionLabel, Thumb } from "./primitives.js";
import { FavoriteAddSheet } from "./FavoriteAddSheet.js";
import { ExploreDishSheet } from "./ExploreDishSheet.js";
import { ExploreDayPicker } from "./ExploreDayPicker.js";
import { ReasonDialog } from "./ReasonDialog.js";

// Empty-state copy, exported so a test pins the exact wording (and its no-dash
// cleanliness) to the handoff.
export const FAVORITES_EMPTY = "No favorites yet. A favorite gets a place in every week's menu.";
export const WISHLIST_EMPTY = "Nothing on the wishlist. Mark a dish from Explore or any dish page.";

export function authorName(author: Identity): string {
  return author === "rajat" ? "Rajat" : "Tuhina";
}

// The display name for a favorite row: a library dish resolves through the baked
// library, a custom favorite uses its free-text label, and a stale library id
// degrades to a quiet fallback so the row stays removable.
export function favoriteName(row: FavoriteRow): string {
  if (typeof row.dishId === "number") return dishById(row.dishId)?.name ?? "From the library";
  return row.customLabel ?? "A favorite";
}

// The meal-time slot an explored/wishlisted dish belongs in. Fruit belongs to
// its own slot; every other dish is Breakfast or Lunch. Mirrors the Explore
// "Use this week" mapping so a wishlist "Use" lands in the right meal.
function mealForDish(dishId: number): Meal {
  const dish = dishById(dishId);
  if (dish?.category === "Fruit") return "fruit";
  return dish?.time === "Breakfast" ? "breakfast" : "lunch";
}

type Overlay =
  | { kind: "none" }
  | { kind: "add-favorite" }
  | { kind: "dish"; dishId: number; name: string }
  | { kind: "use-day"; dishId: number; name: string }
  | { kind: "use-reason"; dishId: number; name: string; day: ShortDay; meal: Meal };

interface YoursScreenProps {
  identity: Identity;
}

export function YoursScreen({ identity }: YoursScreenProps) {
  const [toast, setToast] = useState<string | null>(null);
  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast((cur) => (cur === message ? null : cur)), 2600);
  }

  const favorites = useFavorites(identity, showToast);
  const wishlist = useWishlist(identity, showToast);

  const week = useQuery(anyApi.queries.week.getCurrentWeek, {}) as CurrentWeek | null | undefined;
  const addDish = useMutation(anyApi.dayMutations.addDish);

  const [overlay, setOverlay] = useState<Overlay>({ kind: "none" });
  const [actionError, setActionError] = useState<string | null>(null);
  const [inFlight, setInFlight] = useState<boolean>(false);

  const favoriteRows = favorites.rows;
  const wishlistRows = wishlist.rows;

  function closeOverlay() {
    setOverlay({ kind: "none" });
    setActionError(null);
    setInFlight(false);
  }

  // Open the day picker for a wishlist dish. Using a dish leaves it on the
  // wishlist (removal is explicit).
  function startUse(dishId: number, name: string) {
    setOverlay({ kind: "use-day", dishId, name });
  }

  async function handleUse(
    reason: string,
    dishId: number,
    name: string,
    day: ShortDay,
    meal: Meal,
  ) {
    if (inFlight || !week) return;
    setInFlight(true);
    setActionError(null);
    try {
      const result = (await addDish({
        author: identity,
        weekStart: week.weekStart,
        day,
        meal,
        newDishId: dishId,
        version: week.version,
        reason,
      })) as { ok: true; version: number; position: number } | { ok: false; reason: string };
      if (result.ok) {
        closeOverlay();
        showToast(`Added ${name} to ${dayLabel(day)}`);
        return;
      }
      if (result.reason === "version-mismatch") {
        setActionError("Someone just changed this week. Close and try again.");
      } else if (result.reason === "dish-not-active-or-in-season") {
        setActionError("That dish is not in season right now.");
      } else {
        setActionError("Something is off. Close and try again.");
      }
    } catch (err) {
      console.error("addDish threw", err);
      setActionError("Something is off. Close and try again.");
    } finally {
      setInFlight(false);
    }
  }

  return (
    <div className="screen__scroll">
      <div className="screen__header">
        <h1 className="screen__title">Yours</h1>
        <div className="screen__subtitle">{"The household's favorites and wishlist"}</div>
      </div>

      <div className="yours__body">
        <section>
          <SectionLabel>Your favorites</SectionLabel>
          <Card
            className={`yours__card${favoriteRows && favoriteRows.length ? "" : " yours__card--empty"}`}
          >
            {favoriteRows === undefined ? (
              <div className="yours__empty">Loading favorites...</div>
            ) : favoriteRows.length === 0 ? (
              <div className="yours__empty">{FAVORITES_EMPTY}</div>
            ) : (
              favoriteRows.map((row, i) => (
                <div
                  key={row._id}
                  className={`yours__row${i === favoriteRows.length - 1 ? " yours__row--last" : ""}`}
                >
                  <div className="yours__row-body">
                    <div className="yours__row-name">{favoriteName(row)}</div>
                    <div className="yours__row-meta">
                      {`Added by ${authorName(row.author)} · in every week's menu`}
                    </div>
                  </div>
                  <RemoveButton
                    label={`Remove ${favoriteName(row)} from favorites`}
                    onClick={() => favorites.remove(row, favoriteName(row))}
                  />
                </div>
              ))
            )}
          </Card>
          <button
            type="button"
            className="yours__add"
            onClick={() => setOverlay({ kind: "add-favorite" })}
          >
            Add a favorite
          </button>
        </section>

        <section>
          <SectionLabel>Your wishlist</SectionLabel>
          <Card
            className={`yours__card${wishlistRows && wishlistRows.length ? "" : " yours__card--empty"}`}
          >
            {wishlistRows === undefined ? (
              <div className="yours__empty">Loading wishlist...</div>
            ) : wishlistRows.length === 0 ? (
              <div className="yours__empty">{WISHLIST_EMPTY}</div>
            ) : (
              wishlistRows.map((row, i) => (
                <WishlistRowItem
                  key={row._id}
                  row={row}
                  last={i === wishlistRows.length - 1}
                  onOpen={(name) => setOverlay({ kind: "dish", dishId: row.dishId, name })}
                  onUse={(name) => startUse(row.dishId, name)}
                  onRemove={(name) => wishlist.toggle(row.dishId, name)}
                />
              ))
            )}
          </Card>
        </section>
      </div>

      {overlay.kind === "add-favorite" && (
        <FavoriteAddSheet
          identity={identity}
          favoriteDishIds={favorites.libraryIds}
          onAddCustom={favorites.addCustom}
          showToast={showToast}
          onClose={closeOverlay}
        />
      )}

      {overlay.kind === "dish" && (
        <ExploreDishSheet
          dishId={overlay.dishId}
          wishlisted={wishlist.isWishlisted(overlay.dishId)}
          onToggleWishlist={() => wishlist.toggle(overlay.dishId, overlay.name)}
          onUseThisWeek={() => startUse(overlay.dishId, overlay.name)}
          onClose={closeOverlay}
        />
      )}

      {overlay.kind === "use-day" &&
        week &&
        (() => {
          const meal = mealForDish(overlay.dishId);
          return (
            <ExploreDayPicker
              dishName={overlay.name}
              meal={meal}
              week={week}
              onPick={(day) =>
                setOverlay({
                  kind: "use-reason",
                  dishId: overlay.dishId,
                  name: overlay.name,
                  day,
                  meal,
                })
              }
              onClose={closeOverlay}
            />
          );
        })()}

      {overlay.kind === "use-reason" && (
        <ReasonDialog
          title={`Add ${overlay.name}`}
          hint={`To ${dayLabel(overlay.day)}. A short reason helps the weekly review.`}
          submitLabel="Add to this week"
          inFlight={inFlight}
          error={actionError}
          onSubmit={(reason) =>
            handleUse(reason, overlay.dishId, overlay.name, overlay.day, overlay.meal)
          }
          onClose={inFlight ? () => undefined : closeOverlay}
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

function WishlistRowItem({
  row,
  last,
  onOpen,
  onUse,
  onRemove,
}: {
  row: WishlistRow;
  last: boolean;
  onOpen: (name: string) => void;
  onUse: (name: string) => void;
  onRemove: (name: string) => void;
}) {
  const dish = dishById(row.dishId);
  const name = dish?.name ?? "From the library";
  const photo = dishPhotoUrl(dish);
  return (
    <div className={`yours__row${last ? " yours__row--last" : ""}`}>
      <button type="button" className="yours__row-open" onClick={() => onOpen(name)}>
        <Thumb src={photo} size={44} alt="" />
        <div className="yours__row-body">
          <div className="yours__row-name">{name}</div>
          <div className="yours__row-meta">Added by {authorName(row.author)}</div>
        </div>
      </button>
      <button type="button" className="yours__use" onClick={() => onUse(name)}>
        Use
      </button>
      <RemoveButton label={`Remove ${name} from wishlist`} onClick={() => onRemove(name)} />
    </div>
  );
}

// A 44px remove tap target with a single-stroke inline X (no icon library, per
// engineering.md §1). Inherits its quiet color from the button rule in CSS.
function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="yours__remove" aria-label={label} onClick={onClick}>
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
