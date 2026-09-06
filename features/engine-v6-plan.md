# Phase 9: Engine v6, the development plan

The build plan for `features/engine-v6.md` (round 3). This is the phase spec in the sense of the
playbook (`~/Downloads/AI Products/DEVELOPMENT-PLAYBOOK.md` §3.3) and the document a session reads
on "Begin development. We are on Phase 9." It carries the outcome, the scope, the branch model,
the stream table with lanes and dependencies, a brief-ready section per stream, the hotspot
ledger, the verification gate, the cutover runbook, and the decisions still owed by Rajat.
Engineers are Opus-level subagents in their own worktrees; the EM spawns every unblocked stream
at once (`docs/development.md` §1, §11).

Read order for the EM at phase start: `CLAUDE.md`, `docs/development.md`, `docs/PLAN.md`, this
file, `features/engine-v6.md`, `coordination/active-streams.md`. Engineers read the same minus the
registry (their brief carries its path), plus the spec sections their stream names.

## 1. Outcome

Production generates each week with the v6 record-matching engine: rate-deficit scheduling over
the household's as-eaten record, plan-then-place generation, one exploration pick a week, a
Saturday-scoped treat, and a fruit slot that admits new in-season fruits when the pool is thin.
The engine is deterministic byte for byte, reads only persisted data, and the §11 gate harness in
the repository passes on the integrated branch (three 60-week self-feeding runs measured on weeks
20 to 60) before the phase merges. The v3 selection code, the seed-history read path, and the
Saturday coin flip are gone from `main`.

## 2. Scope

In scope:

- The v6 engine as new modules under `engine/src/v6/`, with paired tests under `engine/test/v6/`.
- The gate harness (`engine/scripts/gate.ts`, `npm run gate`) and its CI-sized test.
- Backend: the record loader over `currentWeek`, the additive `generatedPlan` field, the switch of
  `generateCurrentWeek` to v6, the Explore feed and picker reading the record, an internal
  mutation to re-point a promoted custom pick, and a read-only record export.
- Content batches to `main`, each reviewed by Rajat personally: soya and tofu deactivation plus
  the `cuisine_neutral` widening salvaged from v4.1; promotion of the six custom one-offs to
  library dishes; Winter fruits; the hummus category if Rajat decides it is a main.
- Cutover and cleanup: deletion of the v3 selection modules, the picker reworked to the v6 head
  order, the CI simulation and property tests replaced by the v6 harness.
- Docs: `docs/engine.md` rewritten wholesale from the spec; `docs/engineering.md` §3, §5, §15
  updated; `docs/engine-as-built.md` archived.

Out of scope, and not to be smuggled in:

- Any frontend change beyond what a type change forces to compile. The PWA renders the same
  `currentWeek` shape it renders today.
- Any prototype dry run before implementation (Rajat's decision, 2026-09-04). The gate runs on the
  built engine.
- `pairsWith`, the favorites dial, fruit-of-the-day removal, day templates, per-family budgets,
  slot-level presence ledgers, a Saturday or breakfast novelty door, and everything else in the
  spec's §13.
- A scheduler for weekly generation (still hand-triggered), and the Swiggy integration.
- Editing `data/menu_history.md` (it stays for provenance, unread).

## 3. Branch model: one integration branch, many short streams

The v4.1 lesson (`features/engine-v4-restart-brief.md` mistakes 4 and 3) is that stream-level
green means nothing for this engine; the integration measurement is the gate. So:

- The EM creates `feat/engine-v6` off freshly fetched `origin/main` at activation. This is the
  **integration branch**. Nothing merges to `main` from it until §7's gate passes.
- Every engine, backend, and docs stream branches off `feat/engine-v6` as
  `feat/<letter>-v6-<short>` and opens its PR **against `feat/engine-v6`**. CI runs on every PR
  whatever it targets (the workflow filter was widened in PR #233).
- Content batches (streams F) branch off `origin/main` as `data/expansion-<n>` and PR to `main`
  directly, because they are independent, Rajat-reviewed, and the engine benefits from having
  them on `main` early. After each content merge the EM runs `git merge origin/main` **into**
  `feat/engine-v6` (a merge commit, never a rebase: the integration branch is shared by every
  stream that based on it, and rebasing a shared branch is the one thing §11.3 forbids).
- Stream PRs into the integration branch follow the normal recipe: rebase onto
  `origin/feat/engine-v6`, `--force-with-lease` your own branch, squash merge, cleanup in the same
  sitting. The later merger owns the rebase.
- The final PR squash-merges `feat/engine-v6` into `main` as one revertable unit, with the gate
  report linked in its diagnosis card. Then the cutover runbook (§8).

Worktrees: `../plantry-<branch>` per stream via `/new-stream`, `npm install && npm run bake` first
in every fresh worktree, `npm run format:check` before every push, the full gate set re-run after
every rebase (`.claude/commands/new-stream.md`).

## 4. Streams

Letters are per feature. "Lane" is the exact set of paths the stream may edit. Dependencies name
the rows whose merge must land in `feat/engine-v6` before the stream's PR can merge; a stream may
start earlier where the contract it needs is fixed in this document (marked "start early").

| Stream | Scope                                                                                                                                                     | Lane (owned paths)                                                                                                                                                                                                                                                                                                     | Depends on                                  | Status                                |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------- |
| 0      | Activation (EM): commit this phase's documents, plan row, orientation pointer, decision entries; archive the v4.1 spec; create the integration branch     | `features/*`, `archive/features/*`, `docs/PLAN.md`, `CLAUDE.md`, `DECISIONS.md`                                                                                                                                                                                                                                        | none                                        | shipped (#239)                        |
| A0     | The v6 type contract, one file, merged first                                                                                                              | `engine/src/v6/types.ts`                                                                                                                                                                                                                                                                                               | 0                                           | merged (#240)                         |
| A      | Record and ledger: record derivation, scopes, per-occasion rates, occupation memory, cold start, accrual, charge, reconciliation, stateless replay        | `engine/src/v6/record.ts`, `engine/src/v6/ledger.ts`, `engine/test/v6/record.test.ts`, `engine/test/v6/ledger.test.ts`, `engine/test/v6/fixtures/record-*.json`                                                                                                                                                        | A0 (start early)                            | merged (#245)                         |
| B      | Pools and plates: role pools per scope, structural and optional fill, the workhorse fallback, every §5 plate form, the day-scoped floor, the prep ceiling | `engine/src/v6/pools.ts`, `engine/src/v6/compose.ts`, `engine/test/v6/pools.test.ts`, `engine/test/v6/compose.test.ts`                                                                                                                                                                                                 | A0 (start early)                            | merged (#247)                         |
| C      | Exploration, favorites pinning, day assignment, constraint pass                                                                                           | `engine/src/v6/exploration.ts`, `engine/src/v6/favoritesPin.ts`, `engine/src/v6/place.ts`, `engine/test/v6/exploration.test.ts`, `engine/test/v6/favoritesPin.test.ts`, `engine/test/v6/place.test.ts`                                                                                                                 | A0 (start early)                            | merged (#246)                         |
| D      | Orchestrator and gate: `generateWeekV6`, engine exports, the harness and its report, the CI-sized gate test                                               | `engine/src/v6/generateWeekV6.ts`, `engine/src/v6/index.ts`, `engine/src/index.ts`, `engine/scripts/gate.ts`, `engine/package.json` (scripts only), `engine/test/v6/generateWeekV6.test.ts`, `engine/test/v6/gate.test.ts`, `engine/test/v6/loadRecordFixture.ts`, `package.json` (scripts only)                       | A, B, C                                     | in progress                           |
| E1     | Backend, part 1: record loader, additive schema field, record export, custom-pick re-point mutation, dev seeding from a record fixture                    | `app/convex/schema.ts`, `app/convex/lib/record.ts`, `app/convex/recordExport.ts`, `app/convex/promoteCustomPick.ts`, `scripts/seed-dev-record.mjs`                                                                                                                                                                     | A0 (start early)                            | merged (#244)                         |
| E2     | Backend, part 2: switch generation, Explore, and the picker to v6 and the record                                                                          | `app/convex/generateWeek.ts`, `app/convex/explore.ts`, `app/convex/swap.ts` (the alternatives query only), `app/convex/lib/archiveHistory.ts` (delete)                                                                                                                                                                 | D, E1                                       | pending                               |
| F1     | Content: deactivate the eight soya and tofu dishes; apply the salvaged `cuisine_neutral` widening patch                                                   | `data/dishes/<the named files>`, `data/changelog.md`                                                                                                                                                                                                                                                                   | none (PR to `main`)                         | shipped (#242)                        |
| F2     | Content: promote the six custom one-offs to library dishes with photos; re-point their prod slots                                                         | `data/dishes/<six new files>`, `data/dish-photos/<six>`, `data/ingredients.md` (rows only), `data/changelog.md`                                                                                                                                                                                                        | E1 for the re-point (PR to `main`)          | shipped (#241); prod re-point pending |
| F3     | Content: Winter fruits                                                                                                                                    | `data/dishes/<new fruit files>`, `data/dish-photos/<new>`, `data/ingredients.md` (rows only), `data/changelog.md`                                                                                                                                                                                                      | Rajat's fruit list (PR to `main`)           | blocked                               |
| F4     | Content: hummus recategorized as a main, if decided                                                                                                       | `data/dishes/hummus.md`, `data/changelog.md`                                                                                                                                                                                                                                                                           | Rajat's decision (PR to `main`)             | blocked                               |
| G      | Docs: `docs/engine.md` rewritten wholesale; `docs/engineering.md` §3, §5, §15; `docs/engine-as-built.md` archived                                         | `docs/engine.md`, `docs/engineering.md`, `docs/engine-as-built.md`, `archive/docs/engine-as-built-v3.md`                                                                                                                                                                                                               | D (merges last into the integration branch) | drafted (#243, draft)                 |
| H      | Cutover and cleanup: delete the v3 selection modules, rework the picker, replace the legacy simulation and property tests, drop the seed read path        | `engine/src/priority.ts`, `engine/src/consolidation.ts`, `engine/src/favorites.ts`, `engine/src/schedule.ts`, `engine/src/composition.ts`, `engine/src/generateWeek.ts`, `engine/src/requests.ts`, `engine/src/explore.ts`, `engine/src/pickerRanking.ts`, `engine/test/*.test.ts` (legacy), `engine/test/loadLive.ts` | D, E2                                       | pending                               |
| I      | Integration PR to `main` and the prod cutover (EM with Rajat's per-action approvals)                                                                      | none (merge and runbook)                                                                                                                                                                                                                                                                                               | D, E2, G, H, F1, F2                         | pending                               |

Waves, so the EM can see the fan-out at a glance:

- **Wave 0 (EM, one sitting):** 0, then A0 (a five-minute engineer PR), then the integration
  branch exists and every early-start stream can spawn.
- **Wave 1 (six worktrees in parallel):** A, B, C, E1, F1, F2 (authoring; its prod re-point waits
  for E1), and G drafting `docs/engine.md` from the spec.
- **Wave 2:** D once A, B, C merge; E2 once D's API is on the integration branch; F3 and F4 the
  moment Rajat's answers arrive.
- **Wave 3:** the gate run (D), any spec amendment and fix cycle, then H, then G's final pass.
- **Wave 4:** I.

## 5. The contract every stream builds against (A0)

`engine/src/v6/types.ts` is the only file streams A, B, C, D, and E1 share, and it ships first
with no behavior. Its shapes are fixed here so that streams can start against the text before the
file merges; A0 may refine field types but must not rename anything below. (A `Map` keyed by a
string is used where a two-part key is needed; the key format is `${dishId}:${scope}`.)

```ts
// engine/src/v6/types.ts
import type { Dish, Season } from "../data/schemas.js";

export type Day = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";
export type MealKey = "breakfast" | "lunch" | "fruit";
/** §2.2 scopes. A dish's ledger, rate, and pool membership are all per scope. */
export type Scope = "weekdayBreakfast" | "weekdayLunch" | "saturday" | "fruit";

/** One as-eaten pick, or one engine placement. Same shape for both. */
export interface Pick {
  day: Day;
  meal: MealKey;
  dishId: number;
}

/** One record week as the backend hands it over (§2.1). Custom picks already removed. */
export interface RecordWeek {
  weekStart: string; // ISO Monday
  picks: Pick[]; // as-eaten, live slot state, custom picks excluded
  skippedDays: Day[];
  generatedPlan: Pick[] | null; // null for weeks written before cutover
}

export interface DishStats {
  eatenCount: Record<Scope, number>;
  rate: Record<Scope, number>; // per occasion (§2.2)
  lastEatenWeek: string | null;
  /** §6 step 5 occupation memory: most recent weekStart per (day, meal), and total count. */
  occupations: Map<string /* `${day}:${meal}` */, { lastWeek: string; count: number }>;
  /** Fruit only: as-eaten rows per season (§2.2). */
  seasonCount: Partial<Record<Season, number>>;
}

export interface RecordStats {
  weeks: number;
  occasions: Record<Scope, number>;
  seasonDayOccasions: Partial<Record<Season, number>>;
  perDish: Map<number, DishStats>;
  /** The swap-away list for the gate's corrected run: dishIds the household removed after generation. */
  swappedOut: Pick[];
}

/** The replayed ledger (§3.1). Immutable snapshots; every operation returns a new ledger. */
export interface Ledger {
  deficits: Map<string /* `${dishId}:${scope}` */, number>;
}

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
export type PickOrigin = "favorite" | "exploration" | "deficit" | "fallback" | "structural";

/** A planned dish before or after day assignment. */
export interface PlanPick extends Pick {
  role: PickRole;
  scope: Scope;
  origin: PickOrigin;
}

export interface GenerateWeekV6Args {
  weekStart: string;
  season: Season;
  library: Dish[];
  record: RecordWeek[]; // every week before weekStart, ascending
  favoriteDishIds: readonly number[]; // createdAt ascending
  /** Test and gate hook only; production passes nothing and the engine derives it (§12). */
  cutoverWeek?: string;
  /** Gate variants (§11). Production passes nothing. */
  variant?: {
    frozenRates?: boolean;
    coldStartCap?: number | "pool";
    seedOptionalPools?: boolean;
    familyGovernor?: boolean;
    rateFormula?: "occasions" | "sinceFirstEaten";
  };
}
```

`GeneratedWeekV6` is the existing `GeneratedWeek` shape (days, slots, dishes in pick order,
`fruit`, `incidents`, `unplacedFavorites`) plus `generatedPlan: Pick[]` and a `diagnostics` object
the gate reads (per-role negative-deficit fills, the exploration pick and its family, the
constraint-pass repairs, days over the prep ceiling). The Convex conversion in
`app/convex/generateWeek.ts` stays as it is for the day and slot shape.

The cutover week is **derived**, not configured: the earliest `weekStart` among record weeks that
carry a `generatedPlan`, or the generating week itself when none does. This is what §12 of the
spec means by the named cutover and it needs no environment variable.

## 6. Stream briefs

Each brief below is what `/new-stream` drops into the worktree, plus the standard contract the
command already carries (lanes, registry path, merge ownership, no CHANGELOG or DECISIONS edits,
install and bake first, format check, adversarial fixtures for locked invariants).

### Stream 0: activation (EM)

- Commit to `main` via a docs PR: `features/engine-v6.md` (round 3), this plan, the rulebook as
  amended, the reviews 1 to 7, both dry runs, `as-eaten-8-weeks.md`, the decision brief, and the
  v5 spec; move `features/engine-v4.md` and `features/engine-v4-restart-brief.md` to
  `archive/features/`; set `docs/PLAN.md` Phase 8 to abandoned and add Phase 9 as building;
  point `CLAUDE.md` "Currently building" at this plan; append the phase-open entry to
  `DECISIONS.md`. Reset `coordination/active-streams.md` (local): clear the v4.1 banner, record the
  integration branch, add the hotspot rows of §7.
- Create `feat/engine-v6` from `origin/main` after that PR lands. Push it.
- Ask Rajat the three approvals in §10 that gate F2, F3, and the v4.1 branch closure.

### Stream A0: the contract

Write `engine/src/v6/types.ts` exactly per §5 with doc comments pointing at spec sections. No
behavior, no exports from `engine/src/index.ts` (stream D owns that file). One PR, merged within
the sitting so wave 1 can rebase onto it.

### Stream A: record and ledger

Spec: §2, §3, §3.1, §10. Pure functions, no I/O.

- `record.ts`: `deriveRecordStats(record: RecordWeek[], library, season): RecordStats`. Scope
  assignment per pick (Saturday lunch is scope `saturday`; Monday to Friday breakfast and lunch
  are the weekday scopes; `fruit` picks are `fruit`). Occasions count non-skipped days per §2.2.
  Rates per occasion. Occupation memory. `lastEatenWeek`. Season counts for fruit with the
  all-season fallback. The swap-away list from `generatedPlan` minus as-eaten picks.
- `ledger.ts`: `seedLedger(stats, cutoverWeek, structuralDishIds, cap)`, `accrue(ledger, stats,
eligibleDishIds, plannedOccasions)`, `charge(ledger, pick)`, `reconcile(ledger, week)`, and
  `replayLedger(record, library, season, cutoverWeek, variant): Ledger` composing them per §3.1.
  Structural-only seeding takes the set of structural-pool dish ids from stream B's pool
  predicates; until B lands, A defines the predicate on the fields the spec names (star pool,
  carb, breakfast main, treat, dessert, fruit) and B reuses it, so there is one definition.
- Fixtures: `record-8weeks.json` built by `engine/test/v6/loadRecordFixture.ts` (stream D owns the
  loader; A ships the JSON, derived by hand from `features/as-eaten-8-weeks.md` with names resolved
  to library ids, custom rows dropped, the four skipped days recorded). A second fixture with
  `generatedPlan` values and a swap-out, for reconciliation.
- Tests that must exist: per-occasion arithmetic on the fixture (fish tikka 7 rows over 36 weekday
  lunch occasions); scope absence (Singapore noodles has no `saturday` rate); a fruit season with
  zero occasions falls back; the cold-start seed is capped at 1 and zero for a companion-only
  dish; a placed-then-swapped-out dish keeps its charge; a swap-in is charged at reconciliation;
  replay is byte-identical across two calls; a week with no `currentWeek` row accrues only; the
  ineligible dish's deficit freezes.

### Stream B: pools and plates

Spec: §3.2, §4, §5 (all subsections), and the carried-forward rules of `docs/engine.md` §3 it
names. Pure functions over `RecordStats`, the ledger, and the library.

- `pools.ts`: one function per role pool, each returning the eligible dishes for a scope with
  their current deficits: breakfast mains (§5.2's definition, Dry dishes admitted, bare carbs
  excluded), the Thursday egg-anchored pool, chutneys, lunch stars (§5.1's definition, Accompaniment
  never a star), companions, carbs (with carb affinity), dry-protein partners, the day-scoped floor
  pool (Keto or Dry dish, HP or Keto, never Gravy or complete meal, soya chunks masala excluded),
  Saturday treats (Saturday scope only), the everyday-base set, desserts, fruit (season scope).
  `fillStructural(pool, placedThisWeek)` implements top-positive-deficit-else-highest-rate-not-
  already-placed; `fillOptional(pool)` implements positive-deficit-or-nothing. The structural-pool
  membership predicate that stream A's seeding uses lives here (A imports it once B merges).
- `compose.ts`: plate builders that take a star (or treat, or breakfast main) and return the
  plate's remaining picks by calling the pools: weekday lunch (standard plate, complete plate,
  carb-forward international with partner), breakfast (main plus dish-driven chutney or
  positive-deficit egg rider, standalone boiled eggs), Saturday (treat plus dessert plus the
  accompaniment or the special protein or the partner), the one-gravy rule, the cross-meal family
  and ingredient demotion, the day-scoped floor, the international ceiling check, the prep ceiling
  repair. Plates carry roles so the cap and the gate can read them.
- Tests that must exist, each with a constructed fixture that would fail without the rule: one
  gravy per lunch with no fallback; a carb-forward international never solo and never with a
  gravy partner; a complete plate takes at most one Accompaniment companion; the floor fires only
  when both meals lack protein, never on Saturday, never with a Gravy dish; a paratha always
  carries a chutney and a sevai never does; standalone boiled eggs carry a chutney; the exhausted
  carb pool falls back to plain roti, not missi roti; a Saturday carb international takes fish
  tikka over raita; Saturday's pool excludes weekday-only complete meals; the prep ceiling drops
  the longest companion and reports an unrepairable day.

### Stream C: exploration, favorites, placement

Spec: §6 steps 2, 3, 5, 6; §7; §8; the family table of `docs/engine.md` §4.6 minus the soya rows.

- `exploration.ts`: the candidate pool (Lunch time, `eatenCount` zero in every scope, Active,
  in-season, not explored-and-uneaten within 8 weeks), the affinity score computed over
  weekday-lunch record rows only, the family governor over the trailing 8 generated weeks (read
  from the record's `generatedPlan` values), and `pickExploration(...)` returning one pick or
  none. The meal-scoped score is also what the Explore surface will use (stream E2 wires it), so
  export a `rankExploreV6(stats, library, season)` beside it.
- `favoritesPin.ts`: §8 pinning, oldest-added first, one slot of the dish's meal type, charged on
  placement, unplaceable reported. Reuse `slotAcceptsDish` from `requests.ts` if it fits; do not
  edit `requests.ts` (stream H owns it).
- `place.ts`: `assignDays(plan, stats)` implementing §6 step 5 with the priority order and the
  exploration pick last; `constraintPass(week, pools, ledger)` implementing §6 step 6 with
  deterministic repairs and the refund-and-charge rule for engine-internal replacements.
- Tests that must exist: egg does not top the lunch affinity when scored on lunch rows; a candidate
  explored and swapped away is not re-proposed for 8 weeks; the governor demotes an at-rate
  family; two favorites land on distinct days and each exactly once, with a third unplaceable one
  reported (the v4.1 finding 3 fixture: two ordinary favorites, not just avocado toast); a
  never-occupied dish does not default to Monday when assigned last; the rice-consecutive repair
  swaps the earliest pair; a cross-meal paneer conflict is resolved by plate swap before
  replacement; a repair refunds the replaced dish.

### Stream D: orchestrator and gate

Spec: §6 as a whole, §10, §11, §12's engine-side contract.

- `generateWeekV6.ts`: the six steps of §6 composed from A, B, C; the `GeneratedWeekV6` output
  including `generatedPlan` and `diagnostics`; the §9 cap as the safety net (reuse `cap.ts`).
  Determinism test: two calls with the same inputs are byte-identical; reversing the library array
  changes nothing.
- `engine/src/v6/index.ts` and the exports from `engine/src/index.ts` (D is the single writer of
  the root index until H).
- `engine/scripts/gate.ts` and `npm run gate` (root and engine `package.json` scripts only): the
  three runs of §11 plus the variants, 60 weeks self-feeding from the record fixture (the prod
  export from E1 when available, the 8-week fixture otherwise), every threshold measured on weeks
  20 to 60 and reported per occasion, output written to `features/engine-v6-gate-report.md` in
  the spec's threshold order with a PASS or FAIL per line and the one-line diagnosis the round-2
  dry run modeled. Stream output as it runs (the subagent watchdog kills a silent 600-second
  command).
- `engine/test/v6/gate.test.ts`: the self-feeding run only, 60 weeks, asserting thresholds 1, 2,
  4, 5, 10 (the ones that are cheap and decisive), so CI holds the line after merge. Keep it under
  a minute.
- `engine/test/v6/loadRecordFixture.ts`: loads a record JSON and resolves it against the baked
  library.

### Stream E1: backend, part 1

Spec: §2.1, §12 backend contract. Everything here is additive and deployable ahead of the engine.

- `app/convex/schema.ts`: `generatedPlan: v.optional(v.array(v.object({ day, meal, dishId:
v.number() })))` on `currentWeek`. Additive; every existing row validates
  (`convex_schema_breaking_change` memory: Convex validates every row on deploy).
- `app/convex/lib/record.ts`: `loadRecord(ctx, beforeWeekStart): Promise<RecordWeek[]>` per §2.1:
  rows with `weekStart < beforeWeekStart` ascending, live slot state to picks, skipped days
  removed, null-dishId picks dropped, `generatedPlan` passed through or null.
- `app/convex/recordExport.ts`: an `internalQuery` returning the `RecordWeek[]` for a read-only
  prod pull (`npx convex run --prod recordExport:exportRecord`), which becomes the gate fixture.
- `app/convex/promoteCustomPick.ts`: an `internalMutation` that re-points one custom pick
  (`weekStart, day, meal, position, dishId`) to a library id without writing a `manualChanges`
  row (it is a data repair, not a household edit), guarded so it only touches a pick whose
  `dishId` is null and whose `customLabel` matches the argument.
- `scripts/seed-dev-record.mjs`: seeds the dev deployment (`lovely-curlew-631`, empty today) from
  a record JSON so a Convex dev smoke of E2 has a record to read.
- Tests: the loader on a seeded dev deployment or a unit fixture; the promote mutation refuses a
  non-custom pick. A Convex dev smoke is required (`new-stream.md` names its two traps: stale
  `app/convex/dist/`, and `.env.local` pointing at an anonymous backend).

### Stream E2: backend, part 2

Spec: §12 backend contract. Lands after D's API is on the integration branch.

- `app/convex/generateWeek.ts`: read the record via `loadRecord`, the favorites, the season; call
  `generateWeekV6`; write the week with `generatedPlan`; keep the incident and unplaced-favorites
  handling. Remove the `rng` and `userRequestedDishId` arguments and the seed-history import.
- `app/convex/explore.ts`: the "never cooked" set and the affinity from the record via
  `rankExploreV6`, not seed plus archive.
- `app/convex/swap.ts` (`getSlotAlternatives` only): pass the record-derived not-placed-this-week
  tier to the reworked picker; the picker itself is stream H's, so E2 lands behind H's picker
  signature or, if H is not yet merged, keeps the old call and H updates it (record the order in
  the hotspot ledger at spawn time).
- Delete `app/convex/lib/archiveHistory.ts` after a repo-wide caller grep (`app/`, `engine/`,
  `scripts/`, `.github/`, the ops docs), listing the grep in the PR body.
- Deploy ordering (`plantry_deploy_ordering` memory): these are internal mutations and queries,
  so no frontend gap; still confirm the `Deploy Convex` action after merge (`convex_module_naming`
  memory: camelCase filenames only).

### Streams F1 to F4: content batches (to `main`, Rajat reviews each PR)

Follow `ADDING-DISHES.md` end to end; each batch is one PR on `data/expansion-<n>` with a
diagnosis card and a `data/changelog.md` entry.

- **F1.** Set `active: No` on Soya pulao, Tandoori soya chunks, Soya matar keema, Thai tofu stir
  fry, Tofu bibimbap, Soyabean curry, Teriyaki tofu rice, Thai red curry tofu (Korean tofu soup is
  already inactive; Soya chunks masala stays Active). Apply `archive/patches/v41-cuisine-neutral-widening.patch` (the `cuisine_neutral` tag on fish
  tikka, fish fry, and three protein salads, salvaged from v4.1 Stream C); stream B's partner-pool
  test guards the pool width, so no validator is ported. Coverage snapshots that move are part of the PR.
- **F2.** Author Dosa, Atta halva, Paneer manchurian, Stuffed capsicum, and Cabbage matar aloo
  (Red sauce pasta exists, id 284); ids from 285; photos via `scripts/generate-dish-photos.mjs`
  (`plantry_dish_photos` memory carries the prompt strategies); `active: Yes` since they are
  household-eaten. Then, with Rajat's per-action approval, run `promoteCustomPick` on prod for
  each of the six custom slots (2026-07-06 Wednesday breakfast Red sauce pasta to 284; 2026-07-20
  Tuesday lunch Paneer manchurian; 2026-08-10 Tuesday lunch Stuffed capsicum, Wednesday lunch
  Cabbage matar aloo, Saturday lunch Dosa and Atta halva) so the record carries them.
- **F3.** Blocked on Rajat's Winter fruit list. Each as a `<Fruit> bowl` dish, Category Fruit,
  `seasons: [Winter]` (or the true span), with photo and ingredient row.
- **F4.** Blocked on Rajat's hummus decision. If a main: Category to Dry dish (it is not HP), and
  nothing else.

### Stream G: docs

- `docs/engine.md` rewritten wholesale from `features/engine-v6.md`, present tense, no history
  seams, section numbering that the module map can pair with (one section per v6 module). The
  §13 parity clause is rewritten to describe the gate harness and the v6 test pairing. Because CI
  requires an `engine/src` and `engine/test` change in the same PR as a `docs/engine.md` change, G's
  PR into the integration branch is the last stream PR and includes a trivial paired test edit if
  nothing else pairs; the integration PR to `main` carries the code anyway.
- `docs/engineering.md`: §3 (the `generatedPlan` field, `weekArchive` as provenance), §5 (the
  generation, Explore, and picker read paths, the two new internal functions), §15 (gate 4 becomes
  the v6 harness; gate 5's Saturday alternation property is gone).
- `docs/engine-as-built.md` moves to `archive/docs/engine-as-built-v3.md`; `CLAUDE.md`'s pointer
  to it is removed by the EM in the activation PR's follow-up, or by G if the EM widens G's lane.

### Stream H: cutover and cleanup

Lands after D and E2, before the integration PR.

- Delete `priority.ts`, `consolidation.ts`, `favorites.ts`, and the menu-form parts of
  `schedule.ts` and `composition.ts`, keeping only the helpers v6 modules import (the HP
  predicates, cuisine-register match, carb affinity, the family table if C did not move it).
  Delete the v3 `generateWeek.ts` and `explore.ts` once nothing imports them; rework
  `requests.ts` to what `favoritesPin.ts` uses or fold it in.
- `pickerRanking.ts`: head ordered by recency tier (not placed this week first) then id; the
  protein-band term removed; the tail unchanged. Update the picker tests.
- Replace `engine/test/simulation.test.ts` with a pointer to the v6 gate test; delete the
  Saturday-alternation property test and the consolidation tests; keep every test for a module
  that survives.
- Drop the `@plantry/engine/history` export path and the bake's `history.ts` emission only if no
  caller remains after the repo-wide grep; otherwise leave the bake and remove the import sites.
- Every removed exported symbol gets the repo-wide caller grep listed in the PR body.

### Stream I: integration and cutover

See §8. EM-run with Rajat's approvals; no engineer.

## 7. Hotspots and merge order

Recorded in `coordination/active-streams.md` at activation; reproduced here so the plan is
self-contained.

| ID  | File(s)                                                | Streams        | Rule                                                                                                     |
| --- | ------------------------------------------------------ | -------------- | -------------------------------------------------------------------------------------------------------- |
| H14 | `engine/src/index.ts`                                  | D, H           | Single writer D until D merges; then H. A, B, C export from their own modules only.                      |
| H15 | `engine/src/v6/types.ts`                               | A0, then A/B/C | A0 owns it. A field addition after A0 is an `EM check needed` note; the EM assigns one stream to add it. |
| H16 | `app/convex/schema.ts`                                 | E1             | E1 only. Additive field.                                                                                 |
| H17 | `data/changelog.md`                                    | F1, F2, F3, F4 | Append-only; merge order F1, F2, F3, F4; the later merger rebases.                                       |
| H18 | `docs/engine.md`, `docs/engineering.md`                | G              | G only; last stream PR into the integration branch.                                                      |
| H19 | `engine/test/loadLive.ts`, legacy `engine/test/*`      | H              | H only. A, B, C, D write under `engine/test/v6/`.                                                        |
| H20 | `app/convex/swap.ts` picker call                       | E2, H          | Whichever merges second updates the call to the other's signature.                                       |
| H21 | `feat/engine-v6` itself                                | all            | Never rebased. `origin/main` is merged into it by the EM after each content batch lands.                 |
| H22 | `docs/CHANGELOG.md`, `DECISIONS.md`, this stream table | EM             | EM-batched docs PRs at checkpoints; engineers describe what shipped in the PR body.                      |

Merge order inside the integration branch: A0; then A, B, C in any order; D; E1 can land any time
after A0; E2 after D; G and H after D and E2 in either order (H20 governs their one overlap); then
the integration PR. Content batches land on `main` in the order F1, F2, F3, F4 and are merged into
the integration branch by the EM as they land.

## 8. Verification and the cutover runbook

**Verification, per stream:** the CI gate set (`docs/engineering.md` §15, as amended by G),
paired tests per module, the adversarial fixture for every locked invariant the stream touches
(one gravy, favorites exactly once, determinism, scope absence, the floor's category
restriction), and a Convex dev smoke for E1 and E2.

**Verification, phase:** `npm run gate` on the integration branch after D, E2, and F1 and F2 have
landed, against the prod record export. Every §11 threshold passes on the self-feeding run, the
frozen run isolates any mechanism bias, the corrected run exercises reconciliation, and the
report is committed as `features/engine-v6-gate-report.md`. A failing threshold follows §11's
order of work: amend the spec first with the measured reason (EM, with Rajat where it is a rule
change), then fix the owning stream, then re-run. A threshold that fails only on the frozen run
is a mechanism bug and blocks; one that fails only on the self-feeding run is drift and is
weighed against threshold 12.

**Cutover runbook (stream I, each prod action with Rajat's per-action approval):**

1. Rebase check on the integration branch: `git merge origin/main`, full gate set green,
   `npm run gate` green on the merged state.
2. Squash-merge `feat/engine-v6` into `main`. Confirm the `Deploy Convex` action succeeded and
   Vercel promoted (the frontend is unchanged; the deploy is a no-op there).
3. Prod read: `recordExport:exportRecord` once more; confirm the six promoted custom picks carry
   library ids and the record week count matches expectations.
4. First v6 generation for the next Monday: `npx convex run --prod
generateWeek:generateCurrentWeek '{"weekStart":"<Monday>"}'`. The cutover week derives from
   this write. Open the PWA, read the week, run the crawl's smoke pass across all tabs.
5. Read the incidents table for the week; every warning is expected or explained.
6. Post-merge hygiene in the same sitting: worktrees removed, branches deleted, registry rows to
   Shipped, local `main` refreshed, CHANGELOG entries, the phase-close checklist once F3 and F4
   have also landed (they are content and do not block the cutover).
7. Slow-loop monitor: the next `/slow-loop` sitting adds the monthly table the spec's §13 refers
   to (family rates per occasion over the trailing 8 served weeks against the record baseline,
   Saturday pool size, Saturday swap-outs, exploration swap-away rate). That is a change to
   `.claude/commands/slow-loop.md` and `MAINTENANCE.md`, queued for `/reconcile-ops` in the
   integration PR's CHANGELOG `Updated:` line.

## 9. Decisions taken in planning (EM, logged in `DECISIONS.md` 2026-09-04)

- **Integration branch, not stacked PRs to `main`.** Stream-level green proved nothing in v4.1;
  the gate needs the integrated engine, and `main` stays releasable throughout.
- **The ledger is replayed, not stored.** A deficit table would need a migration, a repair path,
  and a second source of truth; replay from `currentWeek` plus `generatedPlan` is linear in weeks,
  honors §10, and makes the gate's corrected run production code.
- **The cutover week is derived** from the first `generatedPlan`, not configured.
- **`currentWeek` is the record source, not `weekArchive`.** Finalize is a snapshot the household
  edits past; the as-eaten reconstruction already had to bypass it.
- **New modules under `engine/src/v6/` rather than editing v3 in place.** Disjoint lanes for four
  parallel streams, and a clean deletion in H instead of a tangle of partial edits.
- **Custom-pick re-pointing is an internal mutation without a `manualChanges` row.** It is a data
  repair for the record, not a household edit, and it should not pollute the Changes log.
- **The breakfast Dry retag is not a content task.** The v6 breakfast-main pool admits Dry dishes
  by definition, so four dish files stay untouched.
- **Phase 8 is abandoned, not rewritten.** Its row in `docs/PLAN.md` records the two failed
  cycles; Phase 9 is v6.

## 10. Owed by Rajat before or during the phase

1. **Winter fruits:** the list the household eats (oranges, guava, apple, grapes, chikoo, custard
   apple, strawberry, or others). Unblocks F3.
2. **Hummus as a main, yes or no.** Unblocks F4.
3. **The v4.1 work is closed.** PRs #228 and #229 are closed and the four `feat/*-v41-*` branches
   are deleted, local and remote (Rajat, 2026-09-04). F1 applies the widening from
   `archive/patches/v41-cuisine-neutral-widening.patch` (`git apply`, verified clean against
   main) instead of cherry-picking. Two leftovers can go on Rajat's word: the
   `origin/proto/engine-v4-simulation` branch and the `worktree-agent-af7fdbe04cb7d2290`
   prototype worktree, neither needed by Phase 9.
4. **Per-action prod approvals** as they come up: the record export (E1, and again at cutover),
   the six `promoteCustomPick` runs (F2), the first v6 generation (I).
5. **Content-batch reviews** of F1 to F4 on GitHub, personally, per `docs/development.md` §9.

## 11. Risks and how the plan holds them

- **Interaction defects only the integrated run shows.** Held by the integration branch and the
  gate as the merge condition, with weeks 20 to 60 as the window.
- **A stream implements a spec clause two ways.** Held by A0's shared types, the single
  structural-pool predicate (defined in B, imported by A), and the adversarial fixtures each brief
  names.
- **The gate takes longer than the subagent watchdog allows.** The harness streams progress per
  week; the CI test runs one horizon with a subset of thresholds.
- **A worktree typecheck fails on a stale baked library.** `npm run bake` first in every worktree
  (`plantry_worktree_stale_library_typecheck` memory).
- **A rebase turns a green branch red on formatting.** Full gate set including `format:check`
  after every rebase, as the brief says.
- **Prod approvals arrive late.** Nothing in waves 1 and 2 needs prod; the gate runs on the
  8-week fixture until the export lands; F2's re-point and the cutover are the only prod writes.
- **The record has grown since the reviews.** The plan assumes three or four more served weeks;
  the export at E1 time is the truth, and the gate runs on it.
