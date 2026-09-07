import { query } from "./_generated/server.js";
import { v } from "convex/values";
import { dishes, ingredients, catalog } from "@plantry/engine/library";
import {
  deriveRecordStats,
  rankExploreV6,
  type ExploreAffinityKeyV6,
  type Season,
} from "@plantry/engine";
import { loadRecord } from "./lib/record.js";

/**
 * Explore feed for the Explore tab (`features/design-revamp.md` §1.4 item 4,
 * §1.5, §6.12). Returns the eligible (active, in-season), NEVER-EATEN library
 * dishes ranked "familiar but new" by the engine `rankExploreV6`, each carrying
 * its `dominantAffinity` key. The UI phrases the "why it fits" line from the key;
 * no UI prose leaks out of the engine (Principle 7).
 *
 * "Never eaten" comes from the household record (`features/engine-v6.md` §2.1,
 * §12): every `currentWeek` row before this week, as-eaten, loaded by
 * `loadRecord` and reduced by `deriveRecordStats`. A dish with an as-eaten row in
 * any scope is repertoire, not novelty, so it is out of the candidate pool. The
 * baked seed history and `weekArchive` are NOT read: the archive under-reports
 * weeks the household edited after finalizing, and the seed carries pre-correction
 * menu shapes the household has since edited away (§13). `data/menu_history.md`
 * stays in the repo for provenance only.
 *
 * The affinity is record-derived too. `rankExploreV6` scores each candidate
 * against the record rows of its OWN meal type (a breakfast candidate against the
 * weekday-breakfast scope, a lunch candidate against the weekday-lunch scope), so
 * the "familiar" half of "familiar but new" is what the household actually ate at
 * that meal. The record weeks go in as the fourth argument for exactly that
 * reason: with none, every affinity profile would be empty and the ranking would
 * collapse to dish id.
 *
 * The ranking is the engine's; this query only supplies inputs (the record, the
 * library, the season, and the ingredient rows plus catalog the protein-band
 * signal needs) and projects the result to the wire shape the Explore tab
 * consumes. The §7 spacing window and the family governor are deliberately not
 * applied here: they govern what the engine proposes, not what the household is
 * allowed to browse.
 */

/**
 * Bangalore seasons per `docs/product.md` §1. Inlined from generateWeek.ts /
 * swap.ts / dayMutations.ts (a fourth similar caller; the inline copy stays per
 * `docs/product.md` §4 Principle 8 rather than extracting a shared helper for a
 * one-line month read). Reads the month from the ISO date string ("YYYY-MM-DD").
 */
function seasonOf(isoDate: string): Season {
  const month = Number.parseInt(isoDate.slice(5, 7), 10);
  if (month >= 3 && month <= 5) return "Summer";
  if (month >= 6 && month <= 9) return "Monsoon";
  return "Winter";
}

export interface ExploreFeedDish {
  dishId: number;
  name: string;
  /** Structured affinity key; the UI phrases the "why it fits" line from it. */
  dominantAffinity: ExploreAffinityKeyV6;
}

/**
 * Browser-callable query. The PWA subscribes via
 * `useQuery(anyApi.explore.getExploreFeed, { weekStart })`. `weekStart` fixes the
 * season and bounds the record; the ranking spans both meal-times (Explore is not
 * slot scoped). Returns the full ranked list (the UI decides how many to show).
 */
export const getExploreFeed = query({
  args: { weekStart: v.string() },
  handler: async (ctx, args): Promise<ExploreFeedDish[]> => {
    const season = seasonOf(args.weekStart);
    const record = await loadRecord(ctx, args.weekStart);
    const stats = deriveRecordStats(record, dishes, season);

    const ranked = rankExploreV6(stats, dishes, season, record, {
      nutrition: { ingredients, catalog },
    });

    // Decision 9: hide dishes already placed in the current week, so the tab keeps
    // its "new on the plate" promise. Placed = any dish id appearing in a
    // current-week slot for `weekStart`. This is the week being eaten now, which
    // the record deliberately excludes (the record is every week BEFORE this one),
    // so it is read separately. The read is server-side so the wire payload is
    // already trimmed. (The retired next-week queue exclusion is gone with the
    // queue itself, `features/wishlist-favorites-v2` §5; the wishlist never hides an
    // Explore dish.)
    const week = await ctx.db
      .query("currentWeek")
      .withIndex("by_weekStart", (q) => q.eq("weekStart", args.weekStart))
      .unique();
    const scheduled = new Set<number>();
    if (week) {
      for (const slot of week.slots) {
        for (const pick of slot.dishes) {
          if (pick.dishId !== null) scheduled.add(pick.dishId);
        }
      }
    }

    return ranked
      .filter((entry) => !scheduled.has(entry.dish.id))
      .map((entry) => ({
        dishId: entry.dish.id,
        name: entry.dish.name,
        dominantAffinity: entry.dominantAffinity,
      }));
  },
});
