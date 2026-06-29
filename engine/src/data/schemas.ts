import { z } from "zod";

export const DishCategorySchema = z.enum([
  "Gravy dish",
  "Dry dish",
  "Complete meal",
  "Rice",
  "Chilla",
  "Paratha",
  "Chapati",
  "Bread",
  "Keto",
  "Accompaniment",
  "Dessert",
  "Fruit",
]);
export type DishCategory = z.infer<typeof DishCategorySchema>;

export const MealTimeSchema = z.enum(["Breakfast", "Lunch"]);
export type MealTime = z.infer<typeof MealTimeSchema>;

/**
 * The meal a history row can carry. Distinct from `MealTimeSchema` (which is also
 * `Dish.time` and must never be "Fruit"): the §3.3 Fruit of the day is logged
 * into the recency record as its own `meal:"Fruit"` row so cross-week fruit
 * rotation (`orderFruitByLongestUnused`) sees fruit recency. A dish's `time` is
 * still only Breakfast|Lunch; this widening is the history row's meal only.
 */
export const HistoryMealSchema = z.enum(["Breakfast", "Lunch", "Fruit"]);
export type HistoryMeal = z.infer<typeof HistoryMealSchema>;

export const SatietySchema = z.enum(["Low", "Medium", "High"]);
export type Satiety = z.infer<typeof SatietySchema>;

export const SeasonSchema = z.enum(["Summer", "Monsoon", "Winter"]);
export type Season = z.infer<typeof SeasonSchema>;

export const YesNoSchema = z.enum(["Yes", "No"]);
export type YesNo = z.infer<typeof YesNoSchema>;

export const SeasonsFieldSchema = z.union([z.literal("All"), z.array(SeasonSchema).min(1)]);
export type SeasonsField = z.infer<typeof SeasonsFieldSchema>;

/**
 * Cooking complexity, an enum the UI maps to plain-language labels ("Easy to
 * cook", "Cook will need some help", "Takes time and effort"). The data stores
 * only the enum (Principle 7: display decoupled from structure); the labels
 * live in the PWA, never here.
 */
export const ComplexitySchema = z.enum(["Easy", "Medium", "Hard"]);
export type Complexity = z.infer<typeof ComplexitySchema>;

/**
 * Dish tags, the closed set documented in docs/engine.md §12. These are rule
 * inputs (`HP`, `complete_meal`, `complete_carb` drive §3 composition; `fruit`
 * drives §3.3), so a mistyped tag would silently change the menu. The enum makes
 * §12 the enforced source of truth: an unknown tag fails the build, not the menu.
 */
export const DishTagSchema = z.enum(["HP", "complete_meal", "complete_carb", "fruit"]);
export type DishTag = z.infer<typeof DishTagSchema>;

/** Cuisine, the closed set documented in docs/engine.md §12. */
export const CuisineSchema = z.enum([
  "Indian",
  "Italian",
  "Chinese",
  "Mexican",
  "Greek",
  "Spanish",
  "Korean",
  "Japanese",
  "Continental",
  "Vietnamese",
  "Lebanese",
  "Mediterranean",
  "Thai",
]);
export type Cuisine = z.infer<typeof CuisineSchema>;

export const DishSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  category: DishCategorySchema,
  time: MealTimeSchema,
  tags: z.array(DishTagSchema),
  primaryIngredient: z.string().min(1),
  preferred: YesNoSchema,
  active: YesNoSchema,
  satiety: SatietySchema,
  prepMinutes: z.number().int().nonnegative(),
  seasons: SeasonsFieldSchema,
  /**
   * Cuisine, a single display/filter value (e.g. "Indian", "Italian", "Thai").
   * Read by §4 step 5 (within-week cuisine diversity), which tests
   * `cuisine !== "Indian"`; §1 eligibility and §3 composition still never read
   * it. It is also the one source of truth for the Explore cuisine filter, the
   * Explore card's cuisine display, and the cuisine slot of the dish-photo
   * prompt. Stored as the human-readable name (the cuisine is itself the label
   * the user sees; there is no separate internal code to decode, so Principle
   * 7's display/structure split does not apply).
   */
  cuisine: CuisineSchema,
  // Enrichment fields (docs/engine.md §12). All optional: a dish file may omit
  // them and parses unchanged; the UI degrades gracefully when they are absent
  // (§11.1 coverage ratchet).
  /** Cooking complexity enum; the UI renders the plain-language label. */
  complexity: ComplexitySchema.optional(),
  /** Free-text skill note (e.g. "Comfortable, browning matters"). */
  skill: z.string().min(1).optional(),
  /** Free-text special equipment note (e.g. "Heavy kadhai"). */
  equipment: z.string().min(1).optional(),
  /** Free-text note for an ingredient that must be bought specially. */
  buySpecially: z.string().min(1).optional(),
  /** Free-text day-before prep; present only when day-before work exists. */
  prePrep: z.string().min(1).optional(),
  /** Photo filename under data/dish-photos/; CI validates its existence. */
  photo: z.string().min(1).optional(),
  // Body-prose conventions (parsed from the markdown body, not frontmatter).
  /** One-line description: the first body paragraph before `## Ingredients`. */
  description: z.string().min(1).optional(),
  /** Numbered steps from a `## Recipe` section, one string per step. */
  recipe: z.array(z.string().min(1)).min(1).optional(),
});
export type Dish = z.infer<typeof DishSchema>;

export const IngredientUnitSchema = z.enum(["g", "ml", "pcs"]);
export type IngredientUnit = z.infer<typeof IngredientUnitSchema>;

export const IngredientSchema = z.object({
  dishId: z.number().int().positive(),
  dishName: z.string().min(1),
  ingredient: z.string().min(1),
  quantity: z.number().nonnegative(),
  unit: IngredientUnitSchema,
});
export type Ingredient = z.infer<typeof IngredientSchema>;

export const PackSizeHeaderSchema = z.object({
  ingredient: z.string().min(1),
  packSize: z.string().min(1),
});
export type PackSizeHeader = z.infer<typeof PackSizeHeaderSchema>;

/**
 * Grocery groups, in the fixed §3 buy-list order. Single-homed here and in the
 * ingredient catalog's Group column; the runtime aggregator
 * (engine/src/groceryList.ts) reads the catalog rather than a code map.
 */
export const GroceryGroupSchema = z.enum([
  "Proteins and Dairy",
  "Fruit",
  "Vegetables",
  "Aromatics and Herbs",
  "Pantry",
]);
export type GroceryGroup = z.infer<typeof GroceryGroupSchema>;

/**
 * One row of the ingredient catalog (data/ingredients.md). One row per
 * canonical ingredient. `packSize` present marks a tracked ingredient (the
 * pack-rounded buy unit used by §10 consolidation); absent marks an untracked
 * staple bought by weight. `group` is the user-facing grocery-list bucket.
 */
export const CatalogIngredientSchema = z.object({
  ingredient: z.string().min(1),
  group: GroceryGroupSchema,
  unit: IngredientUnitSchema,
  packSize: z.string().min(1).optional(),
  // Macro columns (docs/engine.md §11). A blank cell reads as absent here and as
  // zero in nutrition derivation (engine/src/nutrition.ts).
  /**
   * Grams per piece, for `pcs`-unit ingredients only (an egg is about 50 g), so
   * macro math can convert pieces to grams. Blank/absent for non-pcs rows.
   */
  gramsPerPiece: z.number().positive().optional(),
  /** Protein grams per 100 g of the ingredient. Blank reads as zero. */
  proteinPer100g: z.number().nonnegative().optional(),
  /** Carbohydrate grams per 100 g of the ingredient. Blank reads as zero. */
  carbsPer100g: z.number().nonnegative().optional(),
  /** Fat grams per 100 g of the ingredient. The §11 calorie (Atwater) input; blank reads as zero. */
  fatPer100g: z.number().nonnegative().optional(),
  /** Fibre grams per 100 g of the ingredient. The §11 fibre input; blank reads as zero. */
  fiberPer100g: z.number().nonnegative().optional(),
  // Sourcing metadata (special-sourcing slice, Rajat request 2026-06-12). The
  // machine-readable surface ordering automation needs (product.md §8): which
  // ingredients are NOT stocked by a regular Bangalore sabziwala/kirana and so
  // need a supermarket or specialty-store run. `true` marks special sourcing; a
  // blank `Special` cell parses to `false` (the common case, regular sourcing).
  /** True when the ingredient needs special sourcing (blank cell reads false). */
  special: z.boolean(),
});
export type CatalogIngredient = z.infer<typeof CatalogIngredientSchema>;

/** A single ingredient row inside a per-dish file (dish identity implied). */
export const DishIngredientRowSchema = z.object({
  ingredient: z.string().min(1),
  quantity: z.number().nonnegative(),
  unit: IngredientUnitSchema,
});
export type DishIngredientRow = z.infer<typeof DishIngredientRowSchema>;

/**
 * A parsed per-dish file: the frontmatter dish plus its ingredient rows and the
 * slug derived from (and matching) the filename.
 */
export const DishFileSchema = z.object({
  slug: z.string().min(1),
  dish: DishSchema,
  ingredients: z.array(DishIngredientRowSchema),
});
export type DishFile = z.infer<typeof DishFileSchema>;

export const DayNameSchema = z.enum([
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
]);
export type DayName = z.infer<typeof DayNameSchema>;

export const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const MenuHistoryRowSchema = z.object({
  weekStart: IsoDateSchema,
  day: DayNameSchema,
  meal: HistoryMealSchema,
  dishName: z.string().min(1),
  dishId: z.number().int().positive(),
});
export type MenuHistoryRow = z.infer<typeof MenuHistoryRowSchema>;
