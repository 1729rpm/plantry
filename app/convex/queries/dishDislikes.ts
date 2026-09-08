import { query } from "../_generated/server.js";
import type { Doc } from "../_generated/dataModel.js";

/**
 * Returns all `dishDislikes` rows whose status is `"queued"`, sorted by
 * `createdAt` ascending. Consumed by the `/maintain` signals pass as fuel for
 * rule redesign alongside queued manual changes and open incidents (see
 * `MAINTENANCE.md` §4.1 and `.claude/skills/maintain/passes/signals.md`).
 */
export const listQueuedDislikes = query({
  args: {},
  handler: async (ctx): Promise<Doc<"dishDislikes">[]> => {
    const queued = await ctx.db
      .query("dishDislikes")
      .withIndex("by_status", (q) => q.eq("status", "queued"))
      .collect();
    queued.sort((a, b) => a.createdAt - b.createdAt);
    return queued;
  },
});
