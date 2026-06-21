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
    // Fruit of the day pool (§3.3): Category=Fruit, outside breakfast/lunch.
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

    it("§3.3 puts a Fruit of the day on every day Mon-Sat, Saturday included", () => {
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
        expect(day.fruit, `${day.day} fruit`).toBeDefined();
        expect(day.fruit!.category).toBe("Fruit");
      }
    });

    it("§9 fruit is outside the cap: a Fruit dish never appears in a meal slot", () => {
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

    it("§3.3 picks the longest-unused fruit first when history favours one", () => {
      // Apple cooked recently, Banana never: the longest-unused pick leads Banana.
      const recentHistory: MenuHistoryRow[] = [
        { weekStart: "2026-06-01", day: "Monday", meal: "Breakfast", dishName: "Apple", dishId: 2 },
      ];
      const lib = makeMinimalLibrary();
      const apple = lib.find((d) => d.name === "Apple")!;
      const history: MenuHistoryRow[] = [{ ...recentHistory[0], dishId: apple.id }];
      const week = generateWeek({
        weekStart: "2026-06-08",
        library: lib,
        history,
        season: "Summer",
        ingredients: emptyIngredients,
        packSizes: emptyPackSizes,
        rng: () => 0.1,
        lastSaturdayMenu: null,
      });
      // Monday gets the longest-unused fruit, which is not the recently-cooked Apple.
      expect(week.days[0].fruit!.name).not.toBe("Apple");
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

  describe("§3 R4 Menu 1 Gravy-branch thin-pool fallback chain", () => {
    it("falls back through to the HP Accompaniment last resort rather than leaving the meal incomplete", () => {
      nextId = 1;
      // A library whose Gravy HP main has NO non-HP Dry sabzi and whose ONLY
      // Accompaniment is HP-tagged. The R4 Dry-sabzi pool and the non-HP
      // Accompaniment fallback are both empty, so pickMenu1 must use the
      // unfiltered Accompaniment last resort so Menu 1 still fills three items.
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
        // Menu 1: HP Gravy main, NO non-HP Dry sabzi, ONLY an HP-tagged
        // Accompaniment partner (so both R4 fallbacks before the last resort are
        // empty).
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
        makeDish({
          name: "Chapati",
          time: "Lunch",
          category: "Chapati",
          primaryIngredient: "Wheat",
        }),
        // Menu 2 fillers so other weekdays build (no Dry dish, so Menu 1's
        // R4 Dry-sabzi pool stays empty; Menu 2 simply runs without its Dry).
        makeDish({ name: "Tofu", time: "Lunch", category: "Keto", primaryIngredient: "Tofu" }),
        makeDish({ name: "Dal", time: "Lunch", category: "Gravy dish", primaryIngredient: "Dal" }),
        // Saturday fillers.
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
      const monLunch = week.days
        .find((d) => d.day === "Mon")!
        .slots.find((s) => s.meal === "Lunch")!;
      // The fallback fills the partner slot: Menu 1 still has 3 items including
      // the HP Accompaniment (one-HP-per-meal yields to slot-completeness).
      expect(monLunch.dishes.length).toBe(3);
      expect(monLunch.dishes.some((d) => d.name === "Chicken Salad")).toBe(true);
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
      // one-HP-per-meal rule). Breakfast is savoury only; fruit is the standalone
      // Fruit of the day (§3.3), never a breakfast partner.
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

  describe("§3 R4 Menu 1 thali partner complements the main's form", () => {
    // Library exposing both a Gravy HP main and a Dry HP main across the three
    // Menu-1 weekdays, with a non-HP Gravy, a non-HP Dry sabzi, and a salad.
    function libraryForR4(): Dish[] {
      nextId = 1;
      return [
        // Breakfasts.
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
        // Menu 1 mains: one HP Gravy, one HP Dry.
        makeDish({
          name: "Paneer Gravy",
          time: "Lunch",
          category: "Gravy dish",
          tags: ["HP"],
          primaryIngredient: "Paneer",
        }),
        makeDish({
          name: "Chicken Dry",
          time: "Lunch",
          category: "Dry dish",
          tags: ["HP"],
          primaryIngredient: "Chicken",
        }),
        // Non-HP partners: a Gravy dal, a Dry sabzi, and a salad.
        makeDish({ name: "Dal", time: "Lunch", category: "Gravy dish", primaryIngredient: "Dal" }),
        makeDish({
          name: "Bhindi Sabzi",
          time: "Lunch",
          category: "Dry dish",
          primaryIngredient: "Okra",
        }),
        makeDish({
          name: "Onion Salad",
          time: "Lunch",
          category: "Accompaniment",
          primaryIngredient: "Onion",
        }),
        // Lunch carbs + Menu 2 + Saturday fillers.
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
    }

    function menu1Lunches(week: ReturnType<typeof generateWeek>) {
      return (["Mon", "Wed", "Fri"] as const)
        .map((dayName) =>
          week.days.find((d) => d.day === dayName)!.slots.find((s) => s.meal === "Lunch"),
        )
        .filter((s): s is NonNullable<typeof s> => Boolean(s));
    }

    it("a Gravy HP main pairs a non-HP Dry sabzi (not a salad); a Dry HP main pairs a non-HP Gravy", () => {
      const week = generateWeek({
        weekStart: "2026-06-15",
        library: libraryForR4(),
        history: emptyHistory,
        season: "Monsoon",
        ingredients: emptyIngredients,
        packSizes: emptyPackSizes,
        rng: () => 0.1,
      });
      const lunches = menu1Lunches(week);
      expect(lunches.length).toBeGreaterThan(0);
      for (const lunch of lunches) {
        const main = lunch.dishes[0];
        const partner = lunch.dishes[1];
        expect(main.tags).toContain("HP");
        // The partner is always non-HP (one HP source per meal).
        expect(partner.tags.includes("HP")).toBe(false);
        if (main.category === "Gravy dish") {
          // R4: a gravy main pairs a Dry sabzi, never an Accompaniment salad.
          expect(partner.category).toBe("Dry dish");
        } else if (main.category === "Dry dish") {
          // Unchanged: a dry main pairs a non-HP Gravy (a dal).
          expect(partner.category).toBe("Gravy dish");
        }
        // Menu 1 stays exactly 3 items: main + partner + lunch carb.
        expect(lunch.dishes.length).toBe(3);
      }
    });

    it("keeps every weekday lunch within the §9 5-item cap (R4 is cap-neutral)", () => {
      const week = generateWeek({
        weekStart: "2026-06-15",
        library: libraryForR4(),
        history: emptyHistory,
        season: "Monsoon",
        ingredients: emptyIngredients,
        packSizes: emptyPackSizes,
        rng: () => 0.1,
      });
      for (const dayName of ["Mon", "Tue", "Wed", "Thu", "Fri"] as const) {
        const day = week.days.find((d) => d.day === dayName)!;
        const items = day.slots.reduce((sum, s) => sum + s.dishes.length, 0);
        expect(items, `${dayName} has ${items} items`).toBeLessThanOrEqual(5);
      }
    });

    it("falls back to an Accompaniment when the non-HP Dry-sabzi pool is empty", () => {
      // Drop every non-HP Dry sabzi: a Gravy main must fall back to the salad.
      const lib = libraryForR4().filter(
        (d) => d.name !== "Bhindi Sabzi" && d.name !== "Chicken Dry",
      );
      const week = generateWeek({
        weekStart: "2026-06-15",
        library: lib,
        history: emptyHistory,
        season: "Monsoon",
        ingredients: emptyIngredients,
        packSizes: emptyPackSizes,
        rng: () => 0.1,
      });
      const lunches = menu1Lunches(week);
      for (const lunch of lunches) {
        const main = lunch.dishes[0];
        const partner = lunch.dishes[1];
        expect(main.category).toBe("Gravy dish");
        // No Dry sabzi available → fall back to the non-HP Accompaniment salad.
        expect(partner.category).toBe("Accompaniment");
        expect(partner.tags.includes("HP")).toBe(false);
        expect(lunch.dishes.length).toBe(3);
      }
    });
  });
});
