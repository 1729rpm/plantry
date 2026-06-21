// Local-storage keys and small typed helpers for slice 1 of Stream D.
// All values are scoped under the `plantry:` prefix so future features can grep.

import type { Identity } from "./types.js";
import type { CachedWeek, ShortDay } from "./types.js";

const AUTH_KEY = "plantry:auth";
const IDENTITY_KEY = "plantry:identity";
// Bumped from `plantry:lastWeek` when the WeekSlot shape changed to a
// position-ordered `dishes[]` list. Old caches are silently ignored on read
// rather than crashing the render that expected the new shape.
const CACHED_WEEK_KEY = "plantry:lastWeek:v2";
const DEVICE_ID_KEY = "plantry:deviceId";
// Per-identity high-water mark for the Changes nav-badge unread counter: the
// largest manualChanges `createdAt` the viewer had already seen on the Changes
// tab. Keyed by identity so a shared device tracks each person's seen-state
// independently. See getChangesSeenAt / setChangesSeenAt below.
const CHANGES_SEEN_AT_PREFIX = "plantry:changesSeenAt:";
// The household's explicit Grocery day selection, persisted so it survives a
// page switch or an app-background eviction (the Grocery component otherwise
// loses its in-memory selection on unmount and reverts to the time-aware
// default). A single key holds `{ weekStart, days }`; reads for a different
// weekStart are ignored (last week's days could now be past or skipped, so they
// must not carry forward — the screen falls back to the time-aware default).
const GROCERY_DAYS_KEY = "plantry:groceryDays";

// Auth timeout: a week. Chosen because both phones live with their owner and
// a personal household app doesn't need session security beyond that.
const AUTH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface AuthRecord {
  passedAt: number;
}

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // localStorage may be disabled (private mode); fall through silently.
  }
}

function safeRemove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function isAuthValid(): boolean {
  const raw = safeGet(AUTH_KEY);
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as AuthRecord;
    if (typeof parsed.passedAt !== "number") return false;
    return Date.now() - parsed.passedAt < AUTH_TTL_MS;
  } catch {
    return false;
  }
}

export function markAuthPassed(): void {
  const record: AuthRecord = { passedAt: Date.now() };
  safeSet(AUTH_KEY, JSON.stringify(record));
}

export function getIdentity(): Identity | null {
  const raw = safeGet(IDENTITY_KEY);
  if (raw === "rajat" || raw === "tuhina") return raw;
  return null;
}

export function setIdentity(identity: Identity): void {
  safeSet(IDENTITY_KEY, identity);
}

export function clearIdentity(): void {
  safeRemove(IDENTITY_KEY);
}

// The largest manualChanges `createdAt` (a Convex server timestamp, ms) the
// given identity has already seen on the Changes tab. Absent / unparseable
// reads as 0, so pre-existing other-author changes count as unseen on first
// open. Keyed per identity (CHANGES_SEEN_AT_PREFIX + identity).
export function getChangesSeenAt(identity: Identity): number {
  const raw = safeGet(CHANGES_SEEN_AT_PREFIX + identity);
  if (!raw) return 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function setChangesSeenAt(identity: Identity, ms: number): void {
  safeSet(CHANGES_SEEN_AT_PREFIX + identity, String(ms));
}

interface GroceryDaysRecord {
  weekStart: string;
  days: ShortDay[];
}

const SHORT_DAYS: ReadonlySet<string> = new Set([
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
]);

// The household's explicit Grocery day selection for `weekStart`, or null when
// nothing is stored, the stored entry is for a different week, or the payload is
// malformed. Null means "no explicit choice" so the caller keeps using the
// time-aware default. The returned days are de-duplicated and validated against
// the ShortDay set; the caller still filters them against the currently
// selectable chips (a stored day may since have become past or skipped).
export function getGroceryDays(weekStart: string): ShortDay[] | null {
  const raw = safeGet(GROCERY_DAYS_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as GroceryDaysRecord;
    if (!parsed || parsed.weekStart !== weekStart || !Array.isArray(parsed.days)) {
      return null;
    }
    const days = parsed.days.filter(
      (d, i): d is ShortDay =>
        typeof d === "string" && SHORT_DAYS.has(d) && parsed.days.indexOf(d) === i,
    );
    return days;
  } catch {
    return null;
  }
}

// Persist the household's explicit Grocery day selection for `weekStart`. A
// single key is reused across weeks (the weekStart guard on read makes a stale
// entry inert), so this never accumulates per-week keys. Persisting an empty
// array is valid: it records "the user explicitly cleared the selection" so the
// screen does not silently re-apply the default over it.
export function setGroceryDays(weekStart: string, days: ShortDay[]): void {
  const record: GroceryDaysRecord = { weekStart, days };
  safeSet(GROCERY_DAYS_KEY, JSON.stringify(record));
}

export function getCachedWeek(): CachedWeek | null {
  const raw = safeGet(CACHED_WEEK_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CachedWeek;
  } catch {
    return null;
  }
}

export function setCachedWeek(week: CachedWeek): void {
  safeSet(CACHED_WEEK_KEY, JSON.stringify(week));
}

// Stable per-device identifier used as the upsert key for the Convex
// `userProfiles` row. Generated once on first load and reused on every
// subsequent visit. `crypto.randomUUID` is preferred (RFC 4122 v4); we
// fall back to a Math.random-based 16-char string if it's unavailable
// (older Safari without secure context, e.g. http://localhost over LAN).
export function getOrCreateDeviceId(): string {
  const existing = safeGet(DEVICE_ID_KEY);
  if (existing && existing.length > 0) return existing;
  const fresh = generateDeviceId();
  safeSet(DEVICE_ID_KEY, fresh);
  return fresh;
}

function generateDeviceId(): string {
  const c = typeof crypto !== "undefined" ? crypto : undefined;
  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }
  let out = "";
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 16; i++) {
    out += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return out;
}
