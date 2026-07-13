import { mutation } from "./_generated/server.js";
import { v } from "convex/values";
import { dishes } from "@plantry/engine/library";
import { assertAuthor } from "./lib/author.js";

/**
 * The household's standing favorites list (`features/wishlist.md`). A favorite is
 * the live §4-step-4 preference signal: the generation run reads the `favorites`
 * table and passes the dish ids to the engine, so a favorite surfaces about weekly
 * in the generated menu (capped by the engine's FAVORITE_WEEKLY_CAP). Adding or
 * removing a favorite is NOT a change to the current week, so these mutations
 * write ONLY the `favorites` row: no `manualChanges` row, no `currentWeek`
 * mutation, no re-rank. The one consequence is downstream, at the next generation.
 *
 * One shared household list: `author` records who added a row, but either person
 * can remove either person's entry, so `removeFavorite` keys on `dishId` alone.
 *
 * Modeled on `dishDislikes.ts` (assertAuthor, baked-library guard, explicit
 * result union). Unlike a dislike (each tap is a distinct slow-loop signal, so a
 * dish may be disliked repeatedly), a favorite is a set membership: a dish is
 * favorited at most once, guarded by the `by_dishId` index.
 */

/**
 * Adds a library dish to the favorites list. Guards that the dish is in the baked
 * library and is not already a favorite (a `by_dishId` lookup), then inserts one
 * row.
 *
 *   addFavorite({ author, dishId })
 *     => { ok: true; favoriteId: string }
 *      | { ok: false; reason: "dish-not-in-library" | "already-favorite" }
 */
export const addFavorite = mutation({
  args: {
    author: v.string(),
    dishId: v.number(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<
    | { ok: true; favoriteId: string }
    | { ok: false; reason: "dish-not-in-library" | "already-favorite" }
  > => {
    assertAuthor(args.author);

    const dish = dishes.find((d) => d.id === args.dishId);
    if (!dish) {
      return { ok: false, reason: "dish-not-in-library" };
    }

    // A favorite is set membership: guard against a double-add so the list holds
    // at most one row per dish (a stale client cannot duplicate an entry).
    const existing = await ctx.db
      .query("favorites")
      .withIndex("by_dishId", (q) => q.eq("dishId", args.dishId))
      .first();
    if (existing) {
      return { ok: false, reason: "already-favorite" };
    }

    const favoriteId = await ctx.db.insert("favorites", {
      createdAt: Date.now(),
      author: args.author,
      dishId: args.dishId,
    });

    return { ok: true, favoriteId };
  },
});

/**
 * Removes a dish from the favorites list (by dish, so either person can remove
 * either person's entry: the list is one shared household list). Deletes the row
 * found via the `by_dishId` index.
 *
 *   removeFavorite({ author, dishId })
 *     => { ok: true }
 *      | { ok: false; reason: "not-a-favorite" }
 */
export const removeFavorite = mutation({
  args: {
    author: v.string(),
    dishId: v.number(),
  },
  handler: async (ctx, args): Promise<{ ok: true } | { ok: false; reason: "not-a-favorite" }> => {
    assertAuthor(args.author);

    const existing = await ctx.db
      .query("favorites")
      .withIndex("by_dishId", (q) => q.eq("dishId", args.dishId))
      .first();
    if (!existing) {
      return { ok: false, reason: "not-a-favorite" };
    }

    await ctx.db.delete(existing._id);
    return { ok: true };
  },
});
