import { query } from "./_generated/server.js";
import { v, ConvexError } from "convex/values";
import { dishes, packSizes, ingredients, catalog } from "@plantry/engine/library";
import {
  aggregateGroceryList,
  type Dish,
  type GroceryDayPicks,
  type GroceryList,
} from "@plantry/engine";
import type { SlotMeal } from "./lib/meals.js";

/**
 * Returns the structured grocery list for `currentWeek[weekStart]`. Drives the
 * GroceryList component (Stream D slice 4) below the week body, and is the
 * shape the future Swiggy MCP integration (per `docs/engineering.md` §13) will
 * consume.
 *
 * Per `docs/product.md` §3 item 3: groups in the catalog's fixed group order,
 * quantities aggregated across the selected days, tracked items rounded to the
 * next pack multiple. Pantry staples (flour, oil, salt, common spices, base rice)
 * are omitted unless a dish lists them explicitly. Here every ingredient that
 * a picked dish lists (in its `data/dishes/<slug>.md` Ingredients table) is
 * listed; the slow loop is the path that prunes an ingredient row out of a dish
 * file if Rajat decides a given pantry staple should not be on the list.
 *
 * Custom one-offs (slots whose `dishId` is null) do not contribute to the
 * grocery list in v1: their ingredient quantities are not modelled in the
 * library, and the user adds those ingredients themselves. This is consistent
 * with `docs/product.md` §3 item 3 (the list is built from the week's library
 * dishes) and `features/phase2.md` §3 Stream C.
 *
 * Skipped days (`currentWeek.skippedDays`, `docs/engine.md` §6) contribute
 * nothing to the list: a day the household is eating out or away is not cooked,
 * so its dishes are not bought. The query groups the week's picks by day and
 * hands the day-tagged shape plus `skippedDays` to the engine aggregator, which
 * drops the skipped days before summing. When no days are skipped the output is
 * byte-identical to grouping all picks flat, so the current frontend (which
 * calls this query with only `{ weekStart }`) is unaffected.
 *
 * `selectedDays` (optional, short day names "Mon".."Sat") narrows the list to a
 * household-chosen window. The Grocery screen lets the household pick which
 * upcoming days to order for (a shopping run covers the next day or two, not the
 * whole week), so when `selectedDays` is provided the query keeps only those
 * days after grouping and dropping skips, then aggregates just that subset. When
 * `selectedDays` is absent or undefined the behavior is the whole non-skipped
 * week as before, so any caller that omits it (and the future Swiggy MCP) is
 * unaffected. A `selectedDays` entry that is itself skipped or has no library
 * dishes contributes nothing, so passing it is harmless.
 */

type ShortDay = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";
// `SlotMeal` includes "fruit", the standalone Fruit of the day (docs/engine.md
// §3.3). The grocery aggregation groups every slot's dishes by day regardless of
// meal, so a fruit slot's ingredients flow into the list (skip-aware) like any
// other day dish.
type DishPickShape = {
  dishId: number | null;
};
type SlotShape = {
  day: ShortDay;
  meal: SlotMeal;
  dishes: DishPickShape[];
};
type SkippedDayShape = {
  day: ShortDay;
};

/**
 * Browser-callable query. The PWA subscribes via
 * `useQuery(anyApi.groceryList.getGroceryList, { weekStart })`. Throws when
 * the `currentWeek` row for `weekStart` is missing; callers should not ask if
 * `getCurrentWeek` has returned null.
 */
export const getGroceryList = query({
  args: {
    weekStart: v.string(),
    selectedDays: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args): Promise<GroceryList> => {
    const week = await ctx.db
      .query("currentWeek")
      .withIndex("by_weekStart", (q) => q.eq("weekStart", args.weekStart))
      .unique();
    if (!week) {
      throw new ConvexError("no current week for this weekStart");
    }

    // Group every position in every (day, meal) slot by day. Custom one-offs
    // (`dishId === null`) are skipped: their ingredient quantities are not in
    // the library, and v1 expects the user to add those ingredients themselves.
    const libraryById = new Map<number, Dish>(dishes.map((d) => [d.id, d]));
    const dishesByDay = new Map<ShortDay, Dish[]>();
    for (const slot of week.slots as SlotShape[]) {
      for (const pick of slot.dishes) {
        if (pick.dishId === null) continue;
        const dish = libraryById.get(pick.dishId);
        if (!dish) continue;
        const bucket = dishesByDay.get(slot.day);
        if (bucket) bucket.push(dish);
        else dishesByDay.set(slot.day, [dish]);
      }
    }
    // When the household has chosen a window, keep only those days before
    // summing; otherwise the whole grouped (non-skipped) week stands. The
    // skip-aware drop still happens inside the engine aggregator below.
    const selected = args.selectedDays ? new Set(args.selectedDays) : null;
    const days: GroceryDayPicks[] = [...dishesByDay.entries()]
      .filter(([day]) => selected === null || selected.has(day))
      .map(([day, dishList]) => ({
        day,
        dishes: dishList,
      }));

    // Skipped days drop out before summing. The list resets weekly with the
    // week document, so absent `skippedDays` (the common case) means none.
    const skippedDays = ((week.skippedDays ?? []) as SkippedDayShape[]).map((s) => s.day);

    return aggregateGroceryList({
      days,
      skippedDays,
      ingredients,
      packSizes,
      catalog,
    });
  },
});
