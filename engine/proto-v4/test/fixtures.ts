import type { Dish, DishTag, MenuHistoryRow } from "../../src/data/schemas.js";

/** Minimal dish builder for the prototype's unit tests. */
export function dish(partial: Partial<Dish> & { id: number; name: string }): Dish {
  return {
    category: "Dry dish",
    time: "Lunch",
    tags: [] as DishTag[],
    primaryIngredient: "Mixed Veg",
    preferred: "No",
    active: "Yes",
    satiety: "Medium",
    prepMinutes: 20,
    seasons: "All",
    cuisine: "Indian",
    ...partial,
  } as Dish;
}

export function row(
  weekStart: string,
  day: MenuHistoryRow["day"],
  meal: MenuHistoryRow["meal"],
  d: Dish,
): MenuHistoryRow {
  return { weekStart, day, meal, dishName: d.name, dishId: d.id };
}

/** A library that composes at least one legal week for every v4 form. */
export function baselineLibrary(): Dish[] {
  return [
    // Breakfast
    dish({
      id: 1,
      name: "Bread toast",
      category: "Bread",
      time: "Breakfast",
      tags: ["complete_carb"],
    }),
    dish({
      id: 2,
      name: "Veg chilla",
      category: "Chilla",
      time: "Breakfast",
      tags: ["complete_carb"],
    }),
    dish({
      id: 3,
      name: "Egg bhurji bowl",
      category: "Complete meal",
      time: "Breakfast",
      tags: ["complete_meal", "HP"],
      primaryIngredient: "Egg",
    }),
    dish({
      id: 4,
      name: "Poha bowl",
      category: "Complete meal",
      time: "Breakfast",
      tags: ["complete_meal"],
    }),
    dish({ id: 5, name: "Green chutney", category: "Accompaniment", time: "Breakfast" }),
    dish({
      id: 6,
      name: "Boiled egg side",
      category: "Keto",
      time: "Breakfast",
      tags: ["HP", "cuisine_neutral"],
      primaryIngredient: "Egg",
    }),
    // Lunch: Indian leads
    dish({
      id: 10,
      name: "Paneer gravy",
      category: "Gravy dish",
      tags: ["HP"],
      primaryIngredient: "Paneer",
    }),
    dish({
      id: 11,
      name: "Chicken dry",
      category: "Dry dish",
      tags: ["HP"],
      primaryIngredient: "Chicken",
    }),
    dish({ id: 12, name: "Fish keto", category: "Keto", tags: ["HP"], primaryIngredient: "Fish" }),
    // Lunch: Indian companions
    dish({ id: 20, name: "Toor daal", category: "Gravy dish" }),
    dish({ id: 21, name: "Bhindi fry", category: "Dry dish" }),
    dish({ id: 22, name: "Curd raita", category: "Accompaniment" }),
    dish({ id: 23, name: "Aloo jeera", category: "Dry dish" }),
    // Carbs
    dish({ id: 30, name: "Plain roti", category: "Chapati" }),
    dish({ id: 31, name: "Plain rice", category: "Rice" }),
    dish({ id: 32, name: "Neutral steamed rice", category: "Rice", tags: ["cuisine_neutral"] }),
    // Cuisine-neutral proteins
    dish({
      id: 40,
      name: "Plain chicken breast",
      category: "Keto",
      tags: ["HP", "cuisine_neutral"],
      primaryIngredient: "Chicken Breast",
    }),
    // Standalone leads
    dish({ id: 50, name: "Veg pulao", category: "Complete meal", tags: ["complete_meal"] }),
    dish({
      id: 51,
      name: "Thai curry",
      category: "Gravy dish",
      cuisine: "Thai",
      tags: ["HP"],
      primaryIngredient: "Tofu",
      carbAffinity: "Rice",
    }),
    dish({ id: 52, name: "Italian bake", category: "Dry dish", cuisine: "Italian" }),
    dish({ id: 53, name: "Italian side", category: "Accompaniment", cuisine: "Italian" }),
    // Saturday
    dish({
      id: 60,
      name: "Chicken biryani plate",
      category: "Complete meal",
      tags: ["complete_meal", "HP"],
      primaryIngredient: "Chicken",
    }),
    dish({ id: 61, name: "Sweet kheer", category: "Dessert" }),
    // Fruit
    dish({ id: 70, name: "Apple bowl", category: "Fruit", time: "Breakfast", tags: ["fruit"] }),
    dish({ id: 71, name: "Pear bowl", category: "Fruit", time: "Breakfast", tags: ["fruit"] }),
  ];
}
