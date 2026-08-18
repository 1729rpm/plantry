import { internalMutation } from "./_generated/server.js";

/**
 * One-shot data migration for retiring the day-level comment channel. Convex
 * validates every existing row against the schema on deploy and refuses to drop
 * a non-empty table, so the rows must be gone BEFORE the follow-up PR removes
 * the `comments` table from `schema.ts`. This mutation deletes every `comments`
 * row and returns the count.
 *
 * It is internal (run via `npx convex run`, EM-gated on prod) and a throwaway,
 * deleted in the same follow-up PR that drops the table. It is idempotent: a
 * second run finds nothing left and returns zero, so re-running is a safe no-op.
 * The returned count lets the operator confirm the wipe landed before deploying
 * the schema removal.
 */
export const wipeComments = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ commentsDeleted: number }> => {
    const rows = await ctx.db.query("comments").collect();
    for (const row of rows) {
      await ctx.db.delete(row._id);
    }
    return { commentsDeleted: rows.length };
  },
});
