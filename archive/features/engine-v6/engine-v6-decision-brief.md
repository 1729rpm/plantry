# Engine v6: grounding and the decisions to take before planning

Written 2026-09-04 by the EM session, from the v6 spec (`features/engine-v6.md`), both dry runs
(`engine-v6-dry-run-menu.md`, `engine-v6-dry-run-2.md`), the three v6 reviews (reviews 4, 5, 6),
the earlier v5 material (reviews 1 and 2, `engine-v5.md`), the household rulebook, and the 8-week
as-eaten record. Nothing here is new measurement; every number is taken from those files. The
purpose is to settle what the reviews established, name the root causes behind what is still open,
and put the decisions in front of Rajat before any implementation planning starts.

Vocabulary that an experienced PM would not necessarily carry is explained at first use and
collected in §6.

## 1. Where we are

The engine has been through four designs in six weeks. The short lineage:

| Version                  | Chooser                                                                                                                                                                           | What killed it                                                                                                                                                                                                                                        |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v4 / v4.1 (Aug 10 to 18) | Frequency-first with a saturating count, day templates                                                                                                                            | A self-referential frequency window that flushed the household record by week 11 and starved 32 of 65 staples; templates never implemented. Branch open, unmerged.                                                                                    |
| v5 (Aug 25)              | "Due-ness": saturating count plus waiting time, deterministic ranking                                                                                                             | Review 1: a rigid weekday template on 47 of 50 breakfasts, a 4-main Saturday carousel, internationals welded to Tuesday and Friday, and category rates tracking library size instead of household appetite (chicken 2.3 a week against an eaten 1.4). |
| v6 round 1 (Aug 27)      | Record-matching: rate-deficit scheduling, plan-then-place, two anchors only                                                                                                       | Reviews 3 and 4: the structural v5 complaints resolved (7 of 13), but plates inflated to 27 percent four-item lunches, paneer at lunch quadrupled through exploration, egg mains migrated to lunch, protein salads appeared.                          |
| v6 round 2 (Aug 31)      | Same, plus seven amendments (seed history retired, backdated cold start, day-scoped protein floor, optional Saturday accompaniment, exploration family governor, gate exemptions) | Reviews 5 and 6: every one of the 17 audited items resolved or improved; what remains is placement, rigidity, and slow drift, not level.                                                                                                              |

Two ideas explain why v6 exists, and they are now settled facts rather than hypotheses.

**RC1, the limit cycle.** A limit cycle is a loop of states a deterministic system falls into and
repeats forever. v5 was a fixed ranking iterated on a weekly grid, so it locked into a cycle whose
phase welded to the weekdays: every Tuesday avocado toast, every Wednesday missi roti. The
household has exactly two weekday structures (Saturday treat, Thursday eggs); v5 invented ten.

**RC2, the destroyed frequency signal.** A saturating count (a score that stops growing at a cap)
made every established staple tie, so selection degenerated into take-turns rotation, and rotation
serves every dish in a pool at the same rate. Output frequency then tracked how many dishes a
category has in the library, not how often the household eats it. The household's distribution is
heavy-tailed (a few staples repeat constantly while roughly 24 of 34 lunch mains appeared exactly
once in 8 weeks); rotation's output is near-uniform. No cap layered on top changes that.

v6's answer is to make the record the target distribution. Each dish carries a rate (eaten count
divided by record weeks) and a running deficit: it accrues its rate every week and is charged one
serving when placed, and the highest deficit wins. This is error diffusion, the standard way to
reproduce a fractional average with whole units (a dish eaten 1.4 times a week comes out 1, 2, 1,
1, 2). Family rates need no mechanism because a family's rate is the sum of its dishes' rates.

## 2. What the reviews settled

These are the load-bearing conclusions. They should not be reopened in planning.

1. **The architecture is right.** Every complaint that was about a level (how often a family or
   dish is served) has been resolved or brought within about 10 percent of the household by round
   2: chicken, paneer, dal, plain roti, fish, prawn, raita, international rate, plate size,
   standalone boiled eggs, dal-led lunches, carb internationals taking a protein. Review 6's
   scoreboard is 17 of 17 resolved or improved, none worse at the headline level. The chooser
   does not change again.
2. **Rate-deficit scheduling reproduces the record's statistics.** At 10 weeks 10 of 12 fidelity
   families pass; at 60 weeks 8 of 12. The four that fail at 60 weeks fail for identifiable
   mechanical reasons (§3), not because the idea is wrong.
3. **The 10-week window flatters.** Review 6 lists nine axes on which the 10-week and 60-week
   reads disagree, and on seven of them the longer run is worse. The 60-week self-feeding run,
   measured on weeks 20 to 60, is the only gate that counts. (A self-feeding simulation is one
   where each generated week is treated as eaten and fed back into the record that produces the
   next week, so the engine's own output shapes its future input.)
4. **The seed history was correctly retired.** Dropping the 5 pre-correction weeks removed the
   never-eaten sandwiches, poha, and sprouts salad and brought paneer and egg lunches down. Its
   one cost (breakfast variety narrowing to 12 mains) is a novelty-channel gap, not a reason to
   restore the seed.
5. **The day-scoped protein floor and the Keto-or-Dry restriction work.** Floor appends fell
   from 23 to 9 in 10 weeks, four-item lunches from 27 to 6.7 percent (household 6.8), protein
   salads from 6 to 0.
6. **The rulebook amendments in review 2 are the reference.** Fifteen changes (anti-template
   rule, fruit breadth, floating internationals, no-repeat Saturday, plain roti as workhorse,
   chicken ceiling, carb internationals take a protein, boiled eggs as a main, paneer budget, dal
   as star, raita equal to salad, repetition budget, soya narrowing, breakfast pool drift, and the
   no-change verdicts). They are agreed in substance. They have not yet been written into
   `household-menu-rules.md`, which the v6 spec says must happen before implementation (§14.6).
7. **Three content tasks are known and independent of the engine:** the Winter fruit pool is
   3 dishes (banana, papaya, pomegranate) so no mechanism can produce 4 distinct Winter fruits; the
   breakfast Dry dishes need retagging; tofu and soya-as-protein dishes need deactivating.
8. **Reviewers keep flagging things the household rulebook deliberately gave up.** The erased
   weekday signatures (Friday roti, Thursday seafood, Tuesday international) come up in reviews 3,
   5, and 6. Rajat's own anti-template rule (review 2, change 1) says only two anchors exist. This
   is a decision already taken, listed in D10 only so it stays taken consciously.

## 3. What is still open, by root cause

Twelve or so symptoms remain across reviews 5 and 6. They collapse into five mechanisms. This
table is the basis for the decisions in §4.

| Root cause                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Symptoms it produces                                                                                                                                                                                                                                                                              | Decision   |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| **A. Slot demand exceeds pool supply, and the self-feed ratifies the overflow.** A structural slot (the carb) demands about 3.4 fills a week while the carb pool's rates sum to 3.1; the overflow lands on low-rate specialty rotis by turn. The optional accompaniment slots (complete-meal companion plus Saturday) are offered about 2.5 times a week against a pool summing to about 1.75. The seeded cold start hands every dish in a large pool up to one banked serving, which is a transient of several extra servings over the first 10 weeks. Every extra serving raises that dish's own rate, so the self-feed locks the over-serve in. | Specialty roti +76 percent at both horizons. Salad +47 then +40. Breakfast chutney 54 percent vs 42, with chutney on mains the household never pairs it with.                                                                                                                                     | D2, D3, D9 |
| **B. Pools scoped to the wrong occasion.** The Saturday treat pool is every complete-meal dish with its all-week rate, so dishes the household eats on weekdays (Singapore noodles twice on a Tuesday and a Wednesday, curd rice on a Monday, white sauce pasta, veg fried rice, khichdi) top the Saturday slot. Fruit already has occasion-scoped rates (per season); Saturday does not.                                                                                                                                                                                                                                                          | International treats on 6 of 10 Saturdays (household 2 of 8), steady at 25 of 41 by week 60. Khichdi on 10 of 41 Saturdays, Singapore noodles 8. Carb internationals losing their protein specifically on Saturday. The international upper-bound breach on the all-mains count.                  | D4         |
| **C. Deterministic tie-breaks that never vary.** Never-eaten dishes have no weekday history, so the least-recently-used day assignment (LRU: place a dish on the weekday it has occupied least recently, with never-occupied days counting as oldest) breaks their tie Monday-first every week. Exploration picks, and the roti they carry, land on Monday.                                                                                                                                                                                                                                                                                        | Exploration on Monday 10 of 10 weeks (64 of 71 picks on Monday or Tuesday by week 60); roti holding Monday lunch 22 of 41; the Monday main a never-seen dish 9 of 10 weeks where the household's Mondays were all staples.                                                                        | D8         |
| **D. The exploration channel is one-slot, too hot, and blind to meal.** It always runs two picks (the spec says "up to two, at least one" with no selector), only into weekday lunch, ranked by an ingredient-affinity score computed over all meals. Egg and paneer dominate the household's breakfasts, so the score keeps proposing egg and paneer lunch dishes. The family governor demotes whole families en bloc, so both picks come from the same starved family.                                                                                                                                                                           | 2.0 novel dishes a week vs 0.75 household; egg-led lunches 0.6 a week vs 0.125 (5 of 6 exploration picks); same-family pairs in 5 of 10 weeks (fish curry with fish fry, then fish tikka two days later); breakfast variety 12 mains vs 14 in fewer household weeks; no new fruit can ever enter. | D6, D7     |
| **E. The self-feed ratchet.** In the simulation nothing is ever swapped out, so any over-serving from A, from protein-floor picks, or from dry-protein companions (4 of 9 floor appends and 3 of 4 international partners in round 2 were chicken) raises that family's rate, which raises next week's accrual. A positive feedback loop, slow but unbounded in the passive case. In production the household corrects it by editing; the better the engine gets, the less it is corrected.                                                                                                                                                        | Chicken +16 at 10 weeks, +26 at 60; mutton +20 then +27; salad and specialty roti not recovering with horizon.                                                                                                                                                                                    | D9         |

Two more items are gate arithmetic, not mechanism, and are handled in D11: the Jaccard baseline
(review 6 recomputed the household's week-over-week overlap as 0.207 on the 8 as-eaten weeks,
against the 0.263 the spec quotes), and the coverage clause that fails only on four Monsoon-only
fruits that cannot be served for 26 weeks by eligibility alone.

## 4. Decisions

Each carries the question, the evidence, the options, and a recommendation. Where a decision is
Rajat's to make on taste rather than evidence it says so.

### D1. Version: amend v6 in place, or open v7?

Every change below extends the record-matching mechanism (scoped rates already exist for fruit;
slot-level metering is the same ledger applied one level up). None replaces the chooser.
Recommendation: **v6, round 3 amendments**, written into `engine-v6.md` with "(Amended by
measurement)" notes exactly as round 2 did. Reserve v7 for a chooser change. Opening v7 would
signal a fourth architecture to a reader of the CHANGELOG when the third one is working.

### D2. Meter optional slots at the slot level, not only the dish level

The spec claims plate sizes are "metered by the record's own companion rates", but the gating is
"include the optional element when the top dish in its pool has a positive deficit". With a pool of
ten low-rate dishes and a seeded cold start, some dish is nearly always positive, and every extra
fill ratchets. The observed presence rates are known: chutney on 42 percent of breakfasts, a
Saturday accompaniment on about half of Saturdays, a companion beyond star and carb on some
measurable share of weekday lunches.

Options: (a) leave as is and rely on the cold-start cap tuning (D9); (b) give each optional slot
its own rate and deficit derived from the record (accrue the presence rate weekly, charge one per
fill, fill only when the slot's deficit is positive, then pick the dish by dish deficit); (c) a
fixed per-week budget per slot type (a v4 idea the spec deliberately removed).

Recommendation: **(b)**. It is the same mechanism the engine already trusts, it turns "ceilings,
never targets" into arithmetic, and it removes the salad and chutney over-serve at the source
rather than by tuning. It also decides Saturday accompaniment presence (currently 8 of 10 with the
option effectively never exercised).

### D3. Structural slots with an exhausted pool fall back to the workhorse

When a structural slot (carb, star, breakfast main) finds every dish in its pool at a negative
deficit, the spec fills it with the least-negative dish. In a pool where plain roti sits at 2.1 a
week and each specialty roti at 0.25, "least negative" hands the overflow to the specialty rotis by
turn, which is how they run +76 percent. Rajat's rulebook (change 5) already says specialty rotis
are occasional substitutions for plain roti.

Recommendation: **when no dish in a structural pool is positive, fill with the highest-rate dish**,
ties by id. One line in §3, and it generalizes: the fallback for any structural slot is the thing
the household eats most, which is what a person would reach for.

### D4. Scope the Saturday treat pool to Saturday

Fruit rates are already season-scoped; the Saturday treat is not occasion-scoped, so weekday
complete meals compete for it with weekday-earned rates. Recommendation, three parts:

1. **Saturday-scoped rates for the treat slot:** a dish's Saturday rate is its as-eaten Saturday
   rows divided by record weeks. Weekday internationals stay in the weekday star pool. This alone
   removes Singapore noodles, curd rice, white sauce pasta, and veg fried rice from Saturday and
   ends the international-Saturday lock and the Khichdi over-serve.
2. **A Saturday novelty door.** The Saturday-eaten pool is 7 library dishes (dosa was custom), each
   at rate 0.125, so a Saturday-scoped pool cycles every 7 weeks and just misses the
   "distinct within rolling 8" gate. The household's 8 Saturdays were 8 distinct mains, which
   says its register is wider than what 8 weeks show. Allow one exploration pick into the treat
   slot roughly every fourth Saturday, ranked by affinity, with weekday-eaten complete meals as the
   most familiar candidates. The spec's "never on Saturday" (§7) is reversed for this one door.
   This is Rajat's call on taste: a curated treat-register tag on the library (the v5 approach)
   is the alternative, and it is simpler but hand-maintained.
3. **The carb-forward-international rule applies on Saturday too.** The household paired Thai
   pineapple fried rice with fish tikka on a Saturday; round 2 served all 6 Saturday carb
   internationals with raita, salad, or hummus and no protein.

### D5. Dessert on every Saturday, or at the observed rate?

Round 2 serves dessert on 41 of 41 Saturdays. The household had it on 6 of 8, and the two
dessert-less Saturdays were both protein-led savory plates (khichdi with mutton pepper fry, fish
tikka with Thai fried rice). v5 §3 argued the household "added the missing ones by hand", which the
as-eaten record does not support. This is a taste decision. Under D2 the dessert slot could carry
a rate of 0.75 like any optional element. Recommendation: **keep dessert structural**. The cost of
an unwanted dessert is one tap, the treat day is the one place the product promises indulgence,
and two data points are not enough to learn a pattern. Rajat may prefer the observed rate.

### D6. Exploration: rate, pairing, and meal-scoped affinity

Three sub-decisions.

1. **Rate.** "Up to two, at least one" is not a rule, it is a range, and the simulator resolved it
   to always two. The household's own novelty ran at about 0.75 a week. Recommendation: **one
   weekday-lunch pick per week** as the product dial, with the second pick removed rather than
   made conditional. This halves the record pollution (20 new rows per 10 weeks, each demanding
   future placements), removes the same-family pairs by construction, and cuts the egg and paneer
   lunch pressure roughly in half on its own.
2. **Meal-scoped affinity.** The familiar-but-new score measures shared-ingredient frequency across
   the whole record, so egg (dominant at breakfast, once at lunch in 8 weeks) reads as the most
   familiar lunch ingredient. Recommendation: **compute the affinity score over rows of the
   candidate's own meal type**. That is the precise fix for egg-led lunches at five times the
   household rate; the family governor was treating the symptom.
3. **Family governor.** With one pick a week the pairing artifact disappears; keep the governor as
   is.

### D7. Where novelty is allowed to enter

The household's new dishes in 8 weeks roamed: 4 new breakfasts (red sauce pasta, grilled cheese,
anda paratha, masala oats), custom lunches, a Saturday dosa with atta halva. v6 explores only
weekday lunch, so breakfast variety has fallen below the household's (12 mains vs 14) and the
fruit pool can never grow. Recommendation:

- **Breakfast:** one exploration pick every second week, ranked by the same meal-scoped affinity.
- **Saturday:** one every fourth week (D4.2).
- **Fruit:** not an exploration pick but a thin-pool rule: when a season's eaten fruit pool holds
  fewer than 4 dishes, admit never-eaten in-season fruits at a nominal rate until it does. This
  pairs with, not replaces, the §14.4 Winter pool content check.

Total novelty comes to about 1.75 placements a week across all surfaces, down from 2.0 all at
lunch. If Rajat wants the household's 0.75, drop the breakfast door and keep lunch at one.

### D8. Break the Monday lock without randomness

Never-occupied weekdays tie, and the tie breaks Monday-first, so exploration picks and the plates
they ride on go to Monday every week. Options: (a) a stable hash of dish id and week start as the
tie-break (deterministic, reproducible, but looks arbitrary in a diff); (b) assign exploration picks
last, after every repertoire dish has taken its day; (c) an LRU at the slot level: the
exploration slot itself remembers which weekday it last used and rotates. Recommendation: **(b)
plus (c)**. No hashing, no randomness, the roti Monday lock disappears with the exploration lock,
and the household's habit of familiar Mondays is restored as a side effect.

### D9. Separate mechanism bias from self-feed drift

The passive simulation is a worst case: it assumes the household accepts every proposal for 60
weeks. In production about half of every week is hand-edited, and each edit teaches the ledger.
But the product's aim is fewer edits, so the engine cannot rely on being corrected. Rather than an
engine mechanism (a chicken ceiling, or weighting household-authored rows above engine-proposed
ones, both of which reintroduce the per-family rules v6 removed), recommendation:

1. **Run the gate twice:** once with rates frozen at the cutover record (this measures the
   engine's own bias, and any family that fails here needs an engine fix) and once self-feeding
   (this measures drift). A family that passes frozen and fails self-feed is drift, not bias.
2. **Add a drift bound** to the gate: each family's rate over weeks 40 to 60 within 10 percent of
   its rate over weeks 20 to 40. This catches runaway, which is the real risk, without pretending
   a slow +26 percent over 60 unedited weeks is a defect.
3. **Tune the cold-start cap** as §14.2 already asks: measure 0.5 alongside 1, and a pool-level
   variant where a pool's total banked seed cannot exceed its weekly rate sum. Cause A's
   transient is mostly the seed.
4. **A production monitor** in the slow loop: family rates over the trailing 8 served weeks
   against the 8-week baseline, reported monthly.

### D10. Leave alone, consciously

These get flagged by every reviewer and the recommendation is no change, with the reason recorded
so the next reviewer's report can be read against it.

- **Metronomic cadence** (chole on weeks 1, 5, 9; fish exactly once a week). Error diffusion
  produces the most even spacing possible; the household is bursty. No hand-edit reason ever
  said "too regular"; the household's bursts were seasonal (5 of 6 salads pre-monsoon) or
  cravings, and swaps handle cravings. Engineering burstiness means adding noise to a system
  whose determinism is a feature.
- **No within-week repeats of ordinary dishes.** The deficit charge allows a second placement only
  above deficit 1, which only true staples reach. That is the rulebook's rule 16 exactly.
- **Erased weekday signatures.** Tuesday international was 5 of 7; the anti-template rule says
  two anchors only. A third anchor is a taste decision for Rajat; the recommendation is no.
- **Avocado toast exactly once a week.** It is the one favorites-table row; the table is a product
  guarantee Rajat set. Not an engine matter.
- **Thursday boiled eggs at 34 of 41** vs the household's 7 of 8. Household-matching in kind,
  stricter in degree; acceptable.
- **The protein floor and the weekday non-veg rate** (74 percent vs 58). Review 6 could not find
  a floor regression after the day-scoping; the residue is the star pool being protein-led, which
  is the record's own shape at the star level. Re-measure after D2 and D9 before touching it.

### D11. Gate text amendments (spec housekeeping, no design content)

1. Re-measure the household Jaccard baseline with the harness's own method on the 8 as-eaten
   weeks and set the band around it (review 6 found 0.207, not 0.263). Jaccard is set overlap:
   the shared dishes of two consecutive weeks divided by their union.
2. Coverage: "every dish with eatenCount of 2 or more is served at least once in any rolling
   20-week window in which it is eligible."
3. International persistence counts weekday lunch stars only; Saturday is governed by D4.
4. The fruit twice-a-week cap gets the same thin-pool exception the consecutive-day rule has.
5. Saturday treat distinctness: "no repeat within rolling min(8, Saturday pool size) Saturdays."
6. Add to fidelity: breakfast small-item presence, weekday companion presence, Saturday
   accompaniment presence, and total novelty placements per week, each against its record rate.
7. Add the frozen-rate run and the drift bound (D9).
8. Prep ceiling: add a final repair, replace the star with the next-ranked star that fits, and
   report the day if none does. One day in 41 currently sits at 125 minutes with nothing
   droppable.

### D12. Process before round 3

1. **Refresh the record.** The as-eaten pull is dated 2026-08-27 and ends at the week of
   2026-08-10. Prod has served three or four more weeks since. Round 3 should start from the
   current record (read-only pull, prod approval needed).
2. **Apply the review-2 amendments to `household-menu-rules.md`** before the spec is amended, so
   v6 cites the rulebook it claims to.
3. **Content tasks run first and in parallel**, since they change the simulation's inputs: the
   Winter fruit pool check, the soya and tofu deactivation, the breakfast Dry retag.
4. **Commit the `features/` files.** Thirteen documents of this cycle are untracked. They are the
   only record of why v6 looks the way it does.
5. **One clean-room review per round**, in the review-5 style (menu against household, no
   preamble), plus the resolution audit. Every round so far has surfaced regressions the preamble
   did not, so the reviews are earning their cost.
6. **Log the decisions taken here in `DECISIONS.md`** once Rajat confirms them; the log has no
   v5 or v6 entry yet.

## 5. Suggested order of work

1. Rajat confirms or amends D1 to D12.
2. Content tasks (D12.3) and the rulebook amendment (D12.2), as their own PRs.
3. Record refresh (D12.1).
4. Spec amendments to `engine-v6.md` (D2 to D9, D11).
5. Round 3 dry run: 10-week menu for reading, 60-week gate under frozen and self-feeding rates,
   with the cold-start cap variants.
6. Review 7 (round 3 vs household, round 3 vs round 2).
7. If the gate is clean on weeks 20 to 60: implementation planning, the v4.1 salvage list
   (§14.3), and the wholesale rewrite of `docs/engine.md`.

## 6. Vocabulary

- **Deterministic:** the same inputs always produce the same output; there is no randomness. v6 is
  deterministic byte for byte, which makes dry runs reproducible and diffs meaningful.
- **Limit cycle:** a loop of states that a deterministic system settles into and repeats forever.
  On a weekly grid the loop's phase locks to weekdays, which is how v5 produced day templates.
- **Saturating count:** a score that stops increasing at a cap, so a dish eaten 4 times and one
  eaten 40 times score the same. It flattens the frequency signal.
- **Heavy-tailed distribution:** a distribution where a few items account for most of the mass and
  a long tail of items appear rarely. Household dish frequencies are heavy-tailed; a rotation
  produces a near-uniform distribution instead.
- **Error diffusion:** reproducing a fractional average with whole units by carrying the
  rounding error forward (a rate of 1.4 a week is served as 1, 2, 1, 1, 2). The deficit ledger is
  error diffusion over dishes.
- **Self-feeding simulation:** each generated week is treated as eaten and added to the record
  that generates the next, so the engine's output shapes its own future input. It is the only way
  to see interaction effects, and it is also a worst case because nobody edits.
- **Warm-up versus steady state:** the early weeks of a simulation are dominated by the starting
  conditions (here, the seeded deficits); the steady state is what the mechanism does on its own.
  Weeks 20 to 60 are the gate window for that reason.
- **Positive feedback loop, or ratchet:** an effect that amplifies its own cause. Over-serving a
  family raises its rate, which raises its accrual, which serves it more. Slow here, but unbounded
  without correction.
- **Transient:** a temporary effect that decays; the seeded cold start's extra servings in the
  first 10 weeks are a transient, and the ratchet is what keeps them from decaying.
- **Least-recently-used (LRU):** a scheduling rule that picks the option used longest ago. v6
  assigns dishes to weekdays by the weekday each dish has occupied least recently.
- **Jaccard index:** a set-similarity measure, the size of two sets' intersection divided by their
  union. Used here for week-over-week menu overlap; 0 means no dishes shared, 1 means identical.
- **Satisfiability:** whether a threshold can be met at all given the inputs. A 4-distinct-fruit
  floor is unsatisfiable when the eligible pool holds 3 fruits.
- **Goodhart's law:** when a measure becomes a target it stops being a good measure. It is why
  D11 re-measures the Jaccard baseline rather than simply widening the band until round 2 passes.
- **Stable hash:** a function that maps an input (say a dish id and a date) to a fixed, arbitrary-
  looking number. It gives deterministic variety without randomness. Considered and not
  recommended in D8 because a slot-level LRU achieves the same without opacity.
