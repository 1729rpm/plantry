# Engine v4: frequency-first selection, simplified templates

Status: **v4.1 ACTIVE. Build against §10, not §3.** Approved 2026-08-11, falsified by prototype simulation 2026-08-17, amended the same day. The eleven defects (D1 to D9 in §8 from the simulation and evaluators, D10 to D11 in §9 from Rajat's review) are all resolved in §10, which supersedes §3 wherever they disagree. §3 to §7 are retained unedited as the record of what was wrong; do not implement them.

**No behaviour-changing stream in this phase merges until the §10.8 verification gate passes.** The gate scopes to streams A, B and C, which change what the engine generates. This activation PR lands documentation only and touches no code path, so it is outside the gate; it has to land first for the gate to exist.

This document describes the target rule engine in full. On implementation it supersedes the matching sections of `docs/engine.md`; each stream pairs its `docs/engine.md` edits with `engine/src/` and `engine/test/` changes per the §13 parity rule. Sections of the current engine not named here (§5 picker ranking, §6 requested dishes, §7 explore ranking, §8 skipped days, §11 nutrition and reports, §13 parity) are unchanged.

## 1. Why v4

Reconstruction from the eaten record (six finalized in-app weeks 2026-06-22 to 2026-08-03, five seed weeks, 168 real manual-change entries), adversarially reviewed by a simplicity-vs-coverage debate. Full analysis: https://claude.ai/code/artifact/087e4d3a-be41-4344-98b6-f8e48e03d506

The findings that drive the design:

- The household eats a concentrated repertoire of roughly 40 dishes out of 250 active. Longest-unused ranking proposes the dish avoided longest, which is an anti-preference chooser for this household; it is the root cause of the weekly swap churn.
- Lunch sizes: of 34 finalized lunches, 18 had 3 items, 8 had 2, 6 had 1, and only 2 had 4. The Tue/Thu 4-item plate never survived. The two 4-item survivors were both dal-plus-sabzi thalis.
- Exactly one HP dish per lunch held in 28 of 34; one gravy per lunch in 31 of 34 (all three exceptions hand-built).
- International lunches ran about 2 per week, early-week, usually one standalone dish plus a plain protein side the household added by hand.
- Fruit is the most-edited slot class; every edit moved toward the same few fruits (mango first). Longest-unused is exactly backwards there.
- Stable dish pairings recur (fish tikka with kadhi on three near-identical Thursdays; chole with raita; keema with pav). These are data, not new machinery.

## 2. Decisions taken (Rajat, 2026-08-11)

- D1: one exploration slot per week, not two.
- D2: weight hand-placed dishes double in the frequency count, as phase 2. Prerequisite: archive history rows must carry per-dish source (generated vs hand-placed), an additive schema change wired through finalize. V4 ships plain frequency-first.
- D3: frequency window is the 10 most recent week-records in history, not season-scoped. Revisit at the October season change.

## 3. The target engine

### 3.1 Pool

A dish is eligible if Active=Yes and its Seasons include the current Bangalore season (unchanged). Weekday lunch and breakfast pools additionally exclude `complexity: Hard`; Hard dishes remain reachable through swaps, Explore, and the wishlist.

Fields the rules read: time, category, tags (HP, complete_meal, complete_carb, fruit, cuisine_neutral), cuisine, carbAffinity, primaryIngredient (protein-family normalized, current §4.6 table), complexity, and the new optional `pairsWith` (below). Satiety and prepMinutes are no longer rule inputs.

### 3.2 Day templates

| Day      | Fruit  | Breakfast               | Lunch                                                    |
| -------- | ------ | ----------------------- | -------------------------------------------------------- |
| Mon, Tue | 1      | 1 main (+ attach rules) | Standalone plate, 1 to 2 items                           |
| Wed-Fri  | 1      | 1 main (+ attach rules) | Indian plate, 3 items (4 on a dal thali)                 |
| Sat      | 1      | (none)                  | Complete meal + protein side + raita-or-dessert, 3 items |
| Sun      | (none) | (none)                  | (none)                                                   |

- **Breakfast, uniform Mon-Fri.** One main from the breakfast pool (tags complete_meal or complete_carb). Attach rules: a Chilla or Paratha main carries one breakfast chutney; a main with no HP tag gains one HP Keto side (boiled-eggs class); a Category=Bread main serves alone. The Mon/Wed/Fri vs Tue/Thu asymmetry and the Option B/C forms are retired.
- **Standalone plate (Mon, Tue).** One standalone lead: a dish with the complete_meal tag or Category=Complete meal, or a non-Indian anchor (Gravy, Dry, Keto). The two leads prefer distinct cuisines. A non-HP, non-Keto lead takes one cuisine-neutral protein side (plate rule 2 below); an HP or Keto anchor may take one same-cuisine-or-neutral non-HP veg side; otherwise the lead serves alone. A rice-affinity anchor takes the neutral steamed-rice carb under the rice-spacing rule. Fixed days are a deliberate simplification: the eaten record puts standalone lunches overwhelmingly on Mon/Tue/Wed, and a fixed slot is predictable; a third standalone day is one swap away. The substitution selection and coexistence machinery of the current §3.2 is retired.
- **Indian plate (Wed, Thu, Fri).** One protein lead (HP or Keto, Indian cuisine) + one carb picked by the lead's carbAffinity + one companion from the non-HP Indian pool (Gravy, Dry, Accompaniment). When the companion is a Gravy (a dal), one additional Dry companion is allowed, matching the only observed 4-item plates. The Menu 1 vs Menu 2 distinction (HP day vs Keto day) is retired; the lead pool is HP-or-Keto and selection (3.4) decides.
- **Saturday.** One complete-meal lead + one cuisine-neutral protein side + one Accompaniment or Dessert. The Menu 3/4 alternation is retired.
- **Fruit.** One per day Mon-Sat, own section, outside all caps (unchanged mechanics; new ranking in 3.4).

### 3.3 Plate rules

1. **One gravy per lunch.** Hard, no fallback (unchanged).
2. **Lunch protein floor.** Every lunch carries an HP or Keto dish. A non-HP standalone lead takes one cuisine-neutral protein side by default, placed by the engine, regardless of what breakfast carried. An empty floor pool leaves the plate and writes a warn incident (unchanged mechanics, now also covering the standalone form by default rather than by fallback).
3. **Standalone dishes otherwise serve alone.** A complete_meal fills its slot; no carb, no accompaniment beyond rules 2 and 7.
4. **Rice spacing.** A Category=Rice carb never lands on consecutive days (unchanged).
5. **One cuisine register per plate.** Indian plates compose Indian dishes; a standalone plate composes its lead's cuisine plus cuisine_neutral dishes (unchanged principle, simpler carrier).
6. **Same-day protein-family dedup.** A lunch candidate whose protein family matches the same day's breakfast main is deprioritised; the repeat is allowed when no viable alternative exists (current §4 step 2, kept on the strength of the household enforcing it by hand).
7. **pairsWith.** When a placed lead names a partner, that partner leads its slot's companion pool, subject to rules 1 and 2. Initial data: fish tikka + kadhi; soya chunks masala + vegetable korma; toor dal and moong dal + a dry sabzi; chole + raita; palak paneer + missi roti; mutton keema + pav.
8. **One HP source per meal.** Kept from the current engine with its thin-pool fallback; the protein side of rule 2 is the meal's HP source when it fires.

### 3.4 Selection

For each slot position, rank the composition-eligible candidates:

1. **Favorites pinning.** Every library favorite is pinned into one slot per week (current §4 step 4 mechanics, unchanged), extended by an optional `timesPerWeek` field on a favorite (1 or 2, capped at 2). A value of 2 enters the favorite into the pinning pass twice; the two placements are exempt from within-week no-repeat against each other; composition locks always win; a shortfall logs through the existing unplacedFavorites path. All dials at 1 is byte-identical to plain pinning.
2. **Frequency-first ranking.** Candidates order by eaten-count descending over the 10 most recent week-records in history (seed file plus weekArchive, skip-aware). Proven dishes lead; a dish the household stops keeping decays out of the top within the window. Phase 2 (D2) weights hand-placed appearances double once history rows carry source.
3. **7-day repeat guard.** A candidate cooked within the last 7 days is excluded. Exempt roles: lunch carbs (Chapati, Rice), fruit, and the rule-2 protein side. If the guard empties a pool, it relaxes for that pool so the slot fills.
4. **Within-week no-repeat.** As today, with the same exemptions as the guard plus dialed-favorite placements per step 1.
5. **Tiebreaks.** Longest unused, then dish id ascending. Deterministic, no RNG (unchanged principle).

**Exploration slot (one per week, D1).** The companion position of Friday's Indian plate ranks by pure longest-unused with never-cooked first, instead of steps 2 and 3. One deliberately novel, low-stakes position per week; a companion is one tap to remove. All other novelty channels (Explore, wishlist, swaps) are unchanged.

**Fruit.** In-season fruits rank by eaten-count descending over the same window, tiebreak longest-unused. Fruit keeps its full recency exemption, so the top fruit may recur across days of one week, which matches observed behavior.

**Retired ranking steps:** ingredient-consolidation preference (current §4 step 3) and within-week protein-family diversity (current §4 step 6). The protein-family normalization table stays; plate rule 6 reads it.

### 3.5 Cap

5 items per weekday, 3 on Saturday, fruit outside the cap (unchanged numbers). Composition cannot legally exceed the cap, so it becomes an assert-and-log: an over-cap week writes an error incident and drops nothing. The role-aware drop ordering and its Satiety/Prep Min inputs are retired.

## 4. Data and schema changes

- **Dish frontmatter, new optional `pairsWith`:** a list of dish names, each resolving to a library dish by exact name (blocking validator, like ingredient rows). Parsed into the baked library. Initial entries per plate rule 7.
- **Convex `favorites`, new optional `timesPerWeek`:** number, valid values 1 and 2, absent reads as 1. Additive; existing rows validate. Mutation enforces the cap. A small UI affordance in the Yours tab exposes it.
- **Convex `weekArchive` rows, new optional `source` (phase 2 prerequisite):** "generated" | "hand" per row, carried by finalize from the currentWeek dish's source field. Additive; existing rows validate. Ships in v4 so the data accrues; the 2x weighting itself is phase 2.
- **Engine generation input:** the generation entry point takes the trailing-10-week history it already receives; no new inputs beyond the favorites' `timesPerWeek` passthrough.

## 5. Explicitly rejected (do not re-add without new evidence)

- A cadence subsystem (per-dish due-dates or day-of-week affinities): overfits six weeks; its one confirmed instance (weekly staples) is covered by favorites pinning and the dial.
- A satiety-budget model: the record shows item-count pruning, not satiety arithmetic.
- Season-scoped frequency windows (D3): revisit at the October season boundary.
- Two exploration slots (D1): revisit if novelty feels starved after a month of v4 weeks.

## 6. Risks and mitigations

- **Rich-get-richer lock-in:** frequency-first feeds on its own output. Bounded by the rolling window, the 7-day guard, the exploration slot, and the fact that a swap-out denies a dish its count. Phase 2 (D2) further separates chosen from tolerated.
- **Cold start for new dishes:** a new library dish has zero eaten-count and enters through the exploration slot, Explore, or the wishlist. This is deliberate (novelty is budgeted, not default).
- **Small sample:** the spec is fit to six app weeks. The slow loop remains the correction path; manualChanges against v4 weeks are the evaluation data for whether the churn actually dropped.
- **Archive-timing blind spot:** edits made after finalize never reach history. Finalize discipline (finalize at week end, not mid-week) matters more under frequency-first; note for the operating docs.

## 7. Stream breakdown (proposed, to confirm at phase start)

| Stream | Scope                                                                                                                                                              | Lanes                                                                                   | Depends on             | Status  |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- | ---------------------- | ------- |
| A      | Selection rewrite: frequency-first, guard, exploration slot, fruit ranking, favorites dial consumption                                                             | `engine/src/priority.ts`, `favorites.ts`, `generateWeek.ts`, `docs/engine.md` §4, tests | none                   | pending |
| B      | Templates and plate rules: uniform breakfast, fixed standalone days, Indian plate, Saturday form, pairsWith rule, cap-to-assert                                    | `engine/src/composition.ts`, `schedule.ts`, `cap.ts`, `docs/engine.md` §2-3, §9, tests  | A (ranking API)        | pending |
| C      | Data and backend: pairsWith frontmatter + validator + initial pairs, favorites `timesPerWeek` (schema, mutation, Yours tab dial), weekArchive `source` passthrough | `data/dishes/*`, `engine/src/data/*`, `app/convex/*`, `app/web/*`                       | none (parallel with A) | pending |
| D      | Docs close-out: engine.md reconciliation, CHANGELOG, retired-section cleanup                                                                                       | `docs/engine.md`, `docs/CHANGELOG.md`                                                   | A, B, C                | pending |

Simulation harness note: `engine/test/simulation.test.ts` snapshots will move wholesale; both agents' converged spec is the reference for what the new snapshots should look like.

## 8. Verification results (2026-08-17): nine defects, spec blocked

A throwaway prototype of §3 was built in an isolated worktree (never pushed, never merged) and used to simulate 25 weeks forward from 2026-08-17 to 2027-02-01, crossing the Monsoon-to-Winter boundary. The run is self-feeding: each generated week appends to the history the next week reads. Three independent evaluators then audited the output: spec conformance, household fit, and an adversarial failure hunt. Artifacts are in the session scratchpad under `sim/`.

**The implementation is not the problem.** Every template rule and seven of eight plate rules held at 100 percent across 300 day-instances. The conformance auditor rebuilt the frequency-first ranker from scratch and reproduced the prototype's picks 250 of 250 times. Determinism is byte-identical on re-run. Every defect below is in this document, not in the code.

### What held (keep these unchanged)

- One gravy per lunch: 150/150, no fallback fired.
- Lunch protein floor: 150/150.
- Same-day protein-family dedup: zero collisions in 125 days.
- Lunch item counts reproduce the eaten record exactly: 2 items on 50 days, 3 on 79, 4 on 21, and all 21 four-item plates are dal thalis.
- Templates, meal-time coherence, rice spacing, cuisine register, one-HP-per-meal: all 100 percent.

### D1: Incumbency is never dislodged (critical, root cause of D2 and D3)

Frequency-first ranks by eaten-count; the 7-day guard is a delay, not a suppression (a blocked dish returns exactly 8 days later, one weekday on); tiebreaks are deterministic; there is no randomness. Nothing in §3.4 can ever unseat a leader, so every position converges to a fixed cycle whose period equals its pool size. Measured: the Wed/Thu/Fri lunch lead is a strict period-4 cycle for all 25 weeks; breakfast is a period-5 carousel with avocado toast on 25 of 25 Mondays; the whole menu has period 20, and week 21 is 85 to 94 percent slot-identical to week 1 once fruit is excluded. One plate (fish tikka, roti, kadhi, bhindi) appears 19 times in 25 weeks. Week-over-week overlap is 0.50 against 0.28 in the observed record: the engine is roughly twice as repetitive as the household actually is.

**Amendment required.** §3.4 must state what dislodges an incumbent. Recommended: make the frequency contribution saturating (cap a dish's eaten-count credit at 3 within the window) so that proven dishes still lead but ties among them become common, and the longest-unused tiebreak does real rotation work. Target: week-over-week overlap near the observed 0.28 to 0.35, not 0.50. Alternatives considered: a per-position multi-week cooldown, or a recency demotion weight replacing the hard guard.

### D2: Three roles are absorbing states (critical)

§3.4 step 3 exempts fruit, lunch carbs and the rule-2 protein side from the guard, and step 4 exempts the same set from within-week no-repeat. For those roles nothing opposes the frequency count at all, so the leader is mathematically unassailable. Result: 340 of 796 placements (43 percent) are served by six dishes. Fruit produced two distinct dishes in 150 days (mango every day for 42 days, then pomegranate for 108) while 8 of 9 eligible Monsoon fruits were never served once. Carbs: 82 placements, 2 dishes. This is worse than the longest-unused behaviour it replaced, and fruit is the household's most-edited slot class.

**Amendment required.** Drop the within-week recency exemption for fruit and keep frequency-first, so mango still leads without monopolising. Re-examine the carb and protein-side exemptions under D1's saturating count.

### D3: Plate rule 2's pool is two dishes (critical)

The rule-2 pool (active, Lunch, `cuisine_neutral`, HP-or-Keto) contains exactly two dishes, Chicken breast and Grilled chicken breast. The side is mandatory on every non-HP standalone lead and on every Saturday, and the position is exempt from both recency mechanisms. Grilled chicken breast landed 69 times (2.76 per week against 0.67 observed), on 25 of 25 Mondays and 25 of 25 Saturdays. A rule whose pool is two near-identical dishes is a hard-coded dish.

Compounding it, §1's supporting claim was overstated: of 13 observed international lunches, 6 were eaten completely alone and only 3 carried a protein side. The record does not support "default on".

**Amendment required.** Widen the pool (a content change), or make the side conditional rather than default, or add same-dish spacing. Also correct §1's claim.

### D4: The §3.5 cap premise is false (high)

§3.5 asserts "composition cannot legally exceed the cap" and on that basis retires the role-aware drop. The assertion is false by arithmetic against §3.2's own templates: a non-HP chilla or paratha breakfast composes 3 items and a dal-led plate composes 4, so a fully legal weekday reaches 7 against a cap of 5. Measured: 26 of 150 days over cap in the primary run, 4 of them at 7 items, and because the drop is retired they ship as composed.

**Amendment required.** Cheapest cut: do not attach the HP Keto side to a breakfast that already carries a chutney, which removes the 3-item breakfast and 15 of the 26 over-cap days. Otherwise restore a drop rule and state that the cap fires routinely.

### D5: pairsWith initial data is five-sixths dead (high)

Only `fish tikka + kadhi` is placeable. `soya chunks masala + vegetable korma` are both Category=Gravy and violate plate rule 1 (hard, no fallback), logging an error every week it fires (18 incidents in 25 weeks). `mutton keema + pav` names a Category=Bread dish no Indian-plate position holds. `chole + raita` has no position that can accept it. `toor dal / moong dal + a dry sabzi` does not name a dish, so §4's blocking validator rejects it at bake time. These pairs were drawn from the eaten record without checking them against the composition rules.

**Amendment required.** Rewrite the seed data against the composition rules before it ships.

### D6: The uniform breakfast rule strands 21 dishes (high)

§3.2 requires the breakfast main to carry `complete_meal` or `complete_carb`. Only 19 of 44 active breakfast dishes do. Eleven real mains are structurally unreachable: Anda bhurji, Paneer bhurji, Egg podimas, Vegetable omelette, Plain paratha, Thepla, Toast, Masala toast, Bread upma, Moong dal chilla, Oats chilla.

This is a sampling error in the analysis behind §1. Retiring v3's Option B/C was justified by "Option C occurred 0 times", counted over the six app weeks only. Option C occurs in the seed weeks: Paneer bhurji with Plain paratha (2026-06-08 Mon) and Anda bhurji with Toast (2026-05-04 Fri). The form was real; the sample was too narrow.

**Amendment required.** Restore a Dry-dish-main-plus-plain-carb breakfast form, or tag the stranded mains, so the pool is 19 rather than 6 usable dishes.

### D7: Exploration is a one-shot dead end (high)

Of the 20 never-cooked dishes the exploration slot introduced, 19 were served exactly once in 25 weeks and never returned. An explored dish leaves with a window count of 1 against incumbents at 15 to 19, so it can never win a frequency-ranked slot, and after 10 weeks its count decays to 0. Coverage: 52 of 261 active dishes ever served. At the observed rate of 0.76 new dishes per week, serving the 190 reachable-but-starved dishes once each would take about 4.8 years. Rule 7 also consumed the single novelty slot on 6 of 25 Fridays.

**Amendment required.** A cold-start prior or a protected re-serve, so an explored dish that is kept can enter the rotation. State rule 7's precedence against the exploration ranking.

### D8: The favorites dial never works (high)

`timesPerWeek: 2` on fish tikka placed twice on 0 of 25 weeks. The dish is a Keto Indian lunch dish, so its only accepting positions are the three Indian plates, and with five favorites the other two are claimed in round 1. Kadhi as a plain favorite oscillated 2, 0, 2, 0 for 25 weeks. Twelve consecutive-day kadhi repeats (Wed then Thu) occurred because the favorites pin and rule 7 both bypass within-week no-repeat, violating an invariant §4 step 5 states in its own words ("a favorite never wins two slots in one week"). Separately, 15 of 52 unplaced-favorite incidents are false positives.

**Amendment required.** Either the dial is withdrawn (its evidence was always one week in six), or the templates must offer enough accepting slots. State the precedence of the pin against within-week no-repeat. The false-positive incident predicate is a code-level fix.

### D9: Retiring protein diversity produced a chicken monoculture (high)

Chicken-family items ran 4.32 per week against 1.83 observed, appearing on 72 percent of days, while prawn and mutton appeared zero times in 150 days against 0.67 per week observed. Retiring §4 step 6 was agreed by both debate agents and endorsed here; the simulation says that was wrong. Same-day dedup alone does nothing across days.

**Amendment required.** Restore a within-week protein-spread mechanism, or accept D1's saturating count and re-measure before deciding.

### Lower-severity, also verified

- Monday breakfast carries no protein on 25 of 25 weeks: avocado toast is Category=Bread, so "serves alone" cancels the HP Keto attach, and as the pinned favorite the interaction is permanent.
- The season boundary is a non-event: 6 of 8 Winter-only dishes never appear, and the Winter fruit was decided by a 3-versus-2 margin in three-month-old seed rows, then locked for 108 days. D3's "revisit in October" answer is: season-scoped windows are needed, or seasonal content stays dead.
- International lunches ran 1.24 per week against the 2 per week §1 targets, and the sim produced zero 1-item lunches against 6 in the observed record.
- Saturday desserts appeared 6 times in 25 weeks, always Fruit custard, because the Accompaniment-or-Dessert pool is ranked frequency-first and accompaniments have history.
- `carbAffinity` is near-vacuous: 9 of 266 dishes carry it, and exactly one can ever satisfy the Indian-plate lead predicate. §3.2 defines no carb behaviour for the other 257, which is a hole rather than an ambiguity.
- Three precedences are unstated and each visibly changed the output: rule 7 versus the 7-day guard, rule 7 versus the exploration ranking, and the favorites pin versus within-week no-repeat.
- A week straddling a month boundary is generated under one season; 3 items in 796 were served out of season.

### Estimated effect

The household-fit evaluator scored the output against thresholds derived from the observed record and estimated 7 to 9 manual edits per week, against a v3 baseline of roughly 28. Fixing D2, D3 and D4 alone was estimated to reach 2 to 3 edits per week, which is the keepable range. D1 is not in that estimate because no distribution test catches it; it is the defect a person notices by week 6.

### Next step

Amend §3 against D1 to D9, then re-run the same 25-week simulation and the same three evaluations before any stream opens. The prototype and harness exist and are reusable, so the second cycle is cheap. Rajat decides D1's mechanism (saturating count is the recommendation), whether the favorites dial survives D8, and whether D9 is fixed directly or re-measured after D1.

## 9. Review findings from Rajat (2026-08-17): two further defects

Raised after reading the 25 simulated weeks. Both verified against the eaten record. These raise the blocking count from nine to eleven.

### D10: an Indian plate can land with no curry and no vegetable

Rajat flagged Thu 2026-08-20 (Grilled chicken breast + Roti + Raita) and Wed 2026-09-02 (Chicken tikka + Roti + Cucumber salad). Both are a protein, a carb, and a side, with no gravy and no sabzi.

Cause: §3.2's Indian-plate companion pool is Category in {Gravy dish, Dry dish, Accompaniment}, and nothing requires the single companion to be a real dish rather than a side. When the ranker picks an Accompaniment, the plate has no vegetable component at all.

Verified: across the six finalized weeks, **0 of 16** lunches carrying a carb lacked a Gravy or Dry dish. In the simulation it is **13 of 82 (16 percent)**, and the §8 D1 period-4 cycle makes it recur roughly every fourth week.

**Amendment required.** On any plate carrying a carb, at least one companion must be Category=Gravy dish or Dry dish. An Accompaniment is only ever an additional item, never the sole companion. Where the budget allows one companion only, the Accompaniment pool is excluded from that position.

### D11: replace the fixed item cap with a whole-day prep-time budget

Rajat's call: the fixed item cap is the wrong instrument, because the cook works several dishes in parallel. Rather than model parallelism, read a threshold off the distribution of prep time in the meals actually eaten.

The reasoning is sound and worth recording: the meals in the record are meals the cook actually managed, so whatever parallelism she achieves is already embedded in their totals. A threshold taken from that curve is calibrated to real throughput without modelling parallelism. Summed `prepMinutes` is a proxy for cook load rather than wall-clock time, which is fine as long as the threshold is read in the same units.

Measured, six finalized weeks (n=34 days):

| Percentile | Whole day | Lunch | Breakfast |
| ---------- | --------- | ----- | --------- |
| p50        | 80 min    | 60    | 28        |
| p75        | 95        | 75    | 31        |
| p90        | **105**   | 84    | 35        |
| p95        | 112       | 85    | 35        |
| max        | 120       | 95    | 35        |

Breakfast is self-limiting (every observed breakfast falls between 10 and 35 minutes), so it needs no cap of its own; lunch carries the variance. That argues for a single whole-day budget, which also matches the cook's single morning session.

Scored against the 150 simulated days, the item cap and a 105-minute time budget disagree sharply: 16 days both flag, **10 days the item cap flags that are comfortably within cook load**, and 1 day the item cap misses that genuinely runs long. Ten of the 26 item-cap flags are false alarms.

**Amendment required.** Retire the 5-weekday / 3-Saturday item cap and §3.5 entirely. Replace with:

- A whole-day budget of **105 minutes** of summed `prepMinutes` across breakfast and lunch (fruit excluded, as it always was).
- Composed as a budget, not a trim: breakfast composes first, lunch composes to the remainder, and a candidate companion that would breach the budget is skipped in favour of the next candidate that fits. If none fits, the plate lands one companion short and logs it, the same principle as the one-gravy rule.
- Saturday needs no separate rule: with no breakfast it may spend the full budget on lunch, which permits a proper weekend lunch that the flat 3-item cap forbade.

This retires D4 outright (there is no longer a false premise to defend) and puts `prepMinutes` back on the rule path, which §3.1 had removed. All 266 library dishes carry `prepMinutes` (range 5 to 60, median 25), so no data backfill is needed.

Verification for the next cycle: the re-simulated whole-day prep-time curve should sit under the observed curve rather than beyond it. The current simulation puts 8 percent of days past 120 minutes, which is longer than any day the household has ever cooked.

Analysis: https://claude.ai/code/artifact/b0cf867b-2d4c-4e4b-babf-1a2e8cd962e5

## 10. v4.1: the amended target (2026-08-17)

This section supersedes §3 wherever the two disagree. It resolves all eleven defects. Implementation streams build against THIS section; §3 is retained only as the record of what was wrong.

Rajat's decisions are marked (R). Calls the EM took, having put a recommendation on the record first, are marked (EM) and are open to veto at PR review.

### 10.1 Caps: a time budget plus a loose item backstop (R, resolves D4 and D11)

- **Whole-day prep budget: 120 minutes** of summed `prepMinutes` across breakfast and lunch. Fruit is outside it.
- **Item backstop: 6 items per day**, breakfast plus lunch, fruit outside. Uniform; the old 3-item Saturday cap is retired, so Saturday can carry a proper weekend lunch.

Both numbers sit at or just above the envelope of what the household has actually eaten: their busiest observed day is exactly 120 minutes, and their largest is 5 items, so the item rule keeps one item of headroom and is a backstop rather than the binding constraint. The time budget is what binds.

Composed as a budget, never as a post-hoc trim, which is what made the old cap premise false:

1. Breakfast composes first (observed range 10 to 35 minutes).
2. Lunch composes to the remaining minutes and items.
3. A candidate that would breach either limit is skipped for the next candidate that fits.
4. If no candidate fits, the plate lands one companion short and logs a `budget-short` incident. A smaller plate beats a wrong one, the same principle as the one-gravy rule.

`prepMinutes` returns to the rule path (§3.1 had removed it). All 266 dishes carry it, so no backfill is needed. The role-aware drop ordering stays retired; nothing is ever dropped.

### 10.2 Selection: saturating frequency (EM, resolves D1 and D2)

The defect was that nothing could dislodge an incumbent. The fix is to stop letting frequency accumulate without limit:

- **Saturating count.** A dish's frequency credit is `min(eatenCount, 3)` over the 10 most recent week-records. Proven dishes still lead, but many of them tie at the cap, and the longest-unused tiebreak then rotates among them. This reproduces what the household actually does: repeat a known repertoire, rotating within it.
- **Recency exemptions are withdrawn for fruit.** Fruit ranks by saturating count with the 7-day guard and within-week no-repeat applying normally. Lunch carbs keep their exemption (roti every day is intended). The rule-2 protein side loses its exemption (see 10.3).
- Guard, within-week no-repeat, and the tiebreak chain (longest-unused, then id) are otherwise unchanged.

**This is the change most likely to need tuning, and the re-simulation is the test.** Target: week-over-week overlap near the observed 0.28 to 0.35, against 0.50 today; no dish on more than about 2 of 6 fruit days; no position showing a fixed cycle across 25 weeks.

### 10.3 Plate rules (resolves D3, D5, D9, D10)

Rules 1 to 8 of §3.3 stand, with these amendments:

- **Rule 2 (protein side).** Keeps its trigger but loses its recency exemption, so it cannot serve the same dish 69 times. Its pool must also be widened by tagging: the `cuisine_neutral` HP-or-Keto lunch pool is currently two chicken-breast dishes, which is a content defect, not a rule defect. Stream C widens it.
- **Rule 7 (pairsWith).** Seed data is cut to pairs that the composition rules can actually place. `fish tikka + kadhi` is the only survivor of the original six. Any new pair must be validated against rules 1 to 6 before it ships. Precedence is now explicit: rule 7 never overrides the one-gravy rule, never overrides the exploration slot, and never places a dish the within-week no-repeat rule excludes.
- **Rule 9, new (D10).** On any plate carrying a carb, at least one companion must be Category=Gravy dish or Dry dish. An Accompaniment is only ever an additional item, never the sole companion. Verified against the record: 0 of 16 observed carb lunches lacked a gravy or sabzi; the simulation produced 13 of 82.
- **Within-week protein diversity is restored (EM, D9).** The v3 §4 step 6 rule returns: an HP main whose protein family already appeared as an HP main earlier in the week is deprioritised, with the fresh-alternative fallback. Retiring it produced chicken on 72 percent of days and zero prawn or mutton in six months. Restoring it is the direct fix; it was retired on a debate argument the simulation falsified.

### 10.4 Breakfast (resolves D6)

The uniform breakfast form stands, but its main pool is widened: a breakfast main is a dish tagged `complete_meal` or `complete_carb`, **or** a Category=Dry dish breakfast main served with a plain breakfast carb (the v3 Option C form). This restores eleven stranded dishes including anda bhurji, paneer bhurji, vegetable omelette and masala toast.

The retirement of Option C was justified by "it occurred zero times", counted over the six app weeks only. It occurs twice in the eleven-week record: paneer bhurji with plain paratha (2026-06-08) and anda bhurji with toast (2026-05-04). The claim was a sampling error.

The attach rules are unchanged except that a main which already carries a chutney does not also gain the HP Keto side; that combination is what produced the 3-item breakfasts behind most over-cap days, and the budget in 10.1 now governs the rest.

### 10.5 Novelty (EM, resolves D7)

- The exploration slot stays at one per week (D1 as decided) but **rotates across the week's companion positions** instead of being fixed to Friday, and rule 7 can no longer consume it.
- **Cold-start retention:** a dish introduced by the exploration slot and not removed by the household that week receives a +1 frequency credit, so it re-enters at 2 rather than 1 and can compete. This reuses the hand-placement signal that D2 already requires history rows to carry.

Discovery is budgeted; retention is a human signal (favorites and the wishlist) plus this credit. The re-simulation must show explored dishes recurring rather than the current 19 of 20 served exactly once.

### 10.6 The favorites dial is withdrawn (EM, resolves D8)

`timesPerWeek` is cut. It placed twice on 0 of 25 weeks, its evidence was always a single week in six, and it was the direct cause of twelve consecutive-day kadhi repeats. Plain one-slot favorites pinning stays, with one clarification the old spec lacked: **a pinned favorite is subject to within-week no-repeat**, so the pin and rule 7 can never combine to place a dish twice. That restores the invariant §4 step 5 already asserted.

The false-positive `unplaced-favorite` incident predicate is a code-level fix, not a spec change.

### 10.7 Deferred, with reasons

- **Season-scoped frequency windows (D3 decision, revisited).** The season boundary showed 6 of 8 winter-only dishes never appearing. The saturating count in 10.2 may fix this indirectly by letting cold dishes tie. Re-measure at the October boundary in the re-simulation before adding season scoping.
- **Hand-placement double weighting (the original D2).** Still phase 2, but 10.5 now depends on the same history-row `source` field, so Stream C ships the field in this phase.
- **`carbAffinity`.** Nine of 266 dishes carry it and exactly one can lead an Indian plate, so the rule is near-vacuous. Behaviour when absent is now stated: default to the Chapati pool. Widening the data is a content batch, not this phase.

### 10.8 Verification gate (mandatory before any merge)

No behaviour-changing stream (A, B, C) merges until the re-run passes. The activation PR that lands this spec is documentation only and is outside the gate. The prototype and harness from the 2026-08-17 cycle are reusable.

1. Re-run the identical 25-week simulation (2026-08-17 to 2027-02-01, self-feeding, real library, real favorites) against the amended engine.
2. Re-run the three independent evaluations: spec conformance, household fit, adversarial failure hunt.
3. Acceptance thresholds, all of which the current output fails:
   - Week-over-week overlap 0.28 to 0.35; no position on a fixed cycle across 25 weeks.
   - At least 6 distinct fruits across the run; no fruit on more than 2 days of any week.
   - No single dish above about 25 placements in 150 days.
   - Zero carb plates without a gravy or dry dish.
   - Zero days over 120 minutes or 6 items.
   - At least one prawn and one mutton dish per 4 weeks.
   - Explored dishes recur rather than appearing exactly once.

### 10.9 Streams

| Stream     | Scope                                                                                                                                                                               | File lanes                                                                                                                                          | Depends on | Status  |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------- |
| Activation | Land this spec, the PLAN row, the CLAUDE.md line, and the EM decision entries                                                                                                       | `features/engine-v4.md`, `docs/PLAN.md`, `CLAUDE.md`, `DECISIONS.md`                                                                                | none       | pending |
| A          | Selection: saturating count, fruit exemption withdrawal, protein diversity restore, exploration rotation and cold-start credit, favorites pin under no-repeat, dial removal         | `engine/src/priority.ts`, `engine/src/favorites.ts`, `engine/src/explore.ts`, `docs/engine.md` §4, paired tests                                     | Activation | pending |
| B          | Composition: 10.1 budget, breakfast widening, rule 9, rule 7 precedence, cap retirement                                                                                             | `engine/src/composition.ts`, `engine/src/schedule.ts`, `engine/src/cap.ts`, `engine/src/generateWeek.ts`, `docs/engine.md` §2, §3, §9, paired tests | A          | pending |
| C          | Data and backend: widen the `cuisine_neutral` pool, rewrite `pairsWith` seed data plus its validator, add `weekArchive` row `source`, remove the dial from Convex and the Yours tab | `data/dishes/`, `engine/src/data/validators.ts`, `app/convex/schema.ts`, `app/convex/favorites.ts`, `app/web/src/**Favorite**`                      | Activation | pending |
| D          | Verification: re-run the simulation and the three evaluations against merged A+B+C, report against 10.8                                                                             | scratchpad only, no repo files                                                                                                                      | A, B, C    | pending |

A and B are sequenced rather than parallel: both touch `generateWeek.ts` and `docs/engine.md`, and the selection API is B's input. C runs in parallel with A on disjoint lanes.

## 11. Amendments from Stream A evidence (2026-08-17)

Stream A measured the amended engine over the same 25-week simulation and produced four corrections. Each supersedes the §10 sub-section named. All are evidence from a run, not argument.

### 11.1 The guard is load-bearing, not the saturating cap (supersedes §10.2)

§10.2 put the weight on the saturating count and filed the 7-day guard under "otherwise unchanged". **That emphasis is backwards.** Measured over 25 weeks:

| Configuration                       | Week-over-week overlap | Positions on a fixed cycle |
| ----------------------------------- | ---------------------- | -------------------------- |
| Saturating count alone              | 0.566                  | 20 of 36                   |
| Saturating count + date-keyed guard | 0.293                  | 10 of 39                   |

The cap ties _proven_ dishes with each other, but a challenger sits at credit 0 and has no way to climb, because it is never placed. In a narrow pool there is exactly one proven dish and it wins forever. The guard is what evicts the incumbent for long enough that a challenger gets a slot and starts accruing a count; the cap is what stops the winner running away again. Both are needed and the guard is the mobility mechanism.

Consequence for anyone tuning this later: if repetition returns, reach for the guard window before the cap value.

### 11.2 The baseline was misstated (corrects §10.2's target and the Stream A brief)

The §10.2 target and the Stream A brief both cited "0.50 today". That figure is the **throwaway prototype's**, not `main`'s. The v4 §3 engine was never merged; `main` is still v3, whose overlap measures **0.194**, meaning it is _less_ repetitive than the household's own 0.28. This is consistent with the original diagnosis: longest-unused is an anti-preference chooser that produces more variety than the household wants.

So the correct framing is that this phase moves overlap **up** into the 0.28 to 0.35 band, not down. Stream A plus Stream B's wiring measures 0.293.

### 11.3 The cold-start credit is deferred (supersedes §10.5)

§10.5 said the credit reuses the `source` field. It cannot: the values are `generated | hand`, so an explored-and-kept dish is written `generated` and is indistinguishable from any other pick. Making it work needs the exploration role persisted on the `currentWeek` dish and carried through finalize, which is new schema surface for a mechanism that was an EM invention with no evidence behind it.

**Deferred out of this phase.** The exploration slot still rotates (§10.5 first bullet stands). Stream D measures whether novelty retention is still one-shot once A and B land; if it is, the persistence earns its way in then, with evidence. Stream A's code path for a third `source` value stays as an inert branch and is tracked here rather than as an untracked TODO.

### 11.4 One §10.8 threshold was arithmetically unreachable (supersedes §10.8)

The acceptance threshold "no single dish above about 25 placements in 150 days" cannot be met by any ranking rule during Winter. The active library holds exactly **three** Winter-eligible fruits (Banana bowl, Papaya bowl, Pomegranate bowl) against 6 days x 18 Winter weeks, so 36 placements each is the arithmetic floor.

The threshold is restated as: **no single dish above about 25 placements in 150 days, excluding fruit and lunch carbs.** Fruit is content-constrained and lunch carbs are recency-exempt by design. Measured: 24.

This surfaces a content gap rather than a rule gap: **a Winter fruit batch is needed** (`data/expansion-*`, reviewed by Rajat per `docs/development.md` §9). Logged here as the phase's one content follow-up.

### 11.5 Merge order changed: A and B ship as one deploy (supersedes §10.9 and hotspot H9)

Stream A's changes need the slot's calendar date threaded through and the fruit plan called per week; both call sites live in `generateWeek.ts`, which is Stream B's lane. Until B lands, Stream A's branch measures **0.566 overlap, worse than the 0.194 it replaces**. Merging A alone would deploy a regression to production, because Vercel and Convex promote on merge to `main`.

Therefore: **Stream B branches off `feat/A-v41-selection`, not `origin/main`, and B's PR targets A's branch.** B merges into A, then the combined branch merges to `main` as a single deploy. Hotspot H9 is restated accordingly.

## 12. Amendments from Stream B evidence (2026-08-17)

### 12.1 §10.4 was self-contradictory (supersedes §10.4)

§10.4 says both "the uniform breakfast form stands" and "the attach rules are unchanged". These cannot both be literal: the old attach rules were Tue/Thu-scoped and a uniform form has no Tue/Thu. **Intended reading: the attach rules are trigger-scoped, not day-scoped.** A chutney attaches when the winning main is a Chilla or Paratha; the HP Keto side attaches when the winning main carries no HP tag; a chutney suppresses the keto side. No day enters the condition. Stream B implemented this reading and it is now the spec.

### 12.2 The breakfast keto side is a one-dish pool (new defect, D12)

The HP + Keto + Breakfast pool contains **exactly one** library dish, Boiled eggs. Under the old two-form breakfast the pool was only reached on Tue/Thu; the uniform form reaches it whenever a non-HP main is served, so Boiled eggs lands 36 times in 150 days and is the one §10.8 threshold still failing.

This is the same class of defect as D3's two-dish protein pool: **a rule whose pool is one dish is a hard-coded dish.**

Stream B measured the obvious code fix (suppress the keto side on a `complete_meal` main): max placements falls to 21 and every other threshold still passes, but protein-less breakfasts rise from 21 of 125 to **63 of 125**, gutting the breakfast protein floor. **That fix is rejected.** The right lever is content: a breakfast-protein batch (`data/expansion-*`, reviewed by Rajat per `docs/development.md` §9), queued alongside §11.4's Winter fruit batch.

Until that batch lands, the §10.8 max-placements threshold is expected to fail on Boiled eggs alone, and that single exception is accepted for this phase.

### 12.3 Widening breakfast was necessary but not sufficient (D7 remains open)

§10.4's premise was slightly wrong. The Option C form was not "retired": it was **unreachable**, because Option B was attempted first and only fell through when its pools were empty, which never happened. Widening the pool does make the eleven stranded dishes reachable.

**None of them is actually served.** A never-cooked main sits at frequency credit 0, and the exploration slot covers companion positions, not mains. Breakfast still shows only 9 distinct combinations across 125 days. So D7 (one-shot novelty) is not fixed by the widening, and §11.3 deferred the cold-start credit that would have addressed it.

This is an honest consequence of that deferral, recorded rather than hidden. Stream D measures it; if breakfast novelty is still dead after the full run, the cold-start credit earns its way back in with this as its evidence.

### 12.4 A latent defect the wiring exposed (fixed in Stream B)

The §4.7 repeat guard is a filter. Threading `slotDate` through made it remove **pinned** dishes from the pool before the pin-promotion step ran, silently breaking both the §6 request override and the §4 step 4 favorites _guarantee_, on precisely the dishes the household eats most often. An existing test caught it; a new test pins the invariant.

Worth noting as a pattern: this defect existed latently in the v4 design and only became reachable once the guard had a real date to key on. Wiring a rule up is itself a test of it.

### 12.5 CI does not run on feature-branch pull requests (process finding)

`.github/workflows/ci.yml` triggers on `pull_request: branches: [main]` only. A PR targeting a feature branch, which §11.5's merge plan now requires, gets **no CI at all**. Stream B ran every gate locally instead.

Consequence for this phase: the combined branch is what CI actually attests, when the integration PR targets `main`. Do not read a green tick on a feature-to-feature PR as verification, because there is no tick to read.

### 12.6 Days got bigger, and the 6-item backstop is the reason (for Rajat)

Both stated limits hold everywhere: zero days over 120 minutes, zero over 6 items. But:

- Mean daily prep time rose from **74.5 to 86.1 minutes**.
- **61 of 150 days sit at 6 items**, against a largest _observed_ day of 5.

This follows directly from §10.1's framing that 6 is a backstop with headroom and the time budget binds. It is exactly what was specified. But 41 percent of days now land at a size the household has never actually eaten, so the framing deserves a second look before this ships. The number to change is the item backstop, not the mechanism.

## 13. Amendment: two §10.8 thresholds were unreachable as written

Both remaining §10.8 failures on the integrated A+B+C branch are **pool-size problems, not ranking defects**. No selection rule can reach either threshold. Restating them here so Stream D measures against something achievable and the real gaps stay visible rather than being absorbed into a vague "gate failed".

### 13.1 "No position on a fixed cycle" is impossible under §3.4's own determinism rule

§3.4 mandates deterministic selection with no RNG. A deterministic ranker drawing from a pool of N dishes, whose state is a bounded window of recent history, **must** eventually repeat a state and therefore cycle with period at most N. That is a pigeonhole argument, not a tuning problem. The only exits are randomness, which §3.4 forbids, or larger pools, which is content.

So "no position shows a fixed cycle across 25 weeks" can never pass. The threshold is restated as two measurable things that do distinguish a healthy menu from the D1 carousel:

- **No position at period 1** (the same dish every single week), except the intended exemptions: the roti carb and any pool the season leaves below four dishes.
- **Whole-menu period at least 25 weeks**, i.e. no week in the horizon is slot-identical to an earlier week. The original defect was a period of 20; the integrated branch shows no whole-menu repeat.

Even rotation over a small pool is the correct behaviour for this household, which eats a concentrated repertoire. It is only a defect when the rotation is degenerate (period 1) or when the whole menu repeats.

### 13.2 The max-placements threshold needs a pool-size floor

"No single dish above about 25 placements in 150 days, excluding fruit and lunch carbs" (§11.4) still fails on Boiled eggs at 36. The cause is D12: the breakfast HP+Keto attach pool holds **exactly one** dish, so the §4.7 guard has nothing to fall back to and correctly relaxes every time.

Restated: **no single dish above about 25 placements in 150 days, excluding fruit, lunch carbs, and any position whose eligible pool holds fewer than four dishes.** A position with a one-dish pool is a hard-coded dish, and the honest report is the pool size, not a ranking number.

This makes the two content batches the gating work rather than hiding them:

| Pool                                 | Size today          | Consequence                                | Fix                             |
| ------------------------------------ | ------------------- | ------------------------------------------ | ------------------------------- |
| Breakfast HP + Keto (protein attach) | **1** (Boiled eggs) | 36 placements in 150 days                  | breakfast-protein content batch |
| Winter-eligible fruit                | **3**               | 36 placements each is the arithmetic floor | Winter fruit content batch      |

Note this phase made the first one worse, not better: §10.3 widened the _lunch_ neutral-protein pool and nobody widened the _breakfast_ Keto pool, while §10.4's breakfast widening makes more non-HP mains reachable, so the attach fires more often. That is a real cost of the change and it is recorded rather than netted out.

### 13.3 What the gate now asks

Streams A, B and C are complete and integrated. Stream D measures the integrated branch against §10.8 as amended by §11.4 and this section, and reports each threshold pass or fail with its cause classified as **ranking** or **content**. A content failure does not block the phase; it opens a reviewed content batch. A ranking failure does block.

## 14. Fruit of the day is removed (Rajat, 2026-08-18)

Rajat: the household has not been following the Fruit of the day, so it comes out of the system entirely, fruits leave the dish list, and the existing fruit dishes are deactivated.

This lands inside this phase rather than after it, because fruit is the cause of two of the three outstanding §10.8 failures. Removing it deletes those problems rather than fixing them.

### 14.1 What is removed

- **§3.3 Fruit of the day** in `docs/engine.md`, in full, plus the fruit column in the §2 weekly-schedule table, the fruit clauses in §4's recency exemptions, and the fruit carve-out in §9.
- **§10.2's fruit ranking** and the withdrawal of fruit's recency exemptions (both moot).
- Fruit composition and ranking in the engine: the fruit pool, the per-week fruit plan, the fruit slot in the schedule, and the fruit row emitted on finalize.
- The fruit section in the app: the Menu tab, the day editor, the share image, and the picker's fruit slot.
- Fruit as a grocery-list contributor.

### 14.2 The nine active fruit dishes are deactivated

Set `active: No` on Banana bowl (154), Jamun bowl (276), Litchi bowl (275), Mango bowl (274), Papaya bowl (155), Peach bowl (278), Pineapple bowl (279), Plum bowl (277), Pomegranate bowl (280). Seasonal fruit (123) is already inactive.

The files stay in `data/dishes/`. Deactivating is the reversible form of removal and keeps every historical row resolvable by id; deleting the files would orphan the fruit rows in `weekArchive` and `menu_history.md` and break the history reader.

### 14.3 The Convex schema literals must stay (do not "finish the job")

`slotMeal` carries a `"fruit"` literal, `weekArchive.rows.meal` carries `"Fruit"`, and `manualChanges.meal` carries `"fruit"`. **Removing these literals is a breaking schema change that will fail the deploy**, because Convex validates every existing document against the new schema and production holds real fruit rows in both `currentWeek` and `weekArchive`, plus fruit swaps in `manualChanges`.

So the literals remain, as read-only legacy values that nothing new writes. This is the whole reason "remove it completely" cannot mean "delete every mention". Wiping the archive to clean them up is not an option under any circumstances: `weekArchive` is the eaten record, which is the only training signal the selection engine has.

Every reader that can encounter a historical fruit row (the Changes log, any archive view, the history parser, the grocery aggregator) must continue to tolerate it without rendering a fruit section for new weeks.

### 14.4 Consequences for the acceptance gate

- The Winter fruit content batch (§11.4, §13.2) is **cancelled**. There is no fruit slot to starve.
- The fruit thresholds in §10.8 are struck.
- §13.2's max-placements exclusion list drops "fruit" and keeps lunch carbs and small-pool positions.
- The breakfast-protein content batch (§12.2, D12) **stands**; it is unrelated to fruit.
- Day size falls by one item across the board, though fruit never counted toward the §10.1 caps, so the 120-minute and 6-item limits are unaffected.

### 14.5 Verification

The §10.8 gate has not yet passed: the Stream D run and its adversarial evaluation both terminated on a session limit before reporting. Nothing has been verified end to end. The gate re-runs after this removal lands, against the whole integrated branch, and it is the same gate: no behaviour-changing stream merges to `main` until it passes.

## 15. Verification verdict, 2026-08-18: DO NOT MERGE

The §10.8 gate ran against the fully integrated branch (`1678d36`, Streams A+B+C+E) and **failed**. Four blocking findings, all **ranking** defects, none of them content. The phase does not merge to production.

Independently confirmed by the EM before accepting the verdict: international weekday lunches run exactly 2.00 per week for 19 weeks and then exactly 0.00 for the following 33; 52 weeks of breakfast contain 5 distinct week patterns and 6 distinct mains.

### 15.1 The root cause, which is a defect in decision D3

Frequency-first was adopted so the engine would propose what the household actually eats. **It does the opposite in steady state, because the frequency window is self-referential.**

The seed record is 11 weeks (5 seed + 6 archived app weeks). The window is the 10 most recent week-records. So from simulated week 11 onward the window contains **only the engine's own output**, and the household's real eaten record has been flushed out of the signal entirely. What the engine then reinforces is whatever it happened to place in its own weeks 1 to 10.

Consequences measured over 150 days: **32 of the 65 dishes the household actually ate are never served**, against 10 under v3. Every dal is missing (Toor dal, Moong dal, Dal tadka, Chole), as are Butter chicken, Chicken tikka, Palak chicken gravy, Curd rice and Bread omelette. Dal runs 0.64 per week against 2.00 observed.

This is a defect in D3 (rolling 10 most recent week-records, chosen for simplicity over season scoping). The next cycle must keep the household's real record permanently in the signal rather than letting it roll out: anchor the seed and archive weeks, or separate a fixed household-record term from a rolling-recency term.

### 15.2 The four blocking findings

1. **Breakfast is the D1 carousel, unfixed and worse than v3.** 125 breakfasts yield 6 distinct mains and 6 distinct combinations, in a strict period-5 rotation; v3 gives 19 mains and 38 combinations, and the household's own record has 11 mains in 28 breakfasts. The §10.4 widening is inert: all eleven restored dishes are served **zero** times. Mechanism: by week 11 exactly 6 mains sit at credit 3 and the other 17 at credit 0 forever, and the 7-day guard blocks only the last 5 breakfasts, so a credit-0 dish never gets a turn. `explorationPositions` is lunch-only, so breakfast has no novelty channel at all.
2. **The international lunch dies permanently at week 20** and never returns. This is the integration defect no single stream could see: Stream A changed placement to frequency-first while the v3 longest-unused substitution trigger was left standing in nobody's lane, so the trigger compares an anchor against a pool the placer will never touch.
3. **The favorites guarantee breaks**, caused by finding 2. Invisible with the one real favorite; add two ordinary ones and `unplacedFavorite` fires for six consecutive weeks with the dish genuinely absent. That is the Phase 7 user-facing promise failing silently.
4. **Household staples are starved** (finding in 15.1).

### 15.3 Thresholds

Passing: carb plates with a gravy or sabzi (0 of 88 violations), zero days over 120 minutes or 6 items, prawn and mutton in every 4-week block, overlap 0.295 at 25 weeks, fruit fully removed with legacy rows tolerated and schema literals intact, max placements as amended.

Failing: no position at period 1 (Avocado toast on 25 of 25 Mondays from a 21-dish pool, not an exempt position), explored dishes recur (67 percent served exactly once), and the prep-time curve sits **above** the household's at every percentile (p50 90 against 80, mean 86.4 against 77.6) rather than under it.

### 15.4 The gate horizon was wrong

The 25-week window stops one week before the engine changes shape permanently. **Future gate runs measure weeks 20 to 60, not 1 to 25.** The steady state is where this engine actually lives, and it is a different engine from the one the first 19 weeks show.

### 15.5 Also required before the next attempt

- Lower the item backstop from 6, or size lunch by shape rather than by leftover day capacity. §12.6 raised this and it was never actioned; 4-item lunches run 76 of 150 against 2 of 34 observed, and 6-item days 60 of 150 against a household maximum of 5.
- Either wire rule 7 into generation or delete `pairsWith` from the data and the validator. It is parsed, validated and baked, and read nowhere.
- Fix §10.3 rule 9's text, which contradicts its own evidence: the "0 of 16" statistic only holds if the lead may supply the gravy or sabzi. The code implements the correct weaker reading; the prose is wrong.
- Add pinned favorites to §13.1's exemption list.
- Resolve §10 versus §3. §3 says "do not implement" while §10.3 and §10.4 keep parts of §3 alive by reference, which is exactly what left the substitution trigger orphaned.
- Re-take every §12 gate number against the production favorites list; two were measured without it.
- Pre-existing, not introduced here: production generation is **not deterministic**. `app/convex/generateWeek.ts` passes neither `rng` nor `lastSaturdayMenu`, so the Saturday menu coin-flips on `Math.random`, contradicting §3.4's no-RNG claim. `main` does the same, so it is not a regression.

### 15.6 Status

Streams A, B, C and E stay open and unmerged on `feat/A-v41-selection`. Their work is not wasted: the time budget, rule 9, protein spread, the neutral-protein widening, the favorites-pin fix and the fruit removal all verify clean. The blocking defects sit in the selection mechanism, which is one more iteration, not a restart.

### 15.7 Addendum: `docs/engine.md` fails the §13 parity rule on rule 7

EM-verified. `pairsWith` is read **nowhere in generation**: outside the data layer (schema, parser, serializer, validator, baked library) the only references are two prose comments in `explore.ts` and `favorites.ts`. Yet `docs/engine.md` describes it as a live plate rule in two places, §3 line 43 and §12 line 365, complete with a precedence order for a rule that never fires.

The canonical rules spec therefore documents a plate rule the engine does not have. The 665-test suite cannot catch it: `pairsWith` appears in exactly one test file, which covers name resolution at bake time and nothing about placement.

This changes how two earlier conclusions read:

- §10.3's rule 7 rewrite ("`fish tikka + kadhi` is the only survivor") looked like a completed data fix. With the rule unimplemented, the data change was a no-op, and the zero pairing incidents in the gate run are not evidence the rewrite worked. They are evidence nothing ran.
- §10.5's "rule 7 can no longer consume the exploration slot" was already true for free.

Two further `docs/engine.md` assertions are falsified by measurement:

- Line 206 claims the guard's delay "lets a starved dish take a slot, accumulate a count of its own, and climb toward the cap". For breakfast this is false: the rotation drifts a dish exactly one weekday per week, which is 8 days between appearances and permanently clears a 7-day guard, so 17 of 23 mains sit at credit 0 forever. The doc states the mechanism §11.1 called load-bearing, in the position where it most needs to hold, and it does not hold there.
- Line 282 claims the 6-item rule "is a backstop rather than the thing that sizes the plate". Measured, it is the thing that sizes the plate: 60 of 150 days land exactly at 6, rising to 197 of 360 over 60 weeks.

Add to 15.5: fix the parity between `docs/engine.md` §12 and the engine, either by wiring rule 7 in with a generation test or by deleting it from the doc, the frontmatter and the validator. **And add a parity test that fails when a documented plate rule has no generation coverage**, since the suite currently passes with a fully documented, fully validated, entirely absent rule.

### 15.8 A limitation in the gate itself

Of the three independent evaluations, household fit and the adversarial hunt returned in full. The spec-conformance evaluator went unresponsive after producing intermediate output. Stream D did not leave a hole: it read the intermediate artefacts and independently re-derived every conformance claim, and found the parity violation itself. So the conformance dimension is covered, but by the same agent that ran the simulation rather than by a genuinely independent second pass. If a third opinion on conformance is wanted before the next attempt, that is the piece to re-commission. The verdict does not turn on it: all four blocking findings come from the simulation and the adversarial run.

### 15.9 Reconciling the two evaluations, and the scoping error underneath them

The spec-conformance evaluator was orphaned mid-run and delivered late. Its roll-up **disagrees with §15's verdict**: "no blocking ranking failure attributable to the ranker". Both are right, and the disagreement is the most useful thing in the gate.

Conformance asked _does the code do what the spec says_, and the answer is largely yes. Stream D asked _do the menus work_, and the answer is no. **The engine faithfully implements a specification whose rules produce bad menus.** That is the identical pattern as the first cycle in §8, one level up: last time a faithful implementation of a bad spec; this time a faithful implementation of a bad spec whose faults only appear in steady state. **The verdict stands, because the blocking failures are behavioural, not conformance.**

**The scoping error.** Conformance found that **§10's day templates were never implemented at all.** The engine still runs v3's Menu 1/2/3/4 forms and the entire §3.2 substitution machinery; EM-verified (12 menu-form references and both substitution functions live in `composition.ts`). §10.2's "Mon/Tue standalone, Wed to Fri Indian plate" is formally dead text: §3 says "do not implement", §10.3 revives §3.3's plate rules and §10.4 revives the breakfast form, but **nothing revives §3.2's templates**, and no stream's brief carried them. Stream B's scope was the budget, rule 9, breakfast widening and rule 7 precedence.

That is an EM scoping error, and it is the direct cause of §15.2 finding 2: the international substitution trigger was left as v3's longest-unused comparison because the whole template layer it belongs to was never rewritten. Nobody owned it, so nobody changed it.

**Further conformance findings folded in:**

- **The household's own six weeks measure 0.263 overlap**, below the 0.28 to 0.35 band that §10.2 and §11.2 attribute to them. The band was misquoted; v4.1 at 0.295 is marginally _more_ repetitive than the record it was fit to. Every overlap target in this spec needs restating against a measured baseline and a named metric: the threshold never says whether it means week-level dish-set Jaccard (0.295) or position-keyed (0.106).
- **Rule 9's code is right and both spec texts are wrong**, independently confirming §15.5. The strong reading fails the household's own record 6 of 16; the weak reading, which the code implements, fails 0 of 16.
- **The tiebreak is input array index, not dish id**, in both `byLongestUnused` and `bySaturatingFrequency`, while `rankExploration` does use id. Reversing the library array changes 7 of 11 slots. A second determinism hole beneath the `Math.random` one, latent only because the baked library order happens to be stable.
- **Saturday alternation is not implemented**: 13 of 24 transitions repeat, including five consecutive Menu 3.
- **§13 claims "CI enforces this with two checks". There is no spec-parity check in CI at all** (EM-verified: zero references). The parity rule that is supposed to stop `docs/engine.md` drifting from the engine has been enforced by convention alone, which is why §15.7's dead rule 7 survived.
- **D12 is worse than recorded**: Boiled eggs at 45 placements, not 36, causing all 40 non-carb guard relaxations.
- The rotating exploration position does not exist in 2 of 25 weeks and nothing is logged.
- Ingredient consolidation is implemented and live, while §3.4 retires it; the code comment says so explicitly. `docs/engine.md` and the code agree; `features/engine-v4.md` disagrees with both.

**Banked passes, from an independent second measurement:** budget 0 of 150 over either limit, one-gravy 0 of 150, protein floor 0 of 150, one-HP-per-meal clean, cuisine register clean on 87 Indian and 38 international plates, fruit fully removed with 34 legacy rows parsing, favorite placed 25 of 25 weeks and never twice, chicken down to 1.04 per week from 4.32.

**Added to 15.5:** rewrite §10's day templates into a stream that actually owns them, or delete them from the spec and state that v3's forms stand. Restate every overlap threshold against a measured baseline with a named metric. Fix the array-index tiebreak. Add the spec-parity check §13 claims CI already has.
