// Exit-confirm prompt shown ONLY when the user presses browser/OS Back from the
// homepage (the Menu tab with no day open). From every other screen Back unwinds
// the visit history; only the homepage is the edge of the app, and leaving it is
// gated by this terminal confirmation (the feature Rajat asked for).
//
// WHY IT OPTS OUT OF THE SHEET BACK-STACK (noHistory)
// ---------------------------------------------------
// The unified controller (lib/backStack.ts) already pushed a sentinel history
// marker when at-home Back fired, so the user stays put while this prompt shows.
// If this prompt ALSO registered as a normal Sheet it would push a second marker
// and Leave/Stay would have to untangle two layers. Instead it renders on the
// shared Sheet primitive with `noHistory`, so it owns NO marker: the App drives
// Leave (controller.leaveApp) and Stay (just dismiss) directly. A browser Back
// or a scrim tap on this prompt therefore both mean "Stay" (dismiss + keep the
// sentinel), never "pop a layer".
//
// COPY: no em dashes / long dashes in any user-facing string (project style).

import { Sheet, PrimaryButton, QuietButton } from "./primitives.js";

interface ExitConfirmSheetProps {
  // Confirm: actually attempt to leave the app (best-effort; see backStack.ts).
  onLeave: () => void;
  // Cancel: stay on the homepage. Also wired to the scrim and to browser Back.
  onStay: () => void;
}

export function ExitConfirmSheet({ onLeave, onStay }: ExitConfirmSheetProps) {
  return (
    <Sheet onClose={onStay} noHistory>
      <div className="reason__title">Leave Plantry?</div>
      <div className="reason__hint">You&rsquo;re about to leave the app.</div>
      {/* Reuse the existing .detail__actions row (flex + gap) so the two buttons
          sit side by side without adding any new rule to index.css. */}
      <div className="detail__actions">
        <QuietButton className="detail__action-remove" onClick={onStay}>
          Stay
        </QuietButton>
        <PrimaryButton className="detail__action-replace" onClick={onLeave}>
          Leave
        </PrimaryButton>
      </div>
    </Sheet>
  );
}
