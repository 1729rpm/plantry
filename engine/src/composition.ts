import type { Dish, DishTag } from "./data/schemas.js";

/**
 * Composition predicates (docs/engine.md §3 forms).
 *
 * The v6 engine carries these §3 signals forward unchanged
 * (`features/engine-v6.md` §12) and reads them from `engine/src/v6/pools.ts` and
 * `engine/src/v6/compose.ts`. What used to sit alongside them here, the menu-form
 * candidate sets (Menu 1 to Menu 4, the international form, the breakfast options,
 * the weekday substitution scan and the lunch budget), belonged to the v3
 * selection engine and is gone: v6 builds its plates from role pools instead
 * (§5), so the forms have no caller.
 *
 * Every predicate is keyed on a tag or a category, never on a dish name, so it
 * holds for any dish the library later gains.
 */

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

const BREAKFAST_CHUTNEY_CARRIER_CATEGORIES = new Set(["Chilla", "Paratha"]);

/**
 * §3 dish-driven breakfast chutney signal. A breakfast main whose Category is
 * Chilla or Paratha carries a breakfast chutney (Category=Accompaniment,
 * Time=Breakfast) in ANY breakfast slot. This makes the accompaniment a property
 * of the main dish rather than of the slot form. Keyed on category, never on dish
 * names; Category=Bread is not a carrier, so a bread main (avocado toast, masala
 * toast) is still served alone.
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

/** True when the dish carries the cuisine-neutral tag (a plain protein, §3 intl form). */
export function isCuisineNeutral(dish: Dish): boolean {
  return hasTag(dish, "cuisine_neutral");
}
