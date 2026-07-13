import { describe, expect, it } from "vitest";
import { allDishes } from "../src/lib/library.js";
import {
  FAVORITES_EMPTY,
  QUEUE_EMPTY,
  authorLabel,
  formatWhen,
  resolveFavoriteRows,
  resolveQueueRows,
  type FavoriteRow,
  type QueueRow,
} from "../src/components/WishlistScreen.js";

// The wishlist resolves raw Convex rows to display models against the baked
// library and pins the exact empty-state copy. These cover the pure logic; the
// live behaviour (subscriptions, optimistic removal) is exercised by the crawl.

const sample = allDishes[0];

describe("resolveFavoriteRows", () => {
  it("resolves a known dish id to its library name and meta", () => {
    const rows: FavoriteRow[] = [
      { _id: "f1", createdAt: 1_700_000_000_000, author: "rajat", dishId: sample.id },
    ];
    const [resolved] = resolveFavoriteRows(rows);
    expect(resolved.id).toBe("f1");
    expect(resolved.dishId).toBe(sample.id);
    expect(resolved.name).toBe(sample.name);
    expect(resolved.dish?.id).toBe(sample.id);
    expect(resolved.meta.length).toBeGreaterThan(0);
  });

  it("degrades a dish id absent from the library to a fallback name", () => {
    const rows: FavoriteRow[] = [{ _id: "f2", createdAt: 1, author: "tuhina", dishId: 999_999 }];
    const [resolved] = resolveFavoriteRows(rows);
    expect(resolved.name).toBe("From the library");
    expect(resolved.dish).toBeUndefined();
  });

  it("preserves row order (createdAt ascending is fixed upstream)", () => {
    const rows: FavoriteRow[] = [
      { _id: "a", createdAt: 1, author: "rajat", dishId: allDishes[0].id },
      { _id: "b", createdAt: 2, author: "rajat", dishId: allDishes[1].id },
    ];
    expect(resolveFavoriteRows(rows).map((r) => r.id)).toEqual(["a", "b"]);
  });
});

describe("resolveQueueRows", () => {
  it("carries the saved reason and builds the saved-by meta line", () => {
    const when = new Date(2026, 6, 13, 10, 30).getTime();
    const rows: QueueRow[] = [
      { _id: "q1", createdAt: when, author: "tuhina", dishId: sample.id, reason: "loves rajma" },
    ];
    const [resolved] = resolveQueueRows(rows);
    expect(resolved.name).toBe(sample.name);
    expect(resolved.reason).toBe("loves rajma");
    expect(resolved.savedMeta).toBe("Saved by Tuhina · Jul 13");
  });
});

describe("formatWhen", () => {
  it("formats a local-calendar date as short month and day", () => {
    // Constructed and formatted in local time on both sides, so the assertion is
    // stable regardless of the host timezone.
    expect(formatWhen(new Date(2026, 0, 5).getTime())).toBe("Jan 5");
    expect(formatWhen(new Date(2026, 11, 31).getTime())).toBe("Dec 31");
  });
});

describe("authorLabel", () => {
  it("capitalizes each identity", () => {
    expect(authorLabel("rajat")).toBe("Rajat");
    expect(authorLabel("tuhina")).toBe("Tuhina");
  });
});

describe("empty-state copy", () => {
  it("matches the spec wording exactly", () => {
    expect(FAVORITES_EMPTY).toBe("Favorites show up about once a week in the generated menu.");
    expect(QUEUE_EMPTY).toBe("Saved dishes get placed into next week's menu, oldest first.");
  });

  it("uses no em or en dashes", () => {
    for (const copy of [FAVORITES_EMPTY, QUEUE_EMPTY]) {
      expect(copy).not.toMatch(/[–—]/);
    }
  });
});
