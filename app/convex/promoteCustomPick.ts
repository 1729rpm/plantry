import { internalMutation } from "./_generated/server.js";
import { v, ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel.js";
import { slotMealValidator } from "./lib/meals.js";

/**
 * Re-points one custom pick at the library dish it became (`features/engine-v6.md` §2.1).
 *
 * A free-text custom one-off carries `dishId: null`, so it has no library identity
 * and contributes no as-eaten row to the record. When the slow loop promotes a
 * repeatedly-requested custom dish into the library (`ADDING-DISHES.md`), the weeks
 * the household already ate it are still sitting in `currentWeek` as null picks, and
 * the record silently under-counts the dish forever unless those slots are pointed
 * at the new id. This mutation does exactly that, one pick at a time.
 *
 * It writes NO `manualChanges` row. Every other write path in this repo logs one,
 * because every other write path is a household edit and the slow loop reads that
 * log as observed behavior. This is not an edit: the household already made its
 * choice, and the dish on the plate is not changing. It is a data repair that gives
 * an existing choice its library identity, and logging it would inject a swap the
 * household never made into the very signal the slow loop reads.
 *
 * Internal only, never browser-callable: the EM runs it per slot with Rajat's
 * per-action approval after the dish's content batch has merged and deployed.
 *
 *     npx convex run --prod promoteCustomPick:promoteCustomPick \
 *       '{"weekStart":"2026-07-06","day":"Wed","meal":"breakfast","position":0,
 *         "customLabel":"Red sauce pasta","dishId":284}'
 *
 * Guarded on both halves of the pick's identity: the pick at that position must
 * still be custom (`dishId === null`) and must carry exactly the `customLabel` the
 * caller named. A mistyped position or a slot that has since been swapped by hand
 * throws, naming what was actually found, rather than overwriting a real pick. The
 * label match is exact, not trimmed or case-folded, because the stored label is
 * what the household typed and the caller is copying it from an export.
 *
 * On success the pick becomes `source: "swapped"` (it now points at a library dish,
 * which is what that source means everywhere else) and its `updatedAt` moves, while
 * the `author` is KEPT: whoever asked for the dish still asked for it, and the
 * repair does not re-attribute their choice. The row's `version` bumps so any client
 * holding the old version reloads instead of writing over the repair.
 */
export const promoteCustomPick = internalMutation({
  args: {
    weekStart: v.string(),
    day: v.union(
      v.literal("Mon"),
      v.literal("Tue"),
      v.literal("Wed"),
      v.literal("Thu"),
      v.literal("Fri"),
      v.literal("Sat"),
    ),
    meal: slotMealValidator,
    position: v.number(),
    customLabel: v.string(),
    dishId: v.number(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    weekId: Id<"currentWeek">;
    version: number;
    dishId: number;
  }> => {
    const week = await ctx.db
      .query("currentWeek")
      .withIndex("by_weekStart", (q) => q.eq("weekStart", args.weekStart))
      .unique();
    if (!week) {
      throw new ConvexError(
        `promoteCustomPick: no currentWeek row for weekStart ${args.weekStart}`,
      );
    }

    const slotIndex = week.slots.findIndex((s) => s.day === args.day && s.meal === args.meal);
    if (slotIndex === -1) {
      throw new ConvexError(
        `promoteCustomPick: week ${args.weekStart} has no ${args.day} ${args.meal} slot`,
      );
    }
    const slot = week.slots[slotIndex];

    if (args.position < 0 || args.position >= slot.dishes.length) {
      throw new ConvexError(
        `promoteCustomPick: ${args.weekStart} ${args.day} ${args.meal} has ` +
          `${slot.dishes.length} pick(s); position ${args.position} is out of range`,
      );
    }
    const pick = slot.dishes[args.position];

    // The two guards. Each names what was found, because the caller is working
    // from an export that may be older than the week.
    if (pick.dishId !== null) {
      throw new ConvexError(
        `promoteCustomPick: ${args.weekStart} ${args.day} ${args.meal} position ` +
          `${args.position} is not a custom pick; it holds library dish ${pick.dishId} ` +
          `(source ${pick.source})`,
      );
    }
    if (pick.customLabel !== args.customLabel) {
      throw new ConvexError(
        `promoteCustomPick: ${args.weekStart} ${args.day} ${args.meal} position ` +
          `${args.position} has customLabel ${JSON.stringify(pick.customLabel)}, ` +
          `not ${JSON.stringify(args.customLabel)}`,
      );
    }

    const newDishes = [...slot.dishes];
    newDishes[args.position] = {
      ...pick,
      dishId: args.dishId,
      customLabel: null,
      source: "swapped",
      // `author` is intentionally carried over from `pick`, not overwritten.
      updatedAt: Date.now(),
    };
    const newSlots = [...week.slots];
    newSlots[slotIndex] = { ...slot, dishes: newDishes };
    const newVersion = week.version + 1;

    await ctx.db.patch(week._id, { slots: newSlots, version: newVersion });

    return { weekId: week._id, version: newVersion, dishId: args.dishId };
  },
});
