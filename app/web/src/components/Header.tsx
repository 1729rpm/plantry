import type { Identity } from "../lib/types.js";

interface HeaderProps {
  identity: Identity | null;
  onClearIdentity: () => void;
}

function identityDisplay(identity: Identity): string {
  return identity === "rajat" ? "Rajat" : "Tuhina";
}

export function Header({ identity, onClearIdentity }: HeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header__title">Plantry</div>
      {identity && (
        <div className="app-header__identity">
          <span className="app-header__identity-name">{identityDisplay(identity)}</span>
          <button type="button" className="app-header__not-me" onClick={onClearIdentity}>
            Not me
          </button>
        </div>
      )}
    </header>
  );
}
