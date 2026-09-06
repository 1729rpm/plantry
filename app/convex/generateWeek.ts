import { internalMutation } from "./_generated/server.js";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel.js";
import { dishes, ingredients, catalog } from "@plantry/engine/library";
import { generateWeekV6, type GeneratedWeekV6, type Season } from "@plantry/engine";
import type { SlotMeal } from "./lib/meals.js";
import { loadRecord } from "./lib/record.js";

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
 * resulting week into Convex. Not browser-callable: the EM (or a future
 * scheduled action) triggers it via `npx convex run`. The PWA renders whatever
 * `getCurrentWeek` returns.
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
 * Inputs (`features/engine-v6.md` §12, the backend contract). Everything the
 * engine reads derives from persisted data, so a generation is reproducible from
 * the database alone:
 *
 *   - **The record** (§2.1): every `currentWeek` row whose `weekStart` is earlier
 *     than the week being generated, as-eaten (swaps, adds and deletes applied,
 *     skipped days and custom one-offs removed), read by `loadRecord`. Whatever
 *     its `status`: a draft week the household has been eating out of all week is
 *     as much a record of what was eaten as a finalized one. `weekArchive` and the
 *     baked seed history are NOT read; the archive under-reports edited weeks and
 *     the seed carries pre-correction menu shapes the household has since edited
 *     away (§13). `data/menu_history.md` stays in the repo for provenance only.
 *   - **The favorites** (§8): every library-dish `favorites` row, createdAt
 *     ascending, so the oldest win when the set overflows the week's capacity. A
 *     custom (free-text) favorite carries no `dishId` and is display-only, so it
 *     is skipped. An empty list makes the pinning pass a no-op.
 *   - **The season**, read off `weekStart`, and the baked library.
 *   - **Nutrition** (`ingredients` plus `catalog`): the per-dish macro inputs the
 *     §7 exploration score's protein-band signal reads. Optional to the engine,
 *     which cannot import the baked library itself, so production passes it
 *     explicitly or that one signal reads zero for every candidate.
 *
 * The cutover week is derived by the engine, never configured: the earliest
 * record week carrying a `generatedPlan`, or this week when none does (§12).
 *
 * Output: the week's slots, plus `generatedPlan`, the (day, meal, dishId) list the
 * engine placed. Persisting it is what lets the §3.1 ledger replay charge the
 * engine's own placements and tell them apart from later hand edits by set
 * difference alone.
 *
 * Incidents. Three kinds, all `source: "engine"` with `context: { weekStart,
 * weekId }`:
 *   - one `warn` per engine incident (`GeneratedWeekV6.incidents`, for example
 *     "Friday over cap (5), dropped: Rajma", or a day whose anchor no dish
 *     satisfies);
 *   - one `warn` for the week naming the §8 favorites that did not survive into
 *     the final week, so the slow loop sees a real "your favorites did not all
 *     fit" signal while the fast loop stays silent;
 *   - one `info` per §6 step 6 constraint repair, and one `warn` per day whose
 *     protected items alone break the §5.1 prep ceiling. Repairs are routine and
 *     expected, so they read as a trail of what the constraint pass had to move;
 *     only a breach the pass could not clear is a warning (§11 threshold 10).
 *
 * The count is returned so the caller can see at a glance whether the generation
 * produced anything worth inspecting.
 */
export const generateCurrentWeek = internalMutation({
  args: {
    weekStart: v.string(),
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

    // §8 favorites: the household's standing favorites list drives the engine's
    // guaranteed-placement pass. Library-dish rows only, createdAt ascending.
    const favoriteRows = await ctx.db.query("favorites").collect();
    favoriteRows.sort((a, b) => a.createdAt - b.createdAt);
    const favoriteDishIds = favoriteRows
      .map((row) => row.dishId)
      .filter((id): id is number => id !== undefined);

    // §2.1: the household record, every week before this one, as-eaten.
    const record = await loadRecord(ctx, args.weekStart);

    // §6: replay and accrue the ledger, pin favorites, take the one exploration
    // pick, fill the plan, assign days, run the constraint pass, then the §9 cap.
    const generated: GeneratedWeekV6 = generateWeekV6({
      weekStart: args.weekStart,
      season,
      library: dishes,
      record,
      favoriteDishIds,
      nutrition: { ingredients, catalog },
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
      // §9 Fruit of the day: one Category=Fruit dish per day Mon-Sat, stored as
      // its own `meal: "fruit"` slot with a single dish, alongside breakfast and
      // lunch. Outside the item cap, so it is appended after the capped meal slots.
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
      // §12: the engine's own placements, persisted beside the week so the §3.1
      // replay can charge them and tell them apart from later hand edits.
      generatedPlan: generated.generatedPlan,
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

    let incidentCount = generated.incidents.length;

    const nameOf = (dishId: number): string =>
      dishes.find((d) => d.id === dishId)?.name ?? `dish ${dishId}`;

    // §8: one warn per week naming the favorites that did not survive into the
    // final week, whether because no slot accepted one, the constraint pass
    // replaced one to clear a hard rule, or the §9 cap dropped one. No row when
    // every favorite landed.
    if (generated.unplacedFavorites.length > 0) {
      const names = generated.unplacedFavorites.map(nameOf);
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

    // §6 step 6: one info row per deterministic repair, in the order the pass made
    // them. A repair either replaces the offending dish with the next-ranked
    // alternative from its own pool, or swaps whole plates between two days.
    for (const repair of generated.diagnostics.repairs) {
      const what =
        repair.swappedWithDay !== null
          ? `swapped the ${repair.meal} plates of ${repair.day} and ${repair.swappedWithDay}`
          : repair.addedDishId === null
            ? `dropped ${nameOf(repair.removedDishId ?? -1)}`
            : repair.removedDishId === null
              ? `added ${nameOf(repair.addedDishId)}`
              : `replaced ${nameOf(repair.removedDishId)} with ${nameOf(repair.addedDishId)}`;
      await ctx.db.insert("incidents", {
        createdAt: now,
        source: "engine",
        severity: "info",
        context: { weekStart: args.weekStart, weekId, repair },
        message: `Constraint repair (${repair.constraint}) on ${repair.day} ${repair.meal}: ${what}`,
        resolvedAt: null,
      });
      incidentCount += 1;
    }

    // §5.1 and §11 threshold 10: a day whose protected items alone exceed the
    // 120-minute prep ceiling cannot be brought back inside it by dropping
    // optional items, so it is a warning rather than a repair trail. A breach the
    // pass could still have cleared is reported in the diagnostics, not logged.
    for (const breach of generated.diagnostics.prepCeilingBreaches) {
      if (!breach.unrepairable) continue;
      await ctx.db.insert("incidents", {
        createdAt: now,
        source: "engine",
        severity: "warn",
        context: { weekStart: args.weekStart, weekId, prepMinutes: breach.prepMinutes },
        message:
          `${breach.day} needs ${breach.prepMinutes} active minutes, over the 120-minute ` +
          `prep ceiling, and its protected items alone are over it`,
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
