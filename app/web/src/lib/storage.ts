// Local-storage keys and small typed helpers for slice 1 of Stream D.
// All values are scoped under the `plantry:` prefix so future features can grep.

import type { Identity } from "./types.js";
import type { CachedWeek } from "./types.js";

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
