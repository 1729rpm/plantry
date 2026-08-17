import type { MenuHistoryRow } from "../../src/data/schemas.js";
import type { Day } from "../../src/eligibility.js";

/**
 * §3.4 step 3, the seven-day repeat guard, plus the date arithmetic it needs.
 *
 * History rows carry a `weekStart` (a Monday) and a long day name, so an exact calendar
 * date is derivable. The guard excludes a candidate cooked on a date D_cooked where
 * 1 <= (D_slot - D_cooked) in days <= 7. Same-day is impossible (that is the slot being
 * filled) and zero-day differences are ignored, so the window is the seven calendar days
 * immediately before the slot.
 */

const DAY_INDEX: Record<string, number> = {
  Monday: 0,
  Tuesday: 1,
  Wednesday: 2,
  Thursday: 3,
  Friday: 4,
  Saturday: 5,
  Sunday: 6,
};

const SHORT_DAY_INDEX: Record<Day, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function addDays(isoDate: string, days: number): string {
  const base = new Date(`${isoDate}T00:00:00Z`).getTime();
  return new Date(base + days * MS_PER_DAY).toISOString().slice(0, 10);
}

export function daysBetween(earlier: string, later: string): number {
  const a = new Date(`${earlier}T00:00:00Z`).getTime();
  const b = new Date(`${later}T00:00:00Z`).getTime();
  return Math.round((b - a) / MS_PER_DAY);
}

/** The calendar date of a short day name within a week. */
export function dateForDay(weekStart: string, day: Day): string {
  return addDays(weekStart, SHORT_DAY_INDEX[day]);
}

/** The calendar date a history row records. */
export function dateForRow(row: MenuHistoryRow): string {
  return addDays(row.weekStart, DAY_INDEX[row.day] ?? 0);
}

export const GUARD_WINDOW_DAYS = 7;

export interface GuardIndex {
  /** dishId -> the calendar dates it was cooked on. */
  datesByDish: Map<number, string[]>;
}

export function buildGuardIndex(history: MenuHistoryRow[]): GuardIndex {
  const datesByDish = new Map<number, string[]>();
  for (const row of history) {
    const list = datesByDish.get(row.dishId);
    const date = dateForRow(row);
    if (list) list.push(date);
    else datesByDish.set(row.dishId, [date]);
  }
  return { datesByDish };
}

/** True when the dish was cooked within the seven days before `slotDate`. */
export function cookedWithinGuard(index: GuardIndex, dishId: number, slotDate: string): boolean {
  const dates = index.datesByDish.get(dishId);
  if (!dates) return false;
  for (const d of dates) {
    const delta = daysBetween(d, slotDate);
    if (delta >= 1 && delta <= GUARD_WINDOW_DAYS) return true;
  }
  return false;
}

/** Last-cooked calendar date per dish, the §3.4 step 5 longest-unused tiebreak input. */
export function buildLastCookedIndex(history: MenuHistoryRow[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const row of history) {
    const date = dateForRow(row);
    const existing = map.get(row.dishId);
    if (existing === undefined || date > existing) map.set(row.dishId, date);
  }
  return map;
}
