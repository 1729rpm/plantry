// Unified browser-Back / history controller for the whole app.
//
// WHY ONE CONTROLLER
// ------------------
// There must be exactly ONE popstate listener and ONE history-marker discipline
// in the app. Two independent history-marker systems is a real bug class: a
// deferred history.back() from one system lands as a popstate the OTHER system
// interprets as its own Back, closing the wrong thing. The original sheet-only
// controller (PR #78) already paid for that lesson; this module generalizes it
// into a single back-stack that owns BOTH the in-app view navigation (tab
// switches, opening the Day editor) and the bottom sheets, under one listener.
//
// THE TWO LAYERS
// --------------
// The logical back-stack has two layers, mirrored into browser history as a run
// of history markers (one pushState per forward step):
//
//   [ view base | view step | view step | ... | sheet | sheet | ... ]
//   ^ homepage    ^ tab/editor pushes        ^ sheets stack on top
//
//   * View layer (bottom): the homepage (Menu tab, no day open) is the BASE and
//     pushes NO marker. Every forward view navigation away from a distinct view
//     (switching tab, opening the Day editor) pushes ONE marker and records one
//     logical view entry {tab, editingDay}. Back pops one view entry and the
//     app applies the now-top view to its React state.
//   * Sheet layer (top): unchanged single-marker-for-ALL-stacked-sheets
//     semantics from PR #78, but the marker bookkeeping is now shared with the
//     view layer (see below). Sheets always sit on top of the view stack.
//
// POPSTATE DISPATCH ORDER (one listener, checked top-down)
// --------------------------------------------------------
//   1. A sheet is open  -> close the TOP sheet (existing sheet path). If sheets
//      remain, re-arm a marker so the next Back is still caught.
//   2. Else the view stack has depth > 1 (not at home) -> pop one view entry and
//      hand the new top view to the app to apply.
//   3. Else at home -> ask the app to show the exit-confirm dialog and RE-PUSH a
//      sentinel marker so the app stays put. On confirm the app calls
//      leaveApp(); on cancel nothing happens (the sentinel holds the user here).
//
// THE SHEET SIBLING-SWAP INVARIANT (preserved EXACTLY from PR #78)
// ---------------------------------------------------------------
// The app's overlay is a single state value, so opening a follow-on sheet
// unmounts the current Sheet and mounts the new one in the SAME React commit.
// React runs the unmounting child's cleanup BEFORE the mounting child's setup.
// If a programmatic last-sheet-close popped its marker synchronously, the new
// sheet would pushState, then the deferred popstate from that back() would close
// the freshly opened sheet. So a programmatic close that empties the SHEET stack
// pops the shared marker only via queueMicrotask: a sibling swap re-registers a
// sheet synchronously before the microtask runs, leaving the sheet stack
// non-empty and cancelling the pop. Only a genuine last-sheet-close stays empty
// when the microtask runs, and only then do we history.back() one marker.
//
// HOW THE LAYERS SHARE HISTORY
// ----------------------------
// Browser history cannot remove a buried entry without disturbing the top one
// (history.back() always pops the top). So the two layers do not push markers
// independently into arbitrary positions: sheets are always on top, and the
// total marker count we have pushed equals (view depth beyond base) + (sheets
// open ? at least one sheet marker : 0). When a sheet programmatically closes we
// pop exactly its marker(s); when a view Back fires we let the browser keep the
// pop it already did. The single dispatcher reads the live stacks at popstate
// time, so it always acts on whichever layer is on top.

export type ViewState = { tab: string; editingDay: string | null };

type SheetCloseRef = { current: () => void };
type SheetEntry = { kind: "sheet"; id: string; closeRef: SheetCloseRef };

// Callbacks the app wires in once, at mount. The controller calls back INTO the
// app to apply a popped view or to prompt the exit confirm; the app never owns a
// second listener.
type AppHooks = {
  // Apply a popped view entry to React state (set tab + editingDay).
  applyView: (view: ViewState) => void;
  // At-home Back: show the exit-confirm dialog. The app decides Leave vs Stay.
  requestExitConfirm: () => void;
};

const backStack = (() => {
  // View layer. The base (index 0) is the homepage and owns NO marker. Each
  // further entry corresponds to one pushed marker.
  const viewStack: ViewState[] = [{ tab: "Menu", editingDay: null }];
  // Sheet layer, always logically on top of the view stack.
  const sheetStack: SheetEntry[] = [];

  // True while at least one marker for the SHEET layer is present in history.
  // The view layer tracks its own markers implicitly via viewStack depth.
  let sheetMarkerPresent = false;
  let listening = false;
  // Set when a popstate (real browser Back) consumed a sheet marker, so the
  // close it triggers is distinguished from a programmatic close on unregister.
  let consumedByPopstate = false;
  // Set just before WE call history.back() to pop our own sheet marker on a
  // programmatic last-sheet close. That back() fires its own popstate; without
  // this guard the single unified dispatcher would treat it as a user Back and
  // wrongly pop a view entry or show the exit prompt. The guard makes the
  // dispatcher swallow exactly that one self-inflicted popstate. (The old
  // sheet-only controller avoided this by REMOVING its listener around the pop;
  // the unified listener must stay armed for the view/home layer, so we suppress
  // by flag instead.)
  let ignoreNextPop = false;
  // True once the base sentinel has been pushed. Guards against pushing a second
  // sentinel if connect() runs again (React StrictMode double-invokes effects in
  // dev: mount -> connect, cleanup -> disconnect, mount -> connect). It survives
  // disconnect on purpose so the second StrictMode connect reuses the existing
  // sentinel rather than stacking another. In production effects run once, so
  // this is a single push regardless.
  let baseSentinelPresent = false;

  let hooks: AppHooks | null = null;

  // The listener lives for the WHOLE connected lifetime. connect() pushes a base
  // sentinel that is always present while the app is mounted, so the at-home Back
  // is always a same-document popstate we must catch; there is never a moment at
  // which it is safe to stop listening before disconnect. (The sheet layer still
  // tracks its own marker count; only the listener lifecycle is simplified.)
  function ensureListening() {
    if (!listening) {
      window.addEventListener("popstate", onPopState);
      listening = true;
    }
  }

  function pushSheetMarker() {
    window.history.pushState({ plantrySheet: true }, "");
    sheetMarkerPresent = true;
    ensureListening();
  }

  function onPopState() {
    // Swallow the one self-inflicted popstate from our own programmatic
    // sheet-marker pop (see ignoreNextPop). It is not a user Back.
    if (ignoreNextPop) {
      ignoreNextPop = false;
      return;
    }
    // Dispatch order: sheets first (top of the stack), then views, then at-home.
    if (sheetStack.length > 0) {
      consumedByPopstate = true;
      const top = sheetStack[sheetStack.length - 1];
      top.closeRef.current();
      return;
    }
    if (viewStack.length > 1) {
      // The browser already popped our marker for this step; just mirror it.
      viewStack.pop();
      const next = viewStack[viewStack.length - 1];
      hooks?.applyView(next);
      return;
    }
    // At home. Back just popped our BASE SENTINEL (pushed in connect), so we are
    // still inside the SPA document, not navigated away. Re-push the sentinel so
    // the user stays put, and ask the app to confirm the exit. On confirm the app
    // calls leaveApp(); on cancel the sentinel holds the user here.
    window.history.pushState({ plantryHomeSentinel: true }, "");
    ensureListening();
    hooks?.requestExitConfirm();
  }

  // ---- Wiring (called once by App on mount) ----
  function connect(nextHooks: AppHooks) {
    hooks = nextHooks;
    // Push ONE base sentinel marker immediately so the app always sits one
    // same-document entry above its load entry. Without it, a Back from the bare
    // homepage (before any in-app navigation) would be a cross-document
    // navigation OFF the SPA: the browser would leave to the previous page and
    // popstate would never fire, so the exit-confirm could not show. With the
    // sentinel, that first Back pops the sentinel (a same-document popstate) and
    // lands in the at-home branch above. This is the view-layer analogue of the
    // sheet layer's "always have a marker armed" discipline. Guarded so a
    // StrictMode re-connect does not stack a second sentinel.
    if (!baseSentinelPresent) {
      window.history.pushState({ plantryHomeSentinel: true }, "");
      baseSentinelPresent = true;
    }
    ensureListening();
  }

  function disconnect() {
    hooks = null;
    if (listening) {
      window.removeEventListener("popstate", onPopState);
      listening = false;
    }
  }

  // ---- View layer ----
  // Record a forward view navigation. Push exactly one marker and one logical
  // entry. Called by the app AFTER it has updated its own React state, when the
  // new view differs from the current top (a no-op same-view nav pushes nothing).
  function pushView(view: ViewState) {
    const top = viewStack[viewStack.length - 1];
    if (top && top.tab === view.tab && top.editingDay === view.editingDay) {
      // Same view (e.g. re-tapping the active tab): do not push a duplicate.
      return;
    }
    viewStack.push(view);
    window.history.pushState({ plantryView: true }, "");
    ensureListening();
  }

  // Collapse the view stack back to the homepage base. Used when the app returns
  // to home by a means other than Back (e.g. switching identity, which re-shows
  // the IdentityPicker without unmounting this controller). Any browser markers
  // we pushed for the old views remain in history but are now stale; that is
  // harmless because the dispatcher reads the LIVE viewStack at popstate time,
  // so a stale marker resolves as "at home" (depth 1) and prompts the exit
  // confirm, never applies a defunct view. We do not try to pop those markers:
  // history.back() only pops the top, and racing pops here would re-enter the
  // dispatcher. Keeping state-vs-history loosely coupled (stacks are the truth)
  // is the same discipline the sheet layer uses.
  function resetToHome() {
    viewStack.length = 0;
    viewStack.push({ tab: "Menu", editingDay: null });
  }

  // ---- Sheet layer (PR #78 semantics, marker shared under one listener) ----
  function registerSheet(entry: SheetEntry) {
    sheetStack.push(entry);
    // Push the single sheet marker only when the FIRST sheet opens. A subsequent
    // stacked sheet, or a sibling swap whose deferred pop was cancelled by this
    // very registration, reuses the existing marker.
    if (!sheetMarkerPresent) pushSheetMarker();
  }

  function unregisterSheet(entry: SheetEntry) {
    const idx = sheetStack.indexOf(entry);
    if (idx !== -1) sheetStack.splice(idx, 1);

    if (consumedByPopstate) {
      // Closed because the browser popped our sheet marker. The marker is gone;
      // do not pop again.
      consumedByPopstate = false;
      if (sheetStack.length > 0) {
        // Other sheets remain: re-arm a marker so the next Back is caught.
        pushSheetMarker();
      } else {
        sheetMarkerPresent = false;
      }
      return;
    }

    // Programmatic close (scrim / button / onDone). If the sheet stack is empty
    // now, defer the marker removal: a sibling swap re-registers synchronously
    // before the microtask runs, leaving the stack non-empty and cancelling the
    // pop. Only a genuine last-close stays empty.
    if (sheetStack.length === 0 && sheetMarkerPresent) {
      queueMicrotask(() => {
        if (sheetStack.length === 0 && sheetMarkerPresent && !consumedByPopstate) {
          sheetMarkerPresent = false;
          // Pop our own sheet marker. Guard the resulting popstate so the unified
          // dispatcher does NOT mistake it for a user Back on the view/home layer
          // underneath (which would unwind a tab or pop the exit prompt).
          ignoreNextPop = true;
          window.history.back();
        }
      });
    }
  }

  // ---- Exit ----
  // Best-effort leave. After the at-home Back branch re-pushed the base sentinel,
  // history reads
  //   [ entry-before-app ] [ app load entry ] [ sentinel(current) ]
  // and the app state is still home. To actually leave we go back PAST both the
  // sentinel and the app's own load entry, landing on whatever preceded the app.
  // history.go(-2) does that in one step. In an installed PWA, or a tab whose
  // first history entry is the app itself, there is no entry before the app, so
  // go(-2) clamps to a no-op and the user simply stays on the homepage. We accept
  // that: there is no reliable cross-browser way to force-close a tab the app did
  // not open. No crash, no loop either way.
  function leaveApp() {
    window.history.go(-2);
  }

  // Cancel an at-home exit prompt: nothing to do. The sentinel pushed in the
  // at-home branch already holds the user in place; we keep it so the NEXT Back
  // re-prompts. Exposed for symmetry / clarity at the call site.
  function cancelExit() {
    // No-op by design. The sentinel stays; listener stays armed.
  }

  return {
    connect,
    disconnect,
    pushView,
    resetToHome,
    registerSheet,
    unregisterSheet,
    leaveApp,
    cancelExit,
  };
})();

// A stable sheet id helper so call sites do not duplicate the scheme.
export function makeSheetId(): string {
  return `pt-sheet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Public surface. Sheet uses register/unregister; App uses the view + exit API.
export const sheetHistory = {
  register(closeRef: SheetCloseRef): SheetEntry {
    const entry: SheetEntry = { kind: "sheet", id: makeSheetId(), closeRef };
    backStack.registerSheet(entry);
    return entry;
  },
  unregister(entry: SheetEntry) {
    backStack.unregisterSheet(entry);
  },
};

export const viewHistory = {
  connect: backStack.connect,
  disconnect: backStack.disconnect,
  pushView: backStack.pushView,
  resetToHome: backStack.resetToHome,
  leaveApp: backStack.leaveApp,
  cancelExit: backStack.cancelExit,
};

export type { SheetEntry };
