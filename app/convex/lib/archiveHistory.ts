import type { Doc } from "../_generated/dataModel.js";
import type { MenuHistoryRow } from "@plantry/engine";

/**
 * Flattens collected `weekArchive` docs into engine `MenuHistoryRow`s so a
 * caller can extend the baked seed history (`@plantry/engine/history`, a
 * periodic snapshot) with every week finalized since the last bake. The
 * archive rows already mirror the `MenuHistoryRow` shape (day long-form,
 * meal capitalised), so the flatten is a direct map: `weekStart` comes from
 * the archive doc, the rest from each row.
 *
 * Flatten only, no dedup: the seed ends before the first archived week by
 * construction (finalize appends to the archive; a bake absorbs the archive
 * into the seed), so the two records never overlap. Callers merge as
 * `[...history, ...archiveToHistoryRows(archives)]`.
 *
 * The optional `source` (`features/engine-v4.md` §10.5, §10.7) rides along
 * unchanged, including its absence: a row archived before the field shipped, and
 * every row of the baked seed, carries no source, and the spread below leaves the
 * key off rather than inventing a value. This is the whole path by which the
 * hand-placement signal reaches the engine, so dropping it here would make the
 * stored field dead data.
 */
export function archiveToHistoryRows(archives: Doc<"weekArchive">[]): MenuHistoryRow[] {
  const rows: MenuHistoryRow[] = [];
  for (const archive of archives) {
    for (const row of archive.rows) {
      rows.push({
        weekStart: archive.weekStart,
        day: row.day,
        meal: row.meal,
        dishName: row.dishName,
        dishId: row.dishId,
        ...(row.source !== undefined ? { source: row.source } : {}),
      });
    }
  }
  return rows;
}
