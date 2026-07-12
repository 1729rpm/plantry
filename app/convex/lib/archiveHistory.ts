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
      });
    }
  }
  return rows;
}
