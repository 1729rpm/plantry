// Dish action sheet. Opened from the per-dish "..." affordance on the Day
// screen. Offers Details and recipe (library dishes only), Replace, and Delete.
// Delete is the only action that completes here: it opens the shared reason
// dialog and calls the 4.1 `deleteDish` mutation (a day may end up below its
// composition shape; that is allowed, Decision #11). Replace and Details hand
// back up to the Day screen, which opens the swap picker / details sheet. Ported
// from the DishActionSheet overlay in design_handoff/hifi-overlays.jsx.

import { useState } from "react";
import { useMutation } from "convex/react";
import { anyApi } from "convex/server";
import type { Identity, Meal, ShortDay } from "../lib/types.js";
import { Sheet } from "./primitives.js";
import { ReasonDialog } from "./ReasonDialog.js";

interface DishActionSheetProps {
  weekStart: string;
  day: ShortDay;
  meal: Meal;
  position: number;
  version: number;
  dishLabel: string;
  isLibraryDish: boolean;
  identity: Identity;
  onDetails: () => void;
  onReplace: () => void;
  onDeleted: () => void;
  onClose: () => void;
}

export function DishActionSheet({
  weekStart,
  day,
  meal,
  position,
  version,
  dishLabel,
  isLibraryDish,
  identity,
  onDetails,
  onReplace,
  onDeleted,
  onClose,
}: DishActionSheetProps) {
  const deleteDish = useMutation(anyApi.dayMutations.deleteDish);
  const [confirmingDelete, setConfirmingDelete] = useState<boolean>(false);
  const [inFlight, setInFlight] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(reason: string) {
    if (inFlight) return;
    setInFlight(true);
    setError(null);
    try {
      const result = (await deleteDish({
        author: identity,
        weekStart,
        day,
        meal,
        position,
        version,
        reason,
      })) as { ok: true; version: number } | { ok: false; reason: string };
      if (result.ok) {
        onDeleted();
        return;
      }
      if (result.reason === "version-mismatch") {
        setError("Someone just changed this week. Close and try again.");
      } else {
        setError("Something is off. Close and try again.");
      }
    } catch (err) {
      console.error("deleteDish threw", err);
      setError("Something is off. Close and try again.");
    } finally {
      setInFlight(false);
    }
  }

  if (confirmingDelete) {
    return (
      <ReasonDialog
        title={`Remove ${dishLabel}`}
        hint="Removing leaves the day with fewer dishes. A short reason helps the review."
        submitLabel="Remove dish"
        inFlight={inFlight}
        error={error}
        onSubmit={handleDelete}
        onClose={() => (inFlight ? undefined : setConfirmingDelete(false))}
      />
    );
  }

  return (
    <Sheet onClose={onClose}>
      <div className="reason__title">{dishLabel}</div>
      <div className="action-sheet">
        {isLibraryDish && (
          <button type="button" className="action-sheet__row" onClick={onDetails}>
            <span className="action-sheet__label">Details and recipe</span>
            <span className="action-sheet__hint">Cooking info, ingredients</span>
          </button>
        )}
        <button type="button" className="action-sheet__row" onClick={onReplace}>
          <span className="action-sheet__label">Replace</span>
          <span className="action-sheet__hint">Pick another dish</span>
        </button>
        <button
          type="button"
          className="action-sheet__row"
          onClick={() => setConfirmingDelete(true)}
        >
          <span className="action-sheet__label action-sheet__label--danger">Delete</span>
          <span className="action-sheet__hint">Remove from this day</span>
        </button>
      </div>
    </Sheet>
  );
}
