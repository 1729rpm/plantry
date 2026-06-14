// Shared UI primitives ported from design_handoff/hifi-primitives.jsx. The
// handoff renders with inline styles reading window.PT; we render real React
// components with CSS classes reading the tokens in index.css. Behaviour is the
// contract, not the prototype's window-global implementation.

import { useEffect } from "react";
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

export type TabKey = "Menu" | "Grocery" | "Explore" | "Changes";

const TABS: TabKey[] = ["Menu", "Grocery", "Explore", "Changes"];

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
          <span className="tab-bar__dot" />
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
