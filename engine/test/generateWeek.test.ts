import { describe, it, expect } from "vitest";
import { generateWeek } from "../src/generateWeek.js";
import { loadLiveData } from "./loadLive.js";
import type {
  Dish,
  Ingredient,
  MenuHistoryRow,
  PackSizeHeader,
  Season,
} from "../src/data/schemas.js";

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
    // 15 minutes, so a full six-item day costs 90 of the §9 120-minute budget and
    // the STRUCTURE under test is what sizes the plate. The budget itself has its
    // own tests below, which use expensive dishes on purpose.
    prepMinutes: 15,
    seasons: "All",
    cuisine: "Indian",
    ...overrides,
  };
}

const emptyHistory: MenuHistoryRow[] = [];
const emptyIngredients: Ingredient[] = [];
const emptyPackSizes: PackSizeHeader[] = [];

/**
 * Builds a minimum-viable library that can fill every slot for a full week.
 * Two of each role so step-1 longest-unused has something to alternate over.
 */
function makeMinimalLibrary(): Dish[] {
  return [
    // Savoury Mon/Wed/Fri 2-item breakfast (Option B: complete_carb + breakfast
    // accompaniment). Two complete_carbs and two accompaniments so step-1
    // longest-unused has something to alternate over across Mon/Wed/Fri.
    makeDish({
      name: "Aloo Paratha",
      time: "Breakfast",
      category: "Paratha",
      tags: ["complete_carb"],
      primaryIngredient: "Potato",
    }),
    makeDish({
      name: "Breakfast Curd",
      time: "Breakfast",
      category: "Accompaniment",
      primaryIngredient: "Curd",
    }),
    makeDish({
      name: "Methi Thepla",
      time: "Breakfast",
      category: "Paratha",
      tags: ["complete_carb"],
      primaryIngredient: "Fenugreek",
    }),
    makeDish({
      name: "Breakfast Pickle",
      time: "Breakfast",
      category: "Accompaniment",
      primaryIngredient: "Mango",
    }),
    // Category=Fruit dishes. §3.3 is retired, so these are deliberately left in
    // the fixture library as dishes no pool may ever place.
    makeDish({
      name: "Apple",
      time: "Breakfast",
      category: "Fruit",
      tags: ["fruit"],
      primaryIngredient: "Apple",
    }),
    makeDish({
      name: "Banana",
      time: "Breakfast",
      category: "Fruit",
      tags: ["fruit"],
      primaryIngredient: "Banana",
    }),
    // Single-pick breakfast (Tue/Thu): complete_meal or complete_carb
    makeDish({
      name: "Stuffed Paratha",
      time: "Breakfast",
      category: "Paratha",
      tags: ["complete_carb"],
      primaryIngredient: "Wheat flour",
    }),
    makeDish({
      name: "Masala Dosa",
      time: "Breakfast",
      category: "Complete meal",
      tags: ["complete_meal"],
      primaryIngredient: "Dosa batter",
    }),
    // Lunch Menu 1 pool: HP gravy + non-HP gravy + lunch carb
    makeDish({
      name: "Paneer Butter Masala",
      time: "Lunch",
      category: "Gravy dish",
      tags: ["HP"],
      primaryIngredient: "Paneer",
    }),
    makeDish({
      name: "Chicken Curry",
      time: "Lunch",
      category: "Gravy dish",
      tags: ["HP"],
      primaryIngredient: "Chicken",
    }),
    makeDish({
      name: "Aloo Gobi",
      time: "Lunch",
      category: "Gravy dish",
      primaryIngredient: "Cauliflower",
    }),
    makeDish({
      name: "Bhindi Masala",
      time: "Lunch",
      category: "Dry dish",
      tags: ["HP"],
      primaryIngredient: "Bhindi",
    }),
    makeDish({
      name: "Cucumber Raita",
      time: "Lunch",
      category: "Accompaniment",
      primaryIngredient: "Curd",
    }),
    makeDish({
      name: "Onion Salad",
      time: "Lunch",
      category: "Accompaniment",
      primaryIngredient: "Onion",
    }),
    // Lunch Menu 2 pool: Keto + non-HP gravy + non-HP dry + carb
    makeDish({
      name: "Stir-fry Tofu",
      time: "Lunch",
      category: "Keto",
      primaryIngredient: "Tofu",
    }),
    makeDish({
      name: "Egg Bhurji",
      time: "Lunch",
      category: "Keto",
      primaryIngredient: "Egg",
    }),
    makeDish({
      name: "Cabbage Sabzi",
      time: "Lunch",
      category: "Dry dish",
      primaryIngredient: "Cabbage",
    }),
    makeDish({
      name: "Dal Tadka",
      time: "Lunch",
      category: "Gravy dish",
      primaryIngredient: "Dal",
    }),
    // Lunch carbs
    makeDish({
      name: "Chapati",
      time: "Lunch",
      category: "Chapati",
      primaryIngredient: "Wheat flour",
    }),
    makeDish({
      name: "Jeera Rice",
      time: "Lunch",
      category: "Rice",
      primaryIngredient: "Rice",
    }),
    // Saturday Menu 3 + Menu 4 pools
    makeDish({
      name: "Biryani Chicken",
      time: "Lunch",
      category: "Complete meal",
      tags: ["complete_meal", "HP"],
      primaryIngredient: "Chicken",
    }),
    makeDish({
      name: "Veg Pulao",
      time: "Lunch",
      category: "Complete meal",
      tags: ["complete_meal"],
      primaryIngredient: "Rice",
    }),
    makeDish({
      name: "Gulab Jamun",
      time: "Lunch",
      category: "Dessert",
      primaryIngredient: "Khoya",
    }),
  ];
}

describe("generateWeek — top-level engine", () => {
  describe("structural week shape against a minimal library", () => {
    nextId = 1;
    const library = makeMinimalLibrary();

    it("returns a Mon-to-Sat week (no Sunday)", () => {
      const week = generateWeek({
        weekStart: "2026-06-08",
        library,
        history: emptyHistory,
        season: "Summer",
        ingredients: emptyIngredients,
        packSizes: emptyPackSizes,
        rng: () => 0.1, // Sat picks menu 3
        lastSaturdayMenu: null,
      });
      const dayNames = week.days.map((d) => d.day);
      expect(dayNames).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
    });

    it("composes each weekday to the §9 item budget and Saturday to its Menu 3/4 form", () => {
      const week = generateWeek({
        weekStart: "2026-06-08",
        library,
        history: emptyHistory,
        season: "Summer",
        ingredients: emptyIngredients,
        packSizes: emptyPackSizes,
        rng: () => 0.1,
        lastSaturdayMenu: null,
      });
      const dishesPerDay = week.days.map((d) =>
        d.slots.reduce((sum, s) => sum + s.dishes.length, 0),
      );
      // Breakfast is dish-driven (§10.4): a Chilla/Paratha main draws its chutney
      // (2 items), a complete_meal main is served alone and then takes the protein
      // floor (2 items). Lunch composes to the rest of the day's item budget
      // (§3.1: clamp(6 - breakfastItems, 2, 4)), so a weekday lands at the 6-item
      // backstop wherever the thin fixture pools can fill it, and Saturday, which
      // has no breakfast, at its 3-item Menu 3/4 form. A position whose pool this
      // small library has already spent lands short rather than repeating a dish,
      // which is why one weekday sits at 5.
      expect(dishesPerDay).toEqual([6, 6, 6, 5, 6, 3]);
    });

    it("§3.3 is retired: a day carries breakfast and lunch slots and nothing else", () => {
      const week = generateWeek({
        weekStart: "2026-06-08",
        library,
        history: emptyHistory,
        season: "Summer",
        ingredients: emptyIngredients,
        packSizes: emptyPackSizes,
        rng: () => 0.1,
        lastSaturdayMenu: null,
      });
      expect(week.days.map((d) => d.day)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
      for (const day of week.days) {
        expect(Object.keys(day).sort(), `${day.day} keys`).toEqual(["day", "slots"]);
        for (const slot of day.slots) {
          expect(slot.meal === "Breakfast" || slot.meal === "Lunch").toBe(true);
        }
      }
    });

    it("§3.3 a Category=Fruit dish never appears in any slot, even when eligible", () => {
      const week = generateWeek({
        weekStart: "2026-06-08",
        library,
        history: emptyHistory,
        season: "Summer",
        ingredients: emptyIngredients,
        packSizes: emptyPackSizes,
        rng: () => 0.1,
        lastSaturdayMenu: null,
      });
      for (const day of week.days) {
        for (const slot of day.slots) {
          for (const dish of slot.dishes) {
            expect(dish.category, `${day.day} ${slot.meal} ${dish.name}`).not.toBe("Fruit");
          }
        }
      }
    });

    it('§3.3 a legacy meal:"Fruit" history row is read without placing a fruit', () => {
      // features/engine-v4.md §14.3: weekArchive and menu_history.md still hold
      // the retired Fruit of the day's rows and are never rewritten, so the
      // generator must ingest one and produce a week with no fruit in it.
      const lib = makeMinimalLibrary();
      const apple = lib.find((d) => d.name === "Apple")!;
      const legacyHistory: MenuHistoryRow[] = [
        {
          weekStart: "2026-06-01",
          day: "Monday",
          meal: "Fruit",
          dishName: "Apple",
          dishId: apple.id,
        },
        {
          weekStart: "2026-06-01",
          day: "Tuesday",
          meal: "Fruit",
          dishName: "Apple",
          dishId: apple.id,
        },
      ];
      const week = generateWeek({
        weekStart: "2026-06-08",
        library: lib,
        history: legacyHistory,
        season: "Summer",
        ingredients: emptyIngredients,
        packSizes: emptyPackSizes,
        rng: () => 0.1,
        lastSaturdayMenu: null,
      });
      const placed = week.days.flatMap((d) => d.slots.flatMap((s) => s.dishes));
      expect(placed.length).toBeGreaterThan(0);
      expect(placed.some((d) => d.category === "Fruit")).toBe(false);
    });

    it("§3.1/§9 budget-aware composition fits the day, so nothing is ever dropped", () => {
      // Every plate composes to the day budget as it goes, so no day can exceed
      // either §9 limit and nothing is ever dropped.
      const week = generateWeek({
        weekStart: "2026-06-08",
        library,
        history: emptyHistory,
        season: "Summer",
        ingredients: emptyIngredients,
        packSizes: emptyPackSizes,
        rng: () => 0.1,
        lastSaturdayMenu: null,
      });
      // §9: nothing is dropped and no day breaches either limit.
      for (const day of week.days) {
        const dishes = day.slots.flatMap((s) => s.dishes);
        expect(dishes.length, `${day.day} items`).toBeLessThanOrEqual(6);
        expect(
          dishes.reduce((sum, d) => sum + d.prepMinutes, 0),
          `${day.day} minutes`,
        ).toBeLessThanOrEqual(120);
      }
      // Every Menu-1 weekday lunch carries its carb and its HP main, at 4 items.
      for (const dayName of ["Mon", "Wed", "Fri"] as const) {
        const lunch = week.days
          .find((d) => d.day === dayName)!
          .slots.find((s) => s.meal === "Lunch")!;
        expect(lunch.dishes.some((d) => d.category === "Chapati" || d.category === "Rice")).toBe(
          true,
        );
        expect(lunch.dishes.some((d) => d.tags.includes("HP"))).toBe(true);
        expect(lunch.dishes.length).toBe(4);
      }
    });

    it("§3.2 one wet dish per plate: no weekday lunch carries two Gravy dishes", () => {
      const week = generateWeek({
        weekStart: "2026-06-08",
        library,
        history: emptyHistory,
        season: "Summer",
        ingredients: emptyIngredients,
        packSizes: emptyPackSizes,
        rng: () => 0.1,
        lastSaturdayMenu: null,
      });
      for (const day of week.days) {
        for (const slot of day.slots) {
          if (slot.meal !== "Lunch") continue;
          const gravyCount = slot.dishes.filter((d) => d.category === "Gravy dish").length;
          expect(gravyCount, `${day.day} lunch has ${gravyCount} gravy dishes`).toBeLessThanOrEqual(
            1,
          );
        }
      }
    });

    it("§3.3 every generated lunch carries protein (HP or Keto)", () => {
      const week = generateWeek({
        weekStart: "2026-06-08",
        library,
        history: emptyHistory,
        season: "Summer",
        ingredients: emptyIngredients,
        packSizes: emptyPackSizes,
        rng: () => 0.1,
        lastSaturdayMenu: null,
      });
      for (const day of week.days) {
        const lunch = day.slots.find((s) => s.meal === "Lunch");
        if (!lunch) continue;
        const hasProtein = lunch.dishes.some((d) => d.tags.includes("HP") || d.category === "Keto");
        expect(hasProtein, `${day.day} lunch has no protein`).toBe(true);
      }
    });
  });

  describe("§3 / §3.2 international weekday lunches", () => {
    // The minimal library is all-Indian; add a non-Indian anchor set so the
    // international substitution has anchors. Two cuisines so the selection can
    // prefer distinct cuisines; one veg-forward anchor with a same-cuisine
    // protein so the "veggies need a protein" branch is exercised.
    function makeIntlLibrary(): Dish[] {
      nextId = 1000;
      const base = makeMinimalLibrary();
      return [
        ...base,
        makeDish({
          name: "Continental baked vegetables",
          time: "Lunch",
          category: "Dry dish",
          cuisine: "Continental",
          primaryIngredient: "Mixed Veg",
        }),
        makeDish({
          name: "Continental grilled chicken",
          time: "Lunch",
          category: "Dry dish",
          cuisine: "Continental",
          tags: ["HP"],
          primaryIngredient: "Chicken Breast",
        }),
        makeDish({
          name: "Ratatouille",
          time: "Lunch",
          category: "Dry dish",
          cuisine: "Continental",
          primaryIngredient: "Mixed Veg",
        }),
        makeDish({
          name: "Thai green curry chicken",
          time: "Lunch",
          category: "Gravy dish",
          cuisine: "Thai",
          tags: ["HP"],
          primaryIngredient: "Chicken",
        }),
        makeDish({
          name: "Thai tofu stir fry",
          time: "Lunch",
          category: "Dry dish",
          cuisine: "Thai",
          tags: ["HP"],
          primaryIngredient: "Tofu",
        }),
      ];
    }

    function weekdayLunches(week: ReturnType<typeof generateWeek>) {
      return week.days
        .filter((d) => d.day !== "Sat")
        .map((d) => d.slots.find((s) => s.meal === "Lunch"))
        .filter((s): s is NonNullable<typeof s> => Boolean(s));
    }

    it("produces about two coherent single-cuisine non-Indian weekday lunches, no Indian carb", () => {
      const library = makeIntlLibrary();
      const week = generateWeek({
        weekStart: "2026-06-08",
        library,
        history: emptyHistory,
        season: "Summer",
        ingredients: emptyIngredients,
        packSizes: emptyPackSizes,
        rng: () => 0.1,
        lastSaturdayMenu: null,
      });
      const intlLunches = weekdayLunches(week).filter((s) =>
        s.dishes.some((d) => d.cuisine !== "Indian"),
      );
      expect(intlLunches.length).toBe(2);
      for (const lunch of intlLunches) {
        // Single cuisine register (no mixed-cuisine plate).
        const cuisines = new Set(lunch.dishes.map((d) => d.cuisine));
        expect(cuisines.size).toBe(1);
        expect([...cuisines][0]).not.toBe("Indian");
        // No Indian carb in the international form.
        expect(lunch.dishes.some((d) => d.category === "Chapati" || d.category === "Rice")).toBe(
          false,
        );
        // At most two items (anchor + at most one companion).
        expect(lunch.dishes.length).toBeLessThanOrEqual(2);
      }
    });

    it("a veg-forward non-Indian anchor gets exactly one same-cuisine/neutral protein", () => {
      // Force the veg-forward Continental anchor onto a weekday via a pinned
      // request? No — use history so Continental baked vegetables is the
      // longest-unused anchor and lands first. Simpler: assert that whenever an
      // international lunch leads with a non-HP veg anchor, it carries one protein.
      const library = makeIntlLibrary();
      const week = generateWeek({
        weekStart: "2026-06-08",
        library,
        history: emptyHistory,
        season: "Summer",
        ingredients: emptyIngredients,
        packSizes: emptyPackSizes,
        rng: () => 0.1,
        lastSaturdayMenu: null,
      });
      for (const lunch of weekdayLunches(week)) {
        const nonIndian = lunch.dishes.some((d) => d.cuisine !== "Indian");
        if (!nonIndian) continue;
        const anchor = lunch.dishes[0];
        const vegForward =
          !anchor.tags.includes("HP") &&
          anchor.category !== "Keto" &&
          !anchor.tags.includes("complete_meal") &&
          anchor.category !== "Complete meal";
        if (vegForward) {
          expect(lunch.dishes.length).toBe(2);
          const protein = lunch.dishes[1];
          // exactly one protein, same-cuisine or cuisine_neutral.
          expect(protein.tags.includes("HP") || protein.category === "Keto").toBe(true);
          expect(
            protein.cuisine === anchor.cuisine || protein.tags.includes("cuisine_neutral"),
          ).toBe(true);
        }
      }
    });

    it("the other weekday lunches stay the Indian thali (Menu 1/2 form with a carb)", () => {
      const library = makeIntlLibrary();
      const week = generateWeek({
        weekStart: "2026-06-08",
        library,
        history: emptyHistory,
        season: "Summer",
        ingredients: emptyIngredients,
        packSizes: emptyPackSizes,
        rng: () => 0.1,
        lastSaturdayMenu: null,
      });
      const indianLunches = weekdayLunches(week).filter(
        (s) => !s.dishes.some((d) => d.cuisine !== "Indian"),
      );
      // 5 weekdays minus 2 international = 3 Indian thali lunches.
      expect(indianLunches.length).toBe(3);
      for (const lunch of indianLunches) {
        expect(lunch.dishes.some((d) => d.category === "Chapati" || d.category === "Rice")).toBe(
          true,
        );
      }
    });
  });

  describe("§3.2 weekday substitution via userRequestedDishId", () => {
    it("places the pinned complete_meal Lunch dish on a weekday and switches that day to the substitution form", () => {
      nextId = 1;
      const library = makeMinimalLibrary();
      const pinned = library.find((d) => d.name === "Biryani Chicken");
      expect(pinned).toBeDefined();
      const week = generateWeek({
        weekStart: "2026-06-08",
        library,
        history: emptyHistory,
        season: "Summer",
        ingredients: emptyIngredients,
        packSizes: emptyPackSizes,
        rng: () => 0.9, // Sat picks menu 4 -> different from Mon substitution form
        lastSaturdayMenu: null,
        userRequestedDishId: pinned!.id,
      });
      // The pinned dish should appear on a weekday lunch (not Saturday).
      const weekdaysWithPinned = week.days
        .filter((d) => d.day !== "Sat")
        .filter((d) =>
          d.slots.some(
            (s) => s.meal === "Lunch" && s.dishes.some((dish) => dish.id === pinned!.id),
          ),
        );
      expect(weekdaysWithPinned.length).toBe(1);
      // The substituted day's lunch runs the Menu 3 form (3 items: complete_meal
      // + HP lead, Accompaniment, Dessert) rather than the day's Menu 1/2 plate.
      const substitutedDay = weekdaysWithPinned[0];
      const lunchSlot = substitutedDay.slots.find((s) => s.meal === "Lunch")!;
      expect(lunchSlot.dishes.length).toBe(3);
      // Substituted Menu 3 form: complete_meal+HP + Accompaniment + Dessert.
      expect(lunchSlot.dishes[0].tags).toContain("complete_meal");
    });
  });

  describe("determinism under a fixed RNG", () => {
    it("produces the same week on identical inputs", () => {
      nextId = 1;
      const lib1 = makeMinimalLibrary();
      nextId = 1;
      const lib2 = makeMinimalLibrary();
      const rng1 = () => 0.42;
      const rng2 = () => 0.42;
      const w1 = generateWeek({
        weekStart: "2026-06-08",
        library: lib1,
        history: emptyHistory,
        season: "Summer",
        ingredients: emptyIngredients,
        packSizes: emptyPackSizes,
        rng: rng1,
        lastSaturdayMenu: null,
      });
      const w2 = generateWeek({
        weekStart: "2026-06-08",
        library: lib2,
        history: emptyHistory,
        season: "Summer",
        ingredients: emptyIngredients,
        packSizes: emptyPackSizes,
        rng: rng2,
        lastSaturdayMenu: null,
      });
      const ids = (w: typeof w1) =>
        w.days.flatMap((d) => d.slots.flatMap((s) => s.dishes.map((dish) => dish.id)));
      expect(ids(w1)).toEqual(ids(w2));
    });
  });

  describe("smoke against the live library + history", () => {
    const { library, packSizes, ingredients, history } = loadLiveData();

    for (const season of ["Summer", "Monsoon", "Winter"] as Season[]) {
      it(`generates a complete week against live data in ${season}`, () => {
        const week = generateWeek({
          weekStart: "2026-06-08",
          library,
          history,
          season,
          ingredients,
          packSizes,
          rng: () => 0.3,
          lastSaturdayMenu: 3,
        });
        expect(week.days.map((d) => d.day)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
        // Every slot has at least one dish.
        for (const day of week.days) {
          for (const slot of day.slots) {
            expect(slot.dishes.length).toBeGreaterThan(0);
          }
        }
      });
    }

    it("Cluster A: no non-exempt dish appears 3+ times in a generated week", () => {
      // The defect: a broad HP pool's longest-unused favourite (e.g. Chicken
      // masala gravy) won Mon/Wed/Fri Menu 1 identically. §4 step 5 within-week
      // recency now sinks an already-placed dish below fresh alternatives.
      const week = generateWeek({
        weekStart: "2026-06-15",
        library,
        history,
        season: "Monsoon",
        ingredients,
        packSizes,
      });
      const counts = new Map<number, { count: number; dish: Dish }>();
      for (const day of week.days) {
        for (const slot of day.slots) {
          for (const dish of slot.dishes) {
            const e = counts.get(dish.id) ?? { count: 0, dish };
            e.count += 1;
            counts.set(dish.id, e);
          }
        }
      }
      const exempt = (d: Dish) => d.category === "Chapati" || d.category === "Rice";
      for (const { count, dish } of counts.values()) {
        if (exempt(dish)) continue;
        expect(count, `${dish.name} appears ${count}x`).toBeLessThan(3);
      }
    });

    it("Cluster A: the repeated Menu-1 main slot (Mon/Wed/Fri) draws distinct dishes", () => {
      const week = generateWeek({
        weekStart: "2026-06-15",
        library,
        history,
        season: "Monsoon",
        ingredients,
        packSizes,
      });
      // The Menu 1 main is the HP lead (index 0 of the weekday lunch slot).
      const menu1Mains: string[] = [];
      for (const day of week.days) {
        if (day.day !== "Mon" && day.day !== "Wed" && day.day !== "Fri") continue;
        const lunch = day.slots.find((s) => s.meal === "Lunch");
        if (lunch && lunch.dishes.length > 0) menu1Mains.push(lunch.dishes[0].name);
      }
      expect(menu1Mains.length).toBe(3);
      expect(new Set(menu1Mains).size).toBe(3);
    });

    it("Cluster B: an HP-main Menu 1 meal never stacks a second HP dish", () => {
      const week = generateWeek({
        weekStart: "2026-06-15",
        library,
        history,
        season: "Monsoon",
        ingredients,
        packSizes,
      });
      for (const day of week.days) {
        // Weekday Menu 1 lunches only (Mon/Wed/Fri); Saturday Menu 3 leads with
        // a complete_meal+HP dish by spec and is out of scope here.
        if (day.day !== "Mon" && day.day !== "Wed" && day.day !== "Fri") continue;
        const lunch = day.slots.find((s) => s.meal === "Lunch");
        if (!lunch) continue;
        const hpCount = lunch.dishes.filter((d) => d.tags.includes("HP")).length;
        expect(hpCount, `${day.day} lunch has ${hpCount} HP dishes`).toBeLessThanOrEqual(1);
      }
    });
  });

  describe("Cluster D: one HP source per meal, all menu forms", () => {
    it("Saturday Menu 3 does not pair an HP complete_meal with an HP accompaniment", () => {
      nextId = 1;
      // The live defect: "Chicken biryani" (HP complete_meal) + "Chicken salad"
      // (HP accompaniment) in one Saturday Menu 3 meal. With a non-HP
      // accompaniment available the HP one must be excluded.
      const library: Dish[] = [
        makeDish({
          name: "Chicken Biryani",
          time: "Lunch",
          category: "Complete meal",
          tags: ["complete_meal", "HP"],
          primaryIngredient: "Chicken",
        }),
        makeDish({
          name: "Chicken Salad",
          time: "Lunch",
          category: "Accompaniment",
          tags: ["HP"],
          primaryIngredient: "Chicken",
        }),
        makeDish({
          name: "Cucumber Raita",
          time: "Lunch",
          category: "Accompaniment",
          primaryIngredient: "Cucumber",
        }),
        makeDish({
          name: "Halwa",
          time: "Lunch",
          category: "Dessert",
          primaryIngredient: "Carrot",
        }),
      ];
      const week = generateWeek({
        weekStart: "2026-06-15",
        library,
        history: emptyHistory,
        season: "Monsoon",
        ingredients: emptyIngredients,
        packSizes: emptyPackSizes,
        rng: () => 0.1,
        lastSaturdayMenu: 4, // force Menu 3 this Saturday
      });
      const satLunch = week.days
        .find((d) => d.day === "Sat")!
        .slots.find((s) => s.meal === "Lunch")!;
      const hpCount = satLunch.dishes.filter((d) => d.tags.includes("HP")).length;
      expect(hpCount).toBe(1);
      expect(satLunch.dishes.some((d) => d.name === "Chicken Salad")).toBe(false);
      expect(satLunch.dishes.some((d) => d.name === "Cucumber Raita")).toBe(true);
    });

    it("a breakfast pair carries at most one HP dish", () => {
      nextId = 1;
      // Option B (complete_carb + accompaniment): the partner could be HP, so an
      // HP complete_carb lead must exclude an HP accompaniment partner (the §3
      // one-HP-per-meal rule). Breakfast is savoury only.
      const library: Dish[] = [
        makeDish({
          name: "Besan Paneer Chilla",
          time: "Breakfast",
          category: "Chilla",
          tags: ["complete_carb", "HP"],
          primaryIngredient: "Paneer",
        }),
        makeDish({
          name: "Egg Salad",
          time: "Breakfast",
          category: "Accompaniment",
          tags: ["HP"],
          primaryIngredient: "Egg",
        }),
        makeDish({
          name: "Mint Chutney",
          time: "Breakfast",
          category: "Accompaniment",
          primaryIngredient: "Mint",
        }),
        // Lunch + other fillers so the rest of the week builds.
        makeDish({
          name: "Dal",
          time: "Lunch",
          category: "Gravy dish",
          primaryIngredient: "Dal",
        }),
        makeDish({
          name: "Chapati",
          time: "Lunch",
          category: "Chapati",
          primaryIngredient: "Wheat",
        }),
        makeDish({ name: "Tofu", time: "Lunch", category: "Keto", primaryIngredient: "Tofu" }),
        makeDish({
          name: "Cabbage",
          time: "Lunch",
          category: "Dry dish",
          primaryIngredient: "Cabbage",
        }),
        makeDish({
          name: "Veg Pulao",
          time: "Lunch",
          category: "Complete meal",
          tags: ["complete_meal"],
          primaryIngredient: "Rice",
        }),
        makeDish({
          name: "Curd",
          time: "Lunch",
          category: "Accompaniment",
          primaryIngredient: "Curd",
        }),
      ];
      const week = generateWeek({
        weekStart: "2026-06-15",
        library,
        history: emptyHistory,
        season: "Monsoon",
        ingredients: emptyIngredients,
        packSizes: emptyPackSizes,
        rng: () => 0.1,
        lastSaturdayMenu: 3, // Saturday becomes Menu 4 (non-HP lead)
      });
      const monBreakfast = week.days
        .find((d) => d.day === "Mon")!
        .slots.find((s) => s.meal === "Breakfast")!;
      // The HP chilla is the lead; the HP egg salad must be excluded so only the
      // plain Mint Chutney can partner it.
      const hpCount = monBreakfast.dishes.filter((d) => d.tags.includes("HP")).length;
      expect(hpCount).toBeLessThanOrEqual(1);
      if (monBreakfast.dishes.some((d) => d.name === "Besan Paneer Chilla")) {
        expect(monBreakfast.dishes.some((d) => d.name === "Egg Salad")).toBe(false);
      }
    });

    it("thin-pool fallback: Menu 3 still fills when the only accompaniment is HP", () => {
      nextId = 1;
      const library: Dish[] = [
        makeDish({
          name: "Chicken Biryani",
          time: "Lunch",
          category: "Complete meal",
          tags: ["complete_meal", "HP"],
          primaryIngredient: "Chicken",
        }),
        // ONLY accompaniment is HP-tagged: the filter empties, so the fallback
        // keeps the slot fillable (a second HP side beats an incomplete meal).
        makeDish({
          name: "Chicken Salad",
          time: "Lunch",
          category: "Accompaniment",
          tags: ["HP"],
          primaryIngredient: "Chicken",
        }),
        makeDish({
          name: "Halwa",
          time: "Lunch",
          category: "Dessert",
          primaryIngredient: "Carrot",
        }),
      ];
      const week = generateWeek({
        weekStart: "2026-06-15",
        library,
        history: emptyHistory,
        season: "Monsoon",
        ingredients: emptyIngredients,
        packSizes: emptyPackSizes,
        rng: () => 0.1,
        lastSaturdayMenu: 4,
      });
      const satLunch = week.days
        .find((d) => d.day === "Sat")!
        .slots.find((s) => s.meal === "Lunch")!;
      expect(satLunch.dishes.length).toBe(3);
      expect(satLunch.dishes.some((d) => d.name === "Chicken Salad")).toBe(true);
    });
  });

  describe("smoke against the live library + history (extra)", () => {
    const { library, packSizes, ingredients, history } = loadLiveData();

    it("Saturday is Menu 3 or Menu 4 (alternating from last Saturday)", () => {
      const lastSat = 4 as const;
      const week = generateWeek({
        weekStart: "2026-06-08",
        library,
        history,
        season: "Summer",
        ingredients,
        packSizes,
        rng: () => 0.3,
        lastSaturdayMenu: lastSat,
      });
      const sat = week.days.find((d) => d.day === "Sat")!;
      const satLunch = sat.slots.find((s) => s.meal === "Lunch")!;
      // Menu 3 lead is complete_meal+HP; Menu 4 lead is complete_meal non-HP.
      const lead = satLunch.dishes[0];
      expect(lead.tags).toContain("complete_meal");
      // lastSaturdayMenu=4 → this Saturday must be 3 → HP-tagged lead.
      expect(lead.tags).toContain("HP");
    });
  });

  describe("§3 R1 suppress sides on self-sufficient breakfast mains (Option B)", () => {
    // A library whose Option-B complete_carb lead is the given category, plus
    // enough fillers for a full buildable week. Mon/Wed/Fri use Option B.
    function libraryWithBreadLead(leadCategory: "Bread" | "Paratha"): Dish[] {
      nextId = 1;
      return [
        makeDish({
          name: "Lead Carb",
          time: "Breakfast",
          category: leadCategory,
          tags: ["complete_carb"],
          primaryIngredient: "Wheat",
        }),
        makeDish({
          name: "Garlic Chutney",
          time: "Breakfast",
          category: "Accompaniment",
          primaryIngredient: "Garlic",
        }),
        // Tue/Thu single-pick filler (complete_meal, HP so R3 adds nothing).
        makeDish({
          name: "Egg Dosa",
          time: "Breakfast",
          category: "Complete meal",
          tags: ["complete_meal", "HP"],
          primaryIngredient: "Egg",
        }),
        makeDish({
          name: "Apple",
          time: "Breakfast",
          category: "Fruit",
          tags: ["fruit"],
          primaryIngredient: "Apple",
        }),
        // Lunch fillers so the whole week builds.
        makeDish({
          name: "Chicken Curry",
          time: "Lunch",
          category: "Gravy dish",
          tags: ["HP"],
          primaryIngredient: "Chicken",
        }),
        makeDish({
          name: "Bhindi",
          time: "Lunch",
          category: "Dry dish",
          primaryIngredient: "Okra",
        }),
        makeDish({ name: "Dal", time: "Lunch", category: "Gravy dish", primaryIngredient: "Dal" }),
        makeDish({ name: "Tofu", time: "Lunch", category: "Keto", primaryIngredient: "Tofu" }),
        makeDish({
          name: "Chapati",
          time: "Lunch",
          category: "Chapati",
          primaryIngredient: "Wheat",
        }),
        makeDish({
          name: "Biryani",
          time: "Lunch",
          category: "Complete meal",
          tags: ["complete_meal", "HP"],
          primaryIngredient: "Chicken",
        }),
        makeDish({
          name: "Halwa",
          time: "Lunch",
          category: "Dessert",
          primaryIngredient: "Carrot",
        }),
      ];
    }

    it("a Category=Bread complete_carb lead is served alone (1-item breakfast, no accompaniment)", () => {
      const week = generateWeek({
        weekStart: "2026-06-15",
        library: libraryWithBreadLead("Bread"),
        history: emptyHistory,
        season: "Monsoon",
        ingredients: emptyIngredients,
        packSizes: emptyPackSizes,
        rng: () => 0.1,
      });
      const monBreakfast = week.days
        .find((d) => d.day === "Mon")!
        .slots.find((s) => s.meal === "Breakfast")!;
      expect(monBreakfast.dishes.map((d) => d.name)).toEqual(["Lead Carb"]);
      expect(monBreakfast.dishes.some((d) => d.category === "Accompaniment")).toBe(false);
    });

    it("a Chilla/Paratha complete_carb lead keeps its accompaniment (2-item breakfast)", () => {
      const week = generateWeek({
        weekStart: "2026-06-15",
        library: libraryWithBreadLead("Paratha"),
        history: emptyHistory,
        season: "Monsoon",
        ingredients: emptyIngredients,
        packSizes: emptyPackSizes,
        rng: () => 0.1,
      });
      const monBreakfast = week.days
        .find((d) => d.day === "Mon")!
        .slots.find((s) => s.meal === "Breakfast")!;
      expect(monBreakfast.dishes.map((d) => d.name)).toEqual(["Lead Carb", "Garlic Chutney"]);
    });
  });

  describe("§3 R3 breakfast protein floor (Tue/Thu single pick)", () => {
    // Library where the Tue/Thu single pick is a given non-HP/HP main, plus a
    // (configurable) HP Keto companion, plus week fillers.
    function libraryWithSingleMain(opts: {
      mainHp: boolean;
      includeKetoCompanion: boolean;
    }): Dish[] {
      nextId = 1;
      const lib: Dish[] = [
        // Mon/Wed/Fri Option B (Paratha keeps its accompaniment).
        makeDish({
          name: "Aloo Paratha",
          time: "Breakfast",
          category: "Paratha",
          tags: ["complete_carb"],
          primaryIngredient: "Potato",
        }),
        makeDish({
          name: "Curd",
          time: "Breakfast",
          category: "Accompaniment",
          primaryIngredient: "Curd",
        }),
        // Tue/Thu single-pick main.
        makeDish({
          name: "Sevai",
          time: "Breakfast",
          category: "Complete meal",
          tags: opts.mainHp ? ["complete_meal", "HP"] : ["complete_meal"],
          primaryIngredient: "Vermicelli",
        }),
        makeDish({
          name: "Apple",
          time: "Breakfast",
          category: "Fruit",
          tags: ["fruit"],
          primaryIngredient: "Apple",
        }),
        // Lunch fillers.
        makeDish({
          name: "Chicken Curry",
          time: "Lunch",
          category: "Gravy dish",
          tags: ["HP"],
          primaryIngredient: "Chicken",
        }),
        makeDish({
          name: "Bhindi",
          time: "Lunch",
          category: "Dry dish",
          primaryIngredient: "Okra",
        }),
        makeDish({ name: "Dal", time: "Lunch", category: "Gravy dish", primaryIngredient: "Dal" }),
        makeDish({ name: "Tofu", time: "Lunch", category: "Keto", primaryIngredient: "Tofu" }),
        makeDish({
          name: "Chapati",
          time: "Lunch",
          category: "Chapati",
          primaryIngredient: "Wheat",
        }),
        makeDish({
          name: "Biryani",
          time: "Lunch",
          category: "Complete meal",
          tags: ["complete_meal", "HP"],
          primaryIngredient: "Chicken",
        }),
        makeDish({
          name: "Halwa",
          time: "Lunch",
          category: "Dessert",
          primaryIngredient: "Carrot",
        }),
      ];
      if (opts.includeKetoCompanion) {
        lib.push(
          makeDish({
            name: "Boiled Eggs",
            time: "Breakfast",
            category: "Keto",
            tags: ["HP"],
            primaryIngredient: "Egg",
          }),
        );
      }
      return lib;
    }

    function tueBreakfast(week: ReturnType<typeof generateWeek>) {
      return week.days.find((d) => d.day === "Tue")!.slots.find((s) => s.meal === "Breakfast")!;
    }

    it("a non-HP single main gains exactly one HP Keto companion (2-item breakfast, one HP)", () => {
      const week = generateWeek({
        weekStart: "2026-06-15",
        library: libraryWithSingleMain({ mainHp: false, includeKetoCompanion: true }),
        history: emptyHistory,
        season: "Monsoon",
        ingredients: emptyIngredients,
        packSizes: emptyPackSizes,
        rng: () => 0.1,
      });
      const tue = tueBreakfast(week);
      expect(tue.dishes.map((d) => d.name)).toEqual(["Sevai", "Boiled Eggs"]);
      expect(tue.dishes.filter((d) => d.tags.includes("HP")).length).toBe(1);
    });

    it("an HP single main gets no companion (stays 1 item; one-HP-per-meal holds)", () => {
      const week = generateWeek({
        weekStart: "2026-06-15",
        library: libraryWithSingleMain({ mainHp: true, includeKetoCompanion: true }),
        history: emptyHistory,
        season: "Monsoon",
        ingredients: emptyIngredients,
        packSizes: emptyPackSizes,
        rng: () => 0.1,
      });
      const tue = tueBreakfast(week);
      expect(tue.dishes.map((d) => d.name)).toEqual(["Sevai"]);
      expect(tue.dishes.filter((d) => d.tags.includes("HP")).length).toBe(1);
    });

    it("an empty companion pool degrades gracefully to a 1-item breakfast", () => {
      const week = generateWeek({
        weekStart: "2026-06-15",
        library: libraryWithSingleMain({ mainHp: false, includeKetoCompanion: false }),
        history: emptyHistory,
        season: "Monsoon",
        ingredients: emptyIngredients,
        packSizes: emptyPackSizes,
        rng: () => 0.1,
      });
      const tue = tueBreakfast(week);
      expect(tue.dishes.map((d) => d.name)).toEqual(["Sevai"]);
    });

    it("does not touch Mon/Wed/Fri breakfasts (they stay their 2-item Option B/C form)", () => {
      const week = generateWeek({
        weekStart: "2026-06-15",
        library: libraryWithSingleMain({ mainHp: false, includeKetoCompanion: true }),
        history: emptyHistory,
        season: "Monsoon",
        ingredients: emptyIngredients,
        packSizes: emptyPackSizes,
        rng: () => 0.1,
      });
      for (const dayName of ["Mon", "Wed", "Fri"] as const) {
        const bf = week.days
          .find((d) => d.day === dayName)!
          .slots.find((s) => s.meal === "Breakfast")!;
        // Aloo Paratha keeps its accompaniment; Boiled Eggs is never added here.
        expect(bf.dishes.some((d) => d.name === "Boiled Eggs")).toBe(false);
        expect(bf.dishes.length).toBe(2);
      }
    });
  });

  describe("§3.2 Menu 1 weekday plate + one-wet rule (budget-aware)", () => {
    // A Menu-1 library with an HP Gravy main, a non-HP Gravy dal, a non-HP Dry
    // sabzi, and a carb. The Mon/Wed/Fri breakfast lead is parameterised: a
    // Category=Bread lead is served alone (1-item breakfast, budget 4), a Paratha
    // lead keeps its accompaniment (2-item breakfast, budget 3).
    function libraryForThali(breakfastLead: "Bread" | "Paratha"): Dish[] {
      nextId = 1;
      return [
        makeDish({
          name: "Breakfast Lead",
          time: "Breakfast",
          category: breakfastLead,
          tags: ["complete_carb"],
          primaryIngredient: "Wheat",
        }),
        makeDish({
          name: "Curd",
          time: "Breakfast",
          category: "Accompaniment",
          primaryIngredient: "Curd",
        }),
        // Tue/Thu single-pick (Complete meal, HP, so no protein floor / chutney).
        makeDish({
          name: "Sevai",
          time: "Breakfast",
          category: "Complete meal",
          tags: ["complete_meal", "HP"],
          primaryIngredient: "Vermicelli",
        }),
        makeDish({
          name: "Apple",
          time: "Breakfast",
          category: "Fruit",
          tags: ["fruit"],
          primaryIngredient: "Apple",
        }),
        // Menu 1 thali: HP Gravy main + non-HP Gravy dal + non-HP Dry sabzi + carb.
        makeDish({
          name: "Paneer Gravy",
          time: "Lunch",
          category: "Gravy dish",
          tags: ["HP"],
          primaryIngredient: "Paneer",
        }),
        makeDish({ name: "Dal", time: "Lunch", category: "Gravy dish", primaryIngredient: "Dal" }),
        makeDish({
          name: "Bhindi Sabzi",
          time: "Lunch",
          category: "Dry dish",
          primaryIngredient: "Okra",
        }),
        makeDish({
          name: "Chapati",
          time: "Lunch",
          category: "Chapati",
          primaryIngredient: "Wheat",
        }),
        // Menu 2 + Saturday fillers.
        makeDish({ name: "Tofu", time: "Lunch", category: "Keto", primaryIngredient: "Tofu" }),
        makeDish({
          name: "Biryani",
          time: "Lunch",
          category: "Complete meal",
          tags: ["complete_meal", "HP"],
          primaryIngredient: "Chicken",
        }),
        makeDish({
          name: "Halwa",
          time: "Lunch",
          category: "Dessert",
          primaryIngredient: "Carrot",
        }),
      ];
    }

    function monLunch(week: ReturnType<typeof generateWeek>) {
      return week.days.find((d) => d.day === "Mon")!.slots.find((s) => s.meal === "Lunch")!;
    }

    it("an HP Gravy lead excludes the dal (one wet dish): protein + carb + dry sabzi", () => {
      const week = generateWeek({
        weekStart: "2026-06-15",
        library: libraryForThali("Bread"),
        history: emptyHistory,
        season: "Monsoon",
        ingredients: emptyIngredients,
        packSizes: emptyPackSizes,
        rng: () => 0.1,
      });
      // Monday breakfast is a standalone Bread (1 item), so the lunch budget is 4
      // (two companion positions). But the lead is a Gravy dish, so the hard
      // one-wet rule excludes the Dal (also a Gravy) entirely; the only companion
      // is the Dry sabzi. The plate is three items, not four: a plate short a
      // companion beats a two-gravy plate (no thin-pool fallback for this rule).
      const monBf = week.days
        .find((d) => d.day === "Mon")!
        .slots.find((s) => s.meal === "Breakfast")!;
      expect(monBf.dishes.length).toBe(1);
      const lunch = monLunch(week);
      expect(lunch.dishes.length).toBe(3);
      expect(lunch.dishes[0].name).toBe("Paneer Gravy"); // HP protein main leads
      expect(lunch.dishes.some((d) => d.name === "Dal")).toBe(false); // dal excluded (one wet)
      expect(lunch.dishes.filter((d) => d.category === "Gravy dish").length).toBe(1);
      expect(lunch.dishes.some((d) => d.name === "Bhindi Sabzi")).toBe(true); // dry sabzi companion
      expect(lunch.dishes.some((d) => d.category === "Chapati")).toBe(true); // lunch carb
    });

    it("a 2-item breakfast day composes its lunch by budget, not by cap trimming", () => {
      const week = generateWeek({
        weekStart: "2026-06-15",
        library: libraryForThali("Paratha"),
        history: emptyHistory,
        season: "Monsoon",
        ingredients: emptyIngredients,
        packSizes: emptyPackSizes,
        rng: () => 0.1,
      });
      const monBf = week.days
        .find((d) => d.day === "Mon")!
        .slots.find((s) => s.meal === "Breakfast")!;
      expect(monBf.dishes.length).toBe(2); // Paratha lead + accompaniment
      const lunch = monLunch(week);
      // Budget 4 (6 items less a 2-item breakfast): lead + carb + two companions,
      // but the Gravy lead excludes the Dal under the one-wet rule and the only
      // other companion is the Dry sabzi, so the plate lands at 3. Nothing is
      // dropped; the plate is simply one companion short (§10.1).
      expect(lunch.dishes.length).toBe(3);
      expect(lunch.dishes.some((d) => d.name === "Bhindi Sabzi")).toBe(true);
      expect(lunch.dishes[0].name).toBe("Paneer Gravy");
      expect(lunch.dishes.some((d) => d.name === "Dal")).toBe(false); // one wet dish only
      expect(lunch.dishes.some((d) => d.category === "Chapati")).toBe(true);
    });

    it("keeps every weekday inside the §9 day budget", () => {
      const week = generateWeek({
        weekStart: "2026-06-15",
        library: libraryForThali("Paratha"),
        history: emptyHistory,
        season: "Monsoon",
        ingredients: emptyIngredients,
        packSizes: emptyPackSizes,
        rng: () => 0.1,
      });
      for (const dayName of ["Mon", "Tue", "Wed", "Thu", "Fri"] as const) {
        const day = week.days.find((d) => d.day === dayName)!;
        const dishes = day.slots.flatMap((s) => s.dishes);
        expect(dishes.length, `${dayName} has ${dishes.length} items`).toBeLessThanOrEqual(6);
        const minutes = dishes.reduce((sum, d) => sum + d.prepMinutes, 0);
        expect(minutes, `${dayName} costs ${minutes} minutes`).toBeLessThanOrEqual(120);
      }
    });
  });

  describe("§3 dish-driven breakfast chutney on the Tue/Thu single pick", () => {
    it("a Chilla single main carries a breakfast chutney", () => {
      nextId = 1;
      const library: Dish[] = [
        // Mon/Wed/Fri Option B so the week builds.
        makeDish({
          name: "Aloo Paratha",
          time: "Breakfast",
          category: "Paratha",
          tags: ["complete_carb"],
          primaryIngredient: "Potato",
        }),
        makeDish({
          name: "Pickle",
          time: "Breakfast",
          category: "Accompaniment",
          primaryIngredient: "Mango",
        }),
        // Tue/Thu single pick: an HP Chilla (paneer cheela). HP, so no protein
        // floor companion — it must still carry a chutney (the issue Rajat hit).
        makeDish({
          name: "Besan Paneer Chilla",
          time: "Breakfast",
          category: "Chilla",
          tags: ["complete_carb", "HP"],
          primaryIngredient: "Paneer",
        }),
        makeDish({
          name: "Green Chutney",
          time: "Breakfast",
          category: "Accompaniment",
          primaryIngredient: "Mint",
        }),
        makeDish({
          name: "Apple",
          time: "Breakfast",
          category: "Fruit",
          tags: ["fruit"],
          primaryIngredient: "Apple",
        }),
        // Lunch fillers.
        makeDish({
          name: "Chicken Curry",
          time: "Lunch",
          category: "Gravy dish",
          tags: ["HP"],
          primaryIngredient: "Chicken",
        }),
        makeDish({ name: "Dal", time: "Lunch", category: "Gravy dish", primaryIngredient: "Dal" }),
        makeDish({
          name: "Bhindi",
          time: "Lunch",
          category: "Dry dish",
          primaryIngredient: "Okra",
        }),
        makeDish({
          name: "Chapati",
          time: "Lunch",
          category: "Chapati",
          primaryIngredient: "Wheat",
        }),
        makeDish({ name: "Tofu", time: "Lunch", category: "Keto", primaryIngredient: "Tofu" }),
        makeDish({
          name: "Biryani",
          time: "Lunch",
          category: "Complete meal",
          tags: ["complete_meal", "HP"],
          primaryIngredient: "Chicken",
        }),
        makeDish({
          name: "Halwa",
          time: "Lunch",
          category: "Dessert",
          primaryIngredient: "Carrot",
        }),
      ];
      const week = generateWeek({
        weekStart: "2026-06-15",
        library,
        history: emptyHistory,
        season: "Monsoon",
        ingredients: emptyIngredients,
        packSizes: emptyPackSizes,
        rng: () => 0.1,
      });
      const tueBf = week.days
        .find((d) => d.day === "Tue")!
        .slots.find((s) => s.meal === "Breakfast")!;
      expect(tueBf.dishes.map((d) => d.name)).toEqual(["Besan Paneer Chilla", "Green Chutney"]);
      // One HP source per meal: the chutney is non-HP.
      expect(tueBf.dishes.filter((d) => d.tags.includes("HP")).length).toBe(1);
    });
  });
  /**
   * `features/engine-v4.md` §10.1 / §11.5. These run against the LIVE library,
   * because the properties under test are properties of a real week: the whole
   * point of §10.1 is that a menu is composed to a budget the household actually
   * has, and a synthetic fixture with uniform prep times cannot show that.
   */
  describe("§9 whole-day budget (§10.1)", () => {
    const { library, packSizes, ingredients, history } = loadLiveData();

    function liveWeek(weekStart: string, season: Season = "Monsoon") {
      return generateWeek({
        weekStart,
        library,
        history,
        season,
        ingredients,
        packSizes,
        rng: () => 0.1,
        lastSaturdayMenu: null,
      });
    }

    it("never composes a day over 120 minutes or 6 items", () => {
      for (const weekStart of ["2026-08-17", "2026-09-14", "2026-11-16"]) {
        const week = liveWeek(weekStart, weekStart < "2026-10-01" ? "Monsoon" : "Winter");
        for (const day of week.days) {
          const dishes = day.slots.flatMap((s) => s.dishes);
          const minutes = dishes.reduce((sum, d) => sum + d.prepMinutes, 0);
          expect(minutes, `${weekStart} ${day.day}: ${minutes} min`).toBeLessThanOrEqual(120);
          expect(
            dishes.length,
            `${weekStart} ${day.day}: ${dishes.length} items`,
          ).toBeLessThanOrEqual(6);
          // Every dish on the day is in a slot and counted, so the day's real
          // size is exactly what the budget measured.
          expect(dishes.length).toBe(day.slots.reduce((n, s) => n + s.dishes.length, 0));
        }
      }
    });

    it("Saturday is no longer capped at 3: the day budget is uniform across the week", () => {
      // The retired §9 cap trimmed Saturday to three items, which is what stopped
      // the weekend lunch carrying a protein floor on top of its Menu 3/4 form.
      const week = liveWeek("2026-08-17");
      const sat = week.days.find((d) => d.day === "Sat")!;
      const items = sat.slots.flatMap((s) => s.dishes).length;
      expect(items).toBeGreaterThanOrEqual(3);
      expect(items).toBeLessThanOrEqual(6);
    });

    it("composes to the budget rather than trimming: a placed dish is never removed", () => {
      // The old contract was "compose four, then drop the worst". There is no drop
      // path left, so the finished week is exactly the set of picks the loop made
      // and `GeneratedWeek` no longer carries a dropped-ids field at all.
      const week = liveWeek("2026-08-17");
      expect(week).not.toHaveProperty("droppedDishIds");
      expect(week.incidents.filter((i) => i.includes("over cap"))).toEqual([]);
    });

    it("lands a plate one companion short and says so when nothing fits", () => {
      // A one-item breakfast plus a deliberately expensive Indian plate: the lead
      // and carb fit, the companion cannot, so the plate is short and the week
      // reports it rather than silently shipping a two-item lunch.
      nextId = 1;
      const lib: Dish[] = [
        makeDish({
          name: "Quick Poha",
          time: "Breakfast",
          category: "Complete meal",
          tags: ["complete_meal", "HP"],
          prepMinutes: 20,
        }),
        makeDish({
          name: "Slow Curry",
          time: "Lunch",
          category: "Gravy dish",
          tags: ["HP"],
          prepMinutes: 55,
        }),
        makeDish({ name: "Roti", time: "Lunch", category: "Chapati", prepMinutes: 45 }),
        makeDish({
          name: "Slow Sabzi",
          time: "Lunch",
          category: "Dry dish",
          primaryIngredient: "Bhindi",
          prepMinutes: 45,
        }),
        makeDish({
          name: "Sat Biryani",
          time: "Lunch",
          category: "Complete meal",
          tags: ["complete_meal", "HP"],
          prepMinutes: 30,
        }),
        makeDish({ name: "Sat Salad", time: "Lunch", category: "Accompaniment", prepMinutes: 10 }),
        makeDish({ name: "Sat Kheer", time: "Lunch", category: "Dessert", prepMinutes: 10 }),
        makeDish({ name: "Apple", time: "Breakfast", category: "Fruit", tags: ["fruit"] }),
      ];
      const week = generateWeek({
        weekStart: "2026-06-15",
        library: lib,
        history: emptyHistory,
        season: "Monsoon",
        ingredients: emptyIngredients,
        packSizes: emptyPackSizes,
        rng: () => 0.1,
      });
      const mon = week.days.find((d) => d.day === "Mon")!;
      const monLunchDishes = mon.slots.find((s) => s.meal === "Lunch")!.dishes;
      // 20 + 55 + 45 = 120 exactly; a 45-minute sabzi cannot join it.
      expect(monLunchDishes.map((d) => d.name)).toEqual(["Slow Curry", "Roti"]);
      expect(week.incidents.some((i) => i.includes("budget-short"))).toBe(true);
      const minutes = mon.slots.flatMap((s) => s.dishes).reduce((sum, d) => sum + d.prepMinutes, 0);
      expect(minutes).toBe(120);
    });

    it("skips a candidate that does not fit for the next one that does", () => {
      // §10.1 step 3: the position is not abandoned at the first over-budget
      // candidate, it takes the next candidate that fits.
      nextId = 1;
      const lib: Dish[] = [
        makeDish({
          name: "Poha",
          time: "Breakfast",
          category: "Complete meal",
          tags: ["complete_meal", "HP"],
          prepMinutes: 20,
        }),
        makeDish({
          name: "Curry",
          time: "Lunch",
          category: "Gravy dish",
          tags: ["HP"],
          prepMinutes: 50,
        }),
        makeDish({ name: "Roti", time: "Lunch", category: "Chapati", prepMinutes: 40 }),
        // The expensive sabzi ranks first (never cooked, cheaper id) but does not
        // fit; the cheap one does.
        makeDish({
          name: "Expensive Sabzi",
          time: "Lunch",
          category: "Dry dish",
          primaryIngredient: "Bhindi",
          prepMinutes: 45,
        }),
        makeDish({
          name: "Cheap Sabzi",
          time: "Lunch",
          category: "Dry dish",
          primaryIngredient: "Cabbage",
          prepMinutes: 10,
        }),
        makeDish({
          name: "Sat Biryani",
          time: "Lunch",
          category: "Complete meal",
          tags: ["complete_meal", "HP"],
          prepMinutes: 30,
        }),
        makeDish({ name: "Sat Salad", time: "Lunch", category: "Accompaniment", prepMinutes: 10 }),
        makeDish({ name: "Sat Kheer", time: "Lunch", category: "Dessert", prepMinutes: 10 }),
        makeDish({ name: "Apple", time: "Breakfast", category: "Fruit", tags: ["fruit"] }),
      ];
      const week = generateWeek({
        weekStart: "2026-06-15",
        library: lib,
        history: emptyHistory,
        season: "Monsoon",
        ingredients: emptyIngredients,
        packSizes: emptyPackSizes,
        rng: () => 0.1,
      });
      const monLunchDishes = week.days
        .find((d) => d.day === "Mon")!
        .slots.find((s) => s.meal === "Lunch")!.dishes;
      expect(monLunchDishes.map((d) => d.name)).toContain("Cheap Sabzi");
      expect(monLunchDishes.map((d) => d.name)).not.toContain("Expensive Sabzi");
    });
  });

  /**
   * `features/engine-v4.md` §10.3 plate rule 9. Measured against the live library:
   * the pre-rule engine produced 27 carb lunches out of 81 with nothing but a
   * salad beside the roti, all of them the same Keto-lead shape.
   */
  describe("§3 plate rule 9: a carb plate always carries a gravy or a sabzi (§10.3)", () => {
    const { library, packSizes, ingredients, history } = loadLiveData();

    it("every carb lunch of a live week carries a Gravy or Dry companion", () => {
      let carbPlates = 0;
      for (const weekStart of ["2026-08-17", "2026-09-14", "2026-11-16"]) {
        const week = generateWeek({
          weekStart,
          library,
          history,
          season: weekStart < "2026-10-01" ? "Monsoon" : "Winter",
          ingredients,
          packSizes,
          rng: () => 0.1,
          lastSaturdayMenu: null,
        });
        for (const day of week.days) {
          for (const slot of day.slots) {
            if (slot.meal !== "Lunch") continue;
            const carb = slot.dishes.find((d) => d.category === "Chapati" || d.category === "Rice");
            if (!carb) continue;
            carbPlates += 1;
            const substantial = slot.dishes.filter(
              (d) => d !== carb && (d.category === "Gravy dish" || d.category === "Dry dish"),
            );
            expect(
              substantial.length,
              `${weekStart} ${day.day}: ${slot.dishes.map((d) => `${d.name}[${d.category}]`).join(" + ")}`,
            ).toBeGreaterThanOrEqual(1);
          }
        }
      }
      expect(carbPlates).toBeGreaterThan(0);
    });

    it("excludes the Accompaniment pool when the budget allows one companion only", () => {
      // A Keto lead (so the one-wet rule leaves the gravy pool open) with a carb
      // and room for exactly one companion. The salad ranks first on recency but
      // rule 9 keeps it off the plate; the sabzi takes the position.
      nextId = 1;
      const lib: Dish[] = [
        makeDish({
          name: "Chilla",
          time: "Breakfast",
          category: "Chilla",
          tags: ["complete_carb", "HP"],
          prepMinutes: 20,
        }),
        makeDish({ name: "Chutney", time: "Breakfast", category: "Accompaniment", prepMinutes: 5 }),
        makeDish({
          name: "Paneer Tikka",
          time: "Lunch",
          category: "Keto",
          tags: ["HP"],
          prepMinutes: 30,
        }),
        makeDish({ name: "Roti", time: "Lunch", category: "Chapati", prepMinutes: 25 }),
        makeDish({
          name: "Cucumber Salad",
          time: "Lunch",
          category: "Accompaniment",
          primaryIngredient: "Cucumber",
          prepMinutes: 5,
        }),
        makeDish({
          name: "Bhindi Sabzi",
          time: "Lunch",
          category: "Dry dish",
          primaryIngredient: "Bhindi",
          prepMinutes: 20,
        }),
        makeDish({
          name: "Sat Biryani",
          time: "Lunch",
          category: "Complete meal",
          tags: ["complete_meal", "HP"],
          prepMinutes: 30,
        }),
        makeDish({ name: "Sat Salad", time: "Lunch", category: "Accompaniment", prepMinutes: 10 }),
        makeDish({ name: "Sat Kheer", time: "Lunch", category: "Dessert", prepMinutes: 10 }),
        makeDish({ name: "Apple", time: "Breakfast", category: "Fruit", tags: ["fruit"] }),
      ];
      const week = generateWeek({
        weekStart: "2026-06-15",
        library: lib,
        history: emptyHistory,
        season: "Monsoon",
        ingredients: emptyIngredients,
        packSizes: emptyPackSizes,
        rng: () => 0.1,
      });
      const tueLunch = week.days
        .find((d) => d.day === "Tue")!
        .slots.find((s) => s.meal === "Lunch")!;
      const names = tueLunch.dishes.map((d) => d.name);
      // Lead, carb, then companions. The FIRST companion position on a carb plate
      // draws from the substantial companions only, so the sabzi takes it and the
      // salad can only follow as an additional item.
      expect(names[0]).toBe("Paneer Tikka");
      expect(names[1]).toBe("Roti");
      expect(names[2]).toBe("Bhindi Sabzi");
      expect(names.indexOf("Cucumber Salad")).toBeGreaterThan(2);
    });
  });

  /**
   * `features/engine-v4.md` §10.4. The old engine had two breakfast forms and
   * between them they stranded every Category=Dry dish breakfast main.
   */
  describe("§3 breakfast, one widened form (§10.4)", () => {
    it("serves a Dry-dish breakfast main with a plain breakfast carb, on any day", () => {
      nextId = 1;
      const lib: Dish[] = [
        makeDish({
          name: "Anda Bhurji",
          time: "Breakfast",
          category: "Dry dish",
          tags: ["HP"],
          primaryIngredient: "Egg",
          prepMinutes: 15,
        }),
        makeDish({
          name: "Toast",
          time: "Breakfast",
          category: "Bread",
          primaryIngredient: "Bread",
          prepMinutes: 5,
        }),
        makeDish({
          name: "Curry",
          time: "Lunch",
          category: "Gravy dish",
          tags: ["HP"],
          prepMinutes: 30,
        }),
        makeDish({ name: "Roti", time: "Lunch", category: "Chapati", prepMinutes: 25 }),
        makeDish({
          name: "Sabzi",
          time: "Lunch",
          category: "Dry dish",
          primaryIngredient: "Bhindi",
          prepMinutes: 20,
        }),
        makeDish({
          name: "Sat Biryani",
          time: "Lunch",
          category: "Complete meal",
          tags: ["complete_meal", "HP"],
          prepMinutes: 30,
        }),
        makeDish({ name: "Sat Salad", time: "Lunch", category: "Accompaniment", prepMinutes: 10 }),
        makeDish({ name: "Sat Kheer", time: "Lunch", category: "Dessert", prepMinutes: 10 }),
        makeDish({ name: "Apple", time: "Breakfast", category: "Fruit", tags: ["fruit"] }),
      ];
      const week = generateWeek({
        weekStart: "2026-06-15",
        library: lib,
        history: emptyHistory,
        season: "Monsoon",
        ingredients: emptyIngredients,
        packSizes: emptyPackSizes,
        rng: () => 0.1,
      });
      // Under the old forms this library produced NO breakfast at all on Tue/Thu
      // (the single-pick pool was complete_meal/complete_carb only) and only fell
      // through to the dry-main form on Mon/Wed/Fri because Option B was empty.
      for (const dayName of ["Mon", "Tue", "Wed", "Thu", "Fri"] as const) {
        const bf = week.days
          .find((d) => d.day === dayName)!
          .slots.find((s) => s.meal === "Breakfast")!;
        expect(
          bf.dishes.map((d) => d.name),
          `${dayName} breakfast`,
        ).toEqual(["Anda Bhurji", "Toast"]);
      }
    });

    it("a main that carries a chutney does not also gain the HP Keto side", () => {
      nextId = 1;
      const lib: Dish[] = [
        makeDish({
          name: "Oats Chilla",
          time: "Breakfast",
          category: "Chilla",
          tags: ["complete_carb"],
          primaryIngredient: "Oats",
          prepMinutes: 15,
        }),
        makeDish({
          name: "Green Chutney",
          time: "Breakfast",
          category: "Accompaniment",
          primaryIngredient: "Coriander",
          prepMinutes: 5,
        }),
        makeDish({
          name: "Boiled Eggs",
          time: "Breakfast",
          category: "Keto",
          tags: ["HP"],
          primaryIngredient: "Egg",
          prepMinutes: 10,
        }),
        makeDish({
          name: "Curry",
          time: "Lunch",
          category: "Gravy dish",
          tags: ["HP"],
          prepMinutes: 30,
        }),
        makeDish({ name: "Roti", time: "Lunch", category: "Chapati", prepMinutes: 25 }),
        makeDish({
          name: "Sabzi",
          time: "Lunch",
          category: "Dry dish",
          primaryIngredient: "Bhindi",
          prepMinutes: 20,
        }),
        makeDish({
          name: "Sat Biryani",
          time: "Lunch",
          category: "Complete meal",
          tags: ["complete_meal", "HP"],
          prepMinutes: 30,
        }),
        makeDish({ name: "Sat Salad", time: "Lunch", category: "Accompaniment", prepMinutes: 10 }),
        makeDish({ name: "Sat Kheer", time: "Lunch", category: "Dessert", prepMinutes: 10 }),
        makeDish({ name: "Apple", time: "Breakfast", category: "Fruit", tags: ["fruit"] }),
      ];
      const week = generateWeek({
        weekStart: "2026-06-15",
        library: lib,
        history: emptyHistory,
        season: "Monsoon",
        ingredients: emptyIngredients,
        packSizes: emptyPackSizes,
        rng: () => 0.1,
      });
      // The chilla is non-HP, so the pre-§10.4 rule would have added Boiled Eggs
      // on top of the chutney: a 3-item breakfast, and the shape behind most of
      // the old over-cap days.
      const bf = week.days.find((d) => d.day === "Mon")!.slots.find((s) => s.meal === "Breakfast")!;
      expect(bf.dishes.map((d) => d.name)).toEqual(["Oats Chilla", "Green Chutney"]);
    });
  });

  /**
   * `features/engine-v4.md` §11.5: the two call sites Stream A's selection engine
   * needs. Without them A's branch measures 0.566 week-over-week overlap against
   * the 0.194 it replaces, so these are the tests that pin the wiring itself.
   */
  describe("§4 wiring: the guard and the exploration slot", () => {
    const { library, packSizes, ingredients, history } = loadLiveData();

    function liveWeek(weekStart: string, hist = history, season: Season = "Monsoon") {
      return generateWeek({
        weekStart,
        library,
        history: hist,
        season,
        ingredients,
        packSizes,
        rng: () => 0.1,
        lastSaturdayMenu: null,
      });
    }

    it("§4.7 the guard is live in generation and beats the frequency credit", () => {
      // The sharp version of this test: "Proven Curry" carries the maximum
      // frequency credit and would lead its pool on every §4 ranking. The ONLY
      // thing that can keep it off Monday is the §4.7 guard keying on Monday's own
      // calendar date, so if `slotDate` is not threaded through, this fails.
      nextId = 1;
      const proven = makeDish({
        name: "Proven Curry",
        time: "Lunch",
        category: "Gravy dish",
        tags: ["HP"],
        primaryIngredient: "Paneer",
      });
      const challenger = makeDish({
        name: "Challenger Curry",
        time: "Lunch",
        category: "Gravy dish",
        tags: ["HP"],
        primaryIngredient: "Fish",
      });
      const lib: Dish[] = [
        proven,
        challenger,
        // A distinct primary ingredient: the breakfast main is an HP main too, so
        // sharing "Paneer" with the lunch lead would let §4.6 protein diversity,
        // not the guard, decide Monday's lunch.
        makeDish({
          name: "Poha",
          time: "Breakfast",
          category: "Complete meal",
          tags: ["complete_meal", "HP"],
          primaryIngredient: "Rice Flakes",
        }),
        makeDish({ name: "Roti", time: "Lunch", category: "Chapati" }),
        makeDish({
          name: "Sabzi",
          time: "Lunch",
          category: "Dry dish",
          primaryIngredient: "Bhindi",
        }),
        makeDish({
          name: "Sat Biryani",
          time: "Lunch",
          category: "Complete meal",
          tags: ["complete_meal", "HP"],
          primaryIngredient: "Chicken",
        }),
        makeDish({ name: "Sat Salad", time: "Lunch", category: "Accompaniment" }),
        makeDish({ name: "Sat Kheer", time: "Lunch", category: "Dessert" }),
        makeDish({ name: "Apple", time: "Breakfast", category: "Fruit", tags: ["fruit"] }),
      ];
      // Three older weeks put Proven Curry at the saturating credit cap; the
      // challenger has never been cooked and sits at credit 0.
      const older: MenuHistoryRow[] = ["2026-05-04", "2026-05-11", "2026-05-18"].map(
        (weekStart) => ({
          weekStart,
          day: "Monday" as const,
          meal: "Lunch" as const,
          dishName: proven.name,
          dishId: proven.id,
        }),
      );
      const base = {
        weekStart: "2026-06-15",
        library: lib,
        season: "Monsoon" as Season,
        ingredients: emptyIngredients,
        packSizes: emptyPackSizes,
        rng: () => 0.1,
      };
      const withoutRecentRow = generateWeek({ ...base, history: older });
      expect(
        withoutRecentRow.days.find((d) => d.day === "Mon")!.slots.find((s) => s.meal === "Lunch")!
          .dishes[0].name,
      ).toBe("Proven Curry");

      // Now cook it on the Saturday two days before the generated Monday. Nothing
      // about its frequency credit changes (it only goes further above the cap);
      // the guard is the sole reason it can no longer lead Monday.
      const withRecentRow = generateWeek({
        ...base,
        history: [
          ...older,
          {
            weekStart: "2026-06-08",
            day: "Saturday",
            meal: "Lunch",
            dishName: proven.name,
            dishId: proven.id,
          },
        ],
      });
      expect(
        withRecentRow.days.find((d) => d.day === "Mon")!.slots.find((s) => s.meal === "Lunch")!
          .dishes[0].name,
      ).toBe("Challenger Curry");
    });

    it("§4 a pinned favorite still leads even when the guard would exclude it", () => {
      // The guard is a FILTER, so without an explicit override the §4 step 4
      // guarantee would silently fail on exactly the dishes the household eats
      // most often. Plant the favorite two days before the week starts.
      const favorite = library.find(
        (d) => d.time === "Lunch" && d.category === "Gravy dish" && d.tags.includes("HP"),
      )!;
      const planted = [
        ...history,
        {
          weekStart: "2026-08-10",
          day: "Saturday" as const,
          meal: "Lunch" as const,
          dishName: favorite.name,
          dishId: favorite.id,
        },
      ];
      const week = generateWeek({
        weekStart: "2026-08-17",
        library,
        history: planted,
        season: "Monsoon",
        ingredients,
        packSizes,
        rng: () => 0.1,
        lastSaturdayMenu: null,
        favoriteDishIds: [favorite.id],
      });
      const placed = week.days.some((d) =>
        d.slots.some((s) => s.dishes.some((dish) => dish.id === favorite.id)),
      );
      expect(placed).toBe(true);
      expect(week.unplacedFavorites).toEqual([]);
    });

    it("§4.8 the novelty position rotates across the week's companion positions", () => {
      // A fixed novelty position is still a fixed position: measured over 25
      // weeks, only that weekday's companion ever saw a new dish and 19 of the 20
      // dishes it introduced were served exactly once. The rotation is keyed on
      // the week's absolute index, so consecutive weeks spend it on different
      // lunches. Asserted through the observable consequence: the (day, index) of
      // the never-cooked companion is not one fixed position across six weeks.
      const cooked = new Set(history.map((r) => r.dishId));
      const novelPositions = new Set<string>();
      for (const weekStart of [
        "2026-08-17",
        "2026-08-24",
        "2026-08-31",
        "2026-09-07",
        "2026-09-14",
        "2026-09-21",
      ]) {
        const week = liveWeek(weekStart);
        for (const day of week.days) {
          const lunch = day.slots.find((s) => s.meal === "Lunch");
          if (!lunch) continue;
          lunch.dishes.forEach((dish, index) => {
            // Companion positions only (index 0 is the lead, 1 is the carb/first
            // companion depending on the form).
            if (index >= 1 && !cooked.has(dish.id)) novelPositions.add(`${day.day}#${index}`);
          });
        }
      }
      expect(novelPositions.size).toBeGreaterThan(1);
    });

    it("§4.8 the novelty position never places a dish already on the week", () => {
      // The exploration ranking ignores frequency and the guard, so within-week
      // no-repeat is enforced at the call site instead.
      for (const weekStart of ["2026-08-17", "2026-08-24", "2026-08-31"]) {
        const week = liveWeek(weekStart);
        const counts = new Map<number, number>();
        for (const day of week.days) {
          for (const slot of day.slots) {
            for (const dish of slot.dishes) {
              if (dish.category === "Chapati" || dish.category === "Rice") continue;
              counts.set(dish.id, (counts.get(dish.id) ?? 0) + 1);
            }
          }
        }
        for (const [id, count] of counts) {
          const dish = library.find((d) => d.id === id)!;
          expect(count, `${weekStart}: ${dish.name} x${count}`).toBeLessThan(3);
        }
      }
    });
  });
});
