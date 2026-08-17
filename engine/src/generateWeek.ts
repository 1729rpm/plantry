import type { Dish, Ingredient, MenuHistoryRow, PackSizeHeader, Season } from "./data/schemas.js";
import type { Day, Meal } from "./eligibility.js";
import { weekSchedule, type SlotPlan } from "./schedule.js";
import { eligibleDishes, ALL_DAYS } from "./eligibility.js";
import {
  composeSlot,
  candidateSetPools,
  fruitOfDayPool,
  planWeekdaySubstitutions,
  excludeHpIfMealHasHp,
  isHp,
  isSelfSufficientMain,
  breakfastMainCarriesChutney,
  breakfastMainNeedsPlainCarb,
  isSubstantialCompanion,
  plateHasCarb,
  lunchBudget,
  LUNCH_MAX_ITEMS,
  type BreakfastCandidateSet,
  type CandidateSet,
  type Menu1CandidateSet,
  type Menu2CandidateSet,
  type Menu3CandidateSet,
  type Menu4CandidateSet,
  type MenuIntlCandidateSet,
  type WeekdaySubstitutionDecision,
  type WeekdaySubstitutionDay,
} from "./composition.js";
import {
  rankCandidates,
  withinWeekRecencySet,
  proteinFamiliesUsedAsHpMain,
  planFruitOfWeek,
  type ConsolidationContext,
} from "./priority.js";
import { applyPick, emptyLedger, type IngredientLedger } from "./consolidation.js";
import {
  DAY_MAX_ITEMS,
  emptyDayBudget,
  fitsDayBudget,
  spendDayBudget,
  type DayBudget,
} from "./cap.js";
import { chooseExplorationPosition, rankExploration, type ExplorationPosition } from "./explore.js";
import { planRequests, slotKey } from "./requests.js";
import { planFavorites, unplacedFavorites } from "./favorites.js";
import { toLongDay } from "./historyRows.js";

export interface GenerateWeekArgs {
  /** ISO date of the Monday that anchors the week. */
  weekStart: string;
  library: Dish[];
  history: MenuHistoryRow[];
  season: Season;
  /** Per-dish ingredient rows, used to drive the §10 consolidation ledger. */
  ingredients: Ingredient[];
  /** Tracked-ingredient pack sizes, derived from the ingredient catalog (data/ingredients.md). */
  packSizes: PackSizeHeader[];
  /** Optional RNG; defaults to Math.random for the Saturday alternation choice. */
  rng?: () => number;
  /** Last Saturday's menu form, when known, to drive §2 alternation. */
  lastSaturdayMenu?: 3 | 4 | null;
  /** §3.2 trigger: pin a specific complete_meal Lunch dish to a weekday. */
  userRequestedDishId?: number;
  /**
   * §6 requested dishes: dish ids the generation must place, each into a slot
   * whose composition accepts it, overriding recency. A request that no slot's
   * composition accepts (out of season, inactive, unknown, or no fitting slot)
   * is skipped and emits an incident. Defaults to empty, so behaviour is
   * identical to today and every existing caller stays green.
   */
  requests?: number[];
  /**
   * §4 step 4 favorites: the household's library favorite dish ids
   * (`features/wishlist-favorites-v2`, the Convex `favorites` table), ordered
   * oldest-added first (`createdAt` ascending). Each is guaranteed into one slot of
   * the week by the placement pass (`planFavorites`), pinned exactly like a §6
   * request; when the full set cannot all be placed under the §3 composition locks
   * the oldest win and the rest are reported in `GeneratedWeek.unplacedFavorites`.
   * Custom/free-text favorites are not passed here (the engine has no dish to
   * place). Absent or empty leaves generation byte-identical to a no-favorites run,
   * so every existing caller is unchanged.
   */
  favoriteDishIds?: readonly number[];
}

export interface GeneratedWeekSlot {
  day: Day;
  meal: Meal;
  /**
   * Dishes picked for this slot in pick order: the lead item first
   * (e.g. HP for Menu 1, complete_meal for Menu 3), then partner/companion(s),
   * then the lunch carb where applicable.
   */
  dishes: Dish[];
}

export interface GeneratedWeekDay {
  day: Day;
  slots: GeneratedWeekSlot[];
  /**
   * §3.3 Fruit of the day: exactly one in-season Category=Fruit dish, present
   * on every day the engine schedules (Mon-Sat, Saturday included). It is its
   * own section, outside the breakfast/lunch `slots` and outside the §9 day
   * budget, so it never appears in `slots` and never spends a minute or an item
   * of the day's budget. Absent only if the eligible fruit pool is empty for the
   * season.
   */
  fruit?: Dish;
}

export interface GeneratedWeek {
  weekStart: string;
  days: GeneratedWeekDay[];
  /**
   * Human-readable warnings: an unplaceable §6 request, a lunch the §3.3 protein
   * floor could not fill, or a §9 `budget-short` position (a plate that landed
   * one companion short because no remaining candidate fitted the day's budget).
   * Nothing is ever dropped, so there is no over-cap warning any more.
   */
  incidents: string[];
  /**
   * §4 step 4 favorites: library favorite ids the guaranteed placement pass could
   * not land this week (no accepting slot under the §3 composition locks, or a
   * position that landed short of the §9 day budget), in oldest-first order,
   * computed against the FINISHED week rather than the pinning plan. The engine
   * never breaks a lock to force a
   * favorite; it reports the unplaced ones so the Convex layer can log one incident
   * per generated week naming them. Empty when every favorite landed (and always
   * empty for a run with no favorites).
   */
  unplacedFavorites: number[];
}

/** Inputs both ranking paths derive identically from the dishes placed so far. */
interface SlotRankingInputs {
  /**
   * §10 consolidation ledger after applying every placed pick in order. A pure
   * fold of `applyPick`, so deriving it from the picks equals advancing it
   * incrementally pick-by-pick.
   */
  ledger: IngredientLedger;
  /**
   * §3.1 lunch carbs placed this week (Category in {Chapati, Rice}). Filtered
   * straight from the picks: breakfast composition never yields a Chapati/Rice
   * category dish, so this equals the main loop's lunch-only accumulation.
   */
  weekLunchCarbs: Dish[];
  /**
   * Synthetic within-week history: one row per placed pick, all dated
   * `weekStart`, so §4 step 1 (and the composed history) treat this-week picks
   * as most-recently cooked. Only `weekStart` and `dishId` feed any consumer
   * (`lastCookedMap` keys on those; composition ignores history rows), so the
   * `day`/`meal`/`dishName` carried here are inert for ranking. That is why both
   * paths can share one row shape even though they label the day/meal
   * differently: the labels never reach a comparison.
   */
  inWeekHistory: MenuHistoryRow[];
  /** §4 step 5 within-week recency: ids of non-exempt dishes already placed. */
  withinWeekDishIds: ReadonlySet<number>;
  /**
   * §4 step 6 within-week protein diversity: protein families already spent on
   * an HP main this week. Derived here for both paths, but ONLY the main
   * generation loop threads it into ranking; `rankCandidatesForSlot`
   * deliberately omits it (see its call site), so the swap ranker keeps its
   * existing step-6-free behaviour.
   */
  usedHpMainProteinFamilies: ReadonlySet<string>;
}

interface DeriveSlotRankingInputsArgs {
  /** Dishes placed earlier in the week, in pick order. */
  picks: Dish[];
  weekStart: string;
  /** Cross-week history seed; combine with `inWeekHistory` for composition/§4. */
  ingredients: Ingredient[];
  packSizes: PackSizeHeader[];
}

/**
 * Single definition of "derive the per-slot ranking inputs from this week's
 * placed picks", shared by the main generation loop (`generateWeek`) and the
 * swap-time ranker (`rankCandidatesForSlot`) so the two paths cannot silently
 * drift. Every field is a pure function of `picks` plus the static inputs, which
 * is why the main loop can call this fresh each slot instead of threading the
 * accumulators by hand: the ledger fold, the lunch-carb filter, and the
 * synthetic history all reproduce the incremental state exactly.
 *
 * Note the deliberate asymmetry at the two call sites: this helper computes
 * `usedHpMainProteinFamilies` for both, but `rankCandidatesForSlot` does not
 * pass it on (§4 step 6 stays off for swaps). Computing it here is inert for
 * that path and keeps the derivation in one place.
 */
function deriveSlotRankingInputs(args: DeriveSlotRankingInputsArgs): SlotRankingInputs {
  const { picks, weekStart, ingredients, packSizes } = args;

  let ledger: IngredientLedger = emptyLedger(packSizes);
  const inWeekHistory: MenuHistoryRow[] = [];
  for (const dish of picks) {
    ledger = applyPick(ledger, dish, ingredients);
    inWeekHistory.push({
      weekStart,
      day: toLongDay("Mon"),
      meal: "Breakfast",
      dishName: dish.name,
      dishId: dish.id,
    });
  }
  const weekLunchCarbs = picks.filter((d) => d.category === "Chapati" || d.category === "Rice");

  return {
    ledger,
    weekLunchCarbs,
    inWeekHistory,
    withinWeekDishIds: withinWeekRecencySet(picks),
    usedHpMainProteinFamilies: proteinFamiliesUsedAsHpMain(picks),
  };
}

/**
 * Top-level engine entry point. Composes the pipeline §2 → §3 → §4 → §10 → §9
 * (with §1 eligibility feeding §3): schedule the week (§2), compose each slot's
 * candidate set from the eligible library (§1 → §3), rank each pool with
 * priority (§4, passing the running §10 consolidation ledger), pick index 0,
 * advance the ledger, then apply the §9 cap day by day and emit an incident per
 * drop.
 */
export function generateWeek(args: GenerateWeekArgs): GeneratedWeek {
  const {
    weekStart,
    library,
    history,
    season,
    ingredients,
    packSizes,
    rng,
    lastSaturdayMenu,
    userRequestedDishId,
    requests = [],
    favoriteDishIds = [],
  } = args;

  const baseSchedule = weekSchedule({ weekStart, lastSaturdayMenu, rng });

  // §3.2: plan the week's weekday lunch substitutions — up to two international
  // forms (a coherent non-Indian register, anchor + at most one same-cuisine/
  // neutral companion, no Indian carb) plus at most one complete_meal swap on a
  // different day. International claims its days and anchors first, so a day is
  // never double-substituted (see planWeekdaySubstitutions). Each decision
  // rewrites its day's lunch SlotPlan: a complete_meal swap to the Menu 3/4 form
  // (3 items), an international swap to the menu-intl form (up to 2 items, the
  // anchor pinned via intlAnchorDishId).
  const substitutions = planWeekdaySubstitutions({
    library,
    history,
    season,
    userRequestedDishId,
  });
  const substitutionByDay = new Map<WeekdaySubstitutionDay, WeekdaySubstitutionDecision>();
  for (const decision of substitutions) substitutionByDay.set(decision.day, decision);

  const schedule = baseSchedule.map((slot): SlotPlan => {
    if (slot.meal !== "Lunch") return slot;
    const decision = substitutionByDay.get(slot.day as WeekdaySubstitutionDay);
    if (!decision) return slot;
    if (decision.form === "menu-intl") {
      // The international meal is small: an anchor plus at most one companion,
      // and thin pools may make it a 1-item meal.
      return { ...slot, lunchMenu: undefined, intlAnchorDishId: decision.leadDishId };
    }
    return { ...slot, lunchMenu: decision.form === "menu-3" ? 3 : 4 };
  });

  // §6 requested dishes: plan each requested id into the first schedule slot
  // whose §3 composition accepts it, overriding recency. Every substituted day's
  // lunch is reserved so a request never collides with it. Unplaceable requests
  // fall through to incidents and are not placed.
  const reservedSlots = new Set<string>();
  for (const decision of substitutions) {
    reservedSlots.add(slotKey(decision.day, "Lunch"));
  }
  const requestPlan = planRequests({
    requests,
    schedule,
    library,
    history,
    season,
    reservedSlots,
  });
  // Per-slot pinned dish ids: a request forces its dish to the front of the
  // accepting slot's ranked pool (overriding §4 recency for that position).
  const pinsBySlot = new Map<string, number[]>();
  const addPin = (day: Day, meal: Meal, dishId: number) => {
    const key = slotKey(day, meal);
    const list = pinsBySlot.get(key) ?? [];
    list.push(dishId);
    pinsBySlot.set(key, list);
  };
  for (const placement of requestPlan.placements) {
    addPin(placement.day, placement.meal, placement.dishId);
  }

  // §4 step 4 guaranteed favorites placement. Every library favorite is pinned
  // into one accepting slot of the week, spread across distinct days, oldest-added
  // first, using the SAME pinning mechanism as a §6 request (front of the accepting
  // slot's ranked pool, overriding §4 recency for that position). Favorites never
  // displace a §3.2 substitution slot or a slot an earlier request claimed, so both
  // are reserved. Custom/free-text favorites are not passed here. Placement respects
  // the dish's meal implicitly: a wrong-meal dish never appears in a slot's pools, so
  // the planner routes a breakfast favorite to a breakfast slot and a lunch favorite
  // to a lunch plate. Favorites that no slot accepts under the locks are reported in
  // `unplacedFavorites` (below), never forced.
  const favoriteReserved = new Set<string>(reservedSlots);
  for (const placement of requestPlan.placements) {
    favoriteReserved.add(slotKey(placement.day, placement.meal));
  }
  const favoritePlan = planFavorites({
    favoriteDishIds,
    schedule,
    library,
    history,
    season,
    reservedSlots: favoriteReserved,
  });
  // Track which favorite is pinned to which slot, and the set of all pinned
  // favorite ids. A favorite is guaranteed EXACTLY ONCE: it leads its own pinned
  // slot (promotePins), and it must not also be drawn by ordinary ranking on any
  // OTHER slot. Because slots compose in schedule order, a favorite pinned to a
  // later day is still "fresh" (within-week recency has not demoted it) when an
  // earlier day composes, so a companion/side pool could otherwise draw it there and
  // place it twice. We prevent that by excluding every pinned favorite from the
  // natural selectable pool of every slot except the one it is pinned to (below).
  const favoriteIdBySlot = new Map<string, Set<number>>();
  const allPinnedFavoriteIds = new Set<number>();
  for (const placement of favoritePlan.placements) {
    addPin(placement.day, placement.meal, placement.dishId);
    const key = slotKey(placement.day, placement.meal);
    const set = favoriteIdBySlot.get(key) ?? new Set<number>();
    set.add(placement.dishId);
    favoriteIdBySlot.set(key, set);
    allPinnedFavoriteIds.add(placement.dishId);
  }

  // §4.8 exploration slot: one companion position of this week is ranked for
  // novelty instead of by §4, and it rotates one position per calendar week so no
  // single weekday is the only one that ever sees a new dish. The candidate
  // positions are derived from the SCHEDULE, not from the composed plates, so the
  // choice is made before anything is picked and a regenerated week lands on the
  // same position.
  const explorationSlot = chooseExplorationPosition({
    weekStart,
    positions: explorationPositions(schedule),
  });
  const explorationSlotKey = explorationSlot
    ? slotKey(explorationSlot.day as Day, explorationSlot.meal as Meal)
    : undefined;

  const slotResults: GeneratedWeekSlot[] = [];
  // §9 running whole-day budget (minutes + items). Breakfast composes first and
  // the same day's lunch composes to what is left, so this map is read and
  // written in schedule order and is the single carrier of "how much of this day
  // is already spent". Fruit never touches it (§3.3 is outside the budget).
  const budgetByDay = new Map<Day, DayBudget>();
  for (const day of ALL_DAYS) budgetByDay.set(day, emptyDayBudget());
  // §9 `budget-short` positions: a plate position whose pool held candidates but
  // none of them fitted the day's remaining budget. Surfaced as incidents.
  const budgetShortIncidents: string[] = [];
  // Every dish placed so far this week, in pick order. This is the single source
  // of truth for the per-slot ranking inputs: `deriveSlotRankingInputs` rebuilds
  // the §10 ledger, §3.1 lunch carbs, the synthetic within-week history, and the
  // §4 step 5/6 accumulators from it each slot. Keeping these derived (rather
  // than threading separate mutable accumulators) is what lets the swap ranker
  // (`rankCandidatesForSlot`) share the exact same derivation.
  const weekPicks: Dish[] = [];
  // Same-day breakfast primary ingredient, set when we pick breakfast and
  // consumed by the same day's lunch slot to feed §4 step 2.
  const sameDayBreakfastPrimary = new Map<Day, string>();
  // §3.1 budget-aware composition: the count of breakfast items actually placed
  // per day. Breakfast composes first, so the same day's lunch reads this to size
  // its item budget (lunchBudget). Only weekday lunches (Menu 1/2) consult it.
  const breakfastItemCountByDay = new Map<Day, number>();
  // §3.4 rice spacing: whether the previous generated day's lunch carried a
  // Category=Rice item. Lunches are composed in day order, so this carries the
  // immediately-preceding lunch day's rice state into the next day's carb pick.
  let previousLunchDayRice = false;
  // §3.3 lunch protein floor: lunch days whose composed plate holds no protein
  // even after the floor (an empty floor pool). Surfaced as warn incidents, a
  // real gap unlike the retired over-cap noise.
  const proteinFloorIncidents: string[] = [];

  for (const slot of schedule) {
    const rankingInputs = deriveSlotRankingInputs({
      picks: weekPicks,
      weekStart,
      ingredients,
      packSizes,
    });
    const compositionHistory: MenuHistoryRow[] = [...history, ...rankingInputs.inWeekHistory];
    const candidateSet = composeSlot({
      slot,
      library,
      history: compositionHistory,
      season,
      weekLunchCarbs: rankingInputs.weekLunchCarbs,
    });
    const consolidationContext: ConsolidationContext = {
      ledger: rankingInputs.ledger,
      ingredients,
    };
    const slotSubstitution =
      slot.meal === "Lunch" ? substitutionByDay.get(slot.day as WeekdaySubstitutionDay) : undefined;
    // §4 step 4 exactly-once: every favorite pinned to a DIFFERENT slot is excluded
    // from this slot's selectable pools, so ordinary ranking cannot draw it here and
    // place it a second time. The favorite pinned to THIS slot is not excluded, so
    // promotePins still leads it into its own slot. Empty for a slot with no
    // pinned-elsewhere favorites, so behaviour is unchanged when there are none.
    const thisSlotFavorites = favoriteIdBySlot.get(slotKey(slot.day, slot.meal));
    const excludeDishIds =
      allPinnedFavoriteIds.size === 0
        ? undefined
        : new Set([...allPinnedFavoriteIds].filter((id) => !(thisSlotFavorites?.has(id) ?? false)));
    const key = slotKey(slot.day, slot.meal);
    const plate = pickSlot({
      slot,
      candidateSet,
      compositionHistory,
      consolidationContext,
      excludeDishIds,
      withinWeekDishIds: rankingInputs.withinWeekDishIds,
      // §4 step 6 protein diversity IS applied in generation (the main loop):
      // a later HP-main slot prefers a protein the week has not used yet.
      usedHpMainProteinFamilies: rankingInputs.usedHpMainProteinFamilies,
      sameDayBreakfastPrimaryIngredient:
        slot.meal === "Lunch" ? sameDayBreakfastPrimary.get(slot.day) : undefined,
      // §4.7 repeat guard: the slot's own calendar date. Without it the guard is
      // inert, and the guard (not the saturating cap) is what actually breaks
      // repetition (`features/engine-v4.md` §11.1).
      slotDate: addDays(weekStart, dayOffset(slot.day)),
      // §3.1 budget: the same day's breakfast has already composed, so its item
      // count sizes this lunch. A day with no breakfast slot (Saturday) reads 0,
      // which is correct: the whole day's item budget is the lunch's.
      lunchBudget:
        slot.meal === "Lunch" ? lunchBudget(breakfastItemCountByDay.get(slot.day) ?? 0) : undefined,
      // §9 whole-day budget as it stands before this slot composes.
      dayBudget: budgetByDay.get(slot.day) ?? emptyDayBudget(),
      previousDayRice: slot.meal === "Lunch" ? previousLunchDayRice : undefined,
      // §3.2: the substituted day's lead (a complete_meal or an international
      // anchor) is pinned to the lead/anchor position.
      substitutionLeadDishId: slotSubstitution ? slotSubstitution.leadDishId : undefined,
      pinnedDishIds: pinsBySlot.get(key),
      // §4.8: this slot carries the week's novelty position when the rotation
      // landed on it.
      exploreCompanion: explorationSlotKey === key,
    });

    const picks = plate.picks;
    // Record each pick into the running week so the next slot's derivation sees it.
    for (const dish of picks) {
      weekPicks.push(dish);
    }
    // §9: carry the day's spend forward to the same day's later slot.
    budgetByDay.set(slot.day, plate.budget);
    for (const position of plate.budgetShort) {
      budgetShortIncidents.push(
        `${toLongDay(slot.day)} ${slot.meal.toLowerCase()} landed short at ${position} (budget-short)`,
      );
    }

    // Wire same-day breakfast primary ingredient to lunch's §4 step 2, and record
    // the breakfast item count for the same day's lunch budget (§3.1).
    if (slot.meal === "Breakfast") {
      breakfastItemCountByDay.set(slot.day, picks.length);
      if (picks.length > 0) {
        // Use the lead (index 0) breakfast pick as the headline ingredient.
        sameDayBreakfastPrimary.set(slot.day, picks[0].primaryIngredient);
      }
    }

    // §3.3/§3.4 lunch bookkeeping: update the rice-spacing flag for the next day,
    // and flag a protein-floor gap when even the floor could not add protein.
    if (slot.meal === "Lunch") {
      previousLunchDayRice = picks.some((d) => d.category === "Rice");
      const hasProtein = picks.some((d) => isHp(d) || d.category === "Keto");
      if (!hasProtein) {
        proteinFloorIncidents.push(
          `${toLongDay(slot.day)} lunch has no protein (§3.3 floor pool empty)`,
        );
      }
    }

    slotResults.push({ day: slot.day, meal: slot.meal, dishes: picks });
  }

  const incidents: string[] = [
    ...requestPlan.incidents,
    ...proteinFloorIncidents,
    ...budgetShortIncidents,
  ];

  // Nothing is ever dropped (`features/engine-v4.md` §10.1): every plate composed
  // to the day budget as it went, so the week is exactly what the loop picked.
  const days = groupSlotsByDay(slotResults);

  // §3.3 Fruit of the day: one in-season Category=Fruit dish per scheduled day
  // (Mon-Sat, Saturday included). Fruit lost its recency exemptions in §10.2, so
  // it is planned for the WHOLE week by `planFruitOfWeek`: each day is narrowed to
  // the fruits used fewest times so far this week and then ranked by §4, with each
  // pick fed forward as a same-day history row so the next day's repeat guard
  // measures a real gap. The old "order once by longest-unused, then wrap by day
  // index" was a fixed rotation by construction and produced two distinct fruits
  // in 150 days.
  const fruitEligible = fruitOfDayPool(
    eligibleDishes({
      library,
      history,
      season,
      // Fruit is filtered by Category, not by slot day/meal; any scheduled slot
      // works for the season/active filter eligibleDishes applies.
      slot: { day: "Mon", meal: "Breakfast" },
    }),
  );
  const fruitOfWeek = planFruitOfWeek({
    pool: fruitEligible,
    history,
    weekStart,
    dayOffsets: days.map((d) => dayOffset(d.day)),
  });
  days.forEach((day, index) => {
    if (fruitOfWeek[index]) day.fruit = fruitOfWeek[index];
  });

  // §6 reconciliation: a planned request placement is only honoured if its
  // dish actually survives into the final week. A composition slot can expose a
  // pool a particular pick branch never draws from (e.g. a Menu 1 dal/sabzi pool
  // that a thin pool leaves unfilled), and a position can land short when no
  // remaining candidate fits the §9 day budget. Either way the pinned dish is
  // then absent.
  // We re-check every placement against the final week and emit an incident for
  // any that did not land, so the §6 contract holds: a requested dish appears
  // exactly once OR yields an incident (never both, never neither).
  const placedIds = new Set<number>();
  for (const day of days) {
    for (const slot of day.slots) {
      for (const dish of slot.dishes) placedIds.add(dish.id);
    }
  }
  for (const placement of requestPlan.placements) {
    if (placedIds.has(placement.dishId)) continue;
    const dish = library.find((d) => d.id === placement.dishId);
    const name = dish ? dish.name : `dish ${placement.dishId}`;
    incidents.push(`Requested ${name} could not be placed (no composition slot accepts it)`);
  }

  // §4 step 4 reconciliation: a favorite is guaranteed only if it survives into the
  // final week. A pinned favorite can still be absent when the accepting slot's pick
  // branch never drew from the pool that held it. The predicate is single-homed in
  // `favorites.ts` so it cannot drift back to reading the pinning PLAN instead of the
  // finished week (reading the plan is what made 15 of 52 incidents false positives).
  // Unlike a request, an unplaced favorite is NOT pushed as an engine incident string
  // here: the Convex layer logs one incident per week from `unplacedFavorites`.
  return {
    weekStart,
    days,
    incidents,
    unplacedFavorites: unplacedFavorites(favoriteDishIds, placedIds),
  };
}

/** Day-of-week offset from a week's Monday: Mon 0 ... Sat 5. */
function dayOffset(day: Day): number {
  return ALL_DAYS.indexOf(day);
}

/** ISO date `n` days after `iso`, computed in UTC so it is timezone-stable. */
function addDays(iso: string, days: number): string {
  const base = new Date(`${iso}T00:00:00Z`);
  return new Date(base.getTime() + days * 86400000).toISOString().slice(0, 10);
}

/**
 * §4.8: the week's candidate novelty positions, in schedule order. One companion
 * position per scheduled lunch, identified structurally from the SlotPlan (the
 * form decides which pick index is the first companion), so the list exists
 * before any dish is picked and does not depend on how large the plates turn out.
 *
 * Lunch only. A breakfast has at most one attached item and that item is decided
 * by the main (a chilla's chutney, a bhurji's toast), so there is no free
 * companion position there to spend on discovery.
 */
function explorationPositions(schedule: readonly SlotPlan[]): ExplorationPosition[] {
  const positions: ExplorationPosition[] = [];
  for (const slot of schedule) {
    if (slot.meal !== "Lunch") continue;
    // Menu 1/2 place lead + carb before the first companion; the Menu 3/4 and
    // international forms place the lead and then the companion.
    const index =
      slot.intlAnchorDishId === undefined && (slot.lunchMenu === 1 || slot.lunchMenu === 2) ? 2 : 1;
    positions.push({ day: slot.day, meal: slot.meal, index });
  }
  return positions;
}

interface PickSlotArgs {
  slot: SlotPlan;
  candidateSet: CandidateSet;
  compositionHistory: MenuHistoryRow[];
  consolidationContext: ConsolidationContext;
  /**
   * §4 step 5 within-week recency: ids of non-exempt dishes already placed this
   * week. Threaded into every rankCandidates call for this slot so a dish picked
   * in an earlier slot sinks below fresh alternatives here.
   */
  withinWeekDishIds?: ReadonlySet<number>;
  /**
   * §4 step 6 within-week protein diversity (Cluster E): protein families
   * already spent on an HP main this week. Applied only when ranking an HP-main
   * position pool (`rankHpMain`), so a non-main companion pool is never reordered
   * by protein. Soft with fallback.
   */
  usedHpMainProteinFamilies?: ReadonlySet<string>;
  /**
   * §4 step 4 exactly-once: dish ids of favorites pinned to a DIFFERENT slot this
   * week. Every ranked pool for this slot filters these out before ranking, so
   * ordinary selection can never draw a favorite that belongs to another day and
   * place it twice. The favorite pinned to THIS slot is deliberately absent from
   * this set, so `promotePins` still leads it here. Undefined or empty leaves every
   * pool unchanged.
   */
  excludeDishIds?: ReadonlySet<number>;
  sameDayBreakfastPrimaryIngredient?: string;
  /**
   * §4.7 repeat guard: the ISO calendar date of the slot being ranked
   * (`weekStart` + this day's offset). Threaded into every ranking call for this
   * slot, so a candidate cooked within seven days of it is excluded from the
   * pool. This is the input that makes the guard live; without it the guard is a
   * no-op and saturating frequency alone reproduces the carousel
   * (`features/engine-v4.md` §11.1).
   */
  slotDate?: string;
  /**
   * §3.1 budget-aware composition: the lunch ITEM budget for this slot
   * (`clamp(DAY_MAX_ITEMS - breakfastItemCount, 2, LUNCH_MAX_ITEMS)`), computed by
   * generateWeek from the same day's placed breakfast. Menu 1/2 fill
   * `lunchBudget - 2` companion positions; the other forms ignore it.
   */
  lunchBudget?: number;
  /**
   * §9 whole-day budget as it stands when this slot starts composing: the same
   * day's breakfast is already counted into a lunch's, because breakfast composes
   * first. Every position places the first candidate that fits what is left.
   */
  dayBudget: DayBudget;
  /**
   * §4.8: true when the week's rotating novelty position falls on this slot, in
   * which case the slot's FIRST companion position ranks for novelty instead of
   * by §4. Exactly one slot of a week carries it.
   */
  exploreCompanion?: boolean;
  /**
   * §3.4 rice spacing: true when the previous generated day's lunch carried a
   * Category=Rice item. A Rice carb never lands two days running, so when true a
   * `carbAffinity: Rice` lead falls back to Chapati (weekday) or takes no carb
   * (intl).
   */
  previousDayRice?: boolean;
  /** §3.2: when set, the substituted day's lead complete_meal is pinned. */
  substitutionLeadDishId?: number;
  /**
   * §6 requested dishes pinned into this slot. Any pinned dish present in a
   * ranked pool is moved to the front of that pool (overriding §4 recency), so
   * it is the pick for its position. A pinned dish absent from every pool is
   * ignored here (the planner only pins into accepting slots, so this is a
   * defensive no-op).
   */
  pinnedDishIds?: number[];
}

/**
 * A plate under construction, plus the whole-day budget it is spending (§9).
 *
 * `picks` are this slot's picks in pick order; `budget` is the DAY's running
 * spend, so a lunch builder starts with the same day's breakfast already counted.
 * Composition places one position at a time against this, which is what makes the
 * budget a budget rather than a post-hoc trim: nothing is ever composed and then
 * removed.
 */
interface PlateBuilder {
  picks: Dish[];
  budget: DayBudget;
  /** Positions whose pool held candidates but none of them fitted the budget. */
  budgetShort: string[];
}

interface PlaceOptions {
  /**
   * §3.3 protein beats budget: the lunch protein floor may spend past the
   * minute budget (never past the item backstop), because a lunch without protein
   * is a worse outcome than a long day. Every other position is budget-fit.
   */
  ignoreMinutes?: boolean;
}

/**
 * §9 place the first candidate from `ranked` that fits the day's remaining
 * budget, skipping any that would breach the minute budget or the item backstop.
 * When the pool had candidates but none fitted, the position lands empty and the
 * plate records a `budget-short` position: a plate one companion short beats a
 * plate that costs more time than the household has, the same principle as the
 * one-gravy rule. An empty pool is a composition-thinness problem, not a budget
 * one, so it records nothing here.
 */
function place(
  plate: PlateBuilder,
  ranked: Dish[],
  position: string,
  options: PlaceOptions = {},
): Dish | undefined {
  for (const dish of ranked) {
    const fits = options.ignoreMinutes
      ? plate.budget.itemsUsed < DAY_MAX_ITEMS
      : fitsDayBudget(plate.budget, dish);
    if (!fits) continue;
    plate.picks.push(dish);
    plate.budget = spendDayBudget(plate.budget, dish);
    return dish;
  }
  if (ranked.length > 0) plate.budgetShort.push(position);
  return undefined;
}

interface PickedSlot {
  picks: Dish[];
  /** The day's budget after this slot composed. */
  budget: DayBudget;
  budgetShort: string[];
}

function pickSlot(args: PickSlotArgs): PickedSlot {
  const { candidateSet } = args;
  const plate: PlateBuilder = { picks: [], budget: args.dayBudget, budgetShort: [] };
  switch (candidateSet.kind) {
    case "breakfast":
      pickBreakfast(args, plate, candidateSet);
      break;
    case "menu-1":
      pickMenu1(args, plate, candidateSet);
      applyLunchProteinFloor(args, plate, candidateSet.proteinFloor);
      break;
    case "menu-2":
      pickMenu2(args, plate, candidateSet);
      applyLunchProteinFloor(args, plate, candidateSet.proteinFloor);
      break;
    case "menu-3":
      pickMenu3(args, plate, candidateSet);
      applyLunchProteinFloor(args, plate, candidateSet.proteinFloor);
      break;
    case "menu-4":
      pickMenu4(args, plate, candidateSet);
      applyLunchProteinFloor(args, plate, candidateSet.proteinFloor);
      break;
    case "menu-intl":
      // The intl floor pool is the same-cuisine-or-neutral protein pool
      // (proteinCompanion); a self-sufficient non-HP anchor draws from it.
      pickMenuIntl(args, plate, candidateSet);
      applyLunchProteinFloor(args, plate, candidateSet.proteinCompanion);
      break;
  }
  return { picks: plate.picks, budget: plate.budget, budgetShort: plate.budgetShort };
}

/**
 * §3.3 lunch protein floor: every generated lunch carries protein. After a lunch
 * plate is composed, if no picked item is HP-tagged or Category=Keto, append one
 * protein companion from `floorPool` (eligible HP-or-Keto Lunch dishes, already
 * cuisine-scoped by the caller: Indian-or-neutral for Menu 1/2/3/4,
 * same-cuisine-or-neutral for the intl form). The floor excludes a Category=Gravy
 * dish when the plate already holds one (the one-wet rule) and never a dish
 * already picked. On a plate carrying a carb it prefers a substantial companion
 * (plate rule 9) so the floor cannot itself create a carb plate with nothing to
 * eat the roti with. It appends even when the plate is out of MINUTES (protein
 * beats budget) but never past the §9 item backstop. Menu 1/2/3 satisfy the floor
 * by construction, so it no-ops there; it fires on the carb-only fallback, a
 * Menu 4 with an empty Keto pool, and a self-sufficient non-HP intl anchor. An
 * empty pool leaves the plate protein-less; generateWeek writes a warn incident.
 */
function applyLunchProteinFloor(args: PickSlotArgs, plate: PlateBuilder, floorPool: Dish[]): void {
  const hasProtein = plate.picks.some((d) => isHp(d) || d.category === "Keto");
  if (hasProtein || plate.picks.length >= LUNCH_MAX_ITEMS) return;
  const chosenIds = new Set(plate.picks.map((d) => d.id));
  const hasGravy = plate.picks.some((d) => d.category === "Gravy dish");
  let pool = floorPool.filter((d) => !chosenIds.has(d.id));
  if (hasGravy) pool = pool.filter((d) => d.category !== "Gravy dish");
  pool = preferSubstantial(pool, plate.picks);
  place(plate, rankHpMain(args, pool), "protein floor", { ignoreMinutes: true });
}

/**
 * §3 plate rule 9 (`features/engine-v4.md` §10.3): on a plate that carries a carb
 * and has no Gravy/Dry item yet, narrow a companion pool to the substantial
 * companions, so an Accompaniment (salad, raita, chutney) can never be the thing
 * a roti is eaten with. There is no thin-pool fallback in the ordinary companion
 * path (a plate one companion short beats a wrong plate), but this helper does
 * fall back when narrowing would empty the pool, so the callers that must fill
 * their position (the protein floor) still can. Returns the pool unchanged when
 * the plate carries no carb or already holds a substantial item.
 */
function preferSubstantial(pool: Dish[], picks: readonly Dish[]): Dish[] {
  if (!plateHasCarb(picks)) return pool;
  if (picks.some(isSubstantialCompanion)) return pool;
  const substantial = pool.filter(isSubstantialCompanion);
  return substantial.length > 0 ? substantial : pool;
}

/**
 * §4 step 4 exactly-once: drop every favorite pinned to a different slot from a
 * candidate pool before ranking it, so a favorite that belongs to another day can
 * never be drawn here and placed twice. The favorite pinned to THIS slot is not in
 * `excludeDishIds`, so it survives and `promotePins` still leads it. No-op when the
 * set is empty (the common no-favorites case), so behaviour is otherwise unchanged.
 */
function excludePinnedElsewhere(
  pool: Dish[],
  excludeDishIds: ReadonlySet<number> | undefined,
): Dish[] {
  if (!excludeDishIds || excludeDishIds.size === 0) return pool;
  return pool.filter((d) => !excludeDishIds.has(d.id));
}

function rank(args: PickSlotArgs, pool: Dish[]): Dish[] {
  const selectable = excludePinnedElsewhere(pool, args.excludeDishIds);
  const ranked = rankCandidates({
    pool: selectable,
    history: args.compositionHistory,
    sameDayBreakfastPrimaryIngredient: args.sameDayBreakfastPrimaryIngredient,
    consolidationContext: args.consolidationContext,
    withinWeekDishIds: args.withinWeekDishIds,
    slotDate: args.slotDate,
  });
  return promotePins(ranked, selectable, args.pinnedDishIds);
}

/**
 * Rank an HP-main position pool, applying §4 step 6 within-week protein
 * diversity on top of the §4 steps `rank` applies. Used for the protein-main
 * position of each meal form (Menu 1 HP, Menu 2 Keto, Menu 3 complete_meal+HP,
 * Menu 4 Keto, the international anchor/protein, and any HP breakfast main).
 * Companion positions still call `rank`, so protein diversity never reorders a
 * non-main pool.
 */
function rankHpMain(args: PickSlotArgs, pool: Dish[]): Dish[] {
  const selectable = excludePinnedElsewhere(pool, args.excludeDishIds);
  const ranked = rankCandidates({
    pool: selectable,
    history: args.compositionHistory,
    sameDayBreakfastPrimaryIngredient: args.sameDayBreakfastPrimaryIngredient,
    consolidationContext: args.consolidationContext,
    withinWeekDishIds: args.withinWeekDishIds,
    usedHpMainProteinFamilies: args.usedHpMainProteinFamilies,
    slotDate: args.slotDate,
  });
  return promotePins(ranked, selectable, args.pinnedDishIds);
}

/**
 * §4.8 the exploration slot: rank ONE companion position of the week for novelty
 * (pure longest-unused, never-cooked first) instead of by §4. Frequency ranking
 * here would put the proven repertoire on top and there would be no discovery at
 * all.
 *
 * Two things still apply, because the exploration slot is a ranking, not a
 * licence: the pool it ranks is the pool §3 composition allows for that position
 * (so plate rule 9 and the one-wet rule are already baked into it), and dishes
 * already placed this week are filtered out so novelty cannot produce a
 * within-week duplicate. A pinned request or favorite still leads, so the
 * novelty slot never costs the household a guaranteed placement.
 */
function rankNovelty(args: PickSlotArgs, pool: Dish[]): Dish[] {
  const eligible = excludePinnedElsewhere(pool, args.excludeDishIds);
  const withinWeek = args.withinWeekDishIds;
  const fresh =
    withinWeek && withinWeek.size > 0 ? eligible.filter((d) => !withinWeek.has(d.id)) : eligible;
  const ranked = rankExploration(fresh.length > 0 ? fresh : eligible, args.compositionHistory);
  return promotePins(ranked, eligible, args.pinnedDishIds);
}

/**
 * §6 requests and §4 step 4 favorites: move any pinned dish to the front of the
 * ranked pool, overriding §4 recency for that position. Pinned dishes keep their
 * relative order; the rest follow in ranked order. Pinned ids absent from the
 * slot's pool are ignored (the planners only pin into accepting slots).
 *
 * `selectable` is the slot's pool BEFORE §4 ran, and a pinned dish is looked up
 * there as well as in `ranked`. That is what makes "overriding recency" true of
 * the §4.7 repeat guard too: the guard is a FILTER, so a favorite or request
 * cooked within the last seven days would otherwise be removed from the pool
 * before the pin could promote it, and the guarantee would silently fail on
 * exactly the dishes the household eats most.
 */
function promotePins(
  ranked: Dish[],
  selectable: Dish[],
  pinnedDishIds: number[] | undefined,
): Dish[] {
  if (!pinnedDishIds || pinnedDishIds.length === 0) return ranked;
  const pinnedSet = new Set(pinnedDishIds);
  const pinned: Dish[] = [];
  for (const id of pinnedDishIds) {
    const dish = ranked.find((d) => d.id === id) ?? selectable.find((d) => d.id === id);
    if (dish) pinned.push(dish);
  }
  if (pinned.length === 0) return ranked;
  const rest = ranked.filter((d) => !pinnedSet.has(d.id));
  return [...pinned, ...rest];
}

/**
 * §3 breakfast, one form for every day (`features/engine-v4.md` §10.4). Rank the
 * single widened main pool, place the winner, then attach what the WINNER calls
 * for rather than what the day calls for:
 *
 * - a Category=Dry dish main (anda bhurji, paneer bhurji) draws a plain
 *   breakfast carb, which is the v3 Option C form and the reason those dishes are
 *   reachable at all;
 * - a Chilla or Paratha main draws its breakfast chutney;
 * - anything else (a Category=Bread `complete_carb` such as avocado toast, or a
 *   `complete_meal` such as poha) is self-sufficient and is served alone.
 *
 * Then the protein floor: a breakfast holding no HP dish gains one HP Category=
 * Keto companion, EXCEPT when the main already carries a chutney (§10.4). That
 * exception is what removed the 3-item chilla-plus-chutney-plus-eggs breakfasts.
 */
function pickBreakfast(args: PickSlotArgs, plate: PlateBuilder, set: BreakfastCandidateSet): void {
  // §4.6: the breakfast main is the meal's main, so it carries protein diversity
  // (a no-op for the non-HP candidates in the pool).
  const main = place(plate, rankHpMain(args, set.main), "breakfast main");
  if (!main) return;

  const carriesChutney = breakfastMainCarriesChutney(main);
  if (breakfastMainNeedsPlainCarb(main)) {
    place(plate, rank(args, excluding(set.plainCarb, main)), "breakfast carb");
  } else if (carriesChutney) {
    // §3 one-HP-per-meal: once the main is HP the chutney pool drops HP-tagged
    // dishes (thin-pool fallback keeps the slot fillable).
    place(
      plate,
      rank(args, excludeHpIfMealHasHp(excluding(set.chutney, main), isHp(main))),
      "breakfast chutney",
    );
  }

  // §3 breakfast protein floor. Fires only at HP count 0, so it composes with
  // one-HP-per-meal and never produces two HP in the meal.
  if (plate.picks.some(isHp) || carriesChutney) return;
  place(plate, rank(args, excluding(set.ketoCompanion, ...plate.picks)), "breakfast protein floor");
}

/**
 * §3.2 Menu 1: the Indian weekday plate, HP-led. Compose to the day budget
 * (§3.1/§9) rather than composing four and trimming: an HP protein lead, an
 * affinity-driven carb (§3.4), then companions from the non-HP Indian pool under
 * the hard one-Gravy-per-plate rule and plate rule 9. The protein lead is the
 * meal's only HP position (companions are non-HP). If no HP main is eligible the
 * slot falls back to a carb (plus the §3.3 protein floor) so it still fills.
 */
function pickMenu1(args: PickSlotArgs, plate: PlateBuilder, set: Menu1CandidateSet): void {
  // §4.6: the HP main is ranked with protein diversity so a week's Menu 1 mains
  // spread across proteins instead of repeating chicken/paneer.
  const hp = place(plate, rankHpMain(args, set.hp), "protein main");
  if (!hp) {
    pickLunchCarbOnly(args, plate, set.chapatiCarb);
    return;
  }
  composeWeekdayPlate(args, plate, hp, set);
}

/**
 * §3.2 Menu 2: the same Indian weekday plate, Keto-led. When no Keto lead is
 * eligible the slot falls back to a carb (plus the §3.3 protein floor).
 */
function pickMenu2(args: PickSlotArgs, plate: PlateBuilder, set: Menu2CandidateSet): void {
  // §4.6: the Keto dish is Menu 2's protein lead, so it carries protein diversity.
  const keto = place(plate, rankHpMain(args, set.keto), "protein main");
  if (!keto) {
    pickLunchCarbOnly(args, plate, set.chapatiCarb);
    return;
  }
  composeWeekdayPlate(args, plate, keto, set);
}

/**
 * §3.2 shared weekday-plate builder for Menu 1/2. Places the protein lead, then
 * the affinity-driven carb (§3.4), then fills the remaining item budget with
 * companions under the hard one-Gravy-per-plate rule and plate rule 9. The lead's
 * carb affinity and the plate's gravy count are the only branch inputs, so Menu 1
 * and Menu 2 share one form.
 */
function composeWeekdayPlate(
  args: PickSlotArgs,
  plate: PlateBuilder,
  lead: Dish,
  set: Menu1CandidateSet | Menu2CandidateSet,
): void {
  pickWeekdayCarb(args, plate, lead, set.riceCarb, set.chapatiCarb);
  const budget = args.lunchBudget ?? LUNCH_MAX_ITEMS;
  appendCompanions(args, plate, set.companions, budget - plate.picks.length);
}

/**
 * §3.4 carb pick. `carbAffinity: Rice` draws from the plain Rice pool, but only
 * when rice did not land the previous day (the hard rice-spacing rule); otherwise
 * it falls back to Chapati. `Roti` and absent both draw from Chapati (today's
 * default). Ranked by §4; carbs are recency-exempt (§4), so a repeat is allowed.
 */
function pickWeekdayCarb(
  args: PickSlotArgs,
  plate: PlateBuilder,
  lead: Dish,
  riceCarb: Dish[],
  chapatiCarb: Dish[],
): void {
  const wantsRice = lead.carbAffinity === "Rice" && !args.previousDayRice && riceCarb.length > 0;
  place(plate, rank(args, wantsRice ? riceCarb : chapatiCarb), "carb");
}

/**
 * §3.2 companion fill. Fill `positions` companion slots from the unified non-HP
 * Indian companion pool, one position at a time so each sees the plate as it now
 * stands. Two hard rules and one ranking override apply:
 *
 * - **One wet dish per plate.** A Category=Gravy dish is excluded once the plate
 *   holds a gravy (from the lead or an earlier companion). No thin-pool fallback.
 * - **Plate rule 9.** While the plate carries a carb and holds no Gravy/Dry item,
 *   the position draws from the substantial companions only, so an Accompaniment
 *   is never the sole thing a roti is eaten with. Also no fallback: a plate one
 *   companion short beats a roti with a salad and nothing else.
 * - **§4.8 exploration.** When this slot carries the week's novelty position, the
 *   FIRST companion position is ranked for novelty instead of by §4.
 */
function appendCompanions(
  args: PickSlotArgs,
  plate: PlateBuilder,
  companionPool: Dish[],
  positions: number,
): void {
  for (let filled = 0; filled < positions; filled += 1) {
    const chosenIds = new Set(plate.picks.map((d) => d.id));
    const plateHasGravy = plate.picks.some((d) => d.category === "Gravy dish");
    let pool = companionPool.filter((d) => !chosenIds.has(d.id));
    if (plateHasGravy) pool = pool.filter((d) => d.category !== "Gravy dish");
    if (plateHasCarb(plate.picks) && !plate.picks.some(isSubstantialCompanion)) {
      pool = pool.filter(isSubstantialCompanion);
    }
    const explore = filled === 0 && args.exploreCompanion === true;
    const placed = place(
      plate,
      explore ? rankNovelty(args, pool) : rank(args, pool),
      `companion ${filled + 1}`,
    );
    if (!placed) return;
  }
}

/**
 * §3 Menu 3: complete_meal+HP + Accompaniment + Dessert. The lead is always
 * HP-tagged, so the Accompaniment carries the §3 one-HP-per-meal filter: it
 * drops HP-tagged dishes (e.g. a "Chicken salad" alongside a "Chicken biryani"
 * lead) unless that empties the pool, in which case the thin-pool fallback
 * keeps the slot fillable. Dessert is never HP-tagged, so the filter is a no-op
 * there but is applied uniformly for clarity. If §3.2 has pinned a lead
 * complete_meal Lunch dish, use it (overriding §4); otherwise rank.
 */
function pickMenu3(args: PickSlotArgs, plate: PlateBuilder, set: Menu3CandidateSet): void {
  // §4.6: the complete_meal+HP lead is the meal's HP main, so it is ranked with
  // protein diversity (a chicken biryani lead deprioritises a second chicken
  // main later in the week).
  const lead = place(plate, substitutedLeadPool(args, set.completeMealHp, rankHpMain), "lead");
  const mealHasHp = lead ? isHp(lead) : false;
  const accPool = excludeHpIfMealHasHp(excluding(set.accompaniment, lead), mealHasHp);
  place(
    plate,
    args.exploreCompanion === true ? rankNovelty(args, accPool) : rank(args, accPool),
    "accompaniment",
  );
  place(
    plate,
    rank(args, excludeHpIfMealHasHp(excluding(set.dessert, lead, ...plate.picks), mealHasHp)),
    "dessert",
  );
}

/**
 * §3 Menu 4: complete_meal-non-HP + Keto + Accompaniment. The lead is non-HP,
 * so the meal's one HP source (if any) is whichever of Keto/Accompaniment lands
 * one first. We track whether the meal already holds an HP dish and apply the
 * §3 one-HP-per-meal filter to each subsequent position: once Keto is HP, the
 * Accompaniment drops HP-tagged dishes (thin-pool fallback keeps it fillable).
 */
function pickMenu4(args: PickSlotArgs, plate: PlateBuilder, set: Menu4CandidateSet): void {
  // The lead is non-HP (no protein diversity on it). The Keto dish is the meal's
  // protein lead and the §4.6 main, so it is ranked with protein diversity.
  const lead = place(plate, substitutedLeadPool(args, set.completeMealNonHp, rank), "lead");
  let mealHasHp = lead ? isHp(lead) : false;
  const keto = place(
    plate,
    rankHpMain(args, excludeHpIfMealHasHp(excluding(set.keto, lead), mealHasHp)),
    "keto",
  );
  if (keto && isHp(keto)) mealHasHp = true;
  const accPool = excludeHpIfMealHasHp(excluding(set.accompaniment, lead, keto), mealHasHp);
  place(
    plate,
    args.exploreCompanion === true ? rankNovelty(args, accPool) : rank(args, accPool),
    "accompaniment",
  );
}

/**
 * §3 international lunch form (a coherent non-Indian register). The anchor is the
 * §3.2-pinned non-Indian dish. Then at most one companion in the SAME register,
 * with NO Indian carb:
 *
 * - A self-sufficient complete_meal anchor (e.g. Pad thai prawn, Singapore
 *   noodles) fills the slot alone, the §3 self-sufficient-main rule.
 * - A protein anchor (HP or Keto, e.g. Continental grilled chicken) takes at
 *   most one same-cuisine/neutral NON-HP veg side. The anchor is the meal's one
 *   HP source, so the side pool already excludes HP.
 * - A veg-forward anchor (not HP, not Keto, e.g. Continental baked vegetables)
 *   takes one same-cuisine/neutral protein companion, so the veggies are never
 *   served without a protein.
 *
 * Thin pools degrade gracefully: a missing companion leaves the anchor as a valid
 * 1-item international meal.
 */
function pickMenuIntl(args: PickSlotArgs, plate: PlateBuilder, set: MenuIntlCandidateSet): void {
  // §4.6: the anchor is the meal's main; rank it with protein diversity so a
  // chicken anchor deprioritises another chicken HP main later in the week. The
  // pinned anchor (substitutionLeadDishId) overrides ranking via substitutedLeadPool.
  const anchor = place(plate, substitutedLeadPool(args, set.anchor, rankHpMain), "anchor");
  if (!anchor) return;
  // A self-sufficient anchor (complete_meal, by tag or Category) fills the slot
  // alone: no companion, no carb. The cuisine's carb is built into the dish. The
  // §3.3 protein floor still applies to a non-HP self-sufficient anchor, so a Veg
  // hakka noodles lands with one protein companion.
  if (isSelfSufficientMain(anchor)) return;
  // §3.4 international carb: a carbAffinity: Rice anchor (a Thai/Korean curry)
  // takes register-neutral steamed rice, subject to rice spacing. The intl form
  // is otherwise carbless (no Indian carb); Roti affinity never applies here.
  if (anchor.carbAffinity === "Rice" && !args.previousDayRice) {
    place(plate, rank(args, set.neutralRiceCarb), "carb");
  }
  if (isHp(anchor) || anchor.category === "Keto") {
    // Protein anchor: add at most one same-cuisine/neutral non-HP veg side. The
    // anchor is HP/protein, so excludeHpIfMealHasHp keeps the side non-HP. Plate
    // rule 9 applies when the steamed rice landed: the one side then has to be
    // something to eat the rice with, not a salad.
    const sidePool = preferSubstantialStrict(
      excludeHpIfMealHasHp(excluding(set.sideCompanion, anchor, ...plate.picks), isHp(anchor)),
      plate.picks,
    );
    place(
      plate,
      args.exploreCompanion === true ? rankNovelty(args, sidePool) : rank(args, sidePool),
      "side",
    );
  } else {
    // Veg-forward anchor: add one same-cuisine/neutral protein companion. Ranked
    // as an HP main (§4.6) so it respects the week's protein spread.
    place(
      plate,
      rankHpMain(args, excluding(set.proteinCompanion, anchor, ...plate.picks)),
      "protein companion",
    );
  }
}

/**
 * Plate rule 9 with no thin-pool fallback, for the ordinary companion positions:
 * a carb plate with no Gravy/Dry item narrows to the substantial companions and
 * lands short rather than accepting an Accompaniment as its sole companion.
 */
function preferSubstantialStrict(pool: Dish[], picks: readonly Dish[]): Dish[] {
  if (!plateHasCarb(picks)) return pool;
  if (picks.some(isSubstantialCompanion)) return pool;
  return pool.filter(isSubstantialCompanion);
}

/**
 * §3.2 substitution: when a specific complete_meal dish was pinned, put it at the
 * head of the ranked pool so it leads the slot; the rest of the ranked pool stays
 * behind it as the fallback the §9 budget may need. The `ranker` argument lets the
 * HP-main lead (Menu 3) carry §4.6 protein diversity while the non-HP lead
 * (Menu 4) does not.
 */
function substitutedLeadPool(
  args: PickSlotArgs,
  pool: Dish[],
  ranker: (args: PickSlotArgs, pool: Dish[]) => Dish[],
): Dish[] {
  const ranked = ranker(args, pool);
  if (args.substitutionLeadDishId === undefined) return ranked;
  const pinned = ranked.find((d) => d.id === args.substitutionLeadDishId);
  if (!pinned) return ranked;
  return [pinned, ...ranked.filter((d) => d.id !== pinned.id)];
}

function pickLunchCarbOnly(args: PickSlotArgs, plate: PlateBuilder, lunchCarbPool: Dish[]): void {
  place(plate, rank(args, lunchCarbPool), "carb");
}

/**
 * Filter `pool` down to dishes whose id matches none of the already-`chosen`
 * dishes, so overlapping position pools never double-pick one dish across a
 * meal's positions. Undefined `chosen` entries (a lead/companion that did not
 * resolve) are ignored.
 */
function excluding(pool: Dish[], ...chosen: Array<Dish | undefined>): Dish[] {
  const excludedIds = new Set<number>();
  for (const dish of chosen) {
    if (dish) excludedIds.add(dish.id);
  }
  if (excludedIds.size === 0) return pool;
  return pool.filter((d) => !excludedIds.has(d.id));
}

/**
 * Group the composed slots into per-day results in schedule order. Nothing is
 * dropped (`features/engine-v4.md` §10.1 retires the post-hoc cap), so this is a
 * pure regrouping: every dish the loop picked is in the returned week. Days with
 * no slots (Sunday is unscheduled) are omitted.
 */
function groupSlotsByDay(slots: GeneratedWeekSlot[]): GeneratedWeekDay[] {
  const days: GeneratedWeekDay[] = [];
  for (const day of ALL_DAYS) {
    const daySlots = slots.filter((s) => s.day === day);
    if (daySlots.length === 0) continue;
    days.push({ day, slots: daySlots });
  }
  return days;
}
export interface RankCandidatesForSlotArgs {
  weekStart: string;
  day: Day;
  meal: Meal;
  library: Dish[];
  history: MenuHistoryRow[];
  season: Season;
  ingredients: Ingredient[];
  packSizes: PackSizeHeader[];
  /**
   * Dishes already locked into the in-progress week. Used to build the same
   * §10 consolidation ledger, the same §3.1 weekLunchCarbs, and the same §4
   * step 2 same-day breakfast Primary Ingredient that generateWeek used.
   */
  currentWeekPicks?: Dish[];
  /** Optional sibling input: the breakfast pick already on the same day. */
  sameDayBreakfastPick?: Dish;
  lastSaturdayMenu?: 3 | 4 | null;
}

/**
 * Returns a flat ranked list of alternative dishes for a single slot. Used by
 * the swap UI ("Replace with..."). Reuses the same composition + priority +
 * consolidation pipeline as generateWeek, but applied to one slot only.
 *
 * Where the slot has multiple positions (Menu 1 has HP + partner + carb), we
 * union the pools and dedupe by id, preserving the highest rank. This matches
 * the swap UX: the user is offered any eligible alternative for any slot of
 * the meal, ranked by §4.
 */
export function rankCandidatesForSlot(args: RankCandidatesForSlotArgs): Dish[] {
  const {
    weekStart,
    day,
    meal,
    library,
    history,
    season,
    ingredients,
    packSizes,
    currentWeekPicks = [],
    sameDayBreakfastPick,
    lastSaturdayMenu,
  } = args;

  // Reconstitute the SlotPlan with the same lunchMenu generateWeek
  // would have used (subject to substitution being signalled via currentWeek-
  // Picks, which the caller can pre-apply; the swap UI calls this for one
  // slot at a time without re-running substitution).
  const schedule = weekSchedule({ weekStart, lastSaturdayMenu });
  const slot = schedule.find((s) => s.day === day && s.meal === meal);
  if (!slot) return [];

  // Rebuild every per-slot ranking input from currentWeekPicks via the SAME
  // helper the main generation loop uses, so the swap picker's §10 ledger, §3.1
  // lunch carbs, synthetic within-week history, and §4 step 5 inputs cannot
  // drift from generation. The caller is responsible for not double-counting the
  // slot being ranked (i.e. not including its current pick in currentWeekPicks).
  const rankingInputs = deriveSlotRankingInputs({
    picks: currentWeekPicks,
    weekStart,
    ingredients,
    packSizes,
  });
  const compositionHistory: MenuHistoryRow[] = [...history, ...rankingInputs.inWeekHistory];

  const candidateSet = composeSlot({
    slot,
    library,
    history: compositionHistory,
    season,
    weekLunchCarbs: rankingInputs.weekLunchCarbs,
  });

  const sameDayPrimary =
    meal === "Lunch" && sameDayBreakfastPick ? sameDayBreakfastPick.primaryIngredient : undefined;

  const context: ConsolidationContext = { ledger: rankingInputs.ledger, ingredients };

  const pools = candidateSetPools(candidateSet);
  const ranked: Dish[] = [];
  const seen = new Set<number>();
  for (const pool of pools) {
    const r = rankCandidates({
      pool,
      history: compositionHistory,
      sameDayBreakfastPrimaryIngredient: sameDayPrimary,
      consolidationContext: context,
      withinWeekDishIds: rankingInputs.withinWeekDishIds,
      // §4 step 6 (within-week protein diversity) is DELIBERATELY OMITTED here.
      // The swap-time ranker has never applied step 6, while the main generation
      // loop does (it threads usedHpMainProteinFamilies into rankHpMain). That
      // divergence is intentional and preserved: a swap offers alternatives by
      // recency and consolidation without also re-spreading proteins across the
      // week. `deriveSlotRankingInputs` still computes
      // rankingInputs.usedHpMainProteinFamilies (one shared derivation), but it
      // is not passed on here. Leaving it off is the documented choice, not an
      // oversight; pass it through only if step 6 is intentionally added to swaps.
      //
      // §4 step 4 favorites never touch the swap picker either: favorites are a
      // guaranteed placement pass in `generateWeek` (`planFavorites`), not a ranking
      // input, so a swap offers alternatives by recency and consolidation without a
      // favorites tilt (spec §3: swaps and Explore adds are untouched by favorites).
    });
    for (const dish of r) {
      if (seen.has(dish.id)) continue;
      seen.add(dish.id);
      ranked.push(dish);
    }
  }
  return ranked;
}
