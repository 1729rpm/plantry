import type { Dish, Ingredient, MenuHistoryRow, PackSizeHeader, Season } from "./data/schemas.js";
import type { Day, Meal } from "./eligibility.js";
import { weekSchedule, type SlotPlan } from "./schedule.js";
import { eligibleDishes, ALL_DAYS } from "./eligibility.js";
import {
  composeSlot,
  candidateSetPools,
  fruitOfDayPool,
  shouldSubstituteWeekday,
  excludeHpIfMealHasHp,
  isHp,
  isStandaloneBreakfastBread,
  type BreakfastWeekdayPairCandidateSet,
  type BreakfastSinglePickCandidateSet,
  type CandidateSet,
  type Menu1CandidateSet,
  type Menu2CandidateSet,
  type Menu3CandidateSet,
  type Menu4CandidateSet,
} from "./composition.js";
import {
  rankCandidates,
  withinWeekRecencySet,
  proteinFamiliesUsedAsHpMain,
  placedNonIndianCount,
  type ConsolidationContext,
} from "./priority.js";
import { applyPick, emptyLedger, type IngredientLedger } from "./consolidation.js";
import { applyCap } from "./cap.js";
import { planRequests, slotKey } from "./requests.js";
import { lastCookedMap, toLongDay } from "./historyRows.js";

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
   * own section, outside the breakfast/lunch `slots` and outside the §9 item
   * cap, so it never appears in `slots` and is never a cap-drop candidate.
   * Absent only if the eligible fruit pool is empty for the season.
   */
  fruit?: Dish;
}

export interface GeneratedWeek {
  weekStart: string;
  days: GeneratedWeekDay[];
  /** Dish IDs dropped by §9 cap, in the order they were dropped. */
  droppedDishIds: number[];
  /** Human-readable warnings ("Friday over cap (5), dropped: ..."). */
  incidents: string[];
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
  } = args;

  const baseSchedule = weekSchedule({ weekStart, lastSaturdayMenu, rng });

  // §3.2: detect weekday complete_meal substitution and rewrite that day's
  // lunch SlotPlan to the substituted Menu 3/4 form (3 items, lunchMenu 3/4).
  const substitution = shouldSubstituteWeekday({
    library,
    history,
    season,
    userRequestedDishId,
  });
  const schedule = substitution
    ? baseSchedule.map((slot): SlotPlan => {
        if (slot.day !== substitution.day || slot.meal !== "Lunch") return slot;
        return {
          ...slot,
          itemCount: 3,
          lunchMenu: substitution.form === "menu-3" ? 3 : 4,
        };
      })
    : baseSchedule;

  // §6 requested dishes: plan each requested id into the first schedule slot
  // whose §3 composition accepts it, overriding recency. The §3.2 substitution
  // lead's slot is reserved so a request never collides with it. Unplaceable
  // requests fall through to incidents and are not placed.
  const reservedSlots = new Set<string>();
  if (substitution) {
    reservedSlots.add(slotKey(substitution.day, "Lunch"));
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
  for (const placement of requestPlan.placements) {
    const key = slotKey(placement.day, placement.meal);
    const list = pinsBySlot.get(key) ?? [];
    list.push(placement.dishId);
    pinsBySlot.set(key, list);
  }

  // Mutable accumulators threaded through the slot loop.
  let ledger: IngredientLedger = emptyLedger(packSizes);
  const weekLunchCarbs: Dish[] = [];
  const slotResults: GeneratedWeekSlot[] = [];
  // Every dish placed so far this week, in pick order. Feeds two things: the
  // synthetic within-week history below (step 1's date view of the in-progress
  // week) and the §4 step 5 within-week demotion set (`withinWeekRecencySet`),
  // which is the dominant signal that actually keeps a broad pool from picking
  // the same dish every Mon/Wed/Fri.
  const weekPicks: Dish[] = [];
  // Synthetic history for within-week recency: picks made earlier in the week
  // record a virtual cooking on `weekStart`, so §4 step 1 treats them as the
  // most recently cooked. Step 1 alone is not enough (steps 3 and 4 can
  // re-promote a placed dish), which is why §4 step 5 demotes them outright;
  // this synthetic history keeps step 1's ordering consistent with that. Lunch
  // carbs and fruit are recency-exempt in priority.ts, so neither over-filters.
  const inWeekHistory: MenuHistoryRow[] = [];
  // Same-day breakfast primary ingredient, set when we pick breakfast and
  // consumed by the same day's lunch slot to feed §4 step 2.
  const sameDayBreakfastPrimary = new Map<Day, string>();

  for (const slot of schedule) {
    const compositionHistory: MenuHistoryRow[] = [...history, ...inWeekHistory];
    const candidateSet = composeSlot({
      slot,
      library,
      history: compositionHistory,
      season,
      weekLunchCarbs,
    });
    const consolidationContext: ConsolidationContext = {
      ledger,
      ingredients,
    };
    // §4 step 5 within-week cuisine diversity: how many non-Indian dishes the
    // week has placed so far. Recomputed each slot so the step stops promoting
    // non-Indian candidates once the week hits WEEKLY_NON_INDIAN_TARGET. Soft,
    // target-gated; below target it ranks non-Indian candidates above Indian.
    const placedNonIndian = placedNonIndianCount(weekPicks);
    // §4 step 6: non-exempt dishes already placed this week sink below fresh
    // alternatives for this slot's ranking. Recomputed each slot from the
    // running picks so each subsequent slot sees the latest placements.
    const withinWeekDishIds = withinWeekRecencySet(weekPicks);
    // §4 step 7 (Cluster E): protein families already spent on an HP main this
    // week. Recomputed each slot so a later HP-main slot prefers a fresh protein
    // over one the week has already used (chicken, paneer). Soft, HP-main-only.
    const usedHpMainProteinFamilies = proteinFamiliesUsedAsHpMain(weekPicks);
    const picks = pickSlot({
      slot,
      candidateSet,
      compositionHistory,
      consolidationContext,
      placedNonIndianCount: placedNonIndian,
      withinWeekDishIds,
      usedHpMainProteinFamilies,
      sameDayBreakfastPrimaryIngredient:
        slot.meal === "Lunch" ? sameDayBreakfastPrimary.get(slot.day) : undefined,
      substitutionLeadDishId:
        substitution && substitution.day === slot.day && slot.meal === "Lunch"
          ? substitution.leadDishId
          : undefined,
      pinnedDishIds: pinsBySlot.get(slotKey(slot.day, slot.meal)),
    });

    // Update ledger and within-week recency on each pick.
    for (const dish of picks) {
      ledger = applyPick(ledger, dish, ingredients);
      weekPicks.push(dish);
      inWeekHistory.push({
        weekStart,
        day: toLongDay(slot.day),
        meal: slot.meal,
        dishName: dish.name,
        dishId: dish.id,
      });
    }

    // Track lunch carbs for §3.1 across the week.
    if (slot.meal === "Lunch") {
      for (const dish of picks) {
        if (dish.category === "Chapati" || dish.category === "Rice") {
          weekLunchCarbs.push(dish);
        }
      }
    }

    // Wire same-day breakfast primary ingredient to lunch's §4 step 2.
    if (slot.meal === "Breakfast" && picks.length > 0) {
      // Use the lead (index 0) breakfast pick as the headline ingredient.
      sameDayBreakfastPrimary.set(slot.day, picks[0].primaryIngredient);
    }

    slotResults.push({ day: slot.day, meal: slot.meal, dishes: picks });
  }

  // §9 cap: group by day, hand off to applyCap, emit one incident per drop.
  const slotsByDay = new Map<Day, Dish[]>();
  for (const day of ALL_DAYS) {
    slotsByDay.set(day, []);
  }
  for (const slot of slotResults) {
    const bucket = slotsByDay.get(slot.day);
    if (bucket) bucket.push(...slot.dishes);
  }
  const beforeCap = new Map<Day, Dish[]>();
  for (const [day, dishes] of slotsByDay) {
    beforeCap.set(day, [...dishes]);
  }
  const capped = applyCap({ slotsByDay });

  const incidents: string[] = [...requestPlan.incidents];
  for (const dishId of capped.droppedDishIds) {
    const dish = library.find((d) => d.id === dishId);
    const name = dish ? dish.name : `dish ${dishId}`;
    const droppedFromDay = findDroppedDay(beforeCap, capped.slotsByDay, dishId);
    const dayLabel = droppedFromDay ? toLongDay(droppedFromDay) : "Unknown day";
    const cap = droppedFromDay === "Sat" ? 3 : 5;
    incidents.push(`${dayLabel} over cap (${cap}), dropped: ${name}`);
  }

  // Reproject the capped slotsByDay back onto the slot results, preserving
  // pick order within each slot. We do this by walking each day's dishes in
  // capped order and matching them to the original (day, meal) slot they
  // came from. Drops show up as omissions.
  const cappedDays = projectCapBackToSlots(slotResults, capped.slotsByDay);

  // §3.3 Fruit of the day: one in-season Category=Fruit dish per scheduled day
  // (Mon-Sat, Saturday included), picked longest-unused. Fruit is recency-exempt
  // (§4), so the pick reads cross-week `history` only and does NOT consult this
  // week's earlier fruit picks: a thin pool may therefore repeat the same fruit
  // across days, which is intended. It is outside the §9 cap, so it is computed
  // after the cap and attached to the day rather than flowing through `slots`.
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
  // Ordered longest-unused first. We rotate through this order across the days
  // so a rich fruit pool gives variety (Mon gets the longest-unused, Tue the
  // next, and so on) while a thin pool simply wraps and repeats, which the
  // recency exemption explicitly allows. Wrapping by day index keeps the pick
  // deterministic and independent of the breakfast/lunch picks.
  const fruitByLongestUnused = orderFruitByLongestUnused(fruitEligible, history);
  if (fruitByLongestUnused.length > 0) {
    cappedDays.forEach((day, index) => {
      day.fruit = fruitByLongestUnused[index % fruitByLongestUnused.length];
    });
  }

  // §6 reconciliation: a planned request placement is only honoured if its
  // dish actually survives into the final week. A composition slot can expose a
  // pool a particular pick branch never draws from (e.g. Menu 1's accompaniment
  // pool when the HP lead is a Dry dish, so its partner is a Gravy instead), and
  // the §9 cap can drop a placed pick. Either way the pinned dish is then absent.
  // We re-check every placement against the final week and emit an incident for
  // any that did not land, so the §6 contract holds: a requested dish appears
  // exactly once OR yields an incident (never both, never neither).
  const placedIds = new Set<number>();
  for (const day of cappedDays) {
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

  return {
    weekStart,
    days: cappedDays,
    droppedDishIds: capped.droppedDishIds,
    incidents,
  };
}

interface PickSlotArgs {
  slot: SlotPlan;
  candidateSet: CandidateSet;
  compositionHistory: MenuHistoryRow[];
  consolidationContext: ConsolidationContext;
  /**
   * §4 step 5 within-week cuisine diversity: the count of non-Indian dishes
   * already placed this week. Threaded into every rankCandidates call for this
   * slot so, while the week is below WEEKLY_NON_INDIAN_TARGET, non-Indian
   * candidates rank above Indian ones (soft, with a fresh-alternative fallback).
   */
  placedNonIndianCount?: number;
  /**
   * §4 step 6 within-week recency: ids of non-exempt dishes already placed this
   * week. Threaded into every rankCandidates call for this slot so a dish picked
   * in an earlier slot sinks below fresh alternatives here.
   */
  withinWeekDishIds?: ReadonlySet<number>;
  /**
   * §4 step 7 within-week protein diversity (Cluster E): protein families
   * already spent on an HP main this week. Applied only when ranking an HP-main
   * position pool (`rankHpMain`), so a non-main companion pool is never reordered
   * by protein. Soft with fallback.
   */
  usedHpMainProteinFamilies?: ReadonlySet<string>;
  sameDayBreakfastPrimaryIngredient?: string;
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

function pickSlot(args: PickSlotArgs): Dish[] {
  const { candidateSet } = args;
  switch (candidateSet.kind) {
    case "breakfast-pair":
      return pickBreakfastPair(args, candidateSet);
    case "breakfast-single":
      return pickBreakfastSingle(args, candidateSet);
    case "menu-1":
      return pickMenu1(args, candidateSet);
    case "menu-2":
      return pickMenu2(args, candidateSet);
    case "menu-3":
      return pickMenu3(args, candidateSet);
    case "menu-4":
      return pickMenu4(args, candidateSet);
  }
}

function rank(args: PickSlotArgs, pool: Dish[]): Dish[] {
  const ranked = rankCandidates({
    pool,
    history: args.compositionHistory,
    sameDayBreakfastPrimaryIngredient: args.sameDayBreakfastPrimaryIngredient,
    consolidationContext: args.consolidationContext,
    placedNonIndianCount: args.placedNonIndianCount,
    withinWeekDishIds: args.withinWeekDishIds,
  });
  return promotePins(ranked, args.pinnedDishIds);
}

/**
 * Rank an HP-main position pool, applying §4 step 7 within-week protein
 * diversity on top of the §4 steps `rank` applies. Used for the protein-main
 * position of each meal form (Menu 1 HP, Menu 2 Keto, Menu 3 complete_meal+HP,
 * Menu 4 Keto, and any HP breakfast main). Companion positions still call
 * `rank`, so protein diversity never reorders a non-main pool.
 */
function rankHpMain(args: PickSlotArgs, pool: Dish[]): Dish[] {
  const ranked = rankCandidates({
    pool,
    history: args.compositionHistory,
    sameDayBreakfastPrimaryIngredient: args.sameDayBreakfastPrimaryIngredient,
    consolidationContext: args.consolidationContext,
    placedNonIndianCount: args.placedNonIndianCount,
    withinWeekDishIds: args.withinWeekDishIds,
    usedHpMainProteinFamilies: args.usedHpMainProteinFamilies,
  });
  return promotePins(ranked, args.pinnedDishIds);
}

/**
 * §6: move any pinned (requested) dishes present in `ranked` to the front,
 * overriding §4 recency for that position. Pinned dishes keep their relative
 * order; the rest follow in ranked order. Pinned ids absent from the pool are
 * ignored (the request planner only pins into accepting slots).
 */
function promotePins(ranked: Dish[], pinnedDishIds: number[] | undefined): Dish[] {
  if (!pinnedDishIds || pinnedDishIds.length === 0) return ranked;
  const pinnedSet = new Set(pinnedDishIds);
  const pinned: Dish[] = [];
  for (const id of pinnedDishIds) {
    const dish = ranked.find((d) => d.id === id);
    if (dish) pinned.push(dish);
  }
  if (pinned.length === 0) return ranked;
  const rest = ranked.filter((d) => !pinnedSet.has(d.id));
  return [...pinned, ...rest];
}

/**
 * §3 breakfast Mon/Wed/Fri (savoury only): try Option B (complete_carb +
 * accompaniment) first, then Option C (dry main + plain carb). The first option
 * whose pools both yield a pick wins. The fruit-bearing Option A is retired:
 * fruit is the standalone Fruit of the day (§3.3), picked per day outside the
 * breakfast/lunch slots.
 */
function pickBreakfastPair(args: PickSlotArgs, set: BreakfastWeekdayPairCandidateSet): Dish[] {
  const optionB = tryPair(args, set.optionB.completeCarb, set.optionB.accompaniment);
  if (optionB) return optionB;
  const optionC = tryPair(args, set.optionC.dryMain, set.optionC.plainCarb);
  if (optionC) return optionC;
  return [];
}

function tryPair(args: PickSlotArgs, leadPool: Dish[], partnerPool: Dish[]): Dish[] | null {
  if (leadPool.length === 0 || partnerPool.length === 0) return null;
  // §4.6: the breakfast lead is the meal's main, so it carries protein diversity
  // (an HP breakfast main counts toward and respects the week's protein spread).
  // It is a no-op for non-HP leads (their family is not in the HP-main used-set).
  const leadRanked = rankHpMain(args, leadPool);
  const lead = leadRanked[0];
  // §3 R1 self-sufficient main: a Category=Bread complete_carb Option-B lead
  // (avocado toast, masala toast) fills the breakfast alone, with no
  // accompaniment, so it returns a 1-item breakfast. A Chilla or Paratha
  // complete_carb falls through and keeps its accompaniment.
  if (isStandaloneBreakfastBread(lead)) return [lead];
  // §3 one-HP-per-meal: once the lead is HP, the partner pool drops HP-tagged
  // dishes (thin-pool fallback keeps the slot fillable). Avoid double-picking
  // the same dish across positions when pools overlap.
  const partnerRanked = rank(
    args,
    excludeHpIfMealHasHp(excluding(partnerPool, lead), isHp(lead)),
  );
  if (partnerRanked.length === 0) return null;
  return [lead, partnerRanked[0]];
}

function pickBreakfastSingle(args: PickSlotArgs, set: BreakfastSinglePickCandidateSet): Dish[] {
  // §4.6: the single breakfast dish is the meal's main, so it carries protein
  // diversity (no-op for the non-HP candidates in the pool).
  const ranked = rankHpMain(args, set.pool);
  if (ranked.length === 0) return [];
  const main = ranked[0];
  // §3 R3 breakfast protein floor (Tue/Thu single pick): if the single main
  // carries no HP tag, append one HP Category=Keto companion (boiled eggs etc.),
  // making a 2-item breakfast. It fires only at HP count 0, so it composes with
  // one-HP-per-meal and never produces two HP. An empty companion pool degrades
  // gracefully to the 1-item breakfast.
  if (!isHp(main)) {
    const companionRanked = rank(args, excluding(set.ketoCompanion, main));
    if (companionRanked.length > 0) return [main, companionRanked[0]];
  }
  return [main];
}

/**
 * §3 Menu 1: HP first, then a partner that complements the main's form (§3 R4),
 * then lunch carb. A Dry HP main pairs a non-HP Gravy (a dal); a Gravy HP main
 * pairs a non-HP Dry sabzi, so an Indian lunch always carries both a gravy and a
 * dry dish around its protein. The Menu 1 main is the meal's HP pick, so the
 * partner pool is non-HP: a meal carries one HP source, not two. Menu 1 stays 3
 * items (the §9 weekday cap of 5 holds). Gravy-branch thin-pool fallback chain:
 * non-HP Dry sabzi → non-HP Accompaniment (a salad) → unfiltered Accompaniment,
 * so the slot always fills, accepting a second HP side only as a last resort
 * over an incomplete meal.
 */
function pickMenu1(args: PickSlotArgs, set: Menu1CandidateSet): Dish[] {
  // §4.6: the HP main is ranked with protein diversity so a week's Menu 1 mains
  // spread across proteins instead of repeating chicken/paneer.
  const hpRanked = rankHpMain(args, set.hp);
  if (hpRanked.length === 0) {
    return pickLunchCarbOnly(args, set.lunchCarb);
  }
  const hp = hpRanked[0];
  let partnerPool: Dish[];
  if (hp.category === "Dry dish") {
    partnerPool = set.partnerWhenHpIsDry;
  } else {
    // §3 R4: Gravy main → non-HP Dry sabzi partner. Fall back to a non-HP
    // Accompaniment (a salad) only if the Dry-sabzi pool is empty, then to the
    // unfiltered Accompaniment pool if even that is empty.
    if (set.partnerWhenHpIsGravy.length > 0) {
      partnerPool = set.partnerWhenHpIsGravy;
    } else if (set.partnerWhenHpIsGravyFallback.length > 0) {
      partnerPool = set.partnerWhenHpIsGravyFallback;
    } else {
      partnerPool = set.partnerWhenHpIsGravyLastResort;
    }
  }
  const partnerRanked = rank(args, excluding(partnerPool, hp));
  const partner = partnerRanked[0];
  const carbRanked = rank(args, set.lunchCarb);
  const carb = carbRanked[0];
  return compact([hp, partner, carb]);
}

function pickMenu2(args: PickSlotArgs, set: Menu2CandidateSet): Dish[] {
  // §4.6: the Keto dish is Menu 2's protein lead, so it carries protein
  // diversity. The non-HP Gravy/Dry companions do not (they are not HP mains).
  const ketoRanked = rankHpMain(args, set.keto);
  const keto = ketoRanked[0];
  // Exact-preserving note: the gravy pool empties when the Keto lead did not
  // resolve (`keto` undefined). This differs from `excluding`'s "undefined leads
  // ignored" contract, so we keep the original guard for the no-keto case rather
  // than flattening it: when there is no keto lead, no gravy is picked either.
  const gravyRanked = rank(args, keto ? excluding(set.nonHpGravy, keto) : []);
  const gravy = gravyRanked[0];
  const dryRanked = rank(args, excluding(set.nonHpDry, keto, gravy));
  const dry = dryRanked[0];
  const carbRanked = rank(args, set.lunchCarb);
  const carb = carbRanked[0];
  return compact([keto, gravy, dry, carb]);
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
function pickMenu3(args: PickSlotArgs, set: Menu3CandidateSet): Dish[] {
  // §4.6: the complete_meal+HP lead is the meal's HP main, so it is ranked with
  // protein diversity (a chicken biryani lead deprioritises a second chicken
  // main later in the week).
  const lead = pickSubstitutedLead(args, set.completeMealHp, rankHpMain);
  const mealHasHp = lead ? isHp(lead) : false;
  const acc = rank(
    args,
    excludeHpIfMealHasHp(excluding(set.accompaniment, lead), mealHasHp),
  )[0];
  const dessert = rank(
    args,
    excludeHpIfMealHasHp(excluding(set.dessert, lead), mealHasHp),
  )[0];
  return compact([lead, acc, dessert]);
}

/**
 * §3 Menu 4: complete_meal-non-HP + Keto + Accompaniment. The lead is non-HP,
 * so the meal's one HP source (if any) is whichever of Keto/Accompaniment lands
 * one first. We track whether the meal already holds an HP dish and apply the
 * §3 one-HP-per-meal filter to each subsequent position: once Keto is HP, the
 * Accompaniment drops HP-tagged dishes (thin-pool fallback keeps it fillable).
 */
function pickMenu4(args: PickSlotArgs, set: Menu4CandidateSet): Dish[] {
  // The lead is non-HP (no protein diversity on it). The Keto dish is the meal's
  // protein lead and the §4.6 main, so it is ranked with protein diversity.
  const lead = pickSubstitutedLead(args, set.completeMealNonHp, rank);
  let mealHasHp = lead ? isHp(lead) : false;
  const keto = rankHpMain(
    args,
    excludeHpIfMealHasHp(excluding(set.keto, lead), mealHasHp),
  )[0];
  if (keto && isHp(keto)) mealHasHp = true;
  const acc = rank(
    args,
    excludeHpIfMealHasHp(excluding(set.accompaniment, lead), mealHasHp),
  )[0];
  return compact([lead, keto, acc]);
}

/**
 * §3.2 substitution: when a specific complete_meal dish was pinned, prefer
 * it directly (rank still consulted for fallback). Otherwise rank normally.
 * The `ranker` argument lets the HP-main lead (Menu 3) carry §4.6 protein
 * diversity while the non-HP lead (Menu 4) does not.
 */
function pickSubstitutedLead(
  args: PickSlotArgs,
  pool: Dish[],
  ranker: (args: PickSlotArgs, pool: Dish[]) => Dish[],
): Dish | undefined {
  if (args.substitutionLeadDishId !== undefined) {
    const pinned = pool.find((d) => d.id === args.substitutionLeadDishId);
    if (pinned) return pinned;
  }
  const ranked = ranker(args, pool);
  return ranked[0];
}

function pickLunchCarbOnly(args: PickSlotArgs, lunchCarbPool: Dish[]): Dish[] {
  const carbRanked = rank(args, lunchCarbPool);
  return carbRanked[0] ? [carbRanked[0]] : [];
}

function compact(dishes: Array<Dish | undefined>): Dish[] {
  return dishes.filter((d): d is Dish => d !== undefined);
}

/**
 * Filter `pool` down to dishes whose id matches none of the already-`chosen`
 * dishes, so overlapping position pools never double-pick one dish across a
 * meal's positions. Undefined `chosen` entries (a lead/companion that did not
 * resolve) are ignored, matching the per-site null-guards the pick functions
 * previously open-coded. Behaviour-identical to the inline
 * `pool.filter((d) => d.id !== a.id && (!b || d.id !== b.id))` shapes it
 * replaces: the same ids are excluded and an undefined chosen dish excludes
 * nothing.
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
 * §3.3 fruit ranking: order an eligible Category=Fruit pool oldest-last-cooked
 * first (never cooked counts as longest unused), ties broken by input order for
 * a stable result. Unlike the §4 step 1 ranker (`byLongestUnused`) this does NOT
 * honour the fruit recency exemption: the exemption frees fruit to REPEAT within
 * a week, but the selection of WHICH fruit still wants the longest-unused one, so
 * the cross-week rotation works. The pool here is already Category=Fruit, so no
 * non-fruit dish is ever affected.
 */
function orderFruitByLongestUnused(pool: Dish[], history: MenuHistoryRow[]): Dish[] {
  const lastCooked = lastCookedMap(history);
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

function findDroppedDay(
  before: Map<Day, Dish[]>,
  after: Map<Day, Dish[]>,
  dishId: number,
): Day | null {
  for (const day of ALL_DAYS) {
    const wasIn = (before.get(day) ?? []).some((d) => d.id === dishId);
    const stillIn = (after.get(day) ?? []).some((d) => d.id === dishId);
    if (wasIn && !stillIn) return day;
  }
  return null;
}

/**
 * Re-bucket capped day-level dish lists back into per-(day, meal) slots,
 * preserving the original slot order. Any dish dropped by the cap is simply
 * absent from the returned slot's `dishes`.
 */
function projectCapBackToSlots(
  preCap: GeneratedWeekSlot[],
  cappedByDay: Map<Day, Dish[]>,
): GeneratedWeekDay[] {
  const slotsGrouped = new Map<Day, GeneratedWeekSlot[]>();
  for (const day of ALL_DAYS) slotsGrouped.set(day, []);
  for (const slot of preCap) {
    slotsGrouped.get(slot.day)?.push(slot);
  }

  const days: GeneratedWeekDay[] = [];
  for (const day of ALL_DAYS) {
    const remaining = new Set<number>((cappedByDay.get(day) ?? []).map((d) => d.id));
    const slots = (slotsGrouped.get(day) ?? []).map((slot) => ({
      day: slot.day,
      meal: slot.meal,
      dishes: slot.dishes.filter((d) => remaining.has(d.id)),
    }));
    // Skip days with no slots (Sun is not scheduled at all).
    if (slots.length === 0) continue;
    days.push({ day, slots });
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

  // Reconstitute the SlotPlan with the same itemCount + lunchMenu generateWeek
  // would have used (subject to substitution being signalled via currentWeek-
  // Picks, which the caller can pre-apply; the swap UI calls this for one
  // slot at a time without re-running substitution).
  const schedule = weekSchedule({ weekStart, lastSaturdayMenu });
  const slot = schedule.find((s) => s.day === day && s.meal === meal);
  if (!slot) return [];

  // Rebuild a ledger and weekLunchCarbs from currentWeekPicks.
  let ledger: IngredientLedger = emptyLedger(packSizes);
  for (const dish of currentWeekPicks) {
    ledger = applyPick(ledger, dish, ingredients);
  }
  const weekLunchCarbs = currentWeekPicks.filter(
    (d) => d.category === "Chapati" || d.category === "Rice",
  );

  // Synthetic within-week history so already-picked dishes rank as recently
  // cooked. The caller is responsible for not double-counting the slot being
  // ranked (i.e. not including its current pick in currentWeekPicks).
  const inWeekHistory: MenuHistoryRow[] = currentWeekPicks.map((d) => ({
    weekStart,
    day: toLongDay(day),
    meal,
    dishName: d.name,
    dishId: d.id,
  }));

  const candidateSet = composeSlot({
    slot,
    library,
    history: [...history, ...inWeekHistory],
    season,
    weekLunchCarbs,
  });

  const sameDayPrimary =
    meal === "Lunch" && sameDayBreakfastPick ? sameDayBreakfastPick.primaryIngredient : undefined;

  const context: ConsolidationContext = { ledger, ingredients };

  // §4 step 5: the same placed-non-Indian count generateWeek builds, so the swap
  // picker's cuisine-diversity nudge matches generation: while the week is below
  // WEEKLY_NON_INDIAN_TARGET, non-Indian alternatives surface above Indian ones.
  const placedNonIndian = placedNonIndianCount(currentWeekPicks);
  // §4 step 6: the same within-week demotion set generateWeek builds, derived
  // from the dishes already placed this week (exempt dishes excluded by the
  // shared helper), so the swap picker ranks an already-placed dish below fresh
  // alternatives exactly as generation does.
  const withinWeekDishIds = withinWeekRecencySet(currentWeekPicks);

  const pools = candidateSetPools(candidateSet);
  const ranked: Dish[] = [];
  const seen = new Set<number>();
  for (const pool of pools) {
    const r = rankCandidates({
      pool,
      history: [...history, ...inWeekHistory],
      sameDayBreakfastPrimaryIngredient: sameDayPrimary,
      consolidationContext: context,
      placedNonIndianCount: placedNonIndian,
      withinWeekDishIds,
    });
    for (const dish of r) {
      if (seen.has(dish.id)) continue;
      seen.add(dish.id);
      ranked.push(dish);
    }
  }
  return ranked;
}
