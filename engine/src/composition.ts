import type { Dish, DishTag, MenuHistoryRow, Season } from "./data/schemas.js";
import type { Day } from "./eligibility.js";
import { eligibleDishes } from "./eligibility.js";
import { WEEKDAY_CAP } from "./cap.js";
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
  | Menu4CandidateSet
  | MenuIntlCandidateSet;

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

/**
 * §3.2 weekday-plate form (Menu 1). The Indian weekday lunch composes to the day
 * budget (§3.1): a protein lead, an affinity-driven carb, and budget-filled
 * companions, with at most one Category=Gravy dish item on the plate (the hard
 * one-wet rule). Menu 1 leads with an HP Gravy/Dry protein; Menu 2 leads with a
 * Keto dish; the rest of the form is identical, which is why they share the
 * companion, protein-floor, and carb pools.
 */
export interface Menu1CandidateSet {
  kind: "menu-1";
  /** Protein lead: HP-tagged, Category in {Gravy dish, Dry dish}, Indian. */
  hp: Dish[];
  /**
   * §3.2 companion pool: eligible non-HP Indian Lunch dishes, Category in
   * {Gravy dish, Dry dish, Accompaniment}. The pick fills `lunchBudget - 2`
   * positions from this pool (one or two), ranked by §4, enforcing the hard
   * one-Gravy-per-plate rule (no thin-pool fallback). Roles map by category:
   * Gravy dish → `dal`, Dry dish → `sabzi`, Accompaniment → `accompaniment`.
   */
  companions: Dish[];
  /**
   * §3.3 lunch protein floor pool: eligible Indian (or `cuisine_neutral`) Lunch
   * dishes with the HP tag or Category=Keto. Menu 1/2 satisfy the floor by
   * construction (the lead is HP/Keto), so this only fires on the carb-only
   * fallback when no protein lead is eligible.
   */
  proteinFloor: Dish[];
  /** §3.4 carb affinity Rice pool: plain Category=Rice Lunch dishes. */
  riceCarb: Dish[];
  /** §3.4 default/Roti carb pool: plain Category=Chapati Lunch dishes. */
  chapatiCarb: Dish[];
}

export interface Menu2CandidateSet {
  kind: "menu-2";
  /** Protein lead: Category=Keto, Indian. */
  keto: Dish[];
  companions: Dish[];
  proteinFloor: Dish[];
  riceCarb: Dish[];
  chapatiCarb: Dish[];
}

export interface Menu3CandidateSet {
  kind: "menu-3";
  completeMealHp: Dish[];
  accompaniment: Dish[];
  dessert: Dish[];
  /** §3.3 protein floor pool (Indian register). No-ops: the lead is always HP. */
  proteinFloor: Dish[];
}

export interface Menu4CandidateSet {
  kind: "menu-4";
  completeMealNonHp: Dish[];
  keto: Dish[];
  accompaniment: Dish[];
  /** §3.3 protein floor pool (Indian register). Fires only if the Keto pool is empty. */
  proteinFloor: Dish[];
}

/**
 * §3 Menu intl: the coherent non-Indian weekday lunch form. One non-Indian
 * anchor main, at most one same-cuisine-or-neutral companion, and NO Indian
 * carb. The §3.2 weekday substitution pins which anchor runs on which day
 * (`intlAnchorDishId` on the SlotPlan); `menuIntl` builds the companion pools
 * keyed on THAT anchor's cuisine, so the meal stays in one register. A cuisine
 * whose carb is built into the dish (a noodle/rice complete_meal) needs nothing
 * else; a veg-forward anchor gets one protein; a protein anchor gets at most one
 * veg side. Keyed on the `cuisine` field and the `cuisine_neutral` tag, never on
 * dish names. Thin pools degrade to the anchor alone (a valid 1-item meal).
 */
export interface MenuIntlCandidateSet {
  kind: "menu-intl";
  /**
   * The non-Indian anchor pool (Active, in-season, Lunch, Category in
   * {Gravy dish, Dry dish, Keto, Complete meal}). The substitution pins one of
   * these via `intlAnchorDishId`; the full pool is kept for the ranked fallback.
   */
  anchor: Dish[];
  /**
   * Protein companion for a veg-forward anchor (anchor not HP and not Keto and
   * not a complete_meal): a same-cuisine-or-neutral HP/Keto dish. This is the
   * "veggies need a protein" case. Empty for a self-sufficient or already-protein
   * anchor (the pick function only draws it for a veg-forward anchor).
   */
  proteinCompanion: Dish[];
  /**
   * Side companion for a protein anchor (HP or Keto, not a complete_meal): at
   * most one same-cuisine-or-neutral NON-HP side (Accompaniment, or a non-HP
   * Dry/Gravy veg). One HP source per meal holds: the anchor is the HP position.
   */
  sideCompanion: Dish[];
  /**
   * §3.4 international carb pool: plain Category=Rice Lunch dishes carrying the
   * `cuisine_neutral` tag (register-neutral steamed rice). Drawn only when the
   * pinned anchor has `carbAffinity: Rice` and rice did not land the previous day
   * (the hard rice-spacing rule); a Thai curry then carries rice while the plate
   * stays coherent. The intl form never takes an Indian carb otherwise.
   */
  neutralRiceCarb: Dish[];
}

export interface ComposeSlotArgs {
  slot: SlotPlan;
  library: Dish[];
  history: MenuHistoryRow[];
  season: Season;
  /**
   * Retained for the §6 requested-dishes planner (requests.ts) call shape. The
   * §3 carb rule no longer reads it: carb affinity (§3.4) picks the carb pool and
   * the hard rice-spacing rule lives in generation (generateWeek), not
   * composition. Passing it is a harmless no-op.
   */
  weekLunchCarbs?: Dish[];
}

/**
 * §3.1 hard per-lunch item ceiling. A lunch never composes more than four items;
 * the day budget clamps to this, so a lunch is budget-fit by construction and the
 * §9 cap is a safety net that should not fire in normal generation.
 */
export const LUNCH_MAX_ITEMS = 4;

/**
 * §3.1 budget-aware lunch item count. Breakfast composes first; the lunch then
 * composes to `clamp(WEEKDAY_CAP - breakfastItemCount, 2, LUNCH_MAX_ITEMS)`
 * items instead of composing four and trimming after. Mon/Wed/Fri (2-item
 * breakfast) budget three; Tue/Thu (1-item breakfast) budget four. Saturday keeps
 * its own 3-item Menu 3/4 forms and does not use this.
 */
export function lunchBudget(breakfastItemCount: number): number {
  return Math.min(Math.max(WEEKDAY_CAP - breakfastItemCount, 2), LUNCH_MAX_ITEMS);
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

  // §3.2 international substitution: when a non-Indian anchor is pinned on this
  // lunch slot, compose the coherent international form (anchor + at most one
  // same-cuisine/neutral companion, no Indian carb) instead of the day's default
  // Menu 1/2. The pinned anchor's cuisine keys the companion pools.
  if (slot.meal === "Lunch" && slot.intlAnchorDishId !== undefined) {
    const anchor = eligible.find((d) => d.id === slot.intlAnchorDishId);
    return menuIntl(eligible, anchor);
  }

  switch (slot.lunchMenu) {
    case 1:
      return menu1(eligible);
    case 2:
      return menu2(eligible);
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
      return [set.hp, set.companions, set.proteinFloor, set.riceCarb, set.chapatiCarb];
    case "menu-2":
      return [set.keto, set.companions, set.proteinFloor, set.riceCarb, set.chapatiCarb];
    case "menu-3":
      return [set.completeMealHp, set.accompaniment, set.dessert, set.proteinFloor];
    case "menu-4":
      return [set.completeMealNonHp, set.keto, set.accompaniment, set.proteinFloor];
    case "menu-intl":
      return [set.anchor, set.proteinCompanion, set.sideCompanion, set.neutralRiceCarb];
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

/** §3.2 companion categories: the non-HP Indian sides that fill the plate budget. */
const WEEKDAY_COMPANION_CATEGORIES = new Set(["Gravy dish", "Dry dish", "Accompaniment"]);

/**
 * §3.3 lunch protein-floor pool for an Indian plate: eligible Lunch dishes with
 * the HP tag or Category=Keto whose cuisine is Indian or that carry the
 * `cuisine_neutral` tag. The floor draws from here when a composed Indian plate
 * holds no protein (the carb-only fallback, or a Menu 4 with an empty Keto pool),
 * so every generated lunch carries protein. Keyed on tag/category/cuisine.
 */
function indianProteinFloorPool(lunch: Dish[]): Dish[] {
  return lunch.filter(
    (d) =>
      (hasTag(d, "HP") || d.category === "Keto") && (d.cuisine === "Indian" || isCuisineNeutral(d)),
  );
}

/** §3.4 carb pool: plain Category=Rice Lunch dishes (the rice-affinity target). */
function riceCarbPool(lunch: Dish[]): Dish[] {
  return lunch.filter((d) => d.category === "Rice");
}

/** §3.4 carb pool: plain Category=Chapati Lunch dishes (the default and Roti target). */
function chapatiCarbPool(lunch: Dish[]): Dish[] {
  return lunch.filter((d) => d.category === "Chapati");
}

/**
 * §3.2 Menu 1 (Mon/Wed/Fri lunch): the Indian weekday plate, HP-led. One protein
 * lead (HP Gravy/Dry), one affinity-driven carb (§3.4), and budget-filled
 * companions from the non-HP Indian Gravy/Dry/Accompaniment pool, with the hard
 * one-Gravy-per-plate rule applied at pick time. Same form as Menu 2, differing
 * only in the lead's protein source.
 *
 * Cuisine is meal-level: the plate composes Indian-cuisine dishes only, so a
 * non-Indian dish never lands as a lone companion in an otherwise-Indian plate.
 * Non-Indian lunches reach the menu through the §3.2 international form. Keyed on
 * the `cuisine` field, never on dish names. The carb pools are not cuisine-gated
 * (Rice/Chapati dishes are Indian by construction).
 */
export function menu1(eligible: Dish[]): Menu1CandidateSet {
  const lunch = eligible.filter((d) => d.time === "Lunch");
  const indian = lunch.filter((d) => d.cuisine === "Indian");
  return {
    kind: "menu-1",
    hp: indian.filter(
      (d) => hasTag(d, "HP") && (d.category === "Gravy dish" || d.category === "Dry dish"),
    ),
    companions: indian.filter(
      (d) => !hasTag(d, "HP") && WEEKDAY_COMPANION_CATEGORIES.has(d.category),
    ),
    proteinFloor: indianProteinFloorPool(lunch),
    riceCarb: riceCarbPool(lunch),
    chapatiCarb: chapatiCarbPool(lunch),
  };
}

/**
 * §3.2 Menu 2 (Tue/Thu lunch): the same Indian weekday plate, Keto-led. A Keto
 * protein lead, an affinity-driven carb, and budget-filled non-HP Indian
 * companions under the one-Gravy-per-plate rule.
 */
export function menu2(eligible: Dish[]): Menu2CandidateSet {
  const lunch = eligible.filter((d) => d.time === "Lunch");
  const indian = lunch.filter((d) => d.cuisine === "Indian");
  return {
    kind: "menu-2",
    keto: indian.filter((d) => d.category === "Keto"),
    companions: indian.filter(
      (d) => !hasTag(d, "HP") && WEEKDAY_COMPANION_CATEGORIES.has(d.category),
    ),
    proteinFloor: indianProteinFloorPool(lunch),
    riceCarb: riceCarbPool(lunch),
    chapatiCarb: chapatiCarbPool(lunch),
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
    proteinFloor: indianProteinFloorPool(lunch),
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
    proteinFloor: indianProteinFloorPool(lunch),
  };
}

/** §3 international-form anchor categories (the non-Indian main may be any of these). */
const INTL_ANCHOR_CATEGORIES = new Set(["Gravy dish", "Dry dish", "Keto", "Complete meal"]);

/** True when the dish carries the cuisine-neutral tag (a plain protein, §3 intl form). */
export function isCuisineNeutral(dish: Dish): boolean {
  return hasTag(dish, "cuisine_neutral");
}

/**
 * §3 international-form anchor predicate: an Active, in-season (eligibility is
 * applied upstream), non-Indian Lunch dish whose Category can lead a meal
 * (Gravy/Dry/Keto/Complete meal). Keyed on the `cuisine` field and category,
 * never on dish names.
 */
export function isIntlAnchor(dish: Dish): boolean {
  return (
    dish.time === "Lunch" && dish.cuisine !== "Indian" && INTL_ANCHOR_CATEGORIES.has(dish.category)
  );
}

/**
 * §3 international lunch form (one non-Indian register). `anchorDish` is the
 * §3.2-pinned anchor; its cuisine keys the companion pools so the meal stays
 * coherent. The form has NO Indian carb. A companion is eligible when it shares
 * the anchor's cuisine OR carries the `cuisine_neutral` tag (a plain protein):
 *
 * - `proteinCompanion` (drawn only for a veg-forward anchor): a same-cuisine or
 *   neutral HP/Keto protein, so baked veggies get one protein, not a pile.
 * - `sideCompanion` (drawn only for a protein anchor): at most one same-cuisine
 *   or neutral NON-HP veg side. The anchor is the meal's one HP source.
 *
 * When `anchorDish` is undefined (defensive: the pinned anchor fell out of the
 * eligible set), only `cuisine_neutral` companions qualify, so the meal still
 * composes coherently rather than mixing registers.
 */
export function menuIntl(eligible: Dish[], anchorDish: Dish | undefined): MenuIntlCandidateSet {
  const lunch = eligible.filter((d) => d.time === "Lunch");
  const matchesAnchor = (d: Dish): boolean =>
    isCuisineNeutral(d) || (anchorDish !== undefined && d.cuisine === anchorDish.cuisine);
  const isProtein = (d: Dish): boolean => hasTag(d, "HP") || d.category === "Keto";
  const isVegSide = (d: Dish): boolean =>
    !hasTag(d, "HP") &&
    (d.category === "Accompaniment" || d.category === "Dry dish" || d.category === "Gravy dish");
  return {
    kind: "menu-intl",
    anchor: lunch.filter(isIntlAnchor),
    proteinCompanion: lunch.filter((d) => isProtein(d) && matchesAnchor(d)),
    sideCompanion: lunch.filter((d) => isVegSide(d) && matchesAnchor(d)),
    // §3.4 international carb: register-neutral steamed rice (Category=Rice +
    // cuisine_neutral). Drawn by the pick only for a `carbAffinity: Rice` anchor,
    // subject to rice spacing; otherwise the intl form takes no carb.
    neutralRiceCarb: lunch.filter((d) => d.category === "Rice" && isCuisineNeutral(d)),
  };
}

export type WeekdaySubstitutionDay = "Mon" | "Tue" | "Wed" | "Thu" | "Fri";
export type WeekdaySubstitutionForm = "menu-3" | "menu-4" | "menu-intl";

export interface WeekdaySubstitutionDecision {
  day: WeekdaySubstitutionDay;
  form: WeekdaySubstitutionForm;
  /**
   * For menu-3/menu-4: the pinned complete_meal lead. For menu-intl: the pinned
   * non-Indian anchor (its cuisine keys the international companion pools).
   */
  leadDishId: number;
}

export interface ShouldSubstituteWeekdayArgs {
  library: Dish[];
  history: MenuHistoryRow[];
  season: Season;
  /** Optional user-requested complete_meal Lunch dish; forces substitution. */
  userRequestedDishId?: number;
  /**
   * Weekday lunches already claimed by another substitution (e.g. the
   * international form). The complete_meal substitution never re-uses one, so a
   * day is never double-substituted. Defaults to none, so the standalone trigger
   * is unchanged.
   */
  excludeDays?: ReadonlySet<WeekdaySubstitutionDay>;
  /**
   * Dish ids already claimed by another substitution (the international anchors).
   * Excluded from the complete_meal lead pool so the two paths never pin the same
   * dish on two days. Defaults to none.
   */
  excludeDishIds?: ReadonlySet<number>;
}

const WEEKDAYS_FOR_SUBSTITUTION: WeekdaySubstitutionDay[] = ["Mon", "Tue", "Wed", "Thu", "Fri"];

/** At most this many weekday lunches run the §3 international form per week. */
export const MAX_INTL_SUBSTITUTIONS = 2;

const LUNCH_MENU_BY_WEEKDAY: Record<WeekdaySubstitutionDay, 1 | 2> = {
  Mon: 1,
  Tue: 2,
  Wed: 1,
  Thu: 2,
  Fri: 1,
};

/**
 * The day's would-be Indian protein main pool (HP Gravy/Dry for Menu 1 days,
 * Keto for Menu 2 days), used by the trigger-(b) recency comparison. Indian-only
 * to mirror the Indian thali (Menu 1/2) it would otherwise fill.
 */
function dayProteinCandidates(day: WeekdaySubstitutionDay, lunchEligible: Dish[]): Dish[] {
  const indian = lunchEligible.filter((d) => d.cuisine === "Indian");
  return LUNCH_MENU_BY_WEEKDAY[day] === 1
    ? indian.filter(
        (d) => hasTag(d, "HP") && (d.category === "Gravy dish" || d.category === "Dry dish"),
      )
    : indian.filter((d) => d.category === "Keto");
}

/**
 * §3.2 weekday complete_meal substitution trigger. Returns the weekday and
 * Menu 3 / Menu 4 form to substitute, or null. Two triggers: a user-requested
 * complete_meal Lunch dish (optional argument) or the longest-unused eligible
 * complete_meal Lunch dish being older than the protein candidate (HP for
 * Menu 1, Keto for Menu 2) that would otherwise fill the slot. `excludeDays` and
 * `excludeDishIds` let the international substitution (which claims days/anchors
 * first) keep this path from double-substituting a day or re-pinning an anchor.
 */
export function shouldSubstituteWeekday(
  args: ShouldSubstituteWeekdayArgs,
): WeekdaySubstitutionDecision | null {
  const { library, history, season, userRequestedDishId } = args;
  const excludeDays = args.excludeDays ?? new Set<WeekdaySubstitutionDay>();
  const excludeDishIds = args.excludeDishIds ?? new Set<number>();

  const lunchEligible = eligibleDishes({
    library,
    history,
    season,
    slot: { day: "Mon", meal: "Lunch" },
  }).filter((d) => d.time === "Lunch");

  const completeMealLunch = lunchEligible.filter(
    (d) => hasTag(d, "complete_meal") && !excludeDishIds.has(d.id),
  );
  const openDays = WEEKDAYS_FOR_SUBSTITUTION.filter((d) => !excludeDays.has(d));

  if (userRequestedDishId !== undefined) {
    const requested = completeMealLunch.find((d) => d.id === userRequestedDishId);
    if (!requested || openDays.length === 0) return null;
    return {
      day: openDays[0],
      form: formFor(requested),
      leadDishId: requested.id,
    };
  }

  if (completeMealLunch.length === 0) return null;

  const lastCooked = lastCookedMap(history);
  const completeMealLead = pickLongestUnused(completeMealLunch, lastCooked);
  if (!completeMealLead) return null;
  const leadDate = lastCooked.get(completeMealLead.id);

  for (const day of openDays) {
    const proteinLead = pickLongestUnused(dayProteinCandidates(day, lunchEligible), lastCooked);
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

/**
 * §3.2 international substitution selection. Picks up to `MAX_INTL_SUBSTITUTIONS`
 * non-Indian anchors (longest-unused per §4.1, preferring distinct cuisines) and
 * assigns each to the earliest weekday lunch whose would-be Indian protein main
 * is newer than the anchor (mirrors trigger (b)). Each chosen day/anchor is
 * unique, so the result never double-substitutes a day. Returns the decisions in
 * day order; an empty array means no international lunch this week (thin or
 * recently-cooked anchor pool).
 */
export function selectInternationalSubstitutions(
  args: ShouldSubstituteWeekdayArgs,
): WeekdaySubstitutionDecision[] {
  const { library, history, season } = args;
  const lunchEligible = eligibleDishes({
    library,
    history,
    season,
    slot: { day: "Mon", meal: "Lunch" },
  }).filter((d) => d.time === "Lunch");

  const lastCooked = lastCookedMap(history);
  const anchorsByUnused = orderByLongestUnused(lunchEligible.filter(isIntlAnchor), lastCooked);

  // Choose up to MAX anchors, preferring distinct cuisines; fall back to
  // same-cuisine anchors only if too few distinct cuisines exist.
  const chosen: Dish[] = [];
  const usedCuisines = new Set<string>();
  for (const a of anchorsByUnused) {
    if (chosen.length >= MAX_INTL_SUBSTITUTIONS) break;
    if (usedCuisines.has(a.cuisine)) continue;
    chosen.push(a);
    usedCuisines.add(a.cuisine);
  }
  if (chosen.length < MAX_INTL_SUBSTITUTIONS) {
    for (const a of anchorsByUnused) {
      if (chosen.length >= MAX_INTL_SUBSTITUTIONS) break;
      if (chosen.includes(a)) continue;
      chosen.push(a);
    }
  }

  // Assign each chosen anchor to the earliest open weekday whose would-be Indian
  // protein main is newer than the anchor (trigger b). Each day is claimed once.
  const decisions: WeekdaySubstitutionDecision[] = [];
  const claimed = new Set<WeekdaySubstitutionDay>();
  for (const anchor of chosen) {
    const anchorDate = lastCooked.get(anchor.id);
    for (const day of WEEKDAYS_FOR_SUBSTITUTION) {
      if (claimed.has(day)) continue;
      const proteinLead = pickLongestUnused(dayProteinCandidates(day, lunchEligible), lastCooked);
      if (!proteinLead) continue;
      // The anchor displaces a day's Indian thali when it is at least as
      // longest-unused as that day's would-be Indian protein main (i.e. the
      // protein is NOT strictly older). Ties favour the international form, since
      // meal-level cuisine coherence is the goal: this is the one tie-handling
      // deviation from the complete_meal trigger's strict comparison, and it is
      // what lets the ~2 international lunches actually land in a library full of
      // never-cooked dishes. A recently-cooked anchor still yields to a
      // longer-unused Indian protein, so a stale international dish is never forced.
      if (!isOlder(lastCooked.get(proteinLead.id), anchorDate)) {
        decisions.push({ day, form: "menu-intl", leadDishId: anchor.id });
        claimed.add(day);
        break;
      }
    }
  }
  // Return in schedule (day) order so downstream rewrites stay deterministic.
  return decisions.sort(
    (a, b) => WEEKDAYS_FOR_SUBSTITUTION.indexOf(a.day) - WEEKDAYS_FOR_SUBSTITUTION.indexOf(b.day),
  );
}

/**
 * §3.2 full weekday-substitution plan: the international substitutions (up to 2,
 * claimed first) plus at most one complete_meal substitution on a remaining day
 * (and never re-pinning an international anchor). This ordering is the design
 * decision behind cuisine coherence coexisting with the complete_meal swap:
 * international claims its days and anchors first, the complete_meal trigger runs
 * on what is left, so a day is never double-substituted and the 2-vs-1 counts
 * never collide. A `userRequestedDishId` still pins its complete_meal as before
 * (it runs through the complete_meal trigger on a remaining day).
 */
export function planWeekdaySubstitutions(
  args: ShouldSubstituteWeekdayArgs,
): WeekdaySubstitutionDecision[] {
  const intl = selectInternationalSubstitutions(args);
  const intlDays = new Set<WeekdaySubstitutionDay>(intl.map((d) => d.day));
  const intlDishIds = new Set<number>(intl.map((d) => d.leadDishId));
  const completeMeal = shouldSubstituteWeekday({
    ...args,
    excludeDays: intlDays,
    excludeDishIds: intlDishIds,
  });
  const all = completeMeal ? [...intl, completeMeal] : intl;
  return all.sort(
    (a, b) => WEEKDAYS_FOR_SUBSTITUTION.indexOf(a.day) - WEEKDAYS_FOR_SUBSTITUTION.indexOf(b.day),
  );
}

function formFor(dish: Dish): WeekdaySubstitutionForm {
  return hasTag(dish, "HP") ? "menu-3" : "menu-4";
}

/**
 * Order a pool oldest-last-cooked first (never-cooked counts as longest unused),
 * ties broken by input order. The §4.1 ordering, used to rank international
 * anchors for substitution selection.
 */
function orderByLongestUnused(pool: Dish[], lastCooked: Map<number, string>): Dish[] {
  const decorated = pool.map((dish, index) => ({ dish, index }));
  decorated.sort((a, b) => {
    const aDate = lastCooked.get(a.dish.id);
    const bDate = lastCooked.get(b.dish.id);
    if (aDate === undefined && bDate === undefined) return a.index - b.index;
    if (aDate === undefined) return -1;
    if (bDate === undefined) return 1;
    if (aDate < bDate) return -1;
    if (aDate > bDate) return 1;
    return a.index - b.index;
  });
  return decorated.map((d) => d.dish);
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
