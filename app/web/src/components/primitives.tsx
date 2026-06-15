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

/** Bottom sheet with a scrim. Children scroll if tall. `tall` raises the panel's
 *  max height for the long pickers (swap, add-a-dish) per the handoff's 92%. */
export function Sheet({
  onClose,
  children,
  tall,
}: {
  onClose: () => void;
  children: ReactNode;
  tall?: boolean;
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

  // Browser-Back integration. The app uses no history API anywhere else (tab
  // nav is React state), so on mount each open sheet pushes one marker entry
  // tagged with a unique id; a Back gesture or button pops it, firing popstate,
  // which we treat as a close request. Nested or stacked sheets (swap picker ->
  // confirm, or the Day screen's action -> swap -> reason chain) each push their
  // own entry, so Back closes the topmost sheet first, then the next.
  //
  // `onClose` lives in a ref so this effect runs exactly once per mount (an
  // onClose identity change must not tear down and re-push the marker).
  //
  // Cleanup has two unmount paths:
  //  - Back already popped our marker (popstate fired): the entry is gone, so we
  //    must NOT pop again or we would navigate the real app away.
  //  - Programmatic close (scrim/button/onDone): we pop our marker with
  //    history.back() so history does not accumulate. But when one sheet is
  //    swapped for a SIBLING sheet (e.g. action -> swap), React unmounts the old
  //    Sheet and mounts the new one in the same commit; the new sheet's
  //    pushState runs synchronously during the old sheet's cleanup, so by the
  //    time we would pop, OUR marker is no longer the top entry. We therefore
  //    only pop when our id is still the current history.state, which is true
  //    exactly when no newer sheet has stacked on top of us. The newer sheet
  //    owns the top entry and pops itself when it closes.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const markerIdRef = useRef<string>("");
  if (markerIdRef.current === "") {
    markerIdRef.current = `pt-sheet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
  useEffect(() => {
    const markerId = markerIdRef.current;
    let closedByPopstate = false;
    const onPopState = () => {
      closedByPopstate = true;
      onCloseRef.current();
    };
    window.history.pushState({ plantrySheetId: markerId }, "");
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      const state = window.history.state as { plantrySheetId?: string } | null;
      if (!closedByPopstate && state?.plantrySheetId === markerId) {
        window.history.back();
      }
    };
  }, []);

  return (
    <div className="sheet">
      <button type="button" className="sheet__scrim" aria-label="Close" onClick={onClose} />
      <div
        className={`sheet__panel${tall ? " sheet__panel--tall" : ""}`}
        role="dialog"
        aria-modal="true"
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
      type="text"
      value={value}
      placeholder={placeholder}
      aria-label={placeholder}
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
