import { query } from "../_generated/server.js";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel.js";

/**
 * Returns all `manualChanges` rows whose status is `"queued"`, sorted by
 * `createdAt` ascending. Consumed by the `/maintain` signals pass as fuel for
 * rule redesign alongside queued dislikes and open incidents (see
 * `features/manual-changes.md` and `.claude/skills/maintain/passes/signals.md`).
 */
export const listQueuedManualChanges = query({
  args: {},
  handler: async (ctx): Promise<Doc<"manualChanges">[]> => {
    const queued = await ctx.db
      .query("manualChanges")
      .withIndex("by_status", (q) => q.eq("status", "queued"))
      .collect();
    queued.sort((a, b) => a.createdAt - b.createdAt);
    return queued;
  },
});

/**
 * Returns every `manualChanges` row of ANY status whose `weekStart` falls in the
 * inclusive range `[fromWeekStart, toWeekStart]`, sorted by `weekStart` then
 * `createdAt` ascending. Both bounds are ISO Mondays, which sort lexicographically
 * in date order, so the `by_weekStart` index range is the date range.
 *
 * Status-blind on purpose. The `/maintain` health pass reads the swap rows of the
 * trailing eight served weeks for its two swap measures
 * (`.claude/skills/maintain/passes/health.md`), and by then the older weeks in that
 * window have usually been consumed by a slow-loop sitting, so a queued-only read
 * sees only the most recent weeks. Callers that want one status filter after the
 * fetch; `listQueuedManualChanges` stays the queued-only read the signals pass uses.
 */
export const listManualChangesByWeek = query({
  args: {
    fromWeekStart: v.string(),
    toWeekStart: v.string(),
  },
  handler: async (ctx, args): Promise<Doc<"manualChanges">[]> => {
    const rows = await ctx.db
      .query("manualChanges")
      .withIndex("by_weekStart", (q) =>
        q.gte("weekStart", args.fromWeekStart).lte("weekStart", args.toWeekStart),
      )
      .collect();
    rows.sort((a, b) =>
      a.weekStart === b.weekStart ? a.createdAt - b.createdAt : a.weekStart < b.weekStart ? -1 : 1,
    );
    return rows;
  },
});
