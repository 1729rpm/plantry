import { internalMutation } from "./_generated/server.js";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel.js";
import { dishes, packSizes, ingredients } from "@plantry/engine/library";
import { history } from "@plantry/engine/history";
import {
  generateWeek,
  type GeneratedWeek,
  type MenuHistoryRow,
  type Season,
} from "@plantry/engine";
import type { SlotMeal } from "./lib/meals.js";
import { archiveToHistoryRows } from "./lib/archiveHistory.js";

type ShortDay = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";

/**
 * Bangalore seasons per `docs/product.md` §1:
 *   - Summer: March-May
 *   - Monsoon: June-September
 *   - Winter: October-February
 *
 * Reads the month directly from the ISO date string ("YYYY-MM-DD"); no Date
 * object is needed and no timezone math is involved.
 */
export function seasonOf(isoDate: string): Season {
  const month = Number.parseInt(isoDate.slice(5, 7), 10);
  if (month >= 3 && month <= 5) return "Summer";
  if (month >= 6 && month <= 9) return "Monsoon";
  return "Winter";
}

/**
 * `internalMutation` that calls the engine for a given Monday and persists the
 * resulting week into Convex. Not browser-callable: the EM (or a future Stream
 * F scheduled action) triggers it via `npx convex run`. The PWA renders
 * whatever `getCurrentWeek` returns.
 *
 * Replacement semantics: if a `currentWeek` row already exists for the same
 * `weekStart` (looked up via the `by_weekStart` index), it is deleted before
 * the new row is inserted. The new row starts at `version: 1`, `status:
 * "draft"`. A future auto-recovery slice may add validation that diffs the new
 * row against the old before committing the replacement.
 *
 * Shape conversion (engine -> Convex):
 *   - day: identity (the engine's `Day` is already short-form: "Mon".."Sat").
 *   - meal: lowercased ("Breakfast" -> "breakfast", "Lunch" -> "lunch").
 *   - dishes: every pick from `slot.dishes`, in pick order (lead first), each
 *     mapped to `{ dishId, customLabel: null, source: "generated",
 *     author: "system", updatedAt: now }`. A slot with no picks (cap drop
 *     wiped it) is skipped.
 *
 * Favorites (`features/wishlist-favorites-v2` §3, §4): before generating, the run
 * reads every library-dish `favorites` row (createdAt ascending) and passes the
 * ordered dish ids to the engine's §4-step-4 guaranteed-placement pass. The engine
 * pins each favorite into one slot of the week (spread across distinct days,
 * oldest-added first) and returns the ones it could not place under the §3
 * composition locks as `unplacedFavorites`, which this run logs as one warn incident
 * naming them. Custom (free-text) favorites carry no `dishId`, so they are skipped
 * here (display-only). An empty favorites set leaves generation byte-identical to a
 * run with no favorites.
 *
 * History input (docs/engine.md Inputs, §8): the engine's historical record is
 * the baked seed history (`@plantry/engine/history`, a periodic snapshot) plus
 * one `MenuHistoryRow` per `weekArchive` row (weeks finalized since the last
 * bake), merged via `archiveToHistoryRows`. The merged record drives the §4
 * longest-unused priority, the §2 Saturday Menu 3/4 alternation, and the §3.3
 * fruit rotation, so a freshly finalized week immediately sinks its dishes in
 * the next generation. With an empty `weekArchive` the merged history equals
 * the baked history.
 *
 * Incidents: any human-readable warnings the engine reports (`GeneratedWeek
 * .incidents`, e.g. "Friday over cap (5), dropped: Rajma", or an unplaceable
 * requested dish) are persisted as one `incidents` row each with
 * `source: "engine"`, `severity: "warn"`, and `context: { weekStart, weekId }`.
 * The count is returned so the caller can see at a glance whether the generation
 * produced warnings worth inspecting.
 */
export const generateCurrentWeek = internalMutation({
  args: {
    weekStart: v.string(),
    rng: v.optional(v.number()),
    userRequestedDishId: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    weekId: Id<"currentWeek">;
    version: number;
    incidentCount: number;
  }> => {
    const season = seasonOf(args.weekStart);

    // §4 step 4 favorites: the household's standing favorites list drives the
    // engine's guaranteed-placement pass. Read the library-dish rows (a custom
    // free-text favorite carries no `dishId` and is display-only, so it is skipped),
    // ordered createdAt ascending so the oldest win when the set overflows the
    // week's capacity. An empty list yields an empty array, so the pass is a no-op
    // and generation is identical to a household with no favorites.
    const favoriteRows = await ctx.db.query("favorites").collect();
    favoriteRows.sort((a, b) => a.createdAt - b.createdAt);
    const favoriteDishIds = favoriteRows
      .map((row) => row.dishId)
      .filter((id): id is number => id !== undefined);

    // Historical record = baked seed + every finalized week in `weekArchive`,
    // so recency-driven rules see weeks finalized since the last bake.
    const archives = await ctx.db.query("weekArchive").collect();
    const mergedHistory: MenuHistoryRow[] = [...history, ...archiveToHistoryRows(archives)];

    // The engine composes §1 schedule -> §2 alternation -> §3 composition
    // -> §3.2 substitution -> §4 priority -> §5 cap -> §6 consolidation, pinning
    // §4-step-4 favorites into slots whose composition accepts them.
    const generated: GeneratedWeek = generateWeek({
      weekStart: args.weekStart,
      library: dishes,
      history: mergedHistory,
      season,
      ingredients,
      packSizes,
      rng: args.rng !== undefined ? () => args.rng as number : undefined,
      userRequestedDishId: args.userRequestedDishId,
      favoriteDishIds,
    });

    const now = Date.now();
    const toDishEntry = (dishId: number) => ({
      dishId: dishId as number | null,
      customLabel: null as string | null,
      source: "generated" as const,
      author: "system" as const,
      updatedAt: now,
    });
    const slots = generated.days.flatMap((d) => {
      const mealSlots = d.slots
        .filter((slot) => slot.dishes.length > 0)
        .map((slot) => ({
          day: slot.day as ShortDay,
          meal: slot.meal.toLowerCase() as SlotMeal,
          dishes: slot.dishes.map((dish) => toDishEntry(dish.id)),
        }));
      // §3.3 Fruit of the day: one Category=Fruit dish per day Mon-Sat, stored as
      // its own `meal: "fruit"` slot with a single dish, alongside breakfast and
      // lunch. Outside the §9 cap, so it is appended after the capped meal slots.
      if (d.fruit) {
        mealSlots.push({
          day: d.day as ShortDay,
          meal: "fruit" as SlotMeal,
          dishes: [toDishEntry(d.fruit.id)],
        });
      }
      return mealSlots;
    });

    // Replace any existing row for this weekStart. Documented as intentional;
    // future auto-recovery middleware may insert a validation diff here.
    const existing = await ctx.db
      .query("currentWeek")
      .withIndex("by_weekStart", (q) => q.eq("weekStart", args.weekStart))
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
    }

    const weekId = await ctx.db.insert("currentWeek", {
      weekStart: args.weekStart,
      status: "draft",
      slots,
      version: 1,
    });

    for (const message of generated.incidents) {
      await ctx.db.insert("incidents", {
        createdAt: now,
        source: "engine",
        severity: "warn",
        context: { weekStart: args.weekStart, weekId },
        message,
        resolvedAt: null,
      });
    }

    // §4 step 4: log one warn incident per week naming the library favorites the
    // engine could not pin without breaking a §3 composition lock or running out of
    // accepting slots. The engine returns these in `unplacedFavorites` rather than as
    // incident strings, so the fast loop stays silent while the slow loop sees a real
    // "your favorites did not all fit this week" signal (with the dish ids and the
    // week). No incident row when every favorite landed.
    let incidentCount = generated.incidents.length;
    if (generated.unplacedFavorites.length > 0) {
      const names = generated.unplacedFavorites.map((id) => {
        const dish = dishes.find((d) => d.id === id);
        return dish ? dish.name : `dish ${id}`;
      });
      await ctx.db.insert("incidents", {
        createdAt: now,
        source: "engine",
        severity: "warn",
        context: {
          weekStart: args.weekStart,
          weekId,
          unplacedFavoriteDishIds: generated.unplacedFavorites,
        },
        message: `Favorites not placed this week (composition locks or capacity): ${names.join(", ")}`,
        resolvedAt: null,
      });
      incidentCount += 1;
    }

    return {
      weekId,
      version: 1,
      incidentCount,
    };
  },
});
