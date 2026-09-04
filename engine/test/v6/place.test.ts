import { describe, it, expect } from "vitest";
import type { Dish } from "../../src/data/schemas.js";
import {
  assignDays,
  constraintPass,
  type Plate,
  type PoolEntry,
  type PoolProvider,
} from "../../src/v6/place.js";
import type {
  Day,
  DishOccupation,
  DishStats,
  MealKey,
  PickOrigin,
  PickRole,
  PlanPick,
  RecordStats,
  Scope,
} from "../../src/v6/types.js";

/**
 * `features/engine-v6.md` §6 steps 5 and 6.
 *
 * Step 5 assigns every plate the eligible weekday whose most recent occupation
 * by its lead dish is oldest, in priority order (pinned favorites, then stars by
 * deficit descending, then everything else, and the exploration pick LAST,
 * because assigning a never-eaten pick early sent it and its carb to Monday in
 * ten weeks of ten).
 *
 * Step 6 then enforces, in order, the two §4 anchors, one gravy per lunch,
 * cross-meal protein family and ingredient demotion, rice on consecutive days,
 * the day-scoped protein floor, the item ceilings, and the 120-minute prep
 * ceiling. Every repair is deterministic and is RETURNED rather than applied to
 * a ledger: the caller refunds each `replaced` dish and charges each
 * `replacement`.
 */

function makeDish(overrides: Partial<Dish> & { id: number }): Dish {
  return {
    name: `Dish ${overrides.id}`,
    category: "Gravy dish",
    time: "Lunch",
    tags: [],
    primaryIngredient: "Paneer",
    preferred: "No",
    active: "Yes",
    satiety: "Medium",
    prepMinutes: 20,
    seasons: "All",
    cuisine: "Indian",
    ...overrides,
  };
}

function pick(
  dish: Dish,
  role: PickRole,
  meal: MealKey = "lunch",
  origin: PickOrigin = "deficit",
  scope: Scope = meal === "breakfast" ? "weekdayBreakfast" : "weekdayLunch",
): Omit<PlanPick, "day"> {
  return { meal, dishId: dish.id, role, scope, origin };
}

function plate(
  meal: MealKey,
  day: Day | null,
  picks: Array<Omit<PlanPick, "day">>,
  extras: { scope?: Scope; deficit?: number } = {},
): Plate {
  return {
    meal,
    scope: extras.scope ?? (meal === "breakfast" ? "weekdayBreakfast" : "weekdayLunch"),
    day,
    picks,
    ...(extras.deficit === undefined ? {} : { deficit: extras.deficit }),
  };
}

function statsWith(occupations: Record<number, Record<string, DishOccupation>>): RecordStats {
  const perDish = new Map<number, DishStats>();
  for (const [dishId, slots] of Object.entries(occupations)) {
    const entry: DishStats = {
      eatenCount: { weekdayBreakfast: 0, weekdayLunch: 1, saturday: 0, fruit: 0 },
      rate: { weekdayBreakfast: 0, weekdayLunch: 0.2, saturday: 0, fruit: 0 },
      lastEatenWeek: "2026-06-15",
      occupations: new Map(Object.entries(slots)),
      seasonCount: {},
    };
    perDish.set(Number(dishId), entry);
  }
  return {
    weeks: 8,
    occasions: { weekdayBreakfast: 40, weekdayLunch: 40, saturday: 8, fruit: 48 },
    seasonDayOccasions: {},
    perDish,
    swappedOut: [],
  };
}

/** Occupation memory on every weekday EXCEPT `free`, so `free` is the dish's oldest slot. */
function occupiedExcept(free: Day, meal: MealKey): Record<string, DishOccupation> {
  const slots: Record<string, DishOccupation> = {};
  for (const day of ["Mon", "Tue", "Wed", "Thu", "Fri"] as Day[]) {
    if (day === free) continue;
    slots[`${day}:${meal}`] = { lastWeek: "2026-08-24", count: 3 };
  }
  return slots;
}

/** A stub of stream B's ranked pools: dishes in rank order, minus the excluded ids. */
function providerOf(pools: Partial<Record<PickRole, Dish[]>>): PoolProvider {
  return (role, _scope, exclude): PoolEntry[] =>
    (pools[role] ?? [])
      .filter((dish) => !exclude.has(dish.id))
      .map((dish, index) => ({ dish, deficit: 1 - index * 0.1, rate: 0.2 }));
}

const dayOf = (plates: Plate[], dishId: number): Day | null =>
  plates.find((entry) => entry.picks.some((entry2) => entry2.dishId === dishId))?.day ?? null;

describe("§6 step 5 assigns the least-recently-used weekday", () => {
  it("sends a dish to the weekday its own occupation memory left oldest", () => {
    const dish = makeDish({ id: 1 });
    const stats = statsWith({
      1: {
        "Mon:lunch": { lastWeek: "2026-08-24", count: 4 },
        "Tue:lunch": { lastWeek: "2026-06-15", count: 1 },
        "Wed:lunch": { lastWeek: "2026-08-17", count: 2 },
        "Thu:lunch": { lastWeek: "2026-08-10", count: 2 },
        "Fri:lunch": { lastWeek: "2026-07-06", count: 2 },
      },
    });
    const assigned = assignDays([plate("lunch", null, [pick(dish, "star")])], stats);
    expect(assigned[0].day).toBe("Tue");
  });

  it("counts a never-occupied weekday as infinitely old and breaks its ties Monday-first", () => {
    const dish = makeDish({ id: 1 });
    const stats = statsWith({
      1: {
        "Mon:lunch": { lastWeek: "2026-06-15", count: 1 },
        "Tue:lunch": { lastWeek: "2026-06-15", count: 1 },
      },
    });
    // Wed, Thu, and Fri are never-occupied, so the oldest occupied Monday loses.
    const assigned = assignDays([plate("lunch", null, [pick(dish, "star")])], stats);
    expect(assigned[0].day).toBe("Wed");
  });

  it("breaks a same-week tie by fewest occupations of that slot", () => {
    const dish = makeDish({ id: 1 });
    const stats = statsWith({
      1: {
        "Mon:lunch": { lastWeek: "2026-08-24", count: 5 },
        "Tue:lunch": { lastWeek: "2026-08-24", count: 2 },
        "Wed:lunch": { lastWeek: "2026-08-24", count: 9 },
        "Thu:lunch": { lastWeek: "2026-08-24", count: 3 },
        "Fri:lunch": { lastWeek: "2026-08-24", count: 4 },
      },
    });
    const assigned = assignDays([plate("lunch", null, [pick(dish, "star")])], stats);
    expect(assigned[0].day).toBe("Tue");
  });

  it("holds a plate that already carries its day, and takes that day out of supply", () => {
    const anchored = makeDish({ id: 1, time: "Breakfast", primaryIngredient: "Egg" });
    const other = makeDish({ id: 2, time: "Breakfast" });
    const stats = statsWith({});
    const assigned = assignDays(
      [
        plate("breakfast", "Thu", [pick(anchored, "breakfast-main", "breakfast", "structural")]),
        plate("breakfast", null, [pick(other, "breakfast-main", "breakfast")]),
      ],
      stats,
    );
    expect(assigned[0].day).toBe("Thu");
    expect(assigned[1].day).toBe("Mon");
  });
});

describe("§6 step 5 assigns the exploration pick last", () => {
  // Four repertoire stars, each with occupation memory that leaves exactly one
  // weekday free, and a never-eaten exploration pick with no memory at all.
  const stars = [1, 2, 3, 4].map((id) => makeDish({ id }));
  const novel = makeDish({ id: 9, name: "Prawn ghee roast", primaryIngredient: "Prawn" });
  const stats = statsWith({
    1: occupiedExcept("Mon", "lunch"),
    2: occupiedExcept("Tue", "lunch"),
    3: occupiedExcept("Wed", "lunch"),
    4: occupiedExcept("Thu", "lunch"),
  });

  function week(novelOrigin: PickOrigin): Plate[] {
    return [
      ...stars.map((dish, index) =>
        plate("lunch", null, [pick(dish, "star")], { deficit: 0.9 - index * 0.1 }),
      ),
      // A deficit HIGHER than every repertoire star's, so only the priority band
      // can keep this pick last. Ordering by deficit alone would send it first.
      plate("lunch", null, [pick(novel, "star", "lunch", novelOrigin)], { deficit: 0.95 }),
    ];
  }

  it("does not default a never-occupied dish to Monday when it is assigned last", () => {
    const assigned = assignDays(week("exploration"), stats);
    expect(dayOf(assigned, 9)).toBe("Fri");
    expect(dayOf(assigned, 1)).toBe("Mon");
    expect(dayOf(assigned, 4)).toBe("Thu");
  });

  it("would have sent that same dish to Monday if it were assigned first", () => {
    // The contrast the §6 step 5 amendment was written against: a pick with no
    // occupation memory takes the Monday-first tiebreak whenever it goes early.
    const assigned = assignDays(week("favorite"), stats);
    expect(dayOf(assigned, 9)).toBe("Mon");
  });

  it("is input-order independent: the same plates in any order get the same days", () => {
    const forward = assignDays(week("exploration"), stats);
    const reversed = assignDays(week("exploration").reverse(), stats);
    for (const dishId of [1, 2, 3, 4, 9]) {
      expect(dayOf(reversed, dishId)).toBe(dayOf(forward, dishId));
    }
  });

  it("never mutates the plates it was given", () => {
    const plates = week("exploration");
    assignDays(plates, stats);
    expect(plates.every((entry) => entry.day === null)).toBe(true);
  });
});

describe("§6 step 6 the two §4 anchors", () => {
  const grainMain = makeDish({ id: 1, time: "Breakfast", primaryIngredient: "Semolina" });
  const boiledEggs = makeDish({
    id: 2,
    time: "Breakfast",
    category: "Keto",
    primaryIngredient: "Egg",
    tags: ["HP"],
  });
  const eggMain = makeDish({
    id: 3,
    time: "Breakfast",
    category: "Dry dish",
    primaryIngredient: "Egg",
    tags: ["HP"],
  });
  const stats = statsWith({});

  it("rides boiled eggs along beside a Thursday grain main", () => {
    const result = constraintPass(
      [plate("breakfast", "Thu", [pick(grainMain, "breakfast-main", "breakfast")])],
      {
        provider: providerOf({ "breakfast-small": [boiledEggs], "breakfast-main": [eggMain] }),
        library: [grainMain, boiledEggs, eggMain],
        stats,
      },
    );
    expect(result.plates[0].picks.map((entry) => entry.dishId)).toEqual([1, 2]);
    expect(result.repairs[0]).toMatchObject({
      day: "Thu",
      meal: "breakfast",
      reason: "anchor",
      replaced: null,
    });
    expect(result.repairs[0].replacement?.dishId).toBe(2);
  });

  it("replaces the Thursday main when no egg small item is available", () => {
    const chutney = makeDish({ id: 4, time: "Breakfast", category: "Accompaniment" });
    const result = constraintPass(
      [
        plate("breakfast", "Thu", [
          pick(grainMain, "breakfast-main", "breakfast"),
          pick(chutney, "breakfast-small", "breakfast"),
        ]),
      ],
      {
        provider: providerOf({ "breakfast-main": [eggMain] }),
        library: [grainMain, chutney, eggMain],
        stats,
      },
    );
    expect(result.plates[0].picks[0].dishId).toBe(3);
    expect(result.repairs[0].replaced?.dishId).toBe(1);
    expect(result.repairs[0].replacement?.dishId).toBe(3);
  });

  it("leaves an already egg-anchored Thursday alone", () => {
    const result = constraintPass(
      [plate("breakfast", "Thu", [pick(eggMain, "breakfast-main", "breakfast")])],
      { provider: providerOf({}), library: [eggMain], stats },
    );
    expect(result.repairs).toEqual([]);
    expect(result.unrepairable).toEqual([]);
  });

  it("reports an unrepairable Thursday when the pools hold no egg at all", () => {
    const result = constraintPass(
      [plate("breakfast", "Thu", [pick(grainMain, "breakfast-main", "breakfast")])],
      { provider: providerOf({}), library: [grainMain], stats },
    );
    expect(result.unrepairable).toEqual(["anchor:Thu:breakfast"]);
  });

  it("puts a treat back on a Saturday lunch that lost its treat lead", () => {
    const weekdayStar = makeDish({ id: 10 });
    const treat = makeDish({ id: 11, name: "Chole bhature", category: "Complete meal" });
    const result = constraintPass(
      [
        plate("lunch", "Sat", [pick(weekdayStar, "star", "lunch", "deficit", "saturday")], {
          scope: "saturday",
        }),
      ],
      { provider: providerOf({ treat: [treat] }), library: [weekdayStar, treat], stats },
    );
    expect(result.plates[0].picks[0]).toMatchObject({ dishId: 11, role: "treat" });
    expect(result.repairs[0]).toMatchObject({ day: "Sat", reason: "anchor" });
    expect(result.repairs[0].replaced?.dishId).toBe(10);
  });
});

describe("§6 step 6 one gravy per lunch, hard", () => {
  const stats = statsWith({});
  const gravyA = makeDish({ id: 1, tags: ["HP"] });
  const gravyB = makeDish({ id: 2, primaryIngredient: "Chickpea" });
  const drySide = makeDish({ id: 3, category: "Dry dish", primaryIngredient: "Okra" });

  it("replaces the second gravy and reports the replaced dish so it can be refunded", () => {
    const result = constraintPass(
      [plate("lunch", "Mon", [pick(gravyA, "star"), pick(gravyB, "companion")])],
      { provider: providerOf({ companion: [drySide] }), library: [gravyA, gravyB, drySide], stats },
    );

    expect(result.plates[0].picks.map((entry) => entry.dishId)).toEqual([1, 3]);
    const repair = result.repairs.find((entry) => entry.reason === "one-gravy-per-lunch");
    expect(repair?.replaced).toEqual(pick(gravyB, "companion"));
    expect(repair?.replacement?.dishId).toBe(3);
    expect(repair?.swappedWithDay).toBeNull();
  });

  it("drops the second gravy outright when the pool offers no alternative", () => {
    const result = constraintPass(
      [plate("lunch", "Mon", [pick(gravyA, "star"), pick(gravyB, "companion")])],
      { provider: providerOf({}), library: [gravyA, gravyB], stats },
    );
    expect(result.plates[0].picks.map((entry) => entry.dishId)).toEqual([1]);
    const repair = result.repairs.find((entry) => entry.reason === "one-gravy-per-lunch");
    expect(repair?.replaced?.dishId).toBe(2);
    expect(repair?.replacement).toBeNull();
  });
});

describe("§6 step 6 cross-meal protein family", () => {
  const stats = statsWith({});
  const paneerBhurji = makeDish({
    id: 1,
    name: "Paneer bhurji",
    time: "Breakfast",
    category: "Dry dish",
    primaryIngredient: "Paneer",
    tags: ["HP"],
  });
  const poha = makeDish({
    id: 2,
    time: "Breakfast",
    category: "Dry dish",
    primaryIngredient: "Poha",
  });
  const paneerLunch = makeDish({ id: 3, name: "Paneer butter masala", tags: ["HP"] });
  const dal = makeDish({ id: 4, name: "Dal tadka", primaryIngredient: "Toor dal", tags: ["HP"] });

  it("resolves the clash by swapping whole plates, before it replaces any dish", () => {
    const result = constraintPass(
      [
        plate("breakfast", "Mon", [pick(paneerBhurji, "breakfast-main", "breakfast")]),
        plate("breakfast", "Tue", [pick(poha, "breakfast-main", "breakfast")]),
        plate("lunch", "Mon", [pick(paneerLunch, "star")]),
        plate("lunch", "Tue", [pick(dal, "star")]),
      ],
      {
        provider: providerOf({ star: [dal, paneerLunch] }),
        library: [paneerBhurji, poha, paneerLunch, dal],
        stats,
      },
    );

    expect(dayOf(result.plates, 3)).toBe("Tue");
    expect(dayOf(result.plates, 4)).toBe("Mon");
    const repair = result.repairs.find((entry) => entry.reason === "protein-family");
    expect(repair).toMatchObject({
      day: "Mon",
      meal: "lunch",
      replaced: null,
      replacement: null,
      swappedWithDay: "Tue",
    });
  });

  it("falls back to replacement when no swap clears the clash", () => {
    // Paneer at both breakfasts, so moving the paneer lunch anywhere still clashes.
    const paneerChilla = makeDish({
      id: 5,
      time: "Breakfast",
      category: "Chilla",
      primaryIngredient: "Paneer",
      tags: ["HP"],
    });
    const chickenCurry = makeDish({ id: 6, name: "Chicken curry", primaryIngredient: "Chicken" });
    const result = constraintPass(
      [
        plate("breakfast", "Mon", [pick(paneerBhurji, "breakfast-main", "breakfast")]),
        plate("breakfast", "Tue", [pick(paneerChilla, "breakfast-main", "breakfast")]),
        plate("lunch", "Mon", [pick(paneerLunch, "star")]),
        plate("lunch", "Tue", [pick(dal, "star")]),
      ],
      {
        provider: providerOf({ star: [chickenCurry, dal, paneerLunch] }),
        library: [paneerBhurji, paneerChilla, paneerLunch, dal, chickenCurry],
        stats,
      },
    );
    const repair = result.repairs.find((entry) => entry.reason === "protein-family");
    expect(repair?.replaced?.dishId).toBe(3);
    expect(repair?.replacement?.dishId).toBe(6);
    expect(repair?.swappedWithDay).toBeNull();
  });

  it("allows the repeat when the pool holds no alternative at all (§5.1 is explicit)", () => {
    const result = constraintPass(
      [
        plate("breakfast", "Mon", [pick(paneerBhurji, "breakfast-main", "breakfast")]),
        plate("lunch", "Mon", [pick(paneerLunch, "star")]),
      ],
      { provider: providerOf({}), library: [paneerBhurji, paneerLunch], stats },
    );
    expect(result.plates.find((entry) => entry.meal === "lunch")?.picks[0].dishId).toBe(3);
    expect(result.unrepairable).toEqual([]);
  });
});

describe("§6 step 6 rice on consecutive days, soft", () => {
  const stats = statsWith({});
  const star = (id: number) => makeDish({ id, tags: ["HP"] });
  const rice = makeDish({
    id: 50,
    name: "Steamed rice",
    category: "Rice",
    primaryIngredient: "Rice",
  });
  const roti = makeDish({ id: 51, name: "Roti", category: "Chapati", primaryIngredient: "Wheat" });

  function lunchWeek(riceDays: Day[]): Plate[] {
    return (["Mon", "Tue", "Wed", "Thu", "Fri"] as Day[]).map((day, index) =>
      plate("lunch", day, [
        pick(star(index + 1), "star"),
        pick(riceDays.includes(day) ? rice : roti, "carb"),
      ]),
    );
  }

  it("swaps the earliest pair of lunches whose exchange clears the run", () => {
    const result = constraintPass(lunchWeek(["Mon", "Tue"]), {
      provider: providerOf({}),
      library: [rice, roti, ...[1, 2, 3, 4, 5].map(star)],
      stats,
    });

    const riceDays = result.plates
      .filter((entry) => entry.picks.some((entry2) => entry2.dishId === 50))
      .map((entry) => entry.day);
    expect(riceDays).toEqual(["Mon", "Wed"]);

    const repair = result.repairs.find((entry) => entry.reason === "consecutive-rice");
    expect(repair).toMatchObject({ day: "Tue", swappedWithDay: "Wed", replaced: null });
    expect(result.repairs.filter((entry) => entry.reason === "consecutive-rice")).toHaveLength(1);
  });

  it("accepts the violation when no exchange clears it", () => {
    const result = constraintPass(lunchWeek(["Mon", "Tue", "Wed", "Thu", "Fri"]), {
      provider: providerOf({}),
      library: [rice, roti, ...[1, 2, 3, 4, 5].map(star)],
      stats,
    });
    expect(result.repairs.filter((entry) => entry.reason === "consecutive-rice")).toEqual([]);
    expect(result.unrepairable).toEqual([]);
  });

  it("leaves non-consecutive rice alone", () => {
    const result = constraintPass(lunchWeek(["Mon", "Wed", "Fri"]), {
      provider: providerOf({}),
      library: [rice, roti, ...[1, 2, 3, 4, 5].map(star)],
      stats,
    });
    expect(result.repairs).toEqual([]);
  });
});

describe("§6 step 6 the day-scoped protein floor", () => {
  const stats = statsWith({});
  const vegLunch = makeDish({
    id: 1,
    name: "Aloo gobi",
    category: "Dry dish",
    primaryIngredient: "Potato",
  });
  const vegBreakfast = makeDish({
    id: 2,
    time: "Breakfast",
    category: "Dry dish",
    primaryIngredient: "Poha",
  });
  const eggBreakfast = makeDish({
    id: 3,
    time: "Breakfast",
    category: "Keto",
    primaryIngredient: "Egg",
    tags: ["HP"],
  });
  const grilledChicken = makeDish({
    id: 4,
    name: "Grilled chicken",
    category: "Keto",
    primaryIngredient: "Chicken",
    tags: ["HP"],
  });
  const soyaChunks = makeDish({
    id: 5,
    name: "Soya chunks masala",
    primaryIngredient: "Soyabean Chunk",
    tags: ["HP"],
  });

  it("appends one plain protein when neither meal of the day carries protein", () => {
    const result = constraintPass(
      [
        plate("breakfast", "Mon", [pick(vegBreakfast, "breakfast-main", "breakfast")]),
        plate("lunch", "Mon", [pick(vegLunch, "star")]),
      ],
      {
        provider: providerOf({ floor: [grilledChicken] }),
        library: [vegBreakfast, vegLunch, grilledChicken],
        stats,
      },
    );
    const lunch = result.plates.find((entry) => entry.meal === "lunch");
    expect(lunch?.picks.map((entry) => entry.dishId)).toEqual([1, 4]);
    expect(lunch?.picks[1]).toMatchObject({ role: "floor", origin: "structural" });
    expect(result.repairs[0]).toMatchObject({ reason: "protein-floor", replaced: null });
  });

  it("does not fire when the breakfast already carries the day's protein", () => {
    const result = constraintPass(
      [
        plate("breakfast", "Mon", [pick(eggBreakfast, "breakfast-main", "breakfast")]),
        plate("lunch", "Mon", [pick(vegLunch, "star")]),
      ],
      {
        provider: providerOf({ floor: [grilledChicken] }),
        library: [eggBreakfast, vegLunch, grilledChicken],
        stats,
      },
    );
    expect(result.repairs).toEqual([]);
  });

  it("does not let soya chunks masala satisfy the day (§13)", () => {
    const result = constraintPass([plate("lunch", "Mon", [pick(soyaChunks, "star")])], {
      provider: providerOf({ floor: [grilledChicken] }),
      library: [soyaChunks, grilledChicken],
      stats,
    });
    expect(result.plates[0].picks.map((entry) => entry.dishId)).toEqual([5, 4]);
  });

  it("never touches Saturday", () => {
    const result = constraintPass(
      [
        plate("lunch", "Sat", [pick(vegLunch, "treat", "lunch", "deficit", "saturday")], {
          scope: "saturday",
        }),
      ],
      {
        provider: providerOf({ floor: [grilledChicken] }),
        library: [vegLunch, grilledChicken],
        stats,
      },
    );
    expect(result.repairs).toEqual([]);
  });
});

describe("§6 step 6 item ceilings and the prep ceiling", () => {
  const stats = statsWith({});
  const star = makeDish({ id: 1, tags: ["HP"], prepMinutes: 40 });
  const carb = makeDish({
    id: 2,
    category: "Chapati",
    primaryIngredient: "Wheat",
    prepMinutes: 20,
  });
  const salad = makeDish({
    id: 3,
    category: "Accompaniment",
    primaryIngredient: "Cucumber",
    prepMinutes: 10,
  });
  const raita = makeDish({
    id: 4,
    category: "Accompaniment",
    primaryIngredient: "Curd",
    prepMinutes: 5,
  });
  const floorProtein = makeDish({
    id: 5,
    category: "Keto",
    primaryIngredient: "Fish",
    tags: ["HP"],
  });

  it("drops the optional companion when a lunch runs past three items", () => {
    const result = constraintPass(
      [
        plate("lunch", "Mon", [
          pick(star, "star"),
          pick(carb, "carb"),
          pick(salad, "companion"),
          pick(raita, "companion"),
        ]),
      ],
      { provider: providerOf({}), library: [star, carb, salad, raita], stats },
    );
    expect(result.plates[0].picks.map((entry) => entry.dishId)).toEqual([1, 2, 3]);
    expect(result.repairs.some((entry) => entry.reason === "item-ceiling")).toBe(true);
  });

  it("allows the fourth item when the protein floor is what put it there (§5.1)", () => {
    const result = constraintPass(
      [
        plate("lunch", "Mon", [
          pick(star, "star"),
          pick(carb, "carb"),
          pick(salad, "companion"),
          pick(floorProtein, "floor", "lunch", "structural"),
        ]),
      ],
      { provider: providerOf({}), library: [star, carb, salad, floorProtein], stats },
    );
    expect(result.plates[0].picks).toHaveLength(4);
    expect(result.repairs.filter((entry) => entry.reason === "item-ceiling")).toEqual([]);
  });

  it("replaces the longest-prep droppable companion when the day runs past 120 minutes", () => {
    const longStar = makeDish({ id: 10, tags: ["HP"], prepMinutes: 70 });
    const longCompanion = makeDish({
      id: 11,
      category: "Accompaniment",
      primaryIngredient: "Cucumber",
      prepMinutes: 45,
    });
    const quickCompanion = makeDish({
      id: 12,
      category: "Accompaniment",
      primaryIngredient: "Curd",
      prepMinutes: 5,
    });
    const breakfastMain = makeDish({
      id: 13,
      time: "Breakfast",
      category: "Dry dish",
      primaryIngredient: "Poha",
      prepMinutes: 25,
    });

    const result = constraintPass(
      [
        plate("breakfast", "Mon", [pick(breakfastMain, "breakfast-main", "breakfast")]),
        plate("lunch", "Mon", [pick(longStar, "star"), pick(longCompanion, "companion")]),
      ],
      {
        provider: providerOf({ companion: [quickCompanion] }),
        library: [longStar, longCompanion, quickCompanion, breakfastMain],
        stats,
      },
    );

    const lunch = result.plates.find((entry) => entry.meal === "lunch");
    expect(lunch?.picks.map((entry) => entry.dishId)).toEqual([10, 12]);
    const repair = result.repairs.find((entry) => entry.reason === "prep-ceiling");
    expect(repair?.replaced?.dishId).toBe(11);
    expect(repair?.replacement?.dishId).toBe(12);
    expect(result.unrepairable).toEqual([]);
  });

  it("reports a day whose protected items alone exceed the ceiling (§11 threshold 10)", () => {
    const heavyStar = makeDish({ id: 20, tags: ["HP"], prepMinutes: 90 });
    const heavyBreakfast = makeDish({
      id: 21,
      time: "Breakfast",
      category: "Dry dish",
      primaryIngredient: "Poha",
      prepMinutes: 60,
    });
    const result = constraintPass(
      [
        plate("breakfast", "Tue", [pick(heavyBreakfast, "breakfast-main", "breakfast")]),
        plate("lunch", "Tue", [pick(heavyStar, "star")]),
      ],
      { provider: providerOf({}), library: [heavyStar, heavyBreakfast], stats },
    );
    expect(result.unrepairable).toEqual(["prep-ceiling:Tue"]);
  });
});

describe("§6 step 6 is pure and deterministic", () => {
  const stats = statsWith({});
  const gravyA = makeDish({ id: 1, tags: ["HP"] });
  const gravyB = makeDish({ id: 2, primaryIngredient: "Chickpea" });
  const drySide = makeDish({ id: 3, category: "Dry dish", primaryIngredient: "Okra" });

  function input(): Plate[] {
    return [plate("lunch", "Mon", [pick(gravyA, "star"), pick(gravyB, "companion")])];
  }

  it("never mutates the plates it was given", () => {
    const plates = input();
    constraintPass(plates, {
      provider: providerOf({ companion: [drySide] }),
      library: [gravyA, gravyB, drySide],
      stats,
    });
    expect(plates[0].picks.map((entry) => entry.dishId)).toEqual([1, 2]);
  });

  it("returns the same result for the same inputs", () => {
    const args = {
      provider: providerOf({ companion: [drySide] }),
      library: [gravyA, gravyB, drySide],
      stats,
    };
    expect(JSON.stringify(constraintPass(input(), args))).toBe(
      JSON.stringify(constraintPass(input(), args)),
    );
  });
});
