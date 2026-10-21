import { describe, expect, it } from "vitest";
import { archiveRowsFromDoc, type ArchiveSource } from "../../convex/lib/archive.js";

// archiveRowsFromDoc is the pure derivation generation uses to write one
// weekArchive row per earlier currentWeek row (app/convex/generateWeek.ts). It
// lives beside the Convex code, and this web vitest run is the test job that
// sits in the same app workspace, so its cases live here.

type Slot = ArchiveSource["slots"][number];
type DishPick = Slot["dishes"][number];

function pick(dishId: number | null, customLabel: string | null = null): DishPick {
  return {
    dishId,
    customLabel,
    source: dishId === null ? "custom" : "generated",
    author: "system",
    updatedAt: 0,
  };
}

function skip(day: Slot["day"]) {
  return { day, reason: "", author: "rajat" as const, skippedAt: 0 };
}

const nameById = new Map<number, string>([
  [1, "Poha"],
  [2, "Dal"],
  [3, "Rice"],
  [4, "Banana"],
  [5, "Idli"],
]);

describe("archiveRowsFromDoc", () => {
  it("archives a plain week in slot then position order, long-form day, capitalised meal", () => {
    const doc: ArchiveSource = {
      slots: [
        { day: "Mon", meal: "breakfast", dishes: [pick(1)] },
        { day: "Mon", meal: "lunch", dishes: [pick(2), pick(3)] },
        { day: "Tue", meal: "breakfast", dishes: [pick(5)] },
      ],
    };
    expect(archiveRowsFromDoc(doc, nameById)).toEqual([
      { day: "Monday", meal: "Breakfast", dishName: "Poha", dishId: 1 },
      { day: "Monday", meal: "Lunch", dishName: "Dal", dishId: 2 },
      { day: "Monday", meal: "Lunch", dishName: "Rice", dishId: 3 },
      { day: "Tuesday", meal: "Breakfast", dishName: "Idli", dishId: 5 },
    ]);
  });

  it("drops every pick on a skipped day", () => {
    const doc: ArchiveSource = {
      slots: [
        { day: "Mon", meal: "breakfast", dishes: [pick(1)] },
        { day: "Tue", meal: "lunch", dishes: [pick(2)] },
      ],
      skippedDays: [skip("Tue")],
    };
    expect(archiveRowsFromDoc(doc, nameById)).toEqual([
      { day: "Monday", meal: "Breakfast", dishName: "Poha", dishId: 1 },
    ]);
  });

  it("drops a custom one-off and keeps its slot-mates", () => {
    const doc: ArchiveSource = {
      slots: [{ day: "Wed", meal: "lunch", dishes: [pick(null, "Red Sauce Pasta"), pick(3)] }],
    };
    expect(archiveRowsFromDoc(doc, nameById)).toEqual([
      { day: "Wednesday", meal: "Lunch", dishName: "Rice", dishId: 3 },
    ]);
  });

  it("archives the fruit slot as Fruit", () => {
    const doc: ArchiveSource = {
      slots: [{ day: "Sat", meal: "fruit", dishes: [pick(4)] }],
    };
    expect(archiveRowsFromDoc(doc, nameById)).toEqual([
      { day: "Saturday", meal: "Fruit", dishName: "Banana", dishId: 4 },
    ]);
  });

  it("skips a pick whose id is not in the library", () => {
    const doc: ArchiveSource = {
      slots: [{ day: "Thu", meal: "breakfast", dishes: [pick(999), pick(1)] }],
    };
    expect(archiveRowsFromDoc(doc, nameById)).toEqual([
      { day: "Thursday", meal: "Breakfast", dishName: "Poha", dishId: 1 },
    ]);
  });

  it("returns an empty array for a week whose every day was skipped", () => {
    const doc: ArchiveSource = {
      slots: [
        { day: "Mon", meal: "breakfast", dishes: [pick(1)] },
        { day: "Fri", meal: "lunch", dishes: [pick(2)] },
      ],
      skippedDays: (["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const).map(skip),
    };
    expect(archiveRowsFromDoc(doc, nameById)).toEqual([]);
  });
});
