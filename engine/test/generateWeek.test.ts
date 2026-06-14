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
    prepMinutes: 30,
    seasons: "All",
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
    // Breakfast Option A: complete_meal + fruit (Mon/Wed/Fri pair)
    makeDish({
      name: "Idli Sambar",
      time: "Breakfast",
      category: "Complete meal",
      tags: ["complete_meal"],
      primaryIngredient: "Idli batter",
    }),
    makeDish({
      name: "Apple",
      time: "Breakfast",
      category: "Fruit",
      tags: ["fruit"],
      primaryIngredient: "Apple",
    }),
    makeDish({
      name: "Poha",
      time: "Breakfast",
      category: "Complete meal",
      tags: ["complete_meal"],
      primaryIngredient: "Poha",
    }),
    makeDish({
      name: "Banana",
      time: "Breakfast",
      category: "Fruit",
      tags: ["fruit"],
      primaryIngredient: "Banana",
    }),
    makeDish({
      name: "Upma",
      time: "Breakfast",
      category: "Complete meal",
      tags: ["complete_meal"],
      primaryIngredient: "Semolina",
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

    it("returns 5 items on each weekday (2 breakfast + 3/4 lunch) and 3 on Saturday", () => {
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
      // Mon/Wed/Fri: 2 breakfast + 3 lunch = 5
      // Tue/Thu: 1 breakfast + 4 lunch = 5
      // Sat: 3
      expect(dishesPerDay).toEqual([5, 5, 5, 5, 5, 3]);
    });

    it("emits no incidents and no dropped dish ids under the identity cap stub", () => {
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
      expect(week.droppedDishIds).toEqual([]);
      expect(week.incidents).toEqual([]);
    });

    it("respects §3.1 Rice-at-most-once across the week", () => {
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
      const lunchCarbs: Dish[] = [];
      for (const day of week.days) {
        for (const slot of day.slots) {
          if (slot.meal !== "Lunch") continue;
          for (const dish of slot.dishes) {
            if (dish.category === "Rice") lunchCarbs.push(dish);
          }
        }
      }
      expect(lunchCarbs.length).toBeLessThanOrEqual(1);
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
      // The substituted day's lunch should have 3 items (Menu 3 or 4 form),
      // not 3 (Menu 1) or 4 (Menu 2). For an HP-tagged lead it's Menu 3 form.
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
      const exempt = (d: Dish) =>
        d.tags.includes("fruit") || d.category === "Chapati" || d.category === "Rice";
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

  describe("Cluster B: HP-main partner fallback when the non-HP Accompaniment pool is thin", () => {
    it("falls back to an HP Accompaniment rather than leaving the meal incomplete", () => {
      nextId = 1;
      // A library whose ONLY Accompaniment is HP-tagged. The non-HP partner pool
      // is empty, so pickMenu1 must fall back so Menu 1 still fills three items.
      const library: Dish[] = [
        // Breakfast so the week is buildable (Mon/Wed/Fri pair + Tue/Thu single).
        makeDish({
          name: "Idli",
          time: "Breakfast",
          category: "Complete meal",
          tags: ["complete_meal"],
          primaryIngredient: "Idli batter",
        }),
        makeDish({
          name: "Apple",
          time: "Breakfast",
          category: "Fruit",
          tags: ["fruit"],
          primaryIngredient: "Apple",
        }),
        makeDish({
          name: "Dosa",
          time: "Breakfast",
          category: "Complete meal",
          tags: ["complete_meal"],
          primaryIngredient: "Dosa batter",
        }),
        // Menu 1: HP Gravy main + ONLY an HP-tagged Accompaniment partner.
        makeDish({
          name: "Chicken Curry",
          time: "Lunch",
          category: "Gravy dish",
          tags: ["HP"],
          primaryIngredient: "Chicken",
        }),
        makeDish({
          name: "Chicken Salad",
          time: "Lunch",
          category: "Accompaniment",
          tags: ["HP"],
          primaryIngredient: "Chicken",
        }),
        makeDish({ name: "Chapati", time: "Lunch", category: "Chapati", primaryIngredient: "Wheat" }),
        // Menu 2 fillers so other weekdays build.
        makeDish({ name: "Tofu", time: "Lunch", category: "Keto", primaryIngredient: "Tofu" }),
        makeDish({ name: "Dal", time: "Lunch", category: "Gravy dish", primaryIngredient: "Dal" }),
        makeDish({ name: "Cabbage", time: "Lunch", category: "Dry dish", primaryIngredient: "Cabbage" }),
        // Saturday fillers.
        makeDish({
          name: "Biryani",
          time: "Lunch",
          category: "Complete meal",
          tags: ["complete_meal", "HP"],
          primaryIngredient: "Chicken",
        }),
        makeDish({ name: "Halwa", time: "Lunch", category: "Dessert", primaryIngredient: "Carrot" }),
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
      const monLunch = week.days.find((d) => d.day === "Mon")!.slots.find((s) => s.meal === "Lunch")!;
      // The fallback fills the partner slot: Menu 1 still has 3 items including
      // the HP Accompaniment (one-HP-per-meal yields to slot-completeness).
      expect(monLunch.dishes.length).toBe(3);
      expect(monLunch.dishes.some((d) => d.name === "Chicken Salad")).toBe(true);
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
});
