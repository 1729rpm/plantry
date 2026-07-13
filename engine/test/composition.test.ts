import { describe, it, expect } from "vitest";
import {
  composeSlot,
  fruitOfDayPool,
  breakfastOptionB,
  breakfastOptionC,
  breakfastSinglePick,
  menu1,
  menu2,
  menu3,
  menu4,
  menuIntl,
  isIntlAnchor,
  isCuisineNeutral,
  lunchBudget,
  LUNCH_MAX_ITEMS,
  shouldSubstituteWeekday,
  selectInternationalSubstitutions,
  planWeekdaySubstitutions,
  excludeHpIfMealHasHp,
  isHp,
  isSelfSufficientMain,
  isStandaloneBreakfastBread,
  breakfastMainCarriesChutney,
} from "../src/composition.js";
import type {
  BreakfastWeekdayPairCandidateSet,
  BreakfastSinglePickCandidateSet,
  Menu1CandidateSet,
  Menu2CandidateSet,
  Menu3CandidateSet,
  Menu4CandidateSet,
} from "../src/composition.js";
import type { Dish, MenuHistoryRow } from "../src/data/schemas.js";
import type { SlotPlan } from "../src/schedule.js";

let nextId = 1;

function makeDish(overrides: Partial<Dish> = {}): Dish {
  return {
    id: nextId++,
    name: `Dish ${nextId}`,
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

const emptyHistory: MenuHistoryRow[] = [];

function breakfast(day: SlotPlan["day"]): SlotPlan {
  return {
    day,
    meal: "Breakfast",
    itemCount: day === "Mon" || day === "Wed" || day === "Fri" ? 2 : 1,
  };
}

function lunch(day: SlotPlan["day"], lunchMenu: 1 | 2 | 3 | 4): SlotPlan {
  return {
    day,
    meal: "Lunch",
    itemCount: lunchMenu === 2 ? 4 : 3,
    lunchMenu,
  };
}

describe("composition — docs/engine.md §3", () => {
  describe("§3.3 Fruit of the day pool", () => {
    it("includes every Category=Fruit dish, regardless of time or tags", () => {
      const breakfastFruit = makeDish({
        time: "Breakfast",
        category: "Fruit",
        tags: ["fruit"],
      });
      const lunchFruit = makeDish({ time: "Lunch", category: "Fruit", tags: [] });
      const notFruit = makeDish({ time: "Breakfast", category: "Bread" });
      const out = fruitOfDayPool([breakfastFruit, lunchFruit, notFruit]);
      expect(out).toEqual([breakfastFruit, lunchFruit]);
    });

    it("returns an empty pool when no Fruit-category dish is eligible", () => {
      const notFruit = makeDish({ category: "Gravy dish" });
      expect(fruitOfDayPool([notFruit])).toEqual([]);
    });
  });

  describe("§3 breakfast Mon/Wed/Fri Option B: complete_carb + accompaniment", () => {
    it("includes complete_carb Breakfast dishes in pool B.completeCarb", () => {
      const cc = makeDish({
        time: "Breakfast",
        category: "Paratha",
        tags: ["complete_carb"],
      });
      const plain = makeDish({ time: "Breakfast", category: "Paratha" });
      const out = breakfastOptionB([cc, plain]);
      expect(out.completeCarb).toEqual([cc]);
    });

    it("requires Time=Breakfast and Category=Accompaniment for B.accompaniment", () => {
      const acc = makeDish({ time: "Breakfast", category: "Accompaniment" });
      const lunchAcc = makeDish({ time: "Lunch", category: "Accompaniment" });
      const out = breakfastOptionB([acc, lunchAcc]);
      expect(out.accompaniment).toEqual([acc]);
    });
  });

  describe("§3 breakfast Mon/Wed/Fri Option C: breakfast dry main + plain breakfast carb", () => {
    it("requires Time=Breakfast and Category=Dry dish for C.dryMain", () => {
      const dry = makeDish({ time: "Breakfast", category: "Dry dish" });
      const lunchDry = makeDish({ time: "Lunch", category: "Dry dish" });
      const out = breakfastOptionC([dry, lunchDry]);
      expect(out.dryMain).toEqual([dry]);
    });

    it("excludes complete_carb-tagged carbs from C.plainCarb", () => {
      const plain = makeDish({ time: "Breakfast", category: "Bread" });
      const stuffed = makeDish({
        time: "Breakfast",
        category: "Paratha",
        tags: ["complete_carb"],
      });
      const chilla = makeDish({ time: "Breakfast", category: "Chilla" });
      const out = breakfastOptionC([plain, stuffed, chilla]);
      expect(out.plainCarb).toEqual([plain, chilla]);
    });
  });

  describe("§3 breakfast Tue/Thu single pick: complete_meal OR complete_carb", () => {
    it("includes both complete_meal and complete_carb Breakfast dishes", () => {
      const cm = makeDish({
        time: "Breakfast",
        category: "Complete meal",
        tags: ["complete_meal"],
      });
      const cc = makeDish({
        time: "Breakfast",
        category: "Paratha",
        tags: ["complete_carb"],
      });
      const plain = makeDish({ time: "Breakfast", category: "Bread" });
      const out = breakfastSinglePick([cm, cc, plain]);
      expect(out.pool).toEqual([cm, cc]);
    });

    it("excludes Lunch dishes even when complete_meal-tagged", () => {
      const lunchCm = makeDish({
        time: "Lunch",
        category: "Complete meal",
        tags: ["complete_meal"],
      });
      const out = breakfastSinglePick([lunchCm]);
      expect(out.pool).toEqual([]);
    });

    it("§3 R3 ketoCompanion pool is the HP Category=Keto breakfast dishes", () => {
      const hpKeto = makeDish({
        time: "Breakfast",
        category: "Keto",
        tags: ["HP"],
        primaryIngredient: "Egg",
      });
      const nonHpKeto = makeDish({ time: "Breakfast", category: "Keto" });
      const hpLunchKeto = makeDish({ time: "Lunch", category: "Keto", tags: ["HP"] });
      const cc = makeDish({ time: "Breakfast", category: "Paratha", tags: ["complete_carb"] });
      const out = breakfastSinglePick([hpKeto, nonHpKeto, hpLunchKeto, cc]);
      // Only the HP, Breakfast, Category=Keto dish qualifies as a companion.
      expect(out.ketoCompanion).toEqual([hpKeto]);
    });

    it("§3 chutney pool is the Category=Accompaniment Breakfast dishes", () => {
      const chutney = makeDish({ time: "Breakfast", category: "Accompaniment" });
      const lunchAcc = makeDish({ time: "Lunch", category: "Accompaniment" });
      const cc = makeDish({ time: "Breakfast", category: "Chilla", tags: ["complete_carb"] });
      const out = breakfastSinglePick([chutney, lunchAcc, cc]);
      // Only the Breakfast accompaniment is a chutney candidate (lunch excluded
      // by the Time=Breakfast filter the candidate set applies).
      expect(out.chutney).toEqual([chutney]);
    });
  });

  describe("§3 R1 self-sufficient main signals", () => {
    it("isSelfSufficientMain is the union of complete_meal-tag and Category=Complete meal", () => {
      const tagged = makeDish({ category: "Gravy dish", tags: ["complete_meal"] });
      const categoried = makeDish({ category: "Complete meal", tags: [] });
      const both = makeDish({ category: "Complete meal", tags: ["complete_meal"] });
      const neither = makeDish({ category: "Gravy dish", tags: [] });
      expect(isSelfSufficientMain(tagged)).toBe(true);
      // White-sauce-pasta case: Category=Complete meal but NOT complete_meal-tagged.
      expect(isSelfSufficientMain(categoried)).toBe(true);
      expect(isSelfSufficientMain(both)).toBe(true);
      expect(isSelfSufficientMain(neither)).toBe(false);
    });

    it("isStandaloneBreakfastBread is true only for a Category=Bread complete_carb", () => {
      const bread = makeDish({
        time: "Breakfast",
        category: "Bread",
        tags: ["complete_carb"],
      });
      const paratha = makeDish({
        time: "Breakfast",
        category: "Paratha",
        tags: ["complete_carb"],
      });
      const chilla = makeDish({
        time: "Breakfast",
        category: "Chilla",
        tags: ["complete_carb"],
      });
      const plainBread = makeDish({ time: "Breakfast", category: "Bread" });
      expect(isStandaloneBreakfastBread(bread)).toBe(true);
      expect(isStandaloneBreakfastBread(paratha)).toBe(false);
      expect(isStandaloneBreakfastBread(chilla)).toBe(false);
      expect(isStandaloneBreakfastBread(plainBread)).toBe(false);
    });

    it("breakfastMainCarriesChutney is true only for a Chilla or Paratha main", () => {
      // Dish-driven §3 chutney signal: keyed on category, not the complete_carb
      // tag, so it fires on the Tue/Thu single pick too. Bread (served alone) and
      // Complete meal mains carry no chutney.
      expect(breakfastMainCarriesChutney(makeDish({ category: "Chilla" }))).toBe(true);
      expect(breakfastMainCarriesChutney(makeDish({ category: "Paratha" }))).toBe(true);
      expect(breakfastMainCarriesChutney(makeDish({ category: "Bread" }))).toBe(false);
      expect(breakfastMainCarriesChutney(makeDish({ category: "Complete meal" }))).toBe(false);
    });
  });

  describe("§3.2 Menu 1 (Mon/Wed/Fri weekday plate)", () => {
    it("HP lead pool requires HP tag AND (Gravy dish OR Dry dish) AND Indian Lunch", () => {
      const hpGravy = makeDish({
        time: "Lunch",
        category: "Gravy dish",
        tags: ["HP"],
      });
      const hpDry = makeDish({
        time: "Lunch",
        category: "Dry dish",
        tags: ["HP"],
      });
      const hpKeto = makeDish({
        time: "Lunch",
        category: "Keto",
        tags: ["HP"],
      });
      const nonHpGravy = makeDish({ time: "Lunch", category: "Gravy dish" });
      const out = menu1([hpGravy, hpDry, hpKeto, nonHpGravy]);
      expect(out.hp).toEqual([hpGravy, hpDry]);
    });

    it("companion pool is the non-HP Indian Gravy/Dry/Accompaniment dishes", () => {
      const nonHpGravy = makeDish({ time: "Lunch", category: "Gravy dish" });
      const hpGravy = makeDish({ time: "Lunch", category: "Gravy dish", tags: ["HP"] });
      const nonHpDry = makeDish({ time: "Lunch", category: "Dry dish" });
      const acc = makeDish({ time: "Lunch", category: "Accompaniment" });
      const nonIndian = makeDish({ time: "Lunch", category: "Dry dish", cuisine: "Thai" });
      const out = menu1([nonHpGravy, hpGravy, nonHpDry, acc, nonIndian]);
      // Companions are the unified non-HP Indian pool (Gravy + Dry + Accompaniment);
      // the HP gravy and the non-Indian dish are excluded.
      expect(out.companions).toEqual([nonHpGravy, nonHpDry, acc]);
      expect(out.companions.some((d) => d.tags.includes("HP"))).toBe(false);
      expect(out.companions.some((d) => d.cuisine !== "Indian")).toBe(false);
    });

    it("carb pools split Rice and Chapati; protein floor is HP-or-Keto Indian/neutral", () => {
      const chapati = makeDish({ time: "Lunch", category: "Chapati" });
      const rice = makeDish({ time: "Lunch", category: "Rice" });
      const hpGravy = makeDish({ time: "Lunch", category: "Gravy dish", tags: ["HP"] });
      const keto = makeDish({ time: "Lunch", category: "Keto" });
      const neutralProtein = makeDish({
        time: "Lunch",
        category: "Dry dish",
        cuisine: "Thai",
        tags: ["HP", "cuisine_neutral"],
      });
      const out = menu1([chapati, rice, hpGravy, keto, neutralProtein]);
      expect(out.riceCarb).toEqual([rice]);
      expect(out.chapatiCarb).toEqual([chapati]);
      // Floor: the HP Indian gravy, the Keto, and the neutral HP protein (a Thai
      // dish qualifies only via cuisine_neutral).
      expect(out.proteinFloor).toEqual([hpGravy, keto, neutralProtein]);
    });
  });

  describe("§3.2 Menu 2 (Tue/Thu weekday plate)", () => {
    it("keto lead pool plus the shared companion/carb/floor pools", () => {
      const keto = makeDish({ time: "Lunch", category: "Keto" });
      const nonHpGravy = makeDish({ time: "Lunch", category: "Gravy dish" });
      const hpGravy = makeDish({ time: "Lunch", category: "Gravy dish", tags: ["HP"] });
      const nonHpDry = makeDish({ time: "Lunch", category: "Dry dish" });
      const chapati = makeDish({ time: "Lunch", category: "Chapati" });
      const out = menu2([keto, nonHpGravy, hpGravy, nonHpDry, chapati]);
      expect(out.keto).toEqual([keto]);
      // Companions: non-HP Indian Gravy/Dry (the HP gravy and the Keto lead are excluded).
      expect(out.companions).toEqual([nonHpGravy, nonHpDry]);
      expect(out.chapatiCarb).toEqual([chapati]);
    });
  });

  describe("§3.1 lunch budget", () => {
    it("clamps WEEKDAY_CAP - breakfastItemCount to [2, LUNCH_MAX_ITEMS]", () => {
      expect(LUNCH_MAX_ITEMS).toBe(4);
      // 2-item breakfast (Mon/Wed/Fri) -> 3-item lunch budget.
      expect(lunchBudget(2)).toBe(3);
      // 1-item breakfast (Tue/Thu) -> 4-item lunch budget (the max).
      expect(lunchBudget(1)).toBe(4);
      // A 0-item breakfast never lifts the budget above LUNCH_MAX_ITEMS.
      expect(lunchBudget(0)).toBe(4);
      // A heavy 3-item breakfast floors the budget at 2.
      expect(lunchBudget(3)).toBe(2);
      expect(lunchBudget(4)).toBe(2);
    });
  });

  describe("§3 Menu 3 (Saturday)", () => {
    it("returns complete_meal+HP, Accompaniment, Dessert pools", () => {
      const completeMealHp = makeDish({
        time: "Lunch",
        category: "Complete meal",
        tags: ["complete_meal", "HP"],
      });
      const completeMealNonHp = makeDish({
        time: "Lunch",
        category: "Complete meal",
        tags: ["complete_meal"],
      });
      const acc = makeDish({ time: "Lunch", category: "Accompaniment" });
      const dessert = makeDish({ time: "Lunch", category: "Dessert" });
      const out = menu3([completeMealHp, completeMealNonHp, acc, dessert]);
      expect(out.completeMealHp).toEqual([completeMealHp]);
      expect(out.accompaniment).toEqual([acc]);
      expect(out.dessert).toEqual([dessert]);
    });
  });

  describe("§3 Menu 4 (Saturday)", () => {
    it("returns complete_meal non-HP, Keto, Accompaniment pools", () => {
      const completeMealHp = makeDish({
        time: "Lunch",
        category: "Complete meal",
        tags: ["complete_meal", "HP"],
      });
      const completeMealNonHp = makeDish({
        time: "Lunch",
        category: "Complete meal",
        tags: ["complete_meal"],
      });
      const keto = makeDish({ time: "Lunch", category: "Keto" });
      const acc = makeDish({ time: "Lunch", category: "Accompaniment" });
      const out = menu4([completeMealHp, completeMealNonHp, keto, acc]);
      expect(out.completeMealNonHp).toEqual([completeMealNonHp]);
      expect(out.keto).toEqual([keto]);
      expect(out.accompaniment).toEqual([acc]);
    });
  });

  describe("§3 Menu intl (international lunch form)", () => {
    it("isIntlAnchor: non-Indian Lunch in an anchor category; isCuisineNeutral keys on the tag", () => {
      const thaiGravy = makeDish({ time: "Lunch", category: "Gravy dish", cuisine: "Thai" });
      const indianGravy = makeDish({ time: "Lunch", category: "Gravy dish", cuisine: "Indian" });
      const nonIndianAcc = makeDish({
        time: "Lunch",
        category: "Accompaniment",
        cuisine: "Italian",
      });
      const nonIndianBreakfast = makeDish({
        time: "Breakfast",
        category: "Dry dish",
        cuisine: "Thai",
      });
      expect(isIntlAnchor(thaiGravy)).toBe(true);
      expect(isIntlAnchor(indianGravy)).toBe(false); // Indian is never an intl anchor
      expect(isIntlAnchor(nonIndianAcc)).toBe(false); // Accompaniment is not an anchor category
      expect(isIntlAnchor(nonIndianBreakfast)).toBe(false); // Lunch only
      expect(isCuisineNeutral(makeDish({ tags: ["cuisine_neutral"] }))).toBe(true);
      expect(isCuisineNeutral(makeDish({ tags: ["HP"] }))).toBe(false);
    });

    it("companion pools are same-cuisine-or-neutral and the form carries no Indian carb", () => {
      const anchor = makeDish({
        time: "Lunch",
        category: "Dry dish",
        cuisine: "Continental",
        tags: ["HP"],
        primaryIngredient: "Chicken Breast",
      });
      const sameCuisineVeg = makeDish({
        time: "Lunch",
        category: "Dry dish",
        cuisine: "Continental",
      });
      const sameCuisineProtein = makeDish({
        time: "Lunch",
        category: "Keto",
        cuisine: "Continental",
        tags: ["HP"],
      });
      const neutralProtein = makeDish({
        time: "Lunch",
        category: "Keto",
        cuisine: "Indian",
        tags: ["HP", "cuisine_neutral"],
        primaryIngredient: "Chicken Breast",
      });
      const otherCuisineVeg = makeDish({ time: "Lunch", category: "Dry dish", cuisine: "Thai" });
      const indianCarb = makeDish({ time: "Lunch", category: "Chapati", cuisine: "Indian" });
      const out = menuIntl(
        [anchor, sameCuisineVeg, sameCuisineProtein, neutralProtein, otherCuisineVeg, indianCarb],
        anchor,
      );
      expect(out.kind).toBe("menu-intl");
      // proteinCompanion: same-cuisine OR neutral HP/Keto; never the other cuisine.
      expect(out.proteinCompanion).toContain(sameCuisineProtein);
      expect(out.proteinCompanion).toContain(neutralProtein);
      expect(out.proteinCompanion).not.toContain(otherCuisineVeg);
      // sideCompanion: same-cuisine non-HP veg; never the other cuisine, never the Indian carb.
      expect(out.sideCompanion).toContain(sameCuisineVeg);
      expect(out.sideCompanion).not.toContain(otherCuisineVeg);
      const pooled = [...out.anchor, ...out.proteinCompanion, ...out.sideCompanion];
      expect(pooled.some((d) => d.category === "Chapati" || d.category === "Rice")).toBe(false);
    });

    it("an undefined anchor (defensive) keeps only cuisine_neutral companions", () => {
      const thaiProtein = makeDish({
        time: "Lunch",
        category: "Keto",
        cuisine: "Thai",
        tags: ["HP"],
      });
      const neutralProtein = makeDish({
        time: "Lunch",
        category: "Keto",
        cuisine: "Indian",
        tags: ["HP", "cuisine_neutral"],
      });
      const out = menuIntl([thaiProtein, neutralProtein], undefined);
      // No anchor cuisine to match → only the neutral protein qualifies.
      expect(out.proteinCompanion).toEqual([neutralProtein]);
    });
  });

  describe("§3.2 international substitution selection", () => {
    function intlAnchor(id: number, cuisine: Dish["cuisine"], extra: Partial<Dish> = {}): Dish {
      return makeDish({
        id,
        time: "Lunch",
        category: "Gravy dish",
        cuisine,
        tags: ["HP"],
        ...extra,
      });
    }

    it("selects up to two anchors, preferring distinct cuisines", () => {
      const lib = [
        intlAnchor(160, "Thai"),
        intlAnchor(161, "Thai"),
        intlAnchor(164, "Chinese"),
        // an Indian protein candidate so the trigger has a day's protein to compare against
        makeDish({ id: 1, time: "Lunch", category: "Gravy dish", cuisine: "Indian", tags: ["HP"] }),
      ];
      const out = selectInternationalSubstitutions({
        library: lib,
        history: emptyHistory,
        season: "Summer",
      });
      expect(out.length).toBe(2);
      const cuisines = out.map((d) => lib.find((x) => x.id === d.leadDishId)!.cuisine);
      // Distinct cuisines preferred: Thai (longest-unused, lowest id) then Chinese, not Thai twice.
      expect(new Set(cuisines).size).toBe(2);
      expect(out.every((d) => d.form === "menu-intl")).toBe(true);
      // Distinct days, no double-substitution.
      expect(new Set(out.map((d) => d.day)).size).toBe(out.length);
    });

    it("planWeekdaySubstitutions: international claims days first, complete_meal takes a different day", () => {
      const lib = [
        intlAnchor(160, "Thai"),
        intlAnchor(164, "Chinese"),
        makeDish({ id: 1, time: "Lunch", category: "Gravy dish", cuisine: "Indian", tags: ["HP"] }),
        makeDish({ id: 2, time: "Lunch", category: "Keto", cuisine: "Indian" }),
        makeDish({
          id: 50,
          time: "Lunch",
          category: "Complete meal",
          cuisine: "Indian",
          tags: ["complete_meal", "HP"],
          primaryIngredient: "Chicken",
        }),
      ];
      const out = planWeekdaySubstitutions({
        library: lib,
        history: emptyHistory,
        season: "Summer",
      });
      const intl = out.filter((d) => d.form === "menu-intl");
      const cm = out.filter((d) => d.form === "menu-3" || d.form === "menu-4");
      expect(intl.length).toBe(2);
      expect(cm.length).toBeLessThanOrEqual(1);
      // No day is substituted twice.
      expect(new Set(out.map((d) => d.day)).size).toBe(out.length);
      // The complete_meal lead is never one of the international anchors.
      const intlIds = new Set(intl.map((d) => d.leadDishId));
      expect(cm.every((d) => !intlIds.has(d.leadDishId))).toBe(true);
    });

    it("returns no international substitution when the anchor pool is empty (all-Indian library)", () => {
      const lib = [
        makeDish({ id: 1, time: "Lunch", category: "Gravy dish", cuisine: "Indian", tags: ["HP"] }),
        makeDish({ id: 2, time: "Lunch", category: "Chapati", cuisine: "Indian" }),
      ];
      expect(
        selectInternationalSubstitutions({ library: lib, history: emptyHistory, season: "Summer" }),
      ).toEqual([]);
    });
  });

  describe("§3.4 carb pools", () => {
    it("riceCarb is Category=Rice, chapatiCarb is Category=Chapati, split by category", () => {
      const chapati = makeDish({ time: "Lunch", category: "Chapati" });
      const rice = makeDish({ time: "Lunch", category: "Rice" });
      const gravy = makeDish({ time: "Lunch", category: "Gravy dish" });
      const out = menu1([chapati, rice, gravy]);
      expect(out.riceCarb).toEqual([rice]);
      expect(out.chapatiCarb).toEqual([chapati]);
    });

    it("both carb pools are static category snapshots (no rice cap; spacing is generation-level)", () => {
      // The composition pools no longer drop Rice on a rice-already-used week: the
      // hard rice-spacing rule (§3.4) is applied at pick time in generateWeek, so
      // the pool just splits by category.
      const chapati = makeDish({ time: "Lunch", category: "Chapati" });
      const riceA = makeDish({ time: "Lunch", category: "Rice" });
      const riceB = makeDish({ time: "Lunch", category: "Rice" });
      const out = menu2([chapati, riceA, riceB]);
      expect(out.riceCarb).toEqual([riceA, riceB]);
      expect(out.chapatiCarb).toEqual([chapati]);
    });
  });

  describe("§3.2 weekday complete_meal substitution trigger", () => {
    it("returns null when no complete_meal Lunch dishes are eligible", () => {
      const lib = [
        makeDish({ time: "Lunch", category: "Gravy dish", tags: ["HP"] }),
        makeDish({ time: "Lunch", category: "Chapati" }),
      ];
      const decision = shouldSubstituteWeekday({
        library: lib,
        history: emptyHistory,
        season: "Summer",
      });
      expect(decision).toBeNull();
    });

    it("triggers when complete_meal is longest unused; returns Menu 3 form for HP-tagged lead", () => {
      const completeMealHp = makeDish({
        id: 100,
        time: "Lunch",
        category: "Complete meal",
        tags: ["complete_meal", "HP"],
      });
      const hpGravy = makeDish({
        id: 101,
        time: "Lunch",
        category: "Gravy dish",
        tags: ["HP"],
      });
      const history: MenuHistoryRow[] = [
        // hpGravy cooked recently; completeMealHp never cooked.
        {
          weekStart: "2026-05-25",
          day: "Monday",
          meal: "Lunch",
          dishName: hpGravy.name,
          dishId: 101,
        },
      ];
      const decision = shouldSubstituteWeekday({
        library: [completeMealHp, hpGravy],
        history,
        season: "Summer",
      });
      expect(decision).not.toBeNull();
      expect(decision!.form).toBe("menu-3");
      expect(decision!.leadDishId).toBe(100);
      expect(decision!.day).toBe("Mon");
    });

    it("non-trigger: complete_meal lead is newer than the day's protein candidate", () => {
      const completeMealHp = makeDish({
        id: 200,
        time: "Lunch",
        category: "Complete meal",
        tags: ["complete_meal", "HP"],
      });
      const hpGravy = makeDish({
        id: 201,
        time: "Lunch",
        category: "Gravy dish",
        tags: ["HP"],
      });
      const keto = makeDish({
        id: 202,
        time: "Lunch",
        category: "Keto",
      });
      const history: MenuHistoryRow[] = [
        // complete_meal cooked yesterday; HP and Keto candidates never cooked.
        {
          weekStart: "2026-05-25",
          day: "Saturday",
          meal: "Lunch",
          dishName: completeMealHp.name,
          dishId: 200,
        },
      ];
      const decision = shouldSubstituteWeekday({
        library: [completeMealHp, hpGravy, keto],
        history,
        season: "Summer",
      });
      expect(decision).toBeNull();
    });

    it("user-requested override picks that dish even when the longest-unused trigger would not fire", () => {
      const completeMealNonHp = makeDish({
        id: 300,
        time: "Lunch",
        category: "Complete meal",
        tags: ["complete_meal"],
      });
      const hpGravy = makeDish({
        id: 301,
        time: "Lunch",
        category: "Gravy dish",
        tags: ["HP"],
      });
      const history: MenuHistoryRow[] = [
        // complete_meal is the most recently cooked — trigger b would not fire.
        {
          weekStart: "2026-06-01",
          day: "Saturday",
          meal: "Lunch",
          dishName: completeMealNonHp.name,
          dishId: 300,
        },
      ];
      const decision = shouldSubstituteWeekday({
        library: [completeMealNonHp, hpGravy],
        history,
        season: "Summer",
        userRequestedDishId: 300,
      });
      expect(decision).not.toBeNull();
      expect(decision!.form).toBe("menu-4");
      expect(decision!.leadDishId).toBe(300);
    });

    it("user-requested override returns null if the requested dish is not an eligible complete_meal Lunch dish", () => {
      const completeMealHp = makeDish({
        id: 400,
        time: "Lunch",
        category: "Complete meal",
        tags: ["complete_meal", "HP"],
      });
      const breakfastCm = makeDish({
        id: 401,
        time: "Breakfast",
        category: "Complete meal",
        tags: ["complete_meal"],
      });
      const decision = shouldSubstituteWeekday({
        library: [completeMealHp, breakfastCm],
        history: emptyHistory,
        season: "Summer",
        userRequestedDishId: 401,
      });
      expect(decision).toBeNull();
    });
  });

  describe("composeSlot dispatch", () => {
    it("dispatches Mon Breakfast to the savoury breakfast pair set", () => {
      const cc = makeDish({
        time: "Breakfast",
        category: "Paratha",
        tags: ["complete_carb"],
      });
      const out = composeSlot({
        slot: breakfast("Mon"),
        library: [cc],
        history: emptyHistory,
        season: "Summer",
      });
      const pair = out as BreakfastWeekdayPairCandidateSet;
      expect(pair.kind).toBe("breakfast-pair");
      expect(pair.optionB.completeCarb).toEqual([cc]);
    });

    it("dispatches Tue Breakfast to the single-pick set", () => {
      const cm = makeDish({
        time: "Breakfast",
        category: "Complete meal",
        tags: ["complete_meal"],
      });
      const out = composeSlot({
        slot: breakfast("Tue"),
        library: [cm],
        history: emptyHistory,
        season: "Summer",
      });
      const single = out as BreakfastSinglePickCandidateSet;
      expect(single.kind).toBe("breakfast-single");
      expect(single.pool).toEqual([cm]);
    });

    it("dispatches Mon Lunch to Menu 1", () => {
      const hp = makeDish({
        time: "Lunch",
        category: "Gravy dish",
        tags: ["HP"],
      });
      const out = composeSlot({
        slot: lunch("Mon", 1),
        library: [hp],
        history: emptyHistory,
        season: "Summer",
      });
      const m1 = out as Menu1CandidateSet;
      expect(m1.kind).toBe("menu-1");
      expect(m1.hp).toEqual([hp]);
    });

    it("dispatches Tue Lunch to Menu 2", () => {
      const keto = makeDish({ time: "Lunch", category: "Keto" });
      const out = composeSlot({
        slot: lunch("Tue", 2),
        library: [keto],
        history: emptyHistory,
        season: "Summer",
      });
      const m2 = out as Menu2CandidateSet;
      expect(m2.kind).toBe("menu-2");
      expect(m2.keto).toEqual([keto]);
    });

    it("dispatches Sat Lunch lunchMenu=3 to Menu 3", () => {
      const cmhp = makeDish({
        time: "Lunch",
        category: "Complete meal",
        tags: ["complete_meal", "HP"],
      });
      const out = composeSlot({
        slot: lunch("Sat", 3),
        library: [cmhp],
        history: emptyHistory,
        season: "Summer",
      });
      const m3 = out as Menu3CandidateSet;
      expect(m3.kind).toBe("menu-3");
      expect(m3.completeMealHp).toEqual([cmhp]);
    });

    it("dispatches Sat Lunch lunchMenu=4 to Menu 4", () => {
      const cm = makeDish({
        time: "Lunch",
        category: "Complete meal",
        tags: ["complete_meal"],
      });
      const out = composeSlot({
        slot: lunch("Sat", 4),
        library: [cm],
        history: emptyHistory,
        season: "Summer",
      });
      const m4 = out as Menu4CandidateSet;
      expect(m4.kind).toBe("menu-4");
      expect(m4.completeMealNonHp).toEqual([cm]);
    });

    it("dispatches a Lunch slot with intlAnchorDishId to the international form", () => {
      const anchor = makeDish({
        id: 500,
        time: "Lunch",
        category: "Dry dish",
        cuisine: "Continental",
        tags: ["HP"],
        primaryIngredient: "Chicken Breast",
      });
      const out = composeSlot({
        slot: { day: "Tue", meal: "Lunch", itemCount: 2, intlAnchorDishId: 500 },
        library: [anchor],
        history: emptyHistory,
        season: "Summer",
      });
      expect(out.kind).toBe("menu-intl");
      expect((out as { anchor: Dish[] }).anchor).toEqual([anchor]);
    });

    it("applies §1 eligibility (active + season) before §3 composition", () => {
      const ccInactive = makeDish({
        time: "Breakfast",
        category: "Paratha",
        tags: ["complete_carb"],
        active: "No",
      });
      const ccOutOfSeason = makeDish({
        time: "Breakfast",
        category: "Paratha",
        tags: ["complete_carb"],
        seasons: ["Winter"],
      });
      const ccOk = makeDish({
        time: "Breakfast",
        category: "Paratha",
        tags: ["complete_carb"],
      });
      const out = composeSlot({
        slot: breakfast("Mon"),
        library: [ccInactive, ccOutOfSeason, ccOk],
        history: emptyHistory,
        season: "Summer",
      });
      const pair = out as BreakfastWeekdayPairCandidateSet;
      expect(pair.optionB.completeCarb).toEqual([ccOk]);
    });

    it("composes Menu 1 carb pools by category, ignoring weekLunchCarbs (spacing is §3.4)", () => {
      const chapati = makeDish({ time: "Lunch", category: "Chapati" });
      const rice = makeDish({ time: "Lunch", category: "Rice" });
      const ricePicked = makeDish({ time: "Lunch", category: "Rice" });
      const hp = makeDish({
        time: "Lunch",
        category: "Gravy dish",
        tags: ["HP"],
      });
      const out = composeSlot({
        slot: lunch("Mon", 1),
        library: [chapati, rice, hp],
        history: emptyHistory,
        season: "Summer",
        // Retained for the requests.ts consumer; composition no longer reads it.
        weekLunchCarbs: [ricePicked],
      });
      const m1 = out as Menu1CandidateSet;
      expect(m1.riceCarb).toEqual([rice]);
      expect(m1.chapatiCarb).toEqual([chapati]);
    });

    it("throws if a lunch slot has no lunchMenu", () => {
      expect(() =>
        composeSlot({
          slot: {
            day: "Mon",
            meal: "Lunch",
            itemCount: 3,
          },
          library: [],
          history: emptyHistory,
          season: "Summer",
        }),
      ).toThrow(/lunchMenu/);
    });
  });

  // Cluster D (one HP source per meal, all menu forms): the §3 one-HP-per-meal
  // filter generalises #61's Menu-1-only non-HP partner across every form.
  describe("§3 one-HP-per-meal filter (Cluster D)", () => {
    it("isHp keys on the HP tag, not on names", () => {
      expect(isHp(makeDish({ tags: ["HP"] }))).toBe(true);
      expect(isHp(makeDish({ tags: [] }))).toBe(false);
      expect(isHp(makeDish({ tags: ["complete_meal"] }))).toBe(false);
    });

    it("is a no-op when the meal does not yet hold an HP dish", () => {
      const hp = makeDish({ tags: ["HP"], category: "Accompaniment" });
      const plain = makeDish({ category: "Accompaniment" });
      expect(excludeHpIfMealHasHp([hp, plain], false)).toEqual([hp, plain]);
    });

    it("drops HP-tagged dishes once the meal holds an HP dish", () => {
      const hp = makeDish({
        tags: ["HP"],
        category: "Accompaniment",
        primaryIngredient: "Chicken",
      });
      const plain = makeDish({ category: "Accompaniment" });
      expect(excludeHpIfMealHasHp([hp, plain], true)).toEqual([plain]);
    });

    it("is property-based: a paneer HP side is dropped exactly as a chicken one", () => {
      const hpPaneer = makeDish({
        tags: ["HP"],
        category: "Accompaniment",
        primaryIngredient: "Paneer",
      });
      const plain = makeDish({ category: "Accompaniment" });
      const out = excludeHpIfMealHasHp([hpPaneer, plain], true);
      expect(out).toEqual([plain]);
      expect(out.some((d) => d.tags.includes("HP"))).toBe(false);
    });

    it("thin-pool fallback: returns the unfiltered pool when every candidate is HP", () => {
      const hpA = makeDish({ tags: ["HP"], category: "Accompaniment" });
      const hpB = makeDish({ tags: ["HP"], category: "Accompaniment" });
      // No non-HP candidate exists, so the slot still fills (a second HP side
      // beats an incomplete meal). Documented fallback.
      expect(excludeHpIfMealHasHp([hpA, hpB], true)).toEqual([hpA, hpB]);
    });
  });
});
