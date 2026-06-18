import { describe, expect, it } from "vitest";
import { maxCreatedAt, unseenOtherCount } from "../src/components/ChangesScreen.js";
import type { Identity } from "../src/lib/types.js";

// unseenOtherCount is the Changes nav-badge logic: count menu edits by the OTHER
// user that the viewer has not yet seen (author !== identity AND createdAt >
// lastSeenAt). These tests pin the rules the badge must satisfy: self-authored
// rows never count, the lastSeenAt boundary is exclusive, and a default of 0
// surfaces every pre-existing other-author row on first open.

type Row = { author: Identity; createdAt: number };

function row(author: Identity, createdAt: number): Row {
  return { author, createdAt };
}

describe("unseenOtherCount", () => {
  const viewer: Identity = "rajat";
  const other: Identity = "tuhina";

  it("is zero when every change is self-authored", () => {
    const changes = [row(viewer, 100), row(viewer, 200), row(viewer, 300)];
    expect(unseenOtherCount(changes, viewer, 0)).toBe(0);
  });

  it("counts only other-author rows strictly newer than lastSeenAt", () => {
    const changes = [
      row(other, 50), // seen (<= marker)
      row(other, 100), // seen (== marker, exclusive boundary)
      row(other, 150), // unseen
      row(other, 250), // unseen
      row(viewer, 300), // self, never counts even though newest
    ];
    expect(unseenOtherCount(changes, viewer, 100)).toBe(2);
  });

  it("treats createdAt === lastSeenAt as seen, not counted (exclusive boundary)", () => {
    const changes = [row(other, 100)];
    expect(unseenOtherCount(changes, viewer, 100)).toBe(0);
    expect(unseenOtherCount(changes, viewer, 99)).toBe(1);
  });

  it("with default lastSeenAt = 0 counts all other-author rows", () => {
    const changes = [row(other, 10), row(other, 20), row(viewer, 30)];
    expect(unseenOtherCount(changes, viewer, 0)).toBe(2);
  });

  it("counts from the other identity's point of view symmetrically", () => {
    const changes = [row(viewer, 10), row(other, 20)];
    // Tuhina viewing: only Rajat's row counts.
    expect(unseenOtherCount(changes, other, 0)).toBe(1);
  });

  it("worked example: 2 other + 1 self, mark seen, 1 more other, 3 more self", () => {
    // Other makes 2 edits, viewer makes 1 -> badge 2.
    let changes = [row(other, 10), row(other, 20), row(viewer, 30)];
    expect(unseenOtherCount(changes, viewer, 0)).toBe(2);
    // Viewer opens Changes -> seen marker advances to the newest loaded change.
    const seen = maxCreatedAt(changes);
    expect(seen).toBe(30);
    expect(unseenOtherCount(changes, viewer, seen)).toBe(0);
    // Other makes 1 more -> badge 1.
    changes = [...changes, row(other, 40)];
    expect(unseenOtherCount(changes, viewer, seen)).toBe(1);
    // Viewer makes 3 more of their own -> badge stays 1.
    changes = [...changes, row(viewer, 50), row(viewer, 60), row(viewer, 70)];
    expect(unseenOtherCount(changes, viewer, seen)).toBe(1);
  });

  it("returns zero for an empty feed", () => {
    expect(unseenOtherCount([], viewer, 0)).toBe(0);
  });
});

describe("maxCreatedAt", () => {
  it("returns the largest createdAt across the feed", () => {
    const changes = [{ createdAt: 30 }, { createdAt: 70 }, { createdAt: 50 }];
    expect(maxCreatedAt(changes)).toBe(70);
  });

  it("returns 0 for an empty feed", () => {
    expect(maxCreatedAt([])).toBe(0);
  });

  it("ignores author when computing the high-water mark (all authors)", () => {
    // The marker is "newest thing present when I looked", regardless of author.
    const changes = [
      { author: "rajat", createdAt: 100 },
      { author: "tuhina", createdAt: 200 },
    ];
    expect(maxCreatedAt(changes)).toBe(200);
  });
});
