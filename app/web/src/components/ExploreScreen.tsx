// Explore screen (slice 7.1). A ranked, familiar-but-new feed of library dishes
// the household has not cooked yet, from the 4.2 `getExploreFeed` query (the
// engine does the ranking and hands each dish its dominant-affinity key; this
// screen only displays). Filters narrow the grid (Easy to cook, Healthy,
// Breakfast, Lunch). Each card carries a heart overlay that one-tap toggles the
// dish on the household wishlist. Tapping a card opens the Explore dish sheet
// (recipe visible, a plain "why it fits" line, and the Use-this-week / Add-to-
// wishlist / Not-for-me actions). Dishes already placed this week are hidden
// server-side by the feed query (Decision 9). Ported from the ExploreScreen in
// design_handoff/hifi-screens.jsx.

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { anyApi } from "convex/server";
import type { ExploreAffinityKey } from "@plantry/engine";
import type { CurrentWeek, Identity, Meal, ShortDay } from "../lib/types.js";
import type { Dish } from "@plantry/engine";
import { dishById, dishPhotoUrl, exploreCardTags } from "../lib/library.js";
import {
  dishMatchesExploreFilter,
  EMPTY_EXPLORE_FILTER,
  type ExploreFilterState,
} from "../lib/dishFilters.js";
import { dayLabel } from "../lib/days.js";
import { useWishlist } from "../lib/useWishlist.js";
import { ComplexityTag, MetaTag, Thumb } from "./primitives.js";
import { ExploreFilters } from "./ExploreFilters.js";
import { ExploreDishSheet } from "./ExploreDishSheet.js";
import { ReasonDialog } from "./ReasonDialog.js";
import { ExploreDayPicker } from "./ExploreDayPicker.js";
import { DislikeDialog } from "./DislikeDialog.js";

interface ExploreScreenProps {
  identity: Identity;
}

interface ExploreFeedDish {
  dishId: number;
  name: string;
  dominantAffinity: ExploreAffinityKey;
}

// Which overlay (if any) is open over the feed. One value keeps the sheet stack
// to at most one sheet at a time, matching the Day screen.
type Overlay =
  | { kind: "none" }
  | { kind: "sheet"; dish: ExploreFeedDish }
  | { kind: "use-day"; dish: ExploreFeedDish }
  | { kind: "use-reason"; dish: ExploreFeedDish; day: ShortDay; meal: Meal }
  | { kind: "dislike"; dish: ExploreFeedDish };

function matchesFilters(dishId: number, state: ExploreFilterState): boolean {
  const dish = dishById(dishId);
  if (!dish) return false;
  return dishMatchesExploreFilter(dish, state);
}

export function ExploreScreen({ identity }: ExploreScreenProps) {
  const week = useQuery(anyApi.queries.week.getCurrentWeek, {}) as CurrentWeek | null | undefined;
  const weekStart = week?.weekStart ?? null;
  const feed = useQuery(anyApi.explore.getExploreFeed, weekStart ? { weekStart } : "skip") as
    | ExploreFeedDish[]
    | undefined;

  const addDish = useMutation(anyApi.dayMutations.addDish);
  const dislikeDish = useMutation(anyApi.dishDislikes.dislikeDish);

  const [filters, setFilters] = useState<ExploreFilterState>(EMPTY_EXPLORE_FILTER);
  const [overlay, setOverlay] = useState<Overlay>({ kind: "none" });
  const [actionError, setActionError] = useState<string | null>(null);
  const [inFlight, setInFlight] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);

  // The eligible Explore pool as full dishes, for the filter sub-panels' counts.
  // The feed already excludes dishes placed this week or queued for next, so the
  // counts reflect exactly what the filter can surface.
  const pool = useMemo<Dish[]>(() => {
    if (!feed) return [];
    return feed.map((entry) => dishById(entry.dishId)).filter((d): d is Dish => d !== undefined);
  }, [feed]);

  const visible = useMemo(() => {
    if (!feed) return [];
    return feed.filter((entry) => matchesFilters(entry.dishId, filters));
  }, [feed, filters]);

  function closeOverlay() {
    setOverlay({ kind: "none" });
    setActionError(null);
    setInFlight(false);
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast((cur) => (cur === message ? null : cur)), 2600);
  }

  const wishlist = useWishlist(identity, showToast);

  async function handleUse(reason: string, dish: ExploreFeedDish, day: ShortDay, meal: Meal) {
    if (inFlight || !weekStart || !week) return;
    setInFlight(true);
    setActionError(null);
    try {
      const result = (await addDish({
        author: identity,
        weekStart,
        day,
        meal,
        newDishId: dish.dishId,
        version: week.version,
        reason,
      })) as { ok: true; version: number; position: number } | { ok: false; reason: string };
      if (result.ok) {
        closeOverlay();
        showToast(`Added ${dish.name} to ${dayLabel(day)}`);
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

  // Records-only dislike: write the signal and do nothing else in-session (no
  // re-rank, no hide; Principle 5, Decision #12). The feed is untouched, so the
  // disliked dish stays exactly where it was; only a confirmation toast shows.
  async function handleDislike(reason: string | null, dish: ExploreFeedDish) {
    if (inFlight) return;
    setInFlight(true);
    setActionError(null);
    try {
      const result = (await dislikeDish({
        author: identity,
        dishId: dish.dishId,
        reason,
      })) as { ok: true; dislikeId: string } | { ok: false; reason: string };
      if (result.ok) {
        closeOverlay();
        showToast("Noted for the weekly review");
        return;
      }
      setActionError("Something is off. Close and try again.");
    } catch (err) {
      console.error("dislikeDish threw", err);
      setActionError("Something is off. Close and try again.");
    } finally {
      setInFlight(false);
    }
  }

  return (
    <div className="screen__scroll">
      <div className="screen__header">
        <h1 className="screen__title">Explore</h1>
        <div className="screen__subtitle">
          {feed === undefined
            ? "Dishes you have not cooked yet"
            : `${visible.length} dishes you have not cooked yet`}
        </div>
      </div>

      <ExploreFilters state={filters} onChange={setFilters} pool={pool} />

      <div className="explore__rubric">Close to your usual, new on the plate</div>

      {week === undefined || feed === undefined ? (
        <div className="empty-state">Loading dishes...</div>
      ) : week === null ? (
        <div className="empty-state">
          <div className="empty-state__title">No menu yet</div>
          The explore feed appears once the first weekly menu is generated.
        </div>
      ) : visible.length === 0 ? (
        <div className="empty-state">
          {feed.length === 0
            ? "You have cooked everything in season. Nothing new to explore right now."
            : "Nothing matches these filters this season."}
        </div>
      ) : (
        <div className="explore__grid">
          {visible.map((entry) => (
            <ExploreCard
              key={entry.dishId}
              entry={entry}
              wishlisted={wishlist.isWishlisted(entry.dishId)}
              onToggleWishlist={() => wishlist.toggle(entry.dishId, entry.name)}
              onOpen={() => setOverlay({ kind: "sheet", dish: entry })}
            />
          ))}
        </div>
      )}

      {overlay.kind === "sheet" && (
        <ExploreDishSheet
          dishId={overlay.dish.dishId}
          dominantAffinity={overlay.dish.dominantAffinity}
          wishlisted={wishlist.isWishlisted(overlay.dish.dishId)}
          onToggleWishlist={() => wishlist.toggle(overlay.dish.dishId, overlay.dish.name)}
          onUseThisWeek={() => setOverlay({ kind: "use-day", dish: overlay.dish })}
          onDislike={() => setOverlay({ kind: "dislike", dish: overlay.dish })}
          onClose={closeOverlay}
        />
      )}

      {overlay.kind === "use-day" &&
        week &&
        (() => {
          // Map the dish to the slot it belongs in. Guard the Fruit category
          // explicitly: a fruit dish belongs in the "fruit" slot, not "lunch".
          // A bare `time === "Breakfast" ? ... : "lunch"` binary would mislabel
          // any non-breakfast dish as lunch (the same latent assumption that
          // crashed finalizeWeek). `Dish.time` is only Breakfast|Lunch, so the
          // remaining branch is a true binary.
          const dish = dishById(overlay.dish.dishId);
          const dishMeal: Meal =
            dish?.category === "Fruit"
              ? "fruit"
              : dish?.time === "Breakfast"
                ? "breakfast"
                : "lunch";
          return (
            <ExploreDayPicker
              dishName={overlay.dish.name}
              meal={dishMeal}
              week={week}
              onPick={(day) =>
                setOverlay({ kind: "use-reason", dish: overlay.dish, day, meal: dishMeal })
              }
              onClose={closeOverlay}
            />
          );
        })()}

      {overlay.kind === "use-reason" && (
        <ReasonDialog
          title={`Add ${overlay.dish.name}`}
          hint={`To ${dayLabel(overlay.day)}. A short reason helps the weekly review.`}
          submitLabel="Add to this week"
          inFlight={inFlight}
          error={actionError}
          onSubmit={(reason) => handleUse(reason, overlay.dish, overlay.day, overlay.meal)}
          onClose={inFlight ? () => undefined : closeOverlay}
        />
      )}

      {overlay.kind === "dislike" && (
        <DislikeDialog
          dishName={overlay.dish.name}
          inFlight={inFlight}
          error={actionError}
          onSubmit={(reason) => handleDislike(reason, overlay.dish)}
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

function ExploreCard({
  entry,
  wishlisted,
  onToggleWishlist,
  onOpen,
}: {
  entry: ExploreFeedDish;
  wishlisted: boolean;
  onToggleWishlist: () => void;
  onOpen: () => void;
}) {
  const dish = dishById(entry.dishId);
  const photo = dishPhotoUrl(dish);
  return (
    <div className="explore-card">
      <button type="button" className="explore-card__open" onClick={onOpen}>
        {photo ? (
          <img className="explore-card__photo" src={photo} alt="" />
        ) : (
          <div className="explore-card__photo explore-card__photo--placeholder" aria-hidden="true">
            <Thumb src={null} size={28} />
          </div>
        )}
        <div className="explore-card__body">
          <div className="explore-card__name">{entry.name}</div>
          {dish && (
            <div className="explore-card__tags">
              {exploreCardTags(dish).map((tag) =>
                tag.kind === "difficulty" ? (
                  <ComplexityTag
                    key={tag.label}
                    variant={tag.variant ?? "easy"}
                    label={tag.label}
                  />
                ) : (
                  <MetaTag key={tag.label} label={tag.label} />
                ),
              )}
            </div>
          )}
        </div>
      </button>
      {/* Heart overlay, top-right of the photo. Outline = not wishlisted, filled
          accent = wishlisted. One-tap toggle with a confirming toast. */}
      <button
        type="button"
        className="explore-card__heart"
        aria-label={
          wishlisted ? `Remove ${entry.name} from wishlist` : `Add ${entry.name} to wishlist`
        }
        aria-pressed={wishlisted}
        onClick={onToggleWishlist}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 22 22"
          fill={wishlisted ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M11 18.5C11 18.5 3.5 14 3.5 8.75A3.75 3.75 0 0 1 11 6.5a3.75 3.75 0 0 1 7.5 2.25C18.5 14 11 18.5 11 18.5Z" />
        </svg>
      </button>
    </div>
  );
}
