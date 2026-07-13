import { internalMutation, mutation } from "./_generated/server.js";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel.js";
import { assertAuthor } from "./lib/author.js";

/**
 * Marks each `nextWeekQueue` row in `queueIds` as `dropped`. Invoked by the
 * slow-loop mark-applied action when a slow-loop PR's diagnosis decides a
 * saved-for-next-week dish is stale or no longer worth carrying forward
 * (`features/design-revamp.md` §1.8). `dropped` is the queue's terminal
 * "consumed by the slow loop without placing" state, parallel to
 * `reviewed_no_change` on comments and manual changes.
 *
 * Mirrors `markCommentsApplied` in shape and never-throw discipline: a missing
 * id, or a row past the `queued` lifecycle (already `placed` by a generation
 * run, or already `dropped`), logs a `warn` incident and is skipped. The
 * never-throw guarantee lets a stale or fabricated id in a merged PR body fail
 * softly without blocking the consume cycle for sibling clusters. The
 * generation run owns the `queued -> placed` transition; the slow loop owns the
 * `queued -> dropped` transition. This mutation only acts on `queued` rows.
 */
export const markQueueDropped = internalMutation({
  args: {
    queueIds: v.array(v.id("nextWeekQueue")),
    resolvedPr: v.string(),
  },
  handler: async (
    ctx,
    args: { queueIds: Id<"nextWeekQueue">[]; resolvedPr: string },
  ): Promise<{ updated: number; skipped: number }> => {
    const now = Date.now();
    let updated = 0;
    let skipped = 0;
    for (const id of args.queueIds) {
      const row = await ctx.db.get(id);
      if (!row) {
        skipped += 1;
        await ctx.db.insert("incidents", {
          createdAt: now,
          source: "backend",
          severity: "warn",
          context: {
            mutation: "markQueueDropped",
            queueId: id,
            resolvedPr: args.resolvedPr,
          },
          message: `markQueueDropped: nextWeekQueue ${id} not found; skipped.`,
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
            mutation: "markQueueDropped",
            queueId: id,
            currentStatus: row.status,
            resolvedPr: args.resolvedPr,
          },
          message: `markQueueDropped: nextWeekQueue ${id} not in queued state (status ${row.status}); skipped.`,
          resolvedAt: null,
        });
        continue;
      }
      await ctx.db.patch(id, { status: "dropped" });
      updated += 1;
    }
    return { updated, skipped };
  },
});

/**
 * Browser-callable: the user removes one saved dish from the "Saved for next
 * week" section of the wishlist page (`features/wishlist.md` §5). Sets the row's
 * status to `dropped` and, in the same transaction, writes a `manualChanges` row
 * with `changeKind: "delete"` so the unmark surfaces in the Changes feed (the
 * feed already renders deletes; no new changeKind is invented). The dropped dish
 * lives in `before`; `after` is the null entry a delete carries.
 *
 * Distinct from the internal `markQueueDropped` (the slow-loop mark-applied path,
 * which drops rows in bulk with a `resolvedPr` and never writes a manualChanges
 * row): this is the user-driven unmark, author-stamped, one row at a time, and
 * visible in the Changes feed.
 *
 *   removeFromNextWeekQueue({ author, queueId })
 *     => { ok: true }
 *      | { ok: false; reason: "no-such-row" | "not-queued" }
 *
 * The explicit result union is the binding contract Stream B (the wishlist UI)
 * builds against: `no-such-row` when the id resolves to nothing, `not-queued`
 * when the row is past the `queued` lifecycle (already `placed` by a generation
 * run, or already `dropped`). Only a `queued` row is droppable here (the
 * generation run owns `queued -> placed`; this and the slow loop own
 * `queued -> dropped`).
 *
 * The queue is week-agnostic, but the Changes feed (`queries/activity.ts`) is
 * keyed by weekStart, so the manualChanges row attaches to the live week (the
 * `currentWeek` row with the largest weekStart, mirroring `getCurrentWeek`). With
 * no current week the drop still succeeds; there is simply no week feed to surface
 * it in. Like `save_next_week`, the row is day-less (no `day`/`meal`/`position`):
 * a queue removal is not scoped to a day slot, and the schema makes those fields
 * optional for day-less kinds.
 */
export const removeFromNextWeekQueue = mutation({
  args: {
    author: v.string(),
    queueId: v.id("nextWeekQueue"),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ ok: true } | { ok: false; reason: "no-such-row" | "not-queued" }> => {
    assertAuthor(args.author);

    const row = await ctx.db.get(args.queueId);
    if (!row) {
      return { ok: false, reason: "no-such-row" };
    }
    if (row.status !== "queued") {
      return { ok: false, reason: "not-queued" };
    }

    const now = Date.now();
    const current = await ctx.db
      .query("currentWeek")
      .withIndex("by_weekStart")
      .order("desc")
      .take(1);
    const weekStart = current[0]?.weekStart ?? "";

    await ctx.db.patch(args.queueId, { status: "dropped" });

    await ctx.db.insert("manualChanges", {
      createdAt: now,
      author: args.author,
      weekStart,
      changeKind: "delete",
      before: { dishId: row.dishId, customLabel: null },
      after: { dishId: null, customLabel: null },
      reason: "Removed from the next-week list",
      status: "queued",
      resolvedAt: null,
      resolvedPr: null,
    });

    return { ok: true };
  },
});
