export const VERSION = "0.0.0";

export * from "./data/schemas.js";
export {
  parseMenuHistory,
  parseDishFile,
  parseIngredientCatalog,
  dishFilesToLibrary,
  catalogToPackSizes,
} from "./data/parse.js";
export {
  serializeMenuHistory,
  serializeDishFile,
  serializeIngredientCatalog,
} from "./data/serialize.js";
export {
  validateMenuHistoryAgainstLibrary,
  validatePackSizesUsed,
  validateDishFiles,
  validateCatalogGroups,
  validateIngredientNamesResolve,
  validateDishFileRoundTrip,
  coverageReport,
  hpProteinConsistencyReport,
  HP_PROTEIN_THRESHOLD_PER_PERSON,
} from "./data/validators.js";
export type { CoverageReport, HpProteinDrift } from "./data/validators.js";
export { baseSlug, slugForDishes } from "./data/slug.js";
export { eligibleDishes } from "./eligibility.js";
export type { EligibleDishesArgs, Slot, Day, Meal } from "./eligibility.js";
export {
  isHp,
  isSelfSufficientMain,
  breakfastMainCarriesChutney,
  excludeHpIfMealHasHp,
  isCuisineNeutral,
} from "./composition.js";
export { applyCap, WEEKDAY_CAP, SATURDAY_CAP } from "./cap.js";
export type { SlotPick, ApplyCapArgs, ApplyCapResult } from "./cap.js";
export type { GeneratedWeek, GeneratedWeekDay, GeneratedWeekSlot } from "./generateWeek.js";
export { aggregateGroceryList } from "./groceryList.js";
export type { GroceryItem, GroceryList, GroceryDayPicks } from "./groceryList.js";
export {
  deriveDishMacros,
  proteinToCarbRatio,
  isHealthy,
  HOUSEHOLD_SERVINGS,
  ATWATER_PROTEIN_KCAL_PER_G,
  ATWATER_CARBS_KCAL_PER_G,
  ATWATER_FAT_KCAL_PER_G,
  HEALTHY_PROTEIN_CALORIE_FRACTION,
  HEALTHY_FIBER_PER_PERSON,
  PROTEIN_BAND_WIDTH_GRAMS,
} from "./nutrition.js";
export type { DishMacros } from "./nutrition.js";
export { rankPickerAlternatives } from "./pickerRanking.js";
export type { PickerRankingArgs } from "./pickerRanking.js";
export { toLongDay } from "./historyRows.js";

/**
 * The v6 engine (`features/engine-v6.md`), the only selection engine now that
 * the v3 modules are gone (§12, §13).
 *
 * Re-exported wholesale from `./v6/index.ts`, which is the curated surface; this
 * file adds no v6 name of its own. Three names leave v6 aliased there rather than
 * here, because the v3 engine held those names when the alias was written: `Day`
 * and `Pick` leave as `V6Day` and `V6Pick`, and `ExploreAffinityKey` leaves as
 * `ExploreAffinityKeyV6`. The aliases stay as they are: renaming a v6 export is
 * `engine/src/v6/index.ts`'s call, not this file's, and every caller already
 * reads the aliased names.
 */
export * from "./v6/index.js";
