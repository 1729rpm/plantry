import { internalMutation } from "./_generated/server.js";
import type { Id } from "./_generated/dataModel.js";

/** Inserts one sample currentWeek row valid against the schema; returns its id. */
export const seedCurrentWeek = internalMutation({
  args: {},
  handler: async (ctx): Promise<Id<"currentWeek">> => {
    const now = Date.now();
    const weekStart = "2026-06-08";

    const id = await ctx.db.insert("currentWeek", {
      weekStart,
      status: "draft",
      version: 1,
      slots: [
        {
          day: "Mon",
          meal: "breakfast",
          dishId: 1,
          customLabel: null,
          source: "generated",
          author: "system",
          updatedAt: now,
        },
        {
          day: "Mon",
          meal: "lunch",
          dishId: 2,
          customLabel: null,
          source: "generated",
          author: "system",
          updatedAt: now,
        },
        {
          day: "Tue",
          meal: "breakfast",
          dishId: 3,
          customLabel: null,
          source: "generated",
          author: "system",
          updatedAt: now,
        },
        {
          day: "Tue",
          meal: "lunch",
          dishId: 4,
          customLabel: null,
          source: "generated",
          author: "system",
          updatedAt: now,
        },
        {
          day: "Wed",
          meal: "breakfast",
          dishId: 5,
          customLabel: null,
          source: "generated",
          author: "system",
          updatedAt: now,
        },
        {
          day: "Wed",
          meal: "lunch",
          dishId: 6,
          customLabel: null,
          source: "generated",
          author: "system",
          updatedAt: now,
        },
        {
          day: "Thu",
          meal: "breakfast",
          dishId: 7,
          customLabel: null,
          source: "generated",
          author: "system",
          updatedAt: now,
        },
        {
          day: "Thu",
          meal: "lunch",
          dishId: 8,
          customLabel: null,
          source: "generated",
          author: "system",
          updatedAt: now,
        },
        {
          day: "Fri",
          meal: "breakfast",
          dishId: 9,
          customLabel: null,
          source: "generated",
          author: "system",
          updatedAt: now,
        },
        {
          day: "Fri",
          meal: "lunch",
          dishId: 10,
          customLabel: null,
          source: "generated",
          author: "system",
          updatedAt: now,
        },
        {
          day: "Sat",
          meal: "lunch",
          dishId: 11,
          customLabel: null,
          source: "generated",
          author: "system",
          updatedAt: now,
        },
      ],
    });

    return id;
  },
});
