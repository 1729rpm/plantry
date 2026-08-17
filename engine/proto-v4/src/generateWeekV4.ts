import type { Dish, MenuHistoryRow, Season } from "../../src/data/schemas.js";
import type { Day, Meal } from "../../src/eligibility.js";
import { ALL_DAYS, WEEKDAYS } from "../../src/eligibility.js";
// §4.6 protein-family normalization: unchanged in v4, reused verbatim from v3.
import { proteinFamily } from "../../src/priority.js";
// §8 history-row derivation helpers: unchanged in v4, reused verbatim from v3.
import { toLongDay } from "../../src/historyRows.js";

import {
  buildPools,
  breakfastChutneyPool,
  breakfastKetoSidePool,
  breakfastMainPool,
  carriesChutney,
  chapatiPool,
  indianLeadPool,
  isHp,
  isKeto,
  neutralProteinSidePool,
  neutralRicePool,
  saturdayLeadPool,
  saturdayThirdPool,
  servesAlone,
  standaloneLeadPool,
  type Pools,
} from "./pool.js";
import {
  EXPLORATION_DAY,
  carbPoolFor,
  indianCompanionPoolFor,
  indianSecondCompanionPool,
  isStandaloneDay,
  standaloneSidePoolFor,
} from "./composeV4.js";
import { buildFrequencyIndex, type FrequencyIndex } from "./frequency.js";
import { buildGuardIndex, buildLastCookedIndex, dateForDay, type GuardIndex } from "./guard.js";
import { pickTop, type RankMode } from "./rank.js";
import { planFavoritesV4 } from "./favoritesV4.js";
import { pairsWithFor } from "./pairsWith.js";
import type { DayPlan, FavoriteInput, Incident, Pick, Role, WeekPlan } from "./types.js";

/**
 * §3.2 to §3.5, per-week generation.
 *
 * One pass over Mon..Sat in schedule order. Each day picks its fruit, then breakfast
 * (Mon-Fri), then lunch, because plate rule 6 reads the day's breakfast main. The week's
 * picks accumulate into the within-week set (§3.4 step 4) as it goes.
 */

export const WEEKDAY_CAP = 5;
export const SATURDAY_CAP = 3;

export interface GenerateWeekV4Args {
  library: Dish[];
  /** Committed history: the seed file plus every finalized week before this one. */
  history: MenuHistoryRow[];
  weekStart: string;
  season: Season;
  /** Favorites in oldest-added order. */
  favorites: readonly FavoriteInput[];
}

export interface GenerateWeekV4Result {
  week: WeekPlan;
  incidents: Incident[];
}

/** Roles exempt from the §3.4 guard and within-week no-repeat. */
const EXEMPT_ROLES = new Set<Role>(["carb", "fruit"]);

function slotKey(day: Day, meal: Meal): string {
  return `${day}:${meal}`;
}

export function generateWeekV4(args: GenerateWeekV4Args): GenerateWeekV4Result {
  const { library, history, weekStart, season, favorites } = args;

  const pools = buildPools(library, season);
  const frequency = buildFrequencyIndex(history);
  const guard = buildGuardIndex(history);
  const lastCooked = buildLastCookedIndex(history);
  const incidents: Incident[] = [];

  // Schedule slots in generation order, for the favorites pass.
  const slots: { day: Day; meal: Meal }[] = [];
  for (const day of ALL_DAYS) {
    if (day !== "Sat") slots.push({ day, meal: "Breakfast" });
    slots.push({ day, meal: "Lunch" });
  }

  const favPlan = planFavoritesV4({ favorites, slots, library, pools });
  const pendingPins = new Map<string, Set<number>>();
  for (const pin of favPlan.pins) {
    const key = slotKey(pin.day, pin.meal);
    const set = pendingPins.get(key) ?? new Set<number>();
    set.add(pin.dishId);
    pendingPins.set(key, set);
  }
  for (const u of favPlan.unplaced) {
    incidents.push({
      weekStart,
      kind: "unplaced-favorite",
      reason: u.reason,
      dishId: u.dishId,
      dishName: library.find((d) => d.id === u.dishId)?.name,
    });
  }

  const withinWeekDishIds = new Set<number>();
  const days: DayPlan[] = [];
  let previousDayHadRiceCarb = false;
  let mondayLeadCuisine: string | undefined;

  /** Rank a position pool and take its top dish, recording pool/guard incidents. */
  function choose(opts: {
    pool: Dish[];
    day: Day;
    slotLabel: string;
    mode?: RankMode;
    recencyExempt?: boolean;
    pinned?: Set<number>;
    prefer?: ReadonlySet<number>;
    demoteProteinFamily?: string;
    /** When false, an empty pool is legal and no incident is written. */
    reportEmpty?: boolean;
  }): Dish | undefined {
    const mode: RankMode = opts.mode ?? "frequency";
    const recencyExempt = opts.recencyExempt ?? false;
    const slotDate = dateForDay(weekStart, opts.day);
    const pinned = opts.pinned ?? new Set<number>();
    // Only pins that actually appear in this position's pool can lead it.
    const applicablePins = new Set<number>(
      [...pinned].filter((id) => opts.pool.some((d) => d.id === id)),
    );

    const { dish, guardRelaxed } = pickTop({
      pool: opts.pool,
      mode,
      frequency,
      guard,
      lastCooked,
      slotDate,
      withinWeekDishIds,
      recencyExempt,
      pinnedDishIds: applicablePins,
      preferDishIds: opts.prefer,
      demoteProteinFamily: opts.demoteProteinFamily,
    });

    if (guardRelaxed) {
      incidents.push({
        weekStart,
        day: opts.day,
        slot: opts.slotLabel,
        kind: "guard-relaxation",
        reason: `the 7-day repeat guard emptied a pool of ${opts.pool.length}, so it relaxed for this position`,
      });
    }
    if (!dish && (opts.reportEmpty ?? true)) {
      incidents.push({
        weekStart,
        day: opts.day,
        slot: opts.slotLabel,
        kind: "empty-pool",
        reason: "no eligible candidate for this position",
      });
    }
    return dish;
  }

  /**
   * Record a pick. `recencyExempt` marks the §3.4 exemptions (lunch carbs, fruit, and the
   * plate rule 2 protein side); an exempt pick never enters the within-week set. The
   * breakfast HP Keto attach side is deliberately NOT exempt: the spec's exemption list
   * names the rule 2 LUNCH protein side only.
   */
  function commit(
    picks: Pick[],
    dish: Dish,
    role: Role,
    pinned?: Set<number>,
    recencyExempt: boolean = EXEMPT_ROLES.has(role),
  ): void {
    picks.push({ dish, role });
    if (!recencyExempt) withinWeekDishIds.add(dish.id);
    pinned?.delete(dish.id);
  }

  for (const day of ALL_DAYS) {
    const date = dateForDay(weekStart, day);
    const breakfast: Pick[] = [];
    const lunch: Pick[] = [];

    // -- Fruit of the day (§3.2, §3.4 fruit ranking) ------------------------
    const fruitDish = choose({
      pool: pools.fruit,
      day,
      slotLabel: "Fruit",
      mode: "fruit",
      recencyExempt: true,
    });
    const fruit: Pick | undefined = fruitDish ? { dish: fruitDish, role: "fruit" } : undefined;

    // -- Breakfast, uniform Mon-Fri (§3.2) ---------------------------------
    let breakfastMainDish: Dish | undefined;
    if (day !== "Sat") {
      const bfPins = pendingPins.get(slotKey(day, "Breakfast")) ?? new Set<number>();
      const main = choose({
        pool: breakfastMainPool(pools),
        day,
        slotLabel: "Breakfast:main",
        pinned: bfPins,
      });
      if (main) {
        breakfastMainDish = main;
        commit(breakfast, main, "breakfast-main", bfPins);

        if (!servesAlone(main)) {
          // Attach rule: a Chilla or Paratha main carries one breakfast chutney.
          if (carriesChutney(main)) {
            const chutney = choose({
              pool: breakfastChutneyPool(pools).filter((d) => d.id !== main.id),
              day,
              slotLabel: "Breakfast:chutney",
              pinned: bfPins,
            });
            if (chutney) commit(breakfast, chutney, "breakfast-accompaniment", bfPins);
          }
          // Attach rule: a main with no HP tag gains one HP Keto side.
          if (!isHp(main)) {
            const ketoSide = choose({
              pool: breakfastKetoSidePool(pools).filter((d) => d.id !== main.id),
              day,
              slotLabel: "Breakfast:hp-keto-side",
              pinned: bfPins,
            });
            if (ketoSide) commit(breakfast, ketoSide, "protein-floor", bfPins, false);
            else
              incidents.push({
                weekStart,
                day,
                slot: "Breakfast:hp-keto-side",
                kind: "protein-floor-unfilled",
                reason: "no HP Keto breakfast side available for a non-HP main",
              });
          }
        }
      }
      // A pin the slot could not place.
      for (const id of bfPins) {
        incidents.push({
          weekStart,
          day,
          slot: "Breakfast",
          kind: "unplaced-favorite",
          reason: "pinned to this breakfast slot but no position placed it",
          dishId: id,
          dishName: library.find((d) => d.id === id)?.name,
        });
      }
      pendingPins.delete(slotKey(day, "Breakfast"));
    }

    const demoteFamily = breakfastMainDish ? proteinFamily(breakfastMainDish) : undefined;

    // -- Lunch --------------------------------------------------------------
    const lunchPins = pendingPins.get(slotKey(day, "Lunch")) ?? new Set<number>();
    let dayHasRiceCarb = false;

    if (day === "Sat") {
      dayHasRiceCarb = buildSaturday();
    } else if (isStandaloneDay(day)) {
      dayHasRiceCarb = buildStandalone();
    } else {
      dayHasRiceCarb = buildIndianPlate();
    }

    for (const id of lunchPins) {
      incidents.push({
        weekStart,
        day,
        slot: "Lunch",
        kind: "unplaced-favorite",
        reason: "pinned to this lunch slot but no position placed it",
        dishId: id,
        dishName: library.find((d) => d.id === id)?.name,
      });
    }
    pendingPins.delete(slotKey(day, "Lunch"));

    // -- §3.5 cap: assert and log, drop nothing -----------------------------
    const cap = day === "Sat" ? SATURDAY_CAP : WEEKDAY_CAP;
    const itemCount = breakfast.length + lunch.length;
    if (itemCount > cap) {
      incidents.push({
        weekStart,
        day,
        slot: "Day",
        kind: "cap-exceeded",
        reason: `composed ${itemCount} items against a cap of ${cap}; nothing dropped (§3.5 assert-and-log)`,
      });
    }

    previousDayHadRiceCarb = dayHasRiceCarb;
    days.push({ day, date, fruit, breakfast, lunch });

    // ---------------------------------------------------------------------
    // Lunch form builders (closures so they share the day's local state).
    // ---------------------------------------------------------------------

    /** §3.2 standalone plate (Mon, Tue). Returns whether a Rice carb landed. */
    function buildStandalone(): boolean {
      let leadPool = standaloneLeadPool(pools);
      // "The two leads prefer distinct cuisines."
      if (day === "Tue" && mondayLeadCuisine !== undefined) {
        const distinct = leadPool.filter((d) => d.cuisine !== mondayLeadCuisine);
        if (distinct.length > 0) leadPool = distinct;
      }
      const lead = choose({
        pool: leadPool,
        day,
        slotLabel: "Lunch:standalone-lead",
        pinned: lunchPins,
        demoteProteinFamily: demoteFamily,
      });
      if (!lead) return false;
      if (day === "Mon") mondayLeadCuisine = lead.cuisine;
      commit(lunch, lead, "protein-main", lunchPins);

      const prefer = preferSetFor(lead);

      if (!isHp(lead) && !isKeto(lead)) {
        // Plate rule 2: a non-HP standalone lead takes one cuisine-neutral protein side.
        const side = choose({
          pool: neutralProteinSidePool(pools.weekdayLunch).filter((d) => d.id !== lead.id),
          day,
          slotLabel: "Lunch:protein-side",
          recencyExempt: true,
          pinned: lunchPins,
          reportEmpty: false,
        });
        if (side) commit(lunch, side, "protein-floor", lunchPins, true);
        else
          incidents.push({
            weekStart,
            day,
            slot: "Lunch:protein-side",
            kind: "protein-floor-unfilled",
            reason: "no cuisine-neutral protein available for a non-HP standalone lead",
          });
      } else {
        // An HP or Keto anchor may take one same-cuisine-or-neutral non-HP veg side.
        const side = choose({
          pool: standaloneSidePoolFor(pools, lead),
          day,
          slotLabel: "Lunch:standalone-side",
          pinned: lunchPins,
          prefer,
          demoteProteinFamily: demoteFamily,
          reportEmpty: false,
        });
        if (side) commit(lunch, side, "companion", lunchPins);
      }

      let riceLanded = false;
      if (lead.carbAffinity === "Rice") {
        if (previousDayHadRiceCarb) {
          // Rice spacing (plate rule 4) blocks it; the standalone plate then takes no carb.
        } else {
          const rice = choose({
            pool: neutralRicePool(pools),
            day,
            slotLabel: "Lunch:neutral-rice",
            recencyExempt: true,
            reportEmpty: false,
          });
          if (rice) {
            commit(lunch, rice, "carb", lunchPins);
            riceLanded = true;
          }
        }
      }

      reportUnplacedPartners(lead, lunch, "Lunch:standalone");
      if (lunch.length > 2) {
        incidents.push({
          weekStart,
          day,
          slot: "Lunch:standalone",
          kind: "standalone-over-two-items",
          reason: `standalone plate composed ${lunch.length} items; §3.2 describes it as 1 to 2`,
        });
      }
      return riceLanded;
    }

    /** §3.2 Indian plate (Wed, Thu, Fri). Returns whether a Rice carb landed. */
    function buildIndianPlate(): boolean {
      const lead = choose({
        pool: indianLeadPool(pools),
        day,
        slotLabel: "Lunch:indian-lead",
        pinned: lunchPins,
        demoteProteinFamily: demoteFamily,
      });

      let riceLanded = false;
      if (!lead) {
        // Plate rule 2 fallback: an empty lead pool still yields a plate with protein.
        incidents.push({
          weekStart,
          day,
          slot: "Lunch:indian-lead",
          kind: "protein-floor-unfilled",
          reason: "no Indian HP-or-Keto lead available",
        });
        return false;
      }
      commit(lunch, lead, "protein-main", lunchPins);

      const prefer = preferSetFor(lead);

      // Carb by carbAffinity, under rice spacing (plate rule 4).
      let carbCandidates = carbPoolFor(pools, lead);
      if (lead.carbAffinity === "Rice" && previousDayHadRiceCarb) {
        carbCandidates = chapatiPool(pools);
      }
      const carb = choose({
        pool: carbCandidates,
        day,
        slotLabel: "Lunch:carb",
        recencyExempt: true,
        pinned: lunchPins,
        prefer,
      });
      if (carb) {
        commit(lunch, carb, "carb", lunchPins);
        if (carb.category === "Rice") riceLanded = true;
      }

      // One companion from the non-HP Indian pool. On Friday this position is the
      // week's single exploration slot (D1).
      const isExploration = day === EXPLORATION_DAY;
      const companion = choose({
        pool: indianCompanionPoolFor(pools, lead),
        day,
        slotLabel: isExploration ? "Lunch:companion(exploration)" : "Lunch:companion",
        mode: isExploration ? "exploration" : "frequency",
        pinned: lunchPins,
        prefer,
        demoteProteinFamily: demoteFamily,
      });
      if (companion) {
        commit(lunch, companion, isExploration ? "exploration" : "companion", lunchPins);

        // "When the companion is a Gravy (a dal), one additional Dry companion is allowed."
        if (companion.category === "Gravy dish") {
          const secondPrefer = preferSetFor(
            companion,
            indianSecondCompanionPool(pools, [lead, companion]),
          );
          const second = choose({
            pool: indianSecondCompanionPool(pools, [lead, companion]),
            day,
            slotLabel: "Lunch:companion-2",
            pinned: lunchPins,
            prefer: secondPrefer,
            demoteProteinFamily: demoteFamily,
            reportEmpty: false,
          });
          if (second) commit(lunch, second, "companion", lunchPins);
          reportUnplacedPartners(companion, lunch, "Lunch:companion-2");
        }
      }

      reportUnplacedPartners(lead, lunch, "Lunch:indian");
      return riceLanded;
    }

    /** §3.2 Saturday: complete-meal lead + protein side + accompaniment-or-dessert. */
    function buildSaturday(): boolean {
      const lead = choose({
        pool: saturdayLeadPool(pools),
        day,
        slotLabel: "Lunch:sat-lead",
        pinned: lunchPins,
      });
      if (!lead) return false;
      commit(lunch, lead, "protein-main", lunchPins);

      const side = choose({
        pool: neutralProteinSidePool(pools.saturdayLunch).filter((d) => d.id !== lead.id),
        day,
        slotLabel: "Lunch:sat-protein-side",
        recencyExempt: true,
        pinned: lunchPins,
        reportEmpty: false,
      });
      if (side) {
        commit(lunch, side, "protein-floor", lunchPins, true);
        if (isHp(lead) && isHp(side)) {
          incidents.push({
            weekStart,
            day,
            slot: "Lunch:sat-protein-side",
            kind: "hp-source-conflict",
            reason: `plate rule 8 allows one HP source per meal, but the Saturday form places an HP protein side (${side.name}) beside an HP lead (${lead.name})`,
          });
        }
      } else {
        incidents.push({
          weekStart,
          day,
          slot: "Lunch:sat-protein-side",
          kind: "protein-floor-unfilled",
          reason: "no cuisine-neutral protein available for the Saturday form",
        });
      }

      // Third position: one Accompaniment or Dessert. Plate rule 8 excludes an HP
      // candidate when the meal already holds an HP source, with the thin-pool fallback.
      const mealHasHp = lunch.some((p) => isHp(p.dish));
      let thirdPool = saturdayThirdPool(pools).filter(
        (d) => !lunch.some((p) => p.dish.id === d.id),
      );
      if (mealHasHp) {
        const nonHp = thirdPool.filter((d) => !isHp(d));
        if (nonHp.length > 0) thirdPool = nonHp;
      }
      // Plate rule 1: one gravy per lunch.
      if (lunch.some((p) => p.dish.category === "Gravy dish")) {
        thirdPool = thirdPool.filter((d) => d.category !== "Gravy dish");
      }
      const third = choose({
        pool: thirdPool,
        day,
        slotLabel: "Lunch:sat-third",
        pinned: lunchPins,
      });
      if (third)
        commit(lunch, third, third.category === "Dessert" ? "dessert" : "companion", lunchPins);

      reportUnplacedPartners(lead, lunch, "Lunch:sat");
      return false;
    }

    /**
     * Plate rule 7. The `pairsWith` partners a placed dish names, as a preference set for
     * the positions that follow. Named partners resolve by id; the prototype's
     * `categoryPartners` extension resolves against the candidate pool by category.
     */
    function preferSetFor(dish: Dish, pool?: Dish[]): ReadonlySet<number> | undefined {
      const entry = pairsWithFor(dish.id);
      if (!entry) return undefined;
      const ids = new Set<number>(entry.partnerDishIds);
      if (entry.categoryPartners && pool) {
        for (const d of pool) {
          if (entry.categoryPartners.includes(d.category)) ids.add(d.id);
        }
      }
      return ids.size > 0 ? ids : undefined;
    }

    /** Write one incident per named `pairsWith` partner that did not make the plate. */
    function reportUnplacedPartners(dish: Dish, placed: Pick[], slotLabel: string): void {
      const entry = pairsWithFor(dish.id);
      if (!entry) return;
      for (const partnerId of entry.partnerDishIds) {
        if (placed.some((p) => p.dish.id === partnerId)) continue;
        const partner = library.find((d) => d.id === partnerId);
        incidents.push({
          weekStart,
          day,
          slot: slotLabel,
          kind: "pairs-with-unavailable",
          reason: `${dish.name} names ${partner?.name ?? `dish ${partnerId}`} via pairsWith ("${entry.specText}"), but no position of this plate placed it`,
          dishId: partnerId,
          dishName: partner?.name,
        });
      }
    }
  }

  return { week: { weekStart, season, days }, incidents };
}

/**
 * §8 history rows for a generated v4 week. The v3 derivation walks a `GeneratedWeek`,
 * whose shape v4 changes, so the walk is rewritten here; the row SHAPE and the
 * short-day-to-long-day mapping are reused from v3 (`toLongDay`).
 */
export function historyRowsV4(week: WeekPlan): MenuHistoryRow[] {
  const rows: MenuHistoryRow[] = [];
  for (const day of week.days) {
    for (const pick of day.breakfast) {
      rows.push({
        weekStart: week.weekStart,
        day: toLongDay(day.day),
        meal: "Breakfast",
        dishName: pick.dish.name,
        dishId: pick.dish.id,
      });
    }
    for (const pick of day.lunch) {
      rows.push({
        weekStart: week.weekStart,
        day: toLongDay(day.day),
        meal: "Lunch",
        dishName: pick.dish.name,
        dishId: pick.dish.id,
      });
    }
    if (day.fruit) {
      rows.push({
        weekStart: week.weekStart,
        day: toLongDay(day.day),
        meal: "Fruit",
        dishName: day.fruit.dish.name,
        dishId: day.fruit.dish.id,
      });
    }
  }
  return rows;
}

export { WEEKDAYS };
export type { FrequencyIndex, GuardIndex, Pools };
