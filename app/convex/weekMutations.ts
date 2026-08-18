import { mutation } from "./_generated/server.js";
import { v, ConvexError } from "convex/values";
import { dishes } from "@plantry/engine/library";
import { assertAuthor } from "./lib/author.js";
import { mealTimeValidator, type SlotMeal } from "./lib/meals.js";

type ShortDay = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";
// `SlotMeal` includes the read-only legacy "fruit" (see `lib/meals.ts`): a
// `currentWeek` generated before the Fruit of the day was removed can still hold
// a `meal:"fruit"` slot, and finalize must archive it rather than choke on it.
// Nothing writes one. The custom-dish mutations below only ever receive
// breakfast|lunch (their args use `mealTimeValidator`), so reading the stored
// slot with the wider `SlotMeal` is safe.
type LongDay = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";
type CapMeal = "Breakfast" | "Lunch" | "Fruit";

type SlotAuthor = "rajat" | "tuhina" | "system";
type DishPickShape = {
  dishId: number | null;
  customLabel: string | null;
  source: "generated" | "swapped" | "custom";
  author: SlotAuthor;
  updatedAt: number;
  includeRecipe?: boolean;
};
type SlotShape = {
  day: ShortDay;
  meal: SlotMeal;
  dishes: DishPickShape[];
};
type SkippedDayShape = {
  day: ShortDay;
  reason: string;
  author: "rajat" | "tuhina";
  skippedAt: number;
};

const LONG_DAY: Record<ShortDay, LongDay> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
};
// Keyed by the exhaustive `SlotMeal` (the schema's slot-meal source of truth):
// adding a new slot meal to `slotMealValidator` forces a new entry here (and so
// in `finalizeWeek`) at compile time, instead of silently archiving the slot
// under a missing key at runtime — the gap that shipped the original finalizeWeek
// bug (a too-narrow local meal type let the missing "fruit" compile clean).
// `fruit` is only reachable from a legacy week; keeping the mapping is what lets
// such a week finalize into the archive unchanged.
const CAP_MEAL: Record<SlotMeal, CapMeal> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  fruit: "Fruit",
};

// The archive's coarser placement source (`features/engine-v4.md` §10.5, §10.7).
// The live pick distinguishes a swap from a custom one-off because the slow loop
// attributes them differently; the archive does not, because both answer the one
// question its readers ask ("did a human put this here"). Keyed by the exhaustive
// live source union, so adding a live source forces an entry here at compile time
// rather than archiving under a missing key at runtime.
type ArchiveSource = "generated" | "hand";
const ARCHIVE_SOURCE: Record<DishPickShape["source"], ArchiveSource> = {
  generated: "generated",
  swapped: "hand",
  custom: "hand",
};

/**
 * Replaces one position within one (day, meal) slot of `currentWeek` with a
 * custom one-off label (a free-text dish that is not in the library).
 *
 * Signature (per `docs/engineering.md` §3, §7, `features/multi-dish-slots.md`,
 * `features/manual-changes.md`):
 *   addCustomOneOff({
 *     author: "rajat" | "tuhina",
 *     weekStart: string,                     // ISO date of the Monday
 *     day: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat",
 *     meal: "breakfast" | "lunch",
 *     position: number,                      // 0-based within slot.dishes
 *     customLabel: string,
 *     version: number,                       // optimistic concurrency from caller
 *     reason: string,                        // optional, trimmed; may be empty
 *   }) => { ok: true; version: number }
 *      | { ok: false; reason: "version-mismatch" | "no-current-week"
 *                           | "no-such-slot" | "no-such-position" }
 *
 * Behavior:
 *   - Validates `author` via `assertAuthor`; rejects with a `ConvexError` otherwise.
 *   - Trims `customLabel`; rejects with a `ConvexError` if empty.
 *   - Trims `reason`; an empty reason is allowed and stored as "" (every fast-loop
 *     edit makes the reason optional).
 *   - Looks up the `currentWeek` row by `weekStart` via the `by_weekStart` index.
 *     Missing row -> { ok: false, reason: "no-current-week" }.
 *   - If `row.version !== args.version` -> { ok: false, reason: "version-mismatch" }.
 *     Caller is expected to reload and retry.
 *   - Locates the slot by `(day, meal)`. Missing slot ->
 *     { ok: false, reason: "no-such-slot" }.
 *     Locates the position within `slot.dishes`. Out of range ->
 *     { ok: false, reason: "no-such-position" }.
 *   - Patches `slot.dishes[position]` to `{ dishId: null, customLabel,
 *     source: "custom", author, updatedAt: Date.now() }` and increments
 *     `version` by 1. The rest of the slot's dishes are untouched.
 *   - On success ALSO inserts a `manualChanges` row in the same Convex
 *     transaction recording the pre-change pick state, the new custom label,
 *     and the trimmed `reason`. See `features/manual-changes.md`.
 *   - Returns `{ ok: true, version: newVersion }`.
 */
export const addCustomOneOff = mutation({
  args: {
    author: v.string(),
    weekStart: v.string(),
    day: v.union(
      v.literal("Mon"),
      v.literal("Tue"),
      v.literal("Wed"),
      v.literal("Thu"),
      v.literal("Fri"),
      v.literal("Sat"),
    ),
    meal: mealTimeValidator,
    position: v.number(),
    customLabel: v.string(),
    version: v.number(),
    reason: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<
    | { ok: true; version: number }
    | {
        ok: false;
        reason: "version-mismatch" | "no-current-week" | "no-such-slot" | "no-such-position";
      }
  > => {
    assertAuthor(args.author);
    const trimmedLabel = args.customLabel.trim();
    if (trimmedLabel.length === 0) {
      throw new ConvexError("customLabel must not be empty after trimming");
    }
    // The reason is optional on every fast-loop edit (Decision #8 amended): an
    // empty reason is stored as "" and the Changes feed simply shows no note.
    const trimmedReason = args.reason.trim();

    const week = await ctx.db
      .query("currentWeek")
      .withIndex("by_weekStart", (q) => q.eq("weekStart", args.weekStart))
      .unique();
    if (!week) {
      return { ok: false, reason: "no-current-week" };
    }
    if (week.version !== args.version) {
      return { ok: false, reason: "version-mismatch" };
    }

    const slots = week.slots as SlotShape[];
    const slotIndex = slots.findIndex((s) => s.day === args.day && s.meal === args.meal);
    if (slotIndex === -1) {
      return { ok: false, reason: "no-such-slot" };
    }
    const slot = slots[slotIndex];
    if (args.position < 0 || args.position >= slot.dishes.length) {
      return { ok: false, reason: "no-such-position" };
    }

    const existingPick = slot.dishes[args.position];
    const now = Date.now();
    const newPick: DishPickShape = {
      ...existingPick,
      dishId: null,
      customLabel: trimmedLabel,
      source: "custom",
      author: args.author,
      updatedAt: now,
    };
    const newDishes = [...slot.dishes];
    newDishes[args.position] = newPick;
    const newSlot: SlotShape = { ...slot, dishes: newDishes };
    const newSlots = [...slots];
    newSlots[slotIndex] = newSlot;
    const newVersion = week.version + 1;

    await ctx.db.patch(week._id, {
      slots: newSlots,
      version: newVersion,
    });

    // Append-only manual-changes log. Same Convex transaction as the patch
    // above, so both land or neither does. See `features/manual-changes.md`.
    await ctx.db.insert("manualChanges", {
      createdAt: now,
      author: args.author,
      weekStart: args.weekStart,
      day: args.day,
      meal: args.meal,
      position: args.position,
      changeKind: "custom",
      before: {
        dishId: existingPick.dishId,
        customLabel: existingPick.customLabel,
      },
      after: {
        dishId: null,
        customLabel: trimmedLabel,
      },
      reason: trimmedReason,
      status: "queued",
      resolvedAt: null,
      resolvedPr: null,
    });

    return { ok: true, version: newVersion };
  },
});

/**
 * Appends a custom (free-text, not-in-library) dish as an extra dish to one
 * (day, meal) slot of `currentWeek`. This is `addDish` (append + return the new
 * position) carrying `addCustomOneOff`'s custom payload: it pushes a new pick
 * `{ dishId: null, customLabel, source: "custom", ... }` onto `slot.dishes`
 * rather than replacing a position. The captured label later feeds the slow loop
 * to become a real library dish (`MAINTENANCE.md` §1.7).
 *
 * Signature:
 *   appendCustomDish({
 *     author: "rajat" | "tuhina",
 *     weekStart: string,                     // ISO date of the Monday
 *     day: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat",
 *     meal: "breakfast" | "lunch",
 *     customLabel: string,
 *     version: number,                       // optimistic concurrency from caller
 *     reason: string,                        // optional, trimmed; may be empty
 *   }) => { ok: true; version: number; position: number }
 *      | { ok: false; reason: "version-mismatch" | "no-current-week"
 *                           | "no-such-slot" }
 *
 * Behavior mirrors `addDish` and `addCustomOneOff`:
 *   - Validates `author` via `assertAuthor`; rejects with a `ConvexError` otherwise.
 *   - Trims `customLabel`; empty -> ConvexError("customLabel must not be empty after trimming").
 *   - Trims `reason`; an empty reason is allowed and stored as "" (every fast-loop
 *     edit makes the reason optional).
 *   - Looks up `currentWeek` by `weekStart`; missing -> { ok: false, reason: "no-current-week" }.
 *   - Optimistic version check; mismatch -> { ok: false, reason: "version-mismatch" }.
 *   - Locates the `(day, meal)` slot; missing -> { ok: false, reason: "no-such-slot" }.
 *   - PUSHES `{ dishId: null, customLabel: trimmed, source: "custom", author,
 *     updatedAt: now }` onto `slot.dishes` (it does not replace, so there is no
 *     `position` arg and no `no-such-position` failure); bumps `version`.
 *   - No per-day cap check. The cap (`engine/src/cap.ts`) is enforced ONLY at
 *     generation time; the fast loop is deliberately permissive (Principle 4),
 *     and `addDish` already appends past it. Do not add a cap guard here.
 *   - On success ALSO inserts a `manualChanges` row in the same transaction with
 *     `changeKind: "custom"` and `before: { dishId: null, customLabel: null }`
 *     (the append/null convention `addDish` uses, NOT a replaced pick), so the
 *     slow loop must not read this row's `before` as "replaced X"
 *     (`MAINTENANCE.md` §1). It renders as "Added {label}" in the Changes feed.
 *   - Returns `{ ok: true, version: newVersion, position }` (position = new index).
 */
export const appendCustomDish = mutation({
  args: {
    author: v.string(),
    weekStart: v.string(),
    day: v.union(
      v.literal("Mon"),
      v.literal("Tue"),
      v.literal("Wed"),
      v.literal("Thu"),
      v.literal("Fri"),
      v.literal("Sat"),
    ),
    meal: mealTimeValidator,
    customLabel: v.string(),
    version: v.number(),
    reason: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<
    | { ok: true; version: number; position: number }
    | {
        ok: false;
        reason: "version-mismatch" | "no-current-week" | "no-such-slot";
      }
  > => {
    assertAuthor(args.author);
    const trimmedLabel = args.customLabel.trim();
    if (trimmedLabel.length === 0) {
      throw new ConvexError("customLabel must not be empty after trimming");
    }
    // The reason is optional on every fast-loop edit (Decision #8 amended): an
    // empty reason is stored as "" and the Changes feed simply shows no note.
    const trimmedReason = args.reason.trim();

    const week = await ctx.db
      .query("currentWeek")
      .withIndex("by_weekStart", (q) => q.eq("weekStart", args.weekStart))
      .unique();
    if (!week) {
      return { ok: false, reason: "no-current-week" };
    }
    if (week.version !== args.version) {
      return { ok: false, reason: "version-mismatch" };
    }

    const slots = week.slots as SlotShape[];
    const slotIndex = slots.findIndex((s) => s.day === args.day && s.meal === args.meal);
    if (slotIndex === -1) {
      return { ok: false, reason: "no-such-slot" };
    }

    const slot = slots[slotIndex];
    const now = Date.now();
    const newPick: DishPickShape = {
      dishId: null,
      customLabel: trimmedLabel,
      source: "custom",
      author: args.author,
      updatedAt: now,
    };
    const newDishes = [...slot.dishes, newPick];
    const position = newDishes.length - 1;
    const newSlot: SlotShape = { ...slot, dishes: newDishes };
    const newSlots = [...slots];
    newSlots[slotIndex] = newSlot;
    const newVersion = week.version + 1;

    await ctx.db.patch(week._id, {
      slots: newSlots,
      version: newVersion,
    });

    // Append-only manual-changes log, same Convex transaction as the patch above.
    // `before` is the null entry (this is an append, not a replacement), so the
    // slow loop must not infer "replaced X" from it (`MAINTENANCE.md` §1).
    await ctx.db.insert("manualChanges", {
      createdAt: now,
      author: args.author,
      weekStart: args.weekStart,
      day: args.day,
      meal: args.meal,
      position,
      changeKind: "custom",
      before: {
        dishId: null,
        customLabel: null,
      },
      after: {
        dishId: null,
        customLabel: trimmedLabel,
      },
      reason: trimmedReason,
      status: "queued",
      resolvedAt: null,
      resolvedPr: null,
    });

    return { ok: true, version: newVersion, position };
  },
});

/**
 * Finalizes the current week: appends a `weekArchive` row mirroring the
 * `menu_history.md` format and flips `currentWeek.status` to `"final"`. On
 * finalize the week's dishes enter the historical record that drives the §4
 * recency rule on later weeks (`docs/product.md` §3 item 4, `docs/engine.md` §6).
 *
 * Skip-exclusion (`features/design-revamp.md` §1.4 item 3, §1.5): a day in
 * `currentWeek.skippedDays` was not cooked, so its dishes contribute NO archive
 * rows and recency must not see them. The day's `slots` stay intact (restore is
 * lossless); finalize simply omits them from the appended rows. With no skipped
 * days (the common case) every day's dishes archive, exactly as before this
 * behavior existed.
 *
 * Custom one-offs (`dishId === null`) are also omitted: the archive mirrors
 * `MenuHistoryRow`, which keys on a library dish id and name, and a free-text
 * one-off has neither. This matches the grocery list, which likewise skips
 * one-offs (they are not library dishes).
 *
 * A legacy `meal:"fruit"` slot (a week generated before the Fruit of the day was
 * removed, `features/engine-v4.md` §14) still archives, recorded with
 * `meal:"Fruit"`. Finalize tolerates it rather than dropping it: the archive is
 * the eaten record, so a week that was actually cooked with a fruit on it is
 * recorded as cooked. Nothing generates a fruit slot any more, so this path
 * drains on its own.
 *
 * The engine's skip-aware `deriveHistoryRows({ skippedDays })` operates on a
 * `GeneratedWeek` of library `Dish` objects; the live `currentWeek` carries
 * swapped and custom picks instead, so finalize derives the rows directly from
 * the live slots here (applying the same skip + one-off exclusions) rather than
 * re-running the engine against a week the user has since edited.
 *
 *   finalizeWeek({ author, weekStart, version })
 *     => { ok: true; version: number }
 *      | { ok: false; reason: "version-mismatch" | "no-current-week"
 *                           | "already-final" }
 */
export const finalizeWeek = mutation({
  args: {
    author: v.string(),
    weekStart: v.string(),
    version: v.number(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<
    | { ok: true; version: number }
    | { ok: false; reason: "version-mismatch" | "no-current-week" | "already-final" }
  > => {
    assertAuthor(args.author);

    const week = await ctx.db
      .query("currentWeek")
      .withIndex("by_weekStart", (q) => q.eq("weekStart", args.weekStart))
      .unique();
    if (!week) {
      return { ok: false, reason: "no-current-week" };
    }
    if (week.version !== args.version) {
      return { ok: false, reason: "version-mismatch" };
    }
    if (week.status === "final") {
      return { ok: false, reason: "already-final" };
    }

    const skipped = new Set<ShortDay>(
      ((week.skippedDays ?? []) as SkippedDayShape[]).map((s) => s.day),
    );

    // Build archive rows from the live slots, skipping skipped days and custom
    // one-offs. A legacy `meal:"fruit"` slot archives as "Fruit" via
    // `CAP_MEAL["fruit"]`, unchanged. Order follows the
    // slot/position order so the archive reads the way the week was cooked. Dish
    // names come from the baked library (the live pick stores only the id for a
    // library dish); a pick whose id is not in the library is skipped defensively
    // (the swap/add mutations only write library ids, so this is unreachable for
    // real data).
    const nameById = new Map<number, string>(dishes.map((d) => [d.id, d.name]));
    const rows: {
      day: LongDay;
      meal: CapMeal;
      dishName: string;
      dishId: number;
      source: ArchiveSource;
    }[] = [];
    for (const slot of week.slots as SlotShape[]) {
      if (skipped.has(slot.day)) continue;
      for (const pick of slot.dishes) {
        if (pick.dishId === null) continue;
        const dishName = nameById.get(pick.dishId);
        if (dishName === undefined) continue;
        rows.push({
          day: LONG_DAY[slot.day],
          meal: CAP_MEAL[slot.meal],
          dishName,
          dishId: pick.dishId,
          source: ARCHIVE_SOURCE[pick.source],
        });
      }
    }

    const now = Date.now();
    await ctx.db.insert("weekArchive", {
      weekStart: args.weekStart,
      finalizedAt: now,
      rows,
    });

    const newVersion = week.version + 1;
    await ctx.db.patch(week._id, {
      status: "final",
      version: newVersion,
    });

    return { ok: true, version: newVersion };
  },
});
