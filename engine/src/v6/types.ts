/**
 * The v6 type contract.
 *
 * Every shape the v6 engine's modules share lives here and nowhere else, so that
 * streams A (record and ledger), B (pools and plates), C (exploration, favorites,
 * placement), D (orchestrator and gate), and E1 (backend) can be built against one
 * another without importing one another's implementation. The file carries types
 * only: no functions, no constants, no runtime code.
 *
 * Section references throughout are to `features/engine-v6.md` (the v6 rules spec,
 * round 3). The shapes themselves are fixed by `features/engine-v6-plan.md` §5.
 */

import type { CatalogIngredient, Dish, Ingredient, Season } from "../data/schemas.js";
import type { GeneratedWeek } from "../generateWeek.js";

/**
 * The six days the engine schedules (§4). Sunday is never generated.
 *
 * Deliberately the same short-form union the production engine already uses in
 * `engine/src/eligibility.ts`, so a v6 `Day` and a v3 `Day` are interchangeable
 * while both engines coexist on the integration branch.
 */
export type Day = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";

/**
 * The three kinds of slot a pick can occupy (§4). `fruit` is its own meal because
 * the fruit of the day sits outside the breakfast and lunch plates and outside the
 * §9 item ceilings.
 */
export type MealKey = "breakfast" | "lunch" | "fruit";

/**
 * §2.2 scopes. A dish's ledger, rate, and pool membership are all per scope.
 *
 * Scopes are symmetric and disjoint: a dish's Saturday ledger accrues only its
 * Saturday rows and is charged only by Saturday placements. A dish with no
 * as-eaten row in a scope is absent from that scope's pools, not present at rate
 * zero, so a weekday pasta never competes for the Saturday treat.
 */
export type Scope = "weekdayBreakfast" | "weekdayLunch" | "saturday" | "fruit";

/**
 * One as-eaten pick, or one engine placement. Same shape for both (§2.1, §6).
 *
 * The record's picks and the week's `generatedPlan` are both lists of this shape,
 * which is what lets §3's reconciliation tell an engine placement from a hand
 * swap-in by set difference alone.
 */
export interface Pick {
  day: Day;
  meal: MealKey;
  dishId: number;
}

/**
 * One record week as the backend hands it over (§2.1). Custom picks already removed.
 *
 * The as-eaten state of a record week is its live `currentWeek` slot state (swaps,
 * adds, and deletes applied), minus every day named in `skippedDays`, minus every
 * pick whose `dishId` is null (a free-text custom one-off has no library identity).
 */
export interface RecordWeek {
  /** ISO date of the Monday that anchors the week. */
  weekStart: string;
  /** As-eaten picks: live slot state, custom picks excluded. */
  picks: Pick[];
  /** Days the household skipped; they contribute no occasions and no rows (§2.2). */
  skippedDays: Day[];
  /**
   * What the engine placed when the row was written (§12), or null for weeks
   * written before cutover, which are read as record-only weeks.
   */
  generatedPlan: Pick[] | null;
}

/**
 * Everything the engine derives about one dish from the record (§2.2).
 *
 * A dish whose `eatenCount` is zero in every scope is a candidate, not a repertoire
 * member: it enters menus only through exploration (§7) or the fruit overflow rule
 * (§9).
 */
export interface DishStats {
  /**
   * As-eaten rows of the dish in each scope's slots (§2.2).
   *
   * Partial by design: §2.2 makes a dish with no as-eaten row in a scope
   * **absent** from that scope's pools, not present at rate zero, and absence is
   * represented as a missing key. Read a missing key as absence; `?? 0` is only
   * correct where the caller has already decided that absence and zero mean the
   * same thing.
   */
  eatenCount: Partial<Record<Scope, number>>;
  /** `eatenCount[scope] / occasions[scope]`: servings per occasion (§2.2). Partial, like `eatenCount`. */
  rate: Partial<Record<Scope, number>>;
  /** ISO Monday of the dish's most recent as-eaten week, read by the §3 cold start. */
  lastEatenWeek: string | null;
  /**
   * §6 step 5 occupation memory: most recent weekStart per (day, meal), and total count.
   *
   * Keyed `` `${day}:${meal}` `` (for example `"Tue:lunch"`), one entry per
   * (day, meal) pair the dish has actually occupied in the record. An absent key
   * means the dish has never occupied that slot, which the placement pass counts as
   * infinitely old.
   */
  occupations: Map<string, DishOccupation>;
  /** Fruit only: as-eaten rows per season (§2.2). */
  seasonCount: Partial<Record<Season, number>>;
}

/** One entry of the §6 step 5 occupation memory: when a dish last held a slot, and how often. */
export interface DishOccupation {
  /** ISO Monday of the most recent record week in which the dish held this slot. */
  lastWeek: string;
  /** Total record weeks in which the dish held this slot; the second tiebreak in §6 step 5. */
  count: number;
}

/**
 * The whole household record, reduced to what selection reads (§2).
 *
 * Cumulative and never windowed: the record only grows, so the household's real
 * eating history stays in the signal forever.
 */
export interface RecordStats {
  /** Record weeks counted, skipped days included (a skipped day still sits in a counted week). */
  weeks: number;
  /** Non-skipped occasions of each scope across the record (§2.2). */
  occasions: Record<Scope, number>;
  /** In-season day occasions per season, the denominator of a fruit's season rate (§2.2). */
  seasonDayOccasions: Partial<Record<Season, number>>;
  perDish: Map<number, DishStats>;
  /** The swap-away list for the gate's corrected run: dishIds the household removed after generation. */
  swappedOut: Pick[];
}

/**
 * The replayed ledger (§3.1). Immutable snapshots; every operation returns a new ledger.
 *
 * No table holds deficits. The ledger is a pure function of persisted data, replayed
 * on every generation: seed at the cutover week, then accrue, charge placements, and
 * charge the as-eaten rows the plan did not contain, week by week.
 *
 * `deficits` is keyed `` `${dishId}:${scope}` `` (for example `"142:weekdayLunch"`).
 * An absent key means the dish has no ledger in that scope: it neither accrues nor
 * competes there. Values may go negative and persist across weeks.
 */
export interface Ledger {
  deficits: Map<string, number>;
}

/**
 * The position a pick fills on its plate (§5).
 *
 * Structural roles (`star`, `carb`, `breakfast-main`, `treat`, `dessert`, `fruit`)
 * are always filled; optional roles (`companion`, `breakfast-small`,
 * `accompaniment`) are filled only when the top dish in their pool has a positive
 * deficit (§3.2). `floor` is the §5.1 day-scoped protein floor append; `partner` is
 * the §5.1 dry protein beside a carb-forward international main; `special-protein`
 * is the §5.4 protein that elevates an everyday Saturday base.
 */
export type PickRole =
  | "breakfast-main"
  | "breakfast-small"
  | "star"
  | "carb"
  | "companion"
  | "floor"
  | "partner"
  | "treat"
  | "special-protein"
  | "accompaniment"
  | "dessert"
  | "fruit";

/**
 * Why a pick is in the plan (§6).
 *
 * `favorite` is the §8 pinning pass, `exploration` the single §7 novelty pick,
 * `deficit` an ordinary top-deficit win, `fallback` the §3.2 workhorse fill of an
 * exhausted pool (or the §9 fruit overflow), and `structural` a slot the plate form
 * required with no deficit competition (the §5.2 dish-driven chutney, the §5.1
 * protein floor, the Thursday egg anchor).
 */
export type PickOrigin = "favorite" | "exploration" | "deficit" | "fallback" | "structural";

/**
 * A planned dish before or after day assignment (§6).
 *
 * Generation plans the whole week first (steps 2 to 4), then assigns days (step 5),
 * so a `PlanPick`'s `day` is provisional until the placement pass has run.
 */
export interface PlanPick extends Pick {
  role: PickRole;
  scope: Scope;
  origin: PickOrigin;
}

/** The gate's measurement variants (§11), run alongside the three headline runs. */
export interface GenerateWeekV6Variant {
  /** Rates fixed at the cutover record for the whole horizon (the frozen run). */
  frozenRates?: boolean;
  /**
   * Override the §3 cold-start cap of one serving: a number caps at that many
   * servings, `"pool"` applies the cap at pool level instead of per dish.
   */
  coldStartCap?: number | "pool";
  /**
   * Seed optional-pool dishes (companions, breakfast small items, Saturday
   * accompaniments) at the cold start too. The spec seeds structural pools only.
   */
  seedOptionalPools?: boolean;
  /** Keep the §7 family governor on novelty. Measured against having it off. */
  familyGovernor?: boolean;
  /** The §14 rate-formula variant: per occasion (specified) versus since first eaten. */
  rateFormula?: "occasions" | "sinceFirstEaten";
}

/** Everything `generateWeekV6` reads. All of it derives from persisted data (§10). */
export interface GenerateWeekV6Args {
  /** ISO date of the Monday that anchors the week being generated. */
  weekStart: string;
  season: Season;
  library: Dish[];
  /** Every record week before `weekStart`, ascending (§2.1). */
  record: RecordWeek[];
  /** The favorites table's library dish ids, createdAt ascending (§8). */
  favoriteDishIds: readonly number[];
  /**
   * Test and gate hook only; production passes nothing and the engine derives it
   * (§12): the earliest `weekStart` among record weeks carrying a `generatedPlan`,
   * or the generating week itself when none does.
   */
  cutoverWeek?: string;
  /** Gate variants (§11). Production passes nothing. */
  variant?: GenerateWeekV6Variant;
  /**
   * The macro inputs the §7 exploration score's protein-band signal reads: the
   * per-dish ingredient rows and the ingredient catalog (`docs/engine.md` §11).
   *
   * Optional, and without it that one signal reads zero for every candidate while
   * the other two (shared primary ingredient, familiar category) still rank the
   * pool. Production and the §11 gate both pass the baked library's `ingredients`
   * and `catalog`; the engine cannot import them itself, because
   * `engine/src/data/library.ts` is baked from `data/` and does not exist on a
   * fresh worktree, so an import of it from `engine/src` would make `npm run bake`
   * unable to run the very build that writes it.
   */
  nutrition?: {
    ingredients: Ingredient[];
    catalog: CatalogIngredient[];
  };
}

/**
 * One deterministic repair made by the §6 step 6 constraint pass.
 *
 * A repair either replaces the offending dish with the next-ranked alternative from
 * its own pool, or swaps whole plates between the earliest pair of days that clears
 * the violation. An engine-internal repair refunds the replaced dish's charge and
 * charges the replacement; the §3 no-refund rule is for household swap-outs only.
 */
export interface ConstraintRepair {
  /**
   * The §6 step 6 constraint that fired, in the order the pass enforces them: the
   * two §4 anchors, one gravy per lunch, cross-meal protein family, cross-meal
   * ingredient, rice on consecutive days, the day-scoped protein floor, item
   * ceilings, the 120-minute prep ceiling.
   */
  constraint:
    | "anchor"
    | "one-gravy-per-lunch"
    | "protein-family"
    | "primary-ingredient"
    | "consecutive-rice"
    | "protein-floor"
    | "item-ceiling"
    | "prep-ceiling";
  /** The day the repair touched; for a whole-plate swap, the earlier of the two days. */
  day: Day;
  meal: MealKey;
  /** Dish removed, or null when the repair only swapped plates between two days. */
  removedDishId: number | null;
  /** Dish put in its place, or null when the offending dish was dropped outright. */
  addedDishId: number | null;
  /** The other day of a whole-plate swap; null for an in-place replacement. */
  swappedWithDay: Day | null;
}

/** One day whose composed plates exceed the §5.1 whole-day prep ceiling of 120 active minutes. */
export interface PrepCeilingBreach {
  day: Day;
  /** Summed `prepMinutes` of the day's breakfast and lunch after every repair. */
  prepMinutes: number;
  /** True when the day's protected items alone exceed the ceiling, so §11 threshold 10 reports it unrepaired. */
  unrepairable: boolean;
}

/**
 * What the §11 gate harness reads off a generated week, over and above the plates.
 *
 * Reported, not gated, except where a §11 threshold names it: threshold 10 reads
 * `prepCeilingBreaches`, and §3.2's reopening trigger and §11 threshold 13 read
 * `negativeDeficitFills`. Stream D may refine this shape as the harness is written.
 */
export interface V6Diagnostics {
  /**
   * §3.2 workhorse fills: how many slots of each role were filled from an exhausted
   * pool (every deficit negative or zero) rather than by a positive deficit.
   */
  negativeDeficitFills: Partial<Record<PickRole, number>>;
  /** The §7 exploration pick and its protein family, or null when no slot accepted a candidate this week. */
  exploration: { dishId: number; proteinFamily: string } | null;
  /** Every repair the §6 step 6 constraint pass made, in the order it made them. */
  repairs: ConstraintRepair[];
  /** Days over the §5.1 120-minute prep ceiling after repairs (§11 threshold 10). */
  prepCeilingBreaches: PrepCeilingBreach[];
  /**
   * Violations the §6 step 6 constraint pass could not clear deterministically,
   * as `reason:day` or `reason:day:meal` keys (for example `prep-ceiling:Thu`,
   * `item-ceiling:Wed:lunch`). Reported, never gated: §5.1 makes the
   * consecutive-rice rule soft and allows a cross-meal repeat when no
   * alternative exists, so an entry here is information for §11, not a failure.
   */
  unrepairable: string[];
  /**
   * The §5.3 count this week's plan carried into the ceiling: weekday lunch
   * stars whose cuisine is not Indian, the exploration pick included. Reported
   * by §11 threshold 8.
   */
  weekdayInternationalStars: number;
  /**
   * The §12 cutover week this generation replayed from, derived unless the
   * caller overrode it. Reported so the §11 harness can show that a self-feeding
   * run settles on one cutover instead of moving it every week.
   */
  cutoverWeek: string;
}

/**
 * A generated week as v6 returns it: the existing `GeneratedWeek` shape (days,
 * slots, dishes in pick order, fruit, incidents, unplacedFavorites) plus the
 * generated plan the backend persists (§12) and the diagnostics the §11 gate reads.
 *
 * The Convex conversion in `app/convex/generateWeek.ts` keeps reading the day and
 * slot shape it reads today; `generatedPlan` and `diagnostics` are additive.
 */
export interface GeneratedWeekV6 extends GeneratedWeek {
  /** Every (day, meal, dishId) the engine placed, persisted with the week so §3.1's replay can run. */
  generatedPlan: Pick[];
  diagnostics: V6Diagnostics;
}
