import { internalMutation } from "./_generated/server.js";

/**
 * One-shot data migration for retiring "Save for next week"
 * (`features/wishlist-favorites-v2` §5.3). Convex validates every existing row
 * against the schema on deploy and refuses to drop a non-empty table, so the
 * deprecated rows must be gone BEFORE the follow-up PR removes the `nextWeekQueue`
 * table and the `save_next_week` change-kind. This mutation clears both:
 *
 *   1. every `nextWeekQueue` row (the retired save queue), and
 *   2. every `manualChanges` row whose `changeKind === "save_next_week"` (the
 *      deprecated-concept history; Decision 3 wipes, it does not rewrite).
 *
 * It is internal (run via `npx convex run`, EM-gated on prod) and a throwaway,
 * deleted in the same follow-up PR that drops the table and the enum literal. It is
 * idempotent: a second run finds nothing left and returns zero counts, so re-running
 * is a safe no-op. The returned counts let the operator confirm the wipe landed
 * before deploying the schema removal.
 */
export const wipeNextWeekData = internalMutation({
  args: {},
  handler: async (
    ctx,
  ): Promise<{ nextWeekQueueDeleted: number; saveNextWeekChangesDeleted: number }> => {
    const queueRows = await ctx.db.query("nextWeekQueue").collect();
    for (const row of queueRows) {
      await ctx.db.delete(row._id);
    }

    const changeRows = await ctx.db.query("manualChanges").collect();
    let saveNextWeekChangesDeleted = 0;
    for (const row of changeRows) {
      if (row.changeKind === "save_next_week") {
        await ctx.db.delete(row._id);
        saveNextWeekChangesDeleted += 1;
      }
    }

    return {
      nextWeekQueueDeleted: queueRows.length,
      saveNextWeekChangesDeleted,
    };
  },
});
