import { query } from "../_generated/server.js";
import type { Doc } from "../_generated/dataModel.js";

/** Returns the currentWeek row with the largest weekStart, or null if the table is empty. */
export const getCurrentWeek = query({
  args: {},
  handler: async (ctx): Promise<Doc<"currentWeek"> | null> => {
    const rows = await ctx.db.query("currentWeek").withIndex("by_weekStart").order("desc").take(1);
    return rows[0] ?? null;
  },
});
