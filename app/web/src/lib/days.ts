import type { Meal, ShortDay, SlotMeal } from "./types.js";

// The Convex schema stores currentWeek.slots[].day in short form ("Mon"..."Sat")
// because that's the live-plan format; weekArchive uses the full-word form to
// match menu_history.md. The view renders full words, so we translate here.
const DAY_LABELS: Record<ShortDay, string> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
};

const DAY_ORDER: ShortDay[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function dayLabel(day: ShortDay): string {
  return DAY_LABELS[day];
}

export function dayOrderIndex(day: ShortDay): number {
  return DAY_ORDER.indexOf(day);
}

export function mealLabel(meal: Meal): string {
  return meal === "breakfast" ? "Breakfast" : "Lunch";
}

// Order within a day card: breakfast then lunch. On Saturday (no breakfast) it
// reads lunch alone.
export function mealOrderIndex(meal: Meal): number {
  return meal === "breakfast" ? 0 : 1;
}

/**
 * Is this stored slot one the app renders? A `currentWeek` generated before the
 * Fruit of the day was removed (`features/engine-v4.md` §14) still holds
 * `meal:"fruit"` slots and the Convex schema still admits them, so every surface
 * that iterates `week.slots` filters through this rather than assuming the meal
 * is breakfast or lunch.
 */
export function isRenderableSlotMeal(meal: SlotMeal): meal is Meal {
  return meal === "breakfast" || meal === "lunch";
}

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const LONG_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// weekStart is an ISO date string for the Monday of the week (e.g. "2026-06-15").
// We parse it as a local calendar date (split, not Date(string), to avoid the
// UTC-midnight shift that can land the badge on the wrong day in IST).
function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map((n) => Number.parseInt(n, 10));
  return new Date(y, (m || 1) - 1, d || 1);
}

export interface DayDate {
  /** Day-of-month number, e.g. 15. */
  num: number;
  /** Three-letter month, e.g. "Jun". */
  month: string;
}

/** The calendar date for a short day within the week starting at weekStart. */
export function dayDate(weekStart: string, day: ShortDay): DayDate {
  const monday = parseISODate(weekStart);
  const offset = dayOrderIndex(day);
  const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + offset);
  return { num: date.getDate(), month: SHORT_MONTHS[date.getMonth()] };
}

/** How a day sits relative to the device's current local date. */
export type DayStatus = "past" | "today" | "upcoming";

/**
 * Classify a day within the week against the device's current local date.
 * The day's calendar date is resolved with the same local-date pattern as
 * `dayDate` (split parse, not Date(string), to avoid the IST UTC-midnight
 * shift), then compared by calendar day, not by clock time: a day earlier in
 * the local calendar is "past", the device's own date is "today", and any later
 * date is "upcoming". `new Date()` (real device clock) is the reference, so the
 * Menu collapses the days already eaten and keeps today and the rest open.
 */
export function dayStatus(weekStart: string, day: ShortDay): DayStatus {
  const monday = parseISODate(weekStart);
  const offset = dayOrderIndex(day);
  const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + offset);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (dayMidnight.getTime() < today.getTime()) return "past";
  if (dayMidnight.getTime() === today.getTime()) return "today";
  return "upcoming";
}

/** Human range for the week header, e.g. "Jun 15 to 20" or "Jun 30 to Jul 4". */
export function weekRangeLabel(weekStart: string): string {
  const monday = parseISODate(weekStart);
  const saturday = new Date(
    monday.getFullYear(),
    monday.getMonth(),
    monday.getDate() + dayOrderIndex("Sat"),
  );
  const startMonth = SHORT_MONTHS[monday.getMonth()];
  const endMonth = SHORT_MONTHS[saturday.getMonth()];
  if (startMonth === endMonth) {
    return `${startMonth} ${monday.getDate()} to ${saturday.getDate()}`;
  }
  return `${startMonth} ${monday.getDate()} to ${endMonth} ${saturday.getDate()}`;
}

/**
 * Full-month range for the Menu brand subtitle, e.g. "June 15 to June 20".
 * Both endpoints carry their full month name (so a month-crossing week reads
 * "June 29 to July 4"); the literal word "to" joins them (no dash, per the
 * user-facing copy rule). The caller appends the trailing " menu".
 */
export function weekRangeLabelLong(weekStart: string): string {
  const monday = parseISODate(weekStart);
  const saturday = new Date(
    monday.getFullYear(),
    monday.getMonth(),
    monday.getDate() + dayOrderIndex("Sat"),
  );
  const startMonth = LONG_MONTHS[monday.getMonth()];
  const endMonth = LONG_MONTHS[saturday.getMonth()];
  return `${startMonth} ${monday.getDate()} to ${endMonth} ${saturday.getDate()}`;
}
