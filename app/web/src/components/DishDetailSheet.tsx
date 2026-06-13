// Dish details and recipe sheet. Opened by tapping a library dish on the Day
// screen. Shows the photo (or the no-photo fallback), the description, the
// cooking fields (skill, equipment, buy-specially, pre-prep, time), the
// ingredient list, and the recipe (recipes now exist in the library). It also
// carries the dish-level actions (Replace, Remove) and the dish comments entry.
// Every field degrades gracefully when absent (coverage is incomplete during the
// enrichment ramp, §1.5). Ported from the DishDetailSheet overlay in
// design_handoff/hifi-overlays.jsx; the share-recipe toggle is deferred to 8.1.

import { useState } from "react";
import type { ShortDay } from "../lib/types.js";
import {
  dishById,
  dishIngredients,
  dishPhotoUrl,
  complexityLabel,
  mealLabelForDish,
} from "../lib/library.js";
import { Sheet, StatChip, PrimaryButton, QuietButton, SectionLabel } from "./primitives.js";

interface DishDetailSheetProps {
  weekStart: string;
  day: ShortDay;
  dishId: number;
  onReplace: () => void;
  onDelete: () => void;
  onComment: () => void;
  onClose: () => void;
}

export function DishDetailSheet({
  weekStart,
  day,
  dishId,
  onReplace,
  onDelete,
  onComment,
  onClose,
}: DishDetailSheetProps) {
  void weekStart;
  void day;
  const dish = dishById(dishId);
  const [showInfo, setShowInfo] = useState<boolean>(false);

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

  const photo = dishPhotoUrl(dish);
  const label = complexityLabel(dish.complexity);
  const ings = dishIngredients(dish.id);
  const hasCookFields = Boolean(
    dish.skill || dish.equipment || dish.buySpecially || dish.prePrep || dish.prepMinutes,
  );

  return (
    <Sheet onClose={onClose} tall>
      {photo ? (
        <img className="detail__photo" src={photo} alt="" />
      ) : (
        <div className="detail__photo detail__photo--placeholder" aria-hidden="true" />
      )}
      <div className="detail__head">
        <div className="detail__name">{dish.name}</div>
        {dish.description && <div className="detail__desc">{dish.description}</div>}
        <div className="detail__meta">{mealLabelForDish(dish)}</div>
      </div>

      <div className="detail__stats">
        <StatChip label="Prep" value={`${dish.prepMinutes} min`} />
        <StatChip label="Satiety" value={dish.satiety} />
        <StatChip label="Meal" value={mealLabelForDish(dish)} />
      </div>

      {ings.length > 0 && (
        <div className="detail__section">
          <SectionLabel>Ingredients</SectionLabel>
          <div className="detail__ingredients">
            {ings.map((ing, i) => (
              <span key={`${ing.ingredient}-${i}`} className="detail__ingredient">
                {ing.ingredient}
                <span className="detail__ingredient-qty">
                  {" "}
                  {ing.quantity}
                  {ing.unit}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {(label || hasCookFields || dish.recipe) && (
        <div className="detail__cook">
          <button
            type="button"
            className="detail__cook-toggle"
            onClick={() => setShowInfo((v) => !v)}
          >
            <span className="detail__cook-label">{label ?? "Cooking notes"}</span>
            <span className="detail__cook-hint">{showInfo ? "Hide details" : "Show details"}</span>
          </button>
          {showInfo && (
            <div className="detail__cook-body">
              {dish.skill && (
                <div>
                  <span className="detail__field-key">Skill:</span> {dish.skill}
                </div>
              )}
              {dish.equipment && (
                <div>
                  <span className="detail__field-key">Equipment:</span> {dish.equipment}
                </div>
              )}
              {dish.buySpecially && (
                <div>
                  <span className="detail__field-key">Buy specially:</span> {dish.buySpecially}
                </div>
              )}
              {dish.prePrep && (
                <div>
                  <span className="detail__field-key">Pre prep:</span>{" "}
                  <span className="detail__prep">{dish.prePrep}</span>
                </div>
              )}
              <div>
                <span className="detail__field-key">Time:</span> About {dish.prepMinutes} minutes
              </div>
              {dish.recipe && dish.recipe.length > 0 && (
                <div className="detail__recipe">
                  <SectionLabel>Recipe</SectionLabel>
                  {dish.recipe.map((step, i) => (
                    <div key={i} className="detail__recipe-step">
                      <span className="detail__recipe-num">{i + 1}</span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="detail__actions">
        <PrimaryButton className="detail__action-replace" onClick={onReplace}>
          Replace this dish
        </PrimaryButton>
        <QuietButton danger className="detail__action-remove" onClick={onDelete}>
          Remove
        </QuietButton>
      </div>
      <button type="button" className="detail__comment-link" onClick={onComment}>
        Leave a comment for the review
      </button>
    </Sheet>
  );
}
