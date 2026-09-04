import { describe, it, expect } from "vitest";
import type { Dish, Season } from "../../src/data/schemas.js";
import type { DishStats, Ledger, RecordStats, Scope } from "../../src/v6/types.js";
import {
  breakfastChutneyPool,
  breakfastEggRiderPool,
  breakfastMainPool,
  carbPool,
  carbPoolForLead,
  dessertPool,
  dryProteinPartnerPool,
  everydayBasePool,
  fillOptional,
  fillStructural,
  fillStructuralWithOrigin,
  fruitOverflowPool,
  fruitPool,
  isBareBreakfastCarb,
  isBreakfastMain,
  isCarbForwardInternational,
  isEverydayBase,
  isInternationalStar,
  isLunchStar,
  isPlainProtein,
  isStructuralPoolDish,
  lunchCompanionPool,
  lunchStarPool,
  poolProvider,
  proteinFloorPool,
  rankPool,
  saturdayAccompanimentPool,
  saturdayTreatPool,
  specialProteinPool,
  thursdayEggBreakfastPool,
} from "../../src/v6/pools.js";
import type { PoolContext, PoolEntry } from "../../src/v6/pools.js";

// ---------------------------------------------------------------------------
// Fixture builders. Every fixture below is constructed by hand rather than read
// from the live library, so a content change can never quietly turn a rule test
// green (or red).
// ---------------------------------------------------------------------------

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

interface StatSpec {
  id: number;
  eaten?: Partial<Record<Scope, number>>;
  rate?: Partial<Record<Scope, number>>;
  lastEatenWeek?: string | null;
  seasonCount?: Partial<Record<Season, number>>;
}

const ZERO_BY_SCOPE: Record<Scope, number> = {
  weekdayBreakfast: 0,
  weekdayLunch: 0,
  saturday: 0,
  fruit: 0,
};

function makeStats(specs: StatSpec[]): RecordStats {
  const perDish = new Map<number, DishStats>();
  for (const spec of specs) {
    perDish.set(spec.id, {
      eatenCount: { ...ZERO_BY_SCOPE, ...spec.eaten },
      rate: { ...ZERO_BY_SCOPE, ...spec.rate },
      lastEatenWeek: spec.lastEatenWeek ?? "2026-06-01",
      occupations: new Map(),
      seasonCount: spec.seasonCount ?? {},
    });
  }
  return {
    weeks: 8,
    occasions: { weekdayBreakfast: 40, weekdayLunch: 40, saturday: 8, fruit: 48 },
    seasonDayOccasions: { Summer: 48 },
    perDish,
    swappedOut: [],
  };
}

function makeLedger(rows: Array<[number, Scope, number]>): Ledger {
  const deficits = new Map<string, number>();
  for (const [id, scope, value] of rows) deficits.set(`${id}:${scope}`, value);
  return { deficits };
}

function makeContext(
  library: Dish[],
  specs: StatSpec[],
  ledgerRows: Array<[number, Scope, number]>,
  season: Season = "Summer",
): PoolContext {
  return { library, season, stats: makeStats(specs), ledger: makeLedger(ledgerRows) };
}

const ids = (pool: PoolEntry[]): number[] => pool.map((entry) => entry.dish.id);

// ---------------------------------------------------------------------------

describe("v6 pools: structural-pool membership (§3 cold start)", () => {
  const star = makeDish({ id: 1, category: "Gravy dish", tags: ["HP"] });
  const salad = makeDish({ id: 2, category: "Accompaniment", tags: ["HP"], name: "Egg salad" });
  const carb = makeDish({ id: 3, category: "Chapati", primaryIngredient: "Wheat Flour" });
  const dessert = makeDish({ id: 4, category: "Dessert" });
  const fruit = makeDish({ id: 5, category: "Fruit", time: "Breakfast", tags: ["fruit"] });
  const bareCarb = makeDish({ id: 6, category: "Bread", time: "Breakfast" });
  const breakfastMain = makeDish({ id: 7, category: "Dry dish", time: "Breakfast", tags: ["HP"] });
  const chutney = makeDish({ id: 8, category: "Accompaniment", time: "Breakfast" });

  it("is true for a lunch star and false for a salad", () => {
    // The invariant: an HP-tagged Category Accompaniment (an egg or paneer salad) is
    // a companion, never a star, so it must not be seeded by the cold start. The
    // fixture is adversarial because the salad carries the HP tag that would admit
    // it if membership were keyed on the tag alone.
    expect(isStructuralPoolDish(star)).toBe(true);
    expect(isStructuralPoolDish(salad)).toBe(false);
    expect(isLunchStar(salad)).toBe(false);
  });

  it("is true for carbs, desserts, fruit, and breakfast mains", () => {
    expect(isStructuralPoolDish(carb)).toBe(true);
    expect(isStructuralPoolDish(dessert)).toBe(true);
    expect(isStructuralPoolDish(fruit)).toBe(true);
    expect(isStructuralPoolDish(breakfastMain)).toBe(true);
  });

  it("is false for a bare breakfast carb and for a breakfast chutney", () => {
    // §3: a bare breakfast carb belongs to no v6 pool at all, so it has no ledger.
    expect(isBareBreakfastCarb(bareCarb)).toBe(true);
    expect(isStructuralPoolDish(bareCarb)).toBe(false);
    expect(isStructuralPoolDish(chutney)).toBe(false);
  });
});

describe("v6 pools: the §3.2 gates", () => {
  const eaten = makeDish({ id: 10, category: "Gravy dish", tags: ["HP"] });
  const neverEaten = makeDish({ id: 11, category: "Gravy dish", tags: ["HP"] });
  const inactive = makeDish({ id: 12, category: "Gravy dish", tags: ["HP"], active: "No" });
  const outOfSeason = makeDish({
    id: 13,
    category: "Gravy dish",
    tags: ["HP"],
    seasons: ["Winter"],
  });

  const ctx = makeContext(
    [eaten, neverEaten, inactive, outOfSeason],
    [
      { id: 10, eaten: { weekdayLunch: 4 }, rate: { weekdayLunch: 0.1 } },
      { id: 12, eaten: { weekdayLunch: 4 }, rate: { weekdayLunch: 0.1 } },
      { id: 13, eaten: { weekdayLunch: 4 }, rate: { weekdayLunch: 0.1 } },
    ],
    [
      [10, "weekdayLunch", 0.5],
      [11, "weekdayLunch", 9],
      [12, "weekdayLunch", 9],
      [13, "weekdayLunch", 9],
    ],
  );

  it("drops a dish with no record entry in the scope, rather than ranking it at zero", () => {
    // §2.2, adversarial: dish 11 has never been eaten but carries the largest deficit
    // in the ledger. Presence in the scope, not the ledger, is what admits a dish.
    expect(ids(lunchStarPool(ctx, "weekdayLunch"))).toEqual([10]);
  });

  it("drops inactive and out-of-season dishes even when they are in the scope", () => {
    const pool = lunchStarPool(ctx, "weekdayLunch");
    expect(ids(pool)).not.toContain(12);
    expect(ids(pool)).not.toContain(13);
  });

  it("ranks by deficit descending and breaks ties by dish id ascending", () => {
    const entries: PoolEntry[] = [
      { dish: makeDish({ id: 30 }), deficit: 0.4, rate: 0.9 },
      { dish: makeDish({ id: 20 }), deficit: 0.4, rate: 0.1 },
      { dish: makeDish({ id: 25 }), deficit: 0.9, rate: 0.2 },
    ];
    expect(ids(rankPool(entries))).toEqual([25, 20, 30]);
  });
});

describe("v6 pools: §5.2 breakfast pools", () => {
  const chilla = makeDish({
    id: 40,
    category: "Chilla",
    time: "Breakfast",
    tags: ["complete_carb"],
  });
  const dryMain = makeDish({
    id: 41,
    category: "Dry dish",
    time: "Breakfast",
    tags: ["HP"],
    primaryIngredient: "Egg",
  });
  const bareCarb = makeDish({ id: 42, category: "Paratha", time: "Breakfast" });
  const chutney = makeDish({ id: 43, category: "Accompaniment", time: "Breakfast" });
  const boiledEggs = makeDish({
    id: 44,
    category: "Keto",
    time: "Breakfast",
    tags: ["HP", "cuisine_neutral"],
    primaryIngredient: "Egg",
  });
  const sevai = makeDish({
    id: 45,
    category: "Complete meal",
    time: "Breakfast",
    tags: ["complete_meal"],
    primaryIngredient: "Rice Vermicelli",
  });
  const fruitBowl = makeDish({ id: 46, category: "Fruit", time: "Breakfast", tags: ["fruit"] });

  const library = [chilla, dryMain, bareCarb, chutney, boiledEggs, sevai, fruitBowl];
  const ctx = makeContext(
    library,
    library.map((dish) => ({
      id: dish.id,
      eaten: { weekdayBreakfast: 2 },
      rate: { weekdayBreakfast: 0.2 },
    })),
    library.map((dish) => [dish.id, "weekdayBreakfast", 0.3] as [number, Scope, number]),
  );

  it("admits Breakfast-time Dry dishes and excludes chutneys, bare carbs, and fruit bowls", () => {
    // §5.2: the breakfast Dry-dish retag of v5 is unnecessary because the pool admits
    // them directly. The fixture is adversarial on all three exclusions at once.
    expect(ids(breakfastMainPool(ctx, "weekdayBreakfast"))).toEqual([40, 41, 44, 45]);
    expect(isBreakfastMain(bareCarb)).toBe(false);
    expect(isBreakfastMain(fruitBowl)).toBe(false);
  });

  it("keys the chutney pool on Category Accompaniment plus Time Breakfast", () => {
    expect(ids(breakfastChutneyPool(ctx, "weekdayBreakfast"))).toEqual([43]);
  });

  it("keys the egg-rider pool on Time Breakfast plus Category Keto plus HP", () => {
    expect(ids(breakfastEggRiderPool(ctx, "weekdayBreakfast"))).toEqual([44]);
  });

  it("admits egg mains and light grain mains to the Thursday anchor pool, and nothing else", () => {
    // §4 anchor 2, adversarial: the chilla is a light main but carries a chutney, so it
    // has no room for the eggs; the fruit bowl and the bare paratha are not mains at all.
    const pool = thursdayEggBreakfastPool(ctx, (value) => value, "weekdayBreakfast");
    expect(ids(pool)).toEqual([41, 44, 45]);
  });
});

describe("v6 pools: §5.1 lunch pools", () => {
  const gravyStar = makeDish({ id: 50, category: "Gravy dish", tags: ["HP"] });
  const dal = makeDish({ id: 51, category: "Gravy dish", primaryIngredient: "Toor Dal" });
  const keto = makeDish({ id: 52, category: "Keto", tags: ["HP"], primaryIngredient: "Fish" });
  const completeMeal = makeDish({ id: 53, category: "Complete meal", tags: ["complete_meal"] });
  const hpSalad = makeDish({ id: 54, category: "Accompaniment", tags: ["HP"] });
  const raita = makeDish({ id: 55, category: "Accompaniment", primaryIngredient: "Curd" });
  const sabzi = makeDish({ id: 56, category: "Dry dish", primaryIngredient: "Okra" });
  const soyaGravy = makeDish({
    id: 57,
    category: "Gravy dish",
    tags: ["HP"],
    primaryIngredient: "Soyabean Chunk",
  });
  const soyaKeto = makeDish({
    id: 58,
    category: "Keto",
    tags: ["HP"],
    primaryIngredient: "Soyabean Chunk",
  });
  const completeKeto = makeDish({
    id: 59,
    category: "Keto",
    tags: ["HP", "complete_meal"],
    primaryIngredient: "Chicken",
  });

  const library = [
    gravyStar,
    dal,
    keto,
    completeMeal,
    hpSalad,
    raita,
    sabzi,
    soyaGravy,
    soyaKeto,
    completeKeto,
  ];
  const ctx = makeContext(
    library,
    library.map((dish) => ({
      id: dish.id,
      eaten: { weekdayLunch: 2 },
      rate: { weekdayLunch: 0.2 },
    })),
    library.map((dish) => [dish.id, "weekdayLunch", 0.3] as [number, Scope, number]),
  );

  it("admits dal and complete meals as stars and never an Accompaniment", () => {
    // §5.1, adversarial: dish 54 is an HP-tagged salad. HP alone must not make a star.
    expect(ids(lunchStarPool(ctx, "weekdayLunch"))).toEqual([50, 51, 52, 53, 57, 58, 59]);
  });

  it("draws companions from Gravy dish, Dry dish, and Accompaniment", () => {
    expect(ids(lunchCompanionPool(ctx, "weekdayLunch"))).toEqual([50, 51, 54, 55, 56, 57]);
  });

  it("excludes gravies, complete meals, and soya from the protein floor pool", () => {
    // §5.1 and §13, adversarial: dish 57 is an HP soya gravy, dish 58 an HP soya Keto
    // dish that clears the category restriction, and dish 59 an HP Keto complete meal.
    // Only the plain fish Keto dish may satisfy the floor.
    expect(ids(proteinFloorPool(ctx, "weekdayLunch"))).toEqual([52]);
    expect(isPlainProtein(soyaKeto)).toBe(true);
    expect(isPlainProtein(completeKeto)).toBe(false);
  });

  it("draws dry-protein partners from Category Keto or Dry dish, HP or Keto", () => {
    // §5.1: never a gravy, never a complete meal. Soya is not excluded here; only the
    // protein floor carries the §13 restriction.
    expect(ids(dryProteinPartnerPool(ctx, "weekdayLunch"))).toEqual([52, 58]);
  });
});

describe("v6 pools: carb affinity (docs/engine.md §3.1)", () => {
  const roti = makeDish({ id: 60, category: "Chapati", primaryIngredient: "Wheat Flour" });
  const missiRoti = makeDish({ id: 61, category: "Chapati", primaryIngredient: "Chickpea" });
  const rice = makeDish({ id: 62, category: "Rice", primaryIngredient: "Rice" });
  const steamedRice = makeDish({
    id: 63,
    category: "Rice",
    tags: ["cuisine_neutral"],
    primaryIngredient: "Rice",
  });

  const library = [roti, missiRoti, rice, steamedRice];
  const ctx = makeContext(
    library,
    library.map((dish) => ({
      id: dish.id,
      eaten: { weekdayLunch: 3 },
      rate: { weekdayLunch: 0.3 },
    })),
    library.map((dish) => [dish.id, "weekdayLunch", 0.2] as [number, Scope, number]),
  );

  it("sends a Rice-affinity lead to the Rice pool and everything else to Chapati", () => {
    const riceLead = makeDish({ id: 64, category: "Gravy dish", carbAffinity: "Rice" });
    const rotiLead = makeDish({ id: 65, category: "Gravy dish", carbAffinity: "Roti" });
    const defaultLead = makeDish({ id: 66, category: "Gravy dish" });
    expect(ids(carbPoolForLead(ctx, riceLead))).toEqual([62, 63]);
    expect(ids(carbPoolForLead(ctx, rotiLead))).toEqual([60, 61]);
    expect(ids(carbPoolForLead(ctx, defaultLead))).toEqual([60, 61]);
  });

  it("gives an international lead only the register-neutral rice, and only on Rice affinity", () => {
    const thaiCurry = makeDish({
      id: 67,
      category: "Gravy dish",
      cuisine: "Thai",
      tags: ["HP"],
      carbAffinity: "Rice",
    });
    const thaiDry = makeDish({ id: 68, category: "Dry dish", cuisine: "Thai", tags: ["HP"] });
    expect(ids(carbPoolForLead(ctx, thaiCurry))).toEqual([63]);
    expect(ids(carbPoolForLead(ctx, thaiDry))).toEqual([]);
  });

  it("ranks both affinity pools together for the repair provider", () => {
    expect(ids(carbPool(ctx, "weekdayLunch"))).toEqual([60, 61, 62, 63]);
  });
});

describe("v6 pools: §5.4 Saturday pools", () => {
  const saturdayTreat = makeDish({
    id: 70,
    category: "Complete meal",
    tags: ["complete_meal", "HP"],
  });
  const weekdayOnlyCompleteMeal = makeDish({
    id: 71,
    category: "Complete meal",
    tags: ["complete_meal"],
  });
  const khichdi = makeDish({
    id: 72,
    category: "Complete meal",
    tags: ["complete_meal"],
    primaryIngredient: "Moong Dal",
  });
  const hpPulao = makeDish({
    id: 73,
    category: "Complete meal",
    tags: ["complete_meal", "HP"],
    primaryIngredient: "Chicken Keema",
  });
  const dessert = makeDish({ id: 74, category: "Dessert" });
  const muttonFry = makeDish({
    id: 75,
    category: "Dry dish",
    tags: ["HP"],
    primaryIngredient: "Mutton",
  });
  const raita = makeDish({ id: 76, category: "Accompaniment", primaryIngredient: "Curd" });

  const library = [
    saturdayTreat,
    weekdayOnlyCompleteMeal,
    khichdi,
    hpPulao,
    dessert,
    muttonFry,
    raita,
  ];
  const ctx = makeContext(
    library,
    [
      { id: 70, eaten: { saturday: 2 }, rate: { saturday: 0.25 } },
      // Weekday rows only: never eaten on a Saturday.
      { id: 71, eaten: { weekdayLunch: 4 }, rate: { weekdayLunch: 0.1 } },
      { id: 72, eaten: { weekdayLunch: 3 }, rate: { weekdayLunch: 0.075 } },
      { id: 73, eaten: { weekdayLunch: 2 }, rate: { weekdayLunch: 0.05 } },
      { id: 74, eaten: { saturday: 6 }, rate: { saturday: 0.75 } },
      { id: 75, eaten: { saturday: 1 }, rate: { saturday: 0.125 } },
      { id: 76, eaten: { saturday: 4 }, rate: { saturday: 0.5 } },
    ],
    [
      [70, "saturday", 0.4],
      [71, "saturday", 5],
      [71, "weekdayLunch", 0.4],
      [72, "weekdayLunch", 0.3],
      [73, "weekdayLunch", 0.3],
      [74, "saturday", 0.6],
      [75, "saturday", 0.2],
      [76, "saturday", 0.1],
    ],
  );

  it("excludes weekday-only complete meals from the Saturday treat pool", () => {
    // §2.2, adversarial: dish 71 is a complete meal with the largest Saturday deficit
    // in the ledger, but the record shows it only at weekday lunch, so the Saturday
    // scope does not hold it.
    expect(ids(saturdayTreatPool(ctx))).toEqual([70, 75]);
    expect(ids(saturdayTreatPool(ctx))).not.toContain(71);
  });

  it("keys the everyday base on the complete-meal signal, Indian cuisine, and no HP tag", () => {
    // §5.4: an HP pulao already carries its own protein and needs no elevation. The
    // pool is weekday-scoped on purpose: the form lifts an everyday plate onto Saturday.
    expect(ids(everydayBasePool(ctx))).toEqual([71, 72]);
    expect(isEverydayBase(hpPulao)).toBe(false);
  });

  it("draws the special protein and the accompaniment from the Saturday scope", () => {
    expect(ids(specialProteinPool(ctx))).toEqual([75]);
    expect(ids(saturdayAccompanimentPool(ctx))).toEqual([76]);
    expect(ids(dessertPool(ctx, "saturday"))).toEqual([74]);
  });
});

describe("v6 pools: §9 fruit", () => {
  const mango = makeDish({
    id: 80,
    category: "Fruit",
    time: "Breakfast",
    tags: ["fruit"],
    seasons: ["Summer"],
  });
  const banana = makeDish({ id: 81, category: "Fruit", time: "Breakfast", tags: ["fruit"] });
  const papaya = makeDish({ id: 82, category: "Fruit", time: "Breakfast", tags: ["fruit"] });
  const winterOnly = makeDish({
    id: 83,
    category: "Fruit",
    time: "Breakfast",
    tags: ["fruit"],
    seasons: ["Winter"],
  });

  const library = [mango, banana, papaya, winterOnly];
  const ctx = makeContext(
    library,
    [
      {
        id: 80,
        eaten: { fruit: 11 },
        rate: { fruit: 0.23 },
        seasonCount: { Summer: 11 },
        lastEatenWeek: "2026-08-24",
      },
      {
        id: 81,
        eaten: { fruit: 4 },
        rate: { fruit: 0.08 },
        seasonCount: { Summer: 4 },
        lastEatenWeek: "2026-07-06",
      },
      // Eaten only in the Monsoon: absent from a Summer fruit pool.
      {
        id: 82,
        eaten: { fruit: 3 },
        rate: { fruit: 0.06 },
        seasonCount: { Monsoon: 3 },
        lastEatenWeek: "2026-06-01",
      },
    ],
    [
      [80, "fruit", -0.2],
      [81, "fruit", -0.1],
      [82, "fruit", 4],
    ],
  );

  it("gates the repertoire pool on season presence, not on scope presence", () => {
    expect(ids(fruitPool(ctx))).toEqual([81, 80]);
  });

  it("admits candidates to the overflow pool, ordered by least recently served", () => {
    // §9: never-served counts as oldest, then oldest last-eaten week, then dish id.
    // Dish 83 is out of season and stays out even of the overflow pool.
    expect(ids(fruitOverflowPool(ctx))).toEqual([82, 81, 80]);
  });
});

describe("v6 pools: §3.2 fill rules", () => {
  const roti = makeDish({ id: 90, category: "Chapati", primaryIngredient: "Wheat Flour" });
  const missiRoti = makeDish({ id: 91, category: "Chapati", primaryIngredient: "Chickpea" });
  const bajraRoti = makeDish({
    id: 92,
    category: "Chapati",
    primaryIngredient: "Pearl Millet Flour",
  });

  // The exhausted carb pool: every deficit non-positive. Missi roti is the LEAST
  // negative, plain roti is the most negative and by far the highest rate.
  const exhausted: PoolEntry[] = [
    { dish: missiRoti, deficit: -0.05, rate: 0.05 },
    { dish: bajraRoti, deficit: -0.1, rate: 0.05 },
    { dish: roti, deficit: -1.4, rate: 1.6 },
  ];

  it("fills an exhausted pool with the highest-rate dish, not the least-negative deficit", () => {
    // §3.2's workhorse fallback. Adversarial: ranking by deficit would hand the slot to
    // missi roti, which is what the debate measured at +76 percent over its own rate.
    const fill = fillStructuralWithOrigin(exhausted, new Set());
    expect(fill?.entry.dish.id).toBe(90);
    expect(fill?.origin).toBe("fallback");
  });

  it("skips a workhorse already placed this week and takes the next highest rate", () => {
    expect(fillStructural(exhausted, new Set([90]))?.dish.id).toBe(91);
  });

  it("takes the top positive deficit even when a lower-ranked dish has a higher rate", () => {
    const pool: PoolEntry[] = [
      { dish: missiRoti, deficit: 0.6, rate: 0.05 },
      { dish: roti, deficit: -1.4, rate: 1.6 },
    ];
    const fill = fillStructuralWithOrigin(pool, new Set());
    expect(fill?.entry.dish.id).toBe(91);
    expect(fill?.origin).toBe("deficit");
  });

  it("returns null on an empty structural pool", () => {
    expect(fillStructural([], new Set())).toBeNull();
  });

  it("fills an optional slot only on a positive deficit", () => {
    // §3.2: "ceilings, never targets". A zero deficit is not positive.
    expect(fillOptional(exhausted)).toBeNull();
    expect(fillOptional([{ dish: roti, deficit: 0, rate: 1.6 }])).toBeNull();
    expect(fillOptional([{ dish: roti, deficit: 0.01, rate: 1.6 }])?.dish.id).toBe(90);
    expect(fillOptional([])).toBeNull();
  });
});

describe("v6 pools: the provider and the international predicates", () => {
  const pasta = makeDish({
    id: 100,
    category: "Complete meal",
    tags: ["complete_meal"],
    cuisine: "Italian",
    primaryIngredient: "Pasta",
  });
  const thaiCurry = makeDish({ id: 101, category: "Gravy dish", tags: ["HP"], cuisine: "Thai" });
  const biryani = makeDish({ id: 102, category: "Complete meal", tags: ["complete_meal", "HP"] });
  const caprese = makeDish({ id: 103, category: "Accompaniment", cuisine: "Italian" });

  it("separates the carb-forward international register from Indian complete plates", () => {
    // §5.1: keyed on cuisine plus the self-sufficient-main signal, never on names.
    expect(isCarbForwardInternational(pasta)).toBe(true);
    expect(isCarbForwardInternational(biryani)).toBe(false);
    expect(isCarbForwardInternational(thaiCurry)).toBe(false);
  });

  it("counts every non-Indian star against the §5.3 ceiling, but never an accompaniment", () => {
    expect(isInternationalStar(pasta)).toBe(true);
    expect(isInternationalStar(thaiCurry)).toBe(true);
    expect(isInternationalStar(biryani)).toBe(false);
    expect(isInternationalStar(caprese)).toBe(false);
  });

  it("serves each role from its own pool and honours the exclusion set", () => {
    const chutney = makeDish({ id: 104, category: "Accompaniment", time: "Breakfast" });
    const eggs = makeDish({
      id: 105,
      category: "Keto",
      time: "Breakfast",
      tags: ["HP"],
      primaryIngredient: "Egg",
    });
    const library = [pasta, thaiCurry, biryani, caprese, chutney, eggs];
    const ctx = makeContext(
      library,
      library.map((dish) => ({
        id: dish.id,
        eaten: { weekdayLunch: 2, weekdayBreakfast: 2, saturday: 1 },
        rate: { weekdayLunch: 0.2, weekdayBreakfast: 0.2, saturday: 0.125 },
      })),
      library.flatMap(
        (dish) =>
          [
            [dish.id, "weekdayLunch", 0.3],
            [dish.id, "weekdayBreakfast", 0.3],
          ] as Array<[number, Scope, number]>,
      ),
    );
    const provider = poolProvider(ctx);
    expect(ids(provider("star", "weekdayLunch", new Set()))).toEqual([100, 101, 102, 105]);
    expect(ids(provider("star", "weekdayLunch", new Set([101])))).toEqual([100, 102, 105]);
    // §5.2 allows exactly two things in the small-item position, so the provider
    // returns the chutneys and the egg riders together.
    expect(ids(provider("breakfast-small", "weekdayBreakfast", new Set()))).toEqual([104, 105]);
  });
});
