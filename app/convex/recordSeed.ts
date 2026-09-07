import { internalMutation } from "./_generated/server.js";
import { v } from "convex/values";
import { slotMealValidator, type SlotMeal } from "./lib/meals.js";

/**
 * Writes `currentWeek` rows from `RecordWeek`-shaped input, for the DEV deployment.
 *
 * The dev deployment (`lovely-curlew-631`) is empty, so nothing that reads the
 * record (`lib/record.ts`, and stream E2's generation) can be exercised there
 * without first putting weeks in front of it. `scripts/seed-dev-record.mjs` is the
 * only caller, and it is hard-pinned to dev. This is the inverse of
 * `lib/record.ts`: it takes what `loadRecord` returns and lays it back out as
 * stored slots, which is what makes a round trip (seed a record, export it, compare)
 * a real check of the loader.
 *
 * It is NOT a generation path and must never stand in for one: it writes no
 * incidents, consults no library, and applies no composition rule. Every pick it
 * writes is stamped `source: "generated"`, `author: "system"`, exactly as a real
 * generation would stamp an engine placement, so the record read back is shaped
 * like a real week's.
 *
 * Shape notes, all of them deliberate:
 *
 *   - Picks are grouped into one slot per (day, meal), in first-seen order, and
 *     positions follow the order the picks arrive in. A record week's picks are
 *     already in slot-then-position order, so a round trip preserves them.
 *   - `skippedDays` become rows with reason "seed" and author "rajat". A skipped
 *     day still gets its slots written, because that is how the real skip works
 *     (the day's dishes are never removed, so restore is lossless), and it is
 *     precisely what makes the loader's skipped-day filter testable.
 *   - `customPicks` is a dev-only extra with no counterpart in `RecordWeek`, and
 *     that is the point: a `RecordWeek` cannot express a null-`dishId` pick because
 *     the loader has already dropped it. Seeding one is the only way to exercise
 *     the loader's null-pick drop and to give `promoteCustomPick` something to
 *     re-point during the dev smoke.
 *   - `status` is "final" and `version` is 1: a seeded week is a settled past week.
 *   - Upsert on `weekStart`: an existing row for the same Monday is deleted first,
 *     so re-running the seed is idempotent (the same semantics
 *     `generateWeek:generateCurrentWeek` already uses).
 */

const dayValidator = v.union(
  v.literal("Mon"),
  v.literal("Tue"),
  v.literal("Wed"),
  v.literal("Thu"),
  v.literal("Fri"),
  v.literal("Sat"),
);

const pickValidator = v.object({
  day: dayValidator,
  meal: slotMealValidator,
  dishId: v.number(),
});

type Day = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";

type SeedPickShape = {
  dishId: number | null;
  customLabel: string | null;
  source: "generated" | "swapped" | "custom";
  author: "rajat" | "tuhina" | "system";
  updatedAt: number;
};

type SeedSlotShape = {
  day: Day;
  meal: SlotMeal;
  dishes: SeedPickShape[];
};

export const seedRecordWeeks = internalMutation({
  args: {
    weeks: v.array(
      v.object({
        weekStart: v.string(),
        picks: v.array(pickValidator),
        skippedDays: v.array(dayValidator),
        // Absent or null means "written before the v6 cutover", which the loader
        // reads back as a record-only week.
        generatedPlan: v.optional(v.union(v.array(pickValidator), v.null())),
        // Dev-only: free-text picks, so the null-dishId drop and the
        // `promoteCustomPick` guards have something to act on.
        customPicks: v.optional(
          v.array(
            v.object({
              day: dayValidator,
              meal: slotMealValidator,
              customLabel: v.string(),
            }),
          ),
        ),
      }),
    ),
  },
  handler: async (ctx, args): Promise<{ seeded: number; replaced: number }> => {
    const now = Date.now();
    let replaced = 0;

    for (const week of args.weeks) {
      const existing = await ctx.db
        .query("currentWeek")
        .withIndex("by_weekStart", (q) => q.eq("weekStart", week.weekStart))
        .unique();
      if (existing) {
        await ctx.db.delete(existing._id);
        replaced += 1;
      }

      // One slot per (day, meal), in the order the picks first name it.
      const slots: SeedSlotShape[] = [];
      const slotByKey = new Map<string, SeedSlotShape>();
      const slotFor = (day: Day, meal: SlotMeal): SeedSlotShape => {
        const key = `${day}:${meal}`;
        const found = slotByKey.get(key);
        if (found) return found;
        const created: SeedSlotShape = { day, meal, dishes: [] };
        slotByKey.set(key, created);
        slots.push(created);
        return created;
      };

      for (const pick of week.picks) {
        slotFor(pick.day, pick.meal).dishes.push({
          dishId: pick.dishId,
          customLabel: null,
          source: "generated",
          author: "system",
          updatedAt: now,
        });
      }
      for (const custom of week.customPicks ?? []) {
        slotFor(custom.day, custom.meal).dishes.push({
          dishId: null,
          customLabel: custom.customLabel,
          source: "custom",
          author: "rajat",
          updatedAt: now,
        });
      }

      await ctx.db.insert("currentWeek", {
        weekStart: week.weekStart,
        status: "final",
        slots,
        skippedDays: week.skippedDays.map((day) => ({
          day,
          reason: "seed",
          author: "rajat" as const,
          skippedAt: now,
        })),
        generatedPlan: week.generatedPlan ?? undefined,
        version: 1,
      });
    }

    return { seeded: args.weeks.length, replaced };
  },
});
