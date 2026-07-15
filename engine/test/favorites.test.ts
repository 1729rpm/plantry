import { describe, it, expect } from "vitest";
import { planFavorites } from "../src/favorites.js";
import { slotAcceptsDish } from "../src/requests.js";
import { generateWeek } from "../src/generateWeek.js";
import { weekSchedule } from "../src/schedule.js";
import { eligibleDishes } from "../src/eligibility.js";
import { isHpMain } from "../src/priority.js";
import { loadLiveData } from "./loadLive.js";
import type { Season } from "../src/data/schemas.js";

/**
 * docs/engine.md §4 step 4: guaranteed favorites placement
 * (`features/wishlist-favorites-v2` §3). Every library favorite is pinned into
 * exactly one slot of every generated week, spread across distinct days,
 * composition-locks-win, oldest-added first when the full set cannot fit, and the
 * unplaced remainder is returned in `GeneratedWeek.unplacedFavorites`. These
 * fixtures prove the five contracts the spec names: (a) every favorite appears,
 * (b) no favorite twice, (c) distinct days, (d) oldest-first overflow with the
 * remainder reported, (e) an empty set leaves generation byte-identical.
 */

const { library, ingredients, packSizes, history: seedHistory } = loadLiveData();
const weekStart = "2026-06-15"; // Monsoon

function seasonOf(iso: string): Season {
  const month = Number.parseInt(iso.slice(5, 7), 10);
  if (month >= 3 && month <= 5) return "Summer";
  if (month >= 6 && month <= 9) return "Monsoon";
  return "Winter";
}
const season = seasonOf(weekStart);

// Deterministic RNG for the Saturday alternation, so every run is identical.
function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function generate(favoriteDishIds?: readonly number[]) {
  return generateWeek({
    weekStart,
    library,
    history: seedHistory,
    season,
    ingredients,
    packSizes,
    rng: makeRng(42),
    favoriteDishIds,
  });
}

/** Every dish id placed in the week, one entry per placement (repeats counted). */
function placedDishIds(week: ReturnType<typeof generateWeek>): number[] {
  return week.days.flatMap((d) => d.slots.flatMap((s) => s.dishes.map((dish) => dish.id)));
}

/** The (day set) a favorite id was placed on across the week's slots. */
function daysOf(week: ReturnType<typeof generateWeek>, dishId: number): string[] {
  const days: string[] = [];
  for (const day of week.days) {
    for (const slot of day.slots) {
      if (slot.dishes.some((d) => d.id === dishId)) days.push(day.day);
    }
  }
  return days;
}

const eligibleLunch = eligibleDishes({
  library,
  history: seedHistory,
  season,
  slot: { day: "Mon", meal: "Lunch" },
});
const eligibleBreakfast = eligibleDishes({
  library,
  history: seedHistory,
  season,
  slot: { day: "Mon", meal: "Breakfast" },
});

// Gravy-dish HP lunch mains: they lead every Menu 1 weekday lunch (the `hp` pool),
// so a set of them is reliably placeable one-per-lunch-day. Used for the overflow
// fixture where the only bound is lunch-day capacity, not composition oddities.
const gravyHpLunchMains = eligibleLunch.filter((d) => isHpMain(d) && d.category === "Gravy dish");

describe("planFavorites (pure placement planner)", () => {
  const schedule = weekSchedule({ weekStart });

  it("is a no-op for an empty favorite set", () => {
    const out = planFavorites({
      favoriteDishIds: [],
      schedule,
      library,
      history: seedHistory,
      season,
    });
    expect(out.placements).toEqual([]);
    expect(out.unplacedDishIds).toEqual([]);
  });

  it("routes a lunch favorite to a lunch slot and spreads two favorites across distinct days", () => {
    // A breakfast favorite and a lunch favorite that a Mon slot accepts, so both
    // are genuinely placeable; the planner must land them on DIFFERENT days.
    const bfast = eligibleBreakfast.find((d) =>
      slotAcceptsDish({
        slot: schedule.find((s) => s.day === "Mon" && s.meal === "Breakfast")!,
        dishId: d.id,
        library,
        history: seedHistory,
        season,
        weekLunchCarbs: [],
      }),
    );
    const lunch = gravyHpLunchMains[0];
    expect(bfast, "expected a placeable breakfast favorite").toBeDefined();
    expect(lunch, "expected a placeable lunch favorite").toBeDefined();

    const out = planFavorites({
      favoriteDishIds: [bfast!.id, lunch.id],
      schedule,
      library,
      history: seedHistory,
      season,
    });
    expect(out.unplacedDishIds).toEqual([]);
    const bfastPlacement = out.placements.find((p) => p.dishId === bfast!.id)!;
    const lunchPlacement = out.placements.find((p) => p.dishId === lunch.id)!;
    expect(bfastPlacement.meal).toBe("Breakfast");
    expect(lunchPlacement.meal).toBe("Lunch");
    // Distinct-days spread: the two favorites never share a day when days are free.
    expect(bfastPlacement.day).not.toBe(lunchPlacement.day);
  });

  it("places the oldest-added favorites first and reports the overflow remainder", () => {
    // Favorite far more Gravy-HP lunch mains than there are Menu-1 lunch days.
    // Every one is equally acceptable to the same set of lunch slots, so the only
    // bound is capacity: the oldest fill the lunch days, the rest are unplaced.
    expect(gravyHpLunchMains.length).toBeGreaterThan(6);
    const ordered = gravyHpLunchMains.map((d) => d.id);
    const out = planFavorites({
      favoriteDishIds: ordered,
      schedule,
      library,
      history: seedHistory,
      season,
    });
    // Overflow really happened (not everything fit).
    expect(out.placements.length).toBeGreaterThan(0);
    expect(out.placements.length).toBeLessThan(ordered.length);
    // Oldest-first: the placed ids are exactly the input's prefix, in order.
    const placedIds = out.placements.map((p) => p.dishId);
    expect(placedIds).toEqual(ordered.slice(0, placedIds.length));
    // The remainder is the suffix, in order.
    expect(out.unplacedDishIds).toEqual(ordered.slice(placedIds.length));
    // Every placement is on a distinct day (one favorite per day).
    const days = out.placements.map((p) => p.day);
    expect(new Set(days).size).toBe(days.length);
  });

  it("reports a stale (non-library) favorite id as unplaced without crashing", () => {
    const out = planFavorites({
      favoriteDishIds: [9_999_999],
      schedule,
      library,
      history: seedHistory,
      season,
    });
    expect(out.placements).toEqual([]);
    expect(out.unplacedDishIds).toEqual([9_999_999]);
  });

  it("never lands a favorite on a reserved slot", () => {
    const lunch = gravyHpLunchMains[0];
    // Reserve every lunch slot: a lunch-only favorite then has nowhere to go.
    const reserved = new Set(
      schedule.filter((s) => s.meal === "Lunch").map((s) => `${s.day}/${s.meal}`),
    );
    const out = planFavorites({
      favoriteDishIds: [lunch.id],
      schedule,
      library,
      history: seedHistory,
      season,
      reservedSlots: reserved,
    });
    expect(out.placements).toEqual([]);
    expect(out.unplacedDishIds).toEqual([lunch.id]);
  });
});

describe("generateWeek guaranteed-favorites end-to-end (features/wishlist-favorites-v2 §3)", () => {
  /** Core invariant: every favorite is placed exactly once XOR reported unplaced. */
  function assertPlacedXorUnplaced(favoriteIds: number[]) {
    const week = generate(favoriteIds);
    const placed = placedDishIds(week);
    const unplaced = new Set(week.unplacedFavorites);
    for (const id of favoriteIds) {
      const count = placed.filter((p) => p === id).length;
      if (unplaced.has(id)) {
        expect(count, `unplaced favorite ${id} must not appear`).toBe(0);
      } else {
        expect(count, `placed favorite ${id} must appear exactly once`).toBe(1);
      }
    }
    return week;
  }

  it("(a) a favorite the household wants is guaranteed into the generated week", () => {
    // One Gravy-HP lunch main: the first weekday Menu-1 lunch accepts it as the HP
    // lead, so it lands. This is the core guarantee (a favorite appears in every
    // generated week), isolated to a dish the composition can genuinely place.
    const favorite = gravyHpLunchMains[0].id;
    const week = generate([favorite]);
    const placed = placedDishIds(week);
    expect(placed.filter((id) => id === favorite).length, "favorite must appear once").toBe(1);
    expect(week.unplacedFavorites).toEqual([]);
  });

  it("(b) no favorite appears twice in one week", () => {
    const favorites = gravyHpLunchMains.map((d) => d.id);
    const week = generate(favorites);
    const placed = placedDishIds(week);
    for (const id of favorites) {
      const count = placed.filter((p) => p === id).length;
      expect(count, `favorite ${id} placed ${count}x`).toBeLessThan(2);
    }
  });

  it("(c) favorites spread across distinct days", () => {
    const favorites = gravyHpLunchMains.slice(0, 3).map((d) => d.id);
    const week = generate(favorites);
    const placementDays: string[] = [];
    for (const id of favorites) {
      const days = daysOf(week, id);
      // Each placed favorite lands on exactly one day.
      if (days.length > 0) placementDays.push(...days);
    }
    // No two favorites share a day (distinct-days spread, days were available).
    expect(new Set(placementDays).size).toBe(placementDays.length);
  });

  it("(d) an overflowing favorite set places as many as fit and reports the rest", () => {
    // Far more Gravy-HP favorites than the week has lunch slots for them. The
    // oldest-first placement order is proven crisply by the planFavorites unit test
    // above; here we assert the end-to-end consequence: every favorite is placed
    // exactly once XOR reported unplaced, the overflow really is reported, and the
    // reported remainder is exactly the favorites that did not land (the engine
    // never breaks a composition lock to force one in).
    const ordered = gravyHpLunchMains.map((d) => d.id);
    const week = assertPlacedXorUnplaced(ordered);
    expect(week.unplacedFavorites.length).toBeGreaterThan(0);
    const placed = new Set(placedDishIds(week));
    expect(new Set(week.unplacedFavorites)).toEqual(
      new Set(ordered.filter((id) => !placed.has(id))),
    );
    // Every reported id is one of the favorites (no stray ids).
    for (const id of week.unplacedFavorites) expect(ordered).toContain(id);
  });

  it("(e) an empty favorite set leaves generation byte-identical to the no-favorites baseline", () => {
    const baseline = generate();
    const withEmpty = generate([]);
    expect(withEmpty.days).toEqual(baseline.days);
    expect(withEmpty.incidents).toEqual(baseline.incidents);
    expect(withEmpty.droppedDishIds).toEqual(baseline.droppedDishIds);
    expect(withEmpty.unplacedFavorites).toEqual([]);
    expect(baseline.unplacedFavorites).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Synthetic library: reproduces the multi-position double-placement guarded by the
// exactly-once fix. A favorite drawn as an ordinary companion on an earlier day than
// the slot it is pinned to would otherwise be placed twice. This case cannot arise
// from a single-position HP lead (the live-data fixtures above), so it needs a
// non-HP companion favorite in a broad companion pool.
// ---------------------------------------------------------------------------

let synthId = 1;
function makeSynthDish(overrides: Partial<import("../src/data/schemas.js").Dish> = {}) {
  const id = synthId++;
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
  } as import("../src/data/schemas.js").Dish;
}

/** A library that fills a full week with Indian Menu-1/2 lunches (no substitution). */
function makeSynthLibrary() {
  return [
    makeSynthDish({
      name: "Idli Sambar",
      time: "Breakfast",
      category: "Complete meal",
      tags: ["complete_meal"],
      primaryIngredient: "Idli batter",
    }),
    makeSynthDish({
      name: "Apple",
      time: "Breakfast",
      category: "Fruit",
      tags: ["fruit"],
      primaryIngredient: "Apple",
    }),
    makeSynthDish({
      name: "Poha",
      time: "Breakfast",
      category: "Complete meal",
      tags: ["complete_meal"],
      primaryIngredient: "Poha",
    }),
    makeSynthDish({
      name: "Banana",
      time: "Breakfast",
      category: "Fruit",
      tags: ["fruit"],
      primaryIngredient: "Banana",
    }),
    makeSynthDish({
      name: "Upma",
      time: "Breakfast",
      category: "Complete meal",
      tags: ["complete_meal"],
      primaryIngredient: "Semolina",
    }),
    makeSynthDish({
      name: "Masala Dosa",
      time: "Breakfast",
      category: "Complete meal",
      tags: ["complete_meal"],
      primaryIngredient: "Dosa batter",
    }),
    // Lunch HP mains (Menu-1 leads).
    makeSynthDish({
      name: "Paneer Butter Masala",
      time: "Lunch",
      category: "Gravy dish",
      tags: ["HP"],
      primaryIngredient: "Paneer",
    }),
    makeSynthDish({
      name: "Chicken Curry",
      time: "Lunch",
      category: "Gravy dish",
      tags: ["HP"],
      primaryIngredient: "Chicken",
    }),
    makeSynthDish({
      name: "Fish Curry",
      time: "Lunch",
      category: "Gravy dish",
      tags: ["HP"],
      primaryIngredient: "Fish",
    }),
    // Non-HP companions (the broad companion pool a favorite can be drawn from).
    makeSynthDish({
      name: "Aloo Gobi",
      time: "Lunch",
      category: "Dry dish",
      primaryIngredient: "Cauliflower",
    }),
    makeSynthDish({
      name: "Cabbage Sabzi",
      time: "Lunch",
      category: "Dry dish",
      primaryIngredient: "Cabbage",
    }),
    makeSynthDish({
      name: "Dal Tadka",
      time: "Lunch",
      category: "Gravy dish",
      primaryIngredient: "Dal",
    }),
    makeSynthDish({
      name: "Cucumber Raita",
      time: "Lunch",
      category: "Accompaniment",
      primaryIngredient: "Curd",
    }),
    makeSynthDish({
      name: "Onion Salad",
      time: "Lunch",
      category: "Accompaniment",
      primaryIngredient: "Onion",
    }),
    makeSynthDish({
      name: "Chapati",
      time: "Lunch",
      category: "Chapati",
      primaryIngredient: "Wheat flour",
    }),
    makeSynthDish({
      name: "Jeera Rice",
      time: "Lunch",
      category: "Rice",
      primaryIngredient: "Rice",
    }),
    // Keto leads so any Menu-2 weekday lunch still fills.
    makeSynthDish({
      name: "Stir-fry Tofu",
      time: "Lunch",
      category: "Keto",
      primaryIngredient: "Tofu",
    }),
    makeSynthDish({
      name: "Egg Bhurji",
      time: "Lunch",
      category: "Keto",
      primaryIngredient: "Egg",
    }),
    // Saturday Menu 3/4 needs a complete_meal + dessert.
    makeSynthDish({
      name: "Biryani Chicken",
      time: "Lunch",
      category: "Complete meal",
      tags: ["complete_meal", "HP"],
      primaryIngredient: "Chicken",
    }),
    makeSynthDish({
      name: "Veg Pulao",
      time: "Lunch",
      category: "Complete meal",
      tags: ["complete_meal"],
      primaryIngredient: "Rice",
    }),
    makeSynthDish({
      name: "Gulab Jamun",
      time: "Lunch",
      category: "Dessert",
      primaryIngredient: "Khoya",
    }),
    makeSynthDish({
      name: "Rasmalai",
      time: "Lunch",
      category: "Dessert",
      primaryIngredient: "Milk",
    }),
  ];
}

describe("generateWeek favorites are placed exactly once (multi-position de-dup)", () => {
  it("never places a companion favorite twice when it is pinned to a later day than one it is drawn on", () => {
    synthId = 1;
    const library = makeSynthLibrary();
    const pbm = library.find((d) => d.name === "Paneer Butter Masala")!;
    const alooGobi = library.find((d) => d.name === "Aloo Gobi")!;
    // Oldest-first: the HP main claims the first accepting lunch day, so the
    // distinct-days preference deflects the non-HP companion favorite to a later
    // day. Without the exactly-once exclusion, the earlier day draws the companion
    // as a fresh side and the later day pins it again, placing it twice.
    const week = generateWeek({
      weekStart: "2026-06-08", // Summer
      library,
      history: [],
      season: "Summer",
      ingredients: [],
      packSizes: [],
      rng: () => 0.1,
      lastSaturdayMenu: null,
      favoriteDishIds: [pbm.id, alooGobi.id],
    });

    const counts = new Map<number, number>();
    for (const day of week.days) {
      for (const slot of day.slots) {
        for (const dish of slot.dishes) counts.set(dish.id, (counts.get(dish.id) ?? 0) + 1);
      }
    }
    // The regression the fix guards: no favorite (indeed no dish) appears twice.
    for (const fav of [pbm.id, alooGobi.id]) {
      const c = counts.get(fav) ?? 0;
      const name = library.find((d) => d.id === fav)!.name;
      expect(c, `favorite ${name} placed ${c}x in one week`).toBeLessThan(2);
    }
    // Each favorite is still placed exactly once XOR reported unplaced.
    for (const fav of [pbm.id, alooGobi.id]) {
      const placed = (counts.get(fav) ?? 0) === 1;
      const unplaced = week.unplacedFavorites.includes(fav);
      expect(placed !== unplaced, `favorite ${fav} must be placed-once XOR unplaced`).toBe(true);
    }
  });
});
