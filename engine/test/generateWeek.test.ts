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

    it("§9 role-aware cap drops only companion sides (dry sabzi), never the carb or protein main", () => {
      // Mon/Wed/Fri have a 2-item breakfast and a 4-item thali (6 items, one over
      // the 5-item cap), so the role-aware cap trims one droppable side per such
      // day. It must drop the dry sabzi (a companion side), never the lunch carb
      // or the protein main, even though the carb is the lowest-satiety item.
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
      // Every dropped dish is a companion side (a Dry-dish sabzi here), not a
      // carb (Chapati/Rice) and not an HP protein main.
      for (const id of week.droppedDishIds) {
        const dish = library.find((d) => d.id === id)!;
        expect(["Chapati", "Rice"]).not.toContain(dish.category);
        expect(dish.tags.includes("HP")).toBe(false);
      }
      // Every Menu-1 weekday lunch still carries its lunch carb and its HP main.
      for (const dayName of ["Mon", "Wed", "Fri"] as const) {
        const lunch = week.days
          .find((d) => d.day === dayName)!
          .slots.find((s) => s.meal === "Lunch")!;
        expect(lunch.dishes.some((d) => d.category === "Chapati" || d.category === "Rice")).toBe(
          true,
        );
        expect(lunch.dishes.some((d) => d.tags.includes("HP"))).toBe(true);
        // Trimmed to 3 lunch items (main + dal + carb) on a full-breakfast day.
        expect(lunch.dishes.length).toBe(3);
      }
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

  describe("§3 Menu 1 4-item thali + §9 role-aware cap (emergent day budget)", () => {
    // A Menu-1 library with an HP Gravy main, a non-HP Gravy dal, a non-HP Dry
    // sabzi, and a carb. The Mon/Wed/Fri breakfast lead is parameterised: a
    // Category=Bread lead is served alone (1-item breakfast), a Paratha lead
    // keeps its accompaniment (2-item breakfast).
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

    it("a light (1-item) breakfast day keeps the full 4-item thali: protein + dal + dry sabzi + carb", () => {
      const week = generateWeek({
        weekStart: "2026-06-15",
        library: libraryForThali("Bread"),
        history: emptyHistory,
        season: "Monsoon",
        ingredients: emptyIngredients,
        packSizes: emptyPackSizes,
        rng: () => 0.1,
      });
      // Monday breakfast is a standalone Bread (1 item), so the 4-item thali fits
      // under the 5-item cap and survives whole.
      const monBf = week.days
        .find((d) => d.day === "Mon")!
        .slots.find((s) => s.meal === "Breakfast")!;
      expect(monBf.dishes.length).toBe(1);
      const lunch = monLunch(week);
      expect(lunch.dishes.length).toBe(4);
      expect(lunch.dishes[0].name).toBe("Paneer Gravy"); // HP protein main leads
      expect(lunch.dishes.some((d) => d.name === "Dal")).toBe(true); // non-HP Gravy dal
      expect(lunch.dishes.some((d) => d.name === "Bhindi Sabzi")).toBe(true); // non-HP Dry sabzi
      expect(lunch.dishes.some((d) => d.category === "Chapati")).toBe(true); // lunch carb
    });

    it("a full (2-item) breakfast day: the cap drops the dry sabzi, leaving protein + dal + carb (3 items)", () => {
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
      // 2 breakfast + 4 thali = 6 over the 5-item cap → drop the dry sabzi.
      expect(lunch.dishes.length).toBe(3);
      expect(lunch.dishes.some((d) => d.name === "Bhindi Sabzi")).toBe(false); // sabzi dropped
      expect(lunch.dishes[0].name).toBe("Paneer Gravy"); // protein main protected
      expect(lunch.dishes.some((d) => d.name === "Dal")).toBe(true); // dal protected
      expect(lunch.dishes.some((d) => d.category === "Chapati")).toBe(true); // carb protected
    });

    it("keeps every weekday at the §9 5-item cap", () => {
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
        const items = day.slots.reduce((sum, s) => sum + s.dishes.length, 0);
        expect(items, `${dayName} has ${items} items`).toBeLessThanOrEqual(5);
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
});
