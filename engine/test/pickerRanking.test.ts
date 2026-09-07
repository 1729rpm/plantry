import { describe, it, expect } from "vitest";
import { rankPickerAlternatives } from "../src/pickerRanking.js";
import type { Dish } from "../src/data/schemas.js";

/**
 * docs/engine.md §5 Picker ranking as v6 carries it forward
 * (`features/engine-v6.md` §12). The swap/add picker ranks the broad meal-time
 * pool deterministically: a HEAD ("fits this day", not already on the day) then a
 * TAIL of same-day repeats, each ordered by the binary recency tier (not placed
 * this week first) then dish id. No RNG, no protein-band term, no cooking
 * history.
 */

let nextId = 1;
function makeDish(overrides: Partial<Dish> = {}): Dish {
  const id = nextId++;
  return {
    id,
    name: `Dish ${id}`,
    category: "Gravy dish",
    time: "Lunch",
    tags: [],
    primaryIngredient: "Paneer",
    preferred: "No",
    active: "Yes",
    satiety: "Medium",
    prepMinutes: 30,
    seasons: "All",
    cuisine: "Indian",
    ...overrides,
  };
}

const nothingPlaced: ReadonlySet<number> = new Set<number>();

describe("§5 picker ranking, v6 §12", () => {
  describe("head / tail split", () => {
    it("ranks not-on-day dishes (head) above same-day repeats (tail)", () => {
      nextId = 1;
      const onDay = makeDish();
      const fresh1 = makeDish();
      const fresh2 = makeDish();
      // Pool contains a dish already on the day; the head should hold the two
      // fresh dishes, the tail the on-day repeat, even though the repeat is a
      // lower id (it would win every tie in the head).
      const ranked = rankPickerAlternatives({
        pool: [onDay, fresh1, fresh2],
        meal: "Lunch",
        dishesOnDay: [onDay],
        placedThisWeek: nothingPlaced,
      });
      expect(ranked.map((d) => d.id)).toEqual([fresh1.id, fresh2.id, onDay.id]);
    });

    it("keeps every pool dish (non-restrictive: nothing dropped)", () => {
      nextId = 1;
      const pool = [makeDish(), makeDish(), makeDish()];
      const ranked = rankPickerAlternatives({
        pool,
        meal: "Lunch",
        dishesOnDay: [pool[0]],
        placedThisWeek: nothingPlaced,
      });
      expect(new Set(ranked.map((d) => d.id))).toEqual(new Set(pool.map((d) => d.id)));
      expect(ranked).toHaveLength(pool.length);
    });
  });

  describe("the binary recency tier", () => {
    it("orders the head not-placed-this-week first, then dish id", () => {
      nextId = 1;
      // placedLowId has the SMALLEST id, so a pure-id sort would put it first.
      // The tier must override that and sink it below both fresh dishes.
      const placedLowId = makeDish();
      const freshB = makeDish();
      const freshA = makeDish();
      const ranked = rankPickerAlternatives({
        pool: [freshA, placedLowId, freshB],
        meal: "Lunch",
        dishesOnDay: [],
        placedThisWeek: new Set([placedLowId.id]),
      });
      expect(ranked.map((d) => d.id)).toEqual([freshB.id, freshA.id, placedLowId.id]);
    });

    it("is binary: two dishes both placed this week tie and fall to dish id", () => {
      nextId = 1;
      const placedFirst = makeDish();
      const placedSecond = makeDish();
      const fresh = makeDish();
      const ranked = rankPickerAlternatives({
        pool: [placedSecond, placedFirst, fresh],
        meal: "Lunch",
        dishesOnDay: [],
        placedThisWeek: new Set([placedFirst.id, placedSecond.id]),
      });
      // No sub-ordering among placed dishes: both are tier 1, id decides.
      expect(ranked.map((d) => d.id)).toEqual([fresh.id, placedFirst.id, placedSecond.id]);
    });

    it("an empty placed set collapses the ranking to dish id ascending", () => {
      nextId = 1;
      const d3 = makeDish();
      const d1 = makeDish();
      const d2 = makeDish();
      const ranked = rankPickerAlternatives({
        pool: [d3, d1, d2],
        meal: "Lunch",
        dishesOnDay: [],
        placedThisWeek: nothingPlaced,
      });
      expect(ranked.map((d) => d.id)).toEqual([d3, d1, d2].map((d) => d.id).sort((x, y) => x - y));
    });

    it("tiers the tail too, so a same-day repeat not placed elsewhere leads it", () => {
      nextId = 1;
      // Both dishes are on the day, so both are tail. The one ALSO counted in
      // placedThisWeek sinks below the other despite its lower id.
      const onDayPlaced = makeDish();
      const onDayNotPlaced = makeDish();
      const fresh = makeDish();
      const ranked = rankPickerAlternatives({
        pool: [onDayPlaced, onDayNotPlaced, fresh],
        meal: "Lunch",
        dishesOnDay: [onDayPlaced, onDayNotPlaced],
        placedThisWeek: new Set([onDayPlaced.id]),
      });
      expect(ranked.map((d) => d.id)).toEqual([fresh.id, onDayNotPlaced.id, onDayPlaced.id]);
    });
  });

  describe("the protein-band term is gone (v6 §12)", () => {
    it("does not reorder a tier by protein: a tier is ordered by id alone", () => {
      nextId = 1;
      // The adversarial fixture for the removed term. Under the old ranking a
      // caller supplied `outgoingDish`, `ingredients` and `catalog`, and a
      // candidate sharing the outgoing dish's protein band sorted ahead of a
      // distant one even at a higher id. Here the two candidates sit in wildly
      // different protein registers (a 400 g chicken dish and a 400 g rice dish)
      // and share a tier; with the term removed, dish id alone decides, so the
      // low-id rice dish leads the high-id chicken dish.
      const farBandLowId = makeDish({ primaryIngredient: "Rice" });
      const sameBandHighId = makeDish({ primaryIngredient: "Chicken", tags: ["HP"] });
      expect(sameBandHighId.id).toBeGreaterThan(farBandLowId.id);
      const ranked = rankPickerAlternatives({
        pool: [sameBandHighId, farBandLowId],
        meal: "Lunch",
        dishesOnDay: [],
        placedThisWeek: nothingPlaced,
      });
      expect(ranked.map((d) => d.id)).toEqual([farBandLowId.id, sameBandHighId.id]);
    });

    it("ranks a swap and an add identically (no outgoing-dish argument exists)", () => {
      nextId = 1;
      const pool = [makeDish(), makeDish(), makeDish()];
      const args = {
        pool,
        meal: "Lunch" as const,
        dishesOnDay: [],
        placedThisWeek: new Set([pool[0].id]),
      };
      // There is no swap-only path any more: the same arguments are the whole
      // input for both surfaces.
      expect(rankPickerAlternatives(args).map((d) => d.id)).toEqual(
        rankPickerAlternatives(args).map((d) => d.id),
      );
    });
  });

  describe("determinism and tie-breaks", () => {
    it("is a pure function of its inputs: same inputs, same output", () => {
      nextId = 1;
      const pool = [makeDish(), makeDish(), makeDish(), makeDish()];
      const args = {
        pool,
        meal: "Lunch" as const,
        dishesOnDay: [pool[3]],
        placedThisWeek: new Set([pool[1].id]),
      };
      const a = rankPickerAlternatives(args).map((d) => d.id);
      const b = rankPickerAlternatives(args).map((d) => d.id);
      expect(a).toEqual(b);
    });

    it("input order does not affect output (order-independence)", () => {
      nextId = 1;
      const pool = [makeDish(), makeDish(), makeDish()];
      const placedThisWeek = new Set([pool[0].id]);
      const forward = rankPickerAlternatives({
        pool,
        meal: "Lunch",
        dishesOnDay: [],
        placedThisWeek,
      }).map((d) => d.id);
      const reversed = rankPickerAlternatives({
        pool: [...pool].reverse(),
        meal: "Lunch",
        dishesOnDay: [],
        placedThisWeek,
      }).map((d) => d.id);
      expect(forward).toEqual(reversed);
    });

    it("does not mutate the pool it is given", () => {
      nextId = 1;
      const pool = [makeDish(), makeDish(), makeDish()];
      const before = pool.map((d) => d.id);
      rankPickerAlternatives({
        pool,
        meal: "Lunch",
        dishesOnDay: [pool[0]],
        placedThisWeek: new Set([pool[2].id]),
      });
      expect(pool.map((d) => d.id)).toEqual(before);
    });
  });
});
