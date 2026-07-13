import { query } from "../_generated/server.js";
import type { Doc } from "../_generated/dataModel.js";

/**
 * Returns the `queued` `nextWeekQueue` rows, sorted by `createdAt` ascending
 * (placement order, so "what lands next week" reads top-down: the next generation
 * consumes queued rows oldest first). Raw rows only: the client resolves the dish
 * name and photo from the baked engine library by `dishId`. Backs the "Saved for
 * next week" section of the wishlist page (`features/wishlist.md` §5), which
 * finally reads the queue the save flow has been writing. Mirrors
 * `listQueuedComments`/`listQueuedManualChanges`.
 */
export const listQueuedNextWeek = query({
  args: {},
  handler: async (ctx): Promise<Doc<"nextWeekQueue">[]> => {
    const queued = await ctx.db
      .query("nextWeekQueue")
      .withIndex("by_status", (q) => q.eq("status", "queued"))
      .collect();
    queued.sort((a, b) => a.createdAt - b.createdAt);
    return queued;
  },
});
