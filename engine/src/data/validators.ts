import type {
  CatalogIngredient,
  Dish,
  DishFile,
  GroceryGroup,
  Ingredient,
  MenuHistoryRow,
  PackSizeHeader,
  Season,
} from "./schemas.js";
import { CatalogIngredientSchema, DishSchema } from "./schemas.js";
import { baseSlug, slugForDishes } from "./slug.js";
import { serializeDishFile } from "./serialize.js";
import { deriveDishMacros } from "../nutrition.js";
import { eligibleDishes } from "../eligibility.js";
import {
  breakfastSlot,
  menu1,
  menu2,
  menu3,
  menu4,
} from "../composition.js";

export function validateMenuHistoryAgainstLibrary(history: MenuHistoryRow[], dishes: Dish[]): void {
  const dishIds = new Set(dishes.map((d) => d.id));
  const missing = new Map<number, MenuHistoryRow[]>();
  for (const row of history) {
    if (!dishIds.has(row.dishId)) {
      const list = missing.get(row.dishId) ?? [];
      list.push(row);
      missing.set(row.dishId, list);
    }
  }
  if (missing.size === 0) return;
  const sortedIds = Array.from(missing.keys()).sort((a, b) => a - b);
  const parts = sortedIds.map((id) => {
    const rows = missing.get(id)!;
    const refs = rows
      .map((r) => `week=${r.weekStart} day=${r.day} meal=${r.meal} name="${r.dishName}"`)
      .join("; ");
    return `dish id ${id} (referenced by: ${refs})`;
  });
  throw new Error(
    `validateMenuHistoryAgainstLibrary: ${missing.size} dish id(s) in history not present in dish library: ${parts.join(" | ")}`,
  );
}

export function validatePackSizesUsed(
  packSizes: PackSizeHeader[],
  ingredients: Ingredient[],
): void {
  const usedNames = new Set(ingredients.map((i) => i.ingredient));
  const unused: string[] = [];
  for (const p of packSizes) {
    if (!usedNames.has(p.ingredient)) {
      unused.push(p.ingredient);
    }
  }
  if (unused.length === 0) return;
  throw new Error(
    `validatePackSizesUsed: ${unused.length} tracked ingredient(s) in pack-size header not referenced by any ingredient row: ${unused.map((n) => `"${n}"`).join(", ")}`,
  );
}

// ---------------------------------------------------------------------------
// Per-dish file + ingredient catalog validators.
// These are the blocking gates that protect the data layout: structural
// integrity of the dish files, and the name-resolution gate that protects
// future ordering automation.
// ---------------------------------------------------------------------------

/**
 * Structural gates over the parsed dish files:
 * (a) frontmatter validates against the dish schema (re-asserted here so the
 *     gate holds even if a caller built DishFiles without the parser);
 * (b) dish ids are unique;
 * (c) slugs are unique;
 * (d) each file's slug matches the slug derived from its name (using the
 *     library-wide collision resolution), so the filename is canonical and
 *     stable.
 */
export function validateDishFiles(files: DishFile[]): void {
  const problems: string[] = [];

  // (a) schema re-validation.
  for (const f of files) {
    const r = DishSchema.safeParse(f.dish);
    if (!r.success) {
      problems.push(
        `dish "${f.slug}": frontmatter invalid: ${r.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`,
      );
    }
  }

  // (b) id uniqueness.
  const idToSlugs = new Map<number, string[]>();
  for (const f of files) {
    const list = idToSlugs.get(f.dish.id) ?? [];
    list.push(f.slug);
    idToSlugs.set(f.dish.id, list);
  }
  for (const [id, slugs] of idToSlugs) {
    if (slugs.length > 1) {
      problems.push(`dish id ${id} used by ${slugs.length} files: ${slugs.join(", ")}`);
    }
  }

  // (c) slug uniqueness.
  const slugCounts = new Map<string, number>();
  for (const f of files) {
    slugCounts.set(f.slug, (slugCounts.get(f.slug) ?? 0) + 1);
  }
  for (const [slug, count] of slugCounts) {
    if (count > 1) problems.push(`slug "${slug}" used by ${count} files`);
  }

  // (d) slug matches the canonical derivation (filename canonicality).
  const expected = slugForDishes(files.map((f) => ({ id: f.dish.id, name: f.dish.name })));
  for (const f of files) {
    const want = expected.get(f.dish.id);
    if (want !== undefined && want !== f.slug) {
      problems.push(
        `dish id ${f.dish.id} ("${f.dish.name}") has slug "${f.slug}" but canonical slug is "${want}" (base "${baseSlug(f.dish.name)}")`,
      );
    }
  }

  if (problems.length > 0) {
    throw new Error(`validateDishFiles: ${problems.join(" | ")}`);
  }
}

/**
 * Every catalog row has a valid Group (and unit), and ingredient names are
 * unique across the catalog. The Group enum is already enforced by the schema
 * on parse; this re-asserts it and adds the uniqueness gate so a duplicated or
 * group-less row fails the build.
 */
export function validateCatalogGroups(catalog: CatalogIngredient[]): void {
  const problems: string[] = [];
  const seen = new Map<string, number>();
  for (const row of catalog) {
    const r = CatalogIngredientSchema.safeParse(row);
    if (!r.success) {
      problems.push(
        `catalog row "${row.ingredient}": ${r.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`,
      );
    }
    seen.set(row.ingredient, (seen.get(row.ingredient) ?? 0) + 1);
  }
  for (const [name, count] of seen) {
    if (count > 1) problems.push(`catalog ingredient "${name}" appears ${count} times`);
  }
  if (problems.length > 0) {
    throw new Error(`validateCatalogGroups: ${problems.join(" | ")}`);
  }
}

/**
 * The referential-integrity gate: every
 * ingredient row inside every dish file must resolve to a catalog row by exact
 * name match. This is what protects future ordering automation: a row that
 * names an ingredient absent from the catalog would have no
 * group, no pack size, and no machine-readable identity. (Note: the dish
 * frontmatter `primaryIngredient` is a free categorization label, NOT an
 * ingredient row, and intentionally is NOT required to resolve here. See the PR
 * diagnosis card.)
 */
export function validateIngredientNamesResolve(
  files: DishFile[],
  catalog: CatalogIngredient[],
): void {
  const catalogNames = new Set(catalog.map((c) => c.ingredient));
  const unresolved = new Map<string, string[]>();
  for (const f of files) {
    for (const row of f.ingredients) {
      if (!catalogNames.has(row.ingredient)) {
        const list = unresolved.get(row.ingredient) ?? [];
        list.push(f.slug);
        unresolved.set(row.ingredient, list);
      }
    }
  }
  if (unresolved.size === 0) return;
  const parts = Array.from(unresolved.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, slugs]) => `"${name}" (in ${slugs.join(", ")})`);
  throw new Error(
    `validateIngredientNamesResolve: ${unresolved.size} ingredient name(s) in dish files do not resolve to a catalog row: ${parts.join("; ")}`,
  );
}

/**
 * Categories a `pairsWith` PARTNER may carry: the union of the categories every
 * companion position pool in `engine/src/composition.ts` can hold. The Indian
 * plate's companion pool takes Gravy dish, Dry dish and Accompaniment; the
 * standalone plate's protein side takes HP-or-Keto (so Keto too); Saturday's
 * third item takes Accompaniment or Dessert.
 *
 * Everything else is a category NO companion position can hold, so a partner
 * carrying one can never be placed: Chapati and Rice are the carb position (which
 * `carbAffinity` picks, not rule 7), Bread has no lunch position pool at all,
 * Complete meal and the breakfast categories lead their own slot rather than
 * companion one, and Fruit is an inactive category with no position at all.
 *
 * Held here rather than imported from `composition.ts` deliberately: this is the
 * validator's own statement of what the composition rules can place, so a
 * composition change that narrows a pool cannot silently make a shipped pair
 * legal-looking. The §13 parity rule keeps the two honest.
 */
const PAIRS_WITH_PARTNER_CATEGORIES: ReadonlySet<string> = new Set([
  "Gravy dish",
  "Dry dish",
  "Accompaniment",
  "Keto",
  "Dessert",
]);

/**
 * True when a dish can occupy a LEAD position, the only position from which
 * rule 7 ever fires. The lead pools are: an Indian plate's HP-or-Keto protein
 * lead, a standalone plate's complete-meal or non-Indian anchor lead, and
 * Saturday's complete-meal lead. A dish outside all three (a plain dal, a plain
 * sabzi, a carb) is only ever a companion itself, so a `pairsWith` list on it is
 * data that can never fire.
 */
function canLeadALunch(dish: Dish): boolean {
  if (dish.time !== "Lunch") return false;
  if (dish.tags.includes("HP")) return true;
  if (dish.category === "Keto") return true;
  if (dish.category === "Complete meal" || dish.tags.includes("complete_meal")) return true;
  // Non-Indian anchor of the standalone plate. The anchor categories are
  // Gravy/Dry/Keto/Complete meal; Keto and Complete meal already returned true
  // above (they lead regardless of cuisine), so only these two remain.
  return dish.cuisine !== "Indian" && (dish.category === "Gravy dish" || dish.category === "Dry dish");
}

/** The seasons a dish is eligible in, expanded from the `All` shorthand. */
function seasonSet(dish: Dish): ReadonlySet<Season> {
  if (dish.seasons === "All") return new Set(ALL_SEASONS);
  return new Set(dish.seasons);
}

/**
 * The blocking gate on `pairsWith` (`features/engine-v4.md` §10.3 rule 7), the
 * same class as `validateIngredientNamesResolve`.
 *
 * Name resolution alone is NOT enough, and its absence is the defect this exists
 * to prevent: five of the six original seed pairs were written from the eaten
 * record without checking them against the composition rules, every one of them
 * resolved to a real dish, and every one was unplaceable. The one that logged an
 * error every week it fired (`soya chunks masala + vegetable korma`) named two
 * Gravy dishes, which plate rule 1 forbids outright. So this validator rejects a
 * pair the composition rules can never place, not merely a name that fails to
 * resolve:
 *
 * (a) the name resolves to exactly one library dish (unresolved or ambiguous
 *     both fail);
 * (b) the list holds no duplicate and no self-reference;
 * (c) the lead can actually occupy a lead position, since rule 7 fires nowhere
 *     else (`canLeadALunch`);
 * (d) the partner is Active and is a Lunch dish (companion pools are lunch pools);
 * (e) the partner's category is one a companion position pool can hold
 *     (`PAIRS_WITH_PARTNER_CATEGORIES`);
 * (f) plate rule 1, one gravy per lunch, hard and with no fallback: a Gravy lead
 *     may not name a Gravy partner;
 * (g) the two share at least one season, or they can never be eligible together.
 *
 * What it deliberately does NOT check: the within-week and 7-day recency rules,
 * which are per-week state rather than properties of the pair, and the item and
 * time budgets, which depend on the rest of the day. Rule 7's own precedence
 * (never over the one-gravy rule, never over the exploration slot, never over
 * within-week no-repeat) governs those at composition time.
 */
export function validatePairsWithResolve(files: DishFile[]): void {
  const byName = new Map<string, Dish[]>();
  for (const f of files) {
    const list = byName.get(f.dish.name) ?? [];
    list.push(f.dish);
    byName.set(f.dish.name, list);
  }

  const problems: string[] = [];
  for (const f of files) {
    const lead = f.dish;
    const names = lead.pairsWith;
    if (names === undefined) continue;

    const ref = `dish ${lead.id} ("${lead.name}")`;
    if (!canLeadALunch(lead)) {
      problems.push(
        `${ref}: has pairsWith but can never occupy a lead position (time=${lead.time}, category=${lead.category}, tags=[${lead.tags.join(", ")}], cuisine=${lead.cuisine}), so rule 7 could never fire`,
      );
    }

    const seen = new Set<string>();
    for (const name of names) {
      if (seen.has(name)) {
        problems.push(`${ref}: pairsWith names "${name}" more than once`);
        continue;
      }
      seen.add(name);

      if (name === lead.name) {
        problems.push(`${ref}: pairsWith names itself`);
        continue;
      }

      const matches = byName.get(name);
      if (matches === undefined) {
        problems.push(`${ref}: pairsWith name "${name}" does not resolve to a library dish`);
        continue;
      }
      if (matches.length > 1) {
        problems.push(
          `${ref}: pairsWith name "${name}" is ambiguous, it resolves to ${matches.length} dishes (ids ${matches.map((d) => d.id).join(", ")})`,
        );
        continue;
      }
      const partner = matches[0];

      if (partner.active !== "Yes") {
        problems.push(`${ref}: pairsWith partner "${name}" is inactive, so it can never be placed`);
      }
      if (partner.time !== "Lunch") {
        problems.push(
          `${ref}: pairsWith partner "${name}" is a ${partner.time} dish; companion position pools are lunch pools`,
        );
      }
      if (!PAIRS_WITH_PARTNER_CATEGORIES.has(partner.category)) {
        problems.push(
          `${ref}: pairsWith partner "${name}" is Category=${partner.category}, which no companion position pool can hold (holdable: ${Array.from(PAIRS_WITH_PARTNER_CATEGORIES).sort().join(", ")})`,
        );
      }
      if (lead.category === "Gravy dish" && partner.category === "Gravy dish") {
        problems.push(
          `${ref}: pairsWith partner "${name}" is a second Gravy dish, which plate rule 1 (one gravy per lunch, hard, no fallback) forbids`,
        );
      }
      const leadSeasons = seasonSet(lead);
      const partnerSeasons = seasonSet(partner);
      const overlap = Array.from(leadSeasons).some((s) => partnerSeasons.has(s));
      if (!overlap) {
        problems.push(
          `${ref}: pairsWith partner "${name}" shares no season with the lead (lead ${JSON.stringify(lead.seasons)}, partner ${JSON.stringify(partner.seasons)}), so the two are never eligible together`,
        );
      }
    }
  }

  if (problems.length > 0) {
    throw new Error(`validatePairsWithResolve: ${problems.join(" | ")}`);
  }
}

/**
 * Per-file round-trip gate: re-serializing a parsed dish file reproduces the
 * on-disk bytes exactly. Run by the round-trip test against every file on disk.
 */
export function validateDishFileRoundTrip(file: DishFile, original: string): void {
  const out = serializeDishFile(file);
  if (out !== original) {
    throw new Error(
      `validateDishFileRoundTrip: dish "${file.slug}" does not round-trip byte-identical`,
    );
  }
}

// ===========================================================================
// Reporting layer (docs/engine.md §11.1 coverage and reports).
//
// These are REPORTING severity, NOT blocking. They never throw on a coverage
// gap or a thin pool; they return structured data that engine/scripts/reports.ts
// prints in CI output and the slow loop later consumes. The blocking validators
// above keep facts TRUE; these reports keep the library GOOD, which is judgment
// CI cannot make. Blank macros are EXPECTED on the rows that legitimately have
// none: the coverage report reading near-zero on those is correct, not a failure.
// ===========================================================================

const ALL_SEASONS: readonly Season[] = ["Summer", "Monsoon", "Winter"];

/**
 * Catalog rows that SHOULD carry macros, so the coverage denominator is not
 * diluted by spices and aromatics that legitimately stay blank forever
 * (spices and aromatics can stay blank forever, protein sources and staples
 * cannot). Heuristic, reporting-only: rows in the food
 * groups (Proteins and Dairy, Pantry, Vegetables) are macro-relevant; Aromatics
 * and Herbs are not, and Fruit is excluded from the coverage denominator too:
 * its rows mostly carry macros, but the "Fruit" placeholder row (the Seasonal
 * fruit dish) legitimately has none, so forcing the group into the ratchet would
 * be wrong. Tuning this set never blocks a build.
 */
const MACRO_RELEVANT_GROUPS: ReadonlySet<GroceryGroup> = new Set<GroceryGroup>([
  "Proteins and Dairy",
  "Pantry",
  "Vegetables",
]);

function isMacroRelevant(row: CatalogIngredient): boolean {
  return MACRO_RELEVANT_GROUPS.has(row.group);
}

function hasMacros(row: CatalogIngredient): boolean {
  return row.proteinPer100g !== undefined || row.carbsPer100g !== undefined;
}

function hasFat(row: CatalogIngredient): boolean {
  return row.fatPer100g !== undefined;
}

function hasFiber(row: CatalogIngredient): boolean {
  return row.fiberPer100g !== undefined;
}

export interface CoverageReport {
  activeDishCount: number;
  /** Count of active dishes carrying each enrichment field. */
  withDescription: number;
  withRecipe: number;
  withComplexity: number;
  withPhoto: number;
  /**
   * Macro-relevant catalog rows, and how many carry each macro family. Tracked
   * per family so the calorie (fat) and Healthy (fibre) inputs ratchet down
   * independently of the original protein/carbs coverage.
   */
  macroRelevantCount: number;
  /** Rows carrying any protein or carbs value (the original §11 macro inputs). */
  macroRelevantWithMacros: number;
  /** Rows carrying a Fat /100g value (the Atwater calorie input). */
  macroRelevantWithFat: number;
  /** Rows carrying a Fiber /100g value (a Healthy threshold input). */
  macroRelevantWithFiber: number;
}

/**
 * Enrichment + macro coverage over the active library and the catalog (the
 * §11.1 coverage ratchet). Active dishes only (inactive dishes are not shown in
 * the UI, so their enrichment does not matter yet).
 */
export function coverageReport(dishes: Dish[], catalog: CatalogIngredient[]): CoverageReport {
  const active = dishes.filter((d) => d.active === "Yes");
  const macroRelevant = catalog.filter(isMacroRelevant);
  return {
    activeDishCount: active.length,
    withDescription: active.filter((d) => d.description !== undefined).length,
    withRecipe: active.filter((d) => d.recipe !== undefined).length,
    withComplexity: active.filter((d) => d.complexity !== undefined).length,
    withPhoto: active.filter((d) => d.photo !== undefined).length,
    macroRelevantCount: macroRelevant.length,
    macroRelevantWithMacros: macroRelevant.filter(hasMacros).length,
    macroRelevantWithFat: macroRelevant.filter(hasFat).length,
    macroRelevantWithFiber: macroRelevant.filter(hasFiber).length,
  };
}

/** One composition slot's candidate count, for one season. */
export interface PoolCount {
  season: Season;
  /** Composition slot label, mirroring docs/engine.md §3. */
  slot: string;
  count: number;
}

/**
 * For each composition slot in docs/engine.md §3, per season, the count of
 * eligible candidates. Surfaces thin pools (the source of repetition) and flags
 * when a season change strands a slot. The slot pools come from the live
 * composition functions, so the report cannot drift from the engine.
 *
 * Lunch carbs are reported as the §3.1 default pool (no Rice-already-used
 * constraint applied: this is a static pool snapshot, not a within-week pick).
 */
export function poolCoverageReport(library: Dish[]): PoolCount[] {
  const out: PoolCount[] = [];
  for (const season of ALL_SEASONS) {
    // §3 composition reads from the eligible (active, in-season) set for the
    // meal; breakfast and lunch share the same eligible set here since
    // eligibility is season + active only (docs/engine.md §1).
    const eligible = eligibleDishes({
      library,
      history: [],
      season,
      slot: { day: "Mon", meal: "Lunch" },
    });

    const breakfast = breakfastSlot(eligible);
    const m1 = menu1(eligible);
    const m2 = menu2(eligible);
    const m3 = menu3(eligible);
    const m4 = menu4(eligible);

    const rows: Array<[string, number]> = [
      ["Breakfast: main", breakfast.main.length],
      ["Breakfast: plain carb", breakfast.plainCarb.length],
      ["Breakfast: chutney", breakfast.chutney.length],
      ["Breakfast: protein floor (HP Keto)", breakfast.ketoCompanion.length],
      ["Menu 1: protein lead (HP)", m1.hp.length],
      ["Menu 2: protein lead (Keto)", m2.keto.length],
      ["Weekday companions (non-HP Gravy/Dry/Accompaniment)", m1.companions.length],
      ["Lunch protein floor (HP or Keto, Indian)", m1.proteinFloor.length],
      ["Menu 3: complete_meal + HP", m3.completeMealHp.length],
      ["Menu 3: Accompaniment", m3.accompaniment.length],
      ["Menu 3: Dessert", m3.dessert.length],
      ["Menu 4: complete_meal non-HP", m4.completeMealNonHp.length],
      ["Menu 4: Keto", m4.keto.length],
      ["Menu 4: Accompaniment", m4.accompaniment.length],
      ["Lunch carb: Rice (§3.4)", m1.riceCarb.length],
      ["Lunch carb: Chapati (§3.4)", m1.chapatiCarb.length],
    ];
    for (const [slot, count] of rows) {
      out.push({ season, slot, count });
    }
  }
  return out;
}

/** One dish whose computed protein disagrees with its HP tag. */
export interface HpProteinDrift {
  dishId: number;
  dishName: string;
  hasHpTag: boolean;
  proteinPerPerson: number;
  /** The high-protein threshold (g per person) the report compared against. */
  threshold: number;
}

/**
 * The HP threshold (grams of protein per person) the consistency report uses to
 * call a dish "high-protein". Reporting-only: the HP TAG stays the rule input
 * (docs/engine.md §3), this number only surfaces drift between the tag and the
 * derived macro. Whether HP ever becomes derived from a threshold is a future
 * slow-loop question, not a current rule.
 */
export const HP_PROTEIN_THRESHOLD_PER_PERSON = 20;

/**
 * Warn when a dish's COMPUTED protein and its HP tag disagree: HP-tagged but
 * below the threshold, or above the threshold without the tag. Dishes whose
 * macros are not yet populated (derived protein zero because every ingredient's
 * catalog macros are blank) are SKIPPED, so the report speaks only for dishes
 * whose ingredient macros are populated.
 */
export function hpProteinConsistencyReport(
  dishes: Dish[],
  ingredients: Ingredient[],
  catalog: CatalogIngredient[],
): HpProteinDrift[] {
  const rowsByDishId = new Map<number, Ingredient[]>();
  for (const row of ingredients) {
    const list = rowsByDishId.get(row.dishId);
    if (list) list.push(row);
    else rowsByDishId.set(row.dishId, [row]);
  }

  const drift: HpProteinDrift[] = [];
  for (const dish of dishes) {
    if (dish.active !== "Yes") continue;
    const rows = rowsByDishId.get(dish.id) ?? [];
    const { proteinPerPerson } = deriveDishMacros(rows, catalog);
    // No macro data yet -> nothing to compare. This keeps the report empty
    // until macros are populated (2.2), which is the intended pre-2.2 state.
    if (proteinPerPerson === 0) continue;
    const hasHpTag = dish.tags.includes("HP");
    const isHighProtein = proteinPerPerson >= HP_PROTEIN_THRESHOLD_PER_PERSON;
    if (hasHpTag !== isHighProtein) {
      drift.push({
        dishId: dish.id,
        dishName: dish.name,
        hasHpTag,
        proteinPerPerson,
        threshold: HP_PROTEIN_THRESHOLD_PER_PERSON,
      });
    }
  }
  return drift;
}

/** One active dish that uses at least one special-sourcing ingredient. */
export interface SpecialSourcingDish {
  dishId: number;
  dishName: string;
  /** The special-sourcing ingredient names the dish uses, sorted. */
  ingredients: string[];
}

/**
 * Special-sourcing report (special-sourcing slice, Rajat request 2026-06-12).
 * Reporting severity, never blocking: for each active dish, the special-sourcing
 * ingredients it uses, resolved against the catalog's `Special` flag. Answers
 * "which dishes need a special shopping trip, and for what" so the week's
 * supermarket/specialty run is visible up front and the future Swiggy ordering
 * automation (product.md §8) has a machine-readable sourcing signal. A dish with
 * no special ingredients is omitted. An ingredient row that does not resolve to
 * a catalog row contributes nothing here (the blocking name-resolution validator
 * already guards resolution).
 */
export function specialSourcingReport(
  dishes: Dish[],
  ingredients: Ingredient[],
  catalog: CatalogIngredient[],
): SpecialSourcingDish[] {
  const specialNames = new Set(catalog.filter((c) => c.special).map((c) => c.ingredient));
  const rowsByDishId = new Map<number, Ingredient[]>();
  for (const row of ingredients) {
    const list = rowsByDishId.get(row.dishId);
    if (list) list.push(row);
    else rowsByDishId.set(row.dishId, [row]);
  }

  const out: SpecialSourcingDish[] = [];
  for (const dish of dishes) {
    if (dish.active !== "Yes") continue;
    const rows = rowsByDishId.get(dish.id) ?? [];
    const special = new Set<string>();
    for (const row of rows) {
      if (specialNames.has(row.ingredient)) special.add(row.ingredient);
    }
    if (special.size === 0) continue;
    out.push({
      dishId: dish.id,
      dishName: dish.name,
      ingredients: Array.from(special).sort((a, b) => a.localeCompare(b)),
    });
  }
  out.sort((a, b) => a.dishId - b.dishId);
  return out;
}
