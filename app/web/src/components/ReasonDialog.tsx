// Shared confirm dialog for fast-loop writes (add, custom one-off, delete,
// skip, restore) with an OPTIONAL reason (Decision #8, amended: no change in
// the app ever demands a note). Quick-fill chips prefill the text field; the
// submit button is always live, and submitting with an empty field sends "" so
// the change lands with no note attached. Ported from the ReasonDialog overlay
// in design_handoff/hifi-overlays.jsx; the chip set matches the handoff.

import { useState } from "react";
import { Sheet, Chip, PrimaryButton } from "./primitives.js";

// Quick-fill chips. Tapping one sets the text field to that label; the user can
// then edit it. No em dashes per the project style rule.
const QUICK_REASONS = [
  "Eating out",
  "Not in season",
  "Too heavy this week",
  "Craving it",
  "Guests over",
] as const;

interface ReasonDialogProps {
  title: string;
  hint?: string;
  submitLabel?: string;
  inFlight?: boolean;
  error?: string | null;
  onSubmit: (reason: string) => void;
  onClose: () => void;
}

export function ReasonDialog({
  title,
  hint,
  submitLabel,
  inFlight,
  error,
  onSubmit,
  onClose,
}: ReasonDialogProps) {
  const [text, setText] = useState<string>("");
  const trimmed = text.trim();
  const canSubmit = !inFlight;

  return (
    <Sheet onClose={onClose}>
      <div className="reason__title">{title}</div>
      <div className="reason__hint">{hint ?? "A short reason helps the weekly review."}</div>
      <div className="reason__chips" role="group" aria-label="Quick reasons">
        {QUICK_REASONS.map((r) => (
          <Chip key={r} active={text === r} onClick={() => setText(r)}>
            {r}
          </Chip>
        ))}
      </div>
      {/* No autoFocus: the note is optional, so opening the keyboard over the
          confirm button would push a field the user is free to skip. */}
      <textarea
        className="reason__text"
        rows={3}
        value={text}
        aria-label="Reason (optional)"
        placeholder="Why this change? (optional)"
        onChange={(e) => setText(e.target.value)}
        disabled={inFlight}
      />
      {error && (
        <p className="reason__error" role="alert">
          {error}
        </p>
      )}
      <PrimaryButton disabled={!canSubmit} onClick={() => canSubmit && onSubmit(trimmed)}>
        {inFlight ? "Saving..." : (submitLabel ?? "Save change")}
      </PrimaryButton>
    </Sheet>
  );
}
