import { query } from "../_generated/server.js";
import type { Doc } from "../_generated/dataModel.js";

/**
 * Returns every `wishlist` row, sorted by `createdAt` ascending (oldest first, the
 * order the household built the list). Raw rows only: the client resolves the dish
 * name and photo from the baked engine library by `dishId`, so this query stays a
 * thin read of the shared wishlist table (the Yours tab, `features/wishlist-favorites-v2`).
 */
export const listWishlist = query({
  args: {},
  handler: async (ctx): Promise<Doc<"wishlist">[]> => {
    const rows = await ctx.db.query("wishlist").collect();
    rows.sort((a, b) => a.createdAt - b.createdAt);
    return rows;
  },
});
