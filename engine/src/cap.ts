import type { Dish, Satiety } from "./data/schemas.js";
import type { Day } from "./eligibility.js";

/**
 * Structural role of a pick within its meal form (§3), threaded from the
 * composition/pick functions (generateWeek) so the §9 cap can be role-aware:
 * it drops companion sides before the protected carb and protein main. Keyed
 * on structure, never on dish names.
 */
export type PickRole =
  | "protein-main"
  | "dal"
  | "sabzi"
  | "carb"
  | "accompaniment"
  | "dessert"
  | "breakfast-main"
  | "breakfast-accompaniment"
  | "protein-floor";

/**
 * The §9 droppable roles: the companion sides the cap removes first. Everything
 * else (carb, protein-main, dal, breakfast-main, breakfast-accompaniment,
 * protein-floor) is protected and is never dropped while any droppable side
 * remains on the day.
 */
const DROPPABLE_ROLES: ReadonlySet<PickRole> = new Set<PickRole>([
  "sabzi",
  "accompaniment",
  "dessert",
]);

/**
 * A single picked item in the week-in-progress. §9 reads a dish's Satiety and
 * Prep Min, plus its structural `role` (when known) to drop companion sides
 * before the protected carb/protein-main. `role` is optional so a plain Dish is
 * still a valid SlotPick: a role-free pick is never a preferred drop, so a
 * role-free day falls back to the satiety-only ordering (the original §9
 * behavior), which is what the cap unit tests exercise.
 */
export interface SlotPick extends Dish {
  role?: PickRole;
}

/** docs/engine.md §9 ("5 items per weekday"). */
export const WEEKDAY_CAP = 5;
/** docs/engine.md §9 ("3 on Saturday"). */
export const SATURDAY_CAP = 3;

const WEEKDAYS: ReadonlySet<Day> = new Set<Day>([
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
]);

const SATIETY_RANK: Record<Satiety, number> = {
  Low: 0,
  Medium: 1,
  High: 2,
};

export interface ApplyCapArgs {
  slotsByDay: Map<Day, SlotPick[]>;
}

export interface ApplyCapResult {
  slotsByDay: Map<Day, SlotPick[]>;
  droppedDishIds: number[];
}

/**
 * Per-day item cap from docs/engine.md §9. When a day exceeds its cap, drop
 * dishes one at a time, role-aware:
 *   1. Drop only droppable companion sides (sabzi / accompaniment / dessert)
 *      while any remain; the carb, protein-main, breakfast-main, dal, the
 *      breakfast chutney, and the protein floor are protected.
 *   2. Among the droppable sides, drop the lowest Satiety, then the longest
 *      Prep Min.
 *   3. Fallback (rare): if the day is still over cap with no droppable side
 *      left, drop the §9-worst pick overall (lowest Satiety, longest Prep Min)
 *      so the day still resolves.
 * Tie-break beyond §9: when two candidates share both Satiety and Prep Min, the
 * one later in the day's array is dropped (earlier slots' picks win). This is
 * stable: a day at or below its cap is returned unchanged. A day whose picks
 * carry no role (the cap unit tests) has no droppable set, so it goes straight
 * to the fallback, reproducing the original satiety-only behavior. Sunday, if
 * present, is passed through; §2 schedule emits no Sunday slots so this is
 * defensive.
 */
export function applyCap(args: ApplyCapArgs): ApplyCapResult {
  const out = new Map<Day, SlotPick[]>();
  const droppedDishIds: number[] = [];

  for (const [day, picks] of args.slotsByDay) {
    const cap = capForDay(day);
    if (cap === null || picks.length <= cap) {
      out.set(day, [...picks]);
      continue;
    }
    const { kept, dropped } = trimToCap(picks, cap);
    out.set(day, kept);
    for (const dish of dropped) {
      droppedDishIds.push(dish.id);
    }
  }

  return { slotsByDay: out, droppedDishIds };
}

/** Returns the per-day cap, or null for days without an enforced cap (Sun). */
function capForDay(day: Day | string): number | null {
  if (WEEKDAYS.has(day as Day)) return WEEKDAY_CAP;
  if (day === "Sat") return SATURDAY_CAP;
  return null;
}

/**
 * Repeatedly drop the worst pick until length is at the cap. "Worst" per §9 is
 * role-aware: a droppable companion side (sabzi/accompaniment/dessert) is always
 * preferred over a protected pick (carb/protein-main/...); within whichever set
 * we are dropping from, lowest Satiety, then longest Prep Min, then the latest
 * position in the current array (stable for earlier picks).
 */
function trimToCap(
  picks: readonly SlotPick[],
  cap: number,
): { kept: SlotPick[]; dropped: SlotPick[] } {
  const working: SlotPick[] = [...picks];
  const dropped: SlotPick[] = [];
  while (working.length > cap) {
    const dropIndex = pickDropIndex(working);
    dropped.push(working[dropIndex]);
    working.splice(dropIndex, 1);
  }
  return { kept: working, dropped };
}

function isDroppable(pick: SlotPick): boolean {
  return pick.role !== undefined && DROPPABLE_ROLES.has(pick.role);
}

/**
 * Index of the pick to drop next per §9. Considers the droppable companion
 * sides first (sabzi/accompaniment/dessert); only when none remain does it fall
 * back to scanning every pick, so the carb and protein-main are protected while
 * any side is still on the day. Within the candidate set it keeps the worst-so-
 * far: lower satiety, or equal satiety with longer prepMinutes, or both equal
 * with a later array position (the original §9 ordering is silent on the final
 * tie so we lock it here and document it inline).
 */
function pickDropIndex(picks: readonly SlotPick[]): number {
  const droppable: number[] = [];
  for (let i = 0; i < picks.length; i += 1) {
    if (isDroppable(picks[i])) droppable.push(i);
  }
  const candidates = droppable.length > 0 ? droppable : picks.map((_, i) => i);
  let worstIndex = candidates[0];
  for (const i of candidates) {
    if (isWorse(picks[i], picks[worstIndex])) {
      worstIndex = i;
    }
  }
  return worstIndex;
}

function isWorse(a: SlotPick, b: SlotPick): boolean {
  const sa = SATIETY_RANK[a.satiety];
  const sb = SATIETY_RANK[b.satiety];
  if (sa !== sb) return sa < sb;
  if (a.prepMinutes !== b.prepMinutes) return a.prepMinutes > b.prepMinutes;
  // Equal on both §9 criteria: prefer to drop the later one (keep earlier slots).
  // Returning true here means "a is worse than b" so the scan replaces b with a
  // whenever we see an equal candidate later in the array.
  return true;
}
