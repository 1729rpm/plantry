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

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { anyApi } from "convex/server";
import type { Dish } from "@plantry/engine";
import type { Identity, Meal, ShortDay } from "../lib/types.js";
import { swapPickerVisible } from "../lib/library.js";
import {
  PICKER_FILTERS,
  PICKER_FILTER_PILLS,
  availablePickerFilters,
  type PickerPill,
} from "../lib/dishFilters.js";
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

// The full ranked meal-time pool is requested so name search reaches every
// alternative, but the no-query default view stays a short "Suggested for this
// day" list. POOL_LIMIT is set above the largest meal-time pool (the active
// lunch library is ~167) so getSlotAlternatives' display cap never truncates
// the search corpus. SUGGESTED_CAP is how many ranked suggestions the default
// (no-query) view shows.
const POOL_LIMIT = 250;
const SUGGESTED_CAP = 12;

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
  // The Fruit of the day is swap-only (docs/engine.md §3.3): the picker offers
  // the in-season Category=Fruit pool but no custom one-off (no add/one-off for
  // fruit this PR). Breakfast/lunch keep the one-off path.
  const isFruit = meal === "fruit";
  const alternatives = useQuery(anyApi.swap.getSlotAlternatives, {
    weekStart,
    day,
    meal,
    position,
    limit: POOL_LIMIT,
  }) as Dish[] | undefined;
  const swapDish = useMutation(anyApi.swap.swapDish);
  const addCustomOneOff = useMutation(anyApi.weekMutations.addCustomOneOff);

  const [q, setQ] = useState<string>("");
  // The dynamic picker filter row. The breakfast/lunch pool is generic across
  // meal-time (feature picker-generic-search), so those slots offer the
  // Breakfast/Lunch pills alongside the quality pills; the fruit slot is
  // category-locked and offers quality pills only (see `candidatePills`). Which
  // pills actually render is driven by what the current results contain.
  const [filters, setFilters] = useState<PickerPill[]>([]);
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

  const pool = useMemo(() => alternatives ?? [], [alternatives]);

  // The corpus for BOTH name search and the quick-filter chips is the FULL
  // ranked pool (requested with POOL_LIMIT above), so a recently-cooked staple
  // that ranks at the bottom is still reachable by name and the chips narrow the
  // whole pool, not just the suggested head. The SUGGESTED_CAP only applies to
  // the default view, when there is neither a query nor an active filter; any
  // query or filter returns all matches. Mirrors AddDishSheet's full-pool
  // filter.
  const visible = useMemo(
    () => swapPickerVisible(pool, trimmedQuery, filters, SUGGESTED_CAP),
    [pool, trimmedQuery, filters],
  );

  // The corpus narrowed by the SEARCH TEXT ONLY (ignoring selected pills). Basis
  // for pill visibility once a query/selection exists, so selecting Breakfast
  // never hides the Lunch pill.
  const textCorpus = useMemo(() => {
    const needle = trimmedQuery.toLowerCase();
    if (needle === "") return pool;
    return pool.filter((d) => d.name.toLowerCase().includes(needle));
  }, [pool, trimmedQuery]);

  // The candidate vocabulary: the fruit slot is category-locked, so it offers
  // quality pills only (no meal-time dimension); breakfast/lunch offer the full
  // picker vocabulary (meal-time + quality).
  const candidatePills: PickerPill[] = isFruit ? PICKER_FILTERS : PICKER_FILTER_PILLS;

  // Pills offered: only those with >= 1 match. Pristine (no query, no selection)
  // basis is the displayed suggested head (`visible`), so the row reflects what
  // the slot actually suggests; otherwise the basis is the text corpus so a
  // selected meal pill never hides its sibling.
  const pristine = trimmedQuery === "" && filters.length === 0;
  const pills = useMemo(
    () => availablePickerFilters(pristine ? visible : textCorpus, candidatePills),
    [pristine, visible, textCorpus, candidatePills],
  );

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
      } else if (result.reason === "dish-is-fruit") {
        // A Fruit-category dish dropped into a breakfast/lunch slot. Fruit
        // belongs to its own slot (the pool excludes it), so this only happens
        // on a stale concurrent edit; guide the user to a meal dish.
        setError("That dish belongs to the Fruit slot. Pick another.");
      } else if (result.reason === "dish-not-fruit") {
        setError("Pick a fruit for the Fruit of the day.");
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
        {dayLabel(day)} {mealLabel(meal).toLowerCase()};{" "}
        {isFruit
          ? "pick a seasonal fruit from the library"
          : "pick from the library or use a one off"}
      </div>
      <SearchField
        value={q}
        onChange={setQ}
        placeholder={isFruit ? "Search fruit" : "Search, or type a one off dish"}
        autoFocus
      />
      {pills.length > 0 && (
        <div className="picker__filters" role="group" aria-label="Filters">
          {pills.map((f) => (
            <Chip key={f} active={filters.includes(f)} onClick={() => toggleFilter(f)}>
              {f}
            </Chip>
          ))}
        </div>
      )}
      {!isFruit && trimmedQuery.length > 0 && (
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
