/**
 * Load a v6 record fixture and resolve it against a library.
 *
 * A record fixture is the JSON shape `RecordWeek[]` that stream E1's
 * `recordExport:exportRecord` produces from the prod `currentWeek` table, so a
 * hand-built fixture (`fixtures/record-8weeks.json`, derived from
 * `features/as-eaten-8-weeks.md`) and a real prod export load through exactly the
 * same path. Tests and the §11 gate harness both read fixtures through here.
 *
 * "Resolve against the library" means two things, both of which §2.1 already
 * requires of the record:
 *
 * 1. A pick whose `dishId` the library does not carry contributes no row. §2.1
 *    says this of a custom one-off, which has no library identity; a fixture
 *    naming a dish id that has since left the library is the same case.
 * 2. Weeks come back ascending by `weekStart` and picks in schedule order, so a
 *    fixture is order-independent and two loads of the same file are identical.
 *
 * Nothing here mutates the file or the library, and nothing reads the clock.
 */

import { readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { Dish } from "../../src/data/schemas.js";
import { comparePicks } from "../../src/v6/record.js";
import type { Pick, RecordWeek } from "../../src/v6/types.js";

const here = dirname(fileURLToPath(import.meta.url));
/**
 * Where the checked-in fixtures live, so a caller can name one without a path.
 *
 * The fixtures sit in the source tree only. Vitest loads this module from
 * `engine/test/v6`, and the compiled §11 gate harness loads it from
 * `engine/dist/test/v6`, so the engine root is two levels up from one and four
 * from the other; both then find the same `test/v6/fixtures`.
 */
export const fixturesDir = resolve(
  here,
  here.includes(`${sep}dist${sep}`) ? "../../../test/v6/fixtures" : "fixtures",
);

/** Resolve a bare fixture name (`record-8weeks`) or a path to a readable JSON file. */
export function resolveFixturePath(nameOrPath: string): string {
  if (isAbsolute(nameOrPath) || nameOrPath.includes("/")) return resolve(nameOrPath);
  return resolve(fixturesDir, `${nameOrPath}.json`);
}

function sortPicks(picks: readonly Pick[], known: ReadonlySet<number>): Pick[] {
  return picks
    .filter((pick) => known.has(pick.dishId))
    .map((pick) => ({ day: pick.day, meal: pick.meal, dishId: pick.dishId }))
    .sort(comparePicks);
}

/**
 * Read one record fixture, resolved against `library` and ordered.
 *
 * `nameOrPath` is either a bare fixture name (`"record-8weeks"`) or a path to a
 * JSON file, which is how the gate harness takes a prod export as an argument.
 */
export function loadRecordFixture(nameOrPath: string, library: readonly Dish[]): RecordWeek[] {
  const raw = JSON.parse(readFileSync(resolveFixturePath(nameOrPath), "utf8")) as RecordWeek[];
  if (!Array.isArray(raw)) {
    throw new Error(`record fixture ${nameOrPath} is not an array of record weeks`);
  }
  const known = new Set(library.map((dish) => dish.id));
  return raw
    .map((week) => ({
      weekStart: week.weekStart,
      picks: sortPicks(week.picks ?? [], known),
      skippedDays: [...(week.skippedDays ?? [])].sort(),
      generatedPlan:
        week.generatedPlan === null || week.generatedPlan === undefined
          ? null
          : sortPicks(week.generatedPlan, known),
    }))
    .sort((a, b) => (a.weekStart < b.weekStart ? -1 : a.weekStart > b.weekStart ? 1 : 0));
}
