// Shared presentational body for a dish-detail surface: photo (or no-photo
// fallback), name + description + meta, the stat tiles, the ingredient list,
// and the collapsible cooking-notes / recipe section. Three surfaces render
// this identical body: the Menu-tab DishDetailSheet, the Explore feed's
// ExploreDishSheet, and the swap picker's replace-confirm view. It owns no
// actions and no mutations: callers pass the dish and render their own action
// buttons (Replace/Remove, Use this week/Add to wishlist, Replace dish) below it.
//
// Variations between surfaces are passed as props, not branched here:
//   - `metaSuffix`: extra text after the meal label in the meta line (Explore
//     shows "Not cooked yet").
//   - `belowMeta`: optional node under the meta line (Explore's "why it fits").
//   - `defaultShowInfo`: whether the cooking-notes section starts expanded
//     (Explore opens it by default; the Menu and replace-confirm surfaces
//     start collapsed).

import { useState } from "react";
import type { ReactNode } from "react";
import type { Dish } from "@plantry/engine";
import {
  dishIngredients,
  dishPhotoUrl,
  complexityLabel,
  mealLabelForDish,
} from "../lib/library.js";
import { StatChip, SectionLabel } from "./primitives.js";

interface DishDetailBodyProps {
  dish: Dish;
  metaSuffix?: string;
  belowMeta?: ReactNode;
  defaultShowInfo?: boolean;
}

export function DishDetailBody({
  dish,
  metaSuffix,
  belowMeta,
  defaultShowInfo = false,
}: DishDetailBodyProps) {
  const [showInfo, setShowInfo] = useState<boolean>(defaultShowInfo);

  const photo = dishPhotoUrl(dish);
  const label = complexityLabel(dish.complexity);
  const ings = dishIngredients(dish.id);
  const hasCookFields = Boolean(
    dish.skill || dish.equipment || dish.buySpecially || dish.prePrep || dish.prepMinutes,
  );

  return (
    <>
      {photo ? (
        <img className="detail__photo" src={photo} alt="" />
      ) : (
        <div className="detail__photo detail__photo--placeholder" aria-hidden="true" />
      )}
      <div className="detail__head">
        <div className="detail__name">{dish.name}</div>
        {dish.description && <div className="detail__desc">{dish.description}</div>}
        <div className="detail__meta">
          {mealLabelForDish(dish)}
          {metaSuffix ? ` · ${metaSuffix}` : ""}
        </div>
        {belowMeta}
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
    </>
  );
}
