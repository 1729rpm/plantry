// Profile sheet. Opened from the avatar on the Menu header (which now carries
// the relocated unread-changes badge). Shows who is editing, a switch-user row,
// and a row into the Changes log (the old Changes tab, now a sheet). Ported from
// the ProfileSheet overlay in the wishlist-favorites-v2 handoff.

import type { Identity } from "../lib/types.js";
import { Avatar, Sheet } from "./primitives.js";

interface ProfileSheetProps {
  identity: Identity;
  // The count of this week's menu edits, shown as the hint on the Changes row
  // ("{n} changes" / "None yet").
  changeCount: number;
  onSwitch: () => void;
  onOpenChanges: () => void;
  onClose: () => void;
}

function displayName(identity: Identity): string {
  return identity === "rajat" ? "Rajat" : "Tuhina";
}

export function ProfileSheet({
  identity,
  changeCount,
  onSwitch,
  onOpenChanges,
  onClose,
}: ProfileSheetProps) {
  const other = identity === "rajat" ? "Tuhina" : "Rajat";
  const changesHint =
    changeCount <= 0 ? "None yet" : `${changeCount} ${changeCount === 1 ? "change" : "changes"}`;

  return (
    <Sheet onClose={onClose}>
      <div className="profile__head">
        <Avatar who={identity} size={44} />
        <div>
          <div className="profile__name">{displayName(identity)}</div>
          <div className="profile__sub">Edits carry your name</div>
        </div>
      </div>
      <div className="action-sheet">
        <button type="button" className="action-sheet__row" onClick={onSwitch}>
          <span className="action-sheet__label">Switch to {other}</span>
          <span className="action-sheet__hint">Change who is editing</span>
        </button>
        <button type="button" className="action-sheet__row" onClick={onOpenChanges}>
          <span className="action-sheet__label">Changes to this week</span>
          <span className="action-sheet__hint">{changesHint}</span>
        </button>
      </div>
    </Sheet>
  );
}
