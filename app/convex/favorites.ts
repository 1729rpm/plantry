import { mutation } from "./_generated/server.js";
import { v } from "convex/values";
import { dishes } from "@plantry/engine/library";
import { assertAuthor } from "./lib/author.js";

/**
 * The household's standing favorites list (`features/wishlist-favorites-v2`). A
 * favorite is the live §4-step-4 preference signal: the generation run reads the
 * library-dish rows (createdAt ascending) and passes the ordered dish ids to the
 * engine's guaranteed-placement pass, so every library favorite is pinned into one
 * slot of every generated week. Adding or removing a favorite is NOT a change to the
 * current week, so these mutations write ONLY the `favorites` row: no `manualChanges`
 * row, no `currentWeek` mutation, no re-rank (Decision 6). The one consequence is
 * downstream, at the next generation.
 *
 * A favorite is EITHER a library dish (`dishId`) OR a free-text custom name
 * (`customLabel`, the "avocado toast every week" case). Custom favorites are a
 * display-only reminder in the Yours tab with no generation effect; the engine only
 * pins library favorites. Exactly one of the two fields is set per row, enforced
 * here in the mutations (the schema keeps both optional).
 *
 * One shared household list: `author` records who added a row, but either person can
 * remove either person's entry, so `removeFavorite` keys on `dishId` and
 * `removeFavoriteById` keys on the row id alone.
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
 * Adds a free-text custom favorite (a name not in the library, e.g. "Avocado toast
 * every week"). Trims the label, rejects an empty one, and dedupes
 * case-insensitively against existing custom favorites so the list holds one row per
 * distinct label. Custom favorites are display-only (no generation effect).
 *
 *   addCustomFavorite({ author, customLabel })
 *     => { ok: true; favoriteId: string }
 *      | { ok: false; reason: "empty-label" | "already-favorite" }
 */
export const addCustomFavorite = mutation({
  args: {
    author: v.string(),
    customLabel: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<
    { ok: true; favoriteId: string } | { ok: false; reason: "empty-label" | "already-favorite" }
  > => {
    assertAuthor(args.author);

    const label = args.customLabel.trim();
    if (label.length === 0) {
      return { ok: false, reason: "empty-label" };
    }

    // Case-insensitive dedupe across the existing custom favorites (library rows
    // carry no label, so they are skipped). Small list, so a full scan is fine.
    const rows = await ctx.db.query("favorites").collect();
    const wanted = label.toLowerCase();
    const clash = rows.some((row) => row.customLabel?.trim().toLowerCase() === wanted);
    if (clash) {
      return { ok: false, reason: "already-favorite" };
    }

    const favoriteId = await ctx.db.insert("favorites", {
      createdAt: Date.now(),
      author: args.author,
      customLabel: label,
    });

    return { ok: true, favoriteId };
  },
});

/**
 * Removes a library favorite by dish (either person can remove either person's
 * entry: the list is one shared household list). Deletes the row found via the
 * `by_dishId` index. For a custom favorite (no `dishId`), use `removeFavoriteById`.
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

/**
 * Removes a favorite by row id. The custom-favorite counterpart to
 * `removeFavorite` (a custom favorite has no `dishId` to key on), and it also works
 * for a library favorite. Shared list: either person may remove any row, so no
 * author guard is needed.
 *
 *   removeFavoriteById({ favoriteId })
 *     => { ok: true }
 *      | { ok: false; reason: "no-such-favorite" }
 */
export const removeFavoriteById = mutation({
  args: {
    favoriteId: v.id("favorites"),
  },
  handler: async (ctx, args): Promise<{ ok: true } | { ok: false; reason: "no-such-favorite" }> => {
    const existing = await ctx.db.get(args.favoriteId);
    if (!existing) {
      return { ok: false, reason: "no-such-favorite" };
    }
    await ctx.db.delete(args.favoriteId);
    return { ok: true };
  },
});
