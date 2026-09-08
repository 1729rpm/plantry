import { describe, expect, it } from "vitest";
import { loadLiveData } from "../loadLive.js";
import { aggregateGroceryList } from "../../src/groceryList.js";
import { deriveDishMacros } from "../../src/nutrition.js";

const { library, ingredients, catalog, packSizes } = loadLiveData();

function groceryFor(ids: number[]) {
  return aggregateGroceryList({
    weekPicks: library.filter((dish) => ids.includes(dish.id)),
    ingredients, catalog, packSizes,
  }).groups.flatMap((group) => group.items);
}

describe("dish audit regressions", () => {
  it("includes the protein, bread and herbs of formerly empty recipes in shopping", () => {
    const items = groceryFor([104, 106, 109, 110, 111, 112]);
    for (const ingredient of ["Chicken Breast", "Paneer", "Bread", "Mint Leaf", "Garlic", "Peanut"]) {
      expect(items.find((item) => item.ingredient === ingredient)?.quantity).toBeGreaterThan(0);
    }
  });

  it("orders the main dessert ingredients and the sauces required by manchurian", () => {
    const items = groceryFor([130, 131, 132, 268, 287]);
    for (const ingredient of ["Semolina", "Banana", "Papaya", "Rice Vermicelli", "Soy Sauce", "Chilli Sauce", "White Vinegar"]) {
      expect(items.find((item) => item.ingredient === ingredient)?.quantity).toBeGreaterThan(0);
    }
    expect(items.find((item) => item.ingredient === "Soy Sauce")?.quantity).toBe(30);
  });

  it("does not order whole chickpeas for flour or wheat noodles for japchae", () => {
    expect(groceryFor([151]).some((item) => item.ingredient === "Chickpea")).toBe(false);
    const noodles = groceryFor([207]);
    expect(noodles.some((item) => item.ingredient === "Noodles")).toBe(false);
    expect(noodles.find((item) => item.ingredient === "Sweet Potato Glass Noodles")?.quantity).toBe(180);
  });

  it("retains five dals in Panchmel without increasing the dry pulse batch", () => {
    const pulses = ingredients.filter((row) => row.dishId === 236 && row.ingredient.endsWith("Dal"));
    expect(new Set(pulses.map((row) => row.ingredient)).size).toBe(5);
    expect(pulses.reduce((sum, row) => sum + row.quantity, 0)).toBe(130);
  });

  it("keeps pantry rice out of groceries and urad-only dosa out of health claims", () => {
    expect(groceryFor([272])).toEqual([]);
    const dosa = deriveDishMacros(ingredients.filter((row) => row.dishId === 285), catalog);
    expect(dosa.nutritionBasis).toBe("partial");
    expect(dosa.healthy).toBeNull();
    expect(library.find((dish) => dish.id === 285)?.recipe?.join(" ")).toContain("180 g dry rice");
  });

  it("counts substantial onion and tomato inputs instead of an all-zero tomato soup", () => {
    const soup = deriveDishMacros(ingredients.filter((row) => row.dishId === 262), catalog);
    expect(soup.caloriesPerPerson).toBeGreaterThan(0);
    expect(soup.nutritionBasis).toBe("partial");
  });
});
