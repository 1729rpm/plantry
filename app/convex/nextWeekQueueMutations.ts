import { mutation } from "./_generated/server.js";
import { v } from "convex/values";

/**
 * DEPRECATED, retained as an inert no-op stub (`features/wishlist-favorites-v2` §5).
 * "Save for next week" is retired, but this backend deploys before the frontend that
 * removes the call (Stream B), so the currently-deployed prod PWA still invokes
 * `removeFromNextWeekQueue` from the old wishlist screen. The stub keeps the name and
 * signature but performs NO writes and returns a benign success shape, so the old UI
 * neither throws nor writes. Because it writes nothing, no fresh rows appear after the
 * migration wipe, so the follow-up schema-drop still validates. Removed in the same
 * follow-up PR that drops the `nextWeekQueue` table.
 *
 * The former internal `markQueueDropped` (slow-loop mark-applied path) is intentionally
 * not restored here; its cleanup is tracked separately by the EM as an ops-doc reconcile.
 */
export const removeFromNextWeekQueue = mutation({
  args: {
    author: v.string(),
    queueId: v.id("nextWeekQueue"),
  },
  handler: async (): Promise<{ ok: true }> => {
    return { ok: true };
  },
});
