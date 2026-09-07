import { internalMutation } from "./_generated/server.js";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel.js";

/**
 * The ISO Monday (YYYY-MM-DD, UTC) of the week containing `date`. Mirrors
 * `mondayOf` in `scripts/seed-dev-week.mjs`, the repo's one week-start
 * derivation; `app/convex/` has no shared helper because every other mutation
 * receives a `weekStart` from its caller (the frontend or the generation run)
 * rather than deriving one. UTC, not local time, so the value a run writes does
 * not depend on where the runner sits: the GitHub action runs in UTC and a
 * local `npx convex run` from Bangalore would otherwise disagree near midnight.
 */
function mondayOf(date: Date): string {
  const d = new Date(date.getTime());
  const day = d.getUTCDay(); // 0 = Sun
  const diff = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

/**
 * Marks each `dishDislikes` row in `dislikeIds` as `applied` with
 * `consumedWeekStart` set to the ISO Monday of the run date and
 * `resolvedPr = arg`. Called by `scripts/slow-loop-mark-applied.mjs` when a
 * `slow-loop/*` PR merges, so the next maintenance run reads only the dislikes
 * queued since (MAINTENANCE.md §3).
 *
 * A dislike is consumed whether the cluster changed anything or not: the slow
 * loop reading a dislike and deciding "no change warranted" still resolves it,
 * so there is no `reviewed_no_change` counterpart here. `dismissed` stays for a
 * dislike retired outside the loop.
 *
 * Never-throw discipline, matching `markManualChangesApplied`: a missing id, or
 * a row no longer `queued`, inserts a `warn` incident and is skipped. The
 * slow-loop GitHub action depends on never throwing so a stale or fabricated id
 * in a merged PR body cannot block the consume cycle for sibling clusters.
 */
export const markDislikesApplied = internalMutation({
  args: {
    dislikeIds: v.array(v.id("dishDislikes")),
    resolvedPr: v.string(),
  },
  handler: async (
    ctx,
    args: { dislikeIds: Id<"dishDislikes">[]; resolvedPr: string },
  ): Promise<{ updated: number; skipped: number }> => {
    const now = Date.now();
    const consumedWeekStart = mondayOf(new Date(now));
    let updated = 0;
    let skipped = 0;
    for (const id of args.dislikeIds) {
      const row = await ctx.db.get(id);
      if (!row) {
        skipped += 1;
        await ctx.db.insert("incidents", {
          createdAt: now,
          source: "backend",
          severity: "warn",
          context: {
            mutation: "markDislikesApplied",
            dislikeId: id,
            resolvedPr: args.resolvedPr,
          },
          message: `markDislikesApplied: dishDislike ${id} not found; skipped.`,
          resolvedAt: null,
        });
        continue;
      }
      if (row.status !== "queued") {
        skipped += 1;
        await ctx.db.insert("incidents", {
          createdAt: now,
          source: "backend",
          severity: "warn",
          context: {
            mutation: "markDislikesApplied",
            dislikeId: id,
            currentStatus: row.status,
            resolvedPr: args.resolvedPr,
          },
          message: `markDislikesApplied: dishDislike ${id} already resolved (status ${row.status}); skipped.`,
          resolvedAt: null,
        });
        continue;
      }
      await ctx.db.patch(id, {
        status: "applied",
        consumedWeekStart,
        resolvedPr: args.resolvedPr,
      });
      updated += 1;
    }
    return { updated, skipped };
  },
});
