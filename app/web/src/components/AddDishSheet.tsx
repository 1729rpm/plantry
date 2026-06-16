// Add-a-dish sheet. Appends a library dish to a (day, meal) slot via the 4.1
// `addDish` mutation (non-restrictive pool: meal-time + Active + season, no
// composition narrowing). A meal selector switches between breakfast and lunch
// (breakfast is hidden on a day that has no breakfast slot, e.g. Saturday).
// Picking a dish opens the shared reason dialog. Ported from the AddDishSheet
// overlay in design_handoff/hifi-overlays.jsx.
//
// Custom one-offs are NOT offered here: the only one-off mutation
// (`addCustomOneOff`) replaces an existing position, so it lives in the Replace
// flow (SwapPickerSheet). Appending a free-text one-off would need a new Convex
// mutation, which is out of this slice's scope; see the PR diagnosis card.

import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { anyApi } from "convex/server";
import type { Dish } from "@plantry/engine";
import type { Identity, MealTime, ShortDay } from "../lib/types.js";
import { addablePool } from "../lib/library.js";
import { PICKER_FILTERS, dishMatchesFilters, type DishFilter } from "../lib/dishFilters.js";
import { dayLabel } from "../lib/days.js";
import { Sheet, SearchField, SectionLabel, Chip } from "./primitives.js";
import { DishRow } from "./DishRow.js";
import { ReasonDialog } from "./ReasonDialog.js";

interface AddDishSheetProps {
  weekStart: string;
  day: ShortDay;
  version: number;
  // Add a dish targets breakfast/lunch only; the Fruit of the day is swap-only
  // (docs/engine.md §3.3), so it is never an add target.
  availableMeals: MealTime[];
  identity: Identity;
  onDone: () => void;
  onClose: () => void;
}

export function AddDishSheet({
  weekStart,
  day,
  version,
  availableMeals,
  identity,
  onDone,
  onClose,
}: AddDishSheetProps) {
  const addDish = useMutation(anyApi.dayMutations.addDish);
  const [meal, setMeal] = useState<MealTime>(
    availableMeals.includes("lunch") ? "lunch" : availableMeals[0],
  );
  const [q, setQ] = useState<string>("");
  // Quick-filter chips, mirroring Explore. Only the non-redundant subset is
  // shown here: the meal is already chosen via the meal chips above, so the
  // Breakfast/Lunch filters would be duplicate controls.
  const [filters, setFilters] = useState<DishFilter[]>([]);
  const [chosen, setChosen] = useState<Dish | null>(null);
  const [inFlight, setInFlight] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  function toggleFilter(f: DishFilter) {
    setFilters((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));
  }

  const trimmedQuery = q.trim();
  const visible = useMemo(() => {
    const pool = addablePool(meal, weekStart);
    const needle = trimmedQuery.toLowerCase();
    return pool.filter(
      (d) =>
        (needle === "" || d.name.toLowerCase().includes(needle)) && dishMatchesFilters(d, filters),
    );
  }, [meal, weekStart, trimmedQuery, filters]);

  // Empty-state copy reflects what is actually narrowing the list, so a name-only
  // search does not falsely blame filters (and vice versa).
  const emptyMessage =
    trimmedQuery.length > 0 && filters.length > 0
      ? "No dish matches your search and filters."
      : trimmedQuery.length > 0
        ? "No dish matches your search."
        : "No dish matches those filters.";

  async function handleSubmit(reason: string) {
    if (!chosen || inFlight) return;
    setInFlight(true);
    setError(null);
    try {
      const result = (await addDish({
        author: identity,
        weekStart,
        day,
        meal,
        newDishId: chosen.id,
        version,
        reason,
      })) as { ok: true; version: number; position: number } | { ok: false; reason: string };
      if (result.ok) {
        onDone();
        return;
      }
      if (result.reason === "version-mismatch") {
        setError("Someone just changed this week. Close and try again.");
      } else if (result.reason === "dish-not-active-or-in-season") {
        setError("That dish is not in season right now. Pick another.");
      } else {
        setError("Something is off. Close and try again.");
      }
    } catch (err) {
      console.error("addDish threw", err);
      setError("Something is off. Close and try again.");
    } finally {
      setInFlight(false);
    }
  }

  if (chosen) {
    return (
      <ReasonDialog
        title={`Add ${chosen.name}`}
        submitLabel="Add dish"
        inFlight={inFlight}
        error={error}
        onSubmit={handleSubmit}
        onClose={() => (inFlight ? undefined : setChosen(null))}
      />
    );
  }

  return (
    <Sheet onClose={onClose} tall picker>
      <div className="reason__title">Add a dish</div>
      <div className="reason__hint">To {dayLabel(day)}; pick from the library</div>
      {availableMeals.length > 1 && (
        <div className="add-dish__meals">
          {availableMeals.includes("breakfast") && (
            <Chip active={meal === "breakfast"} onClick={() => setMeal("breakfast")}>
              Breakfast
            </Chip>
          )}
          <Chip active={meal === "lunch"} onClick={() => setMeal("lunch")}>
            Lunch
          </Chip>
        </div>
      )}
      <SearchField value={q} onChange={setQ} placeholder="Search dishes" autoFocus />
      <div className="picker__filters" role="group" aria-label="Filters">
        {PICKER_FILTERS.map((f) => (
          <Chip key={f} active={filters.includes(f)} onClick={() => toggleFilter(f)}>
            {f}
          </Chip>
        ))}
      </div>
      {visible.length === 0 ? (
        <div className="picker__hint">{emptyMessage}</div>
      ) : (
        <div className="picker__results">
          <SectionLabel>Library dishes</SectionLabel>
          {visible.map((d) => (
            <button key={d.id} type="button" className="picker__row" onClick={() => setChosen(d)}>
              <DishRow
                pick={{
                  dishId: d.id,
                  customLabel: null,
                  source: "swapped",
                  author: "system",
                  updatedAt: 0,
                }}
              />
            </button>
          ))}
        </div>
      )}
    </Sheet>
  );
}
