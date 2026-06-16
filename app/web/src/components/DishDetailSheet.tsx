// Dish details and recipe sheet. Opened by tapping a library dish on the Day
// screen. Shows the photo (or the no-photo fallback), the description, the
// cooking fields (skill, equipment, buy-specially, pre-prep, time), the
// ingredient list, and the recipe (recipes now exist in the library). It also
// carries the dish-level actions (Replace, Remove) and the share-recipe toggle.
// Every field degrades gracefully when absent (coverage is incomplete during the
// enrichment ramp, §1.5). The detail body is the shared DishDetailBody, reused
// by ExploreDishSheet and the swap picker's replace-confirm view.

import { useState } from "react";
import { useMutation } from "convex/react";
import { anyApi } from "convex/server";
import type { Identity, Meal, ShortDay } from "../lib/types.js";
import { dishById } from "../lib/library.js";
import { Sheet, PrimaryButton, QuietButton } from "./primitives.js";
import { DishDetailBody } from "./DishDetailBody.js";

interface DishDetailSheetProps {
  weekStart: string;
  day: ShortDay;
  meal: Meal;
  position: number;
  version: number;
  dishId: number;
  // Whether this dish entry currently rides along in the shared image family.
  includeRecipe: boolean;
  // Whether this slot offers Delete. False for the Fruit of the day (swap-only,
  // docs/engine.md §3.3), true for breakfast/lunch.
  canDelete: boolean;
  identity: Identity;
  onReplace: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function DishDetailSheet({
  weekStart,
  day,
  meal,
  position,
  version,
  dishId,
  includeRecipe,
  canDelete,
  identity,
  onReplace,
  onDelete,
  onClose,
}: DishDetailSheetProps) {
  void day;
  const dish = dishById(dishId);
  // Optimistic local mirror of the share toggle so it flips instantly; the
  // Convex subscription is the source of truth and re-syncs `includeRecipe` on
  // the next render. Resetting to the prop on each open keeps it honest.
  const [shareOn, setShareOn] = useState<boolean>(includeRecipe);
  const setIncludeRecipe = useMutation(anyApi.dayMutations.setIncludeRecipe);

  async function handleToggleRecipe() {
    const next = !shareOn;
    setShareOn(next);
    try {
      // setIncludeRecipe is a share preference, not a menu change: it writes no
      // manualChanges row (Decision #10) and lives on the week, so it resets when
      // a new week is generated. A version mismatch just means someone edited the
      // week; the subscription will re-render with the fresh flag, so we revert
      // the optimistic flip and let the user retry.
      const result = (await setIncludeRecipe({
        author: identity,
        weekStart,
        day,
        meal,
        position,
        include: next,
        version,
      })) as { ok: true; version: number } | { ok: false; reason: string };
      if (!result.ok) setShareOn(!next);
    } catch (err) {
      console.error("setIncludeRecipe threw", err);
      setShareOn(!next);
    }
  }

  if (!dish) {
    // A pick whose id is not in the baked library should not reach here (the Day
    // screen only opens details for library picks), but guard so a stale id does
    // not crash the sheet.
    return (
      <Sheet onClose={onClose}>
        <div className="reason__title">Dish details</div>
        <div className="reason__hint">This dish is no longer in the library.</div>
      </Sheet>
    );
  }

  const hasRecipe = Boolean(dish.recipe && dish.recipe.length > 0);

  return (
    <Sheet onClose={onClose} tall>
      <DishDetailBody dish={dish} />

      {/* Mark this week's tricky dish so its recipe sheet rides along in the
          shared image family. A share preference, not a menu change; it lives
          on the week and resets weekly (Decision #10). Surfaced at the page
          level (not buried in the cook notes) so it is visible without
          expanding details, and only offered when the dish actually has a
          recipe to share. */}
      {hasRecipe && (
        <div className="detail__share-toggle">
          <span className="detail__share-toggle-label">Include recipe when sharing</span>
          <button
            type="button"
            role="switch"
            aria-checked={shareOn}
            aria-label="Include recipe when sharing"
            className={`toggle${shareOn ? " toggle--on" : ""}`}
            onClick={handleToggleRecipe}
          >
            <span className="toggle__knob" />
          </button>
        </div>
      )}

      <div className="detail__actions">
        <PrimaryButton className="detail__action-replace" onClick={onReplace}>
          Replace this dish
        </PrimaryButton>
        {canDelete && (
          <QuietButton danger className="detail__action-remove" onClick={onDelete}>
            Delete
          </QuietButton>
        )}
      </div>
    </Sheet>
  );
}
