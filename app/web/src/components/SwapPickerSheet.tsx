// Swap picker. Opened from the dish action sheet or the details sheet's Replace
// action. Lists alternatives from the 3.1 picker ranking (getSlotAlternatives:
// the broad, meal-time-matching, in-season pool ranked by recency + protein-band
// similarity to the outgoing dish), searchable by name. Picking a dish opens the
// shared reason dialog; on submit it calls swapDish with the live version for
// optimistic concurrency. Ported from the SwapPickerSheet overlay in
// design_handoff/hifi-overlays.jsx. The ranking lives in Convex, not here.

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { anyApi } from "convex/server";
import type { Dish } from "@plantry/engine";
import type { Identity, Meal, ShortDay } from "../lib/types.js";
import { complexityVariant, complexityLabel } from "../lib/library.js";
import { dayLabel, mealLabel } from "../lib/days.js";
import { Sheet, SearchField, SectionLabel, ComplexityTag } from "./primitives.js";
import { DishRow } from "./DishRow.js";
import { ReasonDialog } from "./ReasonDialog.js";

// What the reason dialog will commit on submit: a library swap (a chosen dish)
// or a free-text one-off using the searched text. The swap picker is the natural
// home for the custom one-off because `addCustomOneOff` replaces a position,
// exactly what "replace this dish with something not in the library" means.
type Choice = { kind: "library"; dish: Dish } | { kind: "custom"; label: string };

interface SwapPickerSheetProps {
  weekStart: string;
  day: ShortDay;
  meal: Meal;
  position: number;
  version: number;
  outgoingLabel: string;
  identity: Identity;
  onDone: () => void;
  onClose: () => void;
}

export function SwapPickerSheet({
  weekStart,
  day,
  meal,
  position,
  version,
  outgoingLabel,
  identity,
  onDone,
  onClose,
}: SwapPickerSheetProps) {
  const alternatives = useQuery(anyApi.swap.getSlotAlternatives, {
    weekStart,
    day,
    meal,
    position,
    limit: 60,
  }) as Dish[] | undefined;
  const swapDish = useMutation(anyApi.swap.swapDish);
  const addCustomOneOff = useMutation(anyApi.weekMutations.addCustomOneOff);

  const [q, setQ] = useState<string>("");
  const [choice, setChoice] = useState<Choice | null>(null);
  const [inFlight, setInFlight] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedQuery = q.trim();
  const visible = useMemo(() => {
    const list = alternatives ?? [];
    const needle = trimmedQuery.toLowerCase();
    if (!needle) return list;
    return list.filter((d) => d.name.toLowerCase().includes(needle));
  }, [alternatives, trimmedQuery]);

  async function handleSubmit(reason: string) {
    if (!choice || inFlight) return;
    setInFlight(true);
    setError(null);
    try {
      const result = (
        choice.kind === "library"
          ? await swapDish({
              author: identity,
              weekStart,
              day,
              meal,
              position,
              newDishId: choice.dish.id,
              version,
              reason,
            })
          : await addCustomOneOff({
              author: identity,
              weekStart,
              day,
              meal,
              position,
              customLabel: choice.label,
              version,
              reason,
            })
      ) as { ok: true; version: number } | { ok: false; reason: string };
      if (result.ok) {
        onDone();
        return;
      }
      if (result.reason === "version-mismatch") {
        setError("Someone just changed this week. Close and try again.");
      } else if (result.reason === "dish-not-meal-time") {
        setError("That dish belongs to a different meal. Pick another.");
      } else if (result.reason === "dish-not-active-or-in-season") {
        setError("That dish is not in season right now. Pick another.");
      } else {
        setError("Something is off. Close and try again.");
      }
    } catch (err) {
      console.error("swap/custom mutation threw", err);
      setError("Something is off. Close and try again.");
    } finally {
      setInFlight(false);
    }
  }

  if (choice) {
    const title =
      choice.kind === "library" ? `Replace with ${choice.dish.name}` : `Use "${choice.label}"`;
    return (
      <ReasonDialog
        title={title}
        submitLabel="Replace dish"
        inFlight={inFlight}
        error={error}
        onSubmit={handleSubmit}
        onClose={() => (inFlight ? undefined : setChoice(null))}
      />
    );
  }

  return (
    <Sheet onClose={onClose} tall>
      <div className="reason__title">Replace {outgoingLabel}</div>
      <div className="reason__hint">
        {dayLabel(day)} {mealLabel(meal).toLowerCase()}; pick from the library or use a one off
      </div>
      <SearchField value={q} onChange={setQ} placeholder="Search, or type a one off dish" />
      {trimmedQuery.length > 0 && (
        <button
          type="button"
          className="picker__custom"
          onClick={() => setChoice({ kind: "custom", label: trimmedQuery })}
        >
          Use &ldquo;{trimmedQuery}&rdquo; as a one off
        </button>
      )}
      {alternatives === undefined && <div className="picker__hint">Loading dishes...</div>}
      {alternatives !== undefined && visible.length === 0 && trimmedQuery.length === 0 && (
        <div className="picker__hint">No alternatives in the library for this meal.</div>
      )}
      {visible.length > 0 && (
        <>
          <SectionLabel>
            {trimmedQuery.length > 0 ? "From the library" : "Suggested for this day"}
          </SectionLabel>
          {visible.map((d) => (
            <button
              key={d.id}
              type="button"
              className="picker__row"
              onClick={() => setChoice({ kind: "library", dish: d })}
            >
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
