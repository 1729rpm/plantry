import type { Dish } from "../data/schemas.js";
import type {
  ConstraintRepair,
  Day,
  MealKey,
  PickRole,
  PlanPick,
  RecordStats,
  Scope,
} from "./types.js";

/**
 * v6 §6 steps 5 and 6: day assignment and the constraint pass.
 *
 * Generation plans the whole week before it knows which day anything lands on
 * (§6 steps 2 to 4). This module closes that loop: `assignDays` gives every
 * plate a weekday by least-recently-used occupation memory, and
 * `constraintPass` then enforces the rules that are only checkable once days
 * are known (the two anchors, cross-meal protein repeats, rice on consecutive
 * days, the day-scoped protein floor, the whole-day prep ceiling).
 *
 * Both functions are pure: inputs are never mutated, no clock, no RNG, and
 * every tie bottoms out at dish id ascending (§10). Nothing here touches the
 * ledger. `constraintPass` RETURNS its repairs and the orchestrator (stream D)
 * refunds each `replaced` dish and charges each `replacement` with the ledger
 * functions of stream A, which is what §6 step 6's "an engine-internal repair
 * refunds the replaced dish's charge" means in code.
 *
 * This file is also the home of the cross-module shapes stream C needs
 * (`Plate`, `PoolEntry`, `PoolProvider`, `Repair`) and of the v6 protein-family
 * map, so `exploration.ts` and `favoritesPin.ts` import them from one place
 * rather than redeclaring them. They are deliberately NOT in `types.ts`: that
 * file is the A0 contract and a hotspot, and TypeScript is structural, so an
 * identically shaped `Plate` built by stream B satisfies these signatures
 * without either module importing the other.
 */

// ---------------------------------------------------------------------------
// Shapes shared across stream C (fixed by the EM so stream D needs no adapter)
// ---------------------------------------------------------------------------

/**
 * A composed meal before or after day assignment.
 *
 * Stream B builds these, C assigns days and repairs them, D glues the two.
 * `day` is null until `assignDays` fills it; Saturday plates and the Thursday
 * egg-anchored breakfast arrive with their day already set and are never moved.
 */
export interface Plate {
  meal: MealKey;
  scope: Scope;
  day: Day | null;
  /** Pick order, lead first. Each pick carries its role, scope, and origin. */
  picks: Array<Omit<PlanPick, "day">>;
  /**
   * The lead pick's ledger deficit at composition time, read only by §6 step 5
   * to order lunch stars (highest deficit assigned first). Optional: an absent
   * deficit reads as zero and the ordering falls through to dish id ascending,
   * so a caller that does not carry it still gets a deterministic assignment.
   */
  deficit?: number;
}

/** One eligible dish in a role pool with its current ledger state (stream B produces these). */
export interface PoolEntry {
  dish: Dish;
  /** From the ledger, in this scope. */
  deficit: number;
  /** From `RecordStats`, in this scope. */
  rate: number;
}

/**
 * How stream C asks stream B for ranked alternatives without importing it: a
 * callback stream D wires from `pools.ts`. It returns the pool for a role in a
 * scope, ranked by B's own rule (deficit descending, id ascending), minus the
 * excluded ids.
 */
export type PoolProvider = (
  role: PickRole,
  scope: Scope,
  exclude: ReadonlySet<number>,
) => PoolEntry[];

/** The constraint a repair answers to. Same union as `ConstraintRepair["constraint"]` (§6 step 6). */
export type RepairReason = ConstraintRepair["constraint"];

/**
 * One deterministic repair the constraint pass made, reported rather than applied
 * to any ledger.
 *
 * A repair is one of three things: an in-place replacement (`replaced` and
 * `replacement` both set), a drop (`replacement` null), an addition
 * (`replaced` null), or a whole-plate swap between two days (both null and
 * `swappedWithDay` set). Stream D maps this onto `ConstraintRepair` for the
 * §11 diagnostics and refunds `replaced` while charging `replacement`.
 */
export interface Repair {
  /** The day the repair touched; for a whole-plate swap, the earlier of the two days. */
  day: Day;
  meal: MealKey;
  replaced: Omit<PlanPick, "day"> | null;
  replacement: Omit<PlanPick, "day"> | null;
  reason: RepairReason;
  /** The other day of a whole-plate swap; null for an in-place repair. */
  swappedWithDay: Day | null;
}

// ---------------------------------------------------------------------------
// Protein families and the small predicates the rules key on
// ---------------------------------------------------------------------------

/**
 * The `docs/engine.md` §4.6 family table, minus the soya rows (v6 drops them:
 * §13 rules soya chunks masala out of the protein floor, and collapsing the four
 * soya spellings served a step v6 does not have).
 *
 * Every `primaryIngredient` not named here maps to itself, so Paneer, Egg,
 * Fish, Prawn, Mutton, and every non-protein primary is its own family. Keyed on
 * the ingredient label, never on dish names.
 */
const PROTEIN_FAMILY: Record<string, string> = {
  Chicken: "Chicken",
  "Chicken Breast": "Chicken",
  "Chicken Keema": "Chicken",
};

/** The v6 protein family of a dish (§4.6 minus the soya rows). */
export function proteinFamilyV6(dish: Dish): string {
  return PROTEIN_FAMILY[dish.primaryIngredient] ?? dish.primaryIngredient;
}

/**
 * The soya spellings the §4.6 table used to collapse. v6 keeps the set only to
 * honour §13: soya chunks masala's HP tag does not satisfy the day's protein
 * floor, so a soya dish never counts as the day's protein.
 */
const SOYA_PRIMARIES = new Set(["Soyabean Chunk", "Soya Chunk", "Soyabean", "Soya"]);

/**
 * Whether a dish carries the day's protein for the §5.1 day-scoped floor: an
 * HP-family dish (eggs and paneer included) that is not a soya dish (§13).
 */
export function carriesProtein(dish: Dish): boolean {
  return dish.tags.includes("HP") && !SOYA_PRIMARIES.has(dish.primaryIngredient);
}

/**
 * Whether a lunch plate serves rice, for the §5.1 consecutive-rice rule. Same
 * test the production engine uses for its rice-spacing flag: a Category=Rice
 * item on the plate (`engine/src/generateWeek.ts`). A complete meal that
 * contains rice is not a rice carb and does not trip the rule.
 */
function servesRice(plate: Plate, dishById: ReadonlyMap<number, Dish>): boolean {
  return plate.picks.some((pick) => dishById.get(pick.dishId)?.category === "Rice");
}

/** The optional roles a repair may drop or downgrade; every other role is structural. */
const DROPPABLE_ROLES: ReadonlySet<PickRole> = new Set<PickRole>([
  "companion",
  "breakfast-small",
  "accompaniment",
]);

/** Weekday order, Monday first: the last tiebreak of §6 step 5 and the "earliest pair" order. */
export const WEEKDAYS: readonly Day[] = ["Mon", "Tue", "Wed", "Thu", "Fri"];

/** Every scheduled day, Monday to Saturday. Sunday is never generated (§4). */
export const ALL_DAYS: readonly Day[] = [...WEEKDAYS, "Sat"];

const DAY_ORDER = new Map<Day, number>(ALL_DAYS.map((day, index) => [day, index]));

function dayIndex(day: Day): number {
  return DAY_ORDER.get(day) ?? ALL_DAYS.length;
}

// ---------------------------------------------------------------------------
// §6 step 5: assign dishes to days by least-recently-used weekday
// ---------------------------------------------------------------------------

/**
 * Where a plate sits in the §6 step 5 priority order. Lower is assigned first:
 * pinned favorites, then lunch stars by deficit descending, then everything
 * else, and the exploration pick last (amended after the debate, because
 * assigning a never-eaten pick early sent it and its carb to Monday in 10 weeks
 * of 10).
 */
function platePriority(plate: Plate): number {
  if (plate.picks.some((pick) => pick.origin === "exploration")) return 3;
  if (plate.picks.some((pick) => pick.origin === "favorite")) return 0;
  if (plate.picks.some((pick) => pick.role === "star")) return 1;
  return 2;
}

/** The dish whose occupation memory decides a plate's day: its lead pick. */
function leadDishId(plate: Plate): number {
  return plate.picks.length > 0 ? plate.picks[0].dishId : Number.MAX_SAFE_INTEGER;
}

/**
 * Order the plates of one meal group into §6 step 5 assignment order. Fully
 * determined by plate content, never by input order: priority band, then
 * deficit descending inside the star band, then lead dish id ascending.
 */
function assignmentOrder(plates: readonly Plate[]): Plate[] {
  return [...plates].sort((a, b) => {
    const priorityDelta = platePriority(a) - platePriority(b);
    if (priorityDelta !== 0) return priorityDelta;
    const deficitDelta = (b.deficit ?? 0) - (a.deficit ?? 0);
    if (deficitDelta !== 0) return deficitDelta;
    return leadDishId(a) - leadDishId(b);
  });
}

/**
 * Compare two candidate days for one dish, oldest occupation first (§6 step 5).
 *
 * A weekday the dish has never occupied counts as infinitely old and therefore
 * sorts ahead of every occupied one. Ties break by fewest total occupations of
 * that slot, then Monday-first. Never-occupied days tie on both terms and fall
 * through to Monday-first, which is why the exploration pick is assigned last:
 * by then only the days the repertoire did not claim are left.
 */
function compareDaysForDish(
  a: Day,
  b: Day,
  meal: MealKey,
  occupations: ReadonlyMap<string, { lastWeek: string; count: number }> | undefined,
): number {
  const occA = occupations?.get(`${a}:${meal}`);
  const occB = occupations?.get(`${b}:${meal}`);
  if (occA === undefined && occB !== undefined) return -1;
  if (occA !== undefined && occB === undefined) return 1;
  if (occA !== undefined && occB !== undefined) {
    if (occA.lastWeek !== occB.lastWeek) return occA.lastWeek < occB.lastWeek ? -1 : 1;
    if (occA.count !== occB.count) return occA.count - occB.count;
  }
  return dayIndex(a) - dayIndex(b);
}

/**
 * §6 step 5. Give every plate whose `day` is still null the eligible day whose
 * most recent occupation by the plate's lead dish is oldest.
 *
 * Plates are grouped by meal (breakfast, lunch, fruit) because each group has
 * its own days: exactly one breakfast and one lunch per weekday, one fruit per
 * day Monday to Saturday. Plates that arrive with a day already set (every
 * Saturday plate, the Thursday egg-anchored breakfast) hold it and remove that
 * day from their group's supply.
 *
 * Returns a new array in the SAME order as the input with `day` filled, so a
 * caller's indexing survives. The plate-to-day mapping itself is independent of
 * input order. A plate for which no day remains keeps `day: null`; that can only
 * happen when a caller hands over more plates than the week has slots.
 */
export function assignDays(plates: Plate[], stats: RecordStats): Plate[] {
  const assigned = new Map<Plate, Day>();

  for (const meal of ["breakfast", "lunch", "fruit"] as const) {
    const group = plates.filter((plate) => plate.meal === meal);
    const taken = new Set<Day>();
    for (const plate of group) if (plate.day !== null) taken.add(plate.day);

    const supply = (meal === "fruit" ? ALL_DAYS : WEEKDAYS).filter((day) => !taken.has(day));
    const available = new Set<Day>(supply);

    for (const plate of assignmentOrder(group)) {
      if (plate.day !== null) continue;
      if (available.size === 0) continue;
      const occupations = stats.perDish.get(leadDishId(plate))?.occupations;
      const best = [...available].sort((a, b) => compareDaysForDish(a, b, meal, occupations))[0];
      available.delete(best);
      assigned.set(plate, best);
    }
  }

  return plates.map((plate) =>
    plate.day === null && assigned.has(plate)
      ? { ...plate, day: assigned.get(plate) as Day, picks: [...plate.picks] }
      : { ...plate, picks: [...plate.picks] },
  );
}

// ---------------------------------------------------------------------------
// §6 step 6: the constraint pass
// ---------------------------------------------------------------------------

export interface ConstraintPassArgs {
  provider: PoolProvider;
  library: Dish[];
  stats: RecordStats;
}

export interface ConstraintPassResult {
  plates: Plate[];
  repairs: Repair[];
  /**
   * Violations no deterministic repair cleared, as `reason:day` or
   * `reason:day:meal` keys (for example `prep-ceiling:Thu`,
   * `item-ceiling:Wed:lunch`). Stream D reports them; §11 threshold 10 reads
   * the prep-ceiling entries.
   */
  unrepairable: string[];
}

/** A working plate: the same shape with a settled day, mutated only inside this pass. */
interface WorkingPlate {
  meal: MealKey;
  scope: Scope;
  day: Day;
  picks: Array<Omit<PlanPick, "day">>;
  deficit?: number;
}

/** Item ceilings (§4): 2 breakfast items, 3 lunch items, 4 when the protein floor appended. */
function itemCeiling(plate: WorkingPlate): number {
  if (plate.meal === "fruit") return 1;
  if (plate.meal === "breakfast") return 2;
  return plate.picks.some((pick) => pick.role === "floor") ? 4 : 3;
}

export function constraintPass(plates: Plate[], args: ConstraintPassArgs): ConstraintPassResult {
  // `stats` is part of the fixed signature and stays reserved for the pass: every
  // rule below reads the library and the role pools, so nothing consults it today.
  const { provider, library } = args;
  const dishById = new Map<number, Dish>();
  for (const dish of library) dishById.set(dish.id, dish);

  const repairs: Repair[] = [];
  const unrepairable: string[] = [];

  // Plates with no day yet cannot be reasoned about by day; they pass through
  // untouched so a caller that skipped `assignDays` still gets its plates back.
  const undated = plates.filter((plate) => plate.day === null);
  const working: WorkingPlate[] = plates
    .filter((plate) => plate.day !== null)
    .map((plate) => ({ ...plate, day: plate.day as Day, picks: [...plate.picks] }));

  const placedIds = (): Set<number> => {
    const ids = new Set<number>();
    for (const plate of working) for (const pick of plate.picks) ids.add(pick.dishId);
    for (const plate of undated) for (const pick of plate.picks) ids.add(pick.dishId);
    return ids;
  };

  const plateFor = (day: Day, meal: MealKey): WorkingPlate | undefined =>
    working.find((plate) => plate.day === day && plate.meal === meal);

  const dishOf = (pick: Omit<PlanPick, "day">): Dish | undefined => dishById.get(pick.dishId);

  /**
   * Replace one pick with the highest-ranked alternative from its own role pool
   * that is not already in the week and that `accept` admits. Returns the repair,
   * or a drop when the pool offers nothing and the role is optional, or null when
   * the offending pick is structural and irreplaceable.
   */
  const replacePick = (
    plate: WorkingPlate,
    index: number,
    reason: RepairReason,
    accept: (dish: Dish) => boolean,
  ): Repair | null => {
    const replaced = plate.picks[index];
    const exclude = placedIds();
    // A replacement must not re-break a rule an earlier section of this pass
    // already cleared. §5.1's one-gravy-per-lunch is hard and has no fallback,
    // and the cross-meal, item-ceiling and prep-ceiling repairs all run after
    // section 2, so a replacement drawn from the companion pool could otherwise
    // put a second Category Gravy dish back on a lunch that section 2 had just
    // cleared. Re-checking the plate here is cheaper and more exact than a second
    // sweep, because only this function ever adds a dish to an existing plate.
    const plateHoldsGravy =
      plate.meal === "lunch" &&
      plate.picks.some(
        (pick, position) =>
          position !== index && dishById.get(pick.dishId)?.category === "Gravy dish",
      );
    const alternative = provider(replaced.role, replaced.scope, exclude).find(
      (entry) => accept(entry.dish) && !(plateHoldsGravy && entry.dish.category === "Gravy dish"),
    );
    if (alternative) {
      const replacement: Omit<PlanPick, "day"> = {
        meal: replaced.meal,
        dishId: alternative.dish.id,
        role: replaced.role,
        scope: replaced.scope,
        origin: replaced.origin === "favorite" ? "deficit" : replaced.origin,
      };
      plate.picks[index] = replacement;
      const repair: Repair = {
        day: plate.day,
        meal: plate.meal,
        replaced,
        replacement,
        reason,
        swappedWithDay: null,
      };
      repairs.push(repair);
      return repair;
    }
    if (DROPPABLE_ROLES.has(replaced.role)) {
      plate.picks.splice(index, 1);
      const repair: Repair = {
        day: plate.day,
        meal: plate.meal,
        replaced,
        replacement: null,
        reason,
        swappedWithDay: null,
      };
      repairs.push(repair);
      return repair;
    }
    return null;
  };

  /** Swap two whole plates of the same meal between two days (§6 step 6's other repair). */
  const swapPlates = (a: WorkingPlate, b: WorkingPlate, reason: RepairReason): void => {
    const picksA = a.picks;
    const deficitA = a.deficit;
    a.picks = b.picks;
    a.deficit = b.deficit;
    b.picks = picksA;
    b.deficit = deficitA;
    const earlier = dayIndex(a.day) <= dayIndex(b.day) ? a : b;
    const later = earlier === a ? b : a;
    repairs.push({
      day: earlier.day,
      meal: earlier.meal,
      replaced: null,
      replacement: null,
      reason,
      swappedWithDay: later.day,
    });
  };

  // -- 1. The two §4 anchors ------------------------------------------------

  const saturdayLunch = plateFor("Sat", "lunch");
  if (saturdayLunch && saturdayLunch.picks.length > 0 && saturdayLunch.picks[0].role !== "treat") {
    const treat = provider("treat", "saturday", placedIds())[0];
    if (treat) {
      const replaced = saturdayLunch.picks[0];
      const replacement: Omit<PlanPick, "day"> = {
        meal: "lunch",
        dishId: treat.dish.id,
        role: "treat",
        scope: "saturday",
        origin: "deficit",
      };
      saturdayLunch.picks[0] = replacement;
      repairs.push({
        day: "Sat",
        meal: "lunch",
        replaced,
        replacement,
        reason: "anchor",
        swappedWithDay: null,
      });
    } else {
      unrepairable.push("anchor:Sat:lunch");
    }
  }

  const thursdayBreakfast = plateFor("Thu", "breakfast");
  if (thursdayBreakfast) {
    const hasEgg = thursdayBreakfast.picks.some((pick) => {
      const dish = dishOf(pick);
      return dish !== undefined && proteinFamilyV6(dish) === "Egg";
    });
    if (!hasEgg) {
      // §4 anchor 2 allows either form: an egg main, or a light grain main with
      // boiled eggs beside it. Riding the eggs along keeps the household's own
      // main, so it is tried first; replacing the main is the fallback.
      const exclude = placedIds();
      const rider = provider("breakfast-small", "weekdayBreakfast", exclude).find(
        (entry) => proteinFamilyV6(entry.dish) === "Egg",
      );
      const eggMain = provider("breakfast-main", "weekdayBreakfast", exclude).find(
        (entry) => proteinFamilyV6(entry.dish) === "Egg",
      );
      if (rider && thursdayBreakfast.picks.length < 2) {
        const replacement: Omit<PlanPick, "day"> = {
          meal: "breakfast",
          dishId: rider.dish.id,
          role: "breakfast-small",
          scope: "weekdayBreakfast",
          origin: "structural",
        };
        thursdayBreakfast.picks.push(replacement);
        repairs.push({
          day: "Thu",
          meal: "breakfast",
          replaced: null,
          replacement,
          reason: "anchor",
          swappedWithDay: null,
        });
      } else if (eggMain) {
        const replaced = thursdayBreakfast.picks[0];
        const replacement: Omit<PlanPick, "day"> = {
          meal: "breakfast",
          dishId: eggMain.dish.id,
          role: "breakfast-main",
          scope: "weekdayBreakfast",
          origin: "structural",
        };
        if (replaced) thursdayBreakfast.picks[0] = replacement;
        else thursdayBreakfast.picks.push(replacement);
        repairs.push({
          day: "Thu",
          meal: "breakfast",
          replaced: replaced ?? null,
          replacement,
          reason: "anchor",
          swappedWithDay: null,
        });
      } else {
        unrepairable.push("anchor:Thu:breakfast");
      }
    }
  }

  // -- 2. One gravy per lunch, hard, no fallback (§5.1) ---------------------

  for (const plate of working) {
    if (plate.meal !== "lunch") continue;
    let gravySeen = false;
    for (let index = 0; index < plate.picks.length; index += 1) {
      const dish = dishOf(plate.picks[index]);
      if (dish?.category !== "Gravy dish") continue;
      if (!gravySeen) {
        gravySeen = true;
        continue;
      }
      const repair = replacePick(
        plate,
        index,
        "one-gravy-per-lunch",
        (candidate) => candidate.category !== "Gravy dish",
      );
      if (repair === null) {
        unrepairable.push(`one-gravy-per-lunch:${plate.day}:lunch`);
      } else if (repair.replacement === null) {
        index -= 1;
      }
    }
  }

  // -- 3. Cross-meal protein family, then exact primary ingredient (§5.1) ---

  /**
   * The keys a day's breakfast contributes, by family or by exact ingredient.
   * A lunch pick that repeats one is demoted; §5.1 resolves the repeat by
   * moving the whole lunch to another day first, and only then by swapping the
   * offending dish out, because a plate swap keeps both plates intact.
   */
  const breakfastKeys = (day: Day, byFamily: boolean): Set<string> => {
    const plate = plateFor(day, "breakfast");
    const keys = new Set<string>();
    if (!plate) return keys;
    for (const pick of plate.picks) {
      const dish = dishOf(pick);
      if (dish) keys.add(byFamily ? proteinFamilyV6(dish) : dish.primaryIngredient);
    }
    return keys;
  };

  const lunchKeys = (plate: WorkingPlate, byFamily: boolean): Set<string> => {
    const keys = new Set<string>();
    for (const pick of plate.picks) {
      const dish = dishOf(pick);
      if (dish) keys.add(byFamily ? proteinFamilyV6(dish) : dish.primaryIngredient);
    }
    return keys;
  };

  const conflicts = (plate: WorkingPlate, day: Day, byFamily: boolean): boolean => {
    const morning = breakfastKeys(day, byFamily);
    for (const key of lunchKeys(plate, byFamily)) if (morning.has(key)) return true;
    return false;
  };

  const resolveCrossMeal = (byFamily: boolean): void => {
    const reason: RepairReason = byFamily ? "protein-family" : "primary-ingredient";
    for (const day of WEEKDAYS) {
      const plate = plateFor(day, "lunch");
      if (!plate || !conflicts(plate, day, byFamily)) continue;

      // A whole-plate swap first, earliest partner day first: it repairs the
      // clash without removing a dish the household's rates chose.
      const partner = WEEKDAYS.filter((other) => other !== day)
        .map((other) => plateFor(other, "lunch"))
        .find(
          (other): other is WorkingPlate =>
            other !== undefined &&
            !conflicts(other, day, byFamily) &&
            !conflicts(plate, other.day, byFamily),
        );
      if (partner) {
        swapPlates(plate, partner, reason);
        continue;
      }

      // Otherwise replace the offending picks, last pick first so the lead (the
      // star) is the last thing the pass gives up.
      const morning = breakfastKeys(day, byFamily);
      for (let index = plate.picks.length - 1; index >= 0; index -= 1) {
        const dish = dishOf(plate.picks[index]);
        if (!dish) continue;
        const key = byFamily ? proteinFamilyV6(dish) : dish.primaryIngredient;
        if (!morning.has(key)) continue;
        replacePick(plate, index, reason, (candidate) => {
          const candidateKey = byFamily ? proteinFamilyV6(candidate) : candidate.primaryIngredient;
          return !morning.has(candidateKey);
        });
        // §5.1: "if no alternative exists the repeat is allowed", so a null
        // repair here is not a violation and is not reported.
      }
    }
  };

  resolveCrossMeal(true);
  resolveCrossMeal(false);

  // -- 4. Rice on consecutive days, soft (§5.1) -----------------------------

  const riceDays = (): Day[] =>
    WEEKDAYS.filter((day) => {
      const plate = plateFor(day, "lunch");
      return plate !== undefined && servesRice(plate, dishById);
    });

  const firstConsecutiveRicePair = (): [Day, Day] | null => {
    const days = riceDays();
    for (let index = 0; index + 1 < days.length; index += 1) {
      if (dayIndex(days[index + 1]) - dayIndex(days[index]) === 1) {
        return [days[index], days[index + 1]];
      }
    }
    return null;
  };

  let ricePair = firstConsecutiveRicePair();
  let riceAttempts = 0;
  while (ricePair !== null && riceAttempts < WEEKDAYS.length) {
    riceAttempts += 1;
    const [earlier, later] = ricePair;
    const offender = plateFor(later, "lunch");
    let swapped = false;
    if (offender) {
      // Try every other weekday lunch, earliest first: the first exchange that
      // leaves no consecutive rice pair anywhere wins (§6 step 6, earliest pair).
      for (const other of WEEKDAYS) {
        if (other === later || other === earlier) continue;
        const partner = plateFor(other, "lunch");
        if (!partner) continue;
        swapPlates(offender, partner, "consecutive-rice");
        if (firstConsecutiveRicePair() === null) {
          swapped = true;
          break;
        }
        // Undo: the swap did not clear it, and a repair that does not repair is
        // not a repair. Both the plate state and the reported repair roll back.
        swapPlates(offender, partner, "consecutive-rice");
        repairs.splice(repairs.length - 2, 2);
      }
    }
    if (!swapped) {
      // §5.1 is explicit that this rule is soft: accept the violation.
      break;
    }
    ricePair = firstConsecutiveRicePair();
  }

  // -- 5. The day-scoped protein floor (§5.1) -------------------------------

  for (const day of WEEKDAYS) {
    const lunch = plateFor(day, "lunch");
    if (!lunch) continue;
    const breakfast = plateFor(day, "breakfast");
    const dayPicks = [...(breakfast?.picks ?? []), ...lunch.picks];
    const hasProtein = dayPicks.some((pick) => {
      const dish = dishOf(pick);
      return dish !== undefined && carriesProtein(dish);
    });
    if (hasProtein) continue;
    // Saturday is exempt entirely (§5.1) and is not in WEEKDAYS, so nothing
    // extra is needed here. The floor pool itself carries the category
    // restriction (Keto or Dry dish, never a Gravy dish or a complete meal,
    // soya excluded); stream B owns that definition.
    const floor = provider("floor", "weekdayLunch", placedIds())[0];
    if (!floor) {
      unrepairable.push(`protein-floor:${day}:lunch`);
      continue;
    }
    const replacement: Omit<PlanPick, "day"> = {
      meal: "lunch",
      dishId: floor.dish.id,
      role: "floor",
      scope: "weekdayLunch",
      origin: "structural",
    };
    lunch.picks.push(replacement);
    repairs.push({
      day,
      meal: "lunch",
      replaced: null,
      replacement,
      reason: "protein-floor",
      swappedWithDay: null,
    });
  }

  // -- 6. Item ceilings (§4) ------------------------------------------------

  for (const plate of working) {
    while (plate.picks.length > itemCeiling(plate)) {
      let dropIndex = -1;
      for (let index = plate.picks.length - 1; index >= 0; index -= 1) {
        if (DROPPABLE_ROLES.has(plate.picks[index].role)) {
          dropIndex = index;
          break;
        }
      }
      if (dropIndex === -1) {
        unrepairable.push(`item-ceiling:${plate.day}:${plate.meal}`);
        break;
      }
      const replaced = plate.picks[dropIndex];
      plate.picks.splice(dropIndex, 1);
      repairs.push({
        day: plate.day,
        meal: plate.meal,
        replaced,
        replacement: null,
        reason: "item-ceiling",
        swappedWithDay: null,
      });
    }
  }

  // -- 7. The 120-minute whole-day prep ceiling (§5.1) ----------------------

  const PREP_CEILING_MINUTES = 120;

  for (const day of ALL_DAYS) {
    const dayPlates = working.filter(
      (plate) => plate.day === day && (plate.meal === "breakfast" || plate.meal === "lunch"),
    );
    const minutes = (): number =>
      dayPlates.reduce(
        (total, plate) =>
          total + plate.picks.reduce((sum, pick) => sum + (dishOf(pick)?.prepMinutes ?? 0), 0),
        0,
      );

    while (minutes() > PREP_CEILING_MINUTES) {
      // The longest-prep droppable companion goes first; ties by dish id.
      let target: { plate: WorkingPlate; index: number; prep: number; dishId: number } | null =
        null;
      for (const plate of dayPlates) {
        for (let index = 0; index < plate.picks.length; index += 1) {
          const pick = plate.picks[index];
          if (!DROPPABLE_ROLES.has(pick.role)) continue;
          const prep = dishOf(pick)?.prepMinutes ?? 0;
          if (
            target === null ||
            prep > target.prep ||
            (prep === target.prep && pick.dishId < target.dishId)
          ) {
            target = { plate, index, prep, dishId: pick.dishId };
          }
        }
      }
      if (target === null) break;
      const shortest = target.prep;
      // "replaced by the next-ranked shorter alternative, or dropped if none fits"
      const repair = replacePick(
        target.plate,
        target.index,
        "prep-ceiling",
        (candidate) => candidate.prepMinutes < shortest,
      );
      if (repair === null) break;
    }

    if (minutes() > PREP_CEILING_MINUTES) unrepairable.push(`prep-ceiling:${day}`);
  }

  // Reassemble in the caller's original order so stream D's indexing survives.
  const byOriginal = new Map<Plate, WorkingPlate>();
  let cursor = 0;
  for (const plate of plates) {
    if (plate.day !== null) {
      byOriginal.set(plate, working[cursor]);
      cursor += 1;
    }
  }
  const resultPlates: Plate[] = plates.map((plate) => {
    const settled = byOriginal.get(plate);
    if (!settled) return { ...plate, picks: [...plate.picks] };
    return {
      meal: settled.meal,
      scope: settled.scope,
      day: settled.day,
      picks: settled.picks,
      ...(settled.deficit === undefined ? {} : { deficit: settled.deficit }),
    };
  });

  return { plates: resultPlates, repairs, unrepairable };
}
