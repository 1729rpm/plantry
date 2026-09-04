/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as dayMutations from "../dayMutations.js";
import type * as dishDislikes from "../dishDislikes.js";
import type * as explore from "../explore.js";
import type * as favorites from "../favorites.js";
import type * as generateWeek from "../generateWeek.js";
import type * as groceryList from "../groceryList.js";
import type * as incidentsMutations from "../incidentsMutations.js";
import type * as lib_archiveHistory from "../lib/archiveHistory.js";
import type * as lib_author from "../lib/author.js";
import type * as lib_meals from "../lib/meals.js";
import type * as lib_record from "../lib/record.js";
import type * as manualChangesMutations from "../manualChangesMutations.js";
import type * as promoteCustomPick from "../promoteCustomPick.js";
import type * as queries_activity from "../queries/activity.js";
import type * as queries_favorites from "../queries/favorites.js";
import type * as queries_incidents from "../queries/incidents.js";
import type * as queries_manualChanges from "../queries/manualChanges.js";
import type * as queries_week from "../queries/week.js";
import type * as queries_wishlist from "../queries/wishlist.js";
import type * as recordExport from "../recordExport.js";
import type * as recordSeed from "../recordSeed.js";
import type * as seed from "../seed.js";
import type * as swap from "../swap.js";
import type * as users from "../users.js";
import type * as weekMutations from "../weekMutations.js";
import type * as wishlist from "../wishlist.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  dayMutations: typeof dayMutations;
  dishDislikes: typeof dishDislikes;
  explore: typeof explore;
  favorites: typeof favorites;
  generateWeek: typeof generateWeek;
  groceryList: typeof groceryList;
  incidentsMutations: typeof incidentsMutations;
  "lib/archiveHistory": typeof lib_archiveHistory;
  "lib/author": typeof lib_author;
  "lib/meals": typeof lib_meals;
  "lib/record": typeof lib_record;
  manualChangesMutations: typeof manualChangesMutations;
  promoteCustomPick: typeof promoteCustomPick;
  "queries/activity": typeof queries_activity;
  "queries/favorites": typeof queries_favorites;
  "queries/incidents": typeof queries_incidents;
  "queries/manualChanges": typeof queries_manualChanges;
  "queries/week": typeof queries_week;
  "queries/wishlist": typeof queries_wishlist;
  recordExport: typeof recordExport;
  recordSeed: typeof recordSeed;
  seed: typeof seed;
  swap: typeof swap;
  users: typeof users;
  weekMutations: typeof weekMutations;
  wishlist: typeof wishlist;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
