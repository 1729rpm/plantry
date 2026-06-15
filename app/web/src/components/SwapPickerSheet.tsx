// Swap picker. Opened from the dish action sheet or the details sheet's Replace
// action. Lists alternatives from the 3.1 picker ranking (getSlotAlternatives:
// the broad, meal-time-matching, in-season pool ranked by recency + protein-band
// similarity to the outgoing dish), searchable by name.
//
// Picking a LIBRARY dish opens a details-first confirm view (the same shared
// DishDetailBody surface as the Explore / Menu detail sheets) with a primary
// "Replace dish" action and an OPTIONAL reason field: leaving the reason empty
// still goes through (the product owner chose "Confirm + optional reason"). The
// custom one-off path has no library dish to show, so it stays on the shared
// ReasonDialog with a required reason. On submit either path calls its mutation
// with the live version for optimistic concurrency. Ported from the
// SwapPickerSheet overlay in design_handoff/hifi-overlays.jsx. The ranking
// lives in Convex, not here.

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { anyApi } from "convex/server";
import type { Dish } from "@plantry/engine";
import type { Identity, Meal, ShortDay } from "../lib/types.js";
import { PICKER_FILTERS, dishMatchesFilters, type DishFilter } from "../lib/dishFilters.js";
import { dayLabel, mealLabel } from "../lib/days.js";
import { Sheet, SearchField, SectionLabel, PrimaryButton, Chip } from "./primitives.js";
import { DishRow } from "./DishRow.js";
import { DishDetailBody } from "./DishDetailBody.js";
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
  // Quick-filter chips, mirroring Explore. The meal is fixed by the slot, so the
  // Breakfast/Lunch filters would be redundant and are dropped; only the
  // meal-independent chips ("Easy to cook", "Healthy") show.
  const [filters, setFilters] = useState<DishFilter[]>([]);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [inFlight, setInFlight] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  // Optional reason for the library replace-confirm view. The custom one-off
  // path captures its (required) reason through ReasonDialog instead.
  const [reason, setReason] = useState<string>("");

  function backToPicker() {
    if (inFlight) return;
    setChoice(null);
    setReason("");
    setError(null);
  }

  function toggleFilter(f: DishFilter) {
    setFilters((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));
  }

  const trimmedQuery = q.trim();
  const visible = useMemo(() => {
    const list = alternatives ?? [];
    const needle = trimmedQuery.toLowerCase();
    return list.filter(
      (d) =>
        (needle === "" || d.name.toLowerCase().includes(needle)) && dishMatchesFilters(d, filters),
    );
  }, [alternatives, trimmedQuery, filters]);

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

  // Library pick: show the dish details first (the shared detail surface) with a
  // primary "Replace dish" action and an optional reason. Empty reason still
  // swaps. Back arrow returns to the picker list.
  if (choice && choice.kind === "library") {
    return (
      <Sheet onClose={onClose} tall>
        <div className="swap-confirm__head">
          <button
            type="button"
            className="swap-confirm__back"
            aria-label="Back to the dish list"
            onClick={backToPicker}
          >
            &lsaquo;
          </button>
          <div className="reason__title">Replace with {choice.dish.name}</div>
        </div>
        <DishDetailBody dish={choice.dish} />

        <div className="swap-confirm__reason">
          <label className="swap-confirm__reason-label" htmlFor="swap-reason">
            Add a reason (optional)
          </label>
          <textarea
            id="swap-reason"
            className="reason__text"
            rows={2}
            value={reason}
            aria-label="Reason (optional)"
            placeholder="Why this change? Helps the weekly review."
            onChange={(e) => setReason(e.target.value)}
            disabled={inFlight}
          />
        </div>

        {error && (
          <p className="reason__error" role="alert">
            {error}
          </p>
        )}
        <PrimaryButton
          className="swap-confirm__submit"
          disabled={inFlight}
          onClick={() => handleSubmit(reason.trim())}
        >
          {inFlight ? "Saving..." : "Replace dish"}
        </PrimaryButton>
      </Sheet>
    );
  }

  // Custom one-off: no library dish to preview, so the required-reason dialog
  // stays the confirm surface.
  if (choice) {
    return (
      <ReasonDialog
        title={`Use "${choice.label}"`}
        submitLabel="Replace dish"
        inFlight={inFlight}
        error={error}
        onSubmit={handleSubmit}
        onClose={() => (inFlight ? undefined : setChoice(null))}
      />
    );
  }

  return (
    <Sheet onClose={onClose} tall picker>
      <div className="reason__title">Replace {outgoingLabel}</div>
      <div className="reason__hint">
        {dayLabel(day)} {mealLabel(meal).toLowerCase()}; pick from the library or use a one off
      </div>
      <SearchField
        value={q}
        onChange={setQ}
        placeholder="Search, or type a one off dish"
        autoFocus
      />
      <div className="picker__filters" role="group" aria-label="Filters">
        {PICKER_FILTERS.map((f) => (
          <Chip key={f} active={filters.includes(f)} onClick={() => toggleFilter(f)}>
            {f}
          </Chip>
        ))}
      </div>
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
      {alternatives !== undefined &&
        visible.length === 0 &&
        trimmedQuery.length === 0 &&
        filters.length === 0 && (
          <div className="picker__hint">No alternatives in the library for this meal.</div>
        )}
      {alternatives !== undefined &&
        visible.length === 0 &&
        (trimmedQuery.length > 0 || filters.length > 0) && (
          <div className="picker__hint">
            {trimmedQuery.length > 0 && filters.length > 0
              ? "No dish matches your search and filters."
              : trimmedQuery.length > 0
                ? "No dish matches your search."
                : "No dish matches those filters."}
          </div>
        )}
      {visible.length > 0 && (
        <div className="picker__results">
          <SectionLabel>
            {trimmedQuery.length === 0 && filters.length === 0
              ? "Suggested for this day"
              : "From the library"}
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
              />
            </button>
          ))}
        </div>
      )}
    </Sheet>
  );
}
