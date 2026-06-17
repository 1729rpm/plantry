// Frontend view over the baked dish library. The library reaches the PWA via
// the build-time bake (docs/engineering.md §2: the library is static, not in
// Convex), imported here from @plantry/engine/library. This module is the one
// place that turns library structure into display: dish lookup by id, photo URL
// resolution from the bundle, the plain-language complexity label, and the
// dish-row meta line. Keeping that mapping here honours Principle 7 (display
// decoupled from structure): internal enum values never reach a screen.

import { dishes, ingredients } from "@plantry/engine/library";
import type { Dish, Ingredient } from "@plantry/engine";
import { dishMatchesPickerFilters, type PickerPill } from "./dishFilters.js";

const DISH_BY_ID = new Map<number, Dish>(dishes.map((d) => [d.id, d]));

export function dishById(dishId: number): Dish | undefined {
  return DISH_BY_ID.get(dishId);
}

/** The complete library, meal-time partitioned, for the swap / add pickers. */
export const allDishes: Dish[] = dishes;

const INGREDIENTS_BY_DISH = new Map<number, Ingredient[]>();
for (const row of ingredients) {
  const list = INGREDIENTS_BY_DISH.get(row.dishId) ?? [];
  list.push(row);
  INGREDIENTS_BY_DISH.set(row.dishId, list);
}

/** The dish's ingredient rows (name + quantity + unit), or [] when none exist. */
export function dishIngredients(dishId: number): Ingredient[] {
  return INGREDIENTS_BY_DISH.get(dishId) ?? [];
}

export function mealLabelForDish(dish: Dish): string {
  return dish.time === "Breakfast" ? "Breakfast" : "Lunch";
}

type Season = "Summer" | "Monsoon" | "Winter";

// Bangalore seasons per docs/product.md §1, read from the ISO month. Mirrors the
// Convex-side seasonOf so the add-a-dish pool the user sees matches the pool the
// addDish mutation will accept (it hard-filters on Active + season + meal-time).
function seasonOf(isoDate: string): Season {
  const month = Number.parseInt(isoDate.slice(5, 7), 10);
  if (month >= 3 && month <= 5) return "Summer";
  if (month >= 6 && month <= 9) return "Monsoon";
  return "Winter";
}

/**
 * The Active, in-season library dishes that can be added to a given day, name-
 * sorted. Drives the add-a-dish picker. The pool is generic across meal-time
 * (feature picker-generic-search): a breakfast dish and a lunch dish both surface
 * so the picker is one search over the whole library, and the chosen dish routes
 * to the slot its own `d.time` names. `addableMeals` is the structural floor: a
 * dish is only addable when its meal-time has a slot on the day, so a breakfast
 * dish is excluded on a lunch-only day (e.g. Saturday) where it would have no
 * slot to route to. `Category: Fruit` is excluded: fruit belongs to its own slot
 * and must not surface in a meal add. The same hard filters the `addDish`
 * mutation applies (Active, season, addable meal-time), so every dish shown can
 * actually be added.
 */
export function addablePool(weekStart: string, addableMeals: ("breakfast" | "lunch")[]): Dish[] {
  const season = seasonOf(weekStart);
  const addableTimes = addableMeals.map((m) => (m === "breakfast" ? "Breakfast" : "Lunch"));
  return dishes
    .filter((d) => {
      if (d.active !== "Yes") return false;
      if (d.category === "Fruit") return false;
      if (!addableTimes.includes(d.time)) return false;
      return d.seasons === "All" || d.seasons.includes(season);
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Photo resolution. Photos live at data/dish-photos/<slug>.jpg and are copied
// into the PWA bundle at build time (design-revamp §1.4, §1.6). Vite's
// import.meta.glob with eager + url bundles every matching file and gives us a
// slug -> URL map at build time. While photo coverage is incomplete (slice 2.2
// / B-track), most lookups miss and the Thumb primitive shows its no-photo
// fallback. The glob path is relative to this file: app/web/src/lib ->
// ../../../../data/dish-photos.
const PHOTO_URLS = import.meta.glob<string>("../../../../data/dish-photos/*.{jpg,jpeg,png,webp}", {
  eager: true,
  query: "?url",
  import: "default",
});

// Map bare slug ("chicken-masala-gravy") to its bundled URL. The dish frontmatter
// stores the filename (e.g. "chicken-masala-gravy.jpg"); we key on the slug so a
// dish declaring any supported extension resolves.
const PHOTO_BY_SLUG = new Map<string, string>();
for (const [path, url] of Object.entries(PHOTO_URLS)) {
  const file = path.slice(path.lastIndexOf("/") + 1);
  const slug = file.slice(0, file.lastIndexOf("."));
  PHOTO_BY_SLUG.set(slug, url);
}

/**
 * Resolve a dish's bundled photo URL, or null when it has no photo (or the
 * declared file is not in the bundle yet). Null drives the Thumb fallback.
 */
export function dishPhotoUrl(dish: Dish | undefined): string | null {
  if (!dish?.photo) return null;
  const slug = dish.photo.slice(0, dish.photo.lastIndexOf(".")) || dish.photo;
  return PHOTO_BY_SLUG.get(slug) ?? null;
}

const COMPLEXITY_LABEL: Record<NonNullable<Dish["complexity"]>, string> = {
  Easy: "Easy to cook",
  Medium: "Cook will need some help",
  Hard: "Takes time and effort",
};

export function complexityLabel(complexity: Dish["complexity"]): string | null {
  return complexity ? COMPLEXITY_LABEL[complexity] : null;
}

export type ComplexityVariant = "easy" | "medium" | "hard";

export function complexityVariant(complexity: Dish["complexity"]): ComplexityVariant {
  if (complexity === "Medium") return "medium";
  if (complexity === "Hard") return "hard";
  return "easy";
}

// Concise difficulty label for compact pills (the Explore card grid). The
// verbose `complexityLabel` ("Cook will need some help") reads well in a roomy
// row but is too wordy for a small pill on a two-column card, so the card uses
// these one-word forms. The verbose form stays for the row-style call sites
// (swap / add-a-dish pickers, dish sheets).
const COMPLEXITY_SHORT_LABEL: Record<NonNullable<Dish["complexity"]>, string> = {
  Easy: "Easy",
  Medium: "Medium",
  Hard: "Hard",
};

export function complexityShortLabel(complexity: Dish["complexity"]): string {
  return complexity ? COMPLEXITY_SHORT_LABEL[complexity] : "Easy";
}

// Decode the remaining free-form dish `tags` codes into display strings. The
// library stores codes, not display text (Principle 7: display decoupled from
// structure), so this is the one place that knows "HP" reads "High protein".
// Cuisine is no longer a tag: it is the first-class `cuisine` field, which
// already holds the human-readable name, so it needs no decoding here.
const TAG_LABELS: Record<string, string> = {
  hp: "High protein",
  complete_meal: "Complete meal",
};

// The default cuisine carries no information on a card (most of the library is
// Indian), so it is not shown as a descriptor pill; only an international cuisine
// is worth a pill. This mirrors the old behaviour where untagged Indian dishes
// surfaced no cuisine pill.
const DEFAULT_CUISINE = "Indian";

/** One pill on an Explore card. `kind` drives the visual style: the difficulty
 *  pill keeps its color semantics (green / amber / red), the rest render in the
 *  neutral/soft style. */
export interface DishTag {
  label: string;
  kind: "difficulty" | "neutral";
  variant?: ComplexityVariant;
}

/**
 * The ordered display tags for an Explore card, surfacing the details that help
 * someone choose a dish. Pure: a `Dish` in, display strings out. Order and cap
 * follow the EM tag-set decision:
 *   1. Difficulty (always), concise + colored.
 *   2. Prep time, "{n} min", when present.
 *   3. One descriptor, first that applies: High protein (tag HP) -> Complete
 *      meal (category or tag) -> cuisine (the `cuisine` field, unless Indian) ->
 *      Filling (satiety High).
 * Capped at four pills so the set never exceeds two lines on the card grid.
 * Dishes with empty `tags` degrade gracefully: they still get difficulty, prep
 * time, and (when satiety is High) Filling, never a raw code or an empty pill.
 */
export function exploreCardTags(dish: Dish): DishTag[] {
  const tags: DishTag[] = [
    {
      label: complexityShortLabel(dish.complexity),
      kind: "difficulty",
      variant: complexityVariant(dish.complexity),
    },
  ];

  if (typeof dish.prepMinutes === "number" && dish.prepMinutes > 0) {
    tags.push({ label: `${dish.prepMinutes} min`, kind: "neutral" });
  }

  const codes = dish.tags.map((t) => t.toLowerCase());
  const descriptor = pickDescriptor(dish, codes);
  if (descriptor) tags.push({ label: descriptor, kind: "neutral" });

  return tags;
}

function pickDescriptor(dish: Dish, codes: string[]): string | null {
  if (codes.includes("hp")) return TAG_LABELS.hp;
  if (dish.category === "Complete meal" || codes.includes("complete_meal")) {
    return TAG_LABELS.complete_meal;
  }
  if (dish.cuisine && dish.cuisine !== DEFAULT_CUISINE) return dish.cuisine;
  if (dish.satiety === "High") return "Filling";
  return null;
}

/**
 * The dish-row meta line. The handoff prototype showed "Ng protein · N min";
 * the live Dish type carries no per-serving protein yet (nutrition derivation is
 * a later slice), so we build from what exists: prep time and the plain-language
 * complexity. Degrades to whichever fields are present.
 */
export function dishMetaLine(dish: Dish | undefined): string {
  if (!dish) return "One off this week";
  const parts: string[] = [];
  if (typeof dish.prepMinutes === "number" && dish.prepMinutes > 0) {
    parts.push(`${dish.prepMinutes} min`);
  }
  const label = complexityLabel(dish.complexity);
  if (label) parts.push(label);
  return parts.length > 0 ? parts.join(" · ") : "From the library";
}

export function dishHasPrePrep(dish: Dish | undefined): boolean {
  return Boolean(dish?.prePrep);
}

/**
 * The swap picker's visible list. `pool` is the FULL ranked meal-time pool from
 * getSlotAlternatives (requested with a high limit so nothing is truncated out
 * of the search corpus). The full pool is the corpus for BOTH the name search
 * and the quick-filter chips: it is filtered by `(query empty || name includes
 * query) && dishMatchesPickerFilters(d, filters)`, so a recently-cooked staple
 * that ranks at the bottom is still reachable by name even with a filter active,
 * and the chips narrow the whole pool rather than just the suggested head. The
 * picker pills include the meal-time dimension (Breakfast / Lunch), since the
 * breakfast/lunch pool is generic across meal-time (picker-generic-search).
 *
 * The `suggestedCap` is a display limit that applies ONLY to the default view,
 * when there is neither a query nor an active filter: that keeps the glanceable
 * "Suggested for this day" list short. Any query or any active filter returns
 * all matches. The cap is never the search/filter corpus. Mirrors AddDishSheet's
 * filter over its full client-side pool.
 */
export function swapPickerVisible(
  pool: Dish[],
  query: string,
  filters: PickerPill[],
  suggestedCap: number,
): Dish[] {
  const needle = query.trim().toLowerCase();
  const matches = pool.filter(
    (d) =>
      (needle === "" || d.name.toLowerCase().includes(needle)) &&
      dishMatchesPickerFilters(d, filters),
  );
  // Default view only (no query AND no filter): cap to the suggested head.
  if (needle === "" && filters.length === 0) return matches.slice(0, suggestedCap);
  return matches;
}
