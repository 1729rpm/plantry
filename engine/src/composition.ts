import type { Dish, DishTag, MenuHistoryRow, Season } from "./data/schemas.js";
import type { Day } from "./eligibility.js";
import { eligibleDishes } from "./eligibility.js";
import { lastCookedMap } from "./historyRows.js";
import type { SlotPlan } from "./schedule.js";

/**
 * A per-position candidate pool returned by composeSlot. Each kind mirrors a
 * sub-clause of docs/engine.md §3; ranking among pools is §4's job.
 */
export type CandidateSet =
  | BreakfastWeekdayPairCandidateSet
  | BreakfastSinglePickCandidateSet
  | Menu1CandidateSet
  | Menu2CandidateSet
  | Menu3CandidateSet
  | Menu4CandidateSet;

export interface BreakfastWeekdayPairCandidateSet {
  kind: "breakfast-pair";
  optionB: { completeCarb: Dish[]; accompaniment: Dish[] };
  optionC: { dryMain: Dish[]; plainCarb: Dish[] };
}

export interface BreakfastSinglePickCandidateSet {
  kind: "breakfast-single";
  pool: Dish[];
  /**
   * §3 R3 breakfast protein floor companion pool: HP Category=Keto breakfast
   * dishes (boiled eggs, keto bhurji). When the picked single main carries no
   * `HP` tag, `pickBreakfastSingle` appends the top-ranked companion here,
   * making a 2-item breakfast. Empty pool → the floor degrades to the 1-item
   * breakfast. Picked from this pool only at HP count 0, so it never produces
   * two HP in the meal (it composes with one-HP-per-meal).
   */
  ketoCompanion: Dish[];
  /**
   * §3 dish-driven breakfast chutney pool: every eligible Category=Accompaniment
   * Breakfast dish. `pickBreakfastSingle` appends one chutney from here when the
   * picked single main is a Chilla or Paratha (`breakfastMainCarriesChutney`),
   * so a cheela/paratha breakfast carries its chutney even on the single pick.
   * Empty pool → the chutney is simply omitted.
   */
  chutney: Dish[];
}

export interface Menu1CandidateSet {
  kind: "menu-1";
  hp: Dish[];
  /**
   * §3 R4 thali dal: the non-HP Gravy pool. The field name is historical (it
   * was the partner used when the HP main was a Dry dish); the Indian weekday
   * lunch now always aspires to the 4-item thali, so this dal sits beside the
   * protein main on every Menu 1 day, not only Dry-main days.
   */
  partnerWhenHpIsDry: Dish[];
  /**
   * §3 R4 thali dry sabzi: the non-HP Dry pool. The field name is historical
   * (it was the partner used when the HP main was a Gravy dish); like the dal
   * above it is now always part of the 4-item thali aspiration. Non-HP: one HP
   * source per meal (the protein main is the only HP position).
   */
  partnerWhenHpIsGravy: Dish[];
  lunchCarb: Dish[];
}

export interface Menu2CandidateSet {
  kind: "menu-2";
  keto: Dish[];
  nonHpGravy: Dish[];
  nonHpDry: Dish[];
  lunchCarb: Dish[];
}

export interface Menu3CandidateSet {
  kind: "menu-3";
  completeMealHp: Dish[];
  accompaniment: Dish[];
  dessert: Dish[];
}

export interface Menu4CandidateSet {
  kind: "menu-4";
  completeMealNonHp: Dish[];
  keto: Dish[];
  accompaniment: Dish[];
}

export interface ComposeSlotArgs {
  slot: SlotPlan;
  library: Dish[];
  history: MenuHistoryRow[];
  season: Season;
  /** Lunch carbs already picked elsewhere in the week. Used by §3.1. */
  weekLunchCarbs?: Dish[];
}

/** Composition entry point. Mirrors docs/engine.md §3. */
export function composeSlot(args: ComposeSlotArgs): CandidateSet {
  const { slot, library, history, season } = args;
  const eligible = eligibleDishes({
    library,
    history,
    season,
    slot: { day: slot.day, meal: slot.meal },
  });

  if (slot.meal === "Breakfast") {
    if (isBigBreakfastDay(slot.day)) {
      return breakfastWeekdayPair(eligible);
    }
    return breakfastSinglePick(eligible);
  }

  switch (slot.lunchMenu) {
    case 1:
      return menu1(eligible, args.weekLunchCarbs ?? []);
    case 2:
      return menu2(eligible, args.weekLunchCarbs ?? []);
    case 3:
      return menu3(eligible);
    case 4:
      return menu4(eligible);
    default:
      throw new Error(`composeSlot: lunch slot missing lunchMenu (${slot.day} ${slot.meal})`);
  }
}

/**
 * Flatten a candidate set into its position pools, in their natural order. A
 * dish appears here iff §3 composition accepts it in some position of the slot.
 * Used by the swap picker (rankCandidatesForSlot) to union the pools and by the
 * §6 requested-dishes planner to test whether a slot's composition accepts a
 * requested dish.
 */
export function candidateSetPools(set: CandidateSet): Dish[][] {
  switch (set.kind) {
    case "breakfast-pair":
      return [
        set.optionB.completeCarb,
        set.optionB.accompaniment,
        set.optionC.dryMain,
        set.optionC.plainCarb,
      ];
    case "breakfast-single":
      return [set.pool, set.ketoCompanion, set.chutney];
    case "menu-1":
      return [set.hp, set.partnerWhenHpIsDry, set.partnerWhenHpIsGravy, set.lunchCarb];
    case "menu-2":
      return [set.keto, set.nonHpGravy, set.nonHpDry, set.lunchCarb];
    case "menu-3":
      return [set.completeMealHp, set.accompaniment, set.dessert];
    case "menu-4":
      return [set.completeMealNonHp, set.keto, set.accompaniment];
  }
}

function isBigBreakfastDay(day: Day): boolean {
  return day === "Mon" || day === "Wed" || day === "Fri";
}

function hasTag(dish: Dish, tag: DishTag): boolean {
  return dish.tags.includes(tag);
}

/** True when the dish carries the high-protein tag (§3 one-HP-per-meal input). */
export function isHp(dish: Dish): boolean {
  return hasTag(dish, "HP");
}

/**
 * §3 self-sufficient main signal. A dish that fills its slot alone, taking no
 * separate carb and no accompaniment. The union is required: White sauce pasta
 * is Category=Complete meal but is NOT `complete_meal`-tagged, so the tag alone
 * misses it. Keyed on tag/category, never on dish names.
 */
export function isSelfSufficientMain(dish: Dish): boolean {
  return hasTag(dish, "complete_meal") || dish.category === "Complete meal";
}

/**
 * §3 R1 breakfast Option B served-alone signal. A `complete_carb` lead is
 * served without its accompaniment only when it is a Category=Bread dish
 * (avocado toast, masala toast). A Chilla or Paratha `complete_carb` keeps its
 * accompaniment (garlic chutney with cheela, etc.). Keyed on category, never on
 * dish names.
 */
export function isStandaloneBreakfastBread(dish: Dish): boolean {
  return hasTag(dish, "complete_carb") && dish.category === "Bread";
}

const BREAKFAST_CHUTNEY_CARRIER_CATEGORIES = new Set(["Chilla", "Paratha"]);

/**
 * §3 dish-driven breakfast chutney signal. A breakfast main whose Category is
 * Chilla or Paratha carries a breakfast chutney (Category=Accompaniment,
 * Time=Breakfast) in ANY breakfast slot, including the Tue/Thu single pick.
 * This makes the accompaniment a property of the main dish rather than of the
 * slot form: Option B already pairs a chutney with its Chilla/Paratha
 * complete_carb lead, and the single pick now does the same. Keyed on category,
 * never on dish names. The Category=Bread "served alone" suppression
 * (`isStandaloneBreakfastBread`) is unaffected: Bread is not a carrier.
 */
export function breakfastMainCarriesChutney(dish: Dish): boolean {
  return BREAKFAST_CHUTNEY_CARRIER_CATEGORIES.has(dish.category);
}

/**
 * §3 one-HP-source-per-meal filter, applied to a non-main position pool once an
 * HP dish already occupies the meal. A single meal (a day's breakfast or a day's
 * lunch) carries AT MOST ONE HP-tagged dish, so when an earlier position of the
 * meal took an HP dish, the remaining positions drop HP-tagged candidates. This
 * is keyed on the `HP` tag, never on dish names, so it holds for any HP protein
 * (chicken on chicken, paneer on paneer) and across every menu form.
 *
 * Thin-pool fallback: if removing HP-tagged dishes would empty the pool, the
 * unfiltered pool is returned so the slot still fills (one HP-main meal with a
 * second HP side beats an incomplete meal). This is rare given the broad
 * companion pools and surfaces as composition signal for the slow loop, not a
 * hard error. When `mealHasHp` is false the pool is returned unchanged.
 */
export function excludeHpIfMealHasHp(pool: Dish[], mealHasHp: boolean): Dish[] {
  if (!mealHasHp) return pool;
  const nonHp = pool.filter((d) => !isHp(d));
  return nonHp.length > 0 ? nonHp : pool;
}

const PLAIN_BREAKFAST_CARB_CATEGORIES = new Set(["Bread", "Paratha", "Chilla"]);

/** §3 Breakfast Mon/Wed/Fri Option B: complete_carb + breakfast accompaniment. */
export function breakfastOptionB(eligible: Dish[]): {
  completeCarb: Dish[];
  accompaniment: Dish[];
} {
  return {
    completeCarb: eligible.filter((d) => d.time === "Breakfast" && hasTag(d, "complete_carb")),
    accompaniment: eligible.filter((d) => d.time === "Breakfast" && d.category === "Accompaniment"),
  };
}

/** §3 Breakfast Mon/Wed/Fri Option C: breakfast dry main + plain breakfast carb. */
export function breakfastOptionC(eligible: Dish[]): {
  dryMain: Dish[];
  plainCarb: Dish[];
} {
  return {
    dryMain: eligible.filter((d) => d.time === "Breakfast" && d.category === "Dry dish"),
    plainCarb: eligible.filter(
      (d) =>
        d.time === "Breakfast" &&
        PLAIN_BREAKFAST_CARB_CATEGORIES.has(d.category) &&
        !hasTag(d, "complete_carb"),
    ),
  };
}

/**
 * §3 Breakfast Mon/Wed/Fri composite: exposes both savoury options as pools.
 * Breakfast is savoury only (the fruit-bearing Option A is retired; fruit is
 * now the standalone Fruit of the day, §3.3 / the engine's per-day fruit pick).
 */
export function breakfastWeekdayPair(eligible: Dish[]): BreakfastWeekdayPairCandidateSet {
  return {
    kind: "breakfast-pair",
    optionB: breakfastOptionB(eligible),
    optionC: breakfastOptionC(eligible),
  };
}

/**
 * §3.3 Fruit of the day candidate pool. Every eligible (Active, in-season)
 * Category=Fruit dish. Selection (longest-unused) is §4's job, applied by
 * generateWeek; this function only defines the composition-eligible set. Fruit
 * is its own day-level section, outside breakfast and lunch and outside the §9
 * cap, so it has no CandidateSet kind: it is picked directly, not through the
 * slot pipeline.
 */
export function fruitOfDayPool(eligible: Dish[]): Dish[] {
  return eligible.filter((d) => d.category === "Fruit");
}

/**
 * §3 Breakfast Tue/Thu single pick: complete_meal OR complete_carb, plus the §3
 * R3 protein-floor companion pool (HP Category=Keto breakfast dishes). The main
 * is picked from `pool`; if it carries no `HP` tag, `pickBreakfastSingle`
 * appends one companion from `ketoCompanion` for a 2-item breakfast.
 */
export function breakfastSinglePick(eligible: Dish[]): BreakfastSinglePickCandidateSet {
  const breakfast = eligible.filter((d) => d.time === "Breakfast");
  return {
    kind: "breakfast-single",
    pool: breakfast.filter((d) => hasTag(d, "complete_meal") || hasTag(d, "complete_carb")),
    ketoCompanion: breakfast.filter((d) => isHp(d) && d.category === "Keto"),
    chutney: breakfast.filter((d) => d.category === "Accompaniment"),
  };
}

/**
 * §3 Menu 1 (Mon/Wed/Fri lunch): the 4-item Indian thali aspiration, HP protein
 * main + non-HP dal (Gravy) + non-HP dry sabzi (Dry) + lunch carb. Same form as
 * Menu 2 but the protein main is an HP Gravy/Dry dish rather than a Keto dish.
 *
 * The protein main is the only HP position (one HP source per meal), so both the
 * dal and the sabzi pools exclude HP-tagged dishes (keyed on the `HP` tag, not
 * on dish names, so it holds for any HP protein: chicken on chicken, paneer on
 * paneer). The 4-item aspiration is day-budgeted by the §9 role-aware cap, which
 * drops the dry sabzi (a companion side) on a full-breakfast day, so a Menu 1
 * day lands at the 5-item cap as a 3-item lunch (main + dal + carb) and a
 * light-breakfast day keeps all four. Complete_meal lunches are exempt (a
 * self-sufficient main fills its slot alone), so they reach the Menu 3/Menu 4
 * forms rather than this thali.
 */
export function menu1(eligible: Dish[], weekLunchCarbs: Dish[]): Menu1CandidateSet {
  const lunch = eligible.filter((d) => d.time === "Lunch");
  return {
    kind: "menu-1",
    hp: lunch.filter(
      (d) => hasTag(d, "HP") && (d.category === "Gravy dish" || d.category === "Dry dish"),
    ),
    // Thali dal (non-HP Gravy) and dry sabzi (non-HP Dry); see field docs.
    partnerWhenHpIsDry: lunch.filter((d) => !hasTag(d, "HP") && d.category === "Gravy dish"),
    partnerWhenHpIsGravy: lunch.filter((d) => !hasTag(d, "HP") && d.category === "Dry dish"),
    lunchCarb: lunchCarbPool(eligible, weekLunchCarbs),
  };
}

/** §3 Menu 2 (Tue/Thu lunch): Keto + non-HP Gravy + non-HP Dry + lunch carb. */
export function menu2(eligible: Dish[], weekLunchCarbs: Dish[]): Menu2CandidateSet {
  const lunch = eligible.filter((d) => d.time === "Lunch");
  return {
    kind: "menu-2",
    keto: lunch.filter((d) => d.category === "Keto"),
    nonHpGravy: lunch.filter((d) => !hasTag(d, "HP") && d.category === "Gravy dish"),
    nonHpDry: lunch.filter((d) => !hasTag(d, "HP") && d.category === "Dry dish"),
    lunchCarb: lunchCarbPool(eligible, weekLunchCarbs),
  };
}

/** §3 Menu 3 (Saturday): complete_meal+HP + Accompaniment + Dessert. */
export function menu3(eligible: Dish[]): Menu3CandidateSet {
  const lunch = eligible.filter((d) => d.time === "Lunch");
  return {
    kind: "menu-3",
    completeMealHp: lunch.filter((d) => hasTag(d, "complete_meal") && hasTag(d, "HP")),
    accompaniment: lunch.filter((d) => d.category === "Accompaniment"),
    dessert: lunch.filter((d) => d.category === "Dessert"),
  };
}

/** §3 Menu 4 (Saturday): complete_meal-non-HP + Keto + Accompaniment. */
export function menu4(eligible: Dish[]): Menu4CandidateSet {
  const lunch = eligible.filter((d) => d.time === "Lunch");
  return {
    kind: "menu-4",
    completeMealNonHp: lunch.filter((d) => hasTag(d, "complete_meal") && !hasTag(d, "HP")),
    keto: lunch.filter((d) => d.category === "Keto"),
    accompaniment: lunch.filter((d) => d.category === "Accompaniment"),
  };
}

/**
 * §3.1 lunch carb rule. Default: Chapati. Rice appears at most once per week,
 * so once any weekLunchCarbs contains a Rice dish, Rice drops from the pool.
 * The recency rule does not apply here (§4), so history is not consulted.
 */
export function lunchCarbPool(eligible: Dish[], weekLunchCarbs: Dish[]): Dish[] {
  const riceAlreadyUsed = weekLunchCarbs.some((d) => d.category === "Rice");
  return eligible.filter((d) => {
    if (d.time !== "Lunch") return false;
    if (d.category === "Chapati") return true;
    if (d.category === "Rice") return !riceAlreadyUsed;
    return false;
  });
}

export type WeekdaySubstitutionDay = "Mon" | "Tue" | "Wed" | "Thu" | "Fri";
export type WeekdaySubstitutionForm = "menu-3" | "menu-4";

export interface WeekdaySubstitutionDecision {
  day: WeekdaySubstitutionDay;
  form: WeekdaySubstitutionForm;
  leadDishId: number;
}

export interface ShouldSubstituteWeekdayArgs {
  library: Dish[];
  history: MenuHistoryRow[];
  season: Season;
  /** Optional user-requested complete_meal Lunch dish; forces substitution. */
  userRequestedDishId?: number;
}

const WEEKDAYS_FOR_SUBSTITUTION: WeekdaySubstitutionDay[] = ["Mon", "Tue", "Wed", "Thu", "Fri"];

const LUNCH_MENU_BY_WEEKDAY: Record<WeekdaySubstitutionDay, 1 | 2> = {
  Mon: 1,
  Tue: 2,
  Wed: 1,
  Thu: 2,
  Fri: 1,
};

/**
 * §3.2 weekday complete_meal substitution trigger. Returns the weekday and
 * Menu 3 / Menu 4 form to substitute, or null. Two triggers: a user-requested
 * complete_meal Lunch dish (optional argument) or the longest-unused eligible
 * complete_meal Lunch dish being older than the protein candidate (HP for
 * Menu 1, Keto for Menu 2) that would otherwise fill the slot.
 */
export function shouldSubstituteWeekday(
  args: ShouldSubstituteWeekdayArgs,
): WeekdaySubstitutionDecision | null {
  const { library, history, season, userRequestedDishId } = args;

  const lunchEligible = eligibleDishes({
    library,
    history,
    season,
    slot: { day: "Mon", meal: "Lunch" },
  }).filter((d) => d.time === "Lunch");

  const completeMealLunch = lunchEligible.filter((d) => hasTag(d, "complete_meal"));

  if (userRequestedDishId !== undefined) {
    const requested = completeMealLunch.find((d) => d.id === userRequestedDishId);
    if (!requested) return null;
    return {
      day: pickEarliestSubstitutionDay(),
      form: formFor(requested),
      leadDishId: requested.id,
    };
  }

  if (completeMealLunch.length === 0) return null;

  const lastCooked = lastCookedMap(history);
  const completeMealLead = pickLongestUnused(completeMealLunch, lastCooked);
  if (!completeMealLead) return null;
  const leadDate = lastCooked.get(completeMealLead.id);

  for (const day of WEEKDAYS_FOR_SUBSTITUTION) {
    const menuType = LUNCH_MENU_BY_WEEKDAY[day];
    const proteinCandidates =
      menuType === 1
        ? lunchEligible.filter(
            (d) => hasTag(d, "HP") && (d.category === "Gravy dish" || d.category === "Dry dish"),
          )
        : lunchEligible.filter((d) => d.category === "Keto");
    const proteinLead = pickLongestUnused(proteinCandidates, lastCooked);
    if (!proteinLead) continue;
    const proteinDate = lastCooked.get(proteinLead.id);
    if (isOlder(leadDate, proteinDate)) {
      return {
        day,
        form: formFor(completeMealLead),
        leadDishId: completeMealLead.id,
      };
    }
  }
  return null;
}

function formFor(dish: Dish): WeekdaySubstitutionForm {
  return hasTag(dish, "HP") ? "menu-3" : "menu-4";
}

function pickEarliestSubstitutionDay(): WeekdaySubstitutionDay {
  return WEEKDAYS_FOR_SUBSTITUTION[0];
}

function pickLongestUnused(pool: Dish[], lastCooked: Map<number, string>): Dish | null {
  if (pool.length === 0) return null;
  let best: Dish | null = null;
  let bestDate: string | undefined;
  for (const dish of pool) {
    const date = lastCooked.get(dish.id);
    if (isOlder(date, bestDate)) {
      best = dish;
      bestDate = date;
    } else if (best === null) {
      best = dish;
      bestDate = date;
    }
  }
  return best;
}

/** Treat "never cooked" (undefined) as the oldest possible date. */
function isOlder(a: string | undefined, b: string | undefined): boolean {
  if (a === undefined && b === undefined) return false;
  if (a === undefined) return true;
  if (b === undefined) return false;
  return a < b;
}
