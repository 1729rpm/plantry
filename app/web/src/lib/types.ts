// Frontend-local type aliases for slice 1. These mirror the Convex schema
// for currentWeek but are duplicated here so app/web does not need a TS
// project reference to app/convex (the generated client uses anyApi at
// runtime; types come from convex/_generated/dataModel only when wired).

export type Identity = "rajat" | "tuhina";

export type ShortDay = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";
export type Meal = "breakfast" | "lunch";
export type SlotSource = "generated" | "swapped" | "custom";
export type SlotAuthor = "rajat" | "tuhina" | "system";

export interface WeekSlot {
  day: ShortDay;
  meal: Meal;
  dishId: number | null;
  customLabel: string | null;
  source: SlotSource;
  author: SlotAuthor;
  updatedAt: number;
}

export interface CurrentWeek {
  weekStart: string;
  status: "draft" | "final";
  slots: WeekSlot[];
  version: number;
}

export interface CachedWeek {
  cachedAt: number;
  week: CurrentWeek;
}
