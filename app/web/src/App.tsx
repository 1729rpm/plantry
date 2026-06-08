import { useState } from "react";
import { Header } from "./components/Header.js";
import { PasscodeGate } from "./components/PasscodeGate.js";
import { IdentityPicker } from "./components/IdentityPicker.js";
import { CurrentWeekView } from "./components/CurrentWeekView.js";
import {
  clearIdentity,
  getIdentity,
  isAuthValid,
  markAuthPassed,
  setIdentity,
} from "./lib/storage.js";
import type { Identity } from "./lib/types.js";

const PASSCODE = import.meta.env.VITE_PLANTRY_PASSCODE ?? "";

export function App() {
  const [authed, setAuthed] = useState<boolean>(() => isAuthValid());
  const [identity, setIdentityState] = useState<Identity | null>(() => getIdentity());

  function handlePass() {
    markAuthPassed();
    setAuthed(true);
  }

  function handlePickIdentity(next: Identity) {
    setIdentity(next);
    setIdentityState(next);
  }

  function handleClearIdentity() {
    clearIdentity();
    setIdentityState(null);
  }

  if (!authed) {
    return <PasscodeGate expected={PASSCODE} onPass={handlePass} />;
  }

  if (!identity) {
    return <IdentityPicker onPick={handlePickIdentity} />;
  }

  return (
    <div className="app">
      <Header identity={identity} onClearIdentity={handleClearIdentity} />
      <main className="app__main">
        <CurrentWeekView />
      </main>
      <footer className="app__footer">
        <a href="https://github.com/mudgal1729/plantry" target="_blank" rel="noreferrer">
          plantry on github
        </a>
      </footer>
    </div>
  );
}
