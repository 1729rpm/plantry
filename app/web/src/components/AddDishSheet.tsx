// Add-a-dish sheet. Appends a library dish to the day via the 4.1 `addDish`
// mutation (non-restrictive pool: Active + season, no composition narrowing).
// The picker is a single generic search over the whole addable library
// (feature picker-generic-search): a breakfast dish and a lunch dish both
// surface, and the chosen dish routes to the slot its own meal-time names, so
// there is NO destination control here. Cross-meal placement is done via
// Replace only (spec decision 1). Picking a dish opens the shared reason dialog.
// Ported from the AddDishSheet overlay in design_handoff/hifi-overlays.jsx.
//
// Custom one-offs are NOT offered here: the only one-off mutation
// (`addCustomOneOff`) replaces an existing position, so it lives in the Replace
// flow (SwapPickerSheet). Appending a free-text one-off would need a new Convex
// mutation, which is out of this slice's scope; see the PR diagnosis card.

import { useEffect, useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { anyApi } from "convex/server";
import type { Dish } from "@plantry/engine";
import type { Identity, MealTime, ShortDay } from "../lib/types.js";
import { addablePool } from "../lib/library.js";
import {
  PICKER_FILTER_PILLS,
  availablePickerFilters,
  dishMatchesPickerFilters,
  type PickerPill,
} from "../lib/dishFilters.js";
import { dayLabel } from "../lib/days.js";
import { Sheet, SearchField, SectionLabel, Chip } from "./primitives.js";
import { DishRow } from "./DishRow.js";
import { ReasonDialog } from "./ReasonDialog.js";

interface AddDishSheetProps {
  weekStart: string;
  day: ShortDay;
  version: number;
  // The day's addable meal-times (breakfast/lunch only; the Fruit of the day is
  // swap-only per docs/engine.md §3.3, so it is never an add target). Passed to
  // addablePool as the structural floor: a breakfast dish is only addable on a
  // day that actually has a breakfast slot (e.g. excluded on Saturday), since it
  // routes to that slot.
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
  const [q, setQ] = useState<string>("");
  // The dynamic picker filter row. Unlike the old two-row layout (a meal
  // selector plus quality chips), this is one row whose pills are driven by what
  // the current results actually contain (see `pills` below). The meal-time
  // pills are real filters here because the pool spans both meal-times.
  const [filters, setFilters] = useState<PickerPill[]>([]);
  const [chosen, setChosen] = useState<Dish | null>(null);
  const [inFlight, setInFlight] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  function toggleFilter(f: PickerPill) {
    setFilters((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));
  }

  const trimmedQuery = q.trim();

  // Filters get reset whenever the search query changes, so a fresh search
  // always starts from an unfiltered list (spec "filters get reset when search
  // is fired"). Trimmed so leading/trailing whitespace edits do not churn it.
  useEffect(() => {
    setFilters([]);
  }, [trimmedQuery]);

  // The whole addable pool for this day (Active + in-season + non-Fruit + a slot
  // on the day for its meal-time). Generic across meal-time.
  const pool = useMemo(() => addablePool(weekStart, availableMeals), [weekStart, availableMeals]);

  // The corpus narrowed by the SEARCH TEXT ONLY (ignoring selected pills). This
  // is the basis for the pill visibility once a query/selection exists, so
  // selecting Breakfast never hides the Lunch pill: both stay offered as long as
  // the text matches a dish of each meal-time.
  const textCorpus = useMemo(() => {
    const needle = trimmedQuery.toLowerCase();
    if (needle === "") return pool;
    return pool.filter((d) => d.name.toLowerCase().includes(needle));
  }, [pool, trimmedQuery]);

  // The list actually shown: the text corpus narrowed by the selected pills. The
  // Add picker has no suggested-head cap (it shows the whole addable library by
  // name), so pristine and narrowed views are uncapped alike.
  const visible = useMemo(
    () => textCorpus.filter((d) => dishMatchesPickerFilters(d, filters)),
    [textCorpus, filters],
  );

  // Pills offered: only those with >= 1 match. In the pristine state (no query,
  // no selection) the basis is the displayed list (here `pool`, since Add shows
  // the whole pool with no cap), so the row reflects what the slot suggests.
  // Once a query or a selection exists, the basis is the text corpus so a
  // selected meal pill never hides its sibling.
  const pristine = trimmedQuery === "" && filters.length === 0;
  const pills = useMemo(
    () => availablePickerFilters(pristine ? pool : textCorpus, PICKER_FILTER_PILLS),
    [pristine, pool, textCorpus],
  );

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
    // The chosen dish routes to its own meal-time's slot (spec decision 1): a
    // breakfast dish lands in the breakfast slot, a lunch dish in the lunch
    // slot. addablePool already guarantees the slot exists on this day.
    const meal: MealTime = chosen.time === "Breakfast" ? "breakfast" : "lunch";
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
      <SearchField value={q} onChange={setQ} placeholder="Search dishes" autoFocus />
      {pills.length > 0 && (
        <div className="picker__filters" role="group" aria-label="Filters">
          {pills.map((f) => (
            <Chip key={f} active={filters.includes(f)} onClick={() => toggleFilter(f)}>
              {f}
            </Chip>
          ))}
        </div>
      )}
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
