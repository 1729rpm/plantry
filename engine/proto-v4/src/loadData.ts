import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { dishFilesToLibrary, parseMenuHistory } from "../../src/data/parse.js";
import { loadDishFiles } from "../../scripts/bake.js";
import { MenuHistoryRowSchema, type Dish, type MenuHistoryRow } from "../../src/data/schemas.js";

/**
 * Load the live library and the full seed history for the simulation.
 *
 * Seed history is TWO sources, per the brief:
 *   1. `data/menu_history.md`, the five seed weeks (parsed with the v3 parser).
 *   2. The six finalized in-app weeks, exported to JSON for this exercise. They are used
 *      as given; the archive is not re-derived here.
 */

/**
 * Walk up from this module until a directory containing `data/dishes` appears. The
 * compiled output nests one level deeper than the source, so a fixed number of `..`
 * segments would be wrong in one of the two cases; searching is correct in both.
 */
function findRepoRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 12; i += 1) {
    if (existsSync(resolve(dir, "data", "dishes"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    "loadData: could not locate the repo root (no data/dishes found above this module)",
  );
}

export const dataDir = resolve(findRepoRoot(), "data");

export function loadLibrary(): Dish[] {
  const dishFiles = loadDishFiles(resolve(dataDir, "dishes"));
  return dishFilesToLibrary(dishFiles).dishes;
}

export function loadSeedHistoryFile(): MenuHistoryRow[] {
  return parseMenuHistory(readFileSync(resolve(dataDir, "menu_history.md"), "utf8"));
}

export function loadArchiveHistory(jsonPath: string): MenuHistoryRow[] {
  const raw = JSON.parse(readFileSync(jsonPath, "utf8")) as { rows: unknown[] };
  return raw.rows.map((r) => MenuHistoryRowSchema.parse(r));
}

/**
 * The combined seed history, sorted by (weekStart, then original order within a source)
 * so the run is reproducible regardless of file read order.
 */
export function combinedSeedHistory(archiveJsonPath: string): MenuHistoryRow[] {
  const seed = loadSeedHistoryFile();
  const archive = loadArchiveHistory(archiveJsonPath);
  const all = [...seed, ...archive];
  return all
    .map((row, index) => ({ row, index }))
    .sort((a, b) =>
      a.row.weekStart === b.row.weekStart
        ? a.index - b.index
        : a.row.weekStart < b.row.weekStart
          ? -1
          : 1,
    )
    .map((d) => d.row);
}
