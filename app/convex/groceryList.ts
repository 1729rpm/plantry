import { query } from "./_generated/server.js";
import { v, ConvexError } from "convex/values";
import { dishes, packSizes, ingredients } from "@plantry/engine/library";
import type { Dish, Ingredient, PackSizeHeader } from "@plantry/engine";

/**
 * Returns the structured grocery list for `currentWeek[weekStart]`. Drives the
 * GroceryList component (Stream D slice 4) below the week body, and is the
 * shape the future Swiggy MCP integration (per `docs/engineering.md` §13) will
 * consume.
 *
 * Per `docs/product.md` §3 item 3: groups in fixed order
 * (Proteins and Dairy, Pantry, Vegetables, Aromatics and Herbs, Other),
 * quantities aggregated across the week, tracked items rounded to the next
 * pack multiple. Pantry staples (flour, oil, salt, common spices, base rice)
 * are omitted unless a dish lists them explicitly. Here every ingredient that
 * appears in `data/ingredients.md` for a picked dish is listed; the slow loop
 * is the path that prunes a row out of the ingredient sheet if Rajat decides a
 * given pantry staple should not be on the list.
 *
 * Custom one-offs (slots whose `dishId` is null) do not contribute to the
 * grocery list in v1: their ingredient quantities are not modelled in the
 * library, and the user adds those ingredients themselves. This is consistent
 * with `docs/product.md` §3 item 3 (the list is built from the week's library
 * dishes) and `features/phase2.md` §3 Stream C.
 *
 * Stub note: Stream B slice 8 (`@plantry/engine` `aggregateGroceryList` +
 * `GROCERY_GROUPS`) is in flight on a sibling worktree and was not yet merged
 * at the time this slice was written. To unblock parallel shipping, this file
 * carries a local stub implementation in `aggregateGroceryListLocal` that
 * honours the same contract (group order, tracked rounding, ingredient
 * grouping). Once Stream B slice 8 merges, this file should rebase onto main,
 * delete the local stub and the local `GROCERY_GROUPS` block, and import from
 * `@plantry/engine` directly. The query handler does not need to change.
 */

type ShortDay = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";
type LowerMeal = "breakfast" | "lunch";
type SlotShape = {
  day: ShortDay;
  meal: LowerMeal;
  dishId: number | null;
};

// --- Local stub starts. Delete once Stream B slice 8 lands. -----------------

type GroceryGroup =
  | "Proteins and Dairy"
  | "Pantry"
  | "Vegetables"
  | "Aromatics and Herbs"
  | "Other";

const GROUP_ORDER: GroceryGroup[] = [
  "Proteins and Dairy",
  "Pantry",
  "Vegetables",
  "Aromatics and Herbs",
  "Other",
];

interface GroceryItem {
  ingredient: string;
  quantity: number;
  unit: "g" | "ml" | "pcs";
  tracked: boolean;
  packs?: number;
  packTotalGrams?: number;
}

interface GroceryList {
  groups: Array<{ group: GroceryGroup; items: GroceryItem[] }>;
}

/**
 * Classifies a canonical ingredient name into one of the five product groups.
 * Inline rules chosen against the live `data/ingredients.md` so screenshots in
 * this PR look reasonable. Replaced wholesale by Stream B's `GROCERY_GROUPS`
 * constant when slice 8 lands.
 */
function groupOf(ingredient: string): GroceryGroup {
  const proteinsAndDairy = new Set([
    "Chicken",
    "Chicken Breast",
    "Chicken Keema",
    "Mutton",
    "Fish",
    "Prawn",
    "Egg",
    "Paneer",
    "Curd",
    "Milk",
    "Cheese",
    "Butter",
    "Ghee",
    "Cream",
  ]);
  const pantry = new Set([
    "Atta",
    "Maida",
    "Besan",
    "Rice",
    "Basmati Rice",
    "Poha",
    "Suji",
    "Vermicelli",
    "Oats",
    "Sugar",
    "Salt",
    "Oil",
    "Mustard Oil",
    "Vinegar",
    "Soy Sauce",
    "Coconut Milk",
    "Tomato Puree",
    "Cashew",
    "Peanut",
    "Almond",
    "Raisin",
    "Dal",
    "Toor Dal",
    "Moong Dal",
    "Chana Dal",
    "Urad Dal",
    "Masoor Dal",
    "Rajma",
    "Chickpea",
    "Black Chickpea",
    "Frozen Peas",
    "Tamarind",
    "Jaggery",
    "Dry Red Chilli",
    "Cinnamon",
    "Cardamom",
    "Clove",
    "Bay Leaf",
    "Cumin",
    "Mustard Seed",
    "Fenugreek Seed",
    "Asafoetida",
    "Turmeric",
    "Red Chilli Powder",
    "Garam Masala",
    "Coriander Powder",
    "Cumin Powder",
    "Black Pepper",
  ]);
  const aromaticsAndHerbs = new Set([
    "Onion",
    "Tomato",
    "Ginger",
    "Garlic",
    "Green Chilli",
    "Coriander Leaf",
    "Mint Leaf",
    "Curry Leaf",
    "Lemon",
  ]);
  if (proteinsAndDairy.has(ingredient)) return "Proteins and Dairy";
  if (pantry.has(ingredient)) return "Pantry";
  if (aromaticsAndHerbs.has(ingredient)) return "Aromatics and Herbs";
  // Default vegetables: anything else with a vegetable feel. Mushrooms,
  // capsicum, spinach, lauki, etc.
  const looksVegetable = new Set([
    "Mushroom",
    "Capsicum",
    "Spinach",
    "Lauki",
    "Tinda",
    "Tindora",
    "Karela",
    "Bhindi",
    "Cabbage",
    "Cauliflower",
    "Beans",
    "French Beans",
    "Carrot",
    "Beetroot",
    "Cucumber",
    "Lettuce",
    "Drumstick",
    "Potato",
    "Sweet Potato",
    "Brinjal",
    "Sprouts",
    "Peas",
    "Methi Leaf",
    "Bottle Gourd",
    "Ridge Gourd",
    "Snake Gourd",
    "Ash Gourd",
  ]);
  if (looksVegetable.has(ingredient)) return "Vegetables";
  return "Other";
}

function parsePackSizeGrams(packSize: string): number {
  const match = packSize.trim().match(/^(\d+(?:\.\d+)?)\s*g$/i);
  if (!match) return 0;
  return Number(match[1]);
}

function aggregateGroceryListLocal(args: {
  weekPicks: Dish[];
  ingredients: Ingredient[];
  packSizes: PackSizeHeader[];
}): GroceryList {
  const pickedDishIds = new Set(args.weekPicks.map((d) => d.id));
  const trackedPackGrams = new Map<string, number>();
  for (const header of args.packSizes) {
    trackedPackGrams.set(header.ingredient, parsePackSizeGrams(header.packSize));
  }

  // Sum quantities per (ingredient, unit) across all picked dishes.
  const totals = new Map<string, { quantity: number; unit: "g" | "ml" | "pcs" }>();
  for (const row of args.ingredients) {
    if (!pickedDishIds.has(row.dishId)) continue;
    const existing = totals.get(row.ingredient);
    if (existing) {
      // Same ingredient should always use the same unit across dishes; if it
      // doesn't, keep the first one we saw and skip the rest. The slow loop
      // would surface the inconsistency.
      if (existing.unit === row.unit) {
        existing.quantity += row.quantity;
      }
    } else {
      totals.set(row.ingredient, { quantity: row.quantity, unit: row.unit });
    }
  }

  const itemsByGroup = new Map<GroceryGroup, GroceryItem[]>();
  for (const g of GROUP_ORDER) itemsByGroup.set(g, []);

  for (const [ingredient, { quantity, unit }] of totals.entries()) {
    const group = groupOf(ingredient);
    const packGrams = trackedPackGrams.get(ingredient) ?? 0;
    const tracked = packGrams > 0 && unit === "g";
    const item: GroceryItem = tracked
      ? {
          ingredient,
          quantity,
          unit,
          tracked: true,
          packs: Math.ceil(quantity / packGrams),
          packTotalGrams: Math.ceil(quantity / packGrams) * packGrams,
        }
      : { ingredient, quantity, unit, tracked: false };
    itemsByGroup.get(group)!.push(item);
  }

  // Stable within-group order: alphabetical by ingredient name.
  for (const group of GROUP_ORDER) {
    itemsByGroup.get(group)!.sort((a, b) => a.ingredient.localeCompare(b.ingredient));
  }

  return {
    groups: GROUP_ORDER.map((group) => ({
      group,
      items: itemsByGroup.get(group)!,
    })),
  };
}

// --- Local stub ends. -------------------------------------------------------

/**
 * Browser-callable query. The PWA subscribes via
 * `useQuery(anyApi.groceryList.getGroceryList, { weekStart })`. Throws when
 * the `currentWeek` row for `weekStart` is missing; callers should not ask if
 * `getCurrentWeek` has returned null.
 */
export const getGroceryList = query({
  args: { weekStart: v.string() },
  handler: async (ctx, args): Promise<GroceryList> => {
    const week = await ctx.db
      .query("currentWeek")
      .withIndex("by_weekStart", (q) => q.eq("weekStart", args.weekStart))
      .unique();
    if (!week) {
      throw new ConvexError("no current week for this weekStart");
    }

    // Custom one-offs (`dishId === null`) are skipped: their ingredient
    // quantities are not in the library, and v1 expects the user to add those
    // ingredients themselves.
    const libraryById = new Map<number, Dish>(dishes.map((d) => [d.id, d]));
    const weekPicks: Dish[] = [];
    for (const slot of week.slots as SlotShape[]) {
      if (slot.dishId === null) continue;
      const dish = libraryById.get(slot.dishId);
      if (dish) weekPicks.push(dish);
    }

    return aggregateGroceryListLocal({
      weekPicks,
      ingredients,
      packSizes,
    });
  },
});
