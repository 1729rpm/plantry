# Engine v6: the record-matching engine

The meal-planning rules for the next engine. This document is the specification; it is written so
that an independent agent reading only this file plus the repo's data (`data/` library, the
as-eaten served weeks in prod) can implement it with no other context. It replaces the selection
core of engine v5 (`features/engine-v5.md`) entirely; the mechanical sections that survive are
listed in §12, and the things deliberately removed are listed in §13 so nothing gets revived by
accident. The development plan that builds it is `features/engine-v6-plan.md`.

Two sources ground every rule here: `features/household-menu-rules.md` (the observed household
rulebook, derived from the eight served weeks 2026-06-15 to 2026-08-10 and amended per
`features/review-2-rulebook-changes.md`) and the recorded reasons in the prod `manualChanges`
table. This is round 3 of the spec: round 2's seven amendments came from the first dry run, and the
round 3 amendments come from the second dry run's three reviews and the D1 to D12 debate recorded in
`features/review-7-v6-decision-debate.md` and the 2026-09-04 entry in `DECISIONS.md`. Each amended
clause carries a short note naming its measured reason.

## 1. The household model

Four instincts explain most of the household's 206 hand edits. Every rule in this document serves
one of them; a proposed rule that serves none of them does not belong in the engine.

1. **Familiarity first.** The household rotates a compact repertoire of dishes it already eats. The
   engine proposes what the record shows the household eats, at the frequencies the record shows.
2. **Light by default.** When in doubt the plate gets smaller, not bigger. Item counts are
   ceilings, never targets.
3. **Protein daily, never doubled.** Every day carries protein, and a protein family never appears
   at both of a day's meals.
4. **Indulgence lives on Saturday.** The special main and the sweet concentrate there; weekdays
   stay everyday food.

Novelty is real but bounded: one new dish a week keeps the menu interesting (§7). It is a channel,
not the default.

### 1.1 Why v5 was replaced

A 10-week dry run of v5 passed its numeric gate and still produced a menu the household would not
eat, for two structural reasons that no amount of added rules can patch.

- **RC1, the phase-locked limit cycle.** v5 was a deterministic ranking iterated on a weekly grid,
  and a deterministic system whose state advances the same way every week settles into a limit
  cycle (a fixed loop of states it repeats forever) whose phase welds to the weekday grid. The dry
  run gave every weekday a locked breakfast, a four-main Saturday carousel, and fruit assigned to
  fixed days. The household keeps exactly two weekday structures; the engine invented ten.
- **RC2, the destroyed frequency signal.** v5 ranked dishes by a saturating count plus waiting
  time. The saturation made every established staple identical, so selection degenerated into
  take-turns rotation, and rotation serves every dish in a pool at roughly equal rates. A
  category's output frequency therefore tracked how many dishes it has in the library, not how
  often the household eats it: chicken (many library dishes) ran at 2.3 lunches a week against an
  eaten 1.4, fish tikka (one dish) fell to 0.5 against an eaten 0.875, salads beat raita by pool
  size, dal halved. The household's dish distribution is heavy-tailed (a few staples repeat
  constantly while roughly 24 of 34 lunch mains appear exactly once); rotation's output is
  near-uniform. No cap or budget layered on top changes the attractor.

v6 inverts the architecture: the record is not an input to a ranking, the record is the target
distribution, and the engine's one job is to reproduce its statistics under the composition
constraints. Selection becomes rate-deficit scheduling (§3) and generation becomes plan-then-place
(§6).

## 2. The record

The engine's primary signal is the **household record**: every as-eaten row from the served weeks
(2026-06-15 onward), with swaps applied and skipped days excluded. The 5-week seed history
(`data/menu_history.md`) is not part of the record: it predates the household's hand-edit teaching
and describes a menu style the served weeks have since corrected (measured: protein salads, egg-led
lunches, and weekday desserts appear in the seed and zero times in the served weeks). A dish eaten
only in the seed era is a candidate like any other never-eaten dish. Two properties are
load-bearing and permanent:

- **Cumulative, never windowed.** The record only grows. No rolling window of recent weeks ever
  replaces or dilutes it, so the household's real eating history stays in the signal forever.
- **As-eaten, not as-generated.** A swapped-in dish counts; a swapped-out dish does not; a skipped
  day contributes nothing (the week still counts as one record week). The record measures what the
  household ate, which makes hand edits the engine's teacher.

### 2.1 Source of truth

The record is read from the prod `currentWeek` table, one row per `weekStart`: every row whose
`weekStart` is earlier than the week being generated is a **record week**, whatever its `status`.
The as-eaten state of a record week is its live slot state (swaps, adds, and deletes applied),
minus every day named in its `skippedDays`, minus every pick whose `dishId` is null (a free-text
custom one-off has no library identity and contributes no row until it is promoted to a library
dish and its slot re-pointed at the new id). `weekArchive` is not the record source: finalize
snapshots the week at the moment of finalizing, and the household edits weeks after that moment,
so the archive under-reports as-eaten rows for edited weeks. `weekArchive` stays as it is for the
picker and Explore surfaces until those read the record (§12).

### 2.2 Occasions and rates

Every rate is measured per **occasion**, not per week, because the household does not eat every
planned day (44 of the first 48 planned days were eaten). An occasion is one non-skipped slot of a
given kind in a record week:

| Scope             | Occasion                       | Planned per generated week |
| ----------------- | ------------------------------ | -------------------------- |
| weekday breakfast | a non-skipped Monday to Friday | 5                          |
| weekday lunch     | a non-skipped Monday to Friday | 5                          |
| Saturday          | a non-skipped Saturday         | 1                          |
| fruit             | a non-skipped day, in season   | 6                          |

From the record the engine derives, per dish and per scope it can occupy:

- `eatenCount[scope]`: as-eaten rows of the dish in that scope's slots.
- `occasions[scope]`: the number of record occasions of that scope.
- `rate[scope] = eatenCount[scope] / occasions[scope]`: servings per occasion. A weekday lunch
  dish eaten 6 times over 36 weekday-lunch occasions has weekday rate 0.167 and, if it was also
  eaten on 1 of 8 Saturdays, a separate Saturday rate of 0.125; over a five-occasion week the
  weekday ledger accrues 0.83.

Scopes are symmetric and disjoint: a dish's Saturday ledger accrues only its Saturday rows and is
charged only by Saturday placements; its weekday ledger only its weekday rows and placements. A
dish with no as-eaten row in a scope is **absent** from that scope's pools, not present at rate
zero, so a weekday pasta never competes for the Saturday treat and a Saturday chole bhature never
competes for a weekday star. For Category Fruit dishes the scope is the season: as-eaten fruit rows
whose week falls in the current season, across all years of the record, over the record's
in-season day occasions; a season with zero record occasions falls back to the dish's all-season
rate, so an unobserved season still ranks its pool by real signal instead of collapsing to id
order. (Amended after the debate: per-week rates overstated every family by about 9 percent
against a 44-of-48 record; per occasion, chicken and mutton at the 60-week horizon sit inside the
25 percent fidelity bar. Saturday scoping removes the weekday complete meals, Singapore noodles
and curd rice among them, that topped the treat slot with weekday-earned rates.)

A dish with `eatenCount = 0` in every scope is a **candidate**, not a repertoire member.
Candidates never enter ordinary position pools; they enter menus only through the exploration
channel (§7) or the fruit overflow rule (§9). This encodes the household's stated rule directly: we
do not prioritize things we have not eaten.

The engine also derives per dish its **weekday-occupation memory** (which weekday-meal slots it
has occupied in the record, and when), read by §6 step 5, and its `lastEatenWeek`, read by the
cold start (§3).

## 3. Selection: rate-deficit scheduling

Every repertoire dish carries one persistent number per scope, its **deficit**: how far behind its
own eaten rate the engine currently is. (This is error diffusion of fractional rates, the standard
deterministic way to reproduce a fractional average with integers: a dish eaten 1.4 times a week
comes out as 1, 2, 1, 1, 2, and a dish eaten once a month surfaces about every fourth week, with no
randomness anywhere.)

The bookkeeping, exactly:

- **Accrual.** Before generating each week, for every dish that is currently eligible (Active and
  in-season), `deficit += rate × plannedOccasions`, using the rate computed against the current
  record, so the rate self-updates as the record grows. Ineligible dishes (inactive, out of season)
  neither accrue nor decay; their deficit freezes until they return. A dish that belongs to no v6
  pool (a bare breakfast carb such as Pav, Toast, or Plain paratha) has no ledger at all: it
  neither accrues nor is a candidate, and stays reachable only by swap.
- **Charge.** When the engine places a dish anywhere in the plan, `deficit -= 1` immediately in the
  scope it was placed in, so a second same-week placement requires a deficit above 1, which only
  high-rate staples reach. This is the built-in repeat guard; it replaces v5's within-week recency
  demotion and its favorites repeat exception in one stroke (fish tikka at about 0.19 per weekday
  lunch earns an occasional second placement, an ordinary dish does not).
- **Reconciliation.** When a record week closes, every as-eaten dish the engine did not place (a
  hand swap-in) is charged `deficit -= 1` as well, so it does not get over-proposed the following
  week. A dish the engine placed and the household swapped out keeps its charge (no refund): the
  placement consumed its turn, so it stays away for the weeks its rate implies, and because its
  `eatenCount` did not rise while its occasions grew, its rate falls. Swaps steer the engine in
  both directions through this one ledger.
- **Cold start.** At the cutover week each dish's deficit is seeded by backdated accrual, capped at
  one serving: `deficit = min(rate × occasionsSinceLastEaten, 1)`, with `occasionsSinceLastEaten`
  counted from the dish's most recent as-eaten week to the cutover week. The seed applies **only to
  dishes that belong to a structural pool** (lunch stars, carbs, breakfast mains, Saturday treats,
  desserts, fruit); dishes that only ever fill optional slots (companions, breakfast small items,
  Saturday accompaniments) start at zero. The ledger behaves as if accrual had been running since
  each dish's last serving, so the start is staggered instead of synchronized, and the cap keeps a
  long-unserved dish to at most one banked serving. (Amended by measurement: an all-zero start
  ranks the first weeks purely by rate, which starves the once-eaten tail. Amended again after the
  debate: seeding optional-pool dishes banked about half a serving per dish in pools of ten or
  more, a one-time transient of several extra salads and chutneys that the self-feed then locked
  in, because a one-time surplus of k rows at a record of N occasions is a permanent k/N shift in
  the dish's rate.) Deficits persist across weeks and may go negative.

### 3.1 The ledger is replayed, not stored

No table holds deficits. The ledger is a pure function of persisted data and is replayed on every
generation: seed at the cutover week from the record before it, then for each week from the
cutover week to the week being generated, accrue against the record as it stood, charge the
placements the engine made that week (persisted on the week's `currentWeek` row as its
`generatedPlan`, §12), and charge every as-eaten row of that week the plan did not contain. A week
with no `currentWeek` row accrues only. Each replayed week is replayed in its own season (the
season its `weekStart` falls in): its eligibility set, its fruit season scope, and its charges are
evaluated for that season, so an out-of-season dish's deficit stays frozen across the weeks it is
absent, exactly as §3 requires, whatever season the generating week is in. Replay is linear in weeks times dishes and keeps §10's
promise that all state derives from persisted data; it also makes the gate's "corrected" run (§11)
the same code path as production.

### 3.2 Selection within a pool

Selection within any pool is always: highest deficit wins, ties break by dish id ascending,
nothing else. Pools stay role-partitioned as today (breakfast mains, lunch stars, companions,
carbs, chutneys, fruit, desserts, Saturday treats, dry-protein partners) and gated by Active plus
in-season plus presence in the scope (§2.2).

**Structural versus optional elements.** A slot the plate structurally requires (a lunch star, the
carb on a standard plate, the Saturday main and dessert, the daily fruit, a breakfast main) is
always filled. When at least one dish in its pool has a positive deficit, the top deficit wins.
When every deficit in the pool is negative or zero, the slot is filled by the **highest-rate dish
in the pool not already placed this week**, ties by id: the thing the household eats most is what
the plate reaches for when nothing is due. (Amended after the debate: filling an exhausted pool
by least-negative deficit handed the carb slot's overflow, about 0.3 fills a week above the carb
pool's summed rate, to the low-rate specialty rotis by turn, which ran them at +76 percent at both
horizons; the workhorse fallback returns that overflow to plain roti, as the rulebook's rule 6
says.) The fruit slot's exhausted-pool rule is different and is stated in §9.

An optional element (a lunch companion, a breakfast small item, the Saturday accompaniment) is
included only when the top dish in its pool has a positive deficit; otherwise the plate stays
smaller. This is how "ceilings, never targets" becomes mechanism: plate sizes are metered by the
record's own companion rates instead of being filled to a budget. **Reopening trigger, recorded
here so it is not re-argued:** if the §11 self-feeding run shows any optional slot's presence rate
more than 25 percent over its record presence rate on weeks 20 to 60, that slot (and only that
slot) gains its own presence-rate ledger, accrued and charged like a dish's. Neither dry run
justified it once the seed and the chutney slot were corrected. **The trigger has fired for two slots** (first gate run: weekday companion presence +34 percent self-fed and +38 percent frozen, Saturday accompaniment 100 percent against a record 75, while the breakfast small item sat at +4 percent; the frozen failure shows the cause is the maximum over a wide pool of per-dish ledgers, not drift). The **weekday lunch companion slot** and the **Saturday third-item slot** each carry a presence ledger: before each week `presenceDeficit += recordPresenceRate × plannedOccasions`, where the record presence rate is the share of that scope's record occasions whose plate carried the optional element (a companion on a weekday lunch; any third item on a Saturday, accompaniment, special protein, or partner alike); every placement into the slot charges 1, structural forms included; a hand-added element in a served week is charged at reconciliation and a removed one keeps its charge, exactly as §3 treats a dish. The slot is filled only while its presence deficit is positive; which dish fills it is then the pool's top deficit, falling back to the highest-rate dish not already placed this week when no deficit is positive (§3.2's structural rule, because presence has already been decided). The presence ledger is replayed with the dish ledgers (§3.1) and seeded at zero. The breakfast small-item slot stays on the dish rule alone.

There is no saturating count, no due-ness, no longest-unused, no streak cap, and no per-family
budget anywhere in this engine. Family frequencies need no mechanism because a family's served
rate is the sum of its dishes' rates: chicken sums to about 1.4 lunches a week, paneer to about
1.25 appearances across all its forms, the dal family to about 1.3, salads and raita to their
observed near-equal split, and mutton to about 0.25, surfacing every four to five weeks without
any rule naming it. Starvation is impossible by construction: any dish with a positive rate
accumulates deficit until it is served.

## 4. Week schedule

| Day        | Fruit   | Breakfast | Lunch                  |
| ---------- | ------- | --------- | ---------------------- |
| Mon to Fri | 1 fruit | 1-2 items | 2-3 items (ceiling 3)  |
| Sat        | 1 fruit | (none)    | 2-3 items, treat shape |
| Sun        | (none)  | (none)    | (none)                 |

**Exactly two weekday anchors exist, and no others.**

1. **Saturday is the treat lunch** (§5.4).
2. **Thursday breakfast is egg-anchored**: its main is an egg dish, or a light grain main
   (sevai, upma, sabudana khichdi) with boiled eggs as the small item. Observed on 7 of 8 recorded
   Thursdays.

No other dish, chutney, carb, cuisine, or fruit may be keyed to a weekday by any rule, present or
future. Everything else lands on days via least-recently-used placement (§6 step 5), so
placements drift across days the way the household's do.

## 5. Meal composition

The plate forms carry over from the production engine except where amended here. Unamended rules
(the one-HP-per-meal rule, the international form's cuisine-register rules, carb affinity) are
retained exactly as `docs/engine.md` §3 and §3.1 state them. The protein floor carries forward
day-scoped, amended below.

### 5.1 Weekday lunch

Star dish, carb, and at most one companion: 2 or 3 items, never 4 by default. The only way a lunch
reaches 4 items is the protein floor appending to a full 3-item plate. Amendments:

- **A hearty dal or legume dish is a valid star.** The star is a protein, a gravy, or a dal-family
  dish (dal, kadhi, chole, rajma, sambar); a dal-led lunch is a normal veg day, not a fallback. The
  star pool is every weekday-scope repertoire dish that is HP-tagged or in Category Gravy dish,
  Keto, or Complete meal; Category Accompaniment dishes (hummus and the salads included) are
  companions, never stars.
- **Carb-forward international mains take one dry protein.** Noodles, pasta, and fried-rice mains
  take exactly one protein companion in a grilled, tikka, or dry-fry preparation (an HP or Keto
  dish in Category Keto or Dry dish), never a gravy, and nothing else on the plate. True complete
  plates (biryani, pav bhaji, chole bhature, dosa, khichdi, pulao, and rich single mains) stay solo
  or with one small companion from Category Accompaniment under the optional rule.
- **One gravy per lunch, hard, no fallback.** Household-authored ("2 gravy dishes already").
- **Rice preferably not on consecutive days.** Soft; the record holds one observed violation.
- **No protein family twice in one day (cross-meal).** A lunch candidate whose protein family (per
  the family table, minus the soya rows) already appears in the same day's breakfast is demoted
  below all other candidates; then the same for an exact `primaryIngredient` match; if no
  alternative exists the repeat is allowed.
- **The protein floor is day-scoped.** The floor asks whether the day carries protein, not
  whether the lunch does: a breakfast whose main or small item is an HP-family dish (eggs and
  paneer included) satisfies the day, and the lunch gets no floor append. The floor fires only
  when neither meal of the day carries protein, and it appends one plain protein, Category Keto
  or Dry dish, never a Gravy dish or a complete meal. Saturday is exempt from the floor entirely;
  the treat register's base-plus-special-protein form (§5.4) is how protein reaches a Saturday
  plate. Soya chunks masala's HP tag does not satisfy the floor (§13). (Amended by measurement: a
  per-lunch floor fired 23 times in 10 weeks, inflating 4-item lunches to 27 percent against an
  observed 7 and appending protein salads the served weeks never show; day-scoped with the
  category restriction it fired 9 times and produced 6.7 percent against the household's 6.8.)
- **Whole-day prep ceiling: 120 active minutes.** After a day composes, if the summed
  `prepMinutes` of its breakfast and lunch exceed 120, the longest-prep droppable companion is
  replaced by the next-ranked shorter alternative, or dropped if none fits. A day whose protected
  items alone exceed 120 is reported, not repaired further (§11 threshold 10).

### 5.2 Weekday breakfast

One main plus at most one small item, never a second main. The breakfast-main pool is every
weekday-breakfast-scope repertoire dish of Breakfast time that is not a Category Accompaniment and
not a bare carb (a Category Bread or Paratha dish without the `complete_carb` tag); Breakfast-time
Dry dishes (anda bhurji, paneer bhurji, and their kin) are mains in this pool without retagging.

The small item is one of two things:

- **A chutney, dish-driven only.** A main in Category Chilla or Paratha, or a standalone Boiled
  eggs main, carries one breakfast chutney (Category Accompaniment, Time Breakfast), chosen by
  deficit from the chutney pool; no other main takes a chutney, and there is no optional chutney
  slot. (Amended after the debate: all 15 household chutney mornings sit beside a paratha, a
  chilla, or standalone boiled eggs, and 0 of the other 21 mornings carry one; the optional slot
  served chutney beside sevai, bread omelette, and sabudana at 54 percent of mornings against the
  household's 42, on pairings the record never shows.)
- **Boiled eggs riding along as the protein** beside a light grain main, under the optional
  positive-deficit rule; structural on Thursday (§4 anchor 2).

**Boiled eggs standalone is a valid breakfast**, the eggs as the main with just a chutney beside
them; the form is reached whenever Boiled eggs tops the breakfast main pool by deficit.
Egg-anchored mornings need no quota; the egg dishes' summed rates (about 2.1 mornings a week
observed) meter them.

### 5.3 International lunches

**No guaranteed slots.** International mains sit in the ordinary weekday lunch-star pool and
compete through their deficits like everything else, under a weekly ceiling of 2 weekday
international stars, which is a cap and never a target. Zero-international weeks are normal
output. Saturday's treat is governed by its own scope (§5.4) and does not count against the
ceiling. The rotation converges on the dishes the household actually re-eats because those are the
dishes with rates; new international dishes enter through exploration only.

### 5.4 Saturday

The Saturday plate is one treat main and one dessert, plus at most one accompaniment: 2 or 3
items. The accompaniment is optional under §3's positive-deficit rule (observed: a companion
beyond main and sweet on about half of Saturdays, not all); the protein floor never touches
Saturday (§5.1). Amendments:

- **The treat pool is Saturday-scoped** (§2.2): every eligible dish the record shows eaten as a
  Saturday main, competing on its Saturday rate, plus the everyday-base-plus-special-protein form,
  an everyday base (khichdi, pulao) elevated by a special protein beside it (mutton pepper fry,
  grilled chicken breast), which is the natural door for treat-register proteins. The special
  protein beside an everyday base is a plain protein, Category Keto or Dry dish, never a
  `complete_meal` or a Gravy dish, and it takes the accompaniment's place on the plate. There is no
  novelty door on Saturday: the pool grows only through the household's own Saturday swap-ins and
  custom dishes promoted to the library. (Decided by Rajat after the debate. With the six custom
  one-offs promoted the pool holds eleven or twelve distinct treats, which clears rolling-8
  distinctness by size alone; the debate's thin-pool door, a 0.125-rate exploration pick into the
  treat slot open only while the pool is under 8, is the named contingency if the refreshed record
  disagrees.)
- **A carb-forward international treat takes its dry protein on Saturday too.** When the treat is
  a noodle, pasta, or fried-rice main, the §5.1 dry-protein partner fills the accompaniment slot
  with precedence over salad, raita, and hummus; the plate stays at three. (Amended after the
  debate: the household paired Thai pineapple fried rice with fish tikka on a Saturday; round 2
  served all six Saturday carb internationals with raita, salad, or hummus and no protein.)
- **The dessert is selected by deficit from the dessert pool** and appears on every Saturday.
  Trigger, recorded so it is not re-argued: if dessert-less Saturdays reach 20 percent or more of
  the record over twelve or more Saturdays served after cutover, "structural" in this clause flips
  to "optional" under §3's rule and nothing else changes. (Rajat's decision: the household had
  dessert on 6 of 8 Saturdays and both misses were protein-led savory plates; two data points do
  not earn a rule, and an unwanted dessert costs one tap.)
- The Menu 3/Menu 4 split and the HP versus non-HP alternation coin flip are gone; deficit
  selection replaces alternation, which removes the last `Math.random` from the engine. Treat
  mains and desserts spread naturally because a served treat's deficit goes deeply negative for
  the weeks its rate implies.

## 6. Generation: plan, then place

Generation plans the whole week before assigning days, in this exact order. Within every step,
selection is §3's rule: highest deficit, id ascending on ties, charge on placement.

1. **Replay and accrue deficits** (§3, §3.1) against the current record.
2. **Pin favorites.** Every favorites-table dish is placed into exactly one slot of its meal type,
   oldest-added first, never breaking a hard composition rule; unplaceable favorites are reported,
   not forced. Pinning charges deficit like any placement; a favorite may still earn a second
   placement later through its own deficit.
3. **The exploration pick** (§7): exactly one, into a weekday lunch position, when a placeable
   candidate exists.
4. **Fill the plan.** Saturday treat main (and its special protein or dry-protein partner where the
   form calls for one), dessert, and optional accompaniment; the remaining weekday lunch stars
   (respecting the international ceiling, counting an international exploration pick); each
   plate's carb (standard plates always, by deficit from the carb pool); each plate's optional
   companion (positive-deficit rule, §3); the five breakfast mains (Thursday's from the
   egg-anchored pool of §4, the other four from the full breakfast-main pool); breakfast small
   items (§5.2); six fruits by deficit from the season's fruit pool (§9).
5. **Assign dishes to days by least-recently-used weekday.** Each dish remembers, in the record,
   which weekday-meal slots it has occupied. It is placed on the eligible weekday whose most recent
   occupation by this dish is oldest; a weekday it has never occupied counts as infinitely old;
   ties among never-occupied weekdays break by fewest total occupations, then Monday-first order.
   Assignment runs in plan priority order: pinned favorites, then stars by deficit descending, then
   everything else, and **the exploration pick last**, taking whichever weekday its plate shape
   still fits. **The exploration slot keeps its own least-recently-used weekday memory:** the weekday of every past exploration placement is read from the record's `generatedPlan` values (the plan pick whose dish had no as-eaten row before that week), and the pick is assigned to the eligible weekday least recently used by an exploration placement, never-used weekdays counting as oldest, ties Monday-first. (Amended after the debate: a never-eaten pick has no occupation history, so assigning it second sent it, and the roti it carried, to Monday in 10 of 10 weeks. Amended again after the first gate run: assigned last with no memory of its own, the pick took the leftover weekday, and plain roti held Friday lunch in 21 of 41 self-fed weeks and 27 of 41 frozen weeks, so the memory held in reserve is now the rule.)
6. **Constraint pass.** Enforce, in order: the two anchors (§4); one gravy per lunch (hard);
   cross-meal protein-family and ingredient demotion (§5.1); rice on consecutive days (soft,
   resolve by swapping the two lunches whose exchange clears it, earliest pair first, and accept
   the violation if no swap clears it); the day-scoped protein floor with its category
   restriction; item ceilings; the 120-minute prep ceiling. Every repair is deterministic: replace
   the offending dish with the next-ranked alternative from its own pool, or swap whole plates
   between the earliest pair of days that clears the violation. An engine-internal repair refunds
   the replaced dish's charge and charges the replacement; the no-refund rule of §3 is for
   household swap-outs only.

The output of generation is the week's plates plus the **generated plan**: the list of every
(day, meal, dishId) the engine placed, persisted with the week (§12) so that §3.1's replay and
§3's reconciliation can tell an engine placement from a hand swap-in.

## 7. Exploration: the novelty channel

This is a deliberate product dial for novelty, and it is the one sanctioned exception to
record-matching in the engine.

**Exactly one placement per week**, into a weekday lunch position, is the exploration slot: the
only door through which a never-eaten dish enters a menu. (Amended after the debate: "up to two,
at least one" was a range, not a rule, and the simulator resolved it to always two, which ran
novelty at 2.0 dishes a week against the household's 0.75, put two same-family picks in one week
in 5 of 10 weeks, and added 20 record rows per 10 weeks that each demanded future placements.
Rajat's decision: the one pick is a weekday lunch, never a breakfast; breakfast novelty comes from
the household's own swaps.)

- **Pool:** every Active, in-season Lunch-time dish with `eatenCount = 0` in every scope.
- **Ranking:** the familiar-but-new affinity score already specified for the Explore surface
  (shared-primary-ingredient frequency, protein-band proximity to the household median, category
  familiarity, equal-weight sum, id tiebreak), **computed over record rows of the candidate's own
  meal type**. (Amended after the debate: scored over the whole record, egg read as the most
  familiar lunch ingredient because it dominates breakfast, and egg-led lunches ran at five times
  the household's rate; scored over lunch rows, egg is one lunch in 44.)
- **Family governor on novelty:** a candidate whose protein family is already served at or above
  its record rate, measured over the trailing 8 generated weeks, is demoted below all other
  candidates. It stays while the gate's governor-off variant (§11) is unmeasured; if paneer holds
  inside the fidelity bar without it, a later round deletes it.
- **Placement:** a weekday lunch position. The pick may be an international main (it counts
  against the §5.3 ceiling) or an Indian plate's star or companion. It must satisfy every
  composition rule of its slot; if no slot accepts it, that week runs no exploration placement.
  Never on Saturday, never at breakfast.
- **Lifecycle:** an explored dish the household eats enters the record with `eatenCount = 1` and a
  live rate, and starts earning placements organically; one the household swaps away earns
  nothing.
- **Spacing:** a dish explored and not eaten is not re-proposed for 8 weeks.

## 8. Favorites

The favorites table keeps its product guarantee: every favorites-list dish is pinned into exactly
one slot of every generated week, spread across distinct days by the §6 step 5 placement, oldest
added first, never breaking a hard composition rule; unplaceable favorites are reported, not
forced. There is no pool exclusion and no recency exemption; both are subsumed by the deficit
ledger (§3), which lets a high-rate favorite earn a second placement and stops a low-rate one from
over-repeating. Every week is what the guarantee means: the one current favorite, avocado toast,
appears weekly by design even though the household ate it 6 weeks in 8 (Rajat's decision).

## 9. Fruit of the day

One fruit per day, Monday to Saturday, outside the item ceilings. Selection is the season-scoped
rate deficit of §2 and §3 (so the in-season favorite leads at its observed in-season rate: mango
at about 1.4 bowls a week in its season, without monopolizing, because each placement charges a
full serving against a fractional rate); placement is least-recently-used weekday like everything
else.

**The fruit slot's exhausted-pool rule admits candidates.** When every fruit in the season's
repertoire pool has a non-positive deficit, the day's fruit is drawn by least-recently-served from
**every Active, in-season Category Fruit dish, candidates included**, never-served counting as
oldest. A candidate served this way enters the record when eaten and earns a rate; the rule fires
only while supply is short and extinguishes as the season's pool grows, and it needs no threshold,
no nominal rate, and no new state beyond the occupation memory the engine already keeps. Within-
week repeats therefore occur only when the whole eligible in-season set holds fewer than six
fruits. (Rajat's decision after the debate: the record holds no Winter week, the library's
Winter-eligible fruits are banana, papaya, and pomegranate, and the engine should put newly added
Winter fruits on the table itself rather than wait for a swap. The content task that adds them is
in the plan.)

## 10. Determinism

No RNG anywhere, including Saturday. Same inputs, same week, byte for byte. Every tie in every
ranking bottoms out at dish id ascending, never at input order. All state the engine reads (the
record, the replayed ledger, the weekday-occupation memory, the favorites table, the persisted
generated plans) is derived from persisted data, never from the clock or a random source.

## 11. Verification gate

The spec-level lesson of three cycles: a rule correct in isolation can be wrong in interaction,
and only a long self-feeding simulation shows it. The gate is part of the spec. It runs as a
harness in the repository against the **built engine** on the integration branch, and the phase
does not merge to `main` until it passes; no further prototype dry run precedes implementation
(Rajat's decision, 2026-09-04).

- **Method.** The harness runs the engine self-feeding (each generated week is treated as eaten,
  unedited, and fed into the record that feeds the next) for 60 weeks from the current record. All
  thresholds are measured on weeks 20 to 60, the steady state, not the warm-up. Three runs:
  1. **Frozen:** rates fixed at the cutover record for the whole horizon. Measures the engine's
     own bias; a family that fails here needs an engine fix.
  2. **Self-feeding:** the production path. Measures drift; a family that passes frozen and fails
     here is the self-feed ratchet, not bias.
  3. **Corrected:** the self-feeding run with the record's own swap-away list replayed against the
     generated weeks (every dish the household swapped out in the served weeks is swapped out of
     any generated week that proposes it), so §3's reconciliation branch executes at least once.
     Variants run alongside for measurement only: the cold-start cap at 0.5 and a pool-level cap
     beside the specified structural-only seed; the family governor off; and the §14 rate-formula
     variant.
- **Thresholds.** Every rate is compared per occasion served against per occasion eaten.
  1. **Distribution fidelity, the headline gate:** for each tracked family (chicken, paneer, egg,
     fish, prawn, mutton, dal-family, international, plain roti, specialty roti, salad,
     raita/curd), the served rate is within 25 percent of its record rate on the self-feeding run. A family with fewer than four as-eaten rows in the record is reported, not gated, here and on threshold 12: a 25 percent bar on two rows is half a serving over the horizon, which no schedule can meet or miss meaningfully. (Amended after the first gate run: mutton, two rows, read +86 percent while the other eleven families passed.)
  2. **Lunch-main uniqueness:** at least 65 percent of lunch mains distinct over any rolling 8
     weeks (household baseline 77 percent).
  3. **Overlap band:** week-over-week dish-set Jaccard (the size of the intersection of two
     consecutive weeks' dish sets divided by the size of their union) averaged over the horizon,
     within 0.05 of the household baseline re-measured by the harness's own method on the record
     weeks. (Amended: the 0.263 quoted earlier does not reproduce on the 8 as-eaten weeks, which
     measure 0.207 by the same method; the band is set around the measured number, not the quoted
     one.)
  4. **Slot anti-lock:** no dish holds the same weekday-meal slot in more than half the weeks of
     the horizon, favorites included, exempting only the two §4 anchors and any dish whose rate
     arithmetically forces majority occupancy (a rate above half its role's weekly slots); and no
     category (international, specialty roti) and no individual chutney dish is day-locked in more than half the weeks, Saturday's own scope excepted. (Amended after the first gate run: the chutney category as a whole sat at 22 of 41 Mondays by construction, because every paratha and chilla morning carries one; the lock the rule guards against is one chutney on one weekday.)
  5. **Saturday:** no treat main repeats within any rolling min(8, Saturday pool size) Saturdays;
     dessert on 100 percent of Saturdays.
  6. **Fruit:** at least 4 distinct fruits per week and no fruit more than twice in a week, both
     measured only when the eligible in-season set holds 4 or more fruits; no consecutive-day
     repeat except under a thin pool.
  7. **Coverage:** every dish with `eatenCount >= 2` at simulation start is served at least once
     in any rolling 20-week window in which it is eligible.
  8. **International persistence:** 0.75 to 1.75 weekday international lunch stars per week
     averaged over every 10-week window, and never a 10-week window at 0.
  9. **Breakfast and forms:** at least 10 distinct breakfast mains across any 25-week window;
     standalone boiled-egg breakfasts present; dal-led lunches present.
  10. **Plate size and effort:** 4-item lunches under 10 percent of lunch days; 5-item lunches
      zero; days over the 120-minute prep ceiling reported; zero days over 150.
  11. **Presence rates:** breakfast small-item presence, weekday companion presence, and Saturday
      accompaniment presence each within 25 percent of the record's presence rate (this is what
      arms the §3.2 reopening trigger).
  12. **Drift bound:** each tracked family's rate over weeks 40 to 60 within 10 percent of its
      rate over weeks 20 to 40 on the self-feeding run (provisional until the first run shows the
      window-to-window noise of the two-row families).
  13. **Reported, not gated:** novelty placements per week; weekday lunches with no animal
      protein; Saturday plate shape; negative-deficit fills per role per week; picks by protein
      family.
- **Order of work.** A threshold that proves arithmetically unsatisfiable is amended in this
  document first, with the amendment noting the measured reason.

## 12. Carried forward unchanged, and the backend contract

These sections of the production `docs/engine.md` carry into v6 as they stand: §1 eligibility and
seasons; §3 forms except the §5 amendments above (the one-HP-per-meal rule, the international
form's cuisine-register rules, carb affinity, the dish-driven chutney widened to standalone boiled
eggs); §6 requested dishes (the favorites pinning reuses its slot-acceptance test); §8 skipped
days; §9 item cap as the role-aware safety net behind the ceilings (weekday cap 5, Saturday 3,
fruit outside the cap); §11 nutrition and its reports; §12 field reference minus the deletions
below; §13 spec-code parity and its change-order process. The §5 picker carries forward minus its
protein-band-distance term and minus its longest-unused head order: the head is ordered by
recency tier (not placed this week first) then dish id.

Backend contract, so the record and the ledger are derivable from persisted data alone:

- `currentWeek` gains an optional `generatedPlan` field: the (day, meal, dishId) list the engine
  placed when the row was written. Additive; rows written before cutover have none and are read as
  record-only weeks.
- Generation reads every `currentWeek` row with `weekStart` before the generating week as the
  record (§2.1), the favorites table, and the season, and writes the week plus its `generatedPlan`.
  The `rng` and `userRequestedDishId` arguments are removed; nothing supplies them.
- The Explore feed's "never cooked" set and the picker's recency tier read the record (§2.1), not
  the seed plus `weekArchive`. `data/menu_history.md` stays in the repo for provenance and is no
  longer read by generation, Explore, or the picker.
- The cutover week is derived, never configured: the earliest `weekStart` among record weeks that
  carry a `generatedPlan`, or the generating week itself when none does. The cold start (§3) seeds
  at that week and the replay (§3.1) starts there.

## 13. Deliberately absent

Removed or never adopted, listed so no later section revives them by reference:

- **Due-ness and the saturating count** (v5 §5): replaced by rate-deficit scheduling. Saturation
  destroys the frequency signal it was meant to carry (§1.1 RC2).
- **Longest-unused**, as primary sort or tiebreak: gone entirely, the fruit overflow rule's
  least-recently-served (§9) and the day assignment's least-recently-used weekday (§6) excepted,
  both of which order by occupation memory, not by eaten recency.
- **Within-week recency demotion and its exemptions** (carbs, chutneys, fruit) and the favorites
  repeat exception: subsumed by the deficit charge.
- **The protein streak cap, every per-family budget, a chicken ceiling, and any weighting of
  household-authored rows over engine-proposed ones**: family rates emerge from summed dish rates;
  drift is measured (§11 threshold 12) and monitored in production (the plan's slow-loop table),
  not ruled against.
- **Slot-level presence ledgers** for optional elements: not adopted; the §3.2 trigger reopens them
  per slot only on measured evidence.
- **The optional breakfast chutney slot**: chutney is dish-driven only (§5.2).
- **A second exploration pick, a spanning breakfast-plus-lunch novelty pool, a breakfast novelty
  ledger, and a Saturday novelty door**: one lunch pick a week (§7); the Saturday thin-pool door is
  a named contingency only (§5.4).
- **A nominal-rate fruit admission rule**: the fruit overflow rule (§9) is the whole mechanism.
- **A star-replacement repair for the prep ceiling**: reported instead (§5.1, §11 threshold 10).
- **Guaranteed international slots**: internationals compete like everything else under a ceiling.
- **The Saturday alternation flag** (HP versus non-HP) and the production `Math.random` coin flip.
- **Ingredient consolidation**: no observed signal in 206 hand edits; `Pack Size` stays grocery
  metadata only.
- **Never-cooked-first**: inverted by design (§2, §7).
- **Breakfast Option C and the breakfast Dry-dish retag**: the v6 breakfast-main pool admits
  Breakfast-time Dry dishes directly (§5.2), so no content change is needed.
- **`preferred` frontmatter field**: the favorites table is the only favorites signal.
- **`pairsWith`**: not part of this engine.
- **The seed history as signal** (`data/menu_history.md`): retired from the record entirely; the
  file stays for provenance. Rates learned from it reproduced pre-correction menu shapes (protein
  salads, egg-led lunches, weekday desserts) the household has since edited away.
- **`weekArchive` as the record source**: stale for edited weeks (§2.1); retained for provenance.
- **Menu 4 as a dessert-less Saturday**: retired.
- **Soya and tofu handling, narrowed:** tofu dishes and soya-as-the-day's-protein dishes (tandoori
  soya chunks, soyabean curry, soya matar keema, soya pulao, thai red curry tofu, thai tofu stir
  fry, tofu bibimbap, teriyaki tofu rice) deactivate as a content task; soya chunks masala stays
  Active as an occasional homely veg main that counts as a sabzi, never as the day's protein. The
  engine itself stays ignorant of specific proteins' likability; the record carries that signal.

## 14. Open items

Resolved by the debate and Rajat's decisions, and now folded into the sections above: the cold-
start cap (structural-only seed, with the sweep kept as a gate variant); the exploration rate;
the Saturday register; the fruit mechanism; the gate's counting definitions. Still open:

1. **The rate-formula variant.** `rate = eatenCount / occasionsSinceFirstEaten` (so a rising new
   staple's rate rises quickly instead of being diluted by the full record length) runs as a gate
   variant (§11); if it wins on fidelity it is written back into §2 with the measured reason, and
   either way this item closes when the gate report lands.
2. **Winter fruits.** The library's Winter-eligible fruit set is banana, papaya, and pomegranate.
   Rajat names the fruits the household eats in Winter; the content task adds them as Active
   in-season dishes with photos (`ADDING-DISHES.md`).
3. **Hummus.** Category Accompaniment in the library, so never a star (§5.1); the household led
   two weekday lunches with it. Rajat decides whether it is a main; if so it is a one-field
   content change and it enters the star pool through its record rows.
4. **The v4.1 branch salvage list**: the `cuisine_neutral` widening of the dry-protein pool (data
   tags, from PR #228) is cherry-picked into the content batch; the prep-budget plumbing and the
   favorites pin-beats-guard fix are rebuilt inside v6's own modules rather than ported; fruit-of-
   the-day removal is not salvaged, v6 keeps the fruit; `pairsWith` data is not carried.
5. **`docs/engine.md` at ship time:** rewritten wholesale from this document in the phase's docs
   stream, landing in the same integration PR as the code so the spec-code parity check holds.
