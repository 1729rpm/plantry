/**
 * v6 plate composition (§5, and the §4 anchors it implements).
 *
 * A plate builder takes a lead the selection pass already chose by deficit (a lunch
 * star, a Saturday treat, or a breakfast main), asks `pools.ts` for the rest of the
 * plate's positions, and returns a `Plate`: the meal, its scope, its day when the
 * form fixes one, and its picks in plate order with the role and origin each carries.
 *
 * The module also owns the composition constraints that are decided at plate level
 * rather than at pool level, because they depend on what the lead took: the hard
 * one-gravy-per-lunch rule, the one-HP-per-meal filter on optional positions, the
 * cross-meal protein-family and ingredient demotion, the day-scoped protein floor,
 * the §5.3 international ceiling check, and the §5.1 whole-day prep-ceiling repair.
 *
 * Everything here is pure: inputs are never mutated, no clock and no randomness are
 * read, and every ordering bottoms out at dish id ascending (§10).
 *
 * Section references are to `features/engine-v6.md` unless a reference names
 * `docs/engine.md`, which holds the rules v6 §5 carries forward unchanged.
 */

import type { Dish } from "../data/schemas.js";
import {
  breakfastMainCarriesChutney,
  excludeHpIfMealHasHp,
  isHp,
  isSelfSufficientMain,
} from "../composition.js";
import type {
  ConstraintRepair,
  Day,
  MealKey,
  PickOrigin,
  PickRole,
  PrepCeilingBreach,
  Scope,
} from "./types.js";
import type { Plate } from "./place.js";
import type { PoolContext, PoolEntry, PoolProvider } from "./pools.js";
import {
  breakfastChutneyPool,
  breakfastEggRiderPool,
  carbPoolForLead,
  carriesProtein,
  dessertPool,
  dryProteinPartnerPool,
  excludeIds,
  fillOptional,
  fillStructuralWithOrigin,
  isCarbForwardInternational,
  isEverydayBase,
  isInternationalStar,
  isPlainProtein,
  isSoyaProtein,
  isStandaloneEggMain,
  lunchCompanionPool,
  proteinFloorPool,
  saturdayAccompanimentPool,
  specialProteinPool,
} from "./pools.js";

/**
 * A composed meal before or after day assignment (`day` is null until the §6 step
 * 5 placement pass assigns one; Saturday plates and the Thursday egg-anchored
 * breakfast are created with the day already set, because §4 fixes them).
 *
 * Declared once, in `place.ts`, and re-exported here so a caller that only builds
 * plates needs one import. It lived in both files while streams B and C were built
 * in parallel; `place.ts` is the single home now.
 */
export type { Plate };

/** A pick the caller has already committed to this plate, typically a §8 pinned favorite. */
export interface PrePlacedPick {
  dish: Dish;
  role: PickRole;
  origin: PickOrigin;
}

/** The §5.1 whole-day prep ceiling, in active minutes across breakfast and lunch. */
export const PREP_CEILING_MINUTES = 120;

/** The §5.3 weekly ceiling on weekday international stars. A cap, never a target. */
export const WEEKDAY_INTERNATIONAL_STAR_CEILING = 2;

/** §5.1 item ceilings: three by default, four only when the protein floor appends. */
export const WEEKDAY_LUNCH_DEFAULT_ITEMS = 3;
export const WEEKDAY_LUNCH_MAX_ITEMS = 4;
export const SATURDAY_LUNCH_MAX_ITEMS = 3;

/**
 * The roles the prep-ceiling repair may drop or replace: the optional positions of
 * §3.2. Everything else (the lead, the carb, the dessert, the fruit, and every
 * structural protein) is protected, and a day whose protected items alone exceed the
 * ceiling is reported rather than repaired further (§5.1, §11 threshold 10).
 */
const DROPPABLE_ROLES: ReadonlySet<PickRole> = new Set<PickRole>([
  "companion",
  "breakfast-small",
  "accompaniment",
]);

// ---------------------------------------------------------------------------
// Protein families (docs/engine.md §4.6, minus the soya rows)
// ---------------------------------------------------------------------------

/**
 * The §4.6 protein-family collapse, minus the soya rows §5.1 removes: cuts of the
 * same protein count as one protein for the cross-meal rule, and every other
 * `primaryIngredient` is its own family. Keyed on the ingredient label, never on
 * dish names.
 *
 * The soya rows are dropped deliberately: v6 treats soya chunks masala as a sabzi
 * rather than as the day's protein (§13), so collapsing the soya cuts into one
 * family would suppress an ordinary veg main on protein grounds it does not carry.
 * The exploration governor (stream C) keeps its own copy of this table; the two are
 * deduped after integration.
 */
const PROTEIN_FAMILY: ReadonlyMap<string, string> = new Map([
  ["Chicken", "Chicken"],
  ["Chicken Breast", "Chicken"],
  ["Chicken Keema", "Chicken"],
]);

/** The §4.6 protein family of a `primaryIngredient`; unmapped values are their own family. */
export function proteinFamily(primaryIngredient: string): string {
  return PROTEIN_FAMILY.get(primaryIngredient) ?? primaryIngredient;
}

// ---------------------------------------------------------------------------
// Plate helpers
// ---------------------------------------------------------------------------

function pickOf(dish: Dish, role: PickRole, scope: Scope, meal: MealKey, origin: PickOrigin) {
  return { meal, dishId: dish.id, role, scope, origin };
}

/** The dish ids currently on a plate. */
export function plateDishIds(plate: Plate): Set<number> {
  return new Set(plate.picks.map((pick) => pick.dishId));
}

/** §5.1 one-gravy-per-lunch state: whether the plate already holds a Category Gravy dish. */
export function plateHasGravy(dishes: readonly Dish[]): boolean {
  return dishes.some((dish) => dish.category === "Gravy dish");
}

/** Whether any dish on the plate is HP-tagged (`docs/engine.md` §3 one-HP-per-meal). */
export function plateHasHp(dishes: readonly Dish[]): boolean {
  return dishes.some(isHp);
}

/**
 * §5.1 one-gravy-per-lunch, hard and with no fallback: once a lunch holds a Category
 * Gravy dish, no further position may take one. A plate one companion short beats a
 * two-gravy plate, so this filter never yields to fill a slot, unlike the one-HP rule.
 */
export function excludeGravyIfPlateHasGravy(
  pool: readonly PoolEntry[],
  hasGravy: boolean,
): PoolEntry[] {
  if (!hasGravy) return [...pool];
  return pool.filter((entry) => entry.dish.category !== "Gravy dish");
}

/**
 * `docs/engine.md` §3 one-HP-source-per-meal, applied to a pool of entries. Delegates
 * to the production engine's filter so the thin-pool fallback (an unfiltered pool
 * rather than an unfilled slot) stays single-homed.
 */
export function excludeHpEntriesIfMealHasHp(
  pool: readonly PoolEntry[],
  mealHasHp: boolean,
): PoolEntry[] {
  const kept = new Set(
    excludeHpIfMealHasHp(
      pool.map((entry) => entry.dish),
      mealHasHp,
    ).map((dish) => dish.id),
  );
  return pool.filter((entry) => kept.has(entry.dish.id));
}

/**
 * §5.1 cross-meal demotion: a lunch candidate whose protein family already appears in
 * the same day's breakfast is demoted below all other candidates, and an exact
 * `primaryIngredient` match is demoted below that. If no alternative exists the repeat
 * is allowed, which is why this reorders the pool instead of filtering it.
 *
 * The reorder is stable within each tier, so the §3.2 ranking (deficit descending, id
 * ascending) survives inside each band.
 */
export function demoteCrossMealRepeats(
  pool: readonly PoolEntry[],
  otherMealDishes: readonly Dish[],
): PoolEntry[] {
  if (otherMealDishes.length === 0) return [...pool];
  const families = new Set(otherMealDishes.map((dish) => proteinFamily(dish.primaryIngredient)));
  const ingredients = new Set(otherMealDishes.map((dish) => dish.primaryIngredient));
  const tierOf = (entry: PoolEntry): number => {
    if (ingredients.has(entry.dish.primaryIngredient)) return 2;
    if (families.has(proteinFamily(entry.dish.primaryIngredient))) return 1;
    return 0;
  };
  return pool
    .map((entry, index) => ({ entry, index, tier: tierOf(entry) }))
    .sort((a, b) => a.tier - b.tier || a.index - b.index)
    .map((row) => row.entry);
}

// ---------------------------------------------------------------------------
// Weekday lunch (§5.1, §5.3)
// ---------------------------------------------------------------------------

/** The three weekday lunch forms of §5.1, decided by the lead's own fields. */
export type LunchForm = "standard" | "complete" | "carb-forward-international";

/**
 * Which §5.1 form a lead composes. A non-Indian self-sufficient main is the
 * carb-forward international register (noodles, pasta, fried rice) and takes exactly
 * one dry protein; an Indian self-sufficient main is a true complete plate (biryani,
 * pav bhaji, khichdi, pulao) and stays solo or takes one Accompaniment companion;
 * everything else is the standard star-plus-carb plate.
 */
export function lunchFormFor(lead: Dish): LunchForm {
  if (isCarbForwardInternational(lead)) return "carb-forward-international";
  if (isSelfSufficientMain(lead)) return "complete";
  return "standard";
}

export interface ComposeLunchArgs {
  /** The star, already chosen by deficit. */
  lead: Dish;
  ctx: PoolContext;
  /** Dish ids already placed anywhere in this week's plan (§3.2's workhorse guard). */
  placedThisWeek: ReadonlySet<number>;
  /** Picks the caller has committed to this plate, typically a §8 pinned favorite. */
  prePlaced?: readonly PrePlacedPick[];
  /** Why the lead is here (§6); defaults to an ordinary top-deficit win. */
  leadOrigin?: PickOrigin;
  /**
   * The same day's breakfast dishes, for the §5.1 cross-meal demotion. Omit while the
   * day is still unassigned; the §6 step 6 constraint pass applies the rule again once
   * days are fixed.
   */
  breakfastDishes?: readonly Dish[];
  scope?: Scope;
  day?: Day | null;
}

/**
 * §5.1 weekday lunch: star, carb, and at most one companion, 2 or 3 items and never 4
 * by default. The only way a lunch reaches 4 items is the §5.1 protein floor appending
 * to a full 3-item plate, which `applyDayProteinFloor` does after the day is known.
 */
export function composeWeekdayLunch(args: ComposeLunchArgs): Plate {
  const { lead, ctx, placedThisWeek } = args;
  const scope = args.scope ?? "weekdayLunch";
  const prePlaced = args.prePlaced ?? [];
  const plate: Plate = {
    meal: "lunch",
    scope,
    day: args.day ?? null,
    picks: [pickOf(lead, "star", scope, "lunch", args.leadOrigin ?? "deficit")],
  };
  const onPlate: Dish[] = [lead];
  const filledRoles = new Set<PickRole>(["star"]);
  for (const pre of prePlaced) {
    if (pre.dish.id === lead.id) continue;
    plate.picks.push(pickOf(pre.dish, pre.role, scope, "lunch", pre.origin));
    onPlate.push(pre.dish);
    filledRoles.add(pre.role);
  }

  const form = lunchFormFor(lead);

  if (form === "carb-forward-international") {
    // §5.1: exactly one protein companion in a grilled, tikka, or dry-fry
    // preparation, never a gravy, and nothing else on the plate. No carb: the
    // register's carb is built into the main.
    if (!filledRoles.has("partner")) {
      const pool = excludeIds(dryProteinPartnerPool(ctx, scope), new Set(onPlate.map((d) => d.id)));
      const fill = fillStructuralWithOrigin(pool, placedThisWeek);
      if (fill) {
        plate.picks.push(pickOf(fill.entry.dish, "partner", scope, "lunch", fill.origin));
        onPlate.push(fill.entry.dish);
      }
    }
    return plate;
  }

  if (form === "standard" && !filledRoles.has("carb")) {
    const pool = excludeIds(carbPoolForLead(ctx, lead, scope), new Set(onPlate.map((d) => d.id)));
    const fill = fillStructuralWithOrigin(pool, placedThisWeek);
    if (fill) {
      plate.picks.push(pickOf(fill.entry.dish, "carb", scope, "lunch", fill.origin));
      onPlate.push(fill.entry.dish);
    }
  }

  if (!filledRoles.has("companion") && plate.picks.length < WEEKDAY_LUNCH_DEFAULT_ITEMS) {
    // §5.1: a true complete plate stays solo or takes at most one small companion from
    // Category Accompaniment; the standard plate draws the full companion pool.
    let pool = excludeIds(lunchCompanionPool(ctx, scope), new Set(onPlate.map((d) => d.id)));
    if (form === "complete") {
      pool = pool.filter((entry) => entry.dish.category === "Accompaniment");
    }
    if (lead.cuisine !== "Indian") {
      // `docs/engine.md` §3: the international form keeps one cuisine register, so a
      // companion is eligible only when it shares the lead's cuisine or is neutral.
      pool = pool.filter(
        (entry) =>
          entry.dish.cuisine === lead.cuisine || entry.dish.tags.includes("cuisine_neutral"),
      );
    }
    pool = excludeGravyIfPlateHasGravy(pool, plateHasGravy(onPlate));
    pool = excludeHpEntriesIfMealHasHp(pool, plateHasHp(onPlate));
    pool = demoteCrossMealRepeats(pool, args.breakfastDishes ?? []);
    const companion = fillOptional(pool);
    if (companion) {
      plate.picks.push(pickOf(companion.dish, "companion", scope, "lunch", "deficit"));
      onPlate.push(companion.dish);
    }
  }

  return plate;
}

// ---------------------------------------------------------------------------
// Weekday breakfast (§5.2, §4 anchor 2)
// ---------------------------------------------------------------------------

export interface ComposeBreakfastArgs {
  /** The breakfast main, already chosen by deficit. */
  lead: Dish;
  ctx: PoolContext;
  placedThisWeek: ReadonlySet<number>;
  prePlaced?: readonly PrePlacedPick[];
  leadOrigin?: PickOrigin;
  /**
   * §4 anchor 2. On Thursday the egg rider beside a light grain main is structural
   * rather than optional, so the morning is egg-anchored whatever the ledger says.
   */
  eggAnchored?: boolean;
  scope?: Scope;
  day?: Day | null;
}

/**
 * §5.2 weekday breakfast: one main plus at most one small item, never a second main.
 *
 * The small item is one of exactly two things. A main in Category Chilla or Paratha,
 * or a standalone boiled-eggs main, carries one breakfast chutney, structurally and
 * with no deficit competition; there is no optional chutney slot (§13). Any other
 * main that carries no protein of its own may take the boiled-eggs rider under the
 * optional positive-deficit rule, and does take it on Thursday.
 */
export function composeBreakfast(args: ComposeBreakfastArgs): Plate {
  const { lead, ctx, placedThisWeek } = args;
  const scope = args.scope ?? "weekdayBreakfast";
  const prePlaced = args.prePlaced ?? [];
  const plate: Plate = {
    meal: "breakfast",
    scope,
    day: args.day ?? null,
    picks: [pickOf(lead, "breakfast-main", scope, "breakfast", args.leadOrigin ?? "deficit")],
  };
  const onPlate: Dish[] = [lead];
  let smallFilled = false;
  for (const pre of prePlaced) {
    if (pre.dish.id === lead.id) continue;
    plate.picks.push(pickOf(pre.dish, pre.role, scope, "breakfast", pre.origin));
    onPlate.push(pre.dish);
    if (pre.role === "breakfast-small") smallFilled = true;
  }
  if (smallFilled) return plate;

  const exclude = new Set(onPlate.map((dish) => dish.id));

  if (breakfastMainCarriesChutney(lead) || isStandaloneEggMain(lead)) {
    const pool = excludeIds(breakfastChutneyPool(ctx, scope), exclude);
    const fill = fillStructuralWithOrigin(pool, placedThisWeek);
    if (fill) {
      plate.picks.push(
        pickOf(fill.entry.dish, "breakfast-small", scope, "breakfast", "structural"),
      );
    }
    return plate;
  }

  if (carriesProtein(lead)) return plate;

  const riders = excludeIds(breakfastEggRiderPool(ctx, scope), exclude);
  if (args.eggAnchored) {
    const fill = fillStructuralWithOrigin(riders, placedThisWeek);
    if (fill) {
      plate.picks.push(
        pickOf(fill.entry.dish, "breakfast-small", scope, "breakfast", "structural"),
      );
    }
    return plate;
  }
  const rider = fillOptional(riders);
  if (rider) {
    plate.picks.push(pickOf(rider.dish, "breakfast-small", scope, "breakfast", "deficit"));
  }
  return plate;
}

// ---------------------------------------------------------------------------
// Saturday (§5.4)
// ---------------------------------------------------------------------------

/** The three §5.4 Saturday forms, decided by the lead's own fields. */
export type SaturdayForm = "treat" | "everyday-base" | "carb-forward-international";

/**
 * Which §5.4 form a Saturday lead composes. A carb-forward international treat takes
 * the §5.1 dry protein with precedence over salad, raita, and hummus; an everyday base
 * (khichdi, pulao) is elevated by a special protein that takes the accompaniment's
 * place; every other treat takes the optional accompaniment.
 */
export function saturdayFormFor(lead: Dish): SaturdayForm {
  if (isCarbForwardInternational(lead)) return "carb-forward-international";
  if (isEverydayBase(lead)) return "everyday-base";
  return "treat";
}

export interface ComposeSaturdayArgs {
  /** The treat main or everyday base, already chosen by deficit. */
  lead: Dish;
  ctx: PoolContext;
  placedThisWeek: ReadonlySet<number>;
  prePlaced?: readonly PrePlacedPick[];
  leadOrigin?: PickOrigin;
}

/**
 * §5.4 Saturday: one treat main, one dessert, and at most one third item. The plate
 * stays at three. The protein floor never touches Saturday (§5.1); the treat
 * register's own protein forms are how protein reaches a Saturday plate.
 */
export function composeSaturday(args: ComposeSaturdayArgs): Plate {
  const { lead, ctx, placedThisWeek } = args;
  const scope: Scope = "saturday";
  const prePlaced = args.prePlaced ?? [];
  const plate: Plate = {
    meal: "lunch",
    scope,
    // §4: Saturday is fixed by the schedule, so the plate is created with its day.
    day: "Sat",
    picks: [pickOf(lead, "treat", scope, "lunch", args.leadOrigin ?? "deficit")],
  };
  const onPlate: Dish[] = [lead];
  const filledRoles = new Set<PickRole>(["treat"]);
  for (const pre of prePlaced) {
    if (pre.dish.id === lead.id) continue;
    plate.picks.push(pickOf(pre.dish, pre.role, scope, "lunch", pre.origin));
    onPlate.push(pre.dish);
    filledRoles.add(pre.role);
  }

  if (!filledRoles.has("dessert") && plate.picks.length < SATURDAY_LUNCH_MAX_ITEMS) {
    const pool = excludeIds(dessertPool(ctx, scope), new Set(onPlate.map((d) => d.id)));
    const fill = fillStructuralWithOrigin(pool, placedThisWeek);
    if (fill) {
      plate.picks.push(pickOf(fill.entry.dish, "dessert", scope, "lunch", fill.origin));
      onPlate.push(fill.entry.dish);
    }
  }

  if (plate.picks.length >= SATURDAY_LUNCH_MAX_ITEMS) return plate;

  const exclude = new Set(onPlate.map((dish) => dish.id));
  const form = saturdayFormFor(lead);

  if (form === "carb-forward-international") {
    if (filledRoles.has("partner")) return plate;
    const fill = fillStructuralWithOrigin(
      excludeIds(dryProteinPartnerPool(ctx, scope), exclude),
      placedThisWeek,
    );
    if (fill) plate.picks.push(pickOf(fill.entry.dish, "partner", scope, "lunch", fill.origin));
    return plate;
  }

  if (form === "everyday-base") {
    if (filledRoles.has("special-protein")) return plate;
    const fill = fillStructuralWithOrigin(
      excludeIds(specialProteinPool(ctx), exclude),
      placedThisWeek,
    );
    if (fill) {
      plate.picks.push(pickOf(fill.entry.dish, "special-protein", scope, "lunch", fill.origin));
    }
    return plate;
  }

  if (filledRoles.has("accompaniment")) return plate;
  let pool = excludeIds(saturdayAccompanimentPool(ctx), exclude);
  pool = excludeGravyIfPlateHasGravy(pool, plateHasGravy(onPlate));
  pool = excludeHpEntriesIfMealHasHp(pool, plateHasHp(onPlate));
  const accompaniment = fillOptional(pool);
  if (accompaniment) {
    plate.picks.push(pickOf(accompaniment.dish, "accompaniment", scope, "lunch", "deficit"));
  }
  return plate;
}

// ---------------------------------------------------------------------------
// The day-scoped protein floor (§5.1)
// ---------------------------------------------------------------------------

/**
 * Whether a dish satisfies the day's protein floor: HP-tagged or Category Keto, and
 * not a soya dish. §13 holds that soya chunks masala's HP tag does not satisfy the
 * floor; it is an occasional homely veg main that counts as a sabzi.
 */
export function satisfiesProteinFloor(dish: Dish): boolean {
  return carriesProtein(dish) && !isSoyaProtein(dish);
}

export interface ProteinFloorArgs {
  /** The same day's breakfast plate, or null on Saturday and on a skipped breakfast. */
  breakfast: Plate | null;
  lunch: Plate;
  ctx: PoolContext;
  placedThisWeek: ReadonlySet<number>;
  /** Library lookup, because a plate's picks carry dish ids rather than dishes. */
  dishById: ReadonlyMap<number, Dish>;
}

export interface ProteinFloorResult {
  lunch: Plate;
  /** The dish the floor appended, or null when the floor did not fire or found nothing. */
  appended: Dish | null;
}

/**
 * §5.1 day-scoped protein floor. The floor asks whether the *day* carries protein, not
 * whether the lunch does: a breakfast whose main or small item is an HP-family dish
 * (eggs and paneer included) satisfies the day and the lunch gets no append.
 *
 * It fires only when neither meal of the day carries protein, and it appends one plain
 * protein, Category Keto or Dry dish, never a Gravy dish or a complete meal (the pool
 * enforces all three). Saturday is exempt entirely: the treat register's
 * base-plus-special-protein form is how protein reaches a Saturday plate. The append
 * may take a full 3-item plate to 4, which is the only way a lunch reaches 4 items.
 */
export function applyDayProteinFloor(args: ProteinFloorArgs): ProteinFloorResult {
  const { breakfast, lunch, ctx, placedThisWeek, dishById } = args;
  if (lunch.scope === "saturday") return { lunch, appended: null };

  const dayDishes: Dish[] = [];
  for (const plate of [breakfast, lunch]) {
    if (!plate) continue;
    for (const pick of plate.picks) {
      const dish = dishById.get(pick.dishId);
      if (dish) dayDishes.push(dish);
    }
  }
  if (dayDishes.some(satisfiesProteinFloor)) return { lunch, appended: null };
  if (lunch.picks.length >= WEEKDAY_LUNCH_MAX_ITEMS) return { lunch, appended: null };

  const onDay = new Set(dayDishes.map((dish) => dish.id));
  const fill = fillStructuralWithOrigin(
    excludeIds(proteinFloorPool(ctx, lunch.scope), onDay),
    placedThisWeek,
  );
  if (!fill) return { lunch, appended: null };
  return {
    lunch: {
      ...lunch,
      picks: [...lunch.picks, pickOf(fill.entry.dish, "floor", lunch.scope, "lunch", "structural")],
    },
    appended: fill.entry.dish,
  };
}

// ---------------------------------------------------------------------------
// The international ceiling (§5.3)
// ---------------------------------------------------------------------------

/**
 * §5.3 international ceiling input: how many weekday lunch stars in these plates are
 * non-Indian. Saturday's treat is governed by its own scope and does not count, so
 * only `weekdayLunch`-scope leads are counted. The ceiling itself
 * (`WEEKDAY_INTERNATIONAL_STAR_CEILING`) is enforced by the caller, which is what
 * lets the exploration pick count against it (§7).
 */
export function countWeekdayInternationalStars(
  plates: readonly Plate[],
  dishById: ReadonlyMap<number, Dish>,
): number {
  let count = 0;
  for (const plate of plates) {
    if (plate.scope !== "weekdayLunch") continue;
    for (const pick of plate.picks) {
      if (pick.role !== "star") continue;
      const dish = dishById.get(pick.dishId);
      if (dish && isInternationalStar(dish)) count += 1;
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// The whole-day prep ceiling (§5.1, §11 threshold 10)
// ---------------------------------------------------------------------------

/** One day's composed plates, as the prep-ceiling repair reads them. */
export interface DayPlates {
  day: Day;
  breakfast: Plate | null;
  lunch: Plate;
}

export interface PrepCeilingResult {
  plates: DayPlates;
  /** Every replacement or drop the repair made, in the order it made them. */
  repairs: ConstraintRepair[];
  /** The day's breach after repair, or null when the day is inside the ceiling. */
  breach: PrepCeilingBreach | null;
}

function plateMinutes(plate: Plate | null, dishById: ReadonlyMap<number, Dish>): number {
  if (!plate) return 0;
  return plate.picks.reduce((sum, pick) => sum + (dishById.get(pick.dishId)?.prepMinutes ?? 0), 0);
}

/**
 * §5.1 whole-day prep ceiling of 120 active minutes.
 *
 * After a day composes, if the summed `prepMinutes` of its breakfast and lunch exceed
 * the ceiling, the longest-prep droppable item is replaced by the next-ranked
 * alternative from its own pool that brings the day inside the ceiling, or dropped if
 * none does. The pass repeats while the day is over and a droppable item remains. A
 * day whose protected items alone exceed the ceiling is reported, not repaired
 * further: §13 records that a star-replacement repair was considered and rejected.
 *
 * Ties among equally long droppable items break by dish id ascending (§10).
 */
export function repairPrepCeiling(
  dayPlates: DayPlates,
  provider: PoolProvider,
  dishById: ReadonlyMap<number, Dish>,
): PrepCeilingResult {
  const plates: DayPlates = {
    day: dayPlates.day,
    breakfast: dayPlates.breakfast
      ? { ...dayPlates.breakfast, picks: [...dayPlates.breakfast.picks] }
      : null,
    lunch: { ...dayPlates.lunch, picks: [...dayPlates.lunch.picks] },
  };
  const repairs: ConstraintRepair[] = [];

  const total = (): number =>
    plateMinutes(plates.breakfast, dishById) + plateMinutes(plates.lunch, dishById);

  for (;;) {
    const over = total();
    if (over <= PREP_CEILING_MINUTES) break;

    let worst: { plate: Plate; index: number; dish: Dish } | null = null;
    for (const plate of [plates.breakfast, plates.lunch]) {
      if (!plate) continue;
      plate.picks.forEach((pick, index) => {
        if (!DROPPABLE_ROLES.has(pick.role)) return;
        const dish = dishById.get(pick.dishId);
        if (!dish) return;
        if (
          worst === null ||
          dish.prepMinutes > worst.dish.prepMinutes ||
          (dish.prepMinutes === worst.dish.prepMinutes && dish.id < worst.dish.id)
        ) {
          worst = { plate, index, dish };
        }
      });
    }
    if (worst === null) break;
    const offender: { plate: Plate; index: number; dish: Dish } = worst;

    const onDay = new Set<number>();
    for (const plate of [plates.breakfast, plates.lunch]) {
      if (!plate) continue;
      for (const pick of plate.picks) onDay.add(pick.dishId);
    }
    const role = offender.plate.picks[offender.index].role;
    const alternatives = provider(role, offender.plate.scope, onDay);
    const replacement = alternatives.find(
      (entry) =>
        over - offender.dish.prepMinutes + entry.dish.prepMinutes <= PREP_CEILING_MINUTES &&
        entry.dish.prepMinutes < offender.dish.prepMinutes,
    );

    if (replacement) {
      offender.plate.picks[offender.index] = {
        ...offender.plate.picks[offender.index],
        dishId: replacement.dish.id,
      };
      repairs.push({
        constraint: "prep-ceiling",
        day: plates.day,
        meal: offender.plate.meal,
        removedDishId: offender.dish.id,
        addedDishId: replacement.dish.id,
        swappedWithDay: null,
      });
    } else {
      offender.plate.picks.splice(offender.index, 1);
      repairs.push({
        constraint: "prep-ceiling",
        day: plates.day,
        meal: offender.plate.meal,
        removedDishId: offender.dish.id,
        addedDishId: null,
        swappedWithDay: null,
      });
    }
  }

  const remaining = total();
  if (remaining <= PREP_CEILING_MINUTES) return { plates, repairs, breach: null };

  let protectedMinutes = 0;
  for (const plate of [plates.breakfast, plates.lunch]) {
    if (!plate) continue;
    for (const pick of plate.picks) {
      if (DROPPABLE_ROLES.has(pick.role)) continue;
      protectedMinutes += dishById.get(pick.dishId)?.prepMinutes ?? 0;
    }
  }
  return {
    plates,
    repairs,
    breach: {
      day: plates.day,
      prepMinutes: remaining,
      unrepairable: protectedMinutes > PREP_CEILING_MINUTES,
    },
  };
}

// Re-exported so a caller composing plates needs one import, not two.
export { isCarbForwardInternational, isEverydayBase, isInternationalStar, isPlainProtein };
