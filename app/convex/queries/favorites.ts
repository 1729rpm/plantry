import { query } from "../_generated/server.js";
import type { Doc } from "../_generated/dataModel.js";

/**
 * Returns every `favorites` row, sorted by `createdAt` ascending (oldest first,
 * the order the household built the list). Each row carries either `dishId` (a
 * library favorite) or `customLabel` (a free-text custom favorite), so the client
 * renders the right kind: for a library favorite it resolves the dish name and photo
 * from the baked engine library by `dishId`; a custom favorite renders its label
 * directly. Raw rows only, a thin read of the table (the Yours tab,
 * `features/wishlist-favorites-v2`).
 */
export const listFavorites = query({
  args: {},
  handler: async (ctx): Promise<Doc<"favorites">[]> => {
    const rows = await ctx.db.query("favorites").collect();
    rows.sort((a, b) => a.createdAt - b.createdAt);
    return rows;
  },
});
