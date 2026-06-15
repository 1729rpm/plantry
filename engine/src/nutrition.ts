import type { CatalogIngredient, Ingredient } from "./data/schemas.js";

/**
 * Nutrition derivation (docs/engine.md Nutrition section, design-revamp §1.2).
 *
 * Per-dish macros are DERIVED, never hand-stored. There is no per-dish protein
 * or carb field and deliberately no override (Principle 8): the single source of
 * truth is each ingredient row's quantity times the catalog's per-100g macros.
 * Correcting one ingredient's macros corrects every dish that uses it.
 *
 * The household basis is two people: every dish serves two, and macros display
 * per person, so the dish total is divided by two.
 *
 * Calories per person follow the Atwater convention (4 kcal/g protein and carbs,
 * 9 kcal/g fat) and a derived `healthy` boolean keys off protein's share of
 * calories and fibre per person (see engine.md §11 for the thresholds).
 *
 * Blank catalog macros read as zero (spices and aromatics may stay blank
 * forever; only macro-relevant rows carry values). A `pcs`-unit ingredient converts
 * to grams via the catalog's `Grams per piece` before the math; a `pcs`
 * ingredient with no grams-per-piece contributes zero (it cannot be weighed, so
 * it cannot contribute macro mass).
 */

/** Per-person derived macros for one dish. */
export interface DishMacros {
  /** Grams of protein per person (dish total over two). */
  proteinPerPerson: number;
  /** Grams of carbohydrate per person (dish total over two). */
  carbsPerPerson: number;
  /** Grams of fat per person (dish total over two). The Atwater calorie input. */
  fatPerPerson: number;
  /** Grams of fibre per person (dish total over two). One of the Healthy inputs. */
  fiberPerPerson: number;
  /**
   * Calories per person, via Atwater: 4 kcal per gram of protein and carbs,
   * 9 kcal per gram of fat. Zero when no macro data exists for the dish.
   */
  caloriesPerPerson: number;
  /**
   * Protein-to-carb ratio (protein / carbs). `null` when carbs are zero (the
   * ratio is undefined); callers decide how to present "no carbs".
   */
  proteinToCarbRatio: number | null;
  /**
   * Whether the dish clears the Healthy bar (engine.md §11): at least
   * `HEALTHY_PROTEIN_CALORIE_FRACTION` of its calories from protein AND at least
   * `HEALTHY_FIBER_PER_PERSON` grams of fibre per person. Computed only where
   * macro data exists: a dish with zero derived calories (no macro data) is
   * never healthy, so the flag never produces a false positive.
   */
  healthy: boolean;
}

/** The two people the household cooks for; macros display per person. */
export const HOUSEHOLD_SERVINGS = 2;

/**
 * Atwater factors: kcal per gram of each macronutrient. Protein and carbohydrate
 * yield about 4 kcal/g, fat about 9 kcal/g. These convert the derived per-person
 * macro grams into a per-person calorie figure.
 */
export const ATWATER_PROTEIN_KCAL_PER_G = 4;
export const ATWATER_CARBS_KCAL_PER_G = 4;
export const ATWATER_FAT_KCAL_PER_G = 9;

/**
 * Healthy thresholds (engine.md §11), both tunable. A dish is Healthy when at
 * least this fraction of its calories come from protein AND it carries at least
 * `HEALTHY_FIBER_PER_PERSON` grams of fibre per person.
 */
export const HEALTHY_PROTEIN_CALORIE_FRACTION = 0.25;
export const HEALTHY_FIBER_PER_PERSON = 3;

/**
 * Convert one ingredient row's quantity to grams. `g` is already grams; `pcs`
 * multiplies by the catalog's grams-per-piece (zero when absent); `ml` converts
 * to grams 1:1, assuming a culinary liquid density of about 1.0 (milk ~1.03,
 * coconut milk ~0.97, both within noise for a display macro). No per-ingredient
 * density column exists (Principle 8): no column until a dish needs one.
 */
function rowGrams(row: Ingredient, catalogEntry: CatalogIngredient | undefined): number {
  if (row.unit === "g") return row.quantity;
  if (row.unit === "pcs") {
    const gramsPerPiece = catalogEntry?.gramsPerPiece ?? 0;
    return row.quantity * gramsPerPiece;
  }
  return row.quantity;
}

/**
 * Derive per-person protein and carbs for a single dish from its ingredient rows
 * and the catalog. `ingredientRows` are the rows for ONE dish (the caller filters
 * by dish id); `catalog` is the full ingredient catalog (looked up by name).
 */
export function deriveDishMacros(
  ingredientRows: Ingredient[],
  catalog: CatalogIngredient[],
): DishMacros {
  const byName = new Map<string, CatalogIngredient>();
  for (const entry of catalog) byName.set(entry.ingredient, entry);

  let proteinTotal = 0;
  let carbsTotal = 0;
  let fatTotal = 0;
  let fiberTotal = 0;
  for (const row of ingredientRows) {
    const entry = byName.get(row.ingredient);
    const grams = rowGrams(row, entry);
    if (grams === 0) continue;
    const protein100 = entry?.proteinPer100g ?? 0;
    const carbs100 = entry?.carbsPer100g ?? 0;
    const fat100 = entry?.fatPer100g ?? 0;
    const fiber100 = entry?.fiberPer100g ?? 0;
    proteinTotal += (grams * protein100) / 100;
    carbsTotal += (grams * carbs100) / 100;
    fatTotal += (grams * fat100) / 100;
    fiberTotal += (grams * fiber100) / 100;
  }

  const proteinPerPerson = proteinTotal / HOUSEHOLD_SERVINGS;
  const carbsPerPerson = carbsTotal / HOUSEHOLD_SERVINGS;
  const fatPerPerson = fatTotal / HOUSEHOLD_SERVINGS;
  const fiberPerPerson = fiberTotal / HOUSEHOLD_SERVINGS;

  const caloriesPerPerson =
    ATWATER_PROTEIN_KCAL_PER_G * proteinPerPerson +
    ATWATER_CARBS_KCAL_PER_G * carbsPerPerson +
    ATWATER_FAT_KCAL_PER_G * fatPerPerson;

  return {
    proteinPerPerson,
    carbsPerPerson,
    fatPerPerson,
    fiberPerPerson,
    caloriesPerPerson,
    proteinToCarbRatio: proteinToCarbRatio(proteinPerPerson, carbsPerPerson),
    healthy: isHealthy(proteinPerPerson, caloriesPerPerson, fiberPerPerson),
  };
}

/**
 * The Healthy predicate (engine.md §11). True when at least
 * `HEALTHY_PROTEIN_CALORIE_FRACTION` of the dish's calories come from protein AND
 * fibre per person is at least `HEALTHY_FIBER_PER_PERSON`. A dish with zero
 * calories has no macro data, so it is never healthy (no false positives): the
 * `caloriesPerPerson === 0` guard also keeps the protein-fraction division safe.
 */
export function isHealthy(
  proteinPerPerson: number,
  caloriesPerPerson: number,
  fiberPerPerson: number,
): boolean {
  if (caloriesPerPerson === 0) return false;
  const proteinCalorieFraction =
    (ATWATER_PROTEIN_KCAL_PER_G * proteinPerPerson) / caloriesPerPerson;
  return (
    proteinCalorieFraction >= HEALTHY_PROTEIN_CALORIE_FRACTION &&
    fiberPerPerson >= HEALTHY_FIBER_PER_PERSON
  );
}

/**
 * Protein-to-carb ratio. Scale-invariant (per-person and dish-total give the
 * same ratio), so the per-person figures are passed straight through. `null`
 * when carbs are zero.
 */
export function proteinToCarbRatio(protein: number, carbs: number): number | null {
  if (carbs === 0) return null;
  return protein / carbs;
}
