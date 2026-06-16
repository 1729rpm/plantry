import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { anyApi } from "convex/server";
import { PasscodeGate } from "./components/PasscodeGate.js";
import { IdentityPicker } from "./components/IdentityPicker.js";
import { MenuScreen } from "./components/MenuScreen.js";
import { GroceryScreen } from "./components/GroceryScreen.js";
import { ChangesScreen } from "./components/ChangesScreen.js";
import { ExploreScreen } from "./components/ExploreScreen.js";
import { DayScreen } from "./components/DayScreen.js";
import { ExitConfirmSheet } from "./components/ExitConfirmSheet.js";
import { TabBar, type TabKey } from "./components/primitives.js";
import { viewHistory, type ViewState } from "./lib/backStack.js";
import {
  clearIdentity,
  getIdentity,
  getOrCreateDeviceId,
  isAuthValid,
  markAuthPassed,
  setIdentity,
} from "./lib/storage.js";
import type { Identity, ShortDay } from "./lib/types.js";

const PASSCODE = import.meta.env.VITE_PLANTRY_PASSCODE ?? "";

export function App() {
  const [authed, setAuthed] = useState<boolean>(() => isAuthValid());
  const [identity, setIdentityState] = useState<Identity | null>(() => getIdentity());
  const [tab, setTab] = useState<TabKey>("Menu");
  // The day currently open in the editing family (the Day screen and its sheets),
  // shown over the Menu tab. Null when the Menu list is showing. Set from a day
  // card's Edit; cleared by the Day screen's back affordance or a tab switch.
  const [editingDay, setEditingDay] = useState<ShortDay | null>(null);
  // True while the homepage exit-confirm prompt is showing. Only ever set by the
  // back-stack controller's at-home Back branch (requestExitConfirm below).
  const [exitPrompt, setExitPrompt] = useState<boolean>(false);
  const setUserProfile = useMutation(anyApi.users.setUserProfile);

  // Wire the single unified back-stack controller once. The controller owns the
  // ONE popstate listener; it calls back IN here to apply a popped view (Back
  // unwinding tab/editor history) or to prompt the homepage exit confirm. We do
  // NOT add a second listener anywhere. applyView sets React state directly
  // (without re-pushing a marker, since this IS the Back).
  useEffect(() => {
    viewHistory.connect({
      applyView: (view: ViewState) => {
        setExitPrompt(false);
        setTab(view.tab as TabKey);
        setEditingDay(view.editingDay as ShortDay | null);
      },
      requestExitConfirm: () => {
        setExitPrompt(true);
      },
    });
    return () => viewHistory.disconnect();
  }, []);

  function handlePass() {
    markAuthPassed();
    setAuthed(true);
  }

  function handlePickIdentity(next: Identity) {
    setIdentity(next);
    setIdentityState(next);
    // Fire-and-forget mirror to Convex; the localStorage write above is the UI
    // source of truth regardless of whether this round-trips.
    const deviceId = getOrCreateDeviceId();
    setUserProfile({ deviceId, identity: next }).catch((err) => {
      console.error("setUserProfile failed", err);
    });
  }

  function handleSwitchIdentity() {
    clearIdentity();
    setIdentityState(null);
    setEditingDay(null);
    setTab("Menu");
    // Returning to the IdentityPicker is a return to the app's base; collapse the
    // view stack so history and state stay in sync (resetToHome keeps the live
    // stack as the source of truth; stale browser markers resolve as "at home").
    viewHistory.resetToHome();
  }

  // Forward view navigation: switching tabs. Update React state, then record one
  // view entry so a later Back unwinds to the previous tab in visit order.
  function handleTab(next: TabKey) {
    setEditingDay(null);
    setTab(next);
    viewHistory.pushView({ tab: next, editingDay: null });
  }

  // Forward view navigation: opening the Day editor over the Menu tab.
  function handleEditDay(day: ShortDay) {
    setEditingDay(day);
    viewHistory.pushView({ tab: "Menu", editingDay: day });
  }

  // The Day screen's own back affordance (the in-UI back arrow). Mirror it onto
  // the controller via a real history.back() so the visit history stays
  // consistent with the OS Back gesture: both land on whatever the user saw
  // before opening the editor. The controller's applyView then clears editingDay.
  function handleDayBack() {
    window.history.back();
  }

  // Exit-confirm: Leave attempts to leave the app (best-effort; see backStack.ts).
  function handleLeave() {
    setExitPrompt(false);
    viewHistory.leaveApp();
  }

  // Exit-confirm: Stay dismisses the prompt and keeps the user on the homepage.
  // The sentinel marker the controller pushed holds the history position; we keep
  // it so the next Back re-prompts.
  function handleStay() {
    setExitPrompt(false);
    viewHistory.cancelExit();
  }

  if (!authed) {
    return <PasscodeGate expected={PASSCODE} onPass={handlePass} />;
  }

  if (!identity) {
    return <IdentityPicker onPick={handlePickIdentity} />;
  }

  function renderActive() {
    if (tab === "Menu") {
      if (editingDay) {
        return <DayScreen day={editingDay} identity={identity!} onBack={handleDayBack} />;
      }
      return (
        <MenuScreen
          identity={identity!}
          onSwitchIdentity={handleSwitchIdentity}
          onEditDay={handleEditDay}
        />
      );
    }
    if (tab === "Grocery") return <GroceryScreen />;
    if (tab === "Explore") return <ExploreScreen identity={identity!} />;
    return <ChangesScreen />;
  }

  return (
    <div className="screen">
      {renderActive()}
      <TabBar active={tab} onTab={handleTab} />
      {exitPrompt && <ExitConfirmSheet onLeave={handleLeave} onStay={handleStay} />}
    </div>
  );
}
