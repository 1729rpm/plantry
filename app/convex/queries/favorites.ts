import { query } from "../_generated/server.js";
import type { Doc } from "../_generated/dataModel.js";

/**
 * Returns every `favorites` row, sorted by `createdAt` ascending (oldest first,
 * the order the household built the list). Raw rows only: the client resolves the
 * dish name and photo from the baked engine library by `dishId`, so this query
 * stays a thin read of the table (the wishlist page, `features/wishlist.md` §5).
 */
export const listFavorites = query({
  args: {},
  handler: async (ctx): Promise<Doc<"favorites">[]> => {
    const rows = await ctx.db.query("favorites").collect();
    rows.sort((a, b) => a.createdAt - b.createdAt);
    return rows;
  },
});
