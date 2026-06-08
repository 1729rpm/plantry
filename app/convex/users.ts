import { mutation } from "./_generated/server.js";
import { v, ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel.js";

/**
 * Upserts the `userProfiles` row keyed by `deviceId`. This mutation IS the
 * author-identification step (see `docs/engineering.md` §8 "Device profile"),
 * so it does NOT itself require an `author` argument. The identity it stores
 * becomes the `author` attached to subsequent fast-loop writes.
 *
 * Signature:
 *   setUserProfile({
 *     deviceId: string,
 *     identity: "rajat" | "tuhina",
 *   }) => Id<"userProfiles">
 *
 * Behavior:
 *   - Validates `identity` is one of `"rajat" | "tuhina"`; rejects with a
 *     `ConvexError` otherwise.
 *   - Looks up the existing row via the `by_deviceId` index.
 *   - If present, patches `identity` only (preserves the original `installedAt`).
 *   - If absent, inserts with `installedAt: Date.now()`.
 *   - Returns the row's `Id<"userProfiles">` in either case.
 */
export const setUserProfile = mutation({
  args: {
    deviceId: v.string(),
    identity: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"userProfiles">> => {
    if (args.identity !== "rajat" && args.identity !== "tuhina") {
      throw new ConvexError(
        `identity must be "rajat" or "tuhina"; received ${JSON.stringify(args.identity)}`,
      );
    }
    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_deviceId", (q) => q.eq("deviceId", args.deviceId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { identity: args.identity });
      return existing._id;
    }
    return await ctx.db.insert("userProfiles", {
      deviceId: args.deviceId,
      identity: args.identity,
      installedAt: Date.now(),
    });
  },
});
