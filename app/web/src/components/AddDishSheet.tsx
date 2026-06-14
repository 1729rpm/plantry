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
import type { Identity, Meal, ShortDay } from "../lib/types.js";
import { addablePool, complexityVariant, complexityLabel } from "../lib/library.js";
import { dayLabel } from "../lib/days.js";
import { Sheet, SearchField, SectionLabel, ComplexityTag, Chip } from "./primitives.js";
import { DishRow } from "./DishRow.js";
import { ReasonDialog } from "./ReasonDialog.js";

interface AddDishSheetProps {
  weekStart: string;
  day: ShortDay;
  version: number;
  availableMeals: Meal[];
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
  const [meal, setMeal] = useState<Meal>(
    availableMeals.includes("lunch") ? "lunch" : availableMeals[0],
  );
  const [q, setQ] = useState<string>("");
  const [chosen, setChosen] = useState<Dish | null>(null);
  const [inFlight, setInFlight] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(() => {
    const pool = addablePool(meal, weekStart);
    const needle = q.trim().toLowerCase();
    if (!needle) return pool;
    return pool.filter((d) => d.name.toLowerCase().includes(needle));
  }, [meal, weekStart, q]);

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
    <Sheet onClose={onClose} tall>
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
      {visible.length === 0 ? (
        <div className="picker__hint">No dish matches that name.</div>
      ) : (
        <>
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
                trailing={
                  <span className="picker__trailing">
                    <ComplexityTag
                      variant={complexityVariant(d.complexity)}
                      label={complexityLabel(d.complexity) ?? "Easy to cook"}
                    />
                  </span>
                }
              />
            </button>
          ))}
        </>
      )}
    </Sheet>
  );
}
