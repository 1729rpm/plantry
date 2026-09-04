import { describe, it, expect } from "vitest";
import type { Dish } from "../../src/data/schemas.js";
import { pinFavorites } from "../../src/v6/favoritesPin.js";
import { assignDays, type Plate, type PoolEntry, type PoolProvider } from "../../src/v6/place.js";
import type { DishStats, PickRole, RecordStats } from "../../src/v6/types.js";

/**
 * `features/engine-v6.md` §8 and §6 step 2. The favorites table's product
 * guarantee: every favorites-list dish is pinned into EXACTLY ONE slot of its
 * meal type in every generated week, oldest added first, spread across distinct
 * days by the §6 step 5 placement, never breaking a hard composition rule, and
 * an unplaceable favorite is reported rather than forced.
 *
 * "Every favorite exactly once, on distinct days" is a locked invariant: the
 * v4.1 gate failed on double placement, so the fixture below uses two ORDINARY
 * favorites (not just the one avocado toast the household has today) and asserts
 * the count as well as the days.
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
    prepMinutes: 30,
    seasons: "All",
    cuisine: "Indian",
    ...overrides,
  };
}

/**
 * A stub of stream B's ranked pools: dishes in the order the pool would rank
 * them (deficit descending), minus the excluded ids. Role is the only key the
 * pinning pass distinguishes, so the stub keys on role alone.
 */
function providerOf(pools: Partial<Record<PickRole, Dish[]>>): PoolProvider {
  return (role, _scope, exclude): PoolEntry[] =>
    (pools[role] ?? [])
      .filter((dish) => !exclude.has(dish.id))
      .map((dish, index) => ({ dish, deficit: 1 - index * 0.1, rate: 0.2 }));
}

function emptyStats(): RecordStats {
  return {
    weeks: 0,
    occasions: { weekdayBreakfast: 0, weekdayLunch: 0, saturday: 0, fruit: 0 },
    seasonDayOccasions: {},
    perDish: new Map<number, DishStats>(),
    swappedOut: [],
  };
}

const dalTadka = makeDish({ id: 101, name: "Dal tadka", primaryIngredient: "Toor dal" });
const rajma = makeDish({ id: 102, name: "Rajma", primaryIngredient: "Rajma" });
const chole = makeDish({ id: 103, name: "Chole", primaryIngredient: "Chickpea" });
const kadhi = makeDish({ id: 104, name: "Kadhi", primaryIngredient: "Curd" });
const sambar = makeDish({ id: 105, name: "Sambar", primaryIngredient: "Toor dal" });
const paneerBhurji = makeDish({ id: 106, name: "Paneer bhurji", category: "Dry dish" });
const cucumberSalad = makeDish({
  id: 200,
  name: "Cucumber salad",
  category: "Accompaniment",
  primaryIngredient: "Cucumber",
});
const avocadoToast = makeDish({
  id: 300,
  name: "Avocado toast",
  time: "Breakfast",
  category: "Dry dish",
  primaryIngredient: "Avocado",
});
const notInAnyPool = makeDish({ id: 400, name: "Mutton biryani", category: "Complete meal" });

describe("§8 every favorite is pinned exactly once", () => {
  const library = [dalTadka, rajma, notInAnyPool, cucumberSalad, avocadoToast];
  const provider = providerOf({
    star: [dalTadka, rajma, chole],
    companion: [cucumberSalad],
    "breakfast-main": [avocadoToast],
  });

  it("pins two ordinary favorites once each and reports the third as unplaceable", () => {
    const result = pinFavorites({
      favoriteDishIds: [101, 102, 400],
      library,
      season: "Summer",
      provider,
    });

    expect(result.pinned.map((pick) => pick.dishId)).toEqual([101, 102]);
    expect(result.pinned.every((pick) => pick.origin === "favorite")).toBe(true);
    expect(result.pinned.every((pick) => pick.role === "star")).toBe(true);
    expect(result.unplaceable).toEqual([400]);

    for (const dishId of [101, 102]) {
      expect(result.pinned.filter((pick) => pick.dishId === dishId)).toHaveLength(1);
    }
  });

  it("lands the two pinned favorites on distinct days once §6 step 5 assigns them", () => {
    const { pinned } = pinFavorites({
      favoriteDishIds: [101, 102],
      library,
      season: "Summer",
      provider,
    });

    // Five weekday lunches: the two pinned favorites plus three ordinary stars.
    const plates: Plate[] = [
      ...pinned.map((pick) => ({
        meal: "lunch" as const,
        scope: "weekdayLunch" as const,
        day: null,
        picks: [pick],
      })),
      ...[chole, kadhi, sambar].map((dish) => ({
        meal: "lunch" as const,
        scope: "weekdayLunch" as const,
        day: null,
        picks: [
          {
            meal: "lunch" as const,
            dishId: dish.id,
            role: "star" as const,
            scope: "weekdayLunch" as const,
            origin: "deficit" as const,
          },
        ],
      })),
    ];

    const assigned = assignDays(plates, emptyStats());
    const days = assigned
      .filter((plate) => plate.picks.some((pick) => pick.origin === "favorite"))
      .map((plate) => plate.day);

    expect(days).toHaveLength(2);
    expect(new Set(days).size).toBe(2);
    expect(days.every((day) => day !== null)).toBe(true);

    // And each favorite still appears exactly once across the whole week.
    const placements = assigned.flatMap((plate) => plate.picks).map((pick) => pick.dishId);
    expect(placements.filter((id) => id === 101)).toHaveLength(1);
    expect(placements.filter((id) => id === 102)).toHaveLength(1);
  });

  it("pins a dish listed twice in the favorites table exactly once", () => {
    const result = pinFavorites({
      favoriteDishIds: [101, 101, 102],
      library,
      season: "Summer",
      provider,
    });
    expect(result.pinned.map((pick) => pick.dishId)).toEqual([101, 102]);
    expect(result.unplaceable).toEqual([]);
  });

  it("never pins more lunch stars than the week has weekday lunches", () => {
    const stars = [dalTadka, rajma, chole, kadhi, sambar, paneerBhurji];
    const result = pinFavorites({
      favoriteDishIds: stars.map((dish) => dish.id),
      library: stars,
      season: "Summer",
      provider: providerOf({ star: stars }),
    });
    expect(result.pinned).toHaveLength(5);
    // Oldest added first: the sixth favorite is the one left over, not the first.
    expect(result.pinned.map((pick) => pick.dishId)).toEqual([101, 102, 103, 104, 105]);
    expect(result.unplaceable).toEqual([106]);
  });
});

describe("§8 a favorite takes a slot its own meal type and category allow", () => {
  it("takes an Accompaniment lunch favorite as a companion, never as a star", () => {
    const result = pinFavorites({
      favoriteDishIds: [200],
      library: [cucumberSalad],
      season: "Summer",
      // The salad sits in BOTH stubs; only the companion position may claim it.
      provider: providerOf({ star: [cucumberSalad], companion: [cucumberSalad] }),
    });
    expect(result.pinned).toEqual([
      {
        meal: "lunch",
        dishId: 200,
        role: "companion",
        scope: "weekdayLunch",
        origin: "favorite",
      },
    ]);
  });

  it("takes a breakfast favorite into the breakfast main pool", () => {
    const result = pinFavorites({
      favoriteDishIds: [300],
      library: [avocadoToast],
      season: "Summer",
      provider: providerOf({ "breakfast-main": [avocadoToast] }),
    });
    expect(result.pinned[0].role).toBe("breakfast-main");
    expect(result.pinned[0].scope).toBe("weekdayBreakfast");
    expect(result.pinned[0].meal).toBe("breakfast");
  });

  it("falls back to the Saturday treat pool for a favorite no weekday pool holds", () => {
    const result = pinFavorites({
      favoriteDishIds: [400],
      library: [notInAnyPool],
      season: "Summer",
      provider: providerOf({ treat: [notInAnyPool] }),
    });
    expect(result.pinned[0].role).toBe("treat");
    expect(result.pinned[0].scope).toBe("saturday");
    expect(result.unplaceable).toEqual([]);
  });

  it("reports an inactive or out-of-season favorite instead of forcing it", () => {
    const inactive = makeDish({ id: 501, active: "No" });
    const wintry = makeDish({ id: 502, seasons: ["Winter"] });
    const unknownId = 999;
    const result = pinFavorites({
      favoriteDishIds: [inactive.id, wintry.id, unknownId],
      library: [inactive, wintry],
      season: "Summer",
      provider: providerOf({ star: [inactive, wintry] }),
    });
    expect(result.pinned).toEqual([]);
    expect(result.unplaceable).toEqual([501, 502, 999]);
  });

  it("does not mutate the favorites list or the library", () => {
    const favorites = [101, 102];
    const library = [dalTadka, rajma];
    pinFavorites({
      favoriteDishIds: favorites,
      library,
      season: "Summer",
      provider: providerOf({ star: [dalTadka, rajma] }),
    });
    expect(favorites).toEqual([101, 102]);
    expect(library.map((dish) => dish.id)).toEqual([101, 102]);
  });
});
