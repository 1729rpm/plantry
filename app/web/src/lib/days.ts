import type { ShortDay, Meal } from "./types.js";

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

export function mealOrderIndex(meal: Meal): number {
  return meal === "breakfast" ? 0 : 1;
}
