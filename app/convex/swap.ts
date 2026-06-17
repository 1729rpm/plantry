import { query, mutation } from "./_generated/server.js";
import { v, ConvexError } from "convex/values";
import { dishes, ingredients, catalog } from "@plantry/engine/library";
import { history } from "@plantry/engine/history";
import { rankPickerAlternatives } from "@plantry/engine";
import type { Dish, Season, MenuHistoryRow } from "@plantry/engine";
import { assertAuthor } from "./lib/author.js";

type ShortDay = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";
// The breakfast/lunch meals (meal-time pools). The Fruit of the day adds the
// standalone "fruit" slot (docs/engine.md §3.3); SlotMealValue is the full set a
// stored slot can carry. Breakfast/lunch are pooled by meal-time; fruit is
// pooled by Category=Fruit.
type LowerMeal = "breakfast" | "lunch";
type SlotMealValue = LowerMeal | "fruit";

type SlotAuthor = "rajat" | "tuhina" | "system";
type DishPickShape = {
  dishId: number | null;
  customLabel: string | null;
  source: "generated" | "swapped" | "custom";
  author: SlotAuthor;
  updatedAt: number;
};
type SlotShape = {
  day: ShortDay;
  meal: SlotMealValue;
  dishes: DishPickShape[];
};

/**
 * Bangalore seasons per `docs/product.md` §1. Duplicated inline from
 * `generateWeek.ts` (two callers, per `docs/product.md` §4 Principle 8
 * "three similar rows beat a premature abstraction"). Reads the month directly
 * from the ISO date string ("YYYY-MM-DD"); no Date object or timezone math.
 */
function seasonOf(isoDate: string): Season {
  const month = Number.parseInt(isoDate.slice(5, 7), 10);
  if (month >= 3 && month <= 5) return "Summer";
  if (month >= 6 && month <= 9) return "Monsoon";
  return "Winter";
}

const LONG_DAY: Record<ShortDay, MenuHistoryRow["day"]> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
};

/**
 * Collects the picks already on the live week, optionally excluding one
 * (day, meal, position). Used to seed the §6 consolidation ledger and the
 * within-week synthetic history that drives §4 step 1 longest-unused. The
 * caller passes `exclude` so the slot/position being ranked does not
 * double-count its own current pick.
 */
function collectCurrentWeekPicks(
  slots: ReadonlyArray<SlotShape>,
  exclude: { day: ShortDay; meal: SlotMealValue; position: number } | null,
): Dish[] {
  const libraryById = new Map<number, Dish>(dishes.map((d) => [d.id, d]));
  const picks: Dish[] = [];
  for (const slot of slots) {
    for (let position = 0; position < slot.dishes.length; position += 1) {
      if (
        exclude &&
        slot.day === exclude.day &&
        slot.meal === exclude.meal &&
        position === exclude.position
      ) {
        continue;
      }
      const dishId = slot.dishes[position].dishId;
      if (dishId === null) continue;
      const dish = libraryById.get(dishId);
      if (dish) picks.push(dish);
    }
  }
  return picks;
}

/**
 * Builds the non-restrictive candidate pool for the swap picker. For a
 * breakfast/lunch slot the pool is every dish that is Active, in season, and
 * not Category=Fruit: it is generic across meal-time, so a breakfast dish is
 * reachable from a lunch slot and vice versa (`features/picker-generic-search.md`).
 * This is deliberately broader than the engine's composition-based pools (Menu 1
 * HP + partner + carb, etc.); the user is offered every Active, in-season dish
 * and §3 eligibility violations (including the meal-time mismatch a cross-meal
 * pick creates) are tolerated at swap time so the slow loop can learn from the
 * resulting incidents. The default head order still leads with slot-meal-matching
 * dishes (see `getSlotAlternatives`); meal-time is a swap-time ordering signal,
 * not a hard pool filter.
 */
function broadPool(meal: SlotMealValue, season: Season): Dish[] {
  // The Fruit of the day's pool is category-based (docs/engine.md §3.3): every
  // Active, in-season, Category=Fruit dish. This is the swap-time analogue of the
  // generation-time fruit pool (engine `fruitOfDayPool`). The fruit slot stays
  // category-locked; the generic-search relaxation applies to breakfast/lunch
  // only (Decision 2).
  if (meal === "fruit") {
    return dishes.filter((d) => {
      if (d.active !== "Yes") return false;
      if (d.category !== "Fruit") return false;
      if (d.seasons === "All") return true;
      return d.seasons.includes(season);
    });
  }
  // Breakfast/lunch pool: generic across meal-time. Fruit is excluded because it
  // belongs to its own slot and must not surface in a meal swap (Decision 3).
  return dishes.filter((d) => {
    if (d.active !== "Yes") return false;
    if (d.category === "Fruit") return false;
    if (d.seasons === "All") return true;
    return d.seasons.includes(season);
  });
}

/**
 * Builds the synthetic within-week history the picker ranking reads for its
 * recency term (docs/engine.md §5). Picks already on the plate (other slots,
 * other positions) record a virtual cooking on `weekStart`, so the picker
 * treats them as recently cooked and pushes them down the ranked list. The day
 * tag is cosmetic for recency (the ranking keys on dishId + weekStart), so we
 * tag every synthetic row with the slot's day uniformly.
 */
function buildSyntheticHistory(
  weekStart: string,
  day: ShortDay,
  meal: SlotMealValue,
  currentWeekPicks: Dish[],
): MenuHistoryRow[] {
  // The history row's `meal` field is cosmetic for the recency term (the ranking
  // keys on dishId + weekStart, not meal), and MenuHistoryRow.meal only admits
  // Breakfast | Lunch. The fruit slot has no meal-time, so its synthetic rows are
  // tagged "Breakfast" uniformly; this never affects ordering.
  const historyMeal = meal === "lunch" ? "Lunch" : "Breakfast";
  return currentWeekPicks.map((d) => ({
    weekStart,
    day: LONG_DAY[day],
    meal: historyMeal,
    dishName: d.name,
    dishId: d.id,
  }));
}

/** The dishes already placed on `day` (any meal, any position), library only. */
function dishesOnDay(slots: ReadonlyArray<SlotShape>, day: ShortDay): Dish[] {
  const libraryById = new Map<number, Dish>(dishes.map((d) => [d.id, d]));
  const onDay: Dish[] = [];
  for (const slot of slots) {
    if (slot.day !== day) continue;
    for (const pick of slot.dishes) {
      if (pick.dishId === null) continue;
      const dish = libraryById.get(pick.dishId);
      if (dish) onDay.push(dish);
    }
  }
  return onDay;
}

/**
 * Returns the engine-ranked list of alternative dishes for one position within
 * one (day, meal) slot of the current week. Drives the swap UI's
 * "Replace with..." picker.
 *
 * Signature (per `features/multi-dish-slots.md`):
 *   getSlotAlternatives({
 *     weekStart: string,
 *     day: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat",
 *     meal: "breakfast" | "lunch",
 *     position: number,                            // 0-based within slot.dishes
 *     limit?: number,                              // default 10
 *   }) => Dish[]
 *
 * Behavior (non-restrictive, generic-search picker):
 *   - Looks up the `currentWeek` row. Missing -> ConvexError.
 *   - Builds the broad pool: for a breakfast/lunch slot, every Active, in-season,
 *     non-Fruit dish regardless of its own meal-time (so a breakfast dish is
 *     reachable from a lunch slot and vice versa, per
 *     `features/picker-generic-search.md`); for the fruit slot, the Category=Fruit
 *     pool. NO per-position eligibility filter (no HP/partner/carb/Option A-B-C
 *     narrowing). This is the deliberate fast-loop affordance: the user can
 *     land on any dish; §3 violations (including the meal-time mismatch a
 *     cross-meal pick creates) are signal for the slow loop, not errors the
 *     fast loop blocks. See `docs/product.md` §4 Principle 4.
 *   - Ranks via the engine's picker ranking (`rankPickerAlternatives`,
 *     docs/engine.md §5), NOT §4 selection priority. The head ("fits this day")
 *     is the not-already-on-the-day dishes ranked by recency plus protein-band
 *     similarity to the dish being replaced; the tail is the same-day repeats.
 *   - Stable-partitions the ranked result so dishes whose own meal-time matches
 *     the slot lead and cross-meal dishes follow, each group keeping its ranked
 *     order. This is caller-side, after the engine ranking (the engine ignores
 *     its `meal` arg). The full partitioned array is returned (search and pills
 *     still reach every dish); only the default suggested head order changes.
 *     The fruit slot needs no partition (its pool is single-purpose).
 *   - Synthetic within-week history from the live week's other picks (the
 *     slot/position being ranked is excluded so its current pick does not count
 *     against itself) feeds the recency term.
 *   - Filters out the currently-picked dish at this position so the user is
 *     not offered the same dish.
 *   - Returns at most `limit` (default 10) Dish objects.
 */
export const getSlotAlternatives = query({
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
    meal: v.union(v.literal("breakfast"), v.literal("lunch"), v.literal("fruit")),
    position: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Dish[]> => {
    const week = await ctx.db
      .query("currentWeek")
      .withIndex("by_weekStart", (q) => q.eq("weekStart", args.weekStart))
      .unique();
    if (!week) {
      throw new ConvexError("no current week for this weekStart");
    }

    const limit = args.limit ?? 10;
    const season = seasonOf(args.weekStart);

    const slots = week.slots as SlotShape[];
    const currentSlot = slots.find((s) => s.day === args.day && s.meal === args.meal);
    const currentDishId =
      currentSlot && currentSlot.dishes[args.position]
        ? currentSlot.dishes[args.position].dishId
        : null;
    // The dish being replaced: drives the picker's protein-band similarity term
    // (docs/engine.md §5). Null when the position is a custom one-off (no
    // library id) — the picker then ranks by recency only.
    const outgoingDish =
      currentDishId === null ? undefined : dishes.find((d) => d.id === currentDishId);

    const currentWeekPicks = collectCurrentWeekPicks(slots, {
      day: args.day,
      meal: args.meal,
      position: args.position,
    });

    const syntheticHistory = buildSyntheticHistory(
      args.weekStart,
      args.day,
      args.meal,
      currentWeekPicks,
    );

    const pool = broadPool(args.meal, season);

    const ranked = rankPickerAlternatives({
      pool,
      // The engine Meal type is Breakfast | Lunch and the ranking ignores it
      // (it only orders the pre-filtered pool by recency + protein band; the
      // pool is already category-filtered for fruit). "Breakfast" is a harmless
      // placeholder for the fruit slot.
      meal: args.meal === "lunch" ? "Lunch" : "Breakfast",
      dishesOnDay: dishesOnDay(slots, args.day),
      history: [...history, ...syntheticHistory],
      outgoingDish,
      ingredients,
      catalog,
    });

    const filtered = currentDishId === null ? ranked : ranked.filter((d) => d.id !== currentDishId);

    // Stable-partition so slot-meal-matching dishes lead and cross-meal dishes
    // follow, each group preserving its ranked order (the engine ranking does not
    // read meal-time). This only reorders the default suggested head; the full
    // pool is still returned so the frontend's search and pills reach every dish.
    // The fruit slot's pool is single-purpose, so it is returned as-is.
    if (args.meal === "fruit") {
      return filtered.slice(0, limit);
    }
    const engineMeal = args.meal === "breakfast" ? "Breakfast" : "Lunch";
    const slotMeal: Dish[] = [];
    const crossMeal: Dish[] = [];
    for (const dish of filtered) {
      if (dish.time === engineMeal) slotMeal.push(dish);
      else crossMeal.push(dish);
    }
    return [...slotMeal, ...crossMeal].slice(0, limit);
  },
});

/**
 * Replaces one position within one (day, meal) slot of `currentWeek` with a
 * different library dish. Drives the swap UI's confirmation step.
 *
 * Signature (per `features/multi-dish-slots.md` + `features/manual-changes.md`):
 *   swapDish({
 *     author: "rajat" | "tuhina",
 *     weekStart: string,
 *     day: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat",
 *     meal: "breakfast" | "lunch",
 *     position: number,
 *     newDishId: number,
 *     version: number,
 *     reason: string,                              // optional, trimmed; may be empty
 *   }) => { ok: true; version: number }
 *      | { ok: false; reason: "version-mismatch" | "no-current-week"
 *                           | "no-such-slot" | "no-such-position"
 *                           | "dish-not-in-library"
 *                           | "dish-is-fruit"
 *                           | "dish-not-fruit"
 *                           | "dish-not-active-or-in-season" }
 *
 * Behavior (non-restrictive, generic-search):
 *   - Validates `author`; missing/empty author throws ConvexError.
 *   - Trims `reason`; an empty reason is allowed and stored as "" (the replace
 *     flow makes the reason optional).
 *   - Looks up `currentWeek` by `weekStart`. Missing -> `no-current-week`.
 *   - Optimistic concurrency: `row.version !== args.version` ->
 *     `version-mismatch`.
 *   - Locates the slot by `(day, meal)`. Missing -> `no-such-slot`.
 *     Locates the position within `slot.dishes`. Out of range ->
 *     `no-such-position`.
 *   - Validates `newDishId` against the baked library. Missing ->
 *     `dish-not-in-library`. For a breakfast/lunch slot, meal-time is NOT a hard
 *     filter: a cross-meal dish (a breakfast dish into a lunch slot or vice
 *     versa) is accepted, mirroring the generic pool, so the resulting §3
 *     mismatch becomes slow-loop signal. The only category invariant on a meal
 *     slot is the inverse of the fruit slot's: a Category=Fruit dish is rejected
 *     with `dish-is-fruit` (fruit belongs to its own slot). The fruit slot keeps
 *     its `dish-not-fruit` guard. Active+season stays a hard filter in both:
 *     a non-Active or out-of-season dish rejects with
 *     `dish-not-active-or-in-season`. Beyond these the swap is accepted: §3
 *     composition eligibility (HP/Option A/B/C/carb-position) is NOT
 *     enforced. See the deliberate design note on `getSlotAlternatives`.
 *   - Patches `slot.dishes[position]` to `{ dishId: newDishId, customLabel:
 *     null, source: "swapped", author, updatedAt: Date.now() }`. The rest of
 *     the slot's dishes are untouched.
 *   - On success ALSO inserts a `manualChanges` row in the same Convex
 *     transaction (atomic: both writes land or neither does) capturing the
 *     `before` and `after` pick state and the trimmed `reason`. The slot's
 *     state immediately before this mutation seeds `before` (NOT the original
 *     generated pick; reflects the trajectory).
 */
export const swapDish = mutation({
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
    meal: v.union(v.literal("breakfast"), v.literal("lunch"), v.literal("fruit")),
    position: v.number(),
    newDishId: v.number(),
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
        reason:
          | "version-mismatch"
          | "no-current-week"
          | "no-such-slot"
          | "no-such-position"
          | "dish-not-in-library"
          | "dish-is-fruit"
          | "dish-not-fruit"
          | "dish-not-active-or-in-season";
      }
  > => {
    assertAuthor(args.author);
    // The reason is optional on a swap (the replace flow shows dish details
    // first and offers an optional reason; an empty reason still goes through).
    // We trim and store whatever is given, including an empty string.
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

    const newDish = dishes.find((d) => d.id === args.newDishId);
    if (!newDish) {
      return { ok: false, reason: "dish-not-in-library" };
    }

    // Category invariants. The fruit slot validates by Category=Fruit; a meal
    // slot validates by the inverse (no fruit), mirroring the generic pool. Meal-
    // time is NOT enforced for a meal slot: a cross-meal dish is a deliberate,
    // accepted pick (generic-search). Both keep the Active + in-season hard
    // filter below.
    if (args.meal === "fruit") {
      if (newDish.category !== "Fruit") {
        return { ok: false, reason: "dish-not-fruit" };
      }
    } else {
      if (newDish.category === "Fruit") {
        return { ok: false, reason: "dish-is-fruit" };
      }
    }
    if (newDish.active !== "Yes") {
      return { ok: false, reason: "dish-not-active-or-in-season" };
    }
    const season = seasonOf(args.weekStart);
    if (newDish.seasons !== "All" && !newDish.seasons.includes(season)) {
      return { ok: false, reason: "dish-not-active-or-in-season" };
    }

    const existingPick = slot.dishes[args.position];
    const now = Date.now();
    const newPick: DishPickShape = {
      ...existingPick,
      dishId: args.newDishId,
      customLabel: null,
      source: "swapped",
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
      changeKind: "swap",
      before: {
        dishId: existingPick.dishId,
        customLabel: existingPick.customLabel,
      },
      after: {
        dishId: args.newDishId,
        customLabel: null,
      },
      reason: trimmedReason,
      status: "queued",
      resolvedAt: null,
      resolvedPr: null,
    });

    return { ok: true, version: newVersion };
  },
});
