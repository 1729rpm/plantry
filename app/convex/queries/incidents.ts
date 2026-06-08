import { query } from "../_generated/server.js";
import type { Doc } from "../_generated/dataModel.js";

/** Returns all incidents rows with resolvedAt === null, sorted by createdAt descending. */
export const listIncidents = query({
  args: {},
  handler: async (ctx): Promise<Doc<"incidents">[]> => {
    const open = await ctx.db
      .query("incidents")
      .withIndex("by_resolved", (q) => q.eq("resolvedAt", null))
      .collect();
    open.sort((a, b) => b.createdAt - a.createdAt);
    return open;
  },
});
