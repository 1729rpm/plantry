/**
 * The v6 orchestrator (`features/engine-v6.md` §6, §10, §12).
 *
 * `generateWeekV6` is the one entry point of the v6 engine. It composes the
 * modules the other streams built (the record derivation and the replayed ledger,
 * the role pools and the plate builders, exploration, favorites pinning, day
 * assignment and the constraint pass) in the exact order §6 states, and returns
 * the week the backend persists.
 *
 * The six steps, and what each one is for:
 *
 * 1. **Replay and accrue** (§3, §3.1, §12). The ledger holds no state of its own;
 *    it is replayed from the cutover week on every generation and then accrued
 *    once for the week being generated.
 * 2. **Pin favorites** (§8). Every favorites-table dish gets one slot of its meal
 *    type, charged like any other placement.
 * 3. **The exploration pick** (§7). Exactly one weekday lunch position, the only
 *    door a never-eaten dish comes through.
 * 4. **Fill the plan** (§5, §9). Saturday, then the weekday lunch stars under the
 *    §5.3 ceiling, then the plates around them, then the breakfasts, then the six
 *    fruits.
 * 5. **Assign days** (§6 step 5), by least-recently-used weekday occupation.
 * 6. **The constraint pass** (§6 step 6), whose repairs refund the replaced dish
 *    and charge the replacement.
 *
 * Then the §9 item cap runs as the safety net behind the ceilings, and the week
 * is projected onto the `GeneratedWeek` day and slot shape the Convex conversion
 * in `app/convex/generateWeek.ts` already reads.
 *
 * **Determinism (§10) is a locked invariant.** There is no clock, no RNG and no
 * `Math.random` anywhere below this line, every tie in every ranking bottoms out
 * at dish id ascending inside the modules this file calls, and the two inputs
 * that arrive as arrays (the library and the record) are order-independent: the
 * record is sorted here, and every pool the library feeds is totally ranked by
 * `pools.ts` before anything reads it.
 *
 * **One charge per placement, and the generated plan is the ledger's receipt.**
 * §3.1 replays a week by charging the picks its `generatedPlan` carries, so the
 * charges this function leaves on the ledger must be exactly the picks it returns
 * in `generatedPlan`, or a replay would not reproduce the generation. Every
 * placement is therefore charged once through `commitPick`, and every removal (a
 * constraint-pass repair, a §9 cap drop) refunds. §3's no-refund rule is about
 * household swap-outs, which are not removals the engine makes.
 */

import type { Dish } from "../data/schemas.js";
import { applyCap, type PickRole as CapPickRole, type SlotPick } from "../cap.js";
import type { GeneratedWeekDay, GeneratedWeekSlot } from "../generateWeek.js";
import type { Meal as SlotMeal } from "../eligibility.js";
import { toLongDay } from "../historyRows.js";
import type {
  ConstraintRepair,
  Day,
  GeneratedWeekV6,
  Ledger,
  GenerateWeekV6Args,
  MealKey,
  Pick,
  PickOrigin,
  PickRole,
  PlanPick,
  PrepCeilingBreach,
  RecordWeek,
  Scope,
} from "./types.js";
import { deriveRecordStats } from "./record.js";
import {
  PLANNED_OCCASIONS,
  accrue,
  charge,
  isEligibleDish,
  refund,
  replayLedger,
} from "./ledger.js";
import {
  breakfastMainPool,
  deficitOf,
  everydayBasePool,
  fillStructuralWithOrigin,
  fruitOverflowPool,
  fruitPool,
  isInternationalStar,
  isStructuralPoolDish,
  lunchStarPool,
  poolProvider,
  rankPool,
  rateOf,
  saturdayTreatPool,
  thursdayEggBreakfastPool,
  type PoolContext,
  type PoolEntry,
} from "./pools.js";
import {
  WEEKDAY_INTERNATIONAL_STAR_CEILING,
  composeBreakfast,
  composeSaturday,
  composeWeekdayLunch,
  lunchFormFor,
  proteinFamily,
  type PrePlacedPick,
} from "./compose.js";
import { assignDays, constraintPass, type Plate, type PoolProvider, type Repair } from "./place.js";
import { pinFavorites } from "./favoritesPin.js";
import { pickExploration } from "./exploration.js";

/** Monday to Friday (§4). */
const WEEKDAYS: readonly Day[] = ["Mon", "Tue", "Wed", "Thu", "Fri"];
/** Every day the engine schedules, Monday to Saturday (§4). Sunday is never generated. */
const ALL_DAYS: readonly Day[] = [...WEEKDAYS, "Sat"];

/** §4: five weekday breakfasts, five weekday lunches, one fruit a day Monday to Saturday. */
const WEEKDAY_BREAKFAST_SLOTS = 5;
const WEEKDAY_LUNCH_SLOTS = 5;
const FRUIT_SLOTS = 6;

/** §5.1 whole-day prep ceiling, in active minutes. Reported after repair (§11 threshold 10). */
const PREP_CEILING_MINUTES = 120;

/** The optional roles the prep-ceiling report treats as unprotected (§5.1). */
const DROPPABLE_ROLES: ReadonlySet<PickRole> = new Set<PickRole>([
  "companion",
  "breakfast-small",
  "accompaniment",
]);

/**
 * v6 roles projected onto the §9 cap's own role union (`cap.ts`).
 *
 * The cap is the safety net behind §5's ceilings, and it is role-aware: it drops
 * companion sides before the carb and the protein main. v6 has finer roles than
 * the production cap does, so each maps onto the cap role with the same
 * protection: every lead and every structural protein is a protein main, the
 * lunch companion is a sabzi (droppable), the Saturday accompaniment and the
 * breakfast small item keep their own cap roles. `fruit` has no mapping because
 * §9 puts the fruit of the day outside the cap entirely.
 */
const CAP_ROLE: Record<Exclude<PickRole, "fruit">, CapPickRole> = {
  "breakfast-main": "breakfast-main",
  "breakfast-small": "breakfast-accompaniment",
  star: "protein-main",
  carb: "carb",
  companion: "sabzi",
  floor: "protein-floor",
  partner: "protein-main",
  treat: "protein-main",
  "special-protein": "protein-main",
  accompaniment: "accompaniment",
  dessert: "dessert",
};

function byWeekStart(a: { weekStart: string }, b: { weekStart: string }): number {
  return a.weekStart < b.weekStart ? -1 : a.weekStart > b.weekStart ? 1 : 0;
}

/**
 * §12: the cutover week is derived, never configured.
 *
 * It is the earliest `weekStart` among record weeks that carry a `generatedPlan`
 * (the first week the engine itself wrote), or the generating week when no record
 * week does. The §3 cold start seeds there and the §3.1 replay starts there, so a
 * household that has never run v6 seeds at the week it first runs it, and every
 * later week replays from that same fixed point.
 */
export function deriveCutoverWeek(record: readonly RecordWeek[], weekStart: string): string {
  let earliest: string | null = null;
  for (const week of record) {
    if (week.generatedPlan === null) continue;
    if (week.weekStart >= weekStart) continue;
    if (earliest === null || week.weekStart < earliest) earliest = week.weekStart;
  }
  return earliest ?? weekStart;
}

/**
 * §6 step 6: apply the constraint pass's repairs to the ledger.
 *
 * "An engine-internal repair refunds the replaced dish's charge and charges the
 * replacement; the no-refund rule of §3 is for household swap-outs only." A
 * whole-plate swap replaces nothing and charges nothing: both plates keep the
 * dishes they already paid for, they only change days.
 *
 * Exported so the rule can be tested on its own, without having to reach inside a
 * generation for a ledger that is deliberately not part of the output.
 */
export function applyRepairsToLedger(ledger: Ledger, repairs: readonly Repair[]): Ledger {
  let next = ledger;
  for (const repair of repairs) {
    if (repair.replaced) next = refund(next, repair.replaced.dishId, repair.replaced.scope);
    if (repair.replacement)
      next = charge(next, repair.replacement.dishId, repair.replacement.scope);
  }
  return next;
}

/** A plan pick before day assignment: what a plate carries. */
type PlatePick = Omit<PlanPick, "day">;

function pickOf(
  dishId: number,
  role: PickRole,
  scope: Scope,
  meal: MealKey,
  origin: PickOrigin,
): PlatePick {
  return { meal, dishId, role, scope, origin };
}

/**
 * §6: plan the whole week, then place it.
 *
 * `args.record` is every record week before `args.weekStart` (§2.1); anything at
 * or after the generating week is ignored, and the array need not be sorted.
 */
export function generateWeekV6(args: GenerateWeekV6Args): GeneratedWeekV6 {
  const { weekStart, season, variant } = args;
  const library = args.library;
  const record = [...args.record].filter((week) => week.weekStart < weekStart).sort(byWeekStart);
  const cutoverWeek = args.cutoverWeek ?? deriveCutoverWeek(record, weekStart);

  const dishById = new Map<number, Dish>();
  for (const dish of library) dishById.set(dish.id, dish);
  const structuralDishIds = new Set(library.filter(isStructuralPoolDish).map((dish) => dish.id));

  // ---------------------------------------------------------------------------
  // Step 1: replay the ledger (§3.1), then accrue the generating week (§3).
  // ---------------------------------------------------------------------------

  // §11's frozen run fixes the rates at the cutover record for the whole horizon,
  // which means selection reads the cutover record too, not just accrual. Every
  // other run reads the record as it stands.
  const statsRecord = variant?.frozenRates
    ? record.filter((week) => week.weekStart < cutoverWeek)
    : record;
  const stats = deriveRecordStats(statsRecord, library, season, {
    rateFormula: variant?.rateFormula,
  });

  let ledger = replayLedger({
    record,
    library,
    season,
    cutoverWeek,
    structuralDishIds,
    variant,
    weekStart,
  });
  const eligibleDishIds = new Set(
    library.filter((dish) => isEligibleDish(dish, season)).map((dish) => dish.id),
  );
  ledger = accrue(ledger, stats, eligibleDishIds, PLANNED_OCCASIONS);

  const ctx = (): PoolContext => ({ library, season, stats, ledger });
  /** Every pool read goes through here, so each one sees the ledger as it stands. */
  const provider: PoolProvider = (role, scope, exclude) =>
    poolProvider(ctx())(role, scope, exclude);

  // ---------------------------------------------------------------------------
  // Placement bookkeeping
  // ---------------------------------------------------------------------------

  /** Dish ids placed anywhere in this week's plan: §3.2's workhorse-fallback guard. */
  const placed = new Set<number>();
  /**
   * Charges already made for a (dish, scope) that a plate has not yet claimed.
   *
   * §8 charges a favorite when it is pinned (step 2), which is before the plate
   * that carries it exists. Committing that plate must not charge it a second
   * time, so the pin records the charge here and the commit spends it.
   */
  const preCharged = new Map<string, number>();
  const negativeDeficitFills: Partial<Record<PickRole, number>> = {};

  const commitPick = (pick: PlatePick): void => {
    const key = `${pick.dishId}:${pick.scope}`;
    const outstanding = preCharged.get(key) ?? 0;
    if (outstanding > 0) preCharged.set(key, outstanding - 1);
    else ledger = charge(ledger, pick.dishId, pick.scope);
    placed.add(pick.dishId);
    if (pick.origin === "fallback") {
      negativeDeficitFills[pick.role] = (negativeDeficitFills[pick.role] ?? 0) + 1;
    }
  };

  /** Commit every pick of a freshly composed plate except its lead, already committed. */
  const commitPlateBody = (plate: Plate): void => {
    for (const pick of plate.picks.slice(1)) commitPick(pick);
  };

  // ---------------------------------------------------------------------------
  // Step 2: pin the favorites (§6 step 2, §8).
  // ---------------------------------------------------------------------------

  const pin = pinFavorites({
    favoriteDishIds: args.favoriteDishIds,
    library,
    season,
    provider,
  });
  for (const pinned of pin.pinned) {
    ledger = charge(ledger, pinned.dishId, pinned.scope);
    placed.add(pinned.dishId);
    const key = `${pinned.dishId}:${pinned.scope}`;
    preCharged.set(key, (preCharged.get(key) ?? 0) + 1);
  }
  const unplacedFavorites = [...pin.unplaceable];

  const pinnedIn = (role: PickRole): Dish[] =>
    pin.pinned
      .filter((pinned) => pinned.role === role)
      .map((pinned) => dishById.get(pinned.dishId))
      .filter((dish): dish is Dish => dish !== undefined);

  // ---------------------------------------------------------------------------
  // Step 3: the exploration pick (§6 step 3, §7).
  // ---------------------------------------------------------------------------

  const exploration = pickExploration({
    library,
    stats,
    record,
    season,
    ledger,
    provider,
    exclude: placed,
    variant,
    nutrition: args.nutrition,
  });
  // §7 makes the pick conditional on a weekday lunch position accepting it, so it
  // is charged when its plate is committed rather than here. The two are
  // equivalent: a candidate has no as-eaten row in any scope (§2.2), so it sits in
  // no pool and no selection between here and step 4 can read its ledger.

  const plates: Plate[] = [];

  // ---------------------------------------------------------------------------
  // Step 4a: Saturday (§5.4).
  // ---------------------------------------------------------------------------

  /**
   * §5.4's Saturday lead pool: the Saturday-scoped treat pool, plus the everyday
   * bases (khichdi, pulao) that the special-protein form elevates.
   *
   * An everyday base with a Saturday row is already in the treat pool and competes
   * on its Saturday deficit like every other treat. One without a Saturday row
   * enters here carrying the **Saturday** ledger (zero, since it has never been
   * charged there) and its **weekday** rate, which is a per-occasion propensity and
   * therefore directly comparable to a treat's Saturday rate. That has two
   * consequences, both wanted: the base can never outrank a treat that is actually
   * due, and it can win only through §3.2's workhorse fallback, when no treat is
   * due and the base is the thing the household eats most often at a meal of its
   * kind. Ranking a base on its weekday *deficit* instead would hand it every
   * Saturday, because a weekday deficit accrues on a five-occasion clock against
   * the Saturday slot's one, and charging it in the Saturday scope (which §5.4
   * requires, since the placement is a Saturday serving) would never pay that
   * deficit down.
   */
  const saturdayLeadPool = (): PoolEntry[] => {
    const treats = saturdayTreatPool(ctx());
    const seen = new Set(treats.map((entry) => entry.dish.id));
    const bases = everydayBasePool(ctx())
      .filter((entry) => !seen.has(entry.dish.id))
      .map((entry) => ({
        dish: entry.dish,
        deficit: deficitOf(ledger, entry.dish.id, "saturday"),
        rate: rateOf(stats, entry.dish.id, "weekdayLunch"),
      }));
    return rankPool([...treats, ...bases]);
  };

  const pinnedTreat = pinnedIn("treat")[0];
  let saturdayLead: Dish | undefined = pinnedTreat;
  let saturdayOrigin: PickOrigin = "favorite";
  let saturdayDeficit = pinnedTreat ? deficitOf(ledger, pinnedTreat.id, "saturday") : 0;
  if (!saturdayLead) {
    const fill = fillStructuralWithOrigin(saturdayLeadPool(), placed);
    if (fill) {
      saturdayLead = fill.entry.dish;
      saturdayOrigin = fill.origin;
      saturdayDeficit = fill.entry.deficit;
    }
  }
  if (saturdayLead) {
    commitPick(pickOf(saturdayLead.id, "treat", "saturday", "lunch", saturdayOrigin));
    const plate = composeSaturday({
      lead: saturdayLead,
      ctx: ctx(),
      placedThisWeek: placed,
      leadOrigin: saturdayOrigin,
    });
    plate.deficit = saturdayDeficit;
    commitPlateBody(plate);
    plates.push(plate);
  }

  // ---------------------------------------------------------------------------
  // Step 4b: the weekday lunch stars (§5.1, §5.3), then their plates.
  // ---------------------------------------------------------------------------

  interface LunchLead {
    dish: Dish;
    origin: PickOrigin;
    deficit: number;
  }

  const lunchLeads: LunchLead[] = [];
  let weekdayInternationalStars = 0;
  const takeLead = (lead: LunchLead): void => {
    lunchLeads.push(lead);
    if (isInternationalStar(lead.dish)) weekdayInternationalStars += 1;
    commitPick(pickOf(lead.dish.id, "star", "weekdayLunch", "lunch", lead.origin));
  };

  for (const favorite of pinnedIn("star")) {
    if (lunchLeads.length >= WEEKDAY_LUNCH_SLOTS) break;
    takeLead({
      dish: favorite,
      origin: "favorite",
      deficit: deficitOf(ledger, favorite.id, "weekdayLunch"),
    });
  }

  // §7: the exploration pick may be an international main, and it counts against
  // the §5.3 ceiling like any other weekday international star.
  const explorationLeads =
    exploration !== null && exploration.role === "star" && lunchLeads.length < WEEKDAY_LUNCH_SLOTS;
  if (explorationLeads && exploration) {
    takeLead({ dish: exploration.dish, origin: "exploration", deficit: 0 });
  }

  while (lunchLeads.length < WEEKDAY_LUNCH_SLOTS) {
    let pool = lunchStarPool(ctx());
    if (weekdayInternationalStars >= WEEKDAY_INTERNATIONAL_STAR_CEILING) {
      pool = pool.filter((entry) => !isInternationalStar(entry.dish));
    }
    const fill = fillStructuralWithOrigin(pool, placed);
    if (!fill) break;
    takeLead({ dish: fill.entry.dish, origin: fill.origin, deficit: fill.entry.deficit });
  }

  /**
   * The §8 favorites that ride on a lunch plate rather than leading one, plus the
   * §7 exploration pick when its shape is a companion. Each is handed to one
   * plate as a pre-placed pick, so §8's "exactly one slot" holds and the
   * composition around it is built by `compose.ts` as usual.
   */
  const lunchRiders: PrePlacedPick[] = pinnedIn("companion").map((dish) => ({
    dish,
    role: "companion" as PickRole,
    origin: "favorite" as PickOrigin,
  }));
  // A star-shaped pick with no lunch slot left is simply not placed: §7 allows a
  // week with no exploration placement, and it never rides as a companion.
  const explorationRides =
    exploration !== null && !explorationLeads && exploration.role === "companion";
  if (explorationRides && exploration) {
    // Prefer a standard star-plus-carb plate: §5.1 gives the carb-forward
    // international form exactly one dry protein and nothing else, and a complete
    // plate takes at most one Accompaniment companion, so a novel companion sits
    // most comfortably on a standard plate.
    const standardIndex = lunchLeads.findIndex((lead) => lunchFormFor(lead.dish) === "standard");
    const rider: PrePlacedPick = {
      dish: exploration.dish,
      role: exploration.role,
      origin: "exploration",
    };
    if (standardIndex >= 0) lunchRiders.splice(standardIndex, 0, rider);
    else lunchRiders.push(rider);
  }

  lunchLeads.forEach((lead, index) => {
    const rider = lunchRiders[index];
    const plate = composeWeekdayLunch({
      lead: lead.dish,
      ctx: ctx(),
      placedThisWeek: placed,
      prePlaced: rider ? [rider] : [],
      leadOrigin: lead.origin,
    });
    plate.deficit = lead.deficit;
    commitPlateBody(plate);
    plates.push(plate);
  });

  // ---------------------------------------------------------------------------
  // Step 4c: the five breakfast mains (§5.2), Thursday's egg-anchored (§4).
  // ---------------------------------------------------------------------------

  const thursdayPool = thursdayEggBreakfastPool(ctx(), proteinFamily);
  const favoriteMains = pinnedIn("breakfast-main");
  /**
   * Thursday's main: a pinned favorite the §4 egg-anchored pool accepts, if there
   * is one, otherwise the top of that pool. When the favorites fill every weekday
   * breakfast, Thursday takes one of them anyway and §6 step 6's anchor repair
   * rides boiled eggs along beside it; §8's guarantee is not broken to keep the
   * anchor tidy, and the anchor is not abandoned to keep the favorite whole.
   */
  const thursdayFavorite =
    favoriteMains.find((dish) => thursdayPool.some((entry) => entry.dish.id === dish.id)) ??
    (favoriteMains.length >= WEEKDAY_BREAKFAST_SLOTS ? favoriteMains[0] : undefined);

  interface BreakfastLead {
    dish: Dish;
    origin: PickOrigin;
    deficit: number;
    day: Day | null;
    eggAnchored: boolean;
  }
  const breakfastLeads: BreakfastLead[] = [];

  if (thursdayFavorite) {
    breakfastLeads.push({
      dish: thursdayFavorite,
      origin: "favorite",
      deficit: deficitOf(ledger, thursdayFavorite.id, "weekdayBreakfast"),
      day: "Thu",
      eggAnchored: true,
    });
  } else {
    const fill = fillStructuralWithOrigin(thursdayPool, placed);
    if (fill) {
      breakfastLeads.push({
        dish: fill.entry.dish,
        origin: fill.origin,
        deficit: fill.entry.deficit,
        day: "Thu",
        eggAnchored: true,
      });
    }
  }

  for (const favorite of favoriteMains) {
    if (favorite === thursdayFavorite) continue;
    if (breakfastLeads.length >= WEEKDAY_BREAKFAST_SLOTS) break;
    breakfastLeads.push({
      dish: favorite,
      origin: "favorite",
      deficit: deficitOf(ledger, favorite.id, "weekdayBreakfast"),
      day: null,
      eggAnchored: false,
    });
  }

  // The leads are committed only once the whole set is chosen, because each
  // charge changes the pool the next choice reads.
  for (const lead of breakfastLeads) {
    commitPick(
      pickOf(lead.dish.id, "breakfast-main", "weekdayBreakfast", "breakfast", lead.origin),
    );
  }
  while (breakfastLeads.length < WEEKDAY_BREAKFAST_SLOTS) {
    const fill = fillStructuralWithOrigin(breakfastMainPool(ctx()), placed);
    if (!fill) break;
    const lead: BreakfastLead = {
      dish: fill.entry.dish,
      origin: fill.origin,
      deficit: fill.entry.deficit,
      day: null,
      eggAnchored: false,
    };
    breakfastLeads.push(lead);
    commitPick(
      pickOf(lead.dish.id, "breakfast-main", "weekdayBreakfast", "breakfast", lead.origin),
    );
  }

  const breakfastRiders: PrePlacedPick[] = pinnedIn("breakfast-small").map((dish) => ({
    dish,
    role: "breakfast-small" as PickRole,
    origin: "favorite" as PickOrigin,
  }));

  breakfastLeads.forEach((lead, index) => {
    const rider = breakfastRiders[index];
    const plate = composeBreakfast({
      lead: lead.dish,
      ctx: ctx(),
      placedThisWeek: placed,
      prePlaced: rider ? [rider] : [],
      leadOrigin: lead.origin,
      eggAnchored: lead.eggAnchored,
      day: lead.day,
    });
    plate.deficit = lead.deficit;
    commitPlateBody(plate);
    plates.push(plate);
  });

  // ---------------------------------------------------------------------------
  // Step 4d: six fruits by deficit, with §9's exhausted-pool rule.
  // ---------------------------------------------------------------------------

  const fruitsThisWeek = new Set<number>();
  for (let slot = 0; slot < FRUIT_SLOTS; slot += 1) {
    const repertoire = fruitPool(ctx());
    const due = repertoire[0];
    let entry: PoolEntry | undefined;
    let origin: PickOrigin;
    if (due && due.deficit > 0) {
      entry = due;
      origin = "deficit";
    } else {
      // §9: when every fruit in the season's repertoire pool has a non-positive
      // deficit, the day's fruit is drawn by least-recently-served from every
      // Active, in-season Category Fruit dish, candidates included. Fruits already
      // on this week's table are held back, so a within-week repeat happens only
      // when the whole eligible in-season set holds fewer than six fruits.
      const overflow = fruitOverflowPool(ctx());
      const unserved = overflow.filter((candidate) => !fruitsThisWeek.has(candidate.dish.id));
      entry = (unserved.length > 0 ? unserved : overflow)[0];
      origin = "fallback";
    }
    if (!entry) break;
    const pick = pickOf(entry.dish.id, "fruit", "fruit", "fruit", origin);
    commitPick(pick);
    fruitsThisWeek.add(entry.dish.id);
    plates.push({
      meal: "fruit",
      scope: "fruit",
      day: null,
      picks: [pick],
      deficit: entry.deficit,
    });
  }

  // ---------------------------------------------------------------------------
  // Steps 5 and 6: assign days, then repair (§6 steps 5 and 6).
  // ---------------------------------------------------------------------------

  const dated = assignDays(plates, stats);
  const pass = constraintPass(dated, { provider, library, stats });

  // §6 step 6: an engine-internal repair refunds the replaced dish's charge and
  // charges the replacement, so the ledger keeps matching the plan.
  ledger = applyRepairsToLedger(ledger, pass.repairs);
  const repairs: ConstraintRepair[] = pass.repairs.map((repair) => ({
    constraint: repair.reason,
    day: repair.day,
    meal: repair.meal,
    removedDishId: repair.replaced?.dishId ?? null,
    addedDishId: repair.replacement?.dishId ?? null,
    swappedWithDay: repair.swappedWithDay,
  }));

  // ---------------------------------------------------------------------------
  // Step 7: the §9 item cap, as the role-aware safety net behind the ceilings.
  // ---------------------------------------------------------------------------

  const finalPlates = pass.plates.map((plate) => ({ ...plate, picks: [...plate.picks] }));
  const incidents: string[] = [];

  /** One capped pick, tracked back to the plate and index it came from. */
  interface CapSource {
    plate: Plate;
    pick: PlatePick;
  }
  const capSources = new Map<Day, CapSource[]>();
  const slotsByDay = new Map<Day, SlotPick[]>();
  for (const day of ALL_DAYS) {
    const sources: CapSource[] = [];
    const picks: SlotPick[] = [];
    for (const meal of ["breakfast", "lunch"] as const) {
      const plate = finalPlates.find((entry) => entry.day === day && entry.meal === meal);
      if (!plate) continue;
      for (const pick of plate.picks) {
        const dish = dishById.get(pick.dishId);
        if (!dish) continue;
        sources.push({ plate, pick });
        picks.push({ ...dish, role: CAP_ROLE[pick.role as Exclude<PickRole, "fruit">] });
      }
    }
    capSources.set(day, sources);
    slotsByDay.set(day, picks);
  }

  const capped = applyCap({ slotsByDay });
  for (const day of ALL_DAYS) {
    const sources = capSources.get(day) ?? [];
    const kept = capped.slotsByDay.get(day) ?? [];
    // `applyCap` splices, so the kept picks are a subsequence of the input in the
    // same order; walking both in step recovers exactly which pick was dropped,
    // even when one dish sits on the day twice.
    let cursor = 0;
    for (const source of sources) {
      if (cursor < kept.length && kept[cursor].id === source.pick.dishId) {
        cursor += 1;
        continue;
      }
      const index = source.plate.picks.indexOf(source.pick);
      if (index >= 0) source.plate.picks.splice(index, 1);
      ledger = refund(ledger, source.pick.dishId, source.pick.scope);
      const name = dishById.get(source.pick.dishId)?.name ?? `dish ${source.pick.dishId}`;
      const cap = day === "Sat" ? 3 : 5;
      incidents.push(`${toLongDay(day)} over cap (${cap}), dropped: ${name}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Output: the `GeneratedWeek` shape, the generated plan, and the diagnostics.
  // ---------------------------------------------------------------------------

  const plateFor = (day: Day, meal: MealKey): Plate | undefined =>
    finalPlates.find((plate) => plate.day === day && plate.meal === meal);

  const days: GeneratedWeekDay[] = ALL_DAYS.map((day) => {
    const slots: GeneratedWeekSlot[] = [];
    for (const meal of ["breakfast", "lunch"] as const) {
      const plate = plateFor(day, meal);
      if (!plate || plate.picks.length === 0) continue;
      const dishes = plate.picks
        .map((pick) => dishById.get(pick.dishId))
        .filter((dish): dish is Dish => dish !== undefined);
      if (dishes.length === 0) continue;
      slots.push({ day, meal: (meal === "breakfast" ? "Breakfast" : "Lunch") as SlotMeal, dishes });
    }
    const fruitPlate = plateFor(day, "fruit");
    const fruit = fruitPlate ? dishById.get(fruitPlate.picks[0]?.dishId ?? -1) : undefined;
    return fruit ? { day, slots, fruit } : { day, slots };
  });

  const generatedPlan: Pick[] = [];
  for (const day of ALL_DAYS) {
    for (const meal of ["breakfast", "lunch", "fruit"] as const) {
      const plate = plateFor(day, meal);
      if (!plate) continue;
      for (const pick of plate.picks) generatedPlan.push({ day, meal, dishId: pick.dishId });
    }
  }

  // §8: a favorite is guaranteed only if it survives into the final week. A pinned
  // favorite can still be gone, because the §6 step 6 constraint pass may have
  // replaced it to clear a hard rule (§8 never breaks one to keep a favorite) or
  // the §9 cap may have dropped it. Report every one that did not land, in the
  // table's own oldest-first order, so the Convex layer can log it.
  const placedDishIds = new Set(generatedPlan.map((pick) => pick.dishId));
  for (const pinned of pin.pinned) {
    if (placedDishIds.has(pinned.dishId)) continue;
    if (unplacedFavorites.includes(pinned.dishId)) continue;
    unplacedFavorites.push(pinned.dishId);
  }

  // §11 threshold 10 reports the days §5.1's repair could not bring inside the
  // ceiling, and whether the protected items alone are what put them over.
  const prepCeilingBreaches: PrepCeilingBreach[] = [];
  for (const day of ALL_DAYS) {
    let total = 0;
    let protectedMinutes = 0;
    for (const meal of ["breakfast", "lunch"] as const) {
      const plate = plateFor(day, meal);
      if (!plate) continue;
      for (const pick of plate.picks) {
        const minutes = dishById.get(pick.dishId)?.prepMinutes ?? 0;
        total += minutes;
        if (!DROPPABLE_ROLES.has(pick.role)) protectedMinutes += minutes;
      }
    }
    if (total > PREP_CEILING_MINUTES) {
      prepCeilingBreaches.push({
        day,
        prepMinutes: total,
        unrepairable: protectedMinutes > PREP_CEILING_MINUTES,
      });
    }
  }

  // Only the hard rules earn an incident: §5.1 makes consecutive rice soft and
  // allows a cross-meal repeat when nothing else fits, and §5.1 reports a prep
  // breach rather than repairing further, so none of those is a warning.
  for (const entry of pass.unrepairable) {
    if (entry.startsWith("anchor:")) {
      incidents.push(`${entry.split(":")[1]} ${entry.split(":")[2]}: no dish satisfies the anchor`);
    } else if (entry.startsWith("protein-floor:")) {
      const day = entry.split(":")[1] as Day;
      incidents.push(`${toLongDay(day)} lunch has no protein (§5.1 floor pool empty)`);
    }
  }

  const explorationPick = generatedPlan.some(
    (pick) => exploration !== null && pick.dishId === exploration.dish.id,
  )
    ? exploration
    : null;

  return {
    weekStart,
    days,
    droppedDishIds: capped.droppedDishIds,
    incidents,
    unplacedFavorites,
    generatedPlan,
    diagnostics: {
      negativeDeficitFills,
      exploration: explorationPick
        ? { dishId: explorationPick.dish.id, proteinFamily: explorationPick.family }
        : null,
      repairs,
      prepCeilingBreaches,
      unrepairable: pass.unrepairable,
      weekdayInternationalStars,
      cutoverWeek,
    },
  };
}
