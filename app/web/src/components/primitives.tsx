// Shared UI primitives ported from design_handoff/hifi-primitives.jsx. The
// handoff renders with inline styles reading window.PT; we render real React
// components with CSS classes reading the tokens in index.css. Behaviour is the
// contract, not the prototype's window-global implementation.

import { useEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { Identity } from "../lib/types.js";
import type { ComplexityVariant } from "../lib/library.js";

function identityInitial(who: Identity | string | null | undefined): string {
  if (!who) return "?";
  return who.charAt(0).toUpperCase();
}

export function Avatar({ who, size = 24 }: { who: Identity | string | null; size?: number }) {
  return (
    <span className="avatar" style={{ "--avatar-size": `${size}px` } as CSSProperties}>
      {identityInitial(who)}
    </span>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="section-label">{children}</div>;
}

export function Chip({
  children,
  active,
  onClick,
}: {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button type="button" className={`chip${active ? " chip--active" : ""}`} onClick={onClick}>
      {children}
    </button>
  );
}

/**
 * Dish thumbnail. With a photo URL it renders the image; without one it renders
 * the quiet diagonal-stripe placeholder so partial photo coverage never looks
 * broken (design-revamp §1.6). Today coverage is zero, so the fallback is what
 * every dish shows.
 */
export function Thumb({
  src,
  size = 48,
  alt = "",
}: {
  src: string | null;
  size?: number;
  alt?: string;
}) {
  const style = { "--thumb-size": `${size}px` } as CSSProperties;
  if (src) {
    return <img className="thumb thumb--img" style={style} src={src} alt={alt} />;
  }
  return (
    <span className="thumb thumb--placeholder" style={style} aria-hidden="true">
      +
    </span>
  );
}

export function Card({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={`card${className ? ` ${className}` : ""}`} style={style}>
      {children}
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`btn-primary${className ? ` ${className}` : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export function QuietButton({
  children,
  onClick,
  danger,
  disabled,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`btn-quiet${danger ? " btn-quiet--danger" : ""}${className ? ` ${className}` : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

const COMPLEXITY_CLASS: Record<ComplexityVariant, string> = {
  easy: "complexity-tag--easy",
  medium: "complexity-tag--medium",
  hard: "complexity-tag--hard",
};

export function ComplexityTag({ variant, label }: { variant: ComplexityVariant; label: string }) {
  return <span className={`complexity-tag ${COMPLEXITY_CLASS[variant]}`}>{label}</span>;
}

/** A neutral/soft pill for the non-difficulty dish tags on an Explore card
 *  (prep time, descriptors). Shares the complexity-tag pill shape so the set
 *  reads as one row of pills, but in a quiet neutral fill rather than the
 *  colored difficulty semantics. */
export function MetaTag({ label }: { label: string }) {
  return <span className="meta-tag">{label}</span>;
}

export type TabKey = "Menu" | "Grocery" | "Explore" | "Changes";

const TABS: TabKey[] = ["Menu", "Grocery", "Explore", "Changes"];

// Minimal single-stroke line icons, one per tab. Inline SVG (no icon library, per
// engineering.md §1). Each inherits the tab button's color via currentColor:
// terracotta accent when active, --pt-sub when inactive (see .tab-bar__tab rules
// in index.css), so no per-icon color CSS is needed.
const TAB_ICONS: Record<TabKey, ReactNode> = {
  // Menu: a weekly-plan calendar (this is a Mon-Sat weekly menu planner).
  Menu: (
    <svg
      className="tab-bar__icon"
      viewBox="0 0 22 22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3.5" y="4.5" width="15" height="14" rx="2" />
      <path d="M3.5 8.5h15" />
      <path d="M7.5 3v3M14.5 3v3" />
    </svg>
  ),
  // Grocery: a shopping basket.
  Grocery: (
    <svg
      className="tab-bar__icon"
      viewBox="0 0 22 22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 8.5h14l-1.4 8.2a1.5 1.5 0 0 1-1.48 1.3H6.88a1.5 1.5 0 0 1-1.48-1.3L4 8.5Z" />
      <path d="M8 8.5 10 3.5M14 8.5 12 3.5" />
      <path d="M9 12v2.5M13 12v2.5" />
    </svg>
  ),
  // Explore: a compass (discovery).
  Explore: (
    <svg
      className="tab-bar__icon"
      viewBox="0 0 22 22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7.5" />
      <path d="m14.2 7.8-1.7 4.7-4.7 1.7 1.7-4.7 4.7-1.7Z" />
    </svg>
  ),
  // Changes: a two-arrow swap (in-week dish swaps + queued changes).
  Changes: (
    <svg
      className="tab-bar__icon"
      viewBox="0 0 22 22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 8h10l-2.5-2.5M17 14H7l2.5 2.5" />
    </svg>
  ),
};

export function TabBar({ active, onTab }: { active: TabKey; onTab: (tab: TabKey) => void }) {
  return (
    <nav className="tab-bar" aria-label="Primary">
      {TABS.map((tab) => (
        <button
          key={tab}
          type="button"
          className={`tab-bar__tab${tab === active ? " tab-bar__tab--active" : ""}`}
          aria-current={tab === active ? "page" : undefined}
          onClick={() => onTab(tab)}
        >
          {TAB_ICONS[tab]}
          {tab}
        </button>
      ))}
    </nav>
  );
}

// Browser-Back integration for sheets, owned by ONE module-level controller
// rather than by each Sheet instance.
//
// THE PROBLEM WITH PER-SHEET MARKERS
// ----------------------------------
// The app's overlay is a single state value, so opening a follow-on sheet
// unmounts the current Sheet and mounts the new one in the SAME React commit.
// React runs the unmounting child's cleanup BEFORE the mounting child's setup.
// If each Sheet pushed its own history entry and popped it on cleanup, the old
// sheet's cleanup would call history.back() (its marker is still top), then the
// new sheet would pushState, then the deferred popstate from that back() would
// land on the new sheet and close it. Net: every sheet-to-sheet transition
// closes the freshly opened sheet. You also cannot remove a buried entry
// without disturbing the top one, because history.back() always pops the top.
//
// THE MODEL
// ---------
// There is exactly ONE history marker for "a sheet is open", regardless of how
// many sheets are stacked. The controller keeps a stack of open sheets (each
// with a stable id and a ref to its latest close fn). The marker is pushed when
// the stack goes empty -> non-empty and is removed when the last sheet closes.
//  - A real browser Back fires popstate: we mark the marker consumed and close
//    the TOP sheet. We do not touch history (the browser already popped it). If
//    sheets remain after that sheet unmounts, we re-push one marker so the next
//    Back is still caught.
//  - A programmatic close (scrim / button / onDone) that empties the stack pops
//    our marker with history.back(), but DEFERRED via queueMicrotask: on a
//    sibling swap the old sheet unregisters (stack transiently empty) and the
//    new sheet registers synchronously right after, before the microtask runs,
//    so the deferred check sees a non-empty stack and does NOT pop. Only a
//    genuine last-close leaves the stack empty when the microtask runs.
type SheetCloseRef = { current: () => void };
type SheetEntry = { id: string; closeRef: SheetCloseRef };

const sheetHistory = (() => {
  const stack: SheetEntry[] = [];
  let markerPresent = false;
  let listening = false;
  // Set when a popstate (real browser Back) consumed our marker, so the close it
  // triggers is distinguished from a programmatic close during unregister.
  let consumedByPopstate = false;

  function onPopState() {
    consumedByPopstate = true;
    const top = stack[stack.length - 1];
    if (top) top.closeRef.current();
  }

  function addMarker() {
    window.history.pushState({ plantrySheet: true }, "");
    markerPresent = true;
    if (!listening) {
      window.addEventListener("popstate", onPopState);
      listening = true;
    }
  }

  function removeListener() {
    if (listening) {
      window.removeEventListener("popstate", onPopState);
      listening = false;
    }
  }

  function register(entry: SheetEntry) {
    stack.push(entry);
    // Push the single marker only when the FIRST sheet opens. If a marker is
    // already present (subsequent stacked sheet, or a sibling swap whose
    // deferred pop was cancelled by this very registration), do not push again.
    if (!markerPresent) addMarker();
  }

  function unregister(entry: SheetEntry) {
    const idx = stack.indexOf(entry);
    if (idx !== -1) stack.splice(idx, 1);

    if (consumedByPopstate) {
      // This sheet closed because the browser popped our marker. The marker is
      // already gone from history; do not pop again.
      consumedByPopstate = false;
      if (stack.length > 0) {
        // Other sheets remain open: re-arm a marker so the next Back is caught.
        addMarker();
      } else {
        markerPresent = false;
        removeListener();
      }
      return;
    }

    // Programmatic close (scrim / button / onDone). If the stack is empty now,
    // defer the marker removal: a sibling swap will re-register synchronously
    // before the microtask runs, leaving the stack non-empty and cancelling the
    // pop. Only a genuine last-close stays empty.
    if (stack.length === 0 && markerPresent) {
      queueMicrotask(() => {
        if (stack.length === 0 && markerPresent && !consumedByPopstate) {
          markerPresent = false;
          removeListener();
          window.history.back();
        }
      });
    }
  }

  return { register, unregister };
})();

/** Bottom sheet with a scrim. Children scroll if tall. `tall` raises the panel's
 *  max height for the long pickers (swap, add-a-dish) per the handoff's 92%.
 *  `picker` pins the panel to a STABLE height so the search pickers do not
 *  resize as their result count changes; the results list scrolls inside it
 *  instead. Non-picker sheets (reason dialog, dish actions) keep sizing to their
 *  content. */
export function Sheet({
  onClose,
  children,
  tall,
  picker,
}: {
  onClose: () => void;
  children: ReactNode;
  tall?: boolean;
  picker?: boolean;
}) {
  // Lock background scroll while a sheet is open so the page behind the scrim
  // cannot scroll. Save and restore the prior inline value so nested sheets
  // (sheet-over-sheet, e.g. dish actions -> reason dialog) restore correctly:
  // the inner sheet sees "hidden" already set, saves it, and restores it on
  // unmount, leaving the outer sheet's lock intact.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Browser-Back integration. Register this sheet with the single module-level
  // controller on mount, unregister on unmount. `onClose` lives in a ref so the
  // controller always calls the latest close fn and an onClose identity change
  // does not re-register the sheet (which would push a duplicate marker).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const entry: SheetEntry = {
      id: `pt-sheet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      closeRef: onCloseRef,
    };
    sheetHistory.register(entry);
    return () => sheetHistory.unregister(entry);
  }, []);

  // Move focus into the sheet panel on open so keyboard and screen-reader focus
  // follows the modal (engineering.md §16 invariant). Not a full focus trap: we
  // only move focus IN, and only if nothing inside the panel already holds it,
  // so sheets with an autoFocus search field / textarea keep that focus.
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) {
      panel.focus();
    }
  }, []);

  return (
    <div className="sheet">
      <button type="button" className="sheet__scrim" aria-label="Close" onClick={onClose} />
      <div
        ref={panelRef}
        className={`sheet__panel${tall ? " sheet__panel--tall" : ""}${picker ? " sheet__panel--picker" : ""}`}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
      >
        <div className="sheet__grabber" />
        <div className="sheet__scroll">{children}</div>
      </div>
    </div>
  );
}

/** Stat tile used in the dish details sheet header (protein / ratio / time). */
export function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-chip">
      <div className="stat-chip__label">{label}</div>
      <div className="stat-chip__value">{value}</div>
    </div>
  );
}

/** Search input used by the swap picker and add-a-dish sheet. */
export function SearchField({
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <input
      className="search-field"
      // type="search" plus the off switches below keep iOS from reading this as
      // a username / contact / credential field and floating its AutoFill /
      // key / credit-card toolbar over the dish list. The name is a plain
      // non-credential token so iOS heuristics never match it to a saved login.
      type="search"
      name="dish-search"
      value={value}
      placeholder={placeholder}
      aria-label={placeholder}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="none"
      spellCheck={false}
      enterKeyHint="search"
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
