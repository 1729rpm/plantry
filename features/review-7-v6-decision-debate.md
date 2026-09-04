# Review 7: a three-round debate on the v6 decision brief (D1 to D12)

Run 2026-09-04 by two independent agents with the same reading list (the decision brief, the v6 spec, the round-2 dry run, the as-eaten weeks, the rulebook, reviews 5 and 6). One argued for engine simplicity, the other for serving every recorded use case without creating new problems. Rounds 1 are independent openings; rounds 2 and 3 are rebuttals to the other side's previous round. Reproduced verbatim, in order. The orchestrator's synthesis and the questions put to Rajat are recorded in DECISIONS.md once answered.

---

# Round 1: simplicity advocate

Baseline I measure everything against: the household made 206 hand edits in 8 weeks, about 26 a
week or 110 a month (46 deletions, 26 additions, the rest swaps). A mechanism earns its place if it
removes a repeated, visible share of those edits at a cost in state and rules that a reader of
`engine-v6.md` can still hold in their head. A thing that happened twice in eight weeks is a tap,
not a use case.

One piece of arithmetic underlies several verdicts below, so I state it once. The record is
cumulative and self-fed, and each week's rate is rows divided by weeks. If the engine serves a
family at exactly its current rate, the rate stays where it is; there is no restoring force pulling
it back to the household's original level. So any one-time over-serve (a seed transient, a
structural overflow) shifts the rate and the shift is permanent. Salad is the worked example: the
pool holds 5 dishes, the seeded cold start hands each up to one banked serving, round 2 serves
11 salads in 10 weeks against 7.5 expected (3.5 extra), and the record's salad rate moves from
0.75 to about 1.0 and stays there, which is the +39.8 percent still visible on weeks 20 to 60. The
"ratchet" the brief describes is not slow and unbounded; it is a step that never decays. This
matters because it says the cause is the seed (a one-time event) and not the optional-slot rule.
For an optional pool the dish-level rule already bounds fills: a dish can only be filled when its
deficit is positive, so over any long window fills cannot exceed accrual plus the pool size. In
steady state the optional slots are already metered to the pool's rate sum; only the transient
leaks.

## D1

**Verdict: ACCEPT.** Amend v6 in place. With the ship list at the end of this document the diff to
`engine-v6.md` is one line in §3, one clause in §5.1, a scoping sentence in §2 and §5.4, and a
number change in §7. A version bump for that would advertise a fourth architecture where there is
none. Reserve v7 for a chooser change.

## D2

**Verdict: REJECT (b). Do the smaller thing: cold-start optional pools at zero.**

The steady-state over-serve on the optional slots is the seed transient locked in by the
cumulative record, not a hole in the positive-deficit rule (see the arithmetic above). Chutney is
the same story: 4 chutneys in the pool, 6 extra chutneys in 10 weeks (27 of 50 breakfasts against
15 of 36), and round 1, which had no seed, matched the household at 42 percent exactly (review 6,
regression 4). The seed exists for one reason the spec records: an all-zero start starves the
once-eaten tail of the structural star pool. Optional pools have no starvation problem, because
an unfilled optional slot is the intended behaviour. So the precise fix is one sentence in §3:
"the backdated cold-start seed applies to structural pools only; optional pools start at zero."
That is zero new state, and it is a free variant in the §14.2 cap-sensitivity run the EM already
plans (D9.3).

What (b) would cost: a rate and a deficit per slot type (small), plus a new derived structure the
spec does not have today, a classification of every record row into a slot role (is the bhindi on
"Toor dal, Fish tikka, Bhindi, Beetroot roti" the companion, or is the dal?), plus an
underspecified interaction (slot deficit positive but every dish in the pool negative: fill or
not?), plus a second cold-start question for the slot ledger itself. And because the slot rate is
also derived from the self-fed record, (b) carries the same lock-in property; it only helps by
being seeded smaller. The use case it serves is about 4 to 5 extra optional items a month across
salad (0.35 a week extra), chutney (0.6 a week), and Saturday accompaniment (8 of 10 versus 4 of
8); every one of them is a deletion, the household's single most practised edit. If the zero-start
variant does not bring salad and chutney inside the bar on the frozen-rate run, then (b) is the
next thing to try, and I would accept it then.

## D3

**Verdict: ACCEPT, extended to every structural fill.**

"Least negative" spreads overflow uniformly by count across a heavy-tailed pool, which is RC2
(rotation) reappearing in the overflow, and it is why specialty roti sits at +76 at both horizons
while plain roti is within 1 percent. "Highest rate, ties by id" is one line, no state, and it is
what a person reaching into the fridge does. Specialty roti costs the household roughly 2 swaps a
month today (1.10 versus 0.625 a week). Two additions: (1) write the rule for every structural
fill, the star, the carb, the breakfast main, the floor append, and the carb-international dry
protein, since the floor and the partner slot are where 7 of 13 chicken placements came from in
round 2; (2) ask the harness to report negative-deficit fills per role per week. That one number
is the diagnostic for cause A everywhere at once and it costs nothing. Expect the star overflow to
move onto fish tikka (rate 0.875), which the household already eats twice in a week when it
likes; the frozen run will say whether that is acceptable.

## D4

### D4.1

**Verdict: ACCEPT.** This is every week's showcase meal, and the household's 8 Saturdays were 8
distinct mains with internationals on 2 of 8, against round 2's 6 of 10 and 25 of 41 by week 60.
Left alone this is 2 to 3 Saturday swaps a month on the one meal the product promises to get
right. The mechanism is the one the engine already uses for fruit (occasion-scoped rates), applied
to one more occasion. State it symmetrically so it stays one concept: a lunch dish's rate for a
slot is computed over record rows of that slot's occasion (weekday or Saturday), the way a fruit's
rate is computed over its season. Symmetry also stops chole bhature and khichdi surfacing as
weekday stars (round 2 has "Chole bhature, Cucumber raita" on a Friday and "Khichdi, Cucumber
salad" on a Thursday, plates the household never served on a weekday).

### D4.2

**Verdict: REJECT. No Saturday exploration door.** The worry is a 7-dish Saturday pool cycling
every 7 weeks. Three things shrink it without a mechanism. First, the household's own Saturday
novelty was 1 custom in 8 weeks (dosa), one every eighth Saturday, not every fourth. Second, the
record refresh (D12.1) adds 3 or 4 more Saturdays, and since the household has never repeated a
Saturday main that is 3 or 4 more pool members for free; the custom-dish promotion process adds
dosa and atta halva as well. Third, a swap-in is already the engine's teacher (§3 reconciliation):
one tap on a Saturday adds a treat to the pool permanently at a live rate. The door as proposed
costs a cadence (new state or a new rate slot), a reversal of §7's "never on Saturday", and puts a
never-eaten complete meal on the showcase day, which is the exact shape rule 13 says gets swapped
back (rogan josh, ratatouille, pesto pasta). If Rajat wants a curated treat register, a library tag
is content, not engine, and I would take that over the door. Note D11.5 (distinctness within
min(8, pool size)) makes the gate satisfiable without any of this.

### D4.3

**Verdict: ACCEPT.** A scope extension of an existing rule, zero new state. It fires about once a
month (the household's two international Saturdays split 1 and 1 on protein; under D4.1 the
international Saturday rate falls to about 0.25 a week anyway). Cheap and correct; not
load-bearing.

## D5

**Verdict: ACCEPT.** Dessert structural. The observed miss is 2 of 8, which is one deletion a month,
and both misses were on protein-led savory plates the household built by hand. Learning a pattern
from two rows is exactly the kind of mechanism this engine should refuse. Also do not give dessert
a rate ledger under D2; that is one more slot type for a one-tap saving.

## D6

### D6.1

**Verdict: ACCEPT, and this is the largest single edit-saver in the brief.** Household novelty ran
0.75 a week (6 customs in 8 weeks); round 2 runs 2.0 a week, all at weekday lunch. That is 5 extra
never-eaten lunch dishes a month, each the rule-13 shape ("unfamiliar dishes get swapped back to
staples"), so most of them are swaps waiting to happen. Removing the second pick also deletes
mechanism: the "companion-shaped pick attaches to the first accepting Indian plate", the
distinct-days constraint, and the same-family pairing (5 of 10 weeks) all go with it. One pick a
week is still above the household's 0.75; I would not go below it either, since novelty is the one
sanctioned product dial.

### D6.2

**Verdict: ACCEPT.** Meal-scoped affinity is a filter on an existing computation, no new state,
and it is the precise cause of egg-led lunches (5 of 6 exploration picks; 0.6 a week against
0.125). D6.1 alone would leave about 3 egg lunch picks per 10 weeks (weeks 1, 5, 10 of round 2);
D6.2 removes the ranking that produces them. Cheap and exact.

### D6.3

**Verdict: ACCEPT, with a governor-off variant in the round-3 run.** Keeping what exists costs
nothing new. But the governor is the only windowed computation in an engine whose §2 makes
"never windowed" a load-bearing property, and its job (stopping paneer exploration from raising
paneer's rate) may already be done by one pick a week plus meal-scoped affinity. Run round 3 with
it on and off; if the off run holds paneer inside the bar, delete it in a later round. A mechanism
should prove its keep against the frozen-rate gate.

## D7

### D7 breakfast door

**Verdict: REJECT.** The gap is 12 mains versus 14, and the 14 include thepla (once, week 1) and a
custom pasta (once). Rule 13 describes the breakfast repertoire as "about a dozen mains", which is
what round 2 serves. The four breakfasts the brief calls new (red sauce pasta, grilled cheese, anda
paratha, masala oats) all entered by the household's hand or by prod's existing exploration, and a
swap-in teaches the ledger permanently; that door is open today at one tap. The proposed door
costs a second cadence (every second week is a counter or a rate slot), affinity over breakfast
rows, and every breakfast composition check (small item, Thursday anchor exclusion, cross-meal
demotion) applied to a never-eaten main on a weekday morning. Total novelty under the EM's plan is
1.75 a week, 2.3 times the household. If Rajat wants novelty to roam, the amendment that adds no
state is: keep exactly one exploration slot a week, let its candidate pool span both meal types,
rank by meal-scoped affinity, and place by the winner's meal type. One dial, one cadence.

### D7 Saturday door

**Verdict: REJECT.** See D4.2.

### D7 fruit thin-pool rule

**Verdict: REJECT; do the content task.** The rule carries two magic numbers (a threshold of 4 and
a "nominal rate"). The alternative is the household's existing habit: fruit is "chosen, not
accepted" (rule 18; mango swapped in six times, pomegranate five, in 8 weeks). Each never-eaten
Winter fruit needs exactly one swap ever to enter the pool at a live rate, so the whole Winter
problem is at most 4 taps a season, after which the pool is 7. The §14.4 content check (are the
Winter fruits in the library and Active) is what actually gates this, and D11.4 and D11.6 make the
gate satisfiable while the pool is thin.

## D8

**Verdict: AMEND: (b) only; hold (c) in reserve.** (b) is a reorder of an existing priority list,
zero state. With one pick a week (D6.1) the exploration plate takes whichever weekday the four
repertoire stars leave after their own LRU picks, and those picks vary week to week, so the
leftover day should rotate on its own. (c) adds a slot-level memory and a strict Mon-to-Fri
rotation, which is itself a period-5 cycle (harmless at one-fifth occupancy, but it is a template
by another name). The slot anti-lock gate already measures exactly this failure (Roti on Monday 22
of 41); run (b), read the gate, add (c) only if Monday still wins. The household effect of the fix
is small in edits (the novelty is swapped regardless of day) but it clears a gate fail for free.

## D9

### D9.1

**Verdict: ACCEPT.** Harness work, no engine state, and it is the right instrument: because the
self-fed rate has no restoring force, the frozen-rate run isolates the engine's structural bias
(fills outside the ledger) from the lock-in. Any family that fails frozen has a slot overflow
somewhere, and D3 is the fix.

### D9.2

**Verdict: ACCEPT as a gate metric.** Cheap, harness-only. I would not treat the 10 percent number
as settled until the first frozen run says what the natural window-to-window noise is for a 2-row
family like mutton (13 servings against 10.25 implied is a granularity effect, not a trend).

### D9.3

**Verdict: ACCEPT, and run it before D2 is decided.** Add my D2 variant (structural-only seed) to
the set: cap 1, cap 0.5, pool-level cap, structural-only. The seed is a one-time event whose
effects are permanent, so this one measurement settles the largest remaining fidelity fails
(salad, specialty roti with D3, chutney) at no engine cost.

### D9.4

**Verdict: ACCEPT, as a table in the existing slow-loop report.** No new tables, no new Convex
functions. The baseline it compares against should be the refreshed record (D12.1), not the
8-week one, and it should be read knowing the household's own tastes move with season.

Agree with the EM's rejection of a chicken ceiling and of row weighting. Both are per-family rules
in a design whose one idea is that families need none.

## D10

**Verdict: ACCEPT all six.** Metronomic cadence: no edit reason ever said "too regular", and the
household's bursts were seasonal or cravings, which swaps serve. No within-week repeats of ordinary
dishes: that is rule 16 exactly. Erased weekday signatures: two anchors, decided. Avocado toast
weekly: the favorites table, not the engine. Thursday eggs at 34 of 41: household-matching in kind.
Weekday non-veg 74 versus 58: re-measure after D3 and D9.3, because the star-slot overflow (a
structural fill at negative deficit) is the likeliest source and both decisions move it.

## D11

1. Jaccard re-measure: **ACCEPT.** Goodhart-aware, and it says round 2 is within 9 percent of the
   household's real texture.
2. Coverage in-season qualifier: **ACCEPT.** Satisfiability.
3. International persistence on weekday stars only: **ACCEPT.** D4.1 governs Saturday.
4. Fruit twice-cap thin-pool exception: **ACCEPT.** Satisfiability.
5. Saturday distinctness within min(8, pool size): **ACCEPT.** This is also what makes D4.2
   unnecessary for the gate.
6. Presence-rate fidelity metrics: **ACCEPT.** Measuring is not mechanism; these four numbers are
   what decide whether D2 is ever needed. Add one more: negative-deficit fills per role per week
   (D3).
7. Frozen run and drift bound: **ACCEPT.** See D9.
8. Prep-ceiling star replacement: **REJECT the repair; amend the threshold.** One day in 41, at 125
   minutes, 5 minutes over a budget no household edit reason has ever mentioned (the recorded
   reasons are about volume, "Too much food", never time). A star replacement in the constraint
   pass cascades: the new star re-runs carb, companion, partner, gravy, and cross-meal checks.
   Change gate 10 from "zero days over 120" to "days over 120 reported; zero days over 150" and
   keep the existing report.

## D12

1. Refresh the record: **ACCEPT, and treat it as the cheapest mechanism in the brief.** Three or
   four more weeks is a 40 to 50 percent larger record, 3 to 4 more Saturday mains, and every
   custom the household ate. Run the custom-dish promotions first so dosa and atta halva enter
   the library and the pools.
2. Rulebook amendment first: **ACCEPT.**
3. Content tasks first and in parallel: **ACCEPT.** They change the simulation's inputs.
4. Commit the `features/` files: **ACCEPT.** Thirteen untracked documents is a risk, not a style
   point.
5. One clean-room review per round: **ACCEPT.** Every round's regressions came from the review,
   not the preamble.
6. Log in `DECISIONS.md`: **ACCEPT.**

## False choices and what none of the twelve addresses

- **D2 versus D9.3 is a false pairing.** They are substitutes for the same transient, and D9.3
  (with a structural-only seed variant) is the one with no engine cost. Measure it first.
- **D4.2's "door versus curated tag" is a false choice.** The third option, which already exists,
  is the household's swap plus the record refresh; both grow the Saturday pool at one tap or zero.
- **D7's fruit rule versus content is a false choice** for the same reason: one swap per new fruit
  per season seeds it forever.
- **Unaddressed: the record has no restoring force.** The brief calls the self-feed "slow but
  unbounded"; the arithmetic says "every transient is permanent". This is not an argument for a
  mechanism (the household's edits are the restoring force, and D9.1 measures the engine without
  them). It is an argument for being stingy about anything that places dishes outside the ledger's
  accrual: seeds, structural overflow, floor appends, partner slots. D3 plus the structural-only
  seed close most of those; the negative-deficit-fill metric watches the rest.
- **Unaddressed, and correctly so:** the one plate pairing two international mains (Veg hakka
  noodles with Thai basil chicken, 1 in 60 lunches) and the tomato soup companion (1 in 60). Not
  use cases. Leave them.
- **Unaddressed: custom rows contribute nothing to the record** (6 of 6 dropped in the dry run).
  In production the promotion process fixes this; D12.1 should confirm it ran before the pull.

## What I would ship as round 3

1. D6.1: one exploration pick a week, second pick removed.
2. D6.2: meal-scoped affinity.
3. D3: structural fallback to the highest-rate dish, written for every structural fill.
4. D4.1: occasion-scoped lunch rates (weekday, Saturday), symmetric, stated as the fruit rule
   generalized.
5. D4.3: carb-international partner rule applies on Saturday.
6. Cold-start seed applies to structural pools only (my D2 substitute), measured in the D9.3 cap
   sweep alongside the pool-level cap.
7. D8(b): exploration picks assigned last.
8. D9.1 and D9.2 in the harness; D9.4 as a slow-loop table.
9. D11 items 1 to 7, plus the negative-deficit-fill metric; D11.8 as a threshold change, not a
   repair.
10. All of D12, record refresh after custom promotion.

Not shipped: D2(b), D4.2, the D7 breakfast door, the D7 fruit rule, D8(c), the D11.8 repair. None
of them saves more than one or two taps a month against the household's 110, and each adds state
or a cadence a reader of the spec would have to carry.

---

# Round 1: coverage advocate

My brief is to make sure the engine serves every use case the eating record shows, at the rate the record shows it, so that each unserved case does not become a weekly hand edit. My discipline is that every mechanism I ask for has to be a general one the engine already trusts, bounded by a demand it cannot exceed, and unable to feed itself. Where a use case is too rare or too cheap to hand-edit to justify machinery, I say so.

## Record arithmetic I rely on

All counts are from `as-eaten-8-weeks.md` and `engine-v6-dry-run-2.md`; none are new measurements of anything else.

- The record holds 44 of 48 planned days (4 weekday skips), 36 breakfasts, 36 weekday lunches, 8 Saturdays. The engine plans 48 days in 8 weeks. A per-week record rate therefore understates the per-served-occasion rate by 48/44 (lunch, 9 percent) and 40/36 (breakfast, 11 percent). Re-scored per occasion, the 60-week fidelity fails become: chicken 1.732/6 = 0.289 per lunch against 11/44 = 0.250, +15.5; mutton 0.317/6 = 0.053 against 2/44 = 0.045, +16; salad 0.175 against 0.136, +28; specialty roti 0.183 against 0.114, +61. Two of the four 60-week fails are largely normalization, two are real.
- Breakfast chutney: 15 of 36 household breakfasts carry one, and all 15 sit beside a paratha (8), a chilla (3), or standalone boiled eggs (4). Zero of the other 21 breakfasts (avocado toast 6, bread omelette 4, sevai 4, sabudana 2, upma, oats, thepla, grilled cheese, custom pasta) carry a chutney. Round 2's 27 chutneys include 7 on sevai, bread omelette, grilled cheese, and sabudana; the household never made those pairings. Its 21 structural chutneys on 50 breakfasts are 42 percent, exactly the household's 42.
- Weekday optional companions (anything beyond star and carb on a standard plate): 24 fills on 21 of 36 weekday lunches (three plates carry two). Salad 6, raita or curd 6, sabzi sides about 10, dal sides about 6.
- Carb pool supply: plain roti 17, beetroot 3, missi 2, steamed rice 3 = 25 rows, 3.125 a week; the other 3 household carbs (curd rice, khichdi as a side, rajma chawal) are complete meals in the star pool, which is the 0.3 a week gap the brief measures as 3.4 demand against 3.1 supply.
- Saturday: 8 distinct mains in 8 Saturdays, 7 of them library dishes at 0.125 each (supply 0.875 against demand 1.0); dosa is custom. International on 2 of 8; dessert on 6 of 8; the two dessert-less plates were both protein-led savory. A third element beyond main and dessert on 5 of 8 (salad 2, raita 2, aloo matar 1), the special protein on 2, none on 1.
- Novelty by surface: 3 custom lunches (0.375 a week), 4 new breakfast entrants (0.5), 1 novel Saturday (0.125). Total about 1.0 a week; review 5's 0.75 counts only the 6 customs.
- Winter fruit: zero Winter weeks in the record, so the Winter pool runs on all-season fallback rates, banana 0.5, papaya 0.75, pomegranate 0.875 = 2.125 bowls a week against a demand of 6.
- Weekday lunches without meat, fish, or egg: household 15 of 36 (42 percent); round 2 13 of 50 (26 percent). This gap is not normalization.

## D1

**Verdict: ACCEPT.** v6, round 3 amendments in place.

Everything I ask for below is the deficit ledger applied to a new scope (a slot, an occasion, a surface) or a pool-supply rule at the boundary of the ledger. None touches the chooser. The lineage table shows what a version bump costs a reader (four architectures in six weeks); the record-matching idea is the first one whose failures are all at the edges, and the CHANGELOG should say so by keeping the number.

## D2

**Verdict: AMEND (b).** Meter every optional slot at the slot level with its own ledger, and define the slot's rate from the record rows that filled that optional slot, excluding structural fills; seed the slot ledger with the same capped backdated accrual a dish gets, so a slot can bank at most one fill.

Reasoning. The optional-slot over-serve has one root, cross-slot leakage: a dish earns its rate across every slot it ever filled, then competes in each slot with the whole rate, so each slot sees a supply the record never gave it, and the seeded cold start hands every dish in a ten-dish pool a banked fill on top (up to ten extra fills in the first weeks, ratified by the self-feed). A slot ledger is the same error diffusion one level up, bounded by the record's presence rate, and it cannot feed itself because a fill at the presence rate leaves the presence rate where it was. The precision I add matters most at breakfast: the household's optional chutney rate, once structural chutneys (paratha, chilla, standalone eggs) are excluded, is 0 of 21. A slot ledger at rate 0 never fires, the 7 off-register pairings in round 2 vanish, and chutney presence lands at the household's 42 percent by construction, with no tuning. Use case: about 2.5 a month (7 wrong chutneys in 10 weeks), each one a deletion the household would make. Seeding the slot ledger at min(rate × weeksSinceLastFill, 1) rather than leaving it to the dish seeds is what removes the cold-start transient at that slot; without it (b) only halves the problem.

Two honest limits. Saturday accompaniment presence is not far off (household 5 or 6 of 8, round 2 8 of 10); what is wrong there is the composition, which is D4.3, so D2 will not on its own fix the Saturday plates. And the weekday companion presence (21 of 36) is close to round 2's; D2 helps salads (+40 at 60 weeks) mainly through the Saturday accompaniment slot and the seed cap, not through the weekday slot.

## D3

**Verdict: AMEND.** Fill an exhausted structural pool with the highest-rate dish not already placed in the same week, ties by id, and apply it only after any thin-pool admission (D7) has run. Alongside, change the rate denominator from record weeks to record occasions of the dish's slot type (weekday lunches present, breakfasts present, Saturdays present), which removes most of the structural supply gap at its source.

Reasoning. The fallback matters because the self-feed locks in whoever absorbs the overflow: least-negative hands the carb gap to specialty rotis by turn (+76 at both horizons, 6 beetroot and 5 missi in 10 weeks against 3 and 2 in 8), whereas highest-rate hands it to plain roti, which the rulebook (change 5) names as exactly the substitution the household makes. The absorbed 0.3 a week takes roti from 2.1 to about 2.4 (+14, in band), and it is convergent, not a ratchet: in the self-feed the pool's rate sum rises to meet the fixed demand and the fallback stops firing. The same-week exclusion is not optional. The breakfast-main pool sums to 4.5 a week against 5 slots (the skipped days), and its highest-rate dish is avocado toast at 0.75, already pinned; without the exclusion the fallback serves it twice a week on alternate weeks, which the household did on 0 of 8 weeks. The ordering clause is for fruit: Winter supply is 2.125 against 6, and highest-rate fallback would put pomegranate on three or four days a week before D7's admission has a chance to fill the pool.

The denominator change is the general version of the same fix. Every family in the 10-week fidelity table over-serves by 14 to 20 percent; nine of those points are the engine serving 6 days where the household ate 5.5. Per-occasion rates distribute the extra 9 percent across all dishes in the household's own mix (which is where the self-feed converges anyway, so it also removes a transient) rather than leaving it for the fallback to hand to the workhorse. It is a one-line change to §2 and it has a precedent in the season-scoped fruit rate, which is already "rows per eligible occasion".

## D4.1

**Verdict: ACCEPT, with the ledger made precise.** A dish with Saturday rows carries a Saturday ledger (accrues its Saturday rate, charged when placed on Saturday); its weekday ledger accrues (eatenCount minus Saturday rows) over record occasions and is charged for weekday placements. A dish placed on Saturday is still excluded from a same-week weekday placement by the ordinary repeat rule.

Reasoning. Use case: every Saturday, 4 a month, and it is the single largest misread in round 2: international treats on 6 of 10 Saturdays against 2 of 8, Singapore noodles on 8 of 41 Saturdays when the household ate it on a Tuesday and a Wednesday, curd rice on a Monday becoming a treat, hummus (a weekday lead twice in the record) demoted to a Saturday side. Scoping is the same shape as the fruit rate: the rate belongs to the occasion. It cannot create a new problem because the Saturday pool's rate sum converges to exactly 1.0 in the self-feed (one Saturday main a week is served and added), so demand and supply match asymptotically; the only shortfall is the transient 0.875 at cutover, which D4.2 covers. A side benefit for the weekday: internationals that Saturday was consuming return to the weekday star pool, moving the weekday international rate (1.07 at 60 weeks) toward the household's 11 of 36 lunches (about 1.4).

## D4.2

**Verdict: ACCEPT, at one in four Saturdays, expressed as a novelty slot ledger with rate 0.25 (the D2 mechanism) rather than a calendar rule.** Candidates ranked by Saturday-scoped affinity (D6.2), with weekday-eaten complete meals never seen on a Saturday as the first tier and never-eaten complete meals as the second. Reject the curated treat tag.

Reasoning. The arithmetic is the argument: 7 library dishes at 0.125 each supply 0.875 against demand 1.0, and 7 dishes cannot satisfy "distinct within rolling 8" (Khichdi 10 of 41, Singapore noodles 8 of 41 are this pool cycling). A door at 0.25 lifts supply to 1.125 and makes 9 distinct mains available in 8 Saturdays; at the household's literal 0.125 (dosa) the pool sits exactly at 8, satisfiable with no slack. The household's 8 distinct mains in 8 weeks say the register is wider than the record, so the door is a coverage floor, not a novelty stream. It cannot ratchet: novelty picks are not chosen by deficit, an eaten pick joins the pool as one more 1/N-rate member (adding competition, not amplification), and a swapped-away pick earns nothing and is spaced 8 weeks. Expressing it as a slot ledger means the same mechanism serves the weekday and breakfast doors (D7); a calendar rule would be a third special case. The curated tag would be hand-maintained forever and would recreate v5's four-main carousel with a longer list.

## D4.3

**Verdict: AMEND.** The dry protein partner for a carb-forward international treat takes the Saturday accompaniment slot, chosen by deficit from the dry-protein pool, with precedence over salad, raita, and hummus; the plate stays at three items and the partner is subject to the same slot meter as any accompaniment.

Reasoning. In the record the pairing on Saturday is 1 of 2 (Thai pineapple fried rice with fish tikka; baked mozzarella pasta solo with kheer), so a hard rule would be a rule from n=2, which the rulebook's own standard excludes. Precedence inside the existing accompaniment slot serves the case (round 2 put raita, salad, or hummus and no protein on all 6 Saturday carb internationals, so 6 of 10 Saturdays were protein-less against 2 of 8) without a fourth item and without fighting "light by default". The partner is charged against its own ledger, so it cannot inflate a protein family beyond its rate; the record's own partners were chicken 4 of 7, so a chicken-leaning partner mix is the record, not a bias.

## D5

**Verdict: ACCEPT keeping dessert structural now, with the switch recorded.** Under D2 the dessert slot can carry a rate of 0.75 at zero extra machinery; set the trigger in the spec: if the refreshed record (D12.1) shows dessert-less Saturdays at 20 percent or more over 12 or more Saturdays, flip to the meter.

Reasoning. The use case is real but small: 2 of 8 Saturdays, both protein-led savory plates, about once a month, and the fix is one deletion. The engine currently serves 41 of 41 and the household 6 of 8, so the miss is about one unwanted sweet a month. Two rows are below the rulebook's own evidence bar, and a wrong "no dessert" costs an addition, which the household does less readily than a deletion (46 deletions to 26 additions). I would not spend a mechanism on it, but D2 makes it free, so the spec should say when it flips.

## D6.1

**Verdict: AMEND.** One exploration pick per week at weekday lunch is right as a ceiling; set the weekday lunch novelty slot's rate to 0.5, not 1.0, and put the other half of the household's novelty on the surfaces where round 2 has a deficit (D7).

Reasoning. The record's novelty is about 1.0 a week in total (0.375 lunch, 0.5 breakfast, 0.125 Saturday) and round 2 spends 2.0 a week all at lunch, so lunch is the one surface where the engine is over-serving novelty (5 to 6 times the household's custom-lunch rate) while breakfast variety fell below the household (12 mains against 14) and the fruit pool cannot grow. Halving lunch to one pick removes the same-family pairs (5 of 10 weeks) and halves the egg and paneer pressure, as the EM says; halving it again to 0.5 puts the lunch novelty at the household's own lunch rate and frees the budget for the surfaces that need it. Expressed as a slot ledger (rate 0.5, charge 1), the lunch door fires every second week with no calendar rule.

## D6.2

**Verdict: ACCEPT.** Compute the affinity score over rows of the candidate's own meal type; for the Saturday door, over Saturday rows.

Reasoning. Egg-led lunches at 0.6 a week against 0.125, 5 of 6 from exploration, is the whole animal-protein gap between the menus per review 5 finding 8 (chicken, fish, prawn, mutton each within 2 points per occasion). The score reads the record and writes nothing, so scoping it cannot create a loop. Saturday's 8 rows are thin but they are the right 8 rows; an all-meal score would rank egg and paneer dishes into the treat slot too.

## D6.3

**Verdict: ACCEPT.** Keep the governor.

Reasoning. With one pick a week the pairing artifact is gone by construction. The governor's remaining effect (a family at or above rate never receives a new dish) is acceptable because the household's largest lunch family already has 7 distinct chicken dishes in the record; nothing is starved.

## D7

**Verdict: AMEND.** Three novelty doors as three slot ledgers (the D2 mechanism), rates weekday lunch 0.5, breakfast 0.25, Saturday 0.25, independently metered, each firing when its own ledger is positive, each placed under D8, each ranked by meal-scoped affinity. Total 1.0 a week, against the household's measured 1.0 and review 5's 0.75. Fruit: ACCEPT the thin-pool rule, with the nominal rate defined as the slot's shortfall divided evenly among the admitted in-season candidates.

Reasoning. Breadth over volume is the coverage case: the household's one-offs roamed three surfaces (review 5 finding 4) and the engine confined 20 of 20 to weekday lunch. Breakfast is the surface with the measured deficit (12 mains against 14 in fewer weeks; the household added 4 in 8 weeks) and Saturday is the pool that cannot clear its own distinctness gate (D4.2). Sum of rates must not exceed what can be placed, and here it does not: three independent slots, one pick each at most, no cross-surface cap, so no ledger accrues un-servable deficit (a cap of one pick a week over rates summing above 1.0 would be a new pool with demand above supply, which I rule out). If Rajat wants 0.75, take the breakfast door to 0.125 rather than closing it: a closed door is a pool that can only shrink.

Fruit is the strongest thin-pool case in the record because the record has no Winter at all. Supply 2.125 against demand 6 means that without admission the three year-round fruits run at two a week each forever (round 2's identical Winter multiset every week, consecutive repeats in 20 of 41 weeks) and no orange, guava, grape, chikoo, or custard apple can ever enter. Defining the nominal rate as the shortfall (3.875 a week shared across the admitted candidates) makes the rule self-extinguishing: every eaten admission becomes a real row, the season's real rate sum rises, the shortfall falls, and the nominal rates fall with it to zero. Bounded by demand, so it cannot over-supply; extinguished by the record, so it cannot ratchet. It needs the §14.4 content task to have added Winter fruits to the library or there is nothing to admit.

## D8

**Verdict: ACCEPT (b) plus (c), applied to every exploration surface.**

Reasoning. 64 of 71 picks on Monday or Tuesday and roti holding Monday lunch 22 of 41 are one tie-break, so one fix. Assigning exploration last means the pick takes whatever day the repertoire leaves, which varies week to week because the repertoire's LRU varies; (c) breaks the remaining ties by the slot's own memory. With one lunch pick a week (c) alone would be a clean five-week rotation, which is not a lock under the gate (one day in five) and not a template under the anti-template rule (no dish keyed to a day). No randomness, no hash, and the household's familiar Mondays (6 of 6 staples) return because staples' never-occupied tie-break is Monday-first and they are placed first. The breakfast and Saturday doors from D7 inherit the same rule or they inherit the same lock.

## D9

**Verdict: ACCEPT 1, 2, and 4; AMEND 3 to add the per-occasion normalization; add a third gate run that exercises reconciliation.**

Reasoning. The frozen-rate run is the right instrument, but read at per-week rates it will report a 9 percent bias on every per-day family that is nothing but the engine serving days the household skipped; per occasion, chicken and mutton at 60 weeks are +15.5 and +16, inside the bar, so the "ratchet" the self-feed shows is about 10 points, not 26. The drift bound (weeks 40 to 60 within 10 percent of weeks 20 to 40) is the correct test of runaway and I have no amendment to it. The cold-start cap variants are worth measuring, but with D2's slot seeding most of the cause-A transient is gone before the cap is tuned, so measure them after D2 and D3 land, not before. The third run: the §3 reconciliation branch (swap-out keeps its charge, swap-in is charged) has never executed in any dry run (approximation 20), and it is the mechanism the whole production correction loop rests on. A harness-only "corrected" run that replays the record's own swap-away list (every dish the household swapped away in the 8 weeks is swapped away again whenever proposed, its replacement drawn by deficit) costs no engine machinery and tests the branch. A ceiling or an authorship weight would be a per-family rule fighting the ledger; I agree with the EM in rejecting both.

## D10

**Verdict: ACCEPT all six, with two flags.**

Reasoning. Metronomic cadence, the two anchors, avocado toast weekly, Thursday eggs at 34 of 41, and the erased signatures are Rajat's decisions or the ledger's nature, and the cost of "burstiness" is noise in a system whose determinism is the product. On within-week repeats I concede the coverage loss consciously: the household repeated a favorite in 4 of 8 weeks (fish tikka twice in weeks 3 and 4, grilled chicken twice in week 7, bread omelette twice in week 2) and the ledger cannot produce it (a 0.875-rate dish never banks the deficit above 2 that a same-week second placement needs), so it is a hand addition about twice a month; the ledger charges the addition and stays consistent, so the swap is cheap and safe. First flag: the weekday non-veg rate (74 against 58) is not normalization (household 21 of 36 weekday lunches carry meat, fish, or egg; round 2 37 of 50), and the missing shape is the veg-led weekday lunch (15 of 36, about 7 a month): mushroom matar with salad and roti, palak corn with stuffed capsicum and missi roti, hummus with beetroot roti and a sabzi, dal palak with mix veg. Re-measure after D2, D3, and D4.1 as the EM says, but add it to the fidelity table (D11.6) now so round 3 reports it. Second flag: hummus led 2 of 36 weekday lunches in the record and round 2 never leads with it (approximation 10 keeps Category Accompaniment dishes out of the star pool); that is a library category question for D12.3, not an engine rule.

## D11

**Verdict: ACCEPT all eight, with amendments to 1, 5, and 6.**

- 11.1 Re-measure the Jaccard baseline with the harness's own method; set the band at the measured baseline plus or minus 0.05 (0.157 to 0.257 if 0.207 holds). ACCEPT.
- 11.2 Coverage with an in-season qualifier. ACCEPT; the four Monsoon-only fruits are the whole fail.
- 11.3 International persistence on weekday stars only. ACCEPT; Saturday is D4.1's.
- 11.4 Thin-pool exception on the twice-a-week fruit cap. ACCEPT, but keep the 4-distinct floor unchanged: with D7's admission it becomes satisfiable, and lowering it would hide the very gap the admission rule exists to close.
- 11.5 Saturday distinctness within min(8, pool size). AMEND: count the D4.2 door's admitted candidates in the pool size, so the gate tests the pool the engine actually draws from (7 plus 2 in 8 weeks = 9, so the rolling-8 clause stays fully in force).
- 11.6 Add the presence and novelty fidelities. AMEND to add: per-surface novelty (lunch, breakfast, Saturday, each against its rate), weekday lunches with no animal protein (household 15 of 36), Saturday plate-shape distribution (2 versus 3 items, household 1 of 8 at 2), and state every fidelity comparison per occasion served, not per week, so the frozen run (D9.1) measures bias and not calendar arithmetic.
- 11.7 Frozen run and drift bound. ACCEPT.
- 11.8 Prep-ceiling final repair by star replacement. ACCEPT; one day in 41 is not worth more than one clause.

## D12

**Verdict: ACCEPT all six, with two additions.**

- Add to 12.1: promote the six custom one-offs (dosa, atta halva, red sauce pasta as a breakfast, paneer manchurian, stuffed capsicum, cabbage matar aloo) to the library and swap their slots to the library ids before the pull, so the refreshed record carries them as rows. Today they contribute nothing. After promotion the Saturday pool becomes 8 library dishes (supply 1.0 exactly), atta halva joins the dessert pool at 0.125 (the household's 5 distinct sweets in 6 servings against the engine's 4), red sauce pasta becomes a breakfast candidate with a real rate, and the three lunch customs give the exploration channel three household-authored "familiar" anchors. Six rows of coverage for the cost of a content step the repo already has a process for.
- Add to 12.3: the Winter fruit check must add real Winter fruits as Active in-season candidates (not only verify the pool is thin) or D7's admission rule admits nothing; and review the library category of hummus (a weekday lead twice in the record, never a lead in round 2).

## False choices

- D5 as structural-versus-rate: under D2 it is one number, and the real decision is the trigger for flipping it.
- D6.1 and D7 as "one lunch pick versus the household's 0.75": the dial that matters is the split across surfaces; the record is 0.375 lunch, 0.5 breakfast, 0.125 Saturday, and round 2 spends everything on the one surface where the household spent least.
- D3 least-negative versus highest-rate: much of the structural gap is the per-week denominator, and the fallback should be the last resort after per-occasion rates and thin-pool admission, not the main fix.
- D9 bias versus drift as measured today: per week, the frozen run will report a 9 percent bias that is calendar arithmetic; the bias-versus-drift split is only meaningful per occasion.

## Use cases in the record that none of the twelve serve

1. The six custom one-offs as record rows (D12 addition above). Highest value per unit of work in this whole list.
2. The veg-led weekday lunch, 15 of 36 (D10 flag; measure in round 3 before mechanism).
3. Hummus as a weekday lead, 2 of 36 (library category, D12.3).
4. The favorite's within-week repeat, 4 of 8 weeks: consciously unserved; a hand addition the ledger absorbs cleanly.
5. Winter fruit content: the record has no Winter, so every Winter fruit is a candidate until admitted (D7 plus D12.3 together; neither alone does it).
6. The one-item rich lunch (mutton keema, Thai basil chicken solo, 2 of 36): too rare to serve; a deletion handles it.

## What I would ship as round 3

1. D12.1 with the custom-dish promotion, then the record refresh; D12.2 and D12.3 including the Winter fruit additions. These change the inputs, so they go first.
2. D3 with the per-occasion denominator and the same-week exclusion; D2 slot ledgers with slot-level seeding (chutney first, then weekday companion, Saturday accompaniment, dessert at structural).
3. D4.1 Saturday-scoped ledgers, D4.3 partner precedence in the accompaniment slot, D4.2 as a 0.25 slot ledger.
4. D6.2 meal-scoped affinity; D7 as three slot ledgers (0.5, 0.25, 0.25) plus the fruit thin-pool admission with shortfall-based nominal rates; D8 (b) plus (c) on every door.
5. D9 gate runs (frozen, self-feeding, corrected) with per-occasion fidelity, the drift bound, and cap variants measured after D2 and D3; D11 text amendments including the three added fidelities.
6. D10 left alone, with the veg-led weekday lunch and the within-week favorite repeat recorded as consciously unserved and re-measured.

---

# Round 2: simplicity advocate

**Agreed** (no section below): D1 (v6 in place); D4.1 (occasion-scoped Saturday and weekday
ledgers, in the coverage side's precise form); D6.2 (meal-scoped affinity, Saturday rows for any
Saturday door); D6.3 (keep the governor; I still want a governor-off variant run, which costs
nothing); D9.1, D9.2, D9.4 as written, plus the coverage side's two additions, per-occasion
fidelity comparison and a third "corrected" run that replays the record's swap-aways so the §3
reconciliation branch finally executes; D10 all six plus both flags (veg-led weekday lunch into
the fidelity table now, hummus category to D12.3); D11.1, 11.2, 11.3, 11.6, 11.7 with their
amendments; D12 all six plus custom-dish promotion before the pull and real Winter fruit additions
in the content task.

Verification of the coverage side's new numbers, done by script over the two menu files:

- All 15 household chutneys sit beside a paratha (8), a chilla (3), or standalone boiled eggs
  (4); 0 of the other 21 breakfasts carry one. **Holds exactly.**
- Round 2 puts 7 chutneys on sevai, bread omelette, grilled cheese, and sabudana. **Holds.** Its
  structural chutneys are 20 of 50 (40 percent), not 21 (42); the household is 15 of 36 (41.7).
  One row, same conclusion.
- Per-occasion re-scoring: chicken 1.732/6 = 0.289 against 11/44 = 0.250 (+15.5); mutton 0.053
  against 0.045 (+16); salad +28; specialty roti +61. **Holds.**
- Zero Winter weeks in the record; Winter fallback rates banana 0.5, papaya 0.75, pomegranate
  0.875, sum 2.125 against 6. **Holds** (4, 6, 7 rows).
- Veg-led weekday lunches 15 of 36 household, 13 of 50 round 2. **Holds.**
- Breakfast pool sums to 4.5 a week; avocado toast is its highest-rate member at 0.75. **Holds.**
- Novelty by surface, 0.375 lunch, 0.5 breakfast, 0.125 Saturday. **Does not hold as stated.**
  The 4 "new breakfast entrants" are 1 custom (red sauce pasta) and 3 library dishes whose first
  appearance in an 8-week record (grilled cheese week 5, anda paratha week 6, masala oats week 8)
  says nothing about whether they are novel; by the same logic thepla, upma, and sabudana are
  "new". The only certain novelty is the 6 customs, 0.75 a week, of which 0.125 is breakfast.
- Saturday third element on 5 of 8 with special protein on 2. **Slightly under-counted:** sambar
  beside the dosa is a sixth accompaniment and fish tikka beside the Thai fried rice a third
  special protein. Direction unchanged.

## D2

**Their claim:** the optional-slot over-serve is cross-slot leakage plus the seed, and a per-slot
ledger seeded at one fill fixes both; at breakfast the household's optional chutney rate is 0 of
21, so a rate-0 slot ledger reproduces the 42 percent by construction.

**Verdict: HOLD against the ledger, CONCEDE the diagnosis, and propose the smaller fix it
implies.** The chutney check is decisive and I was wrong to file it under the seed alone: the
household's chutney is 100 percent dish-driven (15 of 15 beside paratha, chilla, or standalone
eggs; 0 of 21 elsewhere). A slot ledger whose rate is 0 is a slot that never fires, and a slot
that never fires is a slot the spec should not have. So the fix is a deletion, not a ledger:
**remove the optional breakfast small-item chutney slot; chutney is placed only by the dish-driven
rule (`docs/engine.md` §3), which already exists.** That gives exactly the rate-0 outcome with no
new state and removes the 7 off-register pairings in 10 weeks, about 3 deletions a month.

For the other optional slots, the coverage side's own "two honest limits" say what D2 buys: weekday
companion presence is already close, Saturday's problem is composition (D4.3), and salad is helped
"mainly through the seed cap". That leaves the seed as D2's remaining job, and the structural-only
seed (a per-dish rule: a dish is seeded only if it belongs to a structural pool) does that job with
no ledger. On cross-slot leakage: salads and raita fill only optional slots, so they have no
leakage; the dishes that do (hummus, khichdi) are D4.1's and D12.3's. What my version leaves
unfixed: nothing measured in round 2. What would change my mind: a frozen-rate run with the chutney
deletion and the structural-only seed in which salad or Saturday accompaniment presence still fails
its D11.6 fidelity; then the slot ledger is the next thing and I would accept it.

## D3

**Their claim:** change the rate denominator from record weeks to record occasions of the slot
type, exclude same-week placements from the fallback, and order the fallback after thin-pool
admission.

**Verdict: CONCEDE the denominator and the same-week exclusion.** The denominator is the better
fix and I should have seen it: the carb supply gap the brief measures (3.4 demand against 3.1) is
25 rows over 36 weekday lunches, which per occasion is 3.47 a week, and the gap vanishes; the
breakfast gap (4.5 against 5) vanishes the same way. It is a definition change in §2, not a
mechanism, and it has the fruit precedent. It also makes the highest-rate fallback rare rather than
routine, which is the right shape for a fallback. The same-week exclusion is consistent with the
ledger: a fallback fires only when every deficit is negative, and the repeat guard says a dish at
negative deficit does not get a second placement. Keep my two additions: the rule is written for
every structural fill (floor append and dry-protein partner included) and the harness reports
negative-deficit fills per role per week. The ordering clause I take only in the form my D7 fruit
position needs (below).

## D4.2

**Their claim:** a Saturday novelty slot ledger at 0.25 with weekday-eaten complete meals as the
first tier, because 7 dishes at 0.125 cannot satisfy "distinct within rolling 8" and the household's
8 distinct Saturdays say the register is wider.

**Verdict: HOLD on the rate and the first tier, CONCEDE a thin-pool door.** Two counters. First,
tier 1 undoes D4.1: Singapore noodles, curd rice, white sauce pasta, and veg fried rice are the
dishes D4.1 exists to remove from Saturday (the household ate them on Tuesdays, Wednesdays, and a
Monday, never a Saturday), and tier 1 puts them back at 0.25 a week instead of 0.6. Second, 0.25
is twice the observed Saturday novelty (dosa, 1 in 8 weeks). What the arithmetic does establish
(orchestrator question 2, below) is that a no-swap pool of 8 is a fixed 8-cycle in id order, which
is the v5 carousel at length 8. So: **a thin-pool door only, at the observed 0.125, open only while
the Saturday pool holds fewer than 8 members** (the distinctness window, a number the gate already
owns), candidates ranked by Saturday-scoped affinity among never-eaten complete meals. It closes
itself the moment the pool can satisfy the gate, which after promotion and the refresh may be
before it ever fires. If Rajat prefers no door, the swap remains the household's proven route.
Cost of my version against theirs: while the pool is under 8, about one novel Saturday every 8
weeks instead of every 4.

## D4.3

**Their claim:** the dry-protein partner takes the existing Saturday accompaniment slot with
precedence over salad, raita, and hummus, rather than as a hard rule from n=2.

**Verdict: CONCEDE.** It is the same or less machinery than the EM's hard rule, it keeps the plate
at three items, and it is honest about a 1-of-2 record. Strike "subject to the same slot meter"
since I hold against D2; the partner fires whenever the accompaniment fires.

## D5

**Their claim:** keep dessert structural, and record a trigger (20 percent dessert-less over 12 or
more Saturdays in the refreshed record) for flipping it to a D2 meter.

**Verdict: CONCEDE the trigger, AMEND the target.** No slot ledger is needed to flip: under the
existing §3 optional rule a dessert pool whose rates sum to 0.75 is served on about three Saturdays
in four by dish-level deficit alone. The trigger flips one word in §5.4, "structural" to
"optional". Record it.

## D6.1

**Their claim:** one lunch pick a week is right as a ceiling, but its ledger rate should be 0.5,
with the other half of the household's 1.0 novelty spent on breakfast and Saturday.

**Verdict: HOLD at one lunch pick a week, firm.** The 1.0 total rests on the 0.5 breakfast figure,
which the record does not support (above); the certain total is 0.75. Splitting a 0.5 lunch rate
across three ledgers to reach 1.0 spends 0.25 a week on a breakfast surface with no measured
novelty deficit (12 mains against 14, where the 14 include a one-off thepla and a custom). One pick
a week, every week, at lunch, is a rule; "up to one, at rate 0.5" reintroduces the range the EM
just removed. If Rajat wants novelty to reach breakfast, my round-1 compromise stands: one slot,
candidates from both meals, ranked by meal-scoped affinity, placed by the winner's meal type. One
dial, one cadence, no split to tune.

## D7

**Their claim:** three novelty doors as three slot ledgers (0.5, 0.25, 0.25), and a fruit thin-pool
rule whose nominal rate is the season's shortfall shared across admitted candidates, which is
bounded by demand and self-extinguishing.

**Verdict: HOLD on the breakfast door; CONCEDE the fruit need, AMEND the mechanism.** Breakfast:
see D6.1; the deficit is not measured, rule 13 calls the repertoire "about a dozen", and a closed
door costs the household zero edits (a door creates proposals, it does not save taps). Fruit: the
coverage side's 2.125 against 6 changed my mind on need. That is 156 Winter days served from three
fruits until the household swaps, and "the household swaps" is 4 or 5 taps a season, cheap, but the
dry run's own 20 of 41 weeks with consecutive-day repeats is a daily, visible flaw on the one slot
the household curates most (rule 18). Their rule is bounded and self-extinguishing, which I grant.
Mine is smaller: **fruit overflow fills (fills made when every eligible fruit's deficit is negative)
draw from every Active in-season fruit, candidates included, by least recently served.** No nominal
rate, no threshold of 4, no per-candidate state; an eaten admission becomes a row and joins the
deficit pool on its own, so it extinguishes the same way. This is my D3 ordering clause: for the
fruit slot, the fallback is LRU over the whole in-season pool rather than highest-rate. It still
needs the content task, as does theirs. What would change my mind toward their version: a Winter
stretch in the round-3 run where LRU overflow serves candidates the household then swaps away in
the corrected run (which would say ranking by affinity matters for fruit); I doubt it does for a
bowl of fruit.

## D8

**Their claim:** (b) plus (c) on every door, since (c) alone is a clean five-week rotation and not a
lock.

**Verdict: HOLD, at low stakes.** (b) is free; (c) is a memory per door and a period-5 cycle by
construction. With one lunch door the gate's slot anti-lock clause measures exactly whether (b)
leaves a lock; run (b), read it, add (c) if Monday still wins. If (c) is added, its cost is one
weekday value per door, which I would not fight. Zero hand edits ride on this either way.

## D11.4, D11.5, D11.8

- 11.4: they keep the 4-distinct fruit floor, relying on their admission rule. **Concede keeping
  the floor**, since my overflow-LRU clause also makes it satisfiable once Winter fruits are Active.
- 11.5: count admitted candidates in the pool size. **Concede**, contingent on the thin-pool door
  existing; with my door it counts while the door is open.
- 11.8: they accept the star-replacement repair as "one clause". **HOLD.** It is not one clause: a
  replaced star re-runs carb, companion, partner, gravy, cross-meal, and rice-spacing checks, and
  the day's fruit and breakfast stay as they were. One day in 41 at 125 minutes on a budget no
  recorded edit reason mentions. Change the threshold ("days over 120 reported; zero over 150") and
  keep the report. Zero hand edits ride on this.

## Orchestrator questions

**1. Chutney: pairing or seed, and does the structural-only seed fix the pairing?** The coverage
side is right about the diagnosis, and I concede it. The household's chutney is entirely
dish-driven (15 of 15 structural, 0 of 21 elsewhere), so the right model is that no optional
chutney slot exists at all, and the 7 off-register pairings are that non-existent slot firing. The
seed is what fired it in round 2 (round 1, unseeded, sat at the household's 42 percent exactly;
round 2's off-register rows cluster in weeks 1 and 3, then reappear in weeks 8 and 10 once the
raised rate has locked in). My structural-only seed closes the slot in steady state by arithmetic
only: the engine's structural chutney demand (parathas, chillas, and standalone eggs at 2.2 a week
in round 2) exceeds the chutney pool's accrual (1.875 a week, 2.08 per occasion), so every chutney
deficit stays negative and the optional slot never finds a positive top. That is a coincidence of
supply and demand, not a rule, and it reopens in any stretch where parathas run below the chutney
supply. So no, the structural-only seed does not fix the pairing robustly. The deletion does, and
it is smaller than either the seed rule or the slot ledger: remove the optional chutney slot;
chutney is placed by the dish-driven rule only. Their rate-0 ledger and my deletion produce the
same menu; mine has no ledger.

**2. Saturday distinctness under my proposal in a 60-week no-swap run.** With Saturday-scoped
rates and no door, the treat pool is the 7 library Saturday mains (8 after dosa is promoted), each
at 0.125, each accruing 0.125 a week and charged 1 when served. That is a perfect N-cycle in id
order: at 7, the gate's "distinct within rolling 8" fails by one repeat per window (the round-2
Khichdi and Singapore noodles repeats were the same pool cycling, in the unscoped form); at 8 it
passes with zero slack; under D11.5 (min(8, pool size)) it passes at either size. The self-feed
keeps every member at 1/N, so the cycle never changes order. Does it matter? To the gate, no. To
the household, yes: an 8-Saturday carousel in id order on the showcase meal is the v5 failure at a
longer period, and the household's 8 distinct mains in 8 weeks say its register is wider than the
record. In production the first swap-in breaks the cycle permanently (a ninth member at 1/N), and
the household has demonstrably done this (dosa). So the carousel is a no-swap artifact, but the
product's aim is fewer swaps, and I should not lean on the household to fix a pool the engine can
see is thin. Hence the concession: a thin-pool door at the observed 0.125, open only while the
pool is under 8, ranked by Saturday-scoped affinity over never-eaten complete meals (never the
weekday-eaten tier, which D4.1 just removed from Saturday for cause). It fires at most a handful of
times and then closes.

## Revised ship list

1. D6.1: one exploration pick a week at weekday lunch, firm; D6.2; D6.3 with a governor-off
   variant in the run.
2. D3: per-occasion rate denominator (§2); fallback to the highest-rate dish not already placed
   this week, for every structural fill; fruit overflow fills by LRU over the whole in-season
   pool, candidates included; harness reports negative-deficit fills per role per week.
3. D2 replaced by two deletions: remove the optional breakfast chutney slot (chutney is dish-driven
   only); cold-start seed applies to structural-pool dishes only, measured in the D9.3 sweep
   alongside cap 0.5 and the pool-level cap.
4. D4.1 symmetric occasion ledgers; D4.3 as partner precedence inside the accompaniment slot;
   D4.2 as a thin-pool door at 0.125, open only while the Saturday pool is under 8, never-eaten
   complete meals only.
5. D5 structural, with the recorded trigger flipping dessert to an optional element under §3.
6. D7: no breakfast door (the one-slot, both-meals compromise if Rajat wants novelty to roam);
   fruit handled by the overflow-LRU clause in item 2 after the Winter content task.
7. D8(b); (c) added only if the slot anti-lock gate still shows Monday.
8. D9: frozen, self-feeding, and corrected runs; per-occasion fidelity; drift bound; cap sweep
   including structural-only seed; slow-loop table.
9. D10 left alone; veg-led weekday lunch and the within-week favorite repeat recorded as measured
   and consciously unserved.
10. D11.1 to 11.7 with the coverage side's amendments; 11.8 as a threshold change, no repair.
11. D12 all six, with custom-dish promotion before the pull, real Winter fruits added Active, and
    the hummus category review.

Not shipped: D2's slot ledgers, the 0.25 Saturday door and its weekday-eaten tier, the breakfast
door, the nominal-rate fruit rule, D8(c) by default, the D11.8 repair.

---

# Round 2: coverage advocate

**Agreed** (no section below): D1; D4.1 (their symmetric statement is better than my two-ledger wording and does the same thing); D4.3; D5 (dessert structural, no ledger; my "recorded trigger" falls away with D2 deferred); D6.2; D6.3 with the governor-off variant in round 3; D10 all six; D11.1 to D11.5 and D11.7; D12 all six with custom-dish promotion before the pull.

## The arithmetic check that runs through everything

The simplicity side's load-bearing claim is that the self-fed cumulative record has no restoring force, so any one-time over-serve is a permanent rate shift. I checked it. With R rows over N weeks the engine serves r = R/N next week, so R' = R(1 + 1/N) and r' = R(1 + 1/N)/(N + 1) = R/N = r. The rate is an exact fixed point of the self-feed. A one-time k extra rows at record size N0 shifts the rate by k/N0 forever. **The claim holds**, and I accept its consequence: anything that places dishes outside the ledger's accrual (seed, structural overflow, floor append, partner slot, and my own slack argument below) is a permanent shift sized by when it happens.

Two corollaries the simplicity side did not draw, both in their favour: the record refresh alone (N0 from 8 to about 12) shrinks every cold-start lock-in by a third at zero cost, which is one more reason D12.1 goes first; and a household swap-in of a never-eaten dish sets that dish's rate at 1/N0 and holds it there, so "one tap seeds it forever" is literally true, not a figure of speech.

Their second claim, that the dish-level positive-deficit rule already bounds optional fills to accrual plus pool size, also holds: a dish fills only at positive deficit, so cumulative fills are at most seed plus accrual plus one per dish. In steady state optional slots are metered to the pool's rate sum. What I add is the size of the one-time offset that the zero seed does not remove: each optional dish settles at a mean deficit near minus 0.5 (it fills when barely positive, drops to near minus 1, climbs back), so a pool of P dishes over-serves about 0.5 P rows once and locks it in. For the 5 salads that is about 2.5 rows at N0 near 12, roughly +0.2 a week on 0.75, or +27 percent, against the seed's own contribution (my recount: the 5 salads bank 4.875 servings at cutover, the raita family 2.4, which is exactly why salad over-serves and raita does not). So the structural-only seed should take salad from +40 to somewhere between +20 and +30, which is at the bar, not comfortably inside it.

## D2

Their claim: the optional-slot over-serve is the seed transient locked in, not a hole in the positive-deficit rule, so cold-start optional pools at zero and measure it in the D9.3 sweep before considering slot ledgers.

Checks: the seed-lock-in mechanism holds (above). Round 1 with an all-zero start matched chutney at 42 percent exactly (review 6, regression 4, 21 of 50) holds. Their cost accounting of (b) holds and I had under-counted it: the row-to-slot-role classification (which of dal and bhindi is "the companion" on a four-item plate) is a new derived structure with real ambiguity, and my round-1 claim that cross-slot leakage inflates dish totals was wrong; leakage moves where a dish is served, not how often, because the dish ledger bounds the total.

**CONCEDE**, with two conditions. First, the test that decides it must be the self-feeding run, not the frozen run: on frozen rates every optional pool passes trivially (there is nothing to lock in), so a frozen-run pass says nothing about salad. Second, the trigger for reopening (b) is written now: if the structural-only seed on the self-feeding run leaves salad, breakfast chutney presence, or weekday companion presence more than 25 percent over on weeks 20 to 60, (b) is the next step, scoped to the failing slot only. My residual-slack estimate says salad will land near +25, so this is a coin flip, and the measurement is cheaper than the argument. Cost of (b) if it comes back: one rate and one deficit per slot type (three or four numbers), one seeding rule, one row-role classification, and it serves 4 to 5 deletions a month.

## D3

Their claim: highest-rate fallback, extended to every structural fill (star, carb, breakfast main, floor append, partner), plus a negative-deficit-fill-per-role metric; expect star overflow to move onto fish tikka.

Checks: the extension and the metric are right and free; I accept both. Their "7 of 13 chicken placements came from floor and partner slots" misreads the brief: it is 7 of 13 floor-plus-partner placements that were chicken, against 16 chicken rows in 10 weeks, so 7 of 16 chicken placements (44 percent) came from outside ordinary star selection. Direction holds; the number is 44 percent, not 54.

**HOLD on two amendments they did not take**, both one clause. (1) The same-week exclusion: the breakfast-main pool sums to 4.5 a week against 5 slots, its highest-rate dish is avocado toast at 0.75, already pinned, and without the exclusion the fallback serves it twice a week on alternate weeks (household: 0 of 8 weeks). Their own "extend to every structural fill" makes this worse, because the exclusion is what stops the star fallback landing on fish tikka in a week it already has, which is what they predict and I would not want the ledger to lock in as a rate shift. Zero state, one clause. (2) The per-occasion denominator (orchestrator question 2 below): with per-week rates the star pool supplies 4.5 stars a week against a demand of 5 and the carb pool 3.1 against 3.4, so D3's fallback fires about once a week on the star slot and once every three weeks on the carb slot, forever, and the self-feed locks in whoever absorbed it; with per-occasion rates the star pool supplies 36 of 36 and the carb pool 25 of 36 against a demand of about 25 of 36, so the fallback becomes the rare event it should be. Under their per-week version the star overflow lands on the highest-rate unplaced star, which after fish tikka is grilled chicken breast or prawn pepper fry, so D3 as they wrote it pushes the weekday non-veg rate (74 against 58) up, not down. What would change my mind: a frozen-rate round-3 run reporting negative-deficit star fills under 0.2 a week with per-week rates.

## D4.2

Their claim: no Saturday door; the record refresh (3 or 4 more distinct Saturdays), custom promotion (dosa), and one-tap swap-ins grow the pool without a mechanism, and D11.5 makes the gate satisfiable.

Checks: household Saturday novelty 1 of 8 holds. After promotion and refresh the pool is 11 or 12 dishes if the household kept not repeating (unverifiable until the pull, but 8 of 8 distinct is strong prior), which is supply near 1.0 against demand 1.0 and clears rolling-8 distinctness by size alone. Their rule-13 objection to a never-eaten complete meal on the showcase day holds. Worse for me: my first candidate tier (weekday-eaten complete meals never seen on Saturday) is exactly the set D4.1 removes from Saturday (Singapore noodles, curd rice, white sauce pasta, veg fried rice), so my door would have reintroduced at 0.25 a week the thing D4.1 fixes.

**CONCEDE.** Add one line to the D9.4 slow-loop table: Saturday pool size and the household's Saturday swap-out count per month. What would reopen it: the pool frozen under 10 for 25 weeks while the household swaps Saturday mains at one or more a month, which would mean the engine's Saturdays are being rejected for staleness and the swap door is not being used to widen the pool.

## D6.1 and D7 (breakfast and Saturday doors)

Their claim: one exploration pick a week at weekday lunch, second pick removed, is the largest edit-saver; the breakfast gap (12 against 14) is noise once thepla and the custom pasta are excluded; the swap door already teaches; if novelty is to roam, one slot a week whose candidate pool spans both meal types, ranked by meal-scoped affinity, placed by the winner's meal type.

Checks: 14 includes two one-offs holds. "About a dozen" in rule 13 holds. Our totals agree (their 1.0 a week at lunch, my 0.5 plus 0.25 plus 0.25 = 1.0), so the dispute was never volume, only split and mechanism. Where the breakfast gap is not noise: in the 60-week run the breakfast pool holds "12 distinct mains in every rolling 25-week window", which means it is frozen at 12 for the whole horizon, while the household added a breakfast main every second week; the divergence is a frozen pool against a growing one, not 12 against 14. But their spanning-slot proposal serves that surface at zero state, and it is a better design than my three ledgers: one dial, one cadence, no per-surface rates to defend.

**CONCEDE to the spanning single slot**, with one measurement attached: round 3 reports picks by meal type. If one meal takes 0 or 20 of 20, the affinity scores are not comparable across meals (breakfast rows are 36, lunch rows 44, and the shares normalize differently) and the fix is a meal-type LRU tie-break, which is D8(c) applied to meal type, one small memory, held in reserve like (c) itself. If the spanning slot is refused and the lunch-only pick stands at 1.0 a week, I hold that it is 2.7 times the household's lunch novelty (0.375 custom lunches a week) in the one shape rule 13 says gets swapped back, and I would ask D9.4 to report the exploration swap-away rate, halving the dial if it exceeds 60 percent. Use case frequency for the record: new breakfast entrants 2 a month, new Saturday mains 0.5 a month.

## D7 (fruit thin-pool rule)

Their claim: reject the rule; the content task plus one swap per new fruit per season seeds the pool forever; D11.4 and D11.6 keep the gate satisfiable while thin.

Checks: one swap seeds it holds, and stronger than they said: two orange swaps in the first Winter week set orange's Winter rate at 2.0 a week and the fixed point holds it there until the household edits again. Their machinery count holds (a threshold, a nominal rate, and, which I missed in round 1, the 8-week exploration spacing rule for admitted candidates the household keeps swapping away). The tap count is comparable either way: without the rule, 4 to 6 swaps in the first Winter week; with it, roughly the same number of swap-outs of candidates the household does not want.

**CONCEDE**, with one gate consequence they did not state. D11.4 exempts only the twice-a-week cap; gate 6's four-distinct floor stays unsatisfiable in any season whose eaten pool is under 4, and the self-feeding simulation has no household to swap fruits in, so the floor fails every Winter of every round forever. The floor should carry the same thin-pool exemption (measured only in seasons whose eaten pool holds 4 or more), and the content task must add the Winter fruits as Active so the household has something to swap to (custom text works but contributes no row). What would reopen the rule: the D9.4 monitor showing a Winter with 3 distinct fruits after 6 or more weeks, meaning the household is tolerating the loop rather than seeding it, which would be a product problem the swap door did not solve.

## D8

Their claim: (b) only, (c) in reserve; with one pick a week the leftover day rotates on its own and the anti-lock gate measures it.

Check: with one pick assigned after ten or so repertoire dishes whose own LRU choices vary weekly, the leftover day should vary; plausible and directly measurable. **CONCEDE.** (b) first, (c) added only if the round-3 gate still shows a weekday over half.

## D9

Agreed on 9.1, 9.2, 9.4, and on 9.3 with the structural-only seed variant run first. **HOLD** two harness-only additions, no engine cost.

(1) Per-occasion fidelity (question 2 below). (2) A third run, "corrected": replay the record's own swap-away list, so any dish the household swapped out in the 8 weeks is swapped out again whenever proposed and its replacement drawn by deficit. The §3 reconciliation branch (swap-out keeps its charge, swap-in is charged) has executed in no dry run (approximation 20), and by the simplicity side's own argument the household's edits are the only restoring force the record has; a gate that never exercises the restoring force is measuring the engine without the one thing that corrects it. Cost: harness code and a 20-row list. Serves: every production week.

## D11.6

Agreed on the four presence metrics and their negative-deficit-fill metric. **HOLD** my three additions as metrics, zero mechanism: per-surface novelty (picks by meal type, needed to judge the spanning slot), weekday lunches with no animal protein (household 15 of 36, round 2 13 of 50, the one level gap that is not normalization and not the seed), and Saturday plate shape (2 against 3 items). Measuring is how their "prove its keep against the gate" principle gets applied to my flags.

## D11.8

Their claim: reject the star-replacement repair; change gate 10 to "days over 120 reported; zero days over 150".

Checks: one day in 41 at 125; the rulebook's recorded reasons are all volume ("Too much food", "Not needed with pasta"), none time; the cascade (a new star re-runs carb, companion, partner, gravy, cross-meal) is real. **CONCEDE.** The threshold change is the right size for a 5-minute overage on a budget the household never asked for.

## Orchestrator questions

**1. Smallest D7 that still serves the real use cases, and drop order.** The smallest version is the simplicity side's own variant: one exploration slot a week, candidate pool spanning weekday breakfast and weekday lunch, ranked by meal-scoped affinity, placed by the winner's meal type under D8(b). It is one dial, one cadence, zero new state, and it keeps the breakfast surface open, which is the use case I consider real (the pool is frozen at 12 for 60 weeks in the self-feed while the household added one main every second week). The fruit admission rule is dropped in favour of the content task, the swap door, and the thin-pool exemption on gate 6's four-distinct floor. Drop order if forced: the Saturday ledger first (already conceded; refresh, promotion, and swaps cover a pool of 11 or 12), the breakfast ledger second (folded into the spanning slot), the lunch ledger last, because lunch is the one door the household uses least by hand and therefore the one that saves the most edits per pick if the hit rate is good. If the spanning slot is also refused, I accept one lunch pick a week and ask only for the exploration swap-away rate in D9.4.

**2. Per-occasion normalization: what still fails, and what else changes.** The record has 44 eaten days of 48 planned (36 of 40 breakfasts, 44 of 48 lunches) and the engine serves all 48, so per-week fidelity overstates every per-day family by 9 to 11 percent, and the per-week gate is unsatisfiable in aggregate for structural roles (the star slots must sum to 5 a week against a record sum of 4.5). Re-scored per occasion on the 60-week numbers: chicken 1.732/6 = 0.289 per lunch against 11/44 = 0.250, +15.5, PASS; mutton 0.317/6 = 0.053 against 2/44 = 0.045, +16, PASS; salad 0.175 against 0.136, +28, FAIL by 3 points; specialty roti 0.183 against 0.114, +61, FAIL. Every family that passed per week passes per occasion with more margin (prawn and international fall from +17 to about +7; paneer, spanning 11 meals a week against 80 record meals, sits near +10). The 60-week scoreboard goes from 8 of 12 to 10 of 12, and the two survivors are the two the simplicity side and I agree are seed plus overflow (salad) and overflow (specialty roti).

What it changes beyond D9.3: (a) D3 becomes far less load-bearing, because per-occasion supply matches demand for the star pool (36 of 36) and nearly for the carb pool (25 of 36 supplied against about 25 of 36 demanded); the fallback stays for the residual (complete-meal carbs) and any real gap. (b) D10's weekday non-veg 74 against 58 is already per occasion and does not move; but the simplicity side's explanation for it (star-slot overflow, expected to clear with D3) weakens, since per occasion there is little star overflow, so that 16-point gap should be expected to survive round 3 and belongs on the D11.6 list as the veg-led weekday lunch metric. (c) The fidelity clause in §11 and D11.6 should read "rows per occasion served against rows per occasion eaten". (d) If adopted in the engine's §2 as well as the gate (rate = rows over occasions present, accrued per planned occasion), the structural overflow is distributed proportionally across the household's own mix instead of being handed to workhorses and locked in; this is the version I recommend, and it is one line with a precedent in the season-scoped fruit rate. The gate-only version is the minimum and still fixes the scoreboard. (e) The cold-start seeds shift slightly (rates 9 to 11 percent higher reach the cap a week sooner); negligible.

## Revised ship list

1. D12 in full, custom-dish promotion before the record pull; content tasks including Winter fruits added as Active.
2. D6.1 as the spanning single exploration slot (or one lunch pick a week if refused); D6.2 meal-scoped affinity; D6.3 with the governor-off variant measured.
3. D3 highest-rate fallback on every structural fill, with the same-week exclusion; per-occasion rates in §2 and the gate.
4. D4.1 symmetric occasion-scoped lunch rates; D4.3.
5. Cold-start seed structural-only (the D2 substitute), with the trigger for D2(b) written into the spec.
6. D8(b), with (c) in reserve.
7. D9.1, D9.2, the cap sweep including structural-only and pool-level, the corrected replay run; D9.4 with the Saturday pool and exploration swap-away lines.
8. D11.1 to D11.7 with the negative-deficit-fill metric, per-occasion fidelity, and the three added metrics; D11.8 as the 150-minute threshold; gate 6's four-distinct floor exempted under a thin pool.

Not shipped: D2(b) now, D4.2, the separate breakfast and Saturday ledgers, the fruit admission rule, D8(c), the D11.8 repair.

---

# Round 3: simplicity advocate

## Final verdicts

- D1: Amend v6 in place; no v7.
- D2: No slot ledgers; two deletions instead: the optional breakfast chutney slot is removed (chutney is placed only by the dish-driven rule, which reproduces the household's 15 of 15 structural and 0 of 21 elsewhere), and the cold-start seed applies only to dishes that belong to a structural pool; the deciding measurement is the self-feeding run (a frozen run cannot show lock-in), and the spec records the reopen trigger for (b) now: any optional slot's presence more than 25 percent over on weeks 20 to 60 reopens (b) for that slot only.
- D3: Rate denominator changes from record weeks to record occasions of the slot type (§2 and the gate); an exhausted structural pool falls back to the highest-rate dish not already placed this week, ties by id, written for every structural fill (star, carb, breakfast main, floor append, dry-protein partner); the fruit slot's overflow instead draws from every Active in-season fruit, candidates included, by least recently served; the harness reports negative-deficit fills per role per week.
- D4.1: Occasion-scoped lunch rates, symmetric (a dish's Saturday ledger accrues its Saturday rows, its weekday ledger its weekday rows, each charged by its own placements; a Saturday placement excludes a same-week weekday placement by the ordinary repeat rule).
- D4.2: No Saturday exploration door; the pool grows by refresh, custom promotion, and swap-ins; the D9.4 table carries Saturday pool size and Saturday swap-outs per month, and the named fallback if the refreshed pool is under 8 is a thin-pool door at 0.125 over never-eaten complete meals that closes at pool size 8.
- D4.3: The dry-protein partner for a carb-forward international treat takes the existing accompaniment slot with precedence over salad, raita, and hummus; three items, no fourth, no hard rule.
- D5: Dessert stays structural; the spec records a trigger (dessert-less Saturdays at 20 percent or more over 12 or more refreshed Saturdays) that flips one word in §5.4, structural to optional, under the existing §3 rule; no ledger.
- D6.1: Exactly one exploration pick a week, at weekday lunch; the second pick and its placement logic are deleted; the D9.4 table reports the exploration swap-away rate.
- D6.2: Affinity computed over rows of the candidate's own meal type.
- D6.3: Governor kept; a governor-off variant is run in round 3 and the governor is deleted in a later round if the variant holds paneer inside the bar.
- D7 breakfast: No breakfast door and no spanning slot by default; the spanning single slot (one pick a week, candidates from both weekday meals, meal-scoped affinity, placed by the winner's meal type) is the version to ship if and only if Rajat says he wants the engine to propose never-eaten breakfast mains.
- D7 Saturday: No door (see D4.2).
- D7 fruit: No admission rule and no nominal rate; the fruit overflow-LRU fallback in D3 is the whole mechanism, after the Winter content task; gate 6's four-distinct floor is exempted only in seasons whose eligible Active in-season pool holds fewer than 4.
- D8: (b) exploration picks assigned last; (c) held in reserve, added only if the round-3 anti-lock gate still shows a weekday over half.
- D9.1: Frozen-rate run; measure only.
- D9.2: Drift bound, weeks 40 to 60 within 10 percent of weeks 20 to 40; measure only.
- D9.3: Cold-start sweep on the self-feeding run: cap 1, cap 0.5, pool-level cap, structural-only seed; measure only, run in round 3 not after.
- D9.4: Slow-loop monthly table: family rates per occasion over the trailing 8 served weeks against the refreshed baseline, Saturday pool size, Saturday swap-outs, exploration swap-away rate; plus a third harness run ("corrected") that replays the record's swap-away list so §3 reconciliation executes at least once; measure only.
- D10: All six left alone; the veg-led weekday lunch (15 of 36 against 13 of 50) and the within-week favorite repeat (4 of 8 household weeks, unreachable by the ledger) are recorded as measured and consciously unserved.
- D11.1: Re-measure the Jaccard baseline with the harness method; band at baseline plus or minus 0.05.
- D11.2: Coverage clause gains "in which it is eligible".
- D11.3: International persistence counts weekday stars only.
- D11.4: Thin-pool exemption on the twice-a-week fruit cap, and the same exemption on the four-distinct floor defined on the eligible pool.
- D11.5: Saturday distinctness within min(8, pool size).
- D11.6: Fidelity gains breakfast small-item presence, weekday companion presence, Saturday accompaniment presence, novelty per week and per surface, weekday lunches with no animal protein, Saturday plate shape, and negative-deficit fills per role, every comparison per occasion served against per occasion eaten.
- D11.7: Frozen run and drift bound in the gate.
- D11.8: No star-replacement repair; gate 10 becomes "days over 120 reported; zero days over 150".
- D12.1: Refresh the record after the six custom one-offs are promoted to the library and their slots swapped to the library ids.
- D12.2: Apply the review-2 amendments to `household-menu-rules.md` first.
- D12.3: Content first and in parallel: Winter fruits added as Active in-season dishes (not only checked), soya and tofu deactivation, breakfast Dry retag, hummus category review.
- D12.4: Commit the `features/` files.
- D12.5: One clean-room review per round plus the resolution audit.
- D12.6: Log the decisions in `DECISIONS.md` once Rajat confirms.

## Resolved this round

- **D4.2, both sides now at no door.** They conceded on my grounds (rule 13, and their own first tier reintroducing the D4.1 set) and added the arithmetic that settles my residual worry: after promotion and refresh the pool is 11 or 12 if the household kept not repeating (8 of 8 is a strong prior), which clears rolling-8 distinctness by size alone. My thin-pool door at 0.125 would therefore be dead code with high probability. I drop it as a shipped item and keep it only as the named fallback if the pull shows a pool under 8. Their monitor line (pool size and Saturday swap-outs) is the right cheap reopen trigger.
- **D3 same-week exclusion and per-occasion denominator.** Conceded in round 2; their round-2 addition that per-week rates would push the star overflow onto grilled chicken and prawn (raising the 74 percent weekday non-veg rate, not lowering it) confirms that the denominator is the load-bearing half and the fallback the rare residual. I also take their correction of my chicken arithmetic: 7 of 16 chicken placements (44 percent) came from the floor and partner slots, not 7 of 13.
- **D2 conditions.** I accept both: the self-feeding run is the deciding test (a frozen run has nothing to lock in), and the reopen trigger for (b) is written now, scoped per slot. Their residual-slack estimate (each optional dish idles near minus 0.5 deficit, so a pool of P over-serves about 0.5 P rows once) is a fair prediction that salad lands near the bar; measuring is cheaper than arguing.
- **D6.1 monitor.** Their request that the D9.4 table report the exploration swap-away rate is measurement, taken. Their proposed consequence (halve the dial above 60 percent) reintroduces a range; if the rate is that high, the dial goes to Rajat as a product question.
- **D7 fruit, partially.** They conceded to no rule; I moved the other way in round 2 toward a fallback clause. Resolution below under irreducible, since the two versions still differ.
- **D11.6, D11.8, D8, D9 corrected run.** All agreed on their round-2 terms; nothing further.

## Irreducible disagreements

1. **D7 breakfast: lunch-only pick (me) versus the spanning single slot (them, adopting my round-1 variant).** Crux: a product question, not an evidence one. Does Rajat want the engine to propose never-eaten breakfast mains, or does he prefer to add breakfasts himself (as the record shows the household doing, one custom and three first appearances in 8 weeks)? The self-feed cannot answer it: it shows the breakfast pool frozen at 12 for 60 weeks, which is true of any pool with no swaps and no door, and it cannot show whether proposals would be eaten. Why I ship lunch-only by default: it is the strict subset (delete one pick, change nothing else); the spanning slot adds a breakfast placement path (small-item rule, Thursday anchor exclusion, cross-meal demotion applied to a novel main) and carries a known instability the coverage side itself named, that cross-meal affinity scores may not be comparable (36 breakfast rows against 44 lunch rows) so the slot may collapse to one meal, at which point the repair is a meal-type tie-break, which is new state. The question to Rajat is the one above; a yes ships the spanning slot with the picks-by-meal-type metric; a no ships lunch-only. If a round-3 run is cheap, run the spanning variant and report picks by meal type; a collapse to 0 or 20 of 20 argues for lunch-only regardless of the answer.

2. **D7 fruit: overflow-LRU fallback clause (me) versus no rule plus a gate exemption (them).** Crux: whether 156 Winter days served from three fruits until the household swaps 4 to 6 new fruits in (about one week of swaps per season) is an acceptable product experience, given that fruit is the slot the household curates most (rule 18). This is mostly taste, with one measurable part: whether LRU-admitted fruits get swapped out. The clause is one fallback definition under D3 (the fruit slot's exhausted-pool rule is LRU over the whole eligible pool instead of highest-rate), no new state, no threshold, no nominal rate, self-extinguishing because every eaten admission becomes a row. Their version is smaller by that one clause and needs the gate-6 exemption to stay honest; mine makes gate 6 satisfiable once Winter fruits are Active. Settle it with the corrected run: if the LRU-admitted Winter fruits survive the swap-away replay (they should; the replay list holds no fruit rejections), ship the clause; and ask Rajat one question: "In the first week of Winter, would you rather swap in oranges and guava yourself, or have the engine put them on the table?"

3. **D2 reopen threshold, minor.** They set the reopen trigger at 25 percent over; I accept it. The only residual is whether the chutney-slot deletion is counted as part of the D2 settlement or as a separate item; I list it separately because it is a rule change in §5.2, not a seed change, and it should be diffed as such. No crux; a bookkeeping note for the orchestrator.

## Things still confusing

- Does a dish-driven (structural) chutney fill charge the chutney's deficit? Approximation 12 makes paratha, chilla, and standalone-egg chutneys structural; if those fills charge the ledger, the chutney pool is net negative in steady state and the optional slot is starved by arithmetic, which changes how much the seed alone explains. Verify in the harness before the D2 measurement is read.
- Why do two round-2 aloo parathas (2026-10-12 Monday, 2026-10-26 Wednesday) carry no chutney when the household's parathas and chillas carried one 11 of 11 times and the rule is dish-driven? Prep-ceiling drop, or a gap in the structural rule? Verify in the harness.
- Did grilled cheese sandwich, anda paratha, and masala oats enter the household's breakfasts through prod's own exploration or through hand swap-ins? The `manualChanges` table knows. The answer decides irreducible item 1 more than any argument: if prod proposed them and the household ate them, breakfast proposals have a measured hit rate of 3 for 3 and the spanning slot earns its place; if they were swap-ins, the household adds breakfasts itself.
- Season calendar: which weeks of the record are Summer and which Monsoon, and on what date does Winter start? The dry run labels 2026-10-05 Winter and reports a Summer pool of 4 and a Monsoon pool of 6, so the record spans two seasons, and the per-season rate denominators depend on the exact boundary. State it in the spec.
- Per-occasion accrual in production: with rate defined per occasion, does the engine accrue rate times planned occasions (5 weekday lunches, 5 breakfasts, 1 Saturday) every week regardless of skips, and does a skipped day in production reduce that week's accrual or only the record's occasion count? The two readings diverge by about 9 percent, the size of the effect the change exists to fix.
- Under symmetric D4.1, is a Saturday-only dish (pav bhaji, chole bhature) absent from the weekday star pool, or present at weekday rate 0 as a candidate that only exploration could place? And the mirror: is Singapore noodles present in the Saturday pool at rate 0? The spec text should say "absent" in both directions or the fallback rule can reach them.
- §14.1's alternative rate formula (rows over weeks since first eaten) was never A/B tested. With the denominator now changing to occasions, is §14.1 dead, folded, or still open?
- 2026-10-12 Thursday pairs Veg hakka noodles with Thai basil chicken as the dry-protein partner. Is Thai basil chicken Category Keto or Dry dish, and should the partner pool be restricted to Indian-register or cuisine-neutral dishes? One row in 60; a library-category question for D12.3, not a rule.
- The favorites guarantee places avocado toast 10 of 10 weeks against the household's 6 of 8. D10 says this is a product guarantee Rajat set; confirm that "every week" is what he wants, since it is the only weekly structure in the menu that the household itself did not keep.
- Gate 4's category clause ("no category day-locked in more than half the weeks") still has no exemption for a register whose composition is majority one category; under D4.1 the Saturday international share should fall to about a quarter, but if the refreshed Saturday pool is majority international the clause fails again by arithmetic. Verify after the pull.

## Ship list

1. [content] D12.3: Winter fruits added as Active in-season dishes; soya and tofu deactivation; breakfast Dry retag; hummus category review. [content] Promote the six custom one-offs and swap their slots to library ids. [measure] D12.1 record pull after that. [content] D12.2 rulebook amendment, D12.4 commit the features files.
2. [delete] D6.1: the second exploration pick and its placement logic; one pick a week at weekday lunch. [add] D6.2: affinity scoped to the candidate's meal type (a filter on an existing score). [measure] governor-off variant.
3. [delete] The optional breakfast chutney slot; chutney is dish-driven only.
4. [delete] The cold-start seed on dishes outside every structural pool. [measure] D9.3 sweep on the self-feeding run; D2(b) reopen trigger written into the spec.
5. [add] D3 denominator: rate is rows per record occasion of the slot type, in §2 and in the gate.
6. [add] D3 fallback: highest-rate dish not already placed this week, for every structural fill; fruit overflow by least-recently-served over the whole eligible in-season pool, candidates included. [measure] Negative-deficit fills per role per week.
7. [add] D4.1 symmetric occasion-scoped lunch ledgers. [add] D4.3 partner precedence inside the accompaniment slot.
8. [add] D8(b): exploration assigned last in step 5. (c) in reserve.
9. [measure] D9: frozen, self-feeding, and corrected runs; drift bound; D9.4 table with family rates per occasion, Saturday pool size, Saturday swap-outs, exploration swap-away rate.
10. [measure] D11.1 to D11.7 as amended, including the per-occasion comparison and the seven added fidelities; D11.8 as the 150-minute threshold; gate 6 floor exempted on an eligible pool under 4.
11. [no change] D5 dessert structural with the recorded flip trigger; D4.2 no door with the thin-pool fallback named; D7 breakfast lunch-only pending Rajat's answer; D10 all six.

Not shipped: D2(b) slot ledgers, any Saturday door, the breakfast door and the spanning slot by default, the nominal-rate fruit admission rule, D8(c), the D11.8 star-replacement repair.

---

# Round 3: coverage advocate

## Final verdicts

- D1: Amend v6 in place as round 3; nothing below touches the chooser.
- D2: Delete the optional breakfast chutney slot (chutney is placed by the dish-driven rule only: paratha, chilla, standalone boiled eggs); apply the cold-start seed to structural-pool dishes only; add no slot ledgers; write the reopening trigger for a slot ledger as "salad or Saturday-accompaniment presence more than 25 percent over its record rate per occasion on the self-feeding run, weeks 20 to 60".
- D3: Change §2's denominator to occasions present of the slot type (weekday lunches, breakfasts, Saturdays; all meals present for cross-meal families); fill an exhausted structural pool with the highest-rate dish not already placed this week, ties by id, written for every structural fill (star, carb, breakfast main, floor append, dry-protein partner); for the fruit slot only, overflow fills draw from every Active in-season fruit, candidates included, by least recently served; the harness reports negative-deficit fills per role per week.
- D4.1: Occasion-scoped lunch ledgers, stated symmetrically as the fruit rule generalized: a dish's rate for a slot is computed over record rows of that slot's occasion (weekday or Saturday), charged by the occasion it is placed in.
- D4.2: No Saturday door at cutover; the D9.4 table reports Saturday pool size and Saturday swap-outs per month; the simplicity side's thin-pool door (0.125, never-eaten complete meals by Saturday-scoped affinity, open only while the pool is under 8) is adopted verbatim only if the refreshed record, after custom-dish promotion, holds fewer than 8 distinct Saturday mains.
- D4.3: The dry-protein partner for a carb-forward international treat takes the Saturday accompaniment slot with precedence over salad, raita, and hummus, chosen by deficit; the plate stays at three items; no meter.
- D5: Dessert structural; the spec records the trigger (dessert-less Saturdays at 20 percent or more over 12 or more refreshed Saturdays) that flips §5.4's "structural" to "optional" under the existing §3 rule.
- D6.1: One exploration pick a week, second pick deleted with its attachment and distinct-day clauses; the candidate pool spans weekday breakfast and weekday lunch, ranked by meal-scoped affinity, placed by the winner's meal type; the harness reports picks by meal type; if Rajat declines the spanning pool, one weekday-lunch pick a week.
- D6.2: Affinity computed over rows of the candidate's own meal type.
- D6.3: Governor kept; a governor-off variant is run in round 3 and the governor is deleted in a later round if paneer stays inside the bar without it.
- D7: No separate breakfast or Saturday novelty ledgers and no nominal-rate fruit rule; breakfast novelty reaches the menu only through the spanning pick in D6.1; fruit coverage comes from the D3 fruit overflow clause after the Winter content task; gate 6's four-distinct floor is kept, measured only in seasons whose eaten pool holds 4 or more.
- D8: Exploration picks assigned last, (b); the slot-level LRU (c) is added only if the round-3 slot anti-lock gate still shows a weekday over half.
- D9.1: Frozen-rate run added, measuring engine bias.
- D9.2: Drift bound added as a gate metric, the 10 percent figure provisional until the first run shows window-to-window noise for 2-row families.
- D9.3: Cap sweep run before any slot ledger is decided: cap 1, cap 0.5, pool-level cap, structural-only seed; plus a third "corrected" run replaying the record's swap-away list so §3 reconciliation executes.
- D9.4: Slow-loop table against the refreshed baseline, with Saturday pool size, Saturday swap-outs, and exploration swap-away rate as lines.
- D10: All six left alone; the veg-led weekday lunch (15 of 36 against 13 of 50) and the within-week favorite repeat (4 of 8 weeks) recorded as measured and consciously unserved.
- D11.1: Jaccard baseline re-measured by the harness's method, band at baseline plus or minus 0.05.
- D11.2: Coverage clause with the in-season qualifier.
- D11.3: International persistence counted on weekday lunch stars only.
- D11.4: Twice-a-week fruit cap carries the thin-pool exception.
- D11.5: Saturday distinctness within min(8, pool size), pool size counting the contingency door's candidates only if that door exists.
- D11.6: Fidelity compared per occasion served against per occasion eaten; added metrics: breakfast small-item presence, weekday companion presence, Saturday accompaniment presence, novelty per week by meal type, weekday lunches with no animal protein, Saturday plate shape, negative-deficit fills per role.
- D11.7: Frozen run and drift bound written into §11.
- D11.8: No star-replacement repair; gate 10 becomes "days over 120 reported; zero days over 150".
- D12: All six, with custom-dish promotion before the record pull, real Winter fruits added Active in the content task, and the library category of hummus reviewed.

## Resolved this round

- **D2, the chutney deletion.** A slot ledger at rate 0 is a slot that never fires, and a slot that never fires should not exist. Their deletion produces the same menu as my ledger with no state, and they showed the structural-only seed alone is not robust for chutney (it works only while paratha, chilla, and egg demand at 2.2 a week exceeds the chutney pool's accrual at 2.08 per occasion, a coincidence that reopens in any light-breakfast stretch). The deletion is the precise fix. I note the one coverage hole it creates for the record: a future household chutney beside a non-dish-driven main (0 of 21 so far) would become a row no slot can serve; that is acceptable at zero observed cases.
- **D7 fruit, their overflow-LRU clause.** Mine had a threshold, a nominal rate, and (which I missed in round 1) needed the 8-week spacing rule for admitted candidates the household keeps rejecting. Theirs is the D3 fallback specialized for the fruit slot: it fires only when supply is short (all deficits negative), spreads by LRU instead of piling onto pomegranate, admits candidates whose first serving becomes a row, and extinguishes as the season's supply rises to demand. Bounded by demand, self-extinguishing, no new persisted state beyond the LRU memory the engine already keeps. I checked the disliked-candidate case: a candidate the household swaps away goes to the back of the LRU queue and returns after the pool cycles, about every 8 Winter weeks, which is tolerable without a spacing rule.
- **D7 breakfast novelty number.** Their correction holds: in an 8-week record a library dish's first appearance in week 5 is not novelty, or thepla and upma would be novel too. The certain breakfast novelty is 1 custom in 8 weeks, 0.125 a week. I withdraw the 0.5 figure and the separate breakfast ledger built on it. What survives is the frozen 60-week breakfast pool at 12, which the spanning pick addresses at no cost.
- **D5.** Their observation that the flip needs no ledger (a dessert pool summing to 0.75 under the existing §3 optional rule serves about three Saturdays in four by dish deficit alone) is right; the trigger flips one word.
- **D4.3.** "Subject to the same slot meter" struck; the partner fires whenever the accompaniment fires.
- **D9, D11.6, D11.8, D8.** All settled in round 2 and unchanged.

## Irreducible disagreements

**1. D6.1: the spanning candidate pool as the default, or lunch-only with spanning offered to Rajat.** Their position: one weekday-lunch pick a week, firm, because the breakfast deficit is unmeasured and rule 13 calls the breakfast repertoire "about a dozen"; spanning only if Rajat asks. Mine: spanning by default, because it costs no state, the household's own one-offs roamed (review 5 finding 4: breakfast, weekday lunch, Saturday; the engine put 20 of 20 at lunch), and a pick that is sometimes a breakfast lowers the lunch novelty rate that both sides agree is 2.7 times the household's lunch custom rate (0.375 a week) in the one shape rule 13 says gets swapped back. The crux is a taste question with a factual rider. Taste: does Rajat want the week's one new dish to sometimes be a breakfast? Fact: whether cross-meal affinity scores are comparable, which the round-3 count of picks by meal type settles (0 or 20 of 20 for one meal means they are not, and the fix is a meal-type LRU tie-break, one weekday value of state). Question to Rajat: "The engine proposes one new dish a week. Should it always be a lunch, or should it pick the meal where the new dish fits best, so some weeks the new dish is a breakfast?"

**2. D2 reopening trigger: which run it keys on.** Their round 2 keys the slot-ledger trigger on a frozen-rate run. With rates frozen, an optional pool's fills over any long window equal accrual plus a bounded one-time slack, so salad passes the frozen run regardless of seed; the lock-in they proved (a one-time k extra rows is a permanent k/N0 shift) is visible only on the self-feeding run. This is factual, not taste. The settling measurement: report salad and Saturday-accompaniment presence per occasion on weeks 20 to 60 on both runs with the structural-only seed; if frozen passes and self-feed fails, that is the lock-in, and the trigger must key on the self-feed. My residual-slack estimate (about 0.5 rows per dish, one time, 2.5 rows for the 5 salads at N0 near 12) puts salad near +25 on the self-feed, so this trigger may actually fire.

**3. D4.2: no door, or a thin-pool door that closes at 8.** Their position: a door at 0.125 open while the pool is under 8, because a no-swap pool is a fixed cycle in id order and the product should not lean on swaps. Mine: no door at cutover. The crux has a logical half and a taste half. Logic: after dosa's promotion the pool is 8 before the refresh adds a single week, so their door never opens; and a door that closes at 8 does not prevent the 8-cycle they call a v5 failure, it prevents a 7-cycle, so it serves the gate (already served by D11.5) and not the household. Taste: whether an 8-Saturday cycle of Rajat's own eight treats, in a fixed order, is acceptable, or whether he expects the engine to propose treats he has not eaten. If the answer is that he expects proposals, the right mechanism is a rate door that never closes (0.125, never-eaten complete meals, Saturday-scoped affinity), not a pool-size door; the cost is one novel Saturday every 8 weeks, each a swap-back risk under rule 13. Question to Rajat: "After the refresh you will have 11 or 12 Saturday treats. Are you happy for Saturdays to rotate through those until you add one by swap, or should the engine propose a new treat roughly every two months?" Verify in the refreshed record first: if any Saturday main repeated, the pool is smaller than assumed and their door text is the contingency.

## Things still confusing

1. Does the production "dish-driven chutney" rule (`docs/engine.md` §3, cited by v6 §5) cover standalone boiled eggs, or only chilla and paratha? The dry run treated the standalone-egg chutney as structural (approximation 12) and the household's 4 standalone-egg mornings all carried one. If the rule names only chilla and paratha, deleting the optional slot drops those 4 rows of coverage; verify in the harness before the deletion lands.
2. The boiled-egg rider small item on a non-Thursday light-grain main (upma on a Friday, masala oats on a Friday in the record): dish-driven, or optional under the positive-deficit rule? If optional, does it survive the structural-only seed, given boiled eggs' deficit is mostly consumed by Thursday and standalone placements? Verify in the round-3 run: count non-Thursday light-grain mains with and without eggs.
3. Per-occasion denominator for cross-meal families (paneer spans 36 breakfasts and 44 lunches): are the occasions "all meals present" (80), or is the rate computed per role and summed? Both sides said per occasion of the slot type; the family-level fidelity comparison needs one definition written down.
4. The seed formula under per-occasion rates: `min(rate × weeksSinceLastEaten, 1)` becomes `min(ratePerOccasion × occasionsSinceLastEaten, 1)`; approximation 2 (the seed subsumes week 1's accrual) needs restating.
5. Is sambar beside the custom dosa an accompaniment or part of a complete-meal dish? It moves the Saturday accompaniment baseline between 5 of 8 and 6 of 8, which D11.6 measures against.
6. Hummus: what is its library category? It led 2 of 36 weekday lunches in the record and never leads in round 2 (approximation 10 keeps Category Accompaniment out of the star pool). Neither side can resolve this from the files.
7. International persistence on weekday stars (D11.3): is a plate whose star is Indian with an international-named companion, or an international carb with a dry Indian protein partner, an "international lunch"? Approximation 19 counted two ways; the spec must pick one.
8. Which Winter fruits does the household eat? The record has no Winter, the library's Winter set is unknown to both debaters, and every fruit mechanism agreed here admits only what is Active and in season. Question to Rajat for the content task.
9. The refreshed record: do any of the 3 or 4 new Saturdays repeat a main? This decides whether D4.2's contingency text is live.
10. Under the fixed-point property every cold-start seed and every structural overflow at cutover is a permanent rate shift sized by 1/N0. Is the cutover week intended to be served unedited into the record as it stands, or will Rajat edit the first weeks as he did the first 8? The gate's worst case assumes no edits; the D9.3 sweep's choice of cap should be read against which of these production will actually do.

## Ship list

1. [content] D12.1 custom-dish promotion (dosa, atta halva, red sauce pasta, paneer manchurian, stuffed capsicum, cabbage matar aloo), then the record pull; [content] D12.2 rulebook amendments; [content] D12.3 Winter fruits added Active, soya and tofu deactivation, breakfast Dry retag, hummus category review; [content] D12.4 commit the features files.
2. [delete] D6.1 second exploration pick and its attachment and distinct-day clauses; [add] spanning candidate pool across breakfast and weekday lunch placed by winner's meal type; [add] D6.2 meal-scoped affinity; [measure] D6.3 governor-off variant, picks by meal type.
3. [add] D3 per-occasion denominator in §2; [add] highest-rate-not-already-placed fallback for every structural fill; [add] fruit overflow by LRU over the whole in-season pool; [measure] negative-deficit fills per role per week.
4. [delete] D2 optional breakfast chutney slot; [delete] cold-start seed on optional-pool dishes; [add] the written slot-ledger trigger keyed to the self-feeding run.
5. [add] D4.1 symmetric occasion-scoped lunch ledgers; [add] D4.3 partner precedence in the Saturday accompaniment slot; [measure] D4.2 Saturday pool size and swap-outs in the slow-loop table, contingency door text held against the refreshed record.
6. [add] D5 the recorded one-word flip trigger.
7. [add] D8(b) exploration assigned last; [measure] slot anti-lock, (c) in reserve.
8. [measure] D9.1 frozen run, D9.2 drift bound, D9.3 cap sweep with structural-only seed, the corrected replay run, D9.4 slow-loop table with the three new lines.
9. [add] D11.1 to D11.7 text with per-occasion fidelity and the seven added metrics; [add] D11.8 as the 150-minute threshold; [add] gate 6 floor measured only in seasons with 4 or more eaten fruits.
10. [measure] D10: veg-led weekday lunch share and within-week favorite repeats reported, no mechanism.

Not shipped: slot ledgers, the 0.25 Saturday door and its weekday-eaten tier, separate breakfast and Saturday novelty ledgers, the nominal-rate fruit rule, D8(c) by default, the D11.8 star-replacement repair, any chicken ceiling or row weighting.

---
