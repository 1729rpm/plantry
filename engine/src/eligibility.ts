import type { Dish, MenuHistoryRow, Season } from "./data/schemas.js";

export type Day = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";
export type Meal = "Breakfast" | "Lunch";

export interface Slot {
  day: Day;
  meal: Meal;
}

export interface EligibleDishesArgs {
  library: Dish[];
  history: MenuHistoryRow[];
  season: Season;
  slot: Slot;
}

function isActive(dish: Dish): boolean {
  return dish.active === "Yes";
}

function matchesSeason(dish: Dish, season: Season): boolean {
  if (dish.seasons === "All") return true;
  return dish.seasons.includes(season);
}

export function eligibleDishes(args: EligibleDishesArgs): Dish[] {
  return args.library.filter(
    (dish) => isActive(dish) && matchesSeason(dish, args.season),
  );
}
