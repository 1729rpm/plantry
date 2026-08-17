import type { Dish } from "../../src/data/schemas.js";
import type { Day, Meal } from "../../src/eligibility.js";
import type { Pools } from "./pool.js";
import {
  breakfastChutneyPool,
  breakfastKetoSidePool,
  breakfastMainPool,
  carbPool,
  chapatiPool,
  indianCompanionPool,
  indianLeadPool,
  isCuisineNeutral,
  isHp,
  isKeto,
  neutralProteinSidePool,
  neutralRicePool,
  saturdayLeadPool,
  saturdayThirdPool,
  standaloneLeadPool,
} from "./pool.js";

/**
 * §3.2 day templates, expressed as the set of position pools each slot can hold.
 *
 * This is the "composition accepts it" predicate the §3.4 step 1 favorites pass needs.
 * `generateWeekV4` builds the same pools inline as it walks a day, position by position,
 * because a later position's pool depends on what the earlier positions picked (the lead's
 * carbAffinity, plate rule 1, plate rule 8). The union here is deliberately the LOOSEST
 * form of each pool: a favorite is accepted if some legal composition of that slot could
 * hold it.
 */

/** Mon and Tue run the standalone plate; Wed, Thu and Fri run the Indian plate. */
export function isStandaloneDay(day: Day): boolean {
  return day === "Mon" || day === "Tue";
}

export function isIndianPlateDay(day: Day): boolean {
  return day === "Wed" || day === "Thu" || day === "Fri";
}

/** The exploration slot: the companion position of Friday's Indian plate (D1). */
export const EXPLORATION_DAY: Day = "Fri";

export function slotPositionPools(day: Day, meal: Meal, pools: Pools): Dish[][] {
  if (meal === "Breakfast") {
    if (day === "Sat") return [];
    return [breakfastMainPool(pools), breakfastChutneyPool(pools), breakfastKetoSidePool(pools)];
  }
  if (day === "Sat") {
    return [
      saturdayLeadPool(pools),
      neutralProteinSidePool(pools.saturdayLunch),
      saturdayThirdPool(pools),
    ];
  }
  if (isStandaloneDay(day)) {
    return [
      standaloneLeadPool(pools),
      neutralProteinSidePool(pools.weekdayLunch),
      // The loosest veg-side pool: any non-protein Accompaniment/Dry/Gravy. The
      // same-cuisine narrowing depends on the lead, which is not known yet.
      pools.weekdayLunch.filter(
        (d) =>
          !isHp(d) &&
          !isKeto(d) &&
          (d.category === "Accompaniment" ||
            d.category === "Dry dish" ||
            d.category === "Gravy dish"),
      ),
      neutralRicePool(pools),
    ];
  }
  // Indian plate day.
  return [
    indianLeadPool(pools),
    indianCompanionPool(pools),
    chapatiPool(pools),
    pools.weekdayLunch.filter((d) => d.category === "Rice"),
  ];
}

/** True when some legal composition of this slot could hold the dish. */
export function slotAcceptsDish(day: Day, meal: Meal, pools: Pools, dishId: number): boolean {
  return slotPositionPools(day, meal, pools).some((pool) => pool.some((d) => d.id === dishId));
}

/**
 * §3.2 standalone veg side pool for an HP or Keto anchor, narrowed by plate rule 1
 * (never a second Gravy when the lead is already a Gravy) and plate rule 5 (the lead's
 * cuisine plus cuisine_neutral).
 */
export function standaloneSidePoolFor(pools: Pools, lead: Dish): Dish[] {
  const leadIsGravy = lead.category === "Gravy dish";
  return pools.weekdayLunch.filter((d) => {
    if (d.id === lead.id) return false;
    if (isHp(d) || isKeto(d)) return false;
    if (leadIsGravy && d.category === "Gravy dish") return false;
    if (!(d.cuisine === lead.cuisine || isCuisineNeutral(d))) return false;
    return (
      d.category === "Accompaniment" || d.category === "Dry dish" || d.category === "Gravy dish"
    );
  });
}

/**
 * §3.2 Indian plate first-companion pool, narrowed by plate rule 1 (one gravy per lunch:
 * a Gravy lead admits no Gravy companion) and excluding the lead itself.
 */
export function indianCompanionPoolFor(pools: Pools, lead: Dish | undefined): Dish[] {
  const base = indianCompanionPool(pools);
  if (!lead) return base;
  const leadIsGravy = lead.category === "Gravy dish";
  return base.filter((d) => d.id !== lead.id && !(leadIsGravy && d.category === "Gravy dish"));
}

/**
 * §3.2 Indian plate second-companion pool. Only opens when the first companion was a
 * Gravy (a dal); the position is then restricted to Dry dishes, which is both the spec's
 * wording and what keeps plate rule 1 satisfied.
 */
export function indianSecondCompanionPool(pools: Pools, taken: ReadonlyArray<Dish>): Dish[] {
  const takenIds = new Set(taken.map((d) => d.id));
  return indianCompanionPool(pools).filter((d) => !takenIds.has(d.id) && d.category === "Dry dish");
}

/** §3.2 the carb pool for a lead, honouring carbAffinity. */
export function carbPoolFor(pools: Pools, lead: Dish): Dish[] {
  return carbPool(pools, lead);
}
