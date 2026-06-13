// Frontend view over the baked dish library. The library reaches the PWA via
// the build-time bake (docs/engineering.md §2: the library is static, not in
// Convex), imported here from @plantry/engine/library. This module is the one
// place that turns library structure into display: dish lookup by id, photo URL
// resolution from the bundle, the plain-language complexity label, and the
// dish-row meta line. Keeping that mapping here honours Principle 7 (display
// decoupled from structure): internal enum values never reach a screen.

import { dishes, ingredients } from "@plantry/engine/library";
import type { Dish, Ingredient } from "@plantry/engine";

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
 * The Active, in-season library dishes for one meal-time, name-sorted. Drives
 * the add-a-dish picker. The same hard filters the `addDish` mutation applies
 * (meal-time, Active, season), so every dish shown can actually be added.
 */
export function addablePool(meal: "breakfast" | "lunch", weekStart: string): Dish[] {
  const time = meal === "breakfast" ? "Breakfast" : "Lunch";
  const season = seasonOf(weekStart);
  return dishes
    .filter((d) => {
      if (d.active !== "Yes") return false;
      if (d.time !== time) return false;
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
