// The Explore tab's nested, compact filter (Tuhina feedback items 5 + 9).
//
// Collapsed, this is a SINGLE horizontal row of filter entries that scrolls
// sideways if it overflows, so it costs one row of height rather than the old
// flat wrapped chip block (which grew to two or three rows on a phone). The row
// holds: two quick toggles (Easy to cook, Healthy) that flip in place, plus two
// entry chips (Cuisines, Meal time) that open a bottom-sheet sub-panel with a
// multi-select list (each option carries its dish count) and an Apply button.
//
// Selecting cuisines AND-combines with the other filters; within the Cuisines
// set it is an OR (a dish in ANY selected cuisine shows). Same for Meal time.
// The combining logic lives in lib/dishFilters.ts (dishMatchesExploreFilter); a
// chip's active state and the sub-panel counts are derived here.

import { useState } from "react";
import type { Dish } from "@plantry/engine";
import {
  activeFilterCount,
  cuisineCounts,
  mealTimeCounts,
  type ExploreFilterState,
  type MealTimeFilter,
} from "../lib/dishFilters.js";
import { Chip, Sheet } from "./primitives.js";

interface ExploreFiltersProps {
  state: ExploreFilterState;
  onChange: (next: ExploreFilterState) => void;
  /** The eligible Explore pool (the unfiltered feed dishes), for the per-option
   *  counts. Counts reflect the whole pool, not the currently-filtered view, so
   *  a user can see how many dishes each cuisine would bring back. */
  pool: Dish[];
}

type SubPanel = "none" | "cuisines" | "mealTimes";

export function ExploreFilters({ state, onChange, pool }: ExploreFiltersProps) {
  const [panel, setPanel] = useState<SubPanel>("none");

  const cuisineRows = cuisineCounts(pool);
  const mealRows = mealTimeCounts(pool);
  const total = activeFilterCount(state);

  return (
    <>
      <div className="explore__filters" role="group" aria-label="Filters">
        <Chip active={state.easy} onClick={() => onChange({ ...state, easy: !state.easy })}>
          Easy to cook
        </Chip>
        <Chip
          active={state.healthy}
          onClick={() => onChange({ ...state, healthy: !state.healthy })}
        >
          Healthy
        </Chip>
        <Chip active={state.cuisines.length > 0} onClick={() => setPanel("cuisines")}>
          Cuisines{state.cuisines.length > 0 ? ` (${state.cuisines.length})` : ""}
        </Chip>
        <Chip active={state.mealTimes.length > 0} onClick={() => setPanel("mealTimes")}>
          Meal time{state.mealTimes.length > 0 ? ` (${state.mealTimes.length})` : ""}
        </Chip>
        {total > 0 && (
          <button
            type="button"
            className="explore__filters-clear"
            onClick={() => onChange({ easy: false, healthy: false, cuisines: [], mealTimes: [] })}
          >
            Clear
          </button>
        )}
      </div>

      {panel === "cuisines" && (
        <MultiSelectPanel
          title="Cuisines"
          options={cuisineRows.map((r) => ({ key: r.cuisine, label: r.cuisine, count: r.count }))}
          selected={state.cuisines}
          onApply={(next) => {
            onChange({ ...state, cuisines: next });
            setPanel("none");
          }}
          onClose={() => setPanel("none")}
        />
      )}

      {panel === "mealTimes" && (
        <MultiSelectPanel
          title="Meal time"
          options={mealRows.map((r) => ({ key: r.mealTime, label: r.mealTime, count: r.count }))}
          selected={state.mealTimes}
          onApply={(next) => {
            onChange({ ...state, mealTimes: next as MealTimeFilter[] });
            setPanel("none");
          }}
          onClose={() => setPanel("none")}
        />
      )}
    </>
  );
}

interface MultiOption {
  key: string;
  label: string;
  count: number;
}

/** A bottom-sheet multi-select: a list of options each with its dish count and a
 *  checkbox-style toggle, plus an Apply button. Local draft state so toggling
 *  options does not re-filter the feed until Apply (matches the brief's "Apply"
 *  affordance). Cancelling (scrim / Back) discards the draft. */
function MultiSelectPanel({
  title,
  options,
  selected,
  onApply,
  onClose,
}: {
  title: string;
  options: MultiOption[];
  selected: string[];
  onApply: (next: string[]) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<string[]>(selected);

  function toggle(key: string) {
    setDraft((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  return (
    <Sheet onClose={onClose}>
      <div className="filter-panel">
        <div className="filter-panel__header">
          <h2 className="filter-panel__title">{title}</h2>
          {draft.length > 0 && (
            <button type="button" className="filter-panel__clear" onClick={() => setDraft([])}>
              Clear
            </button>
          )}
        </div>
        <ul className="filter-panel__list">
          {options.map((opt) => {
            const on = draft.includes(opt.key);
            return (
              <li key={opt.key}>
                <button
                  type="button"
                  className={`filter-option${on ? " filter-option--on" : ""}`}
                  aria-pressed={on}
                  onClick={() => toggle(opt.key)}
                  disabled={opt.count === 0}
                >
                  <span className="filter-option__check" aria-hidden="true">
                    {on ? "✓" : ""}
                  </span>
                  <span className="filter-option__label">{opt.label}</span>
                  <span className="filter-option__count">{opt.count}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <button type="button" className="btn-primary filter-panel__apply" onClick={() => onApply(draft)}>
          Apply
        </button>
      </div>
    </Sheet>
  );
}
