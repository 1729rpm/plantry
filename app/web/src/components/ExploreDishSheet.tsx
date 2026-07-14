// Explore dish sheet. Opened by tapping a card in the Explore feed, or a row on
// the Yours wishlist. Shows the same dish detail surface as the Menu-tab
// DishDetailSheet (photo, description, stats, ingredients, cooking notes, recipe)
// but in the EXPLORE context: the recipe is visible by default, a plain "why it
// fits" line sits under the name (Explore only), and the actions are "Use this
// week" + a quiet "Add to wishlist" toggle. From Explore it also carries the
// records-only dislike affordance ("Not for me"); from Yours (where the dish is
// already wishlisted) the dislike is omitted.
//
// The detail body (photo, head, stats, ingredients, cook notes, recipe) is the
// shared DishDetailBody, reused by the Menu DishDetailSheet and the swap
// picker's replace-confirm view. Only the meta suffix ("Not cooked yet"), the
// "why it fits" line, the default-open cook section, and the actions are owned
// here.

import type { ExploreAffinityKey } from "@plantry/engine";
import { dishById } from "../lib/library.js";
import { Sheet, PrimaryButton, QuietButton } from "./primitives.js";
import { DishDetailBody } from "./DishDetailBody.js";
import { affinityLine } from "../lib/explore.js";

interface ExploreDishSheetProps {
  dishId: number;
  // The dominant-affinity "why it fits" line. Explore-only; absent when the
  // sheet is opened from the Yours wishlist (no ranking context there).
  dominantAffinity?: ExploreAffinityKey;
  // Whether the dish is currently on the household wishlist.
  wishlisted: boolean;
  onToggleWishlist: () => void;
  onUseThisWeek: () => void;
  // The records-only dislike. Explore-only; omitted from the Yours context.
  onDislike?: () => void;
  onClose: () => void;
}

export function ExploreDishSheet({
  dishId,
  dominantAffinity,
  wishlisted,
  onToggleWishlist,
  onUseThisWeek,
  onDislike,
  onClose,
}: ExploreDishSheetProps) {
  const dish = dishById(dishId);

  if (!dish) {
    return (
      <Sheet onClose={onClose}>
        <div className="reason__title">Dish details</div>
        <div className="reason__hint">This dish is no longer in the library.</div>
      </Sheet>
    );
  }

  return (
    <Sheet onClose={onClose} tall>
      <DishDetailBody
        dish={dish}
        metaSuffix="Not cooked yet"
        belowMeta={
          dominantAffinity ? (
            <div className="explore-sheet__why">{affinityLine(dominantAffinity)}</div>
          ) : undefined
        }
        defaultShowInfo
      />

      <div className="detail__actions">
        <PrimaryButton className="explore-sheet__action-use" onClick={onUseThisWeek}>
          Use this week
        </PrimaryButton>
        <QuietButton
          className="explore-sheet__action-wishlist"
          onClick={onToggleWishlist}
        >
          {wishlisted ? "Wishlisted ✓" : "Add to wishlist"}
        </QuietButton>
      </div>
      {onDislike && (
        <button type="button" className="explore-sheet__dislike" onClick={onDislike}>
          <span className="explore-sheet__dislike-label">Not for me</span>
        </button>
      )}
    </Sheet>
  );
}
