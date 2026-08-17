import type { Dish, DishTag, Season } from "../../src/data/schemas.js";
import { eligibleDishes } from "../../src/eligibility.js";

/**
 * §3.1 Pool.
 *
 * Base eligibility (Active=Yes and Seasons include the current Bangalore season) is
 * UNCHANGED from v3, so it is reused verbatim from `engine/src/eligibility.ts`. What v4
 * adds is a `complexity: Hard` exclusion on the weekday lunch and breakfast pools only.
 * Saturday lunch is not named in that clause, so Hard dishes stay reachable there; that
 * reading is recorded in run-notes.md.
 */

export function hasTag(dish: Dish, tag: DishTag): boolean {
  return dish.tags.includes(tag);
}

export function isHp(dish: Dish): boolean {
  return hasTag(dish, "HP");
}

export function isKeto(dish: Dish): boolean {
  return dish.category === "Keto";
}

/** A dish that carries protein for plate rule 2 / plate rule 8 purposes. */
export function isProtein(dish: Dish): boolean {
  return isHp(dish) || isKeto(dish);
}

export function isCuisineNeutral(dish: Dish): boolean {
  return hasTag(dish, "cuisine_neutral");
}

/** §3.2 self-sufficient standalone signal: the `complete_meal` tag OR Category=Complete meal. */
export function isCompleteMeal(dish: Dish): boolean {
  return hasTag(dish, "complete_meal") || dish.category === "Complete meal";
}

export interface Pools {
  season: Season;
  /** Everything Active and in-season, before the Hard exclusion. */
  eligible: Dish[];
  /** Breakfast dishes, Hard excluded (§3.1). */
  breakfast: Dish[];
  /** Lunch dishes, Hard excluded (§3.1). The weekday lunch pool. */
  weekdayLunch: Dish[];
  /** Lunch dishes WITHOUT the Hard exclusion. Saturday's pool (§3.1 names weekdays only). */
  saturdayLunch: Dish[];
  /** Category=Fruit, in season. */
  fruit: Dish[];
}

export function buildPools(library: Dish[], season: Season): Pools {
  const eligible = eligibleDishes({
    library,
    history: [],
    season,
    slot: { day: "Mon", meal: "Lunch" },
  });
  const notHard = (d: Dish): boolean => d.complexity !== "Hard";
  const lunch = eligible.filter((d) => d.time === "Lunch");
  return {
    season,
    eligible,
    breakfast: eligible.filter((d) => d.time === "Breakfast").filter(notHard),
    weekdayLunch: lunch.filter(notHard),
    saturdayLunch: lunch,
    fruit: eligible.filter((d) => d.category === "Fruit"),
  };
}

// ---------------------------------------------------------------------------
// Breakfast position pools (§3.2 "Breakfast, uniform Mon-Fri")
// ---------------------------------------------------------------------------

/** The breakfast main pool: tags complete_meal or complete_carb. */
export function breakfastMainPool(pools: Pools): Dish[] {
  return pools.breakfast.filter((d) => hasTag(d, "complete_meal") || hasTag(d, "complete_carb"));
}

/** The breakfast chutney pool: Category=Accompaniment, Time=Breakfast. */
export function breakfastChutneyPool(pools: Pools): Dish[] {
  return pools.breakfast.filter((d) => d.category === "Accompaniment");
}

/** The breakfast HP Keto attach pool (the boiled-eggs class). */
export function breakfastKetoSidePool(pools: Pools): Dish[] {
  return pools.breakfast.filter((d) => isHp(d) && isKeto(d));
}

/** §3.2 attach rule: a Chilla or Paratha main carries one breakfast chutney. */
export function carriesChutney(dish: Dish): boolean {
  return dish.category === "Chilla" || dish.category === "Paratha";
}

/** §3.2 attach rule: a Category=Bread main serves alone. */
export function servesAlone(dish: Dish): boolean {
  return dish.category === "Bread";
}

// ---------------------------------------------------------------------------
// Standalone plate position pools (§3.2 "Standalone plate (Mon, Tue)")
// ---------------------------------------------------------------------------

const STANDALONE_ANCHOR_CATEGORIES = new Set(["Gravy dish", "Dry dish", "Keto"]);

/**
 * §3.2 standalone lead pool: a dish with the complete_meal tag or Category=Complete meal,
 * OR a non-Indian anchor (Gravy, Dry, Keto).
 */
export function standaloneLeadPool(pools: Pools): Dish[] {
  return pools.weekdayLunch.filter(
    (d) =>
      isCompleteMeal(d) || (d.cuisine !== "Indian" && STANDALONE_ANCHOR_CATEGORIES.has(d.category)),
  );
}

/**
 * Plate rule 2 protein side: a cuisine-neutral protein. The pool is the lunch
 * `cuisine_neutral` dishes that carry protein, and it is deliberately NOT
 * cuisine-gated, that being the point of `cuisine_neutral`.
 */
export function neutralProteinSidePool(pool: Dish[]): Dish[] {
  return pool.filter((d) => isCuisineNeutral(d) && isProtein(d));
}

/**
 * §3.2 standalone veg side for an HP or Keto anchor: one same-cuisine-or-neutral
 * NON-HP veg side. Plate rule 8 (one HP source per meal) is what makes it non-HP.
 */
export function standaloneVegSidePool(pools: Pools, lead: Dish): Dish[] {
  return pools.weekdayLunch.filter(
    (d) =>
      d.id !== lead.id &&
      !isHp(d) &&
      !isKeto(d) &&
      (d.cuisine === lead.cuisine || isCuisineNeutral(d)) &&
      (d.category === "Accompaniment" || d.category === "Dry dish" || d.category === "Gravy dish"),
  );
}

/** The register-neutral steamed-rice carb (Category=Rice + cuisine_neutral). */
export function neutralRicePool(pools: Pools): Dish[] {
  return pools.weekdayLunch.filter((d) => d.category === "Rice" && isCuisineNeutral(d));
}

// ---------------------------------------------------------------------------
// Indian plate position pools (§3.2 "Indian plate (Wed, Thu, Fri)")
// ---------------------------------------------------------------------------

const INDIAN_LEAD_CATEGORIES = new Set(["Gravy dish", "Dry dish", "Keto"]);
const INDIAN_COMPANION_CATEGORIES = new Set(["Gravy dish", "Dry dish", "Accompaniment"]);

/** §3.2 Indian plate lead: HP or Keto, Indian cuisine. */
export function indianLeadPool(pools: Pools): Dish[] {
  return pools.weekdayLunch.filter(
    (d) => d.cuisine === "Indian" && isProtein(d) && INDIAN_LEAD_CATEGORIES.has(d.category),
  );
}

/** §3.2 Indian plate companion: the non-HP Indian pool (Gravy, Dry, Accompaniment). */
export function indianCompanionPool(pools: Pools): Dish[] {
  return pools.weekdayLunch.filter(
    (d) => d.cuisine === "Indian" && !isHp(d) && INDIAN_COMPANION_CATEGORIES.has(d.category),
  );
}

/** §3.2 carb by carbAffinity. `Rice` draws the Rice pool; `Roti` and absent draw Chapati. */
export function carbPool(pools: Pools, lead: Dish): Dish[] {
  const target = lead.carbAffinity === "Rice" ? "Rice" : "Chapati";
  return pools.weekdayLunch.filter((d) => d.category === target);
}

export function chapatiPool(pools: Pools): Dish[] {
  return pools.weekdayLunch.filter((d) => d.category === "Chapati");
}

/**
 * Plate rule 2 fallback pool for an Indian plate whose composition somehow carries no
 * protein: an HP-or-Keto Indian or cuisine-neutral lunch dish.
 */
export function indianProteinFloorPool(pools: Pools): Dish[] {
  return pools.weekdayLunch.filter(
    (d) => isProtein(d) && (d.cuisine === "Indian" || isCuisineNeutral(d)),
  );
}

// ---------------------------------------------------------------------------
// Saturday position pools (§3.2 "Saturday")
// ---------------------------------------------------------------------------

/** §3.2 Saturday lead: a complete-meal dish. Hard is NOT excluded on Saturday. */
export function saturdayLeadPool(pools: Pools): Dish[] {
  return pools.saturdayLunch.filter(isCompleteMeal);
}

/** §3.2 Saturday third position: one Accompaniment or Dessert. */
export function saturdayThirdPool(pools: Pools): Dish[] {
  return pools.saturdayLunch.filter(
    (d) => d.category === "Accompaniment" || d.category === "Dessert",
  );
}
