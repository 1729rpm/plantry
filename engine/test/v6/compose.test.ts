import { describe, it, expect } from "vitest";
import type { Dish, Season } from "../../src/data/schemas.js";
import type { DishStats, Ledger, RecordStats, Scope } from "../../src/v6/types.js";
import type { PoolContext, PoolEntry } from "../../src/v6/pools.js";
import { poolProvider } from "../../src/v6/pools.js";
import {
  applyDayProteinFloor,
  composeBreakfast,
  composeSaturday,
  composeWeekdayLunch,
  countWeekdayInternationalStars,
  demoteCrossMealRepeats,
  lunchFormFor,
  proteinFamily,
  repairPrepCeiling,
  saturdayFormFor,
  satisfiesProteinFloor,
  WEEKDAY_INTERNATIONAL_STAR_CEILING,
} from "../../src/v6/compose.js";
import type { DayPlates, Plate } from "../../src/v6/compose.js";

// ---------------------------------------------------------------------------
// Fixture builders. Constructed by hand so a content change can never turn a
// rule test green (or red).
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
      lastEatenWeek: "2026-06-01",
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

/**
 * Build a pool context in which every library dish is present in every scope, then
 * override the deficits that matter. `deficits` is keyed `dishId:scope`, and a dish
 * with no entry sits at zero, which the optional rule reads as "not due".
 */
function makeContext(
  library: Dish[],
  deficits: Record<string, number>,
  rates: Record<string, number> = {},
): PoolContext {
  const stats = makeStats(
    library.map((dish) => ({
      id: dish.id,
      eaten: { weekdayBreakfast: 2, weekdayLunch: 2, saturday: 1, fruit: 1 },
      rate: {
        weekdayBreakfast: rates[`${dish.id}:weekdayBreakfast`] ?? 0.05,
        weekdayLunch: rates[`${dish.id}:weekdayLunch`] ?? 0.05,
        saturday: rates[`${dish.id}:saturday`] ?? 0.05,
        fruit: rates[`${dish.id}:fruit`] ?? 0.05,
      },
      seasonCount: { Summer: 1 },
    })),
  );
  const ledger: Ledger = { deficits: new Map(Object.entries(deficits)) };
  return { library, season: "Summer", stats, ledger };
}

const dishIds = (plate: Plate): number[] => plate.picks.map((pick) => pick.dishId);
const roleOf = (plate: Plate, dishId: number): string | undefined =>
  plate.picks.find((pick) => pick.dishId === dishId)?.role;
const byId = (library: Dish[]): Map<number, Dish> => new Map(library.map((d) => [d.id, d]));

// ---------------------------------------------------------------------------
// §5.1 weekday lunch
// ---------------------------------------------------------------------------

describe("compose: §5.1 one gravy per lunch, hard and with no fallback", () => {
  const gravyStar = makeDish({ id: 1, category: "Gravy dish", tags: ["HP"] });
  const dalCompanion = makeDish({ id: 2, category: "Gravy dish", primaryIngredient: "Toor Dal" });
  const kadhiCompanion = makeDish({ id: 3, category: "Gravy dish", primaryIngredient: "Curd" });
  const roti = makeDish({ id: 4, category: "Chapati", primaryIngredient: "Wheat Flour" });
  const sabzi = makeDish({ id: 5, category: "Dry dish", primaryIngredient: "Okra" });

  it("leaves the plate a companion short rather than adding a second gravy", () => {
    // Adversarial: both gravy companions carry large positive deficits and the only
    // non-gravy companion is not due at all. A fallback of any kind would produce the
    // two-gravy plate the household kept deleting.
    const library = [gravyStar, dalCompanion, kadhiCompanion, roti];
    const ctx = makeContext(library, {
      "2:weekdayLunch": 5,
      "3:weekdayLunch": 4,
      "4:weekdayLunch": 1,
    });
    const plate = composeWeekdayLunch({ lead: gravyStar, ctx, placedThisWeek: new Set() });
    expect(dishIds(plate)).toEqual([1, 4]);
  });

  it("still takes a non-gravy companion beside a gravy star", () => {
    const library = [gravyStar, dalCompanion, kadhiCompanion, roti, sabzi];
    const ctx = makeContext(library, {
      "2:weekdayLunch": 5,
      "3:weekdayLunch": 4,
      "4:weekdayLunch": 1,
      "5:weekdayLunch": 0.5,
    });
    const plate = composeWeekdayLunch({ lead: gravyStar, ctx, placedThisWeek: new Set() });
    expect(dishIds(plate)).toEqual([1, 4, 5]);
    expect(roleOf(plate, 5)).toBe("companion");
  });

  it("admits one gravy companion beside a dry-dish star", () => {
    const dryStar = makeDish({
      id: 6,
      category: "Dry dish",
      tags: ["HP"],
      primaryIngredient: "Fish",
    });
    const library = [dryStar, dalCompanion, roti];
    const ctx = makeContext(library, { "2:weekdayLunch": 5, "4:weekdayLunch": 1 });
    const plate = composeWeekdayLunch({ lead: dryStar, ctx, placedThisWeek: new Set() });
    expect(dishIds(plate)).toEqual([6, 4, 2]);
  });
});

describe("compose: §5.1 carb-forward international mains", () => {
  const pasta = makeDish({
    id: 10,
    name: "Penne arrabbiata",
    category: "Complete meal",
    tags: ["complete_meal"],
    cuisine: "Italian",
    primaryIngredient: "Pasta",
  });
  const grilledChicken = makeDish({
    id: 11,
    category: "Keto",
    tags: ["HP", "cuisine_neutral"],
    primaryIngredient: "Chicken Breast",
  });
  const gravyProtein = makeDish({
    id: 12,
    category: "Gravy dish",
    tags: ["HP"],
    primaryIngredient: "Chicken",
  });
  const caprese = makeDish({ id: 13, category: "Accompaniment", cuisine: "Italian" });
  const roti = makeDish({ id: 14, category: "Chapati", primaryIngredient: "Wheat Flour" });

  const library = [pasta, grilledChicken, gravyProtein, caprese, roti];

  it("never serves the main solo and never partners it with a gravy", () => {
    // Adversarial: the gravy chicken carries the largest deficit in the pool, the
    // salad is due, and the roti is due. §5.1 admits exactly one dry protein and
    // nothing else, so the plate must be the pasta plus the grilled chicken.
    const ctx = makeContext(library, {
      "11:weekdayLunch": 0.2,
      "12:weekdayLunch": 9,
      "13:weekdayLunch": 5,
      "14:weekdayLunch": 5,
    });
    const plate = composeWeekdayLunch({ lead: pasta, ctx, placedThisWeek: new Set() });
    expect(lunchFormFor(pasta)).toBe("carb-forward-international");
    expect(dishIds(plate)).toEqual([10, 11]);
    expect(roleOf(plate, 11)).toBe("partner");
  });

  it("fills the partner from the workhorse fallback when no dry protein is due", () => {
    // §3.2: the partner position is structural, so an exhausted pool still fills.
    const ctx = makeContext(
      library,
      { "11:weekdayLunch": -3, "12:weekdayLunch": 9 },
      { "11:weekdayLunch": 0.4 },
    );
    const plate = composeWeekdayLunch({ lead: pasta, ctx, placedThisWeek: new Set() });
    expect(dishIds(plate)).toEqual([10, 11]);
    expect(plate.picks[1].origin).toBe("fallback");
  });
});

describe("compose: §5.1 true complete plates", () => {
  const biryani = makeDish({
    id: 20,
    category: "Complete meal",
    tags: ["complete_meal", "HP"],
    primaryIngredient: "Chicken",
  });
  const raita = makeDish({ id: 21, category: "Accompaniment", primaryIngredient: "Curd" });
  const sabzi = makeDish({ id: 22, category: "Dry dish", primaryIngredient: "Okra" });
  const dal = makeDish({ id: 23, category: "Gravy dish", primaryIngredient: "Toor Dal" });
  const roti = makeDish({ id: 24, category: "Chapati", primaryIngredient: "Wheat Flour" });
  const library = [biryani, raita, sabzi, dal, roti];

  it("takes at most one Category Accompaniment companion, never a sabzi or a dal", () => {
    // Adversarial: the sabzi and the dal both out-rank the raita on deficit, and the
    // roti is due. A complete plate takes no carb and only a small Accompaniment.
    const ctx = makeContext(library, {
      "21:weekdayLunch": 0.5,
      "22:weekdayLunch": 8,
      "23:weekdayLunch": 7,
      "24:weekdayLunch": 6,
    });
    const plate = composeWeekdayLunch({ lead: biryani, ctx, placedThisWeek: new Set() });
    expect(lunchFormFor(biryani)).toBe("complete");
    expect(dishIds(plate)).toEqual([20, 21]);
  });

  it("stays solo when its accompaniment is not due", () => {
    const ctx = makeContext(library, { "21:weekdayLunch": -0.2, "22:weekdayLunch": 8 });
    expect(dishIds(composeWeekdayLunch({ lead: biryani, ctx, placedThisWeek: new Set() }))).toEqual(
      [20],
    );
  });
});

describe("compose: the standard plate's carb and companion", () => {
  const kadhi = makeDish({
    id: 30,
    category: "Gravy dish",
    carbAffinity: "Rice",
    primaryIngredient: "Curd",
  });
  const rice = makeDish({ id: 31, category: "Rice", primaryIngredient: "Rice" });
  const roti = makeDish({ id: 32, category: "Chapati", primaryIngredient: "Wheat Flour" });
  const missiRoti = makeDish({ id: 33, category: "Chapati", primaryIngredient: "Chickpea" });
  const library = [kadhi, rice, roti, missiRoti];

  it("sends a Rice-affinity star to the Rice pool", () => {
    const ctx = makeContext(library, { "31:weekdayLunch": 0.1, "32:weekdayLunch": 9 });
    expect(dishIds(composeWeekdayLunch({ lead: kadhi, ctx, placedThisWeek: new Set() }))).toEqual([
      30, 31,
    ]);
  });

  it("falls back to plain roti, not missi roti, when the carb pool is exhausted", () => {
    // §3.2's workhorse fallback, adversarial: missi roti has the LEAST negative deficit
    // and would win a deficit ranking; plain roti is the household's workhorse carb.
    const dal = makeDish({ id: 34, category: "Gravy dish", primaryIngredient: "Toor Dal" });
    const ctx = makeContext(
      [dal, roti, missiRoti],
      { "32:weekdayLunch": -1.4, "33:weekdayLunch": -0.05 },
      { "32:weekdayLunch": 1.6, "33:weekdayLunch": 0.05 },
    );
    const plate = composeWeekdayLunch({ lead: dal, ctx, placedThisWeek: new Set() });
    expect(dishIds(plate)).toEqual([34, 32]);
    expect(plate.picks[1].origin).toBe("fallback");
  });

  it("keeps an international standard plate in one cuisine register", () => {
    // `docs/engine.md` §3: a companion is eligible only when it shares the lead's
    // cuisine or is `cuisine_neutral`. Adversarial: the Indian sabzi is far more due.
    const thaiCurry = makeDish({
      id: 35,
      category: "Gravy dish",
      cuisine: "Thai",
      tags: ["HP"],
      carbAffinity: "Rice",
      primaryIngredient: "Chicken",
    });
    const steamedRice = makeDish({
      id: 36,
      category: "Rice",
      tags: ["cuisine_neutral"],
      primaryIngredient: "Rice",
    });
    const thaiSalad = makeDish({ id: 37, category: "Accompaniment", cuisine: "Thai" });
    const indianSabzi = makeDish({ id: 38, category: "Dry dish", primaryIngredient: "Okra" });
    const ctx = makeContext([thaiCurry, steamedRice, thaiSalad, indianSabzi, rice], {
      "36:weekdayLunch": 0.2,
      "37:weekdayLunch": 0.3,
      "38:weekdayLunch": 9,
      "31:weekdayLunch": 9,
    });
    const plate = composeWeekdayLunch({ lead: thaiCurry, ctx, placedThisWeek: new Set() });
    expect(dishIds(plate)).toEqual([35, 36, 37]);
  });

  it("seats a pinned favorite and does not fill its role twice", () => {
    const dal = makeDish({ id: 39, category: "Gravy dish", primaryIngredient: "Toor Dal" });
    const ctx = makeContext([dal, roti, missiRoti], {
      "32:weekdayLunch": 9,
      "33:weekdayLunch": 8,
    });
    const plate = composeWeekdayLunch({
      lead: dal,
      ctx,
      placedThisWeek: new Set(),
      prePlaced: [{ dish: missiRoti, role: "carb", origin: "favorite" }],
    });
    expect(dishIds(plate)).toEqual([39, 33]);
    expect(plate.picks[1].origin).toBe("favorite");
  });
});

// ---------------------------------------------------------------------------
// §5.2 weekday breakfast
// ---------------------------------------------------------------------------

describe("compose: §5.2 the dish-driven breakfast chutney", () => {
  const paratha = makeDish({
    id: 40,
    category: "Paratha",
    time: "Breakfast",
    tags: ["complete_carb"],
    primaryIngredient: "Potato",
  });
  const sevai = makeDish({
    id: 41,
    category: "Complete meal",
    time: "Breakfast",
    tags: ["complete_meal"],
    primaryIngredient: "Rice Vermicelli",
  });
  const chutney = makeDish({
    id: 42,
    category: "Accompaniment",
    time: "Breakfast",
    primaryIngredient: "Mint Leaf",
  });
  const boiledEggs = makeDish({
    id: 43,
    category: "Keto",
    time: "Breakfast",
    tags: ["HP", "cuisine_neutral"],
    primaryIngredient: "Egg",
  });
  const library = [paratha, sevai, chutney, boiledEggs];

  it("gives a paratha its chutney even when no chutney is due", () => {
    // Adversarial: the chutney's deficit is deeply negative. The chutney is structural,
    // not optional, so a paratha is never served without one.
    const ctx = makeContext(library, { "42:weekdayBreakfast": -2 });
    const plate = composeBreakfast({ lead: paratha, ctx, placedThisWeek: new Set() });
    expect(dishIds(plate)).toEqual([40, 42]);
    expect(plate.picks[1].origin).toBe("structural");
    expect(plate.picks[1].role).toBe("breakfast-small");
  });

  it("never gives a sevai a chutney, however due the chutney is", () => {
    // Adversarial the other way: a large positive chutney deficit. §13 retired the
    // optional chutney slot, so a grain main takes no chutney at any deficit.
    const ctx = makeContext(library, { "42:weekdayBreakfast": 9, "43:weekdayBreakfast": -1 });
    expect(dishIds(composeBreakfast({ lead: sevai, ctx, placedThisWeek: new Set() }))).toEqual([
      41,
    ]);
  });

  it("gives a standalone boiled-eggs main its chutney", () => {
    const ctx = makeContext(library, { "42:weekdayBreakfast": -2 });
    expect(dishIds(composeBreakfast({ lead: boiledEggs, ctx, placedThisWeek: new Set() }))).toEqual(
      [43, 42],
    );
  });

  it("gives a light grain main the egg rider only when the eggs are due", () => {
    const due = makeContext(library, { "43:weekdayBreakfast": 0.4, "42:weekdayBreakfast": 9 });
    expect(dishIds(composeBreakfast({ lead: sevai, ctx: due, placedThisWeek: new Set() }))).toEqual(
      [41, 43],
    );
    const notDue = makeContext(library, { "43:weekdayBreakfast": -0.4 });
    expect(
      dishIds(composeBreakfast({ lead: sevai, ctx: notDue, placedThisWeek: new Set() })),
    ).toEqual([41]);
  });

  it("takes no rider beside a main that already carries protein", () => {
    const andaBhurji = makeDish({
      id: 44,
      category: "Dry dish",
      time: "Breakfast",
      tags: ["HP"],
      primaryIngredient: "Egg",
    });
    const ctx = makeContext([andaBhurji, chutney, boiledEggs], { "43:weekdayBreakfast": 9 });
    expect(dishIds(composeBreakfast({ lead: andaBhurji, ctx, placedThisWeek: new Set() }))).toEqual(
      [44],
    );
  });

  it("makes the Thursday egg rider structural (§4 anchor 2)", () => {
    // Adversarial: the eggs are deeply negative, so the optional rule would skip them.
    const ctx = makeContext(library, { "43:weekdayBreakfast": -3 });
    const plate = composeBreakfast({
      lead: sevai,
      ctx,
      placedThisWeek: new Set(),
      eggAnchored: true,
      day: "Thu",
    });
    expect(dishIds(plate)).toEqual([41, 43]);
    expect(plate.picks[1].origin).toBe("structural");
    expect(plate.day).toBe("Thu");
  });
});

// ---------------------------------------------------------------------------
// §5.4 Saturday
// ---------------------------------------------------------------------------

describe("compose: §5.4 Saturday", () => {
  const friedRice = makeDish({
    id: 50,
    name: "Thai pineapple fried rice",
    category: "Complete meal",
    tags: ["complete_meal"],
    cuisine: "Thai",
    primaryIngredient: "Rice",
  });
  const fishTikka = makeDish({ id: 51, category: "Keto", tags: ["HP"], primaryIngredient: "Fish" });
  const raita = makeDish({ id: 52, category: "Accompaniment", primaryIngredient: "Curd" });
  const dessert = makeDish({ id: 53, category: "Dessert", primaryIngredient: "Milk" });
  const khichdi = makeDish({
    id: 54,
    category: "Complete meal",
    tags: ["complete_meal"],
    primaryIngredient: "Moong Dal",
  });
  const muttonFry = makeDish({
    id: 55,
    category: "Dry dish",
    tags: ["HP"],
    primaryIngredient: "Mutton",
  });
  const biryani = makeDish({
    id: 56,
    category: "Complete meal",
    tags: ["complete_meal", "HP"],
    primaryIngredient: "Chicken",
  });
  const library = [friedRice, fishTikka, raita, dessert, khichdi, muttonFry, biryani];

  it("gives a carb-forward international treat its dry protein, not the raita", () => {
    // §5.4, adversarial: the raita is far more due than the fish tikka. The dry-protein
    // partner takes the accompaniment slot with precedence over salad, raita, and hummus.
    const ctx = makeContext(library, {
      "51:saturday": 0.1,
      "52:saturday": 9,
      "53:saturday": 0.5,
    });
    const plate = composeSaturday({ lead: friedRice, ctx, placedThisWeek: new Set() });
    expect(saturdayFormFor(friedRice)).toBe("carb-forward-international");
    expect(dishIds(plate)).toEqual([50, 53, 51]);
    expect(roleOf(plate, 51)).toBe("partner");
    expect(plate.day).toBe("Sat");
  });

  it("elevates an everyday base with a special protein", () => {
    const ctx = makeContext(library, {
      "53:saturday": 0.5,
      "55:saturday": 0.2,
      "52:saturday": 9,
    });
    const plate = composeSaturday({ lead: khichdi, ctx, placedThisWeek: new Set() });
    expect(saturdayFormFor(khichdi)).toBe("everyday-base");
    expect(dishIds(plate)).toEqual([54, 53, 55]);
    expect(roleOf(plate, 55)).toBe("special-protein");
  });

  it("serves the dessert structurally and keeps the accompaniment optional", () => {
    const due = makeContext(library, { "53:saturday": -2, "52:saturday": 0.4 });
    const plate = composeSaturday({ lead: biryani, ctx: due, placedThisWeek: new Set() });
    expect(dishIds(plate)).toEqual([56, 53, 52]);
    expect(plate.picks[1].origin).toBe("fallback");

    const notDue = makeContext(library, { "53:saturday": 0.6, "52:saturday": -0.4 });
    expect(
      dishIds(composeSaturday({ lead: biryani, ctx: notDue, placedThisWeek: new Set() })),
    ).toEqual([56, 53]);
  });

  it("keeps the plate at three items even with a pinned favorite", () => {
    const ctx = makeContext(library, { "53:saturday": 5, "52:saturday": 5, "51:saturday": 5 });
    const plate = composeSaturday({
      lead: friedRice,
      ctx,
      placedThisWeek: new Set(),
      prePlaced: [{ dish: raita, role: "accompaniment", origin: "favorite" }],
    });
    expect(plate.picks.length).toBe(3);
    expect(dishIds(plate)).toEqual([50, 52, 53]);
  });
});

// ---------------------------------------------------------------------------
// §5.1 the day-scoped protein floor
// ---------------------------------------------------------------------------

describe("compose: §5.1 the day-scoped protein floor", () => {
  const dal = makeDish({ id: 60, category: "Gravy dish", primaryIngredient: "Toor Dal" });
  const roti = makeDish({ id: 61, category: "Chapati", primaryIngredient: "Wheat Flour" });
  const sabzi = makeDish({ id: 62, category: "Dry dish", primaryIngredient: "Okra" });
  const chickenBreast = makeDish({
    id: 63,
    category: "Keto",
    tags: ["HP"],
    primaryIngredient: "Chicken Breast",
  });
  const chickenGravy = makeDish({
    id: 64,
    category: "Gravy dish",
    tags: ["HP"],
    primaryIngredient: "Chicken",
  });
  const soyaMasala = makeDish({
    id: 65,
    category: "Gravy dish",
    tags: ["HP"],
    primaryIngredient: "Soyabean Chunk",
  });
  const poha = makeDish({
    id: 66,
    category: "Complete meal",
    time: "Breakfast",
    tags: ["complete_meal"],
    primaryIngredient: "Flattened Rice",
  });
  const boiledEggs = makeDish({
    id: 67,
    category: "Keto",
    time: "Breakfast",
    tags: ["HP"],
    primaryIngredient: "Egg",
  });
  const library = [dal, roti, sabzi, chickenBreast, chickenGravy, soyaMasala, poha, boiledEggs];
  const dishById = byId(library);

  const vegLunch = (ctx: PoolContext): Plate =>
    composeWeekdayLunch({ lead: dal, ctx, placedThisWeek: new Set() });

  it("fires when neither meal of the day carries protein", () => {
    const ctx = makeContext(library, { "61:weekdayLunch": 1, "63:weekdayLunch": 0.3 });
    const breakfast = composeBreakfast({ lead: poha, ctx, placedThisWeek: new Set() });
    const result = applyDayProteinFloor({
      breakfast,
      lunch: vegLunch(ctx),
      ctx,
      placedThisWeek: new Set(),
      dishById,
    });
    expect(result.appended?.id).toBe(63);
    expect(result.lunch.picks[result.lunch.picks.length - 1].role).toBe("floor");
  });

  it("does not fire when the day's breakfast carries the protein", () => {
    // §5.1: day-scoped, not per lunch. Adversarial: the lunch itself is meat-free.
    const ctx = makeContext(library, {
      "61:weekdayLunch": 1,
      "63:weekdayLunch": 5,
      "67:weekdayBreakfast": 0.4,
    });
    const breakfast = composeBreakfast({ lead: poha, ctx, placedThisWeek: new Set() });
    expect(dishIds(breakfast)).toEqual([66, 67]);
    const result = applyDayProteinFloor({
      breakfast,
      lunch: vegLunch(ctx),
      ctx,
      placedThisWeek: new Set(),
      dishById,
    });
    expect(result.appended).toBeNull();
  });

  it("is not satisfied by a soya HP dish, and never appends a gravy", () => {
    // §13: soya chunks masala's HP tag does not satisfy the floor. Adversarial: the
    // day's lunch star IS the soya gravy, and the most due protein is a chicken gravy.
    const ctx = makeContext(library, {
      "61:weekdayLunch": 1,
      "64:weekdayLunch": 9,
      "63:weekdayLunch": 0.3,
    });
    expect(satisfiesProteinFloor(soyaMasala)).toBe(false);
    const lunch = composeWeekdayLunch({ lead: soyaMasala, ctx, placedThisWeek: new Set() });
    const result = applyDayProteinFloor({
      breakfast: null,
      lunch,
      ctx,
      placedThisWeek: new Set(),
      dishById,
    });
    expect(result.appended?.id).toBe(63);
    expect(result.appended?.category).not.toBe("Gravy dish");
  });

  it("never fires on Saturday", () => {
    const vegTreat = makeDish({
      id: 68,
      category: "Complete meal",
      tags: ["complete_meal"],
      primaryIngredient: "Mixed Veg",
    });
    const ctx = makeContext([...library, vegTreat], { "63:saturday": 5 });
    const saturday: Plate = {
      meal: "lunch",
      scope: "saturday",
      day: "Sat",
      picks: [{ meal: "lunch", dishId: 68, role: "treat", scope: "saturday", origin: "deficit" }],
    };
    const result = applyDayProteinFloor({
      breakfast: null,
      lunch: saturday,
      ctx,
      placedThisWeek: new Set(),
      dishById: byId([...library, vegTreat]),
    });
    expect(result.appended).toBeNull();
    expect(result.lunch).toBe(saturday);
  });

  it("appends to a full three-item plate, and never past four items", () => {
    const ctx = makeContext(library, {
      "61:weekdayLunch": 1,
      "62:weekdayLunch": 0.5,
      "63:weekdayLunch": 0.3,
    });
    const lunch = vegLunch(ctx);
    expect(lunch.picks.length).toBe(3);
    const result = applyDayProteinFloor({
      breakfast: null,
      lunch,
      ctx,
      placedThisWeek: new Set(),
      dishById,
    });
    expect(result.lunch.picks.length).toBe(4);
    const again = applyDayProteinFloor({
      breakfast: null,
      lunch: result.lunch,
      ctx,
      placedThisWeek: new Set(),
      dishById,
    });
    expect(again.appended).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Cross-meal demotion, the international ceiling, the prep ceiling
// ---------------------------------------------------------------------------

describe("compose: §5.1 cross-meal demotion", () => {
  it("demotes a family repeat below every clean candidate, and an exact repeat below that", () => {
    const chickenGravy = makeDish({ id: 70, primaryIngredient: "Chicken" });
    const chickenKeema = makeDish({ id: 71, primaryIngredient: "Chicken Keema" });
    const paneer = makeDish({ id: 72, primaryIngredient: "Paneer" });
    const pool: PoolEntry[] = [
      { dish: chickenGravy, deficit: 3, rate: 0.2 },
      { dish: chickenKeema, deficit: 2, rate: 0.2 },
      { dish: paneer, deficit: 1, rate: 0.2 },
    ];
    const breakfast = [makeDish({ id: 73, primaryIngredient: "Chicken", time: "Breakfast" })];
    const demoted = demoteCrossMealRepeats(pool, breakfast);
    expect(demoted.map((entry) => entry.dish.id)).toEqual([72, 71, 70]);
  });

  it("collapses chicken cuts into one family and leaves soya alone (§4.6 minus soya)", () => {
    expect(proteinFamily("Chicken Keema")).toBe("Chicken");
    expect(proteinFamily("Chicken Breast")).toBe("Chicken");
    expect(proteinFamily("Soya Chunk")).toBe("Soya Chunk");
    expect(proteinFamily("Paneer")).toBe("Paneer");
  });
});

describe("compose: §5.3 the international ceiling input", () => {
  it("counts weekday international stars and ignores the Saturday treat", () => {
    const pasta = makeDish({
      id: 80,
      category: "Complete meal",
      tags: ["complete_meal"],
      cuisine: "Italian",
    });
    const thai = makeDish({ id: 81, category: "Gravy dish", tags: ["HP"], cuisine: "Thai" });
    const dal = makeDish({ id: 82, category: "Gravy dish", primaryIngredient: "Toor Dal" });
    const capreseCompanion = makeDish({ id: 83, category: "Accompaniment", cuisine: "Italian" });
    const dishById = byId([pasta, thai, dal, capreseCompanion]);
    const plate = (dishId: number, role: "star" | "companion" | "treat", scope: Scope): Plate => ({
      meal: "lunch",
      scope,
      day: null,
      picks: [{ meal: "lunch", dishId, role, scope, origin: "deficit" }],
    });
    const plates = [
      plate(80, "star", "weekdayLunch"),
      plate(81, "star", "weekdayLunch"),
      plate(82, "star", "weekdayLunch"),
      plate(83, "companion", "weekdayLunch"),
      plate(80, "treat", "saturday"),
    ];
    expect(countWeekdayInternationalStars(plates, dishById)).toBe(2);
    expect(WEEKDAY_INTERNATIONAL_STAR_CEILING).toBe(2);
  });
});

describe("compose: §5.1 the whole-day prep ceiling", () => {
  const heavyStar = makeDish({ id: 90, category: "Gravy dish", tags: ["HP"], prepMinutes: 70 });
  const roti = makeDish({
    id: 91,
    category: "Chapati",
    prepMinutes: 15,
    primaryIngredient: "Wheat Flour",
  });
  const longCompanion = makeDish({
    id: 92,
    category: "Dry dish",
    prepMinutes: 45,
    primaryIngredient: "Okra",
  });
  const shortCompanion = makeDish({
    id: 93,
    category: "Accompaniment",
    prepMinutes: 5,
    primaryIngredient: "Curd",
  });
  const breakfastMain = makeDish({
    id: 94,
    category: "Complete meal",
    time: "Breakfast",
    tags: ["complete_meal"],
    prepMinutes: 25,
    primaryIngredient: "Flattened Rice",
  });
  const library = [heavyStar, roti, longCompanion, shortCompanion, breakfastMain];
  const dishById = byId(library);

  const day = (): DayPlates => ({
    day: "Mon" as const,
    breakfast: {
      meal: "breakfast" as const,
      scope: "weekdayBreakfast" as const,
      day: "Mon" as const,
      picks: [
        {
          meal: "breakfast" as const,
          dishId: 94,
          role: "breakfast-main" as const,
          scope: "weekdayBreakfast" as const,
          origin: "deficit" as const,
        },
      ],
    },
    lunch: {
      meal: "lunch" as const,
      scope: "weekdayLunch" as const,
      day: "Mon" as const,
      picks: [
        {
          meal: "lunch" as const,
          dishId: 90,
          role: "star" as const,
          scope: "weekdayLunch" as const,
          origin: "deficit" as const,
        },
        {
          meal: "lunch" as const,
          dishId: 91,
          role: "carb" as const,
          scope: "weekdayLunch" as const,
          origin: "deficit" as const,
        },
        {
          meal: "lunch" as const,
          dishId: 92,
          role: "companion" as const,
          scope: "weekdayLunch" as const,
          origin: "deficit" as const,
        },
      ],
    },
  });

  it("replaces the longest droppable companion with a shorter alternative", () => {
    // 25 + 70 + 15 + 45 = 155 minutes, over the 120 ceiling by 35. Swapping the
    // 45-minute sabzi for the 5-minute raita brings the day to 115.
    const ctx = makeContext(library, { "93:weekdayLunch": 0.2 });
    const result = repairPrepCeiling(day(), poolProvider(ctx), dishById);
    expect(result.plates.lunch.picks.map((pick) => pick.dishId)).toEqual([90, 91, 93]);
    expect(result.plates.lunch.picks.map((pick) => pick.dishId)).toEqual([90, 91, 93]);
    expect(result.repairs).toEqual([
      {
        constraint: "prep-ceiling",
        day: "Mon",
        meal: "lunch",
        removedDishId: 92,
        addedDishId: 93,
        swappedWithDay: null,
      },
    ]);
    expect(result.breach).toBeNull();
  });

  it("takes the longest droppable item first when two compete", () => {
    // Adversarial: the day carries a 10-minute breakfast chutney and a 45-minute
    // sabzi. 25 + 10 + 70 + 15 + 45 = 165. Dropping the short chutney would not clear
    // the ceiling; the rule takes the longest droppable item, so the sabzi goes first.
    const chutney = makeDish({
      id: 96,
      category: "Accompaniment",
      time: "Breakfast",
      prepMinutes: 10,
      primaryIngredient: "Mint Leaf",
    });
    const plates = day();
    plates.breakfast?.picks.push({
      meal: "breakfast" as const,
      dishId: 96,
      role: "breakfast-small" as const,
      scope: "weekdayBreakfast" as const,
      origin: "structural" as const,
    });
    const ctx = makeContext([...library, chutney], {});
    const result = repairPrepCeiling(
      plates,
      poolProvider(ctx),
      new Map([...dishById, [96, chutney]]),
    );
    expect(result.repairs.map((repair) => repair.removedDishId)).toEqual([92]);
    expect(result.plates.lunch.picks.map((pick) => pick.dishId)).toEqual([90, 91]);
    expect(result.plates.breakfast?.picks.map((pick) => pick.dishId)).toEqual([94, 96]);
    expect(result.breach).toBeNull();
  });

  it("drops the companion outright when no shorter alternative fits", () => {
    const ctx = makeContext([heavyStar, roti, longCompanion, breakfastMain], {});
    const result = repairPrepCeiling(day(), poolProvider(ctx), dishById);
    expect(result.plates.lunch.picks.map((pick) => pick.dishId)).toEqual([90, 91]);
    expect(result.repairs[0].addedDishId).toBeNull();
    expect(result.breach).toBeNull();
  });

  it("reports an unrepairable day rather than touching a protected item", () => {
    // §13: a star-replacement repair was considered and rejected. The protected star
    // and carb alone are 145 minutes, so the day is reported, not repaired further.
    const monsterStar = { ...heavyStar, id: 95, prepMinutes: 130 };
    const plates = day();
    plates.lunch.picks[0] = { ...plates.lunch.picks[0], dishId: 95 };
    const ctx = makeContext([...library, monsterStar], {});
    const result = repairPrepCeiling(
      plates,
      poolProvider(ctx),
      new Map([...dishById, [95, monsterStar]]),
    );
    expect(result.plates.lunch.picks.map((pick) => pick.dishId)).toEqual([95, 91]);
    expect(result.breach).toEqual({ day: "Mon", prepMinutes: 170, unrepairable: true });
  });

  it("leaves a day inside the ceiling untouched", () => {
    const plates = day();
    plates.lunch.picks.splice(2, 1);
    const ctx = makeContext(library, {});
    const result = repairPrepCeiling(plates, poolProvider(ctx), dishById);
    expect(result.repairs).toEqual([]);
    expect(result.breach).toBeNull();
    expect(result.plates.lunch.picks.length).toBe(2);
  });
});
