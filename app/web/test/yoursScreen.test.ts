import { describe, expect, it } from "vitest";
import { allDishes } from "../src/lib/library.js";
import {
  FAVORITES_EMPTY,
  WISHLIST_EMPTY,
  authorName,
  favoriteName,
} from "../src/components/YoursScreen.js";
import type { FavoriteRow } from "../src/lib/useFavorites.js";
import {
  wishlistAddedToast,
  wishlistRemovedToast,
} from "../src/lib/useWishlist.js";

// The Yours tab's pure display logic and the pinned copy. Live behaviour
// (subscriptions, optimistic add/remove, the Use flow) is exercised by the
// full-flow crawl over seeded Convex rows.

describe("empty-state copy", () => {
  it("matches the handoff wording exactly", () => {
    expect(FAVORITES_EMPTY).toBe(
      "No favorites yet. A favorite gets a place in every week's menu.",
    );
    expect(WISHLIST_EMPTY).toBe(
      "Nothing on the wishlist. Mark a dish from Explore or any dish page.",
    );
  });

  it("uses no em or en dashes anywhere in the visible copy", () => {
    const copy = [
      FAVORITES_EMPTY,
      WISHLIST_EMPTY,
      wishlistAddedToast("Dosa"),
      wishlistRemovedToast("Dosa"),
    ];
    for (const line of copy) expect(line).not.toMatch(/[–—]/);
  });
});

describe("authorName", () => {
  it("capitalizes each identity", () => {
    expect(authorName("rajat")).toBe("Rajat");
    expect(authorName("tuhina")).toBe("Tuhina");
  });
});

describe("favoriteName", () => {
  const sample = allDishes[0];

  it("resolves a library favorite to its dish name", () => {
    const row: FavoriteRow = { _id: "f1", createdAt: 1, author: "rajat", dishId: sample.id };
    expect(favoriteName(row)).toBe(sample.name);
  });

  it("uses the free-text label for a custom favorite", () => {
    const row: FavoriteRow = {
      _id: "f2",
      createdAt: 1,
      author: "tuhina",
      customLabel: "Avocado toast",
    };
    expect(favoriteName(row)).toBe("Avocado toast");
  });

  it("degrades a stale library id to a fallback so the row stays removable", () => {
    const row: FavoriteRow = { _id: "f3", createdAt: 1, author: "rajat", dishId: 999_999 };
    expect(favoriteName(row)).toBe("From the library");
  });
});

describe("wishlist toast copy", () => {
  it("confirms an add and a remove with the dish name", () => {
    expect(wishlistAddedToast("Chana masala")).toBe("Chana masala is on your wishlist");
    expect(wishlistRemovedToast("Chana masala")).toBe(
      "Removed Chana masala from your wishlist",
    );
  });
});
