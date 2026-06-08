import { query } from "../_generated/server.js";
import type { Doc } from "../_generated/dataModel.js";

/** Returns all comments rows whose status is "queued", sorted by createdAt ascending. */
export const listQueuedComments = query({
  args: {},
  handler: async (ctx): Promise<Doc<"comments">[]> => {
    const queued = await ctx.db
      .query("comments")
      .withIndex("by_status", (q) => q.eq("status", "queued"))
      .collect();
    queued.sort((a, b) => a.createdAt - b.createdAt);
    return queued;
  },
});
