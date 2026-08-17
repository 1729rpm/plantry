import type { MenuHistoryRow } from "../../src/data/schemas.js";

/**
 * §3.4 step 2 frequency-first ranking, and its window.
 *
 * D3 fixes the window at "the 10 most recent week-records in history, not season-scoped".
 * A week-record is one `weekStart`; the window is therefore the 10 highest distinct
 * `weekStart` values present, and the count is the number of history ROWS in that window
 * naming the dish. See run-notes.md for why rows (not weeks) is the counting unit.
 */

export const FREQUENCY_WINDOW_WEEKS = 10;

export interface FrequencyIndex {
  /** dishId -> eaten count inside the window. Absent means zero. */
  counts: Map<number, number>;
  /** The weekStarts the window covers, newest first. */
  windowWeeks: string[];
}

export function buildFrequencyIndex(
  history: MenuHistoryRow[],
  windowWeeks: number = FREQUENCY_WINDOW_WEEKS,
): FrequencyIndex {
  const weeks = [...new Set(history.map((r) => r.weekStart))].sort().reverse();
  const window = weeks.slice(0, windowWeeks);
  const inWindow = new Set(window);
  const counts = new Map<number, number>();
  for (const row of history) {
    if (!inWindow.has(row.weekStart)) continue;
    counts.set(row.dishId, (counts.get(row.dishId) ?? 0) + 1);
  }
  return { counts, windowWeeks: window };
}

export function eatenCount(index: FrequencyIndex, dishId: number): number {
  return index.counts.get(dishId) ?? 0;
}
