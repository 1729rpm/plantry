import { describe, it, expect } from "vitest";
import {
  rankCandidates,
  byLongestUnused,
  byNoSameDayPrimaryIngredient,
  byConsolidationStub,
  byIngredientConsolidation,
  byPreferredYes,
  byCuisineDiversity,
  placedNonIndianCount,
  WEEKLY_NON_INDIAN_TARGET,
  byWithinWeekRecency,
  withinWeekRecencySet,
  byProteinDiversity,
  proteinFamily,
  proteinFamiliesUsedAsHpMain,
  isHpMain,
} from "../src/priority.js";
import { emptyLedger } from "../src/consolidation.js";
import type { Dish, Ingredient, MenuHistoryRow, PackSizeHeader } from "../src/data/schemas.js";

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

function historyRow(dishId: number, dishName: string, weekStart: string): MenuHistoryRow {
  return {
    weekStart,
    day: "Monday",
    meal: "Lunch",
    dishName,
    dishId,
  };
}

describe("priority — docs/engine.md §4", () => {
  describe("§4 step 1: longest unused", () => {
    it("sorts the pool oldest last-cooked date first", () => {
      const oldest = makeDish({ name: "Oldest" });
      const middle = makeDish({ name: "Middle" });
      const newest = makeDish({ name: "Newest" });
      const history: MenuHistoryRow[] = [
        historyRow(oldest.id, oldest.name, "2026-01-05"),
        historyRow(middle.id, middle.name, "2026-03-09"),
        historyRow(newest.id, newest.name, "2026-05-04"),
      ];
      const out = byLongestUnused([newest, middle, oldest], history);
      expect(out.map((d) => d.name)).toEqual(["Oldest", "Middle", "Newest"]);
    });

    it("treats never-cooked dishes as the longest unused", () => {
      const cooked = makeDish({ name: "Cooked" });
      const neverCooked = makeDish({ name: "NeverCooked" });
      const history = [historyRow(cooked.id, cooked.name, "2026-05-04")];
      const out = byLongestUnused([cooked, neverCooked], history);
      expect(out.map((d) => d.name)).toEqual(["NeverCooked", "Cooked"]);
    });

    it("uses the most recent matching row when history has multiple cook dates for one dish", () => {
      const a = makeDish({ name: "A" });
      const b = makeDish({ name: "B" });
      // A's most recent cook is 2026-05-04 (newer than B's 2026-04-01), so B
      // is the longest unused even though A appears more often.
      const history = [
        historyRow(a.id, a.name, "2026-01-05"),
        historyRow(a.id, a.name, "2026-05-04"),
        historyRow(b.id, b.name, "2026-04-01"),
      ];
      const out = byLongestUnused([a, b], history);
      expect(out.map((d) => d.name)).toEqual(["B", "A"]);
    });

    it("exempts fruit-tagged dishes from reordering", () => {
      const recentFruit = makeDish({ name: "RecentFruit", tags: ["fruit"] });
      const oldFruit = makeDish({ name: "OldFruit", tags: ["fruit"] });
      const history = [
        historyRow(recentFruit.id, recentFruit.name, "2026-05-04"),
        historyRow(oldFruit.id, oldFruit.name, "2026-01-05"),
      ];
      const out = byLongestUnused([recentFruit, oldFruit], history);
      // Pool order preserved despite oldFruit being older.
      expect(out.map((d) => d.name)).toEqual(["RecentFruit", "OldFruit"]);
    });

    it("exempts lunch carbs (Chapati, Rice) from reordering", () => {
      const recentChapati = makeDish({
        name: "RecentChapati",
        category: "Chapati",
      });
      const oldRice = makeDish({ name: "OldRice", category: "Rice" });
      const history = [
        historyRow(recentChapati.id, recentChapati.name, "2026-05-04"),
        historyRow(oldRice.id, oldRice.name, "2026-01-05"),
      ];
      const out = byLongestUnused([recentChapati, oldRice], history);
      expect(out.map((d) => d.name)).toEqual(["RecentChapati", "OldRice"]);
    });

    it("keeps exempt items in place even when mixed with non-exempt items", () => {
      const exemptFirst = makeDish({ name: "ExemptFirst", tags: ["fruit"] });
      const oldNonExempt = makeDish({ name: "OldNonExempt" });
      const recentNonExempt = makeDish({ name: "RecentNonExempt" });
      const history = [
        historyRow(oldNonExempt.id, oldNonExempt.name, "2026-01-05"),
        historyRow(recentNonExempt.id, recentNonExempt.name, "2026-05-04"),
      ];
      const out = byLongestUnused([exemptFirst, recentNonExempt, oldNonExempt], history);
      // Exempt stays at index 0; non-exempt entries keep their input position
      // because exempt comparisons collapse to a neutral tiebreak; the sort
      // never sees a non-exempt vs non-exempt pair adjacent to swap.
      // The current implementation preserves input order whenever an exempt
      // item is involved, so the relative ordering of the two non-exempt
      // dishes is governed only by their direct comparison, which sorts old
      // before recent.
      expect(out.map((d) => d.name)).toEqual(["ExemptFirst", "OldNonExempt", "RecentNonExempt"]);
    });
  });

  describe("§4 step 2: same-day Primary Ingredient deprioritisation", () => {
    it("pushes candidates whose Primary Ingredient matches breakfast to the bottom", () => {
      const paneer = makeDish({ name: "PaneerLunch", primaryIngredient: "Paneer" });
      const chicken = makeDish({ name: "ChickenLunch", primaryIngredient: "Chicken" });
      const out = byNoSameDayPrimaryIngredient([paneer, chicken], "Paneer");
      expect(out.map((d) => d.name)).toEqual(["ChickenLunch", "PaneerLunch"]);
    });

    it("is a no-op when no breakfast Primary Ingredient is supplied", () => {
      const paneer = makeDish({ name: "PaneerLunch", primaryIngredient: "Paneer" });
      const chicken = makeDish({ name: "ChickenLunch", primaryIngredient: "Chicken" });
      const out = byNoSameDayPrimaryIngredient([paneer, chicken], undefined);
      expect(out.map((d) => d.name)).toEqual(["PaneerLunch", "ChickenLunch"]);
    });

    it("returns the pool unchanged when every candidate matches (§4 fallback)", () => {
      const paneerA = makeDish({ name: "PaneerA", primaryIngredient: "Paneer" });
      const paneerB = makeDish({ name: "PaneerB", primaryIngredient: "Paneer" });
      const out = byNoSameDayPrimaryIngredient([paneerA, paneerB], "Paneer");
      // No viable alternative → §4 allows the repeat: order from prior step
      // is preserved verbatim.
      expect(out.map((d) => d.name)).toEqual(["PaneerA", "PaneerB"]);
    });

    it("preserves prior-step order within the kept and pushed groups", () => {
      const keepA = makeDish({ name: "KeepA", primaryIngredient: "Chicken" });
      const pushA = makeDish({ name: "PushA", primaryIngredient: "Paneer" });
      const keepB = makeDish({ name: "KeepB", primaryIngredient: "Fish" });
      const pushB = makeDish({ name: "PushB", primaryIngredient: "Paneer" });
      const out = byNoSameDayPrimaryIngredient([keepA, pushA, keepB, pushB], "Paneer");
      expect(out.map((d) => d.name)).toEqual(["KeepA", "KeepB", "PushA", "PushB"]);
    });
  });

  describe("§4 step 3: ingredient consolidation (§6 wiring)", () => {
    it("is a no-op when no consolidation context is supplied", () => {
      const a = makeDish({ name: "A" });
      const b = makeDish({ name: "B" });
      const c = makeDish({ name: "C" });
      const pool = [a, b, c];
      const out = byIngredientConsolidation(pool, undefined);
      expect(out.map((d) => d.name)).toEqual(["A", "B", "C"]);
    });

    it("byConsolidationStub remains aliased for slice-4 callers (no-op when context absent)", () => {
      const a = makeDish({ name: "A" });
      const b = makeDish({ name: "B" });
      // The legacy slice-4 export still resolves and stays a no-op without a
      // ledger; only its identity widened to accept the §6 context.
      const out = byConsolidationStub([a, b], undefined);
      expect(out.map((d) => d.name)).toEqual(["A", "B"]);
    });

    it("reorders the pool when a ledger with above-threshold leftover is supplied", () => {
      const paneerHeader: PackSizeHeader = { ingredient: "Paneer", packSize: "200 g" };
      const usesPaneer = makeDish({ name: "UsesPaneer" });
      const noPaneer = makeDish({ name: "NoPaneer" });
      const ingredients: Ingredient[] = [
        {
          dishId: usesPaneer.id,
          dishName: usesPaneer.name,
          ingredient: "Paneer",
          quantity: 100,
          unit: "g",
        },
        {
          dishId: noPaneer.id,
          dishName: noPaneer.name,
          ingredient: "Onion",
          quantity: 100,
          unit: "g",
        },
      ];
      const ledger = emptyLedger([paneerHeader]);
      const paneer = ledger.get("Paneer")!;
      paneer.packsOnBuyList = 1;
      paneer.usedGrams = 50;
      paneer.leftoverGrams = 150; // above the 50 g default threshold

      const out = byIngredientConsolidation([noPaneer, usesPaneer], {
        ledger,
        ingredients,
      });
      expect(out.map((d) => d.name)).toEqual(["UsesPaneer", "NoPaneer"]);
    });
  });

  describe("§4 step 4: Preferred=Yes over Preferred=No", () => {
    it("ranks Preferred=Yes above Preferred=No", () => {
      const noPref = makeDish({ name: "NoPref", preferred: "No" });
      const yesPref = makeDish({ name: "YesPref", preferred: "Yes" });
      const out = byPreferredYes([noPref, yesPref]);
      expect(out.map((d) => d.name)).toEqual(["YesPref", "NoPref"]);
    });

    it("preserves prior-step order within each preference group", () => {
      const yesA = makeDish({ name: "YesA", preferred: "Yes" });
      const noA = makeDish({ name: "NoA", preferred: "No" });
      const yesB = makeDish({ name: "YesB", preferred: "Yes" });
      const noB = makeDish({ name: "NoB", preferred: "No" });
      // Prior step left them in interleaved order; step 4 should keep
      // yesA before yesB and noA before noB while pulling all Yes above all No.
      const out = byPreferredYes([yesA, noA, yesB, noB]);
      expect(out.map((d) => d.name)).toEqual(["YesA", "YesB", "NoA", "NoB"]);
    });
  });

  describe("§4 step 5: within-week cuisine diversity", () => {
    it("is a no-op when no placed-non-Indian count is supplied", () => {
      const indian = makeDish({ name: "Indian", cuisine: "Indian" });
      const thai = makeDish({ name: "Thai", cuisine: "Thai" });
      // Undefined count: the step does not fire, input order preserved.
      const out = byCuisineDiversity([indian, thai], undefined);
      expect(out.map((d) => d.name)).toEqual(["Indian", "Thai"]);
    });

    it("promotes non-Indian candidates above Indian ones while under target", () => {
      const indianA = makeDish({ name: "IndianA", cuisine: "Indian" });
      const thai = makeDish({ name: "Thai", cuisine: "Thai" });
      const indianB = makeDish({ name: "IndianB", cuisine: "Indian" });
      const italian = makeDish({ name: "Italian", cuisine: "Italian" });
      // Zero placed so far → under target → non-Indian dishes rank up.
      const out = byCuisineDiversity([indianA, thai, indianB, italian], 0);
      expect(out.map((d) => d.name)).toEqual(["Thai", "Italian", "IndianA", "IndianB"]);
    });

    it("is a no-op once the target is met (at target)", () => {
      const indian = makeDish({ name: "Indian", cuisine: "Indian" });
      const thai = makeDish({ name: "Thai", cuisine: "Thai" });
      // Exactly at target → step stops, input order preserved.
      const out = byCuisineDiversity([indian, thai], WEEKLY_NON_INDIAN_TARGET);
      expect(out.map((d) => d.name)).toEqual(["Indian", "Thai"]);
    });

    it("is a no-op above the target", () => {
      const indian = makeDish({ name: "Indian", cuisine: "Indian" });
      const thai = makeDish({ name: "Thai", cuisine: "Thai" });
      const out = byCuisineDiversity([indian, thai], WEEKLY_NON_INDIAN_TARGET + 2);
      expect(out.map((d) => d.name)).toEqual(["Indian", "Thai"]);
    });

    it("returns the pool unchanged when it holds no non-Indian candidate (fresh-alt fallback)", () => {
      // All-Indian pool (e.g. a Chapati/Rice lunch-carb pool, or a Fruit pool):
      // no non-Indian alternative exists, so the step is a no-op with no need for
      // an explicit exemption.
      const a = makeDish({ name: "A", cuisine: "Indian" });
      const b = makeDish({ name: "B", cuisine: "Indian" });
      const c = makeDish({ name: "C", cuisine: "Indian" });
      const out = byCuisineDiversity([a, b, c], 0);
      expect(out.map((d) => d.name)).toEqual(["A", "B", "C"]);
    });

    it("preserves prior-step order within the non-Indian and Indian groups (stable)", () => {
      const indianA = makeDish({ name: "IndianA", cuisine: "Indian" });
      const thaiA = makeDish({ name: "ThaiA", cuisine: "Thai" });
      const indianB = makeDish({ name: "IndianB", cuisine: "Indian" });
      const italianB = makeDish({ name: "ItalianB", cuisine: "Italian" });
      // Interleaved input; both groups keep their relative order.
      const out = byCuisineDiversity([indianA, thaiA, indianB, italianB], 1);
      expect(out.map((d) => d.name)).toEqual(["ThaiA", "ItalianB", "IndianA", "IndianB"]);
    });

    it("treats any non-Indian cuisine as non-Indian (property-keyed, not name-keyed)", () => {
      const indian = makeDish({ name: "ZZZ-Indian", cuisine: "Indian" });
      const continental = makeDish({ name: "AAA-Continental", cuisine: "Continental" });
      const out = byCuisineDiversity([indian, continental], 0);
      // Continental ranks up purely on the cuisine property, despite name order.
      expect(out.map((d) => d.name)).toEqual(["AAA-Continental", "ZZZ-Indian"]);
    });
  });

  describe("placedNonIndianCount", () => {
    it("counts every non-Indian dish placed, with no exemptions", () => {
      const indian = makeDish({ cuisine: "Indian" });
      const thai = makeDish({ cuisine: "Thai" });
      const italian = makeDish({ cuisine: "Italian" });
      // A non-Indian fruit still counts toward the week's cuisine mix.
      const nonIndianFruit = makeDish({ cuisine: "Thai", tags: ["fruit"], category: "Fruit" });
      expect(placedNonIndianCount([indian, thai, italian, nonIndianFruit])).toBe(3);
    });

    it("is zero for an empty pick list and for an all-Indian week", () => {
      expect(placedNonIndianCount([])).toBe(0);
      expect(placedNonIndianCount([makeDish({ cuisine: "Indian" }), makeDish({ cuisine: "Indian" })])).toBe(
        0,
      );
    });
  });

  describe("§4 step 5 end-to-end: cuisine diversity in rankCandidates", () => {
    it("ranks a non-Indian candidate above a Preferred=Yes Indian dish while under target", () => {
      const preferredIndian = makeDish({
        name: "PreferredIndian",
        cuisine: "Indian",
        preferred: "Yes",
      });
      const plainThai = makeDish({ name: "PlainThai", cuisine: "Thai", preferred: "No" });
      // Without the cuisine count, Preferred=Yes (step 4) keeps the Indian dish first.
      const baseline = rankCandidates({ pool: [preferredIndian, plainThai], history: [] });
      expect(baseline.map((d) => d.name)).toEqual(["PreferredIndian", "PlainThai"]);
      // Under target, the cuisine step (step 5, after Preferred) lifts the Thai dish.
      const withCuisine = rankCandidates({
        pool: [preferredIndian, plainThai],
        history: [],
        placedNonIndianCount: 0,
      });
      expect(withCuisine.map((d) => d.name)).toEqual(["PlainThai", "PreferredIndian"]);
    });

    it("is subordinate to within-week recency: cuisine never resurrects a placed dish", () => {
      // A placed non-Indian dish vs a fresh Indian dish. Cuisine (step 5) would
      // rank the non-Indian dish up, but within-week recency (step 6, terminal)
      // sinks the already-placed dish below the fresh one regardless.
      const placedThai = makeDish({ name: "PlacedThai", cuisine: "Thai" });
      const freshIndian = makeDish({ name: "FreshIndian", cuisine: "Indian" });
      const out = rankCandidates({
        pool: [placedThai, freshIndian],
        history: [],
        placedNonIndianCount: 0,
        withinWeekDishIds: new Set([placedThai.id]),
      });
      expect(out.map((d) => d.name)).toEqual(["FreshIndian", "PlacedThai"]);
    });

    it("is subordinate to within-week protein diversity for HP mains", () => {
      // A non-Indian HP main on a spent protein vs a fresh-protein Indian HP main.
      // Cuisine (step 5) prefers the non-Indian dish, but protein diversity
      // (step 7, terminal) sinks the spent-protein dish below the fresh one.
      const nonIndianChicken = makeDish({
        name: "NonIndianChicken",
        cuisine: "Thai",
        tags: ["HP"],
        category: "Gravy dish",
        primaryIngredient: "Chicken",
      });
      const indianFish = makeDish({
        name: "IndianFish",
        cuisine: "Indian",
        tags: ["HP"],
        category: "Gravy dish",
        primaryIngredient: "Fish",
      });
      const out = rankCandidates({
        pool: [nonIndianChicken, indianFish],
        history: [],
        placedNonIndianCount: 0,
        usedHpMainProteinFamilies: new Set(["Chicken"]),
      });
      expect(out.map((d) => d.name)).toEqual(["IndianFish", "NonIndianChicken"]);
    });

    it("is a no-op at/above target end-to-end (week ranks as before)", () => {
      const preferredIndian = makeDish({
        name: "PreferredIndian",
        cuisine: "Indian",
        preferred: "Yes",
      });
      const plainThai = makeDish({ name: "PlainThai", cuisine: "Thai", preferred: "No" });
      const out = rankCandidates({
        pool: [preferredIndian, plainThai],
        history: [],
        placedNonIndianCount: WEEKLY_NON_INDIAN_TARGET,
      });
      // Target met → step 5 a no-op → Preferred=Yes Indian dish leads again.
      expect(out.map((d) => d.name)).toEqual(["PreferredIndian", "PlainThai"]);
    });
  });

  describe("§4 step 6: within-week recency", () => {
    it("is a no-op when no within-week set is supplied", () => {
      const a = makeDish({ name: "A" });
      const b = makeDish({ name: "B" });
      const out = byWithinWeekRecency([a, b], undefined);
      expect(out.map((d) => d.name)).toEqual(["A", "B"]);
    });

    it("is a no-op for an empty within-week set", () => {
      const a = makeDish({ name: "A" });
      const b = makeDish({ name: "B" });
      const out = byWithinWeekRecency([a, b], new Set<number>());
      expect(out.map((d) => d.name)).toEqual(["A", "B"]);
    });

    it("sinks an already-placed dish below fresh alternatives", () => {
      const placed = makeDish({ name: "Placed" });
      const fresh = makeDish({ name: "Fresh" });
      // Placed leads the input, but it was already placed this week.
      const out = byWithinWeekRecency([placed, fresh], new Set([placed.id]));
      expect(out.map((d) => d.name)).toEqual(["Fresh", "Placed"]);
    });

    it("preserves order within the fresh and placed groups", () => {
      const freshA = makeDish({ name: "FreshA" });
      const placedA = makeDish({ name: "PlacedA" });
      const freshB = makeDish({ name: "FreshB" });
      const placedB = makeDish({ name: "PlacedB" });
      const out = byWithinWeekRecency(
        [freshA, placedA, freshB, placedB],
        new Set([placedA.id, placedB.id]),
      );
      expect(out.map((d) => d.name)).toEqual(["FreshA", "FreshB", "PlacedA", "PlacedB"]);
    });

    it("never demotes fruit-tagged dishes even if in the set (exempt)", () => {
      const fruit = makeDish({ name: "Fruit", tags: ["fruit"], category: "Fruit" });
      const fresh = makeDish({ name: "Fresh" });
      // fruit.id is in the within-week set but the exemption keeps it in place.
      const out = byWithinWeekRecency([fruit, fresh], new Set([fruit.id]));
      expect(out.map((d) => d.name)).toEqual(["Fruit", "Fresh"]);
    });

    it("never demotes lunch carbs even if in the set (exempt)", () => {
      const roti = makeDish({ name: "Roti", category: "Chapati" });
      const fresh = makeDish({ name: "Fresh" });
      const out = byWithinWeekRecency([roti, fresh], new Set([roti.id]));
      expect(out.map((d) => d.name)).toEqual(["Roti", "Fresh"]);
    });

    it("returns the pool unchanged when every candidate was already placed (allow the repeat)", () => {
      const a = makeDish({ name: "A" });
      const b = makeDish({ name: "B" });
      const out = byWithinWeekRecency([a, b], new Set([a.id, b.id]));
      // No fresh alternative remains → §4 step 6 fallback preserves input order.
      expect(out.map((d) => d.name)).toEqual(["A", "B"]);
    });

    it("dominates consolidation and Preferred=Yes end-to-end: a placed favourite still sinks", () => {
      // Reproduces the Cluster A defect at the rankCandidates level: the top
      // dish is Preferred=Yes and never-cooked in cross-week history, so steps 1
      // to 4 keep it first; step 6 demotes it because it was placed this week.
      const placedFavourite = makeDish({
        name: "PlacedFavourite",
        preferred: "Yes",
        primaryIngredient: "Chicken",
      });
      const freshPlain = makeDish({
        name: "FreshPlain",
        preferred: "No",
        primaryIngredient: "Paneer",
      });
      const baseline = rankCandidates({ pool: [placedFavourite, freshPlain], history: [] });
      // Without the within-week set, the Preferred favourite leads.
      expect(baseline.map((d) => d.name)).toEqual(["PlacedFavourite", "FreshPlain"]);

      const withWithinWeek = rankCandidates({
        pool: [placedFavourite, freshPlain],
        history: [],
        withinWeekDishIds: new Set([placedFavourite.id]),
      });
      // With it, the placed favourite sinks below the fresh alternative.
      expect(withWithinWeek.map((d) => d.name)).toEqual(["FreshPlain", "PlacedFavourite"]);
    });
  });

  describe("withinWeekRecencySet", () => {
    it("collects non-exempt placed dish ids and excludes exempt ones", () => {
      const gravy = makeDish({ name: "Gravy", category: "Gravy dish" });
      const fruit = makeDish({ name: "Fruit", tags: ["fruit"], category: "Fruit" });
      const roti = makeDish({ name: "Roti", category: "Chapati" });
      const rice = makeDish({ name: "Rice", category: "Rice" });
      const set = withinWeekRecencySet([gravy, fruit, roti, rice]);
      expect(set.has(gravy.id)).toBe(true);
      expect(set.has(fruit.id)).toBe(false);
      expect(set.has(roti.id)).toBe(false);
      expect(set.has(rice.id)).toBe(false);
      expect(set.size).toBe(1);
    });

    it("is empty for no picks", () => {
      expect(withinWeekRecencySet([]).size).toBe(0);
    });
  });

  describe("rankCandidates end-to-end composition", () => {
    it("composes all four steps with each breaking ties from the previous", () => {
      // Build a pool where each step is decisive:
      //  - step 1 longest-unused puts dishes in order: old, middle, new
      //  - step 2 same-day Paneer match pushes the "PaneerNew" dish down
      //  - step 3 is a no-op
      //  - step 4 lifts Preferred=Yes within each group
      const old = makeDish({
        name: "OldChicken",
        primaryIngredient: "Chicken",
        preferred: "No",
      });
      const middlePreferredPaneer = makeDish({
        name: "MiddlePaneerYes",
        primaryIngredient: "Paneer",
        preferred: "Yes",
      });
      const middlePlain = makeDish({
        name: "MiddleFishNo",
        primaryIngredient: "Fish",
        preferred: "No",
      });
      const newishYes = makeDish({
        name: "NewishPrawnYes",
        primaryIngredient: "Prawn",
        preferred: "Yes",
      });
      const history: MenuHistoryRow[] = [
        historyRow(old.id, old.name, "2026-01-05"),
        historyRow(middlePreferredPaneer.id, middlePreferredPaneer.name, "2026-03-02"),
        historyRow(middlePlain.id, middlePlain.name, "2026-03-02"),
        historyRow(newishYes.id, newishYes.name, "2026-05-04"),
      ];

      const out = rankCandidates({
        pool: [newishYes, middlePlain, middlePreferredPaneer, old],
        history,
        sameDayBreakfastPrimaryIngredient: "Paneer",
      });

      // After step 1 (oldest first, stable index for ties):
      //   [OldChicken, MiddlePaneerYes, MiddleFishNo, NewishPrawnYes]
      // After step 2 (push Paneer matches to bottom):
      //   [OldChicken, MiddleFishNo, NewishPrawnYes, MiddlePaneerYes]
      // After step 3 (no-op):
      //   [OldChicken, MiddleFishNo, NewishPrawnYes, MiddlePaneerYes]
      // After step 4 (Preferred=Yes lifted, stable within group):
      //   Yes group in step-3 order: [NewishPrawnYes, MiddlePaneerYes]
      //   No  group in step-3 order: [OldChicken, MiddleFishNo]
      //   final: [NewishPrawnYes, MiddlePaneerYes, OldChicken, MiddleFishNo]
      expect(out.map((d) => d.name)).toEqual([
        "NewishPrawnYes",
        "MiddlePaneerYes",
        "OldChicken",
        "MiddleFishNo",
      ]);
    });

    it("respects recency exemption end-to-end (a fruit pool never reorders by date)", () => {
      const recentFruit = makeDish({
        name: "RecentMango",
        tags: ["fruit"],
        category: "Fruit",
        preferred: "No",
      });
      const oldFruit = makeDish({
        name: "OldBanana",
        tags: ["fruit"],
        category: "Fruit",
        preferred: "No",
      });
      const history = [
        historyRow(recentFruit.id, recentFruit.name, "2026-05-04"),
        historyRow(oldFruit.id, oldFruit.name, "2026-01-05"),
      ];
      const out = rankCandidates({
        pool: [recentFruit, oldFruit],
        history,
      });
      expect(out.map((d) => d.name)).toEqual(["RecentMango", "OldBanana"]);
    });

    it("respects recency exemption for lunch carbs and still lifts Preferred=Yes", () => {
      const recentChapatiYes = makeDish({
        name: "ChapatiYes",
        category: "Chapati",
        preferred: "Yes",
      });
      const oldRiceNo = makeDish({
        name: "RiceNo",
        category: "Rice",
        preferred: "No",
      });
      const history = [
        historyRow(recentChapatiYes.id, recentChapatiYes.name, "2026-05-04"),
        historyRow(oldRiceNo.id, oldRiceNo.name, "2026-01-05"),
      ];
      // Step 1 exempt (both are lunch carbs), so pool stays as input.
      // Step 4 lifts ChapatiYes above RiceNo regardless.
      const out = rankCandidates({
        pool: [oldRiceNo, recentChapatiYes],
        history,
      });
      expect(out.map((d) => d.name)).toEqual(["ChapatiYes", "RiceNo"]);
    });

    it("step 3 reorders the pool when a ledger with non-zero leftover is supplied", () => {
      const paneerHeader: PackSizeHeader = { ingredient: "Paneer", packSize: "200 g" };
      // Two same-Preferred, same-history candidates. Without a ledger they
      // come out in input order; with a ledger that has 150 g Paneer
      // leftover, the dish that consumes Paneer ranks above the one that
      // doesn't.
      const usesPaneer = makeDish({
        name: "UsesPaneer",
        primaryIngredient: "Chicken",
        preferred: "No",
      });
      const noPaneer = makeDish({
        name: "NoPaneer",
        primaryIngredient: "Chicken",
        preferred: "No",
      });
      const ingredients: Ingredient[] = [
        {
          dishId: usesPaneer.id,
          dishName: usesPaneer.name,
          ingredient: "Paneer",
          quantity: 100,
          unit: "g",
        },
        {
          dishId: noPaneer.id,
          dishName: noPaneer.name,
          ingredient: "Onion",
          quantity: 100,
          unit: "g",
        },
      ];
      const ledger = emptyLedger([paneerHeader]);
      const paneer = ledger.get("Paneer")!;
      paneer.packsOnBuyList = 1;
      paneer.usedGrams = 50;
      paneer.leftoverGrams = 150;

      // Baseline: no ledger → input order preserved (no step would reorder).
      const baseline = rankCandidates({
        pool: [noPaneer, usesPaneer],
        history: [],
      });
      expect(baseline.map((d) => d.name)).toEqual(["NoPaneer", "UsesPaneer"]);

      // With ledger: step 3 reorders so UsesPaneer comes first.
      const withLedger = rankCandidates({
        pool: [noPaneer, usesPaneer],
        history: [],
        consolidationContext: { ledger, ingredients },
      });
      expect(withLedger.map((d) => d.name)).toEqual(["UsesPaneer", "NoPaneer"]);
    });

    it("step 3 is a no-op when no ledger is supplied (preserves slice-4 behaviour)", () => {
      const a = makeDish({ name: "A", preferred: "No" });
      const b = makeDish({ name: "B", preferred: "No" });
      const c = makeDish({ name: "C", preferred: "No" });
      const out = rankCandidates({ pool: [a, b, c], history: [] });
      expect(out.map((d) => d.name)).toEqual(["A", "B", "C"]);
    });
  });

  describe("property: result is a permutation of the input", () => {
    it("preserves length and membership for a varied pool", () => {
      const dishes = [
        makeDish({ name: "P1", primaryIngredient: "Paneer", preferred: "Yes" }),
        makeDish({ name: "P2", primaryIngredient: "Chicken", preferred: "No" }),
        makeDish({ name: "P3", primaryIngredient: "Fish", preferred: "Yes" }),
        makeDish({
          name: "P4",
          tags: ["fruit"],
          category: "Fruit",
          preferred: "No",
        }),
        makeDish({ name: "P5", category: "Chapati", preferred: "Yes" }),
        makeDish({ name: "P6", primaryIngredient: "Paneer", preferred: "No" }),
      ];
      const history: MenuHistoryRow[] = [
        historyRow(dishes[0].id, dishes[0].name, "2026-01-05"),
        historyRow(dishes[1].id, dishes[1].name, "2026-02-02"),
        historyRow(dishes[2].id, dishes[2].name, "2026-03-09"),
        historyRow(dishes[4].id, dishes[4].name, "2026-04-06"),
        historyRow(dishes[5].id, dishes[5].name, "2026-05-04"),
      ];
      const out = rankCandidates({
        pool: dishes,
        history,
        sameDayBreakfastPrimaryIngredient: "Paneer",
      });
      expect(out).toHaveLength(dishes.length);
      // Set equality on ids: every input appears exactly once.
      const inIds = new Set(dishes.map((d) => d.id));
      const outIds = new Set(out.map((d) => d.id));
      expect(outIds).toEqual(inIds);
      // No dish appears twice.
      expect(new Set(out.map((d) => d.id)).size).toBe(out.length);
    });

    it("returns an empty array unchanged", () => {
      const out = rankCandidates({ pool: [], history: [] });
      expect(out).toEqual([]);
    });
  });

  // Cluster E: protein-level within-week diversity for HP mains (§4.6).
  describe("§4.6 protein-family normalization", () => {
    it("collapses the chicken cuts onto one family", () => {
      expect(proteinFamily(makeDish({ primaryIngredient: "Chicken" }))).toBe("Chicken");
      expect(proteinFamily(makeDish({ primaryIngredient: "Chicken Breast" }))).toBe("Chicken");
      expect(proteinFamily(makeDish({ primaryIngredient: "Chicken Keema" }))).toBe("Chicken");
    });

    it("collapses the soya forms onto one family", () => {
      expect(proteinFamily(makeDish({ primaryIngredient: "Soyabean Chunk" }))).toBe(
        "Soyabean Chunk",
      );
      expect(proteinFamily(makeDish({ primaryIngredient: "Soya Chunk" }))).toBe("Soyabean Chunk");
    });

    it("passes unmapped proteins through unchanged (each its own family)", () => {
      for (const p of ["Paneer", "Fish", "Prawn", "Mutton", "Egg", "Chickpea"]) {
        expect(proteinFamily(makeDish({ primaryIngredient: p }))).toBe(p);
      }
    });
  });

  describe("§4.6 isHpMain", () => {
    it("is true for HP-tagged Gravy/Dry/Complete meal/Keto", () => {
      for (const category of ["Gravy dish", "Dry dish", "Complete meal", "Keto"] as const) {
        expect(isHpMain(makeDish({ tags: ["HP"], category }))).toBe(true);
      }
    });

    it("is false for an HP Accompaniment (a side, not a main)", () => {
      expect(isHpMain(makeDish({ tags: ["HP"], category: "Accompaniment" }))).toBe(false);
    });

    it("is false for a non-HP dish", () => {
      expect(isHpMain(makeDish({ tags: [], category: "Gravy dish" }))).toBe(false);
    });
  });

  describe("§4.6 proteinFamiliesUsedAsHpMain", () => {
    it("collects only HP-main protein families, normalized", () => {
      const chickenGravy = makeDish({
        tags: ["HP"],
        category: "Gravy dish",
        primaryIngredient: "Chicken",
      });
      const keemaDry = makeDish({
        tags: ["HP"],
        category: "Dry dish",
        primaryIngredient: "Chicken Keema",
      });
      const paneerSide = makeDish({
        tags: ["HP"],
        category: "Accompaniment",
        primaryIngredient: "Paneer",
      });
      const plainGravy = makeDish({ tags: [], category: "Gravy dish", primaryIngredient: "Dal" });
      const set = proteinFamiliesUsedAsHpMain([chickenGravy, keemaDry, paneerSide, plainGravy]);
      // Chicken + Chicken Keema collapse to one family; the HP side and the
      // non-HP gravy are excluded.
      expect([...set]).toEqual(["Chicken"]);
    });
  });

  describe("§4.6 byProteinDiversity", () => {
    it("is a no-op when no protein families have been used", () => {
      const a = makeDish({ tags: ["HP"], primaryIngredient: "Chicken" });
      const b = makeDish({ tags: ["HP"], primaryIngredient: "Fish" });
      expect(byProteinDiversity([a, b], undefined)).toEqual([a, b]);
      expect(byProteinDiversity([a, b], new Set<string>())).toEqual([a, b]);
    });

    it("ranks a fresh protein above a repeated one", () => {
      const chicken = makeDish({
        tags: ["HP"],
        category: "Gravy dish",
        primaryIngredient: "Chicken",
      });
      const fish = makeDish({ tags: ["HP"], category: "Gravy dish", primaryIngredient: "Fish" });
      // Chicken already used this week as an HP main → fish (fresh) ranks up.
      const out = byProteinDiversity([chicken, fish], new Set(["Chicken"]));
      expect(out.map((d) => d.primaryIngredient)).toEqual(["Fish", "Chicken"]);
    });

    it("collapses chicken cuts: a chicken-keema main is demoted by a prior chicken main", () => {
      const keema = makeDish({
        tags: ["HP"],
        category: "Dry dish",
        primaryIngredient: "Chicken Keema",
      });
      const mutton = makeDish({
        tags: ["HP"],
        category: "Gravy dish",
        primaryIngredient: "Mutton",
      });
      const out = byProteinDiversity([keema, mutton], new Set(["Chicken"]));
      expect(out.map((d) => d.primaryIngredient)).toEqual(["Mutton", "Chicken Keema"]);
    });

    it("is soft: returns the pool unchanged when every candidate's protein was used", () => {
      const chickenA = makeDish({
        tags: ["HP"],
        category: "Gravy dish",
        primaryIngredient: "Chicken",
      });
      const chickenB = makeDish({
        tags: ["HP"],
        category: "Dry dish",
        primaryIngredient: "Chicken Breast",
      });
      // Only chicken candidates and chicken already used → still fills (soft).
      const out = byProteinDiversity([chickenA, chickenB], new Set(["Chicken"]));
      expect(out).toEqual([chickenA, chickenB]);
    });

    it("does not reorder a non-HP-main candidate by its incidental primaryIngredient", () => {
      // A non-HP gravy whose primaryIngredient is Paneer is NOT an HP main, so a
      // prior paneer HP main does not demote it: the rule is scoped to HP mains.
      const nonHpPaneer = makeDish({
        tags: [],
        category: "Gravy dish",
        primaryIngredient: "Paneer",
      });
      const hpFish = makeDish({ tags: ["HP"], category: "Gravy dish", primaryIngredient: "Fish" });
      const out = byProteinDiversity([nonHpPaneer, hpFish], new Set(["Paneer"]));
      expect(out).toEqual([nonHpPaneer, hpFish]);
    });
  });

  describe("§4.6 rankCandidates end-to-end protein diversity", () => {
    it("a week starting with a chicken main ranks a non-chicken protein up next", () => {
      // Both never-cooked HP gravies; chicken would lead on id order, but the
      // week already spent Chicken on an HP main, so fish ranks up.
      const chicken = makeDish({
        tags: ["HP"],
        category: "Gravy dish",
        primaryIngredient: "Chicken",
      });
      const fish = makeDish({ tags: ["HP"], category: "Gravy dish", primaryIngredient: "Fish" });
      const baseline = rankCandidates({ pool: [chicken, fish], history: [] });
      expect(baseline.map((d) => d.primaryIngredient)).toEqual(["Chicken", "Fish"]);
      const diversified = rankCandidates({
        pool: [chicken, fish],
        history: [],
        usedHpMainProteinFamilies: new Set(["Chicken"]),
      });
      expect(diversified.map((d) => d.primaryIngredient)).toEqual(["Fish", "Chicken"]);
    });
  });
});
