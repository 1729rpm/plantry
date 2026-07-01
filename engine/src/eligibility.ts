import type { Dish, MenuHistoryRow, Season } from "./data/schemas.js";

export type Day = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";
export type Meal = "Breakfast" | "Lunch";

/** The five scheduled weekdays, Mon-Fri, in schedule order (§2). */
export const WEEKDAYS: Day[] = ["Mon", "Tue", "Wed", "Thu", "Fri"];

/** Every scheduled day, Mon-Sat, in schedule order (§2). Sunday is unscheduled. */
export const ALL_DAYS: Day[] = [...WEEKDAYS, "Sat"];

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
  return args.library.filter((dish) => isActive(dish) && matchesSeason(dish, args.season));
}
