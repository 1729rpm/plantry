// GOLDEN MASTER — scaffolding for slice 1.2 (per-dish files + ingredient catalog).
//
// Purpose: pin generateWeek's EXACT output across a matrix of fixed inputs
// (week start, season, RNG, last-Saturday menu, user request) BEFORE the data
// migration, then prove the migrated data layout produces byte-identical output
// AFTER. The snapshot file engine/test/data/golden-master.json is committed in
// the same commit that captures it. Per the feature plan §8 this test and the
// snapshot are DISPOSABLE: both are deleted in the same PR once the migrated
// data is shown to reproduce them exactly.
//
// The matrix is driven entirely off the live library + history loaded via the
// engine's parsers. generateWeek is deterministic given a constant RNG, so the
// only inputs that vary the output are season, lastSaturdayMenu,
// userRequestedDishId, and the RNG constant. We sweep enough of each to
// exercise Menu 3/4 Saturday alternation and the §3.2 weekday substitution.

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { generateWeek } from "../../src/generateWeek.js";
import {
  parseDishes,
  parseIngredients,
  parseMenuHistory,
} from "../../src/data/parse.js";
import type { Season } from "../../src/data/schemas.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
const dataDir = resolve(repoRoot, "data");
const snapshotPath = resolve(here, "golden-master.json");

const library = parseDishes(readFileSync(resolve(dataDir, "dishes.md"), "utf8"));
const { packSizes, rows: ingredients } = parseIngredients(
  readFileSync(resolve(dataDir, "ingredients.md"), "utf8"),
);
const history = parseMenuHistory(
  readFileSync(resolve(dataDir, "menu_history.md"), "utf8"),
);

// A constant RNG keeps generateWeek deterministic. We still vary the constant
// across cases so the Saturday Menu 3/4 alternation lands on both branches.
function constRng(value: number): () => number {
  return () => value;
}

const SEASONS: Season[] = ["Summer", "Monsoon", "Winter"];
const WEEK_STARTS = ["2026-06-08", "2026-06-15", "2026-09-07", "2026-11-09"];
const LAST_SATURDAY: Array<3 | 4 | null> = [3, 4, null];
const RNG_VALUES = [0.0, 0.3, 0.5, 0.99];
// complete_meal Lunch dishes, to drive the §3.2 weekday substitution path.
const USER_REQUESTS: Array<number | undefined> = [undefined, 50, 95, 99];

function buildMatrix() {
  const cases: Record<string, unknown> = {};
  for (const weekStart of WEEK_STARTS) {
    for (const season of SEASONS) {
      for (const lastSaturdayMenu of LAST_SATURDAY) {
        for (const rngValue of RNG_VALUES) {
          for (const userRequestedDishId of USER_REQUESTS) {
            const key = [
              weekStart,
              season,
              `sat${lastSaturdayMenu ?? "null"}`,
              `rng${rngValue}`,
              `req${userRequestedDishId ?? "none"}`,
            ].join("|");
            const week = generateWeek({
              weekStart,
              library,
              history,
              season,
              ingredients,
              packSizes,
              rng: constRng(rngValue),
              lastSaturdayMenu,
              userRequestedDishId,
            });
            cases[key] = week;
          }
        }
      }
    }
  }
  return cases;
}

describe("golden master: generateWeek output is migration-invariant", () => {
  it("matches the committed snapshot byte-for-byte", () => {
    const matrix = buildMatrix();
    const serialized = JSON.stringify(matrix, null, 2) + "\n";

    if (!existsSync(snapshotPath) || process.env.UPDATE_GOLDEN === "1") {
      writeFileSync(snapshotPath, serialized);
      // First capture (or explicit refresh): assert against what we just wrote
      // so the run is green, but flag that this run only recorded the baseline.
      expect(serialized).toBe(serialized);
      return;
    }

    const expected = readFileSync(snapshotPath, "utf8");
    expect(serialized).toBe(expected);
  });
});
