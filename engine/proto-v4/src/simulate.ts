import type { Dish, MenuHistoryRow, Season } from "../../src/data/schemas.js";
import { generateWeekV4, historyRowsV4 } from "./generateWeekV4.js";
import { addDays } from "./guard.js";
import type { FavoriteInput, Incident, WeekPlan } from "./types.js";

/**
 * The sequential, self-feeding forward simulation.
 *
 * Each generated week's history rows are appended to the running history BEFORE the next
 * week generates, so the frequency window (§3.4 step 2) and the seven-day guard (step 3)
 * see the engine's own output. That feedback is the whole point of the exercise: without
 * it, frequency-first lock-in and drift cannot appear.
 */

/** Bangalore seasons (docs/engine.md §1), keyed on the week's own date. */
export function seasonOf(weekStart: string): Season {
  const month = Number.parseInt(weekStart.slice(5, 7), 10);
  if (month >= 3 && month <= 5) return "Summer";
  if (month >= 6 && month <= 9) return "Monsoon";
  return "Winter";
}

export function mondays(start: string, count: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) out.push(addDays(start, i * 7));
  return out;
}

export interface SimulationArgs {
  library: Dish[];
  /** Seed history: menu_history.md rows plus the finalized app weeks. */
  seedHistory: MenuHistoryRow[];
  startWeek: string;
  weekCount: number;
  favorites: readonly FavoriteInput[];
}

export interface SimulationResult {
  weeks: WeekPlan[];
  incidents: Incident[];
  /** The full history at the end of the run (seed plus every generated week). */
  finalHistory: MenuHistoryRow[];
}

export function runSimulation(args: SimulationArgs): SimulationResult {
  const history: MenuHistoryRow[] = [...args.seedHistory];
  const weeks: WeekPlan[] = [];
  const incidents: Incident[] = [];

  for (const weekStart of mondays(args.startWeek, args.weekCount)) {
    const season = seasonOf(weekStart);
    const result = generateWeekV4({
      library: args.library,
      history,
      weekStart,
      season,
      favorites: args.favorites,
    });
    weeks.push(result.week);
    incidents.push(...result.incidents);
    history.push(...historyRowsV4(result.week));
  }

  return { weeks, incidents, finalHistory: history };
}
