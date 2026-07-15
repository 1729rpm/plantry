// Shared UI primitives ported from design_handoff/hifi-primitives.jsx. The
// handoff renders with inline styles reading window.PT; we render real React
// components with CSS classes reading the tokens in index.css. Behaviour is the
// contract, not the prototype's window-global implementation.

import { useEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { Identity } from "../lib/types.js";
import type { ComplexityVariant } from "../lib/library.js";
import { sheetHistory } from "../lib/backStack.js";

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

export type TabKey = "Menu" | "Grocery" | "Explore" | "Yours";

const TABS: TabKey[] = ["Menu", "Grocery", "Explore", "Yours"];

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
  // Yours: a heart (the household's favorites + wishlist). Kept at the 1.5
  // stroke of its three siblings so the tab-icon family reads as one set (the
  // handoff draws every tab icon a touch heavier at 1.7; matching the live
  // siblings wins here).
  Yours: (
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
      <path d="M11 18.5C11 18.5 3.5 14 3.5 8.75A3.75 3.75 0 0 1 11 6.5a3.75 3.75 0 0 1 7.5 2.25C18.5 14 11 18.5 11 18.5Z" />
    </svg>
  ),
};

export function TabBar({
  active,
  onTab,
  wishlistCount = 0,
}: {
  active: TabKey;
  onTab: (tab: TabKey) => void;
  // Count of dishes on the household wishlist, shown as a badge on the Yours
  // tab. Hidden at zero, so an empty wishlist shows the plain tab. The
  // unread-changes nudge is no longer here: it moved onto the Menu-header avatar
  // when the Changes tab became the Yours tab.
  wishlistCount?: number;
}) {
  return (
    <nav className="tab-bar" aria-label="Primary">
      {TABS.map((tab) => {
        const badge = tab === "Yours" && wishlistCount > 0 ? wishlistCount : 0;
        return (
          <button
            key={tab}
            type="button"
            className={`tab-bar__tab${tab === active ? " tab-bar__tab--active" : ""}`}
            aria-current={tab === active ? "page" : undefined}
            onClick={() => onTab(tab)}
          >
            <span className="tab-bar__icon-wrap">
              {TAB_ICONS[tab]}
              {badge > 0 && (
                <span className="tab-bar__badge" aria-hidden="true">
                  {badge}
                </span>
              )}
            </span>
            {tab}
          </button>
        );
      })}
    </nav>
  );
}

// Browser-Back integration for sheets now lives in the unified back-stack
// controller at lib/backStack.ts, which owns the SINGLE popstate listener and
// the SINGLE history-marker discipline for BOTH in-app view navigation (tab
// switches, the Day editor) and the bottom sheets. There must never be a second,
// parallel history system next to it: two independent marker systems is the bug
// class where a deferred history.back() from one closes the other (PR #78). The
// sheet single-marker-for-ALL-stacked-sheets + microtask-deferred-pop semantics
// that keep sibling sheet swaps from self-closing are preserved EXACTLY in
// backStack.ts; read the long comment block there for the model. Sheets here
// just register on mount and unregister on unmount via `sheetHistory`.

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
  noHistory,
}: {
  onClose: () => void;
  children: ReactNode;
  tall?: boolean;
  picker?: boolean;
  // When set, this Sheet does NOT register in the unified back-stack. It is for
  // the terminal exit-confirm prompt, whose lifecycle the App owns directly via
  // the view layer (the at-home Back already pushed a sentinel; the prompt must
  // not also push a sheet marker, or Leave/Stay would have to untangle two
  // layers). Everything else (scrim, scroll lock, focus, layout) is identical.
  noHistory?: boolean;
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
    if (noHistory) return;
    const entry = sheetHistory.register(onCloseRef);
    return () => sheetHistory.unregister(entry);
  }, [noHistory]);

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
        {/* Explicit close affordance. Calls the SAME onClose the scrim uses so it
            unwinds through the unified back-stack (sheetHistory); never a second
            dismissal path or history marker. Sits in the panel's top-right corner
            above the scroll content. */}
        <button type="button" className="sheet__close" aria-label="Close" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path
              d="M4 4 L12 12 M12 4 L4 12"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          </svg>
        </button>
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
