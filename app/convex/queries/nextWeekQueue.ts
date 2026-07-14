import { query } from "../_generated/server.js";
import type { Doc } from "../_generated/dataModel.js";

/**
 * DEPRECATED, retained as an inert no-op stub (`features/wishlist-favorites-v2` §5).
 * "Save for next week" is retired, but this backend deploys before the frontend that
 * removes the subscription (Stream B), so the currently-deployed prod PWA still reads
 * `listQueuedNextWeek` from the old wishlist screen. The stub keeps the name and
 * signature but always returns an empty list (the queue is wiped and never written
 * again), so the old UI renders an empty section rather than throwing. Removed in the
 * same follow-up PR that drops the `nextWeekQueue` table.
 */
export const listQueuedNextWeek = query({
  args: {},
  handler: async (): Promise<Doc<"nextWeekQueue">[]> => {
    return [];
  },
});
