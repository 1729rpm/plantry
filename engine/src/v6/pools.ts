/**
 * v6 role pools (§3.2, §4, §5).
 *
 * Every plate position in v6 draws from a role pool: a list of the dishes that are
 * eligible for that position, in one scope, ranked by the §3.2 rule (highest
 * deficit first, dish id ascending on ties, nothing else). This module owns the
 * pool predicates and the two fill rules; `compose.ts` owns the plate forms that
 * consume them.
 *
 * Three gates apply to every pool (§3.2):
 *
 * 1. **Eligible**: Active and in season, via the production engine's
 *    `eligibleDishes`, so v6 and v3 agree on what eligible means.
 * 2. **Role**: the pool's own predicate, keyed on the dish's category, tags, time,
 *    cuisine, and carb affinity fields. Never on dish names (§10 and the repo's
 *    standing rule): a name-keyed pool silently changes when a dish is renamed.
 * 3. **Present in the scope** (§2.2): a dish with no as-eaten row in the scope is
 *    absent from that scope's pools, not present at rate zero, so a weekday pasta
 *    never competes for the Saturday treat. The one exception is the §9 fruit
 *    overflow pool, which admits candidates by design.
 *
 * Everything here is pure: no I/O, no clock, no `Math.random`, no mutation of
 * inputs. Every ordering is total and bottoms out at dish id ascending (§10).
 *
 * Section references are to `features/engine-v6.md` (the v6 rules spec, round 3)
 * unless a reference names `docs/engine.md`, which is the production engine's spec
 * and the source of the rules v6 §5 carries forward unchanged.
 */

import type { Dish, DishTag, Season } from "../data/schemas.js";
import { eligibleDishes } from "../eligibility.js";
import {
  breakfastMainCarriesChutney,
  isCuisineNeutral,
  isHp,
  isSelfSufficientMain,
} from "../composition.js";
import type { Ledger, PickRole, RecordStats, Scope } from "./types.js";

/**
 * Everything a pool reads. Assembled once per generation by the orchestrator and
 * passed down unchanged; no pool mutates it.
 */
export interface PoolContext {
  library: readonly Dish[];
  season: Season;
  /** The record's derived statistics (§2.2): scope presence, rates, occupations. */
  stats: RecordStats;
  /** The replayed ledger (§3.1) as it stands for the week being generated. */
  ledger: Ledger;
}

/**
 * One eligible dish in a role pool with its current ledger state.
 *
 * `deficit` is the dish's §3 deficit in the pool's scope and may be negative;
 * `rate` is its §2.2 servings-per-occasion in that scope and is never negative.
 */
export interface PoolEntry {
  dish: Dish;
  deficit: number;
  rate: number;
}

/**
 * How the placement and repair passes ask for ranked alternatives in a role
 * without importing this module's individual pool functions: the orchestrator
 * wires one of these from `poolProvider`.
 */
export type PoolProvider = (
  role: PickRole,
  scope: Scope,
  exclude: ReadonlySet<number>,
) => PoolEntry[];

// ---------------------------------------------------------------------------
// Field predicates
// ---------------------------------------------------------------------------

function hasTag(dish: Dish, tag: DishTag): boolean {
  return dish.tags.includes(tag);
}

/**
 * §5.1 star predicate: HP-tagged, or Category Gravy dish, Keto, or Complete meal.
 * Category Accompaniment is never a star (hummus and the salads included), which
 * is why the exclusion is written first and not left to the category list.
 *
 * Deliberately silent about `time`: §5.1 defines the star pool as "every
 * weekday-scope repertoire dish" that matches, and §2.2 scope presence is what
 * keeps a breakfast dish out of the lunch pool. A dish the household actually eats
 * at weekday lunch belongs in the star pool whatever its `time` field says.
 */
export function isLunchStar(dish: Dish): boolean {
  if (dish.category === "Accompaniment") return false;
  return (
    isHp(dish) ||
    dish.category === "Gravy dish" ||
    dish.category === "Keto" ||
    dish.category === "Complete meal"
  );
}

/**
 * §5.1 lunch companion predicate: the optional third item of a standard plate.
 * Category Gravy dish, Dry dish, or Accompaniment (`docs/engine.md` §3's companion
 * pool). The one-gravy and one-HP rules are applied by `compose.ts` against the
 * plate under construction, not here, because they depend on what the lead took.
 */
export function isLunchCompanion(dish: Dish): boolean {
  return (
    dish.category === "Gravy dish" ||
    dish.category === "Dry dish" ||
    dish.category === "Accompaniment"
  );
}

/**
 * §5.1 plain-protein predicate, shared by three positions that ask for the same
 * thing: the dry protein beside a carb-forward international main, the special
 * protein that elevates an everyday Saturday base (§5.4), and the day-scoped
 * protein floor. An HP or Keto dish in Category Keto or Dry dish, and never a
 * self-sufficient main (a `complete_meal` is a plate, not a protein beside one).
 *
 * Gravy dishes are excluded by the category test, which is also how §5.1's "never
 * a Gravy dish" restriction on the floor is enforced.
 */
export function isPlainProtein(dish: Dish): boolean {
  if (dish.category !== "Keto" && dish.category !== "Dry dish") return false;
  if (isSelfSufficientMain(dish)) return false;
  return isHp(dish) || dish.category === "Keto";
}

/**
 * §5.2 bare-carb predicate: a Category Bread or Paratha dish without the
 * `complete_carb` tag (Toast, Plain paratha, Thepla). A bare carb is not a
 * breakfast main and belongs to no v6 pool at all, so it has no ledger, never
 * accrues, and stays reachable only by an in-week swap (§3).
 */
export function isBareBreakfastCarb(dish: Dish): boolean {
  return (
    (dish.category === "Bread" || dish.category === "Paratha") && !hasTag(dish, "complete_carb")
  );
}

/**
 * §5.2 breakfast-main predicate: a Breakfast-time dish that is not a Category
 * Accompaniment (those are the chutneys) and not a bare carb. Breakfast-time Dry
 * dishes (anda bhurji, paneer bhurji, and their kin) are mains in this pool with
 * no retagging, which is why §13 records the breakfast Dry-dish retag as not
 * needed.
 *
 * Category Fruit and Dessert are excluded because §9 makes the fruit of the day
 * its own meal, outside the breakfast plate; the fruit bowls carry Time Breakfast
 * only because every library dish must carry a time.
 */
export function isBreakfastMain(dish: Dish): boolean {
  if (dish.time !== "Breakfast") return false;
  if (dish.category === "Accompaniment") return false;
  if (dish.category === "Fruit" || dish.category === "Dessert") return false;
  return !isBareBreakfastCarb(dish);
}

/**
 * §5.2 breakfast chutney predicate: Category Accompaniment, Time Breakfast. The
 * chutney is dish-driven only (§13 retired the optional chutney slot), so this
 * pool is read only when the main carries one.
 */
export function isBreakfastChutney(dish: Dish): boolean {
  return dish.time === "Breakfast" && dish.category === "Accompaniment";
}

/**
 * §5.2 standalone egg main: the form where boiled eggs are the breakfast main and
 * a chutney is the only thing beside them. Keyed on Time Breakfast plus Category
 * Keto plus the HP tag (the fields that make a dish a plain breakfast protein),
 * never on the dish name.
 */
export function isStandaloneEggMain(dish: Dish): boolean {
  return dish.time === "Breakfast" && dish.category === "Keto" && isHp(dish);
}

/**
 * True when the dish itself carries the day's protein: HP-tagged or Category Keto.
 * Read by the §5.1 day-scoped floor (a breakfast whose main or small item is such a
 * dish satisfies the day) and by §5.2's egg-rider rule (a main that already carries
 * protein takes no rider).
 */
export function carriesProtein(dish: Dish): boolean {
  return isHp(dish) || dish.category === "Keto";
}

/**
 * §5.1 carb predicate: Category Rice or Chapati, the two plain lunch carb pools
 * that carb affinity chooses between (`docs/engine.md` §3.1).
 */
export function isLunchCarb(dish: Dish): boolean {
  return dish.category === "Rice" || dish.category === "Chapati";
}

/**
 * The carb category a lead asks for (`docs/engine.md` §3.1 carb affinity):
 * `carbAffinity: Rice` sends the position to the plain Category Rice pool, `Roti`
 * to Category Chapati, and an absent field leaves the default, Chapati. Keyed on
 * the field, never on the dish name.
 */
export function carbCategoryForLead(lead: Dish): "Rice" | "Chapati" {
  return lead.carbAffinity === "Rice" ? "Rice" : "Chapati";
}

/**
 * §5.3 international star: a non-Indian dish that can lead a weekday lunch. This
 * is what the weekly ceiling of two weekday international stars counts; the
 * ceiling itself is enforced by the caller. Keyed on the `cuisine` field and the
 * star categories, never on names.
 */
export function isInternationalStar(dish: Dish): boolean {
  return dish.cuisine !== "Indian" && isLunchStar(dish);
}

/**
 * §5.1 carb-forward international main: the noodle, pasta, and fried-rice register
 * that takes exactly one dry protein and nothing else. Keyed on `cuisine !==
 * "Indian"` plus the self-sufficient-main signal (Category Complete meal or the
 * `complete_meal` tag), which is the carb-forward category in the library: a
 * non-Indian main whose carb is built into the dish. The true complete plates of
 * §5.1's other clause (biryani, pav bhaji, chole bhature, dosa, khichdi, pulao)
 * are Indian, so the cuisine test separates the two forms without naming a dish.
 */
export function isCarbForwardInternational(dish: Dish): boolean {
  return dish.cuisine !== "Indian" && isSelfSufficientMain(dish);
}

/**
 * §5.4 everyday base: the khichdi and pulao class, an ordinary weekday plate that
 * a special protein beside it elevates into a Saturday treat. Keyed on the
 * self-sufficient-main signal plus Indian cuisine plus the absence of the HP tag
 * (an HP pulao already carries its own protein and needs no elevation), never on
 * the dish name.
 */
export function isEverydayBase(dish: Dish): boolean {
  return isSelfSufficientMain(dish) && dish.cuisine === "Indian" && !isHp(dish);
}

/**
 * The soya protein family, per `docs/engine.md` §4.6. §5.1 and §13 hold that soya
 * chunks masala's HP tag does not satisfy the day's protein floor: it is an
 * occasional homely veg main that counts as a sabzi, never as the day's protein.
 *
 * Expressed as a data-driven predicate on `primaryIngredient` (the §4.6 family
 * label) rather than by dish id, so it holds for every soya dish the library
 * carries now or later. Note that the floor pool's Category restriction already
 * excludes soya chunks masala, which is a Gravy dish; this predicate keeps the
 * rule true if a soya dish is ever recategorised.
 */
const SOYA_PRIMARY_INGREDIENTS = new Set(["Soyabean Chunk", "Soya Chunk", "Soyabean", "Soya"]);

export function isSoyaProtein(dish: Dish): boolean {
  return SOYA_PRIMARY_INGREDIENTS.has(dish.primaryIngredient);
}

/**
 * §3 structural-pool membership: the single definition, used by the cold start to
 * decide which dishes are seeded by backdated accrual and which start at zero.
 *
 * A dish is in a structural pool when it can fill a position the plate structurally
 * requires: a lunch star, a lunch carb, a breakfast main, a Saturday treat, a
 * dessert, or a fruit. Dishes that only ever fill optional slots (companions,
 * breakfast small items, Saturday accompaniments) are not, and neither are bare
 * breakfast carbs, which belong to no pool at all.
 *
 * Saturday treats need no clause of their own: a treat is whatever the record shows
 * the household ate as a Saturday main, and every dish that can lead a plate is
 * already a lunch star or an everyday base (itself a Category Complete meal dish,
 * so also a star). Membership here is deliberately scope-blind, because the cold
 * start seeds a dish, not a (dish, scope) pair.
 */
export function isStructuralPoolDish(dish: Dish): boolean {
  return (
    isLunchStar(dish) ||
    isLunchCarb(dish) ||
    isBreakfastMain(dish) ||
    dish.category === "Dessert" ||
    dish.category === "Fruit"
  );
}

// ---------------------------------------------------------------------------
// Pool construction
// ---------------------------------------------------------------------------

/**
 * The §3.2 eligibility gate, Active and in season, reused from the production
 * engine so both engines agree on what eligible means. `eligibleDishes` reads only
 * `library` and `season`; its `history` and `slot` parameters are vestigial (it
 * filters on neither), so v6 passes an empty history and a fixed slot.
 */
const ELIGIBILITY_SLOT = { day: "Mon", meal: "Lunch" } as const;

function eligible(ctx: PoolContext): Dish[] {
  return eligibleDishes({
    library: [...ctx.library],
    history: [],
    season: ctx.season,
    slot: ELIGIBILITY_SLOT,
  });
}

/** The §3 deficit of a dish in a scope. An absent key means no ledger, read as zero. */
export function deficitOf(ledger: Ledger, dishId: number, scope: Scope): number {
  return ledger.deficits.get(`${dishId}:${scope}`) ?? 0;
}

/** The §2.2 rate of a dish in a scope. A dish with no record entry reads as zero. */
export function rateOf(stats: RecordStats, dishId: number, scope: Scope): number {
  return stats.perDish.get(dishId)?.rate[scope] ?? 0;
}

/** §2.2 scope presence: the dish has at least one as-eaten row in this scope's slots. */
function presentInScope(stats: RecordStats, dishId: number, scope: Scope): boolean {
  const dish = stats.perDish.get(dishId);
  return dish !== undefined && dish.eatenCount[scope] > 0;
}

/** §9 season presence: the fruit has at least one as-eaten row in this season. */
function presentInSeason(stats: RecordStats, dishId: number, season: Season): boolean {
  return (stats.perDish.get(dishId)?.seasonCount[season] ?? 0) > 0;
}

/**
 * The §3.2 ranking: highest deficit first, dish id ascending on ties, nothing else.
 * Explicit and total, so input order never leaks into a menu (§10).
 */
export function rankPool(entries: readonly PoolEntry[]): PoolEntry[] {
  return [...entries].sort((a, b) => b.deficit - a.deficit || a.dish.id - b.dish.id);
}

/**
 * Build one ranked role pool: eligible dishes matching `predicate` that are present
 * in `scope`, each carrying its deficit and rate in that scope.
 */
export function buildPool(
  ctx: PoolContext,
  scope: Scope,
  predicate: (dish: Dish) => boolean,
): PoolEntry[] {
  const entries: PoolEntry[] = [];
  for (const dish of eligible(ctx)) {
    if (!predicate(dish)) continue;
    if (!presentInScope(ctx.stats, dish.id, scope)) continue;
    entries.push({
      dish,
      deficit: deficitOf(ctx.ledger, dish.id, scope),
      rate: rateOf(ctx.stats, dish.id, scope),
    });
  }
  return rankPool(entries);
}

// ---------------------------------------------------------------------------
// Role pools
// ---------------------------------------------------------------------------

/** §5.2 breakfast mains for a scope (the weekday breakfast scope in production). */
export function breakfastMainPool(
  ctx: PoolContext,
  scope: Scope = "weekdayBreakfast",
): PoolEntry[] {
  return buildPool(ctx, scope, isBreakfastMain);
}

/**
 * §4 anchor 2, the Thursday egg-anchored breakfast pool: an egg-family main, or a
 * light grain main that will carry boiled eggs as its small item.
 *
 * "Light grain main" is keyed on fields, not on the spec's examples: a breakfast
 * main that carries no protein of its own and does not already carry a chutney
 * (§5.2 allows one small item, so a chutney carrier has no room for the eggs).
 * Sevai, upma, sabudana khichdi, poha, and masala oats qualify; a chilla or paratha
 * does not, unless it is itself an egg dish, in which case the first clause admits
 * it and the eggs are unnecessary.
 */
export function thursdayEggBreakfastPool(
  ctx: PoolContext,
  proteinFamily: (primaryIngredient: string) => string,
  scope: Scope = "weekdayBreakfast",
): PoolEntry[] {
  return buildPool(ctx, scope, (dish) => {
    if (!isBreakfastMain(dish)) return false;
    if (proteinFamily(dish.primaryIngredient) === "Egg") return true;
    return !carriesProtein(dish) && !breakfastMainCarriesChutney(dish);
  });
}

/** §5.2 breakfast chutneys: Category Accompaniment, Time Breakfast. */
export function breakfastChutneyPool(
  ctx: PoolContext,
  scope: Scope = "weekdayBreakfast",
): PoolEntry[] {
  return buildPool(ctx, scope, isBreakfastChutney);
}

/**
 * §5.2 breakfast egg riders: the boiled-eggs-class protein that rides beside a
 * light grain main. Keyed on Time Breakfast plus Category Keto plus HP, the same
 * fields as the standalone egg main.
 */
export function breakfastEggRiderPool(
  ctx: PoolContext,
  scope: Scope = "weekdayBreakfast",
): PoolEntry[] {
  return buildPool(ctx, scope, isStandaloneEggMain);
}

/** §5.1 lunch stars for a scope. */
export function lunchStarPool(ctx: PoolContext, scope: Scope = "weekdayLunch"): PoolEntry[] {
  return buildPool(ctx, scope, isLunchStar);
}

/** §5.1 lunch companions for a scope, before the plate's own gravy and HP filters. */
export function lunchCompanionPool(ctx: PoolContext, scope: Scope = "weekdayLunch"): PoolEntry[] {
  return buildPool(ctx, scope, isLunchCompanion);
}

/**
 * The carb pool a lead asks for (`docs/engine.md` §3.1).
 *
 * On an Indian plate, carb affinity chooses between the plain Rice and Chapati
 * pools. On an international plate the form takes no Indian carb, with the one
 * exception `docs/engine.md` §3.1 names: a `carbAffinity: Rice` anchor (a Thai,
 * Korean, or Chinese curry) takes a register-neutral steamed rice, a Category Rice
 * dish carrying the `cuisine_neutral` tag. `Roti` affinity never applies on an
 * international plate, so a non-Indian lead without Rice affinity gets an empty
 * pool and its plate composes without a carb.
 */
export function carbPoolForLead(
  ctx: PoolContext,
  lead: Dish,
  scope: Scope = "weekdayLunch",
): PoolEntry[] {
  if (lead.cuisine !== "Indian") {
    if (lead.carbAffinity !== "Rice") return [];
    return buildPool(ctx, scope, (d) => d.category === "Rice" && isCuisineNeutral(d));
  }
  const category = carbCategoryForLead(lead);
  return buildPool(ctx, scope, (d) => d.category === category);
}

/** Every lunch carb in a scope, both affinity pools ranked together. */
export function carbPool(ctx: PoolContext, scope: Scope = "weekdayLunch"): PoolEntry[] {
  return buildPool(ctx, scope, isLunchCarb);
}

/**
 * §5.1 dry-protein partners: the one protein a carb-forward international main
 * takes, in a grilled, tikka, or dry-fry preparation.
 *
 * The pool is keyed on tag and category (`isPlainProtein`), with no cuisine-register
 * filter: §5.1 states the rule without one, and §5.4 records the household pairing
 * a Thai pineapple fried rice with an Indian fish tikka. The `cuisine_neutral` tag
 * therefore widens this pool through the data alone once the content batch lands,
 * with no change here.
 */
export function dryProteinPartnerPool(
  ctx: PoolContext,
  scope: Scope = "weekdayLunch",
): PoolEntry[] {
  return buildPool(ctx, scope, isPlainProtein);
}

/**
 * §5.1 day-scoped protein floor pool: a plain protein, Category Keto or Dry dish,
 * never a Gravy dish and never a complete meal (both excluded by `isPlainProtein`),
 * and never a soya dish (§13: soya chunks masala's HP tag does not satisfy the
 * floor).
 */
export function proteinFloorPool(ctx: PoolContext, scope: Scope = "weekdayLunch"): PoolEntry[] {
  return buildPool(ctx, scope, (d) => isPlainProtein(d) && !isSoyaProtein(d));
}

/**
 * §5.4 Saturday treats, Saturday-scoped: every eligible dish the record shows eaten
 * as a Saturday main, competing on its Saturday rate. Scope presence is the whole
 * gate, which is what keeps a weekday-only complete meal out of the treat pool.
 */
export function saturdayTreatPool(ctx: PoolContext): PoolEntry[] {
  return buildPool(ctx, "saturday", isLunchStar);
}

/**
 * §5.4 everyday bases: the khichdi and pulao class that a special protein elevates.
 *
 * Scoped to the weekday lunch record, not to Saturday, deliberately: the form's
 * whole point is that an *everyday* plate is lifted onto Saturday, so requiring a
 * Saturday row would close the door the clause opens.
 */
export function everydayBasePool(ctx: PoolContext): PoolEntry[] {
  return buildPool(ctx, "weekdayLunch", isEverydayBase);
}

/**
 * §5.4 special proteins: the plain protein that sits beside an everyday Saturday
 * base and takes the accompaniment's place on the plate.
 */
export function specialProteinPool(ctx: PoolContext): PoolEntry[] {
  return buildPool(ctx, "saturday", isPlainProtein);
}

/** §5.4 Saturday accompaniments: the optional third item when no protein takes its place. */
export function saturdayAccompanimentPool(ctx: PoolContext): PoolEntry[] {
  return buildPool(ctx, "saturday", (d) => d.category === "Accompaniment");
}

/** §5.4 desserts, structural on every Saturday. */
export function dessertPool(ctx: PoolContext, scope: Scope = "saturday"): PoolEntry[] {
  return buildPool(ctx, scope, (d) => d.category === "Dessert");
}

/**
 * §9 fruit repertoire pool for the current season: Active, in-season Category Fruit
 * dishes the record shows eaten in this season, ranked by their season-scoped
 * deficit. Season presence, not scope presence, is the gate, so a Monsoon fruit
 * does not lead a Winter week on last season's rows.
 */
export function fruitPool(ctx: PoolContext): PoolEntry[] {
  const entries: PoolEntry[] = [];
  for (const dish of eligible(ctx)) {
    if (dish.category !== "Fruit") continue;
    if (!presentInSeason(ctx.stats, dish.id, ctx.season)) continue;
    entries.push({
      dish,
      deficit: deficitOf(ctx.ledger, dish.id, "fruit"),
      rate: rateOf(ctx.stats, dish.id, "fruit"),
    });
  }
  return rankPool(entries);
}

/**
 * §9 fruit overflow pool: when every fruit in the season's repertoire pool has a
 * non-positive deficit, the day's fruit is drawn by least-recently-served from every
 * Active, in-season Category Fruit dish, candidates included, never-served counting
 * as oldest.
 *
 * This is the one pool that admits candidates. It is ordered by
 * `lastEatenWeek` ascending (never eaten first), then by dish id ascending, and the
 * entries carry their deficits and rates so the caller can report the fill.
 */
export function fruitOverflowPool(ctx: PoolContext): PoolEntry[] {
  const entries: Array<PoolEntry & { lastEatenWeek: string | null }> = [];
  for (const dish of eligible(ctx)) {
    if (dish.category !== "Fruit") continue;
    entries.push({
      dish,
      deficit: deficitOf(ctx.ledger, dish.id, "fruit"),
      rate: rateOf(ctx.stats, dish.id, "fruit"),
      lastEatenWeek: ctx.stats.perDish.get(dish.id)?.lastEatenWeek ?? null,
    });
  }
  entries.sort((a, b) => {
    if (a.lastEatenWeek === b.lastEatenWeek) return a.dish.id - b.dish.id;
    if (a.lastEatenWeek === null) return -1;
    if (b.lastEatenWeek === null) return 1;
    return a.lastEatenWeek < b.lastEatenWeek ? -1 : 1;
  });
  return entries.map(({ dish, deficit, rate }) => ({ dish, deficit, rate }));
}

// ---------------------------------------------------------------------------
// Fill rules (§3.2)
// ---------------------------------------------------------------------------

/**
 * Why a structural slot was filled: by a positive deficit, or by §3.2's workhorse
 * fallback. The orchestrator counts the fallbacks into `V6Diagnostics`.
 */
export interface StructuralFill {
  entry: PoolEntry;
  origin: "deficit" | "fallback";
}

/**
 * §3.2 structural fill, reporting which rule fired.
 *
 * A structural slot is always filled. When at least one dish in the pool has a
 * positive deficit, the top deficit wins. When every deficit is negative or zero,
 * the slot goes to the highest-rate dish in the pool not already placed this week,
 * ties by id: the thing the household eats most is what the plate reaches for when
 * nothing is due. An empty pool fills nothing.
 *
 * The not-already-placed condition applies to the fallback only. The positive-deficit
 * branch needs no such guard because a placement charges the dish a full serving, so
 * a second same-week win requires a deficit above one, which only high-rate staples
 * reach (§3, the built-in repeat guard).
 */
export function fillStructuralWithOrigin(
  pool: readonly PoolEntry[],
  placedThisWeek: ReadonlySet<number>,
): StructuralFill | null {
  if (pool.length === 0) return null;
  const ranked = rankPool(pool);
  const top = ranked[0];
  if (top.deficit > 0) return { entry: top, origin: "deficit" };
  const unplaced = ranked.filter((entry) => !placedThisWeek.has(entry.dish.id));
  const workhorsePool = unplaced.length > 0 ? unplaced : ranked;
  let best = workhorsePool[0];
  for (const entry of workhorsePool) {
    if (entry.rate > best.rate || (entry.rate === best.rate && entry.dish.id < best.dish.id)) {
      best = entry;
    }
  }
  return { entry: best, origin: "fallback" };
}

/** §3.2 structural fill. See `fillStructuralWithOrigin` for the rule. */
export function fillStructural(
  pool: readonly PoolEntry[],
  placedThisWeek: ReadonlySet<number>,
): PoolEntry | null {
  return fillStructuralWithOrigin(pool, placedThisWeek)?.entry ?? null;
}

/**
 * §3.2 optional fill: the top dish only when its deficit is positive, otherwise
 * nothing and the plate stays smaller. This is how "ceilings, never targets" becomes
 * mechanism: plate sizes are metered by the record's own companion rates instead of
 * being filled to a budget.
 */
export function fillOptional(pool: readonly PoolEntry[]): PoolEntry | null {
  if (pool.length === 0) return null;
  const top = rankPool(pool)[0];
  return top.deficit > 0 ? top : null;
}

/** Drop excluded dish ids from a ranked pool, preserving the ranking. */
export function excludeIds(pool: readonly PoolEntry[], exclude: ReadonlySet<number>): PoolEntry[] {
  return pool.filter((entry) => !exclude.has(entry.dish.id));
}

// ---------------------------------------------------------------------------
// The provider
// ---------------------------------------------------------------------------

/**
 * Build the callback the placement and repair passes use to ask for ranked
 * alternatives in a role and scope, minus a set of excluded ids.
 *
 * The `carb` role returns both affinity pools ranked together, because a repair is
 * looking for any workable carb rather than the one a particular lead's affinity
 * asks for; a plate's own carb position uses `carbPoolForLead`, which honours the
 * affinity. The `breakfast-small` role returns the chutneys and the egg riders
 * together, the two things §5.2 allows in that position.
 */
export function poolProvider(ctx: PoolContext): PoolProvider {
  return (role, scope, exclude) => excludeIds(poolForRole(ctx, role, scope), exclude);
}

function poolForRole(ctx: PoolContext, role: PickRole, scope: Scope): PoolEntry[] {
  switch (role) {
    case "breakfast-main":
      return breakfastMainPool(ctx, scope);
    case "breakfast-small":
      return rankPool([...breakfastChutneyPool(ctx, scope), ...breakfastEggRiderPool(ctx, scope)]);
    case "star":
      return lunchStarPool(ctx, scope);
    case "carb":
      return carbPool(ctx, scope);
    case "companion":
      return lunchCompanionPool(ctx, scope);
    case "floor":
      return proteinFloorPool(ctx, scope);
    case "partner":
      return dryProteinPartnerPool(ctx, scope);
    case "treat":
      return saturdayTreatPool(ctx);
    case "special-protein":
      return specialProteinPool(ctx);
    case "accompaniment":
      return saturdayAccompanimentPool(ctx);
    case "dessert":
      return dessertPool(ctx, scope);
    case "fruit":
      return fruitPool(ctx);
  }
}
