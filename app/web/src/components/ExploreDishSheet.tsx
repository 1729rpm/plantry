// Explore dish sheet. Opened by tapping a card in the Explore feed. Shows the
// same dish detail surface as the Menu-tab DishDetailSheet (photo, description,
// stats, ingredients, cooking notes, recipe) but in the EXPLORE context: the
// recipe is visible by default, a plain "why it fits" line sits under the name,
// and the actions are "Use this week" / "Next week" instead of Replace / Remove.
// It also carries the records-only dislike affordance: a tap calls `dislikeDish`
// and does nothing else in-session (no re-rank, no hide; Principle 5,
// Decision #12, features/design-revamp.md §1.5/§1.6).
//
// The detail body (photo, head, stats, ingredients, cook notes, recipe) is the
// shared DishDetailBody, reused by the Menu DishDetailSheet and the swap
// picker's replace-confirm view. Only the meta suffix ("Not cooked yet"), the
// "why it fits" line, the default-open cook section, and the Explore actions
// are owned here.

import type { ExploreAffinityKey } from "@plantry/engine";
import { dishById } from "../lib/library.js";
import { Sheet, PrimaryButton, QuietButton } from "./primitives.js";
import { DishDetailBody } from "./DishDetailBody.js";
import { affinityLine } from "../lib/explore.js";

interface ExploreDishSheetProps {
  dishId: number;
  dominantAffinity: ExploreAffinityKey;
  onUseThisWeek: () => void;
  onNextWeek: () => void;
  onDislike: () => void;
  onClose: () => void;
}

export function ExploreDishSheet({
  dishId,
  dominantAffinity,
  onUseThisWeek,
  onNextWeek,
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
        belowMeta={<div className="explore-sheet__why">{affinityLine(dominantAffinity)}</div>}
        defaultShowInfo
      />

      <div className="detail__actions">
        <PrimaryButton className="explore-sheet__action-use" onClick={onUseThisWeek}>
          Use this week
        </PrimaryButton>
        <QuietButton className="explore-sheet__action-next" onClick={onNextWeek}>
          Next week
        </QuietButton>
      </div>
      <button type="button" className="explore-sheet__dislike" onClick={onDislike}>
        <span className="explore-sheet__dislike-label">Not for me</span>
      </button>
    </Sheet>
  );
}
