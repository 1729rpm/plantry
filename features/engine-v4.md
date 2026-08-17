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
