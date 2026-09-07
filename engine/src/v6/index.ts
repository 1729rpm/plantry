/**
 * The v6 engine's public surface.
 *
 * Everything the backend, the Explore surface and the §11 gate harness need, and
 * nothing else. The modules behind it stay importable directly for tests and for
 * one another, but a caller outside `engine/src/v6` reaches the engine through
 * this file (and, transitively, through `engine/src/index.ts`, which re-exports
 * it).
 *
 * Section references are to `features/engine-v6.md`.
 */

// §6, §10, §12: the orchestrator and the derived cutover week.
export { generateWeekV6, deriveCutoverWeek, applyRepairsToLedger } from "./generateWeekV6.js";

// §2: the record derivation everything else reads.
export {
  deriveRecordStats,
  deriveOccasionSeries,
  eatenCountIn,
  isFruitAllSeasonFallback,
  rateIn,
  scopeOfPick,
  seasonOfWeek,
  SCOPES,
} from "./record.js";
export type { DeriveRecordStatsOptions, OccasionSeries, WeekOccasions } from "./record.js";

// §3, §3.1: the replayed deficit ledger.
export {
  accrue,
  addWeeks,
  charge,
  deficitIn,
  emptyLedger,
  isEligibleDish,
  reconcile,
  refund,
  replayLedger,
  seedLedger,
  DEFAULT_COLD_START_CAP,
  PLANNED_OCCASIONS,
} from "./ledger.js";
export type { ReplayLedgerArgs } from "./ledger.js";

// §7: exploration, and the affinity ranking the Explore surface shares with it.
export { pickExploration, rankExploreV6, candidatePool, demotedFamilies } from "./exploration.js";
export type {
  ExplorationPick,
  ExploreAffinityKey as ExploreAffinityKeyV6,
  ExploreRankedDishV6,
  NutritionInputs,
  PickExplorationArgs,
  RankExploreV6Options,
} from "./exploration.js";

// §8: favorites pinning.
export { pinFavorites } from "./favoritesPin.js";
export type { PinFavoritesArgs, PinFavoritesResult, PinnedFavorite } from "./favoritesPin.js";

// §3.2, §5: the role pools and the two fill rules.
export {
  buildPool,
  deficitOf,
  excludeIds,
  fillOptional,
  fillStructural,
  fillStructuralWithOrigin,
  isStructuralPoolDish,
  poolProvider,
  rankPool,
  rateOf,
} from "./pools.js";
export type { PoolContext, PoolEntry, PoolProvider, StructuralFill } from "./pools.js";

// §5: the plate builders and the composition rules decided at plate level.
export {
  composeBreakfast,
  composeSaturday,
  composeWeekdayLunch,
  countWeekdayInternationalStars,
  lunchFormFor,
  proteinFamily,
  saturdayFormFor,
  PREP_CEILING_MINUTES,
  WEEKDAY_INTERNATIONAL_STAR_CEILING,
} from "./compose.js";
export type { LunchForm, PrePlacedPick, SaturdayForm } from "./compose.js";

// §6 steps 5 and 6: day assignment and the constraint pass.
export { assignDays, constraintPass, proteinFamilyV6 } from "./place.js";
export type { ConstraintPassArgs, ConstraintPassResult, Plate, Repair } from "./place.js";

// The A0 type contract.
export type {
  ConstraintRepair,
  Day as V6Day,
  DishOccupation,
  DishStats,
  GeneratedWeekV6,
  GenerateWeekV6Args,
  GenerateWeekV6Variant,
  Ledger,
  MealKey,
  Pick as V6Pick,
  PickOrigin,
  PickRole,
  PlanPick,
  PrepCeilingBreach,
  RecordStats,
  RecordWeek,
  Scope,
  V6Diagnostics,
} from "./types.js";
