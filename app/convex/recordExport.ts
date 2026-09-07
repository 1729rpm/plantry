import { internalQuery } from "./_generated/server.js";
import { v } from "convex/values";
import { loadRecord, type RecordWeek } from "./lib/record.js";

/**
 * A `weekStart` later than any row the table will ever hold, used as the default
 * upper bound so an unqualified export returns the whole record. Rows are ISO
 * dates and compare lexicographically, so "9999-12-31" sorts after every real one.
 */
const AFTER_EVERY_ROW = "9999-12-31";

/**
 * Reads the whole household record out and returns it (`features/engine-v6.md` §2.1).
 *
 * Read-only and internal: not browser-callable, and it writes nothing. Its purpose
 * is the one-time pull that becomes the §11 gate fixture. The EM runs it against
 * prod with Rajat's per-action approval:
 *
 *     npx convex run --prod recordExport:exportRecord '{}'
 *
 * and the JSON that comes back is the record the gate replays the horizon over. It
 * is deliberately the SAME function the engine's own record read goes through
 * (`loadRecord`), so the fixture cannot drift from what generation actually sees:
 * a fixture built by a parallel exporter would be a second definition of "the
 * record" and the two would diverge on the first schema change.
 *
 * `beforeWeekStart` is optional and defaults to a date after every row, so the
 * default is the full record. Passing a Monday returns the record as it stood
 * before that week, which is what a replay of an already-generated week needs.
 */
export const exportRecord = internalQuery({
  args: {
    beforeWeekStart: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<RecordWeek[]> => {
    return loadRecord(ctx, args.beforeWeekStart ?? AFTER_EVERY_ROW);
  },
});
