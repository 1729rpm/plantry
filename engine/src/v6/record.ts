/**
 * The v6 record derivation (`features/engine-v6.md` §2, §2.1, §2.2).
 *
 * One pure function turns the household record (every as-eaten row of every served
 * week, swaps applied and skipped days excluded) into the statistics selection
 * reads: per-scope occasion counts, per-dish eaten counts and rates, the
 * weekday-occupation memory §6 step 5 places by, the per-season fruit counts §9
 * ranks by, the swap-away list the §11 gate's corrected run replays, the §3.2
 * presence rates the two slot-level presence ledgers accrue against, and the §6
 * step 5 weekday memory the exploration slot places by. `weekdayLunchRolesOf`
 * names the §5.1 role of every pick of a weekday lunch, and §3.2's presence
 * reading is one line over it, so the two cannot drift apart.
 *
 * Nothing here reads the clock, a random source, or the filesystem. Every map is
 * built in a fixed order (dish id ascending, then scope in `SCOPES` order) so that
 * two derivations of the same record serialize identically (§10).
 *
 * Two readings of §2 and §3 that the spec does not spell out, and that this module
 * and `ledger.ts` both hold to:
 *
 * 1. A plan pick and an as-eaten pick match as a **multiset match on (scope, dish id)
 *    within the week**, not on the exact (day, meal, dish) triple. This governs both
 *    `swappedOut` here and reconciliation in `ledger.ts`: a dish the engine placed on
 *    Monday and the household ate on Wednesday is one serving in one scope, so it is
 *    neither a swap-away nor a swap-in.
 * 2. **The fruit scope is season-scoped in both directions.** A fruit row from a week
 *    outside the requested season is not counted toward `eatenCount.fruit` and is not
 *    charged, because the rate it would move is measured over in-season occasions
 *    only. The §2.2 all-season fallback overrides this whenever the requested season
 *    has no record occasions at all. `seasonCount`, `lastEatenWeek` and the
 *    occupation memory stay unscoped: they are dish-level memory, not rates.
 *
 * ## The presence definition (§3.2), stated once and read from everywhere
 *
 * §3.2's presence rate is "the share of that scope's record occasions whose plate
 * carried **the optional element** (a companion on a weekday lunch; any third item
 * on a Saturday)". The record carries picks and not roles, so the optional element
 * has to be read off the plate, and `presenceDaysOf` is the one place that reading
 * lives. It is the definition the record's rate is measured with, the definition
 * §3.1's replay charges by, and the definition §11 threshold 11 measures the record
 * side with, so the ledger's target and the threshold are one quantity.
 *
 * - **Saturday.** Any third item beside the treat and the dessert is the optional
 *   element, accompaniment, structural dry-protein partner and §5.4 special protein
 *   alike, exactly as §3.2 says. Three or more picks is the whole test.
 * - **Weekday lunch.** The optional element is the companion, and only the
 *   companion, so the plate is read rather than counted: everything it holds beyond
 *   the positions its §5.1 form structurally requires is the companion. Plate size
 *   alone would be wrong in both directions, because a complete plate that takes a
 *   companion (khichdi and a salad) is two picks and a standard plate that takes a
 *   protein floor (dal, roti and a grilled chicken) is three.
 *   1. **The §5.1 protein-floor append comes off first.** §5.1 calls the floor a
 *      safety net that fires only when neither meal of the day carries protein, so
 *      it is not a companion. A lunch pick is read as that append when the dish
 *      passes the floor pool's own predicate (`isPlainProtein` and not
 *      `isSoyaProtein`), no other pick of the day carries protein (`carriesProtein`
 *      over the lunch's other picks and the day's breakfast, which is the condition
 *      under which the floor fires at all), and the lunch's other picks still hold
 *      a lunch star, so what is left when the append is removed is the plate the
 *      floor appended to. Without that last clause the classification would read a
 *      dry-protein **star** beside a carb and a companion (fish tikka, roti and a
 *      salad on a day whose breakfast is meatless) as a floor day and lose a real
 *      companion.
 *   2. **Then the form's own structural positions.** The star always; the carb on a
 *      standard plate (a true complete plate has none); and on a carb-forward
 *      international main the one plain protein §5.1 gives it, which is a partner
 *      and not a companion.
 *   3. **Anything still on the plate is the companion.**
 *
 * The engine charges the same occasions from the other side by role, a `companion`
 * placement and nothing else, which is what makes the two sides one quantity;
 * `generateWeekV6.ts` states that half, and §11 threshold 11 prints how far the two
 * readings sit apart on the same plans so the gap is never invisible.
 */

import type { Dish, Season } from "../data/schemas.js";
import { isSelfSufficientMain } from "../composition.js";
import { carriesProtein } from "./place.js";
import {
  isCarbForwardInternational,
  isLunchCarb,
  isLunchStar,
  isPlainProtein,
  isSoyaProtein,
} from "./pools.js";
import type {
  Day,
  DishOccupation,
  DishStats,
  Pick,
  PickRole,
  RecordStats,
  RecordWeek,
  Scope,
} from "./types.js";

/** The four §2.2 scopes in their canonical order. Every scope loop uses this order. */
export const SCOPES: readonly Scope[] = ["weekdayBreakfast", "weekdayLunch", "saturday", "fruit"];

/** Monday to Friday, the days that carry a weekday breakfast and a weekday lunch (§4). */
const WEEKDAYS: readonly Day[] = ["Mon", "Tue", "Wed", "Thu", "Fri"];

/** The single Saturday occasion, so the presence loop can share one shape with the weekdays. */
const SATURDAY: readonly Day[] = ["Sat"];

/** The two §3.2 slots that carry a presence ledger. The breakfast small item is not one. */
export const PRESENCE_SCOPES: readonly Scope[] = ["weekdayLunch", "saturday"];

/**
 * How many picks a lunch plate holds when it carried the §3.2 optional element.
 *
 * A weekday lunch is a star, a carb, and at most one companion; a Saturday is a
 * treat, a dessert, and at most one third item. In both scopes the third pick is
 * the optional element, and the record carries no roles to read it off directly.
 */
export const PRESENCE_PLATE_ITEMS = 3;

/**
 * The §5.1 protein-floor pool's own predicate, dish side: a plain protein in
 * Category Keto or Dry dish, never a Gravy dish or a complete meal, and never a
 * soya dish (§13). Exactly what `proteinFloorPool` filters on, so the
 * classification and the pool cannot drift apart.
 */
function isFloorAppendCandidate(dish: Dish): boolean {
  return isPlainProtein(dish) && !isSoyaProtein(dish);
}

/**
 * Whether one weekday lunch carried a §5.1 protein-floor append: the three-part
 * test the module doc comment states as the presence definition.
 *
 * `lunch` is the day's lunch dishes and `breakfast` the same day's breakfast
 * dishes, both in the record's own order; the test is order-independent.
 */
function floorAppendIndex(lunch: readonly Dish[], breakfast: readonly Dish[]): number {
  for (let index = 0; index < lunch.length; index += 1) {
    const candidate = lunch[index];
    if (!isFloorAppendCandidate(candidate)) continue;
    const rest = lunch.filter((_, other) => other !== index);
    if (rest.some(carriesProtein) || breakfast.some(carriesProtein)) continue;
    if (!rest.some(isLunchStar)) continue;
    return index;
  }
  return -1;
}

/** The dishes one meal of one day carried, library-known picks only, in pick order. */
function dishesOfMeal(
  picks: readonly Pick[],
  day: Day,
  meal: "breakfast" | "lunch",
  dishById: ReadonlyMap<number, Dish>,
): Dish[] {
  const out: Dish[] = [];
  for (const pick of picks) {
    if (pick.day !== day || pick.meal !== meal) continue;
    const dish = dishById.get(pick.dishId);
    if (dish !== undefined) out.push(dish);
  }
  return out;
}

/**
 * Which of a weekday lunch's picks leads the plate, when the plate holds more than
 * one dish §5.1 would admit as a star. Lower rank leads.
 *
 * §5.1 gives a weekday lunch exactly one star and calls it "a protein, a gravy, or
 * a hearty dal or legume", so a plate of a dal and a grilled chicken beside a roti
 * reads two ways and the record carries no role to settle it. Two of §5.1's own
 * rules settle it structurally, and they agree with each other: a carb-forward
 * international main takes one plain protein and that protein is its **partner**,
 * and the day-scoped protein floor **appends** a plain protein to a plate that is
 * already complete. In both, a Category Keto or Dry dish beside a more substantial
 * main is what accompanies the main and never the main itself. So a self-sufficient
 * main leads a Gravy dish, a Gravy dish (the dal family included, which is Category
 * Gravy dish) leads a plain protein, and a Category Accompaniment never leads at all
 * (§5.1 states that directly).
 *
 * Ties inside a rank break by dish id ascending, so the reading does not depend on
 * the order the record happens to carry the picks in (§10).
 */
function leadRank(dish: Dish): number {
  if (!isLunchStar(dish)) return 3;
  if (isSelfSufficientMain(dish)) return 0;
  if (dish.category === "Gravy dish") return 1;
  return 2;
}

/**
 * The §5.1 role each pick of one weekday lunch filled, aligned index by index to
 * `lunch`: everything the plate holds beyond the positions its form structurally
 * requires is a `companion`.
 *
 * The plate is read, not counted, because a weekday lunch is not always three items
 * when it carries a companion and not always a companion when it is three items:
 *
 * - the §5.1 protein-floor append is subtracted first (`floorAppendIndex`);
 * - a carb-forward international main takes exactly one plain protein and nothing
 *   else, so that partner is structural and not a companion;
 * - a standard plate's carb is structural, and a true complete plate has none;
 * - the star is structural in every form, and `leadRank` says which pick it is.
 *
 * What is left is the companion, which is why a complete plate of two picks
 * (khichdi and a salad) is presence while a standard plate of two (dal and roti) is
 * not.
 *
 * One structural position is always spent on the lead, even on the degenerate plate
 * that holds nothing §5.1 would admit as a star: the plate still has a lead, and
 * spending the position is what keeps this reading and §3.2's presence rate one
 * quantity. A dish that is not star-eligible can therefore be marked `star` here; it
 * belongs to no star pool either way (`isLunchStar` is what `lunchStarPool` filters
 * on), so nothing selects on it.
 */
export function weekdayLunchRolesOf(
  lunch: readonly Dish[],
  breakfast: readonly Dish[],
): PickRole[] {
  const roles: PickRole[] = lunch.map(() => "companion");
  if (lunch.length === 0) return roles;

  const floorIndex = floorAppendIndex(lunch, breakfast);
  if (floorIndex >= 0) roles[floorIndex] = "floor";
  const plate = lunch.map((_, index) => index).filter((index) => index !== floorIndex);
  if (plate.length === 0) return roles;

  /** The better lead of two plate positions: lower `leadRank`, then lower dish id. */
  const better = (a: number, b: number): number => {
    const rankA = leadRank(lunch[a]);
    const rankB = leadRank(lunch[b]);
    if (rankA !== rankB) return rankA < rankB ? a : b;
    return lunch[a].id <= lunch[b].id ? a : b;
  };

  const carbForward = plate.filter((index) => isCarbForwardInternational(lunch[index]));
  if (carbForward.length > 0) {
    const star = carbForward.reduce(better);
    roles[star] = "star";
    const partners = plate.filter(
      (index) =>
        index !== star && !isCarbForwardInternational(lunch[index]) && isPlainProtein(lunch[index]),
    );
    if (partners.length > 0) roles[partners.reduce(better)] = "partner";
    return roles;
  }

  const nonCarb = plate.filter((index) => !isLunchCarb(lunch[index]));
  const starEligible = nonCarb.filter((index) => isLunchStar(lunch[index]));
  const leadPool = starEligible.length > 0 ? starEligible : nonCarb.length > 0 ? nonCarb : plate;
  const star = leadPool.reduce(better);
  roles[star] = "star";
  const carbs = plate.filter((index) => index !== star && isLunchCarb(lunch[index]));
  if (carbs.length > 0) roles[carbs.reduce(better)] = "carb";
  return roles;
}

/**
 * Whether one weekday lunch carried the §3.2 optional companion. One reading, held
 * by `weekdayLunchRolesOf`: presence is a `companion` role on the plate.
 */
function carriedWeekdayCompanion(lunch: readonly Dish[], breakfast: readonly Dish[]): boolean {
  return weekdayLunchRolesOf(lunch, breakfast).includes("companion");
}

/**
 * §3.2: the days of a pick list on which one scope's plate carried the optional
 * element. The presence definition in the module doc comment, in code.
 *
 * The same reading measures the record, charges §3.1's replay, and is what §11
 * threshold 11 compares the engine's own role-metered charges against, so a
 * presence ledger accrued from the record is paid down by exactly the occasions the
 * record would have counted.
 *
 * `skippedDays` are days the household did not eat (§2.2): they are occasions of no
 * scope, so they can carry no presence either.
 */
export function presenceDaysOf(
  picks: readonly Pick[],
  scope: Scope,
  library: readonly Dish[],
  skippedDays: readonly Day[] = [],
): Set<Day> {
  const out = new Set<Day>();
  if (scope !== "weekdayLunch" && scope !== "saturday") return out;
  const dishById = new Map<number, Dish>();
  for (const dish of library) dishById.set(dish.id, dish);
  const skipped = new Set<Day>(skippedDays);

  for (const day of scope === "saturday" ? SATURDAY : WEEKDAYS) {
    if (skipped.has(day)) continue;
    const lunch = dishesOfMeal(picks, day, "lunch", dishById);
    if (scope === "saturday") {
      // §3.2 counts any third item on a Saturday, accompaniment, structural
      // partner and §5.4 special protein alike, so plate size is the whole test.
      if (lunch.length >= PRESENCE_PLATE_ITEMS) out.add(day);
      continue;
    }
    const breakfast = dishesOfMeal(picks, day, "breakfast", dishById);
    if (carriedWeekdayCompanion(lunch, breakfast)) out.add(day);
  }
  return out;
}

/** The three seasons in a fixed order, so per-season maps serialize identically (§10). */
const SEASONS: readonly Season[] = ["Summer", "Monsoon", "Winter"];

/**
 * The season a record week belongs to, read off the month of its `weekStart`
 * (Bangalore: Summer is March to May, Monsoon June to September, Winter October to
 * February; the same split the backend already applies in `app/convex/generateWeek.ts`).
 *
 * A week is assigned one season by its Monday, not day by day, so a week that
 * straddles a month boundary counts wholly in the season of its Monday. §2.2 speaks
 * of "fruit rows whose week falls in the current season", which is this rule.
 */
export function seasonOfWeek(weekStart: string): Season {
  const month = Number(weekStart.slice(5, 7));
  if (month >= 3 && month <= 5) return "Summer";
  if (month >= 6 && month <= 9) return "Monsoon";
  return "Winter";
}

/**
 * The §2.2 scope a pick belongs to, or null when the pick occupies no scope.
 *
 * Saturday has no breakfast in the §4 schedule, so a Saturday breakfast row (if one
 * ever appears in the data) belongs to no scope and is ignored everywhere: it is
 * neither an occasion, nor an eaten row, nor a charge.
 */
export function scopeOfPick(pick: Pick): Scope | null {
  if (pick.meal === "fruit") return "fruit";
  if (pick.day === "Sat") return pick.meal === "lunch" ? "saturday" : null;
  return pick.meal === "breakfast" ? "weekdayBreakfast" : "weekdayLunch";
}

/** The occasions one record week contributes to each scope (§2.2). */
export interface WeekOccasions {
  /** ISO Monday of the week. */
  weekStart: string;
  /** The season the week falls in, by its Monday. */
  season: Season;
  /**
   * Non-skipped occasions of each scope in this week. `fruit` already carries the
   * §2.2 season rule: in-season weeks only, or every week when the requested season
   * has no record occasions at all and the all-season fallback applies.
   */
  occasions: Record<Scope, number>;
  /** Non-skipped days of the week, Monday to Saturday: the all-season fruit denominator. */
  dayOccasions: number;
}

/**
 * The record's occasions week by week, ascending by `weekStart`.
 *
 * `RecordStats` carries only the totals, but the §3 cold start needs the occasions
 * that fall between a dish's last-eaten week and the cutover week, so the series is
 * derived separately and handed to `seedLedger`.
 */
export type OccasionSeries = readonly WeekOccasions[];

/** Options that change how a rate is computed. Production passes nothing. */
export interface DeriveRecordStatsOptions {
  /**
   * §14 item 1, run as a §11 gate variant. `occasions` (the default, and what §2.2
   * specifies) divides by every occasion in the record; `sinceFirstEaten` divides by
   * the occasions from the dish's first as-eaten week onward, so a rising new staple
   * is not diluted by the record's full length.
   */
  rateFormula?: "occasions" | "sinceFirstEaten";
}

function byWeekStart(a: { weekStart: string }, b: { weekStart: string }): number {
  return a.weekStart < b.weekStart ? -1 : a.weekStart > b.weekStart ? 1 : 0;
}

/** Deterministic pick order inside a week: schedule day, then meal, then dish id. */
const DAY_ORDER: readonly Day[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MEAL_ORDER = ["breakfast", "lunch", "fruit"] as const;

export function comparePicks(a: Pick, b: Pick): number {
  const day = DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day);
  if (day !== 0) return day;
  const meal = MEAL_ORDER.indexOf(a.meal) - MEAL_ORDER.indexOf(b.meal);
  if (meal !== 0) return meal;
  return a.dishId - b.dishId;
}

function emptyScopeCounts(): Record<Scope, number> {
  return { weekdayBreakfast: 0, weekdayLunch: 0, saturday: 0, fruit: 0 };
}

interface SeriesBuild {
  series: WeekOccasions[];
  /** In-season day occasions per season, across the whole record (§2.2). */
  seasonDayOccasions: Partial<Record<Season, number>>;
  /**
   * True when the requested season has zero record occasions, so §2.2's last
   * paragraph applies and the fruit scope falls back to the all-season rate.
   */
  fruitAllSeason: boolean;
}

function buildSeries(record: readonly RecordWeek[], season: Season): SeriesBuild {
  const sorted = [...record].sort(byWeekStart);
  const perWeek = sorted.map((week) => {
    const skipped = new Set<Day>(week.skippedDays);
    const weekdays = WEEKDAYS.filter((day) => !skipped.has(day)).length;
    const saturday = skipped.has("Sat") ? 0 : 1;
    return {
      weekStart: week.weekStart,
      season: seasonOfWeek(week.weekStart),
      weekdays,
      saturday,
      dayOccasions: weekdays + saturday,
    };
  });

  const seasonDayOccasions: Partial<Record<Season, number>> = {};
  for (const s of SEASONS) {
    const days = perWeek
      .filter((week) => week.season === s)
      .reduce((sum, week) => sum + week.dayOccasions, 0);
    if (days > 0) seasonDayOccasions[s] = days;
  }
  const fruitAllSeason = (seasonDayOccasions[season] ?? 0) === 0;

  const series = perWeek.map((week) => ({
    weekStart: week.weekStart,
    season: week.season,
    dayOccasions: week.dayOccasions,
    occasions: {
      weekdayBreakfast: week.weekdays,
      weekdayLunch: week.weekdays,
      saturday: week.saturday,
      fruit: fruitAllSeason || week.season === season ? week.dayOccasions : 0,
    },
  }));

  return { series, seasonDayOccasions, fruitAllSeason };
}

/**
 * The record's per-week occasions, ascending, with the §2.2 fruit season rule
 * already applied for `season`. Summing the series reproduces `RecordStats.occasions`.
 */
export function deriveOccasionSeries(
  record: readonly RecordWeek[],
  season: Season,
): OccasionSeries {
  return buildSeries(record, season).series;
}

interface DishAccumulator {
  eaten: Partial<Record<Scope, number>>;
  seasonCount: Partial<Record<Season, number>>;
  firstEatenWeek: string | null;
  lastEatenWeek: string | null;
  occupations: Map<string, { lastWeek: string; weeks: Set<string> }>;
}

function accumulatorFor(map: Map<number, DishAccumulator>, dishId: number): DishAccumulator {
  const existing = map.get(dishId);
  if (existing) return existing;
  const fresh: DishAccumulator = {
    eaten: {},
    seasonCount: {},
    firstEatenWeek: null,
    lastEatenWeek: null,
    occupations: new Map(),
  };
  map.set(dishId, fresh);
  return fresh;
}

/**
 * The picks of one week that count, in a deterministic order: every pick that
 * occupies a scope, whose dish the library knows, and (for the fruit scope) whose
 * week falls in the season the stats are scoped to.
 *
 * The fruit filter is the same one `reconcile` applies when charging: the fruit
 * ledger is season-scoped, so a mango eaten in Summer neither accrues nor is
 * charged against a Monsoon ledger. When the all-season fallback is in force no
 * fruit row is filtered out, because then every week counts.
 */
function countedPicks(
  picks: readonly Pick[],
  weekSeason: Season,
  season: Season,
  known: ReadonlySet<number>,
  fruitAllSeason: boolean,
  skippedDays: readonly Day[],
): Array<{ pick: Pick; scope: Scope }> {
  const skipped = new Set<Day>(skippedDays);
  const out: Array<{ pick: Pick; scope: Scope }> = [];
  for (const pick of [...picks].sort(comparePicks)) {
    if (skipped.has(pick.day)) continue;
    if (!known.has(pick.dishId)) continue;
    const scope = scopeOfPick(pick);
    if (scope === null) continue;
    if (scope === "fruit" && !fruitAllSeason && weekSeason !== season) continue;
    out.push({ pick, scope });
  }
  return out;
}

/**
 * §2: everything selection derives from the record.
 *
 * `record` is every record week (weeks earlier than the one being generated); it
 * need not be sorted. `season` scopes the fruit statistics: `occasions.fruit`,
 * every dish's `eatenCount.fruit`, and every dish's `rate.fruit` are measured over
 * the record's in-season weeks, falling back to the whole record when the season has
 * no record occasions (§2.2, last paragraph). `seasonCount` always carries the full
 * per-season breakdown, unscoped, so a caller can recompute any season's rate.
 *
 * A dish absent from a scope has **no key** in `eatenCount` and `rate` for it, which
 * is how §2.2's "absent, not present at rate zero" is represented. The `Record<Scope,
 * number>` shape in `types.ts` therefore reads as a partial map at runtime; every
 * consumer must treat a missing key as absence rather than as zero. (The shape is
 * fixed by the type contract, so it is not narrowed here; see the PR note.)
 *
 * Picks whose dish the library does not carry are ignored: a pick with no library
 * identity contributes no row, exactly as §2.1 says of a custom one-off.
 */
export function deriveRecordStats(
  record: readonly RecordWeek[],
  library: readonly Dish[],
  season: Season,
  options: DeriveRecordStatsOptions = {},
): RecordStats {
  const rateFormula = options.rateFormula ?? "occasions";
  const { series, seasonDayOccasions, fruitAllSeason } = buildSeries(record, season);
  const known = new Set(library.map((dish) => dish.id));
  const dishById = new Map<number, Dish>();
  for (const dish of library) dishById.set(dish.id, dish);
  const fruitDishIds = new Set(
    library.filter((dish) => dish.category === "Fruit").map((dish) => dish.id),
  );
  const sorted = [...record].sort(byWeekStart);

  const occasions = emptyScopeCounts();
  for (const week of series) {
    for (const scope of SCOPES) occasions[scope] += week.occasions[scope];
  }

  const accumulators = new Map<number, DishAccumulator>();
  const swappedOut: Pick[] = [];
  const presenceHits: Partial<Record<Scope, number>> = { weekdayLunch: 0, saturday: 0 };
  const explorationWeekdays = new Map<Day, string>();
  /**
   * Dish ids with an as-eaten row in any scope in a **strictly earlier** week: the
   * §6 step 5 test for whether a plan pick was an exploration placement. Grown at
   * the end of each week's pass, so a week's own rows never mask its own novelty.
   */
  const eatenBefore = new Set<number>();

  for (const week of sorted) {
    const weekSeason = seasonOfWeek(week.weekStart);
    const skipped = new Set<Day>(week.skippedDays);

    // Every scoped, library-known pick feeds the dish-level memory (last eaten week,
    // occupations, per-season fruit counts), whatever season it falls in. Only the
    // picks the requested season counts feed `eatenCount`, which is the numerator of
    // the season-scoped fruit rate; the weekday and Saturday scopes are not
    // season-scoped, so every one of their picks counts.
    for (const pick of [...week.picks].sort(comparePicks)) {
      if (skipped.has(pick.day)) continue;
      if (!known.has(pick.dishId)) continue;
      const scope = scopeOfPick(pick);
      if (scope === null) continue;

      const acc = accumulatorFor(accumulators, pick.dishId);
      if (acc.firstEatenWeek === null || week.weekStart < acc.firstEatenWeek) {
        acc.firstEatenWeek = week.weekStart;
      }
      if (acc.lastEatenWeek === null || week.weekStart > acc.lastEatenWeek) {
        acc.lastEatenWeek = week.weekStart;
      }
      const slot = `${pick.day}:${pick.meal}`;
      const occupation = acc.occupations.get(slot) ?? {
        lastWeek: week.weekStart,
        weeks: new Set(),
      };
      if (week.weekStart > occupation.lastWeek) occupation.lastWeek = week.weekStart;
      occupation.weeks.add(week.weekStart);
      acc.occupations.set(slot, occupation);
      if (fruitDishIds.has(pick.dishId)) {
        acc.seasonCount[weekSeason] = (acc.seasonCount[weekSeason] ?? 0) + 1;
      }

      if (scope === "fruit" && !fruitAllSeason && weekSeason !== season) continue;
      acc.eaten[scope] = (acc.eaten[scope] ?? 0) + 1;
    }

    // §3.2 presence: the share of the scope's occasions whose plate carried the
    // optional element, by the one classification the module doc comment states
    // and `presenceDaysOf` holds.
    for (const scope of PRESENCE_SCOPES) {
      const days = presenceDaysOf(week.picks, scope, library, week.skippedDays);
      presenceHits[scope] = (presenceHits[scope] ?? 0) + days.size;
    }

    // §6 step 5: the exploration slot's own weekday memory. A weekday lunch plan
    // pick whose dish had no as-eaten row in any scope before this week is an
    // exploration placement (§7 makes the exploration slot a weekday lunch
    // position, and no other weekday lunch pool admits a dish with no scope rows).
    for (const pick of [...(week.generatedPlan ?? [])].sort(comparePicks)) {
      if (pick.meal !== "lunch" || pick.day === "Sat") continue;
      if (!known.has(pick.dishId)) continue;
      if (eatenBefore.has(pick.dishId)) continue;
      explorationWeekdays.set(pick.day, week.weekStart);
    }
    for (const pick of week.picks) {
      if (skipped.has(pick.day)) continue;
      if (!known.has(pick.dishId)) continue;
      if (scopeOfPick(pick) === null) continue;
      eatenBefore.add(pick.dishId);
    }

    if (week.generatedPlan !== null) {
      const eaten = countedPicks(
        week.picks,
        weekSeason,
        season,
        known,
        fruitAllSeason,
        week.skippedDays,
      );
      const planned = countedPicks(
        week.generatedPlan,
        weekSeason,
        season,
        known,
        fruitAllSeason,
        [],
      );
      swappedOut.push(...unmatchedPlanPicks(planned, eaten));
    }
  }

  const perDish = new Map<number, DishStats>();
  for (const dishId of [...accumulators.keys()].sort((a, b) => a - b)) {
    const acc = accumulators.get(dishId) as DishAccumulator;
    perDish.set(dishId, {
      eatenCount: partialScopeRecord(acc.eaten),
      rate: partialScopeRecord(rateOf(acc, series, occasions, rateFormula)),
      lastEatenWeek: acc.lastEatenWeek,
      occupations: buildOccupations(acc.occupations),
      seasonCount: orderedSeasonCount(acc.seasonCount),
    });
  }

  const presenceRate: Partial<Record<Scope, number>> = {};
  for (const scope of PRESENCE_SCOPES) {
    const denominator = occasions[scope];
    if (denominator > 0) presenceRate[scope] = (presenceHits[scope] ?? 0) / denominator;
  }

  return {
    weeks: record.length,
    occasions,
    seasonDayOccasions,
    perDish,
    swappedOut,
    presenceRate,
    explorationWeekdays: orderedExplorationWeekdays(explorationWeekdays),
  };
}

/** Monday-first key order, so two derivations of the same record serialize identically (§10). */
function orderedExplorationWeekdays(raw: ReadonlyMap<Day, string>): Map<Day, string> {
  const out = new Map<Day, string>();
  for (const day of DAY_ORDER) {
    const week = raw.get(day);
    if (week !== undefined) out.set(day, week);
  }
  return out;
}

/**
 * The plan picks of a week that no as-eaten pick matched: what the household swapped
 * away after generation (§11's corrected run reads this list).
 *
 * Matching is a **multiset match on (scope, dish id) within the week**, not on the
 * exact (day, meal, dish) triple. A dish the engine placed on Monday and the
 * household ate on Wednesday is the same serving in the same scope, so it is not a
 * swap-away and its as-eaten row is not a swap-in; charging it a second time at
 * reconciliation would take two servings out of the ledger for one meal. Placing the
 * same dish twice in a scope and eating it once leaves exactly one plan pick
 * unmatched, which is the intended charge.
 */
function unmatchedPlanPicks(
  planned: ReadonlyArray<{ pick: Pick; scope: Scope }>,
  eaten: ReadonlyArray<{ pick: Pick; scope: Scope }>,
): Pick[] {
  const remaining = new Map<string, number>();
  for (const { pick, scope } of eaten) {
    const key = `${pick.dishId}:${scope}`;
    remaining.set(key, (remaining.get(key) ?? 0) + 1);
  }
  const out: Pick[] = [];
  for (const { pick, scope } of planned) {
    const key = `${pick.dishId}:${scope}`;
    const left = remaining.get(key) ?? 0;
    if (left > 0) {
      remaining.set(key, left - 1);
      continue;
    }
    out.push({ day: pick.day, meal: pick.meal, dishId: pick.dishId });
  }
  return out;
}

/**
 * The as-eaten picks of a week that the week's plan did not contain: the household's
 * swap-ins, which §3 charges at reconciliation. The mirror of `unmatchedPlanPicks`,
 * and it uses the same multiset match, so the two lists are consistent by construction.
 */
export function unmatchedEatenPicks(
  eaten: ReadonlyArray<{ pick: Pick; scope: Scope }>,
  planned: ReadonlyArray<{ pick: Pick; scope: Scope }>,
): Array<{ pick: Pick; scope: Scope }> {
  const remaining = new Map<string, number>();
  for (const { pick, scope } of planned) {
    const key = `${pick.dishId}:${scope}`;
    remaining.set(key, (remaining.get(key) ?? 0) + 1);
  }
  const out: Array<{ pick: Pick; scope: Scope }> = [];
  for (const entry of eaten) {
    const key = `${entry.pick.dishId}:${entry.scope}`;
    const left = remaining.get(key) ?? 0;
    if (left > 0) {
      remaining.set(key, left - 1);
      continue;
    }
    out.push(entry);
  }
  return out;
}

/**
 * The picks of one week that count, for `reconcile` (§3) and for the replay's plan
 * charges.
 *
 * `kind` decides which list is read and whether the week's skipped days apply. An
 * as-eaten row on a skipped day is not a row at all (§2.1: the record is the week's
 * slot state "minus every day named in its `skippedDays`"), while a plan pick on a
 * day the household later skipped stays: the engine placed it and §3 charged it, and
 * §3's no-refund rule keeps that charge.
 */
export function countedPicksOfWeek(
  week: RecordWeek,
  kind: "eaten" | "planned",
  library: readonly Dish[],
  season: Season,
  fruitAllSeason: boolean,
): Array<{ pick: Pick; scope: Scope }> {
  const known = new Set(library.map((dish) => dish.id));
  const picks = kind === "eaten" ? week.picks : (week.generatedPlan ?? []);
  return countedPicks(
    picks,
    seasonOfWeek(week.weekStart),
    season,
    known,
    fruitAllSeason,
    kind === "eaten" ? week.skippedDays : [],
  );
}

/** Whether the requested season has no record occasions, so §2.2's fallback is in force. */
export function isFruitAllSeasonFallback(record: readonly RecordWeek[], season: Season): boolean {
  return buildSeries(record, season).fruitAllSeason;
}

function rateOf(
  acc: DishAccumulator,
  series: OccasionSeries,
  occasions: Record<Scope, number>,
  rateFormula: "occasions" | "sinceFirstEaten",
): Partial<Record<Scope, number>> {
  const rate: Partial<Record<Scope, number>> = {};
  for (const scope of SCOPES) {
    const eaten = acc.eaten[scope];
    if (eaten === undefined) continue;
    const denominator =
      rateFormula === "sinceFirstEaten" && acc.firstEatenWeek !== null
        ? series
            .filter((week) => week.weekStart >= (acc.firstEatenWeek as string))
            .reduce((sum, week) => sum + week.occasions[scope], 0)
        : occasions[scope];
    if (denominator <= 0) continue;
    rate[scope] = eaten / denominator;
  }
  return rate;
}

/**
 * Rebuild a partial scope map with its keys in `SCOPES` order, so two derivations
 * of the same record serialize identically (§10).
 *
 * The map stays partial on purpose: §2.2 requires absence, not rate zero, and
 * `DishStats.eatenCount` and `DishStats.rate` in `types.ts` are typed
 * `Partial<Record<Scope, number>>` to say so.
 */
function partialScopeRecord(
  partial: Partial<Record<Scope, number>>,
): Partial<Record<Scope, number>> {
  const out: Partial<Record<Scope, number>> = {};
  for (const scope of SCOPES) {
    const value = partial[scope];
    if (value !== undefined) out[scope] = value;
  }
  return out;
}

function orderedSeasonCount(
  counts: Partial<Record<Season, number>>,
): Partial<Record<Season, number>> {
  const out: Partial<Record<Season, number>> = {};
  for (const s of SEASONS) {
    const value = counts[s];
    if (value !== undefined) out[s] = value;
  }
  return out;
}

function buildOccupations(
  raw: Map<string, { lastWeek: string; weeks: Set<string> }>,
): Map<string, DishOccupation> {
  const out = new Map<string, DishOccupation>();
  for (const key of [...raw.keys()].sort()) {
    const entry = raw.get(key) as { lastWeek: string; weeks: Set<string> };
    out.set(key, { lastWeek: entry.lastWeek, count: entry.weeks.size });
  }
  return out;
}

/** The rate a dish carries in a scope, or undefined when the dish is absent from it (§2.2). */
export function rateIn(stats: RecordStats, dishId: number, scope: Scope): number | undefined {
  return stats.perDish.get(dishId)?.rate[scope];
}

/** The as-eaten rows a dish carries in a scope, or undefined when it is absent from it. */
export function eatenCountIn(stats: RecordStats, dishId: number, scope: Scope): number | undefined {
  return stats.perDish.get(dishId)?.eatenCount[scope];
}

/**
 * §11's frozen run, built: the cutover record's **rates**, the live record's
 * **memories**.
 *
 * The frozen run is a control. It answers "does the engine hold the household's
 * distribution when the record cannot answer back", so the quantities it must hold
 * fixed are **every rate**, plus what those rates are computed from: each scope
 * rate, §3.2's two slot presence rates, the eaten counts and occasion counts, the
 * per-season fruit counts, and the `lastEatenWeek` §3's cold start backdates from.
 * Freezing those is the whole point of the run.
 *
 * §3.2's presence rate is a rate like any other. It is the target the two presence
 * ledgers accrue against, so a run that let it track the live record would let the
 * engine's own output move the bar it is measured against, which is the one thing
 * this control exists to prevent. It read the live record for one cycle, which cost
 * threshold 11 a measured +10.6 percent on the Saturday accompaniment; it is frozen
 * with the dish rates now.
 *
 * What must **not** freeze is everything the record carries that is a memory of
 * where things went rather than how often they were eaten. §6 step 5 assigns days
 * by a least-recently-used memory (`DishStats.occupations` for a dish, and
 * `explorationWeekdays` for the exploration reserve, which has no dish history of
 * its own). Frozen, that memory never advances: every week of the horizon resolves
 * the same least-recently-used day, and the run reports a slot lock that is an
 * artifact of the harness rather than a property of the engine. The first gate
 * cycle hit the same class of artifact on §7 candidacy and fixed it the same way
 * (`GenerateWeekV6Args.variant.frozenRates` no longer decides which dishes count as
 * never-eaten); this is the rest of it.
 *
 * So, precisely:
 *
 * - **frozen** (from `frozen`, every rate and what a rate is computed from):
 *   `weeks`, `occasions`, `seasonDayOccasions`, `presenceRate`, and per dish
 *   `eatenCount`, `rate`, `seasonCount`, `lastEatenWeek`;
 * - **live** (from `live`, memory of where things went and nothing else): per dish
 *   `occupations`, plus `explorationWeekdays` and `swappedOut`.
 *
 * A dish the live record has eaten since cutover but the frozen record has not
 * carries no rate and no eaten count, which is exactly what freezing means (§2.2
 * reads an absent scope key as absence, not as rate zero, so it sits in no pool).
 * It still gets its live occupation memory, which costs nothing until something
 * else puts it on a plate.
 *
 * Deterministic (§10): `perDish` is rebuilt in dish id ascending order over the
 * union of the two maps, so two calls on the same pair serialize identically.
 */
export function frozenRatesStats(frozen: RecordStats, live: RecordStats): RecordStats {
  const perDish = new Map<number, DishStats>();
  const dishIds = [...new Set([...frozen.perDish.keys(), ...live.perDish.keys()])].sort(
    (a, b) => a - b,
  );
  for (const dishId of dishIds) {
    const rates = frozen.perDish.get(dishId);
    const memory = live.perDish.get(dishId);
    perDish.set(dishId, {
      eatenCount: rates?.eatenCount ?? {},
      rate: rates?.rate ?? {},
      seasonCount: rates?.seasonCount ?? {},
      lastEatenWeek: rates?.lastEatenWeek ?? null,
      occupations: memory?.occupations ?? new Map(),
    });
  }
  return {
    weeks: frozen.weeks,
    occasions: frozen.occasions,
    seasonDayOccasions: frozen.seasonDayOccasions,
    perDish,
    swappedOut: live.swappedOut,
    presenceRate: frozen.presenceRate,
    explorationWeekdays: live.explorationWeekdays,
  };
}
