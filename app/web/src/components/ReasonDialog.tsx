// Shared reason dialog. Every fast-loop write that requires a reason (swap,
// custom one-off, delete, skip, restore) routes its reason capture through this
// one component (Decision #8, the Stream I pattern). Quick-fill chips prefill
// the text field; the text field is required (the submit button stays disabled
// until the trimmed text is non-empty). Ported from the ReasonDialog overlay in
// design_handoff/hifi-overlays.jsx; the chip set matches the handoff.

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
  const canSubmit = trimmed.length > 0 && !inFlight;

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
      <textarea
        className="reason__text"
        rows={3}
        value={text}
        autoFocus
        aria-label="Reason"
        placeholder="Why this change?"
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
