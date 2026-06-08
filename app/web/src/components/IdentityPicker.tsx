import type { Identity } from "../lib/types.js";

interface IdentityPickerProps {
  onPick: (identity: Identity) => void;
}

// Slice 1 stores the pick in localStorage only. A later Stream D or Stream F
// slice will mirror this into Convex's userProfiles table when the
// setUserProfile mutation lands; do not add that call here.
export function IdentityPicker({ onPick }: IdentityPickerProps) {
  return (
    <div className="splash">
      <div className="splash__card">
        <h1 className="splash__title">Who is this phone for?</h1>
        <p className="splash__hint">Pick once. Your edits will be tagged with this name.</p>
        <div className="identity-picker">
          <button type="button" className="identity-picker__button" onClick={() => onPick("rajat")}>
            I am Rajat
          </button>
          <button
            type="button"
            className="identity-picker__button"
            onClick={() => onPick("tuhina")}
          >
            I am Tuhina
          </button>
        </div>
      </div>
    </div>
  );
}
