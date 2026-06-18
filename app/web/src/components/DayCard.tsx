// Day card for the Menu screen. Ported from the DayCard primitive in
// design_handoff/hifi-primitives.jsx. A today or upcoming day renders the full
// card: a date badge, each non-empty meal as a labelled list of dish rows, and
// an Edit button that routes into the legacy editor. A past day renders a
// collapsed card instead: a bare date number, a one-line glance of the
// day's first two dish names, and a "View" pill that opens the same editor as
// Edit. A skipped day shows its reason (full) or reads "Skipped" (collapsed).

import type { DishPick, ShortDay, WeekSlot } from "../lib/types.js";
import { dayDate, dayLabel, type DayStatus, mealLabel, mealOrderIndex } from "../lib/days.js";
import { dishById } from "../lib/library.js";
import { Card } from "./primitives.js";
import { DishRow } from "./DishRow.js";

export interface DayCardModel {
  day: ShortDay;
  slots: WeekSlot[];
  skipReason: string | null;
}

interface DayCardProps {
  model: DayCardModel;
  weekStart: string;
  status: DayStatus;
  onEdit?: () => void;
}

// Display name for a single pick, mirroring DishRow's resolution: a custom
// one-off shows its label, a library dish shows its name, an unresolved pick
// falls back gracefully. Kept inline (not a shared export) so this card and
// DishRow stay decoupled; both are tiny and neither owns the other's lane.
function pickName(pick: DishPick): string {
  if (pick.customLabel) return pick.customLabel;
  if (pick.dishId !== null) {
    return dishById(pick.dishId)?.name ?? "From the library";
  }
  return "Custom dish";
}

// First two dish names across the day, in meal order (breakfast, lunch, fruit),
// joined by ", " with a " +N more" tail when the day holds more than two. A day
// with one dish (or Saturday's lunch-plus-fruit shape, or any sparse day) shows
// only what exists, with no trailing "+0 more".
function dishGlance(meals: WeekSlot[]): string {
  const names: string[] = [];
  for (const slot of meals) {
    for (const pick of slot.dishes) {
      names.push(pickName(pick));
    }
  }
  if (names.length === 0) return "";
  const shown = names.slice(0, 2).join(", ");
  const remaining = names.length - 2;
  return remaining > 0 ? `${shown} +${remaining} more` : shown;
}

export function DayCard({ model, weekStart, status, onEdit }: DayCardProps) {
  const { num, month } = dayDate(weekStart, model.day);
  const meals = [...model.slots]
    .filter((slot) => slot.dishes.length > 0)
    .sort((a, b) => mealOrderIndex(a.meal) - mealOrderIndex(b.meal));

  if (status === "past") {
    const glance = model.skipReason !== null ? "Skipped" : dishGlance(meals);
    return (
      <Card className="day-card day-card--collapsed">
        <div className="day-card__date">{num}</div>
        <div className="day-card__glance">{glance}</div>
        {onEdit && (
          <button
            type="button"
            className="day-card__view"
            aria-label={`View ${dayLabel(model.day)}`}
            onClick={onEdit}
          >
            View
          </button>
        )}
      </Card>
    );
  }

  const cardClass = status === "today" ? "day-card day-card--today" : "day-card";

  return (
    <Card className={cardClass}>
      <div className="date-badge">
        <div className="date-badge__short">{model.day}</div>
        <div className="date-badge__num">{num}</div>
        <div className="date-badge__month">{month}</div>
      </div>
      <div className="day-card__body">
        {model.skipReason !== null ? (
          <div className="day-card__skipped">
            <div className="day-card__skipped-title">Skipped</div>
            <div className="day-card__skipped-reason">&ldquo;{model.skipReason}&rdquo;</div>
          </div>
        ) : (
          meals.map((slot) => (
            <div key={slot.meal} className="day-card__meal">
              <div className="section-label">{mealLabel(slot.meal)}</div>
              {slot.dishes.map((pick, i) => (
                <DishRow key={i} pick={pick} compact={false} />
              ))}
            </div>
          ))
        )}
      </div>
      {onEdit && (
        <button
          type="button"
          className="day-card__edit"
          aria-label={`Edit ${dayLabel(model.day)}`}
          onClick={onEdit}
        >
          Edit
        </button>
      )}
    </Card>
  );
}
