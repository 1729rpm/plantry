import { mutation } from "./_generated/server.js";
import { v } from "convex/values";
import { dishes } from "@plantry/engine/library";
import { assertAuthor } from "./lib/author.js";

/**
 * The household's shared "save it to try" wishlist (`features/wishlist-favorites-v2`).
 * A one-tap list of library dishes, surfaced in the Yours tab where any entry can be
 * placed into the week via the day picker (which leaves it on the list). This is a
 * NEW concept, not the retired next-week queue: the wishlist never feeds generation.
 * Adding or removing a wishlist entry is NOT a change to the current week, so these
 * mutations write ONLY the `wishlist` row: no `manualChanges` row, no `currentWeek`
 * mutation (Decision 6, the Changes feed stays week-edits-only).
 *
 * One shared household list: `author` records who added a row, but either person can
 * remove either person's entry, so `removeFromWishlist` keys on `dishId`. A dish is
 * wishlisted at most once, guarded by the `by_dishId` index.
 *
 * Modeled on `favorites.ts` (assertAuthor, baked-library guard, explicit result
 * union). Library dishes only, so `dishId` is always present (unlike favorites,
 * which also allow a free-text custom label).
 */

/**
 * Adds a library dish to the wishlist. Guards that the dish is in the baked library
 * and is not already wishlisted (a `by_dishId` lookup), then inserts one row.
 *
 *   addToWishlist({ author, dishId })
 *     => { ok: true; wishlistId: string }
 *      | { ok: false; reason: "dish-not-in-library" | "already-wishlisted" }
 */
export const addToWishlist = mutation({
  args: {
    author: v.string(),
    dishId: v.number(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<
    | { ok: true; wishlistId: string }
    | { ok: false; reason: "dish-not-in-library" | "already-wishlisted" }
  > => {
    assertAuthor(args.author);

    const dish = dishes.find((d) => d.id === args.dishId);
    if (!dish) {
      return { ok: false, reason: "dish-not-in-library" };
    }

    const existing = await ctx.db
      .query("wishlist")
      .withIndex("by_dishId", (q) => q.eq("dishId", args.dishId))
      .first();
    if (existing) {
      return { ok: false, reason: "already-wishlisted" };
    }

    const wishlistId = await ctx.db.insert("wishlist", {
      createdAt: Date.now(),
      author: args.author,
      dishId: args.dishId,
    });

    return { ok: true, wishlistId };
  },
});

/**
 * Removes a dish from the wishlist (by dish, so either person can remove either
 * person's entry: the list is one shared household list). Deletes the row found via
 * the `by_dishId` index.
 *
 *   removeFromWishlist({ author, dishId })
 *     => { ok: true }
 *      | { ok: false; reason: "not-wishlisted" }
 */
export const removeFromWishlist = mutation({
  args: {
    author: v.string(),
    dishId: v.number(),
  },
  handler: async (ctx, args): Promise<{ ok: true } | { ok: false; reason: "not-wishlisted" }> => {
    assertAuthor(args.author);

    const existing = await ctx.db
      .query("wishlist")
      .withIndex("by_dishId", (q) => q.eq("dishId", args.dishId))
      .first();
    if (!existing) {
      return { ok: false, reason: "not-wishlisted" };
    }

    await ctx.db.delete(existing._id);
    return { ok: true };
  },
});
