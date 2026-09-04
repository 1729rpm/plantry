# Engine v5: the household-anchored engine

The meal-planning rules for the next engine. This document is the specification; the next session
plans its implementation. It replaces the selection core and amends the composition rules of the
production engine; the mechanical sections that survive unchanged are listed in §11, and the things
deliberately removed are listed in §12 so nothing gets revived by accident.

Two sources ground every rule here: `features/household-menu-rules.md` (the observed household
rulebook, derived from the eight served weeks 2026-06-15 to 2026-08-10) and the recorded reasons in
the prod `manualChanges` table. Where a rule traces to observed behavior, the section says so.

## 1. The household model

Four instincts explain most of the household's 206 hand edits. Every rule in this document serves one
of them; a proposed rule that serves none of them does not belong in the engine.

1. **Familiarity first.** The household rotates a compact repertoire of dishes it already eats. The
   engine proposes what the record shows the household eats, not what it has avoided longest.
2. **Light by default.** When in doubt the plate gets smaller, not bigger. Item counts are ceilings,
   never targets.
3. **Protein daily, never doubled.** Every day carries protein, and a protein family never appears at
   both of a day's meals.
4. **Indulgence lives on Saturday.** The special main and the sweet concentrate there; weekdays stay
   everyday food.

Novelty is real but bounded: one or two new dishes a week keep the menu exciting (§6). It is a
channel, not the default.

## 2. The record

The engine's primary signal is the **household record**: every as-eaten history row from the seed
(`data/menu_history.md`) plus every finalized week in the archive, with swaps applied and skipped
days excluded. Two properties are load-bearing and permanent:

- **Cumulative, never windowed.** The record only grows. No rolling window of recent weeks ever
  replaces or dilutes it, so the household's real eating history stays in the signal forever. (The
  previous rebuild failed precisely because a 10-week rolling window ended up containing only the
  engine's own output; this clause exists to make that structurally impossible.)
- **As-eaten, not as-generated.** A swapped-in dish counts; a swapped-out dish does not; a skipped
  day contributes nothing. The record measures what the household ate, which makes hand edits the
  engine's teacher: every swap becomes signal for future weeks.

From the record the engine derives, per dish:

- `eatenCount`: total as-eaten rows across the whole record.
- `lastEaten`: the most recent weekStart the dish appears in.
- `repertoireScore = min(eatenCount, 4)`: a saturating count. (Saturating means the value stops
  growing at a cap: a dish eaten 4 times and a dish eaten 40 times score the same. The cap makes
  "core repertoire" a plateau, so established staples tie at the top and rotate among themselves by
  recency instead of the single most-eaten dish winning every slot forever.)

A dish with `eatenCount = 0` is a **candidate**, not a repertoire member. Candidates never enter
ordinary position pools; they enter menus only through the exploration channel (§6). This encodes
the household's stated rule directly: we do not prioritize things we have not eaten.

## 3. Week schedule

Unchanged in shape, amended on Saturday:

| Day        | Fruit   | Breakfast | Lunch                 |
| ---------- | ------- | --------- | --------------------- |
| Mon to Fri | 1 fruit | 1-2 items | 2-3 items (ceiling 3) |
| Sat        | 1 fruit | (none)    | 3 items, fixed shape  |
| Sun        | (none)  | (none)    | (none)                |

- **Saturday always carries a dessert.** The Saturday plate is one special main (a `complete_meal`
  dish), one accompaniment, one dessert. Observed: sweets on 6 of 8 Saturdays and zero weekdays; the
  household added the missing ones by hand. The old Menu 3/Menu 4 split (dessert on one form only)
  is retired; the two forms collapse into this single shape, with the protein floor (§4) covering a
  non-HP main. A floor companion is a plain protein, Category Keto or Dry dish, never a
  `complete_meal` or a Gravy dish (a dry-run plate once floored Khichdi with Chole bhature; the
  category restriction removes that class of plate; Khichdi with Fish tikka is the intended shape,
  matching the household's own khichdi with mutton pepper fry).
- **Saturday alternation is deterministic.** The engine reads the most recent Saturday's main from
  the record and alternates its style (HP-led versus non-HP-led). No random draw anywhere in the
  engine; the production `Math.random` coin flip is removed.
- Weekday lunches keep their Indian-plate default with up to two international substitutions per
  week (§5 governs which dishes anchor them). The archive's Menu 1/2 numbering strings stay valid
  for history compatibility.

## 4. Meal composition

The plate forms carry over from the production engine, with five amendments. Everything here that is
unamended (the one-HP-per-meal rule, breakfast Option B and the Tue/Thu single pick, the dish-driven
chutney, self-sufficient mains served alone, the international form's cuisine-register rules, the
lunch protein floor, carb affinity) is retained exactly as `docs/engine.md` §3 and §3.1 state it.

1. **Ceilings, not budgets.** The weekday lunch composes star dish, carb, and at most one companion:
   2 or 3 items, never 4 by default. The old `lunchBudget = clamp(5 - breakfastItems, 2, 4)` formula,
   which filled a light-breakfast day up to a 4-item lunch, is deleted. A light breakfast leaves a
   light day. Observed: 4-item lunches happened 3 times in 44 days and were hand-trimmed; deletions
   outnumber additions 46 to 26. The only way a lunch reaches 4 items is the protein floor appending
   to a full 3-item plate.
2. **One gravy per lunch, hard, no fallback.** Retained verbatim; the household authored this rule
   ("2 gravy dishes already").
3. **Rice never on consecutive days.** Retained verbatim; household-authored ("don't have rice on
   continuous days").
4. **No protein family twice in one day (cross-meal).** When composing lunch, any candidate whose
   protein family (per the §4.6 family table, minus the soya rows) already appears in the same day's
   breakfast is demoted below all other candidates; if no alternative exists the repeat is allowed.
   This replaces the old ingredient-keyed same-day step and enforces what the household stated ("we
   have paneer in breakfast as well"). The old step's ingredient check folds into this one: family
   match first, then exact `primaryIngredient` match, both demote.
5. **Whole-day prep ceiling: 120 active minutes.** After a day composes, if the summed `prepMinutes`
   of its breakfast and lunch exceeds 120, the longest-prep droppable companion is replaced by the
   next-ranked shorter alternative (or dropped if none fits). Verified achievable with zero
   violations in prior simulation; it operationalizes "light by default" on effort as well as food.

Breakfast Option C is deleted as a form (it is unreachable dead logic against the current library).
The four stranded breakfast Dry dishes (anda bhurji, egg podimas, paneer bhurji, vegetable omelette)
are a content task: retag them so the Tue/Thu single-pick pool accepts them, which also widens the
breakfast rotation. That is a library change, not an engine rule.

## 5. Selection: the repertoire ranking

After composition produces a slot's position pools (repertoire members only; candidates are §6's
business), each pool is ranked by this chain. Each step breaks ties from the previous.

1. **Due-ness, descending.** `dueness = min(eatenCount, 4) + min(weeksSinceEaten, 4)`, where
   `weeksSinceEaten` is whole weeks between the generating week and `lastEaten`. Frequency and
   waiting time add, so a staple eaten last week yields to a mid-frequency dish that has waited,
   and returns a week or two later; staples cycle fast, occasional dishes cycle slow, and no
   repertoire member can be starved forever. Because the record is skewed the way the household is
   skewed (egg-heavy breakfasts, fish tikka often, mutton rarely), the protein ladder, the dal
   cadence, and the rich-versus-lean register all emerge from this step without their own
   mechanisms. The old flat protein-diversity step ("give every protein a fair shot") is deleted:
   the record's skew is the preference, not an error to correct.
   _Amended by measurement:_ the first draft ranked by the saturated count alone with longest-unused
   as a tiebreak. A 10-week self-feeding dry run showed that rotates only within the top score tier,
   locking the same anchors in every week (overlap 0.67 against the 0.20 to 0.35 band) while
   lower-tier dishes never got served and so could never climb, the same absorbing-state family
   that sank v4.1. The additive due-ness form measured 0.22.
2. **Longest unused.** The tiebreak among equal due-ness: the dish not eaten for the longest time
   ranks first. Never-eaten does not occur here (candidates are excluded from these pools).
3. **Same-day protein and ingredient demotion.** §4 amendment 4.
4. **Within-week recency, soft, with a favorites exception.** A dish already placed this week sinks
   below fresh alternatives, except a favorites-list dish, which is only demoted after its second
   placement. Observed: the household repeats favorites within a week (fish tikka twice, twice;
   grilled chicken twice; bread omelette twice) and repeats nothing else. Hard cap: no dish appears
   more than twice a week (recency-exempt staples aside).
5. **Dish id, ascending.** The final tiebreak is always the dish id, never input array order, so a
   reordered library can never change output. (This closes a known determinism hole.)

**Recency exemptions** (steps 2 and 4 do not apply): lunch carbs (Chapati, Rice categories),
breakfast accompaniments (chutneys), and fruit. Roti most days and the same chutney twice a week are
intended.

**Protein spread, the one guard the record cannot provide:** the record's skew makes chicken and egg
frequent, which is correct, but frequency alone could make the same family lead three or more lunches
in one week. One soft rule: a protein family that has already led two lunches this week is demoted
below fresh-family alternatives. Two is the observed household maximum; this is a cap on streaks,
not a push toward flatness.

## 6. Exploration: the novelty channel

Up to **two placements per week, at least one**, on distinct days, are exploration slots: the only
door through which a never-eaten dish enters a menu.

- **Pool:** every Active, in-season dish with `eatenCount = 0`.
- **Ranking:** the familiar-but-new affinity score already specified for the Explore surface
  (shared-primary-ingredient frequency, protein-band proximity to the household median, category
  familiarity, equal-weight sum, id tiebreak). Novelty should resemble what the household already
  eats; observed new entries are homely (stuffed capsicum, cabbage matar aloo, dosa), not exotic.
- **Placement:** exploration slots are weekday lunch positions. One exploration pick may serve as
  the week's international anchor when it is non-Indian; the other (or the only one) lands as an
  Indian plate's star or companion. An exploration pick must still satisfy every composition rule of
  its slot; if no slot accepts it, that week runs fewer exploration placements. Never on Saturday
  (Saturday is for established treats).
- **Lifecycle:** an explored dish the household eats (it survives the week unswapped) enters the
  record with `eatenCount = 1` and starts earning repertoire rank organically; one the household
  swaps away earns nothing and simply waits its turn again. Repertoire membership is earned by being
  eaten, never granted by being placed.
- **Spacing:** a dish explored and not eaten is not re-proposed for 8 weeks (it goes to the back of
  the affinity queue), so the channel keeps offering different novelty instead of re-pitching a
  rejected dish.

The international lunches themselves are now repertoire-ranked like everything else (§5), so the
non-Indian rotation converges on the dishes the household actually re-eats (red sauce pasta,
singapore noodles, hummus, veg fried rice, thai curries) instead of chasing untried cuisines. New
international dishes enter through this channel only.

## 7. Favorites

The favorites table keeps its guarantee: every favorites-list dish is pinned into exactly one slot
of every generated week, spread across distinct days, oldest-added first, never breaking a hard
composition rule; unplaceable favorites are reported, not forced. Two amendments:

- The exactly-once **pool exclusion is removed**: after its guaranteed placement a favorite remains
  in ordinary pools and may earn a second placement through §5 ranking (its high repertoire score
  makes that likely), up to the two-per-week cap. This legalizes the observed favorite repetition.
- Pinned favorites are exempt from the within-week recency demotion for their guaranteed slot, as
  today.

## 8. Fruit of the day

One fruit per day, Monday to Saturday, outside the item ceilings, chosen by season-scoped
preference instead of rotation:

- **Pool:** Active, in-season, Category=Fruit.
- **Ranking:** season-scoped due-ness descending: `min(seasonEatenCount, 4) + min(weeksSinceEaten, 4)`,
  where `seasonEatenCount` counts as-eaten fruit rows whose week falls in the current season across
  all years of the record; ties break by longest-unused, then id. The week's days then **deal down
  the ranked list** (Monday takes the top fruit, Tuesday the next, wrapping when the list runs out),
  so the seasonal favorite recurs without monopolizing. Observed: the household swapped mango in six
  times during mango season while the old longest-unused rotation kept rotating away from it.
  Within-week fruit repeats stay allowed under a thin pool.
  _Amended by measurement:_ the first draft ranked by raw season count with a single per-day winner;
  the dry run served mango all six days of every Monsoon week, a rich-get-richer loop the
  saturating count and the dealt assignment remove.

## 9. Determinism

No RNG anywhere, including Saturday (§3). Same inputs, same week, byte for byte. Every tie in every
ranking bottoms out at dish id ascending, never at input order. The generation call reads the last
Saturday form from the record rather than requiring the caller to thread it through.

## 10. Verification gate

The spec-level lesson of the last two cycles: a rule correct in isolation can be wrong in
interaction, and only a long self-feeding simulation shows it. So the gate is part of the spec.

- **Method.** The simulation harness runs the engine self-feeding (each generated week finalizes
  into the record that feeds the next) for 60 weeks from the current record. **All thresholds are
  measured on weeks 20 to 60**, the steady state, not the warm-up.
- **Thresholds.** Named metrics with measured baselines; each was checked for satisfiability against
  the household record before being set.
  1. **Repertoire coverage:** every dish with `eatenCount >= 2` at simulation start is served at
     least once in any rolling 20-week window. (Baseline failure this guards: the prior design
     starved 32 of 65 such dishes permanently.)
  2. **Overlap band:** week-over-week dish-set Jaccard (the size of the intersection of two
     consecutive weeks' dish sets divided by the size of their union, a standard set-similarity
     measure) between 0.20 and 0.35 averaged over the horizon. Household baseline: 0.263 measured
     on its own weeks. Below the band the engine churns; above it the menu stagnates.
  3. **Breakfast variety:** at least 10 distinct breakfast mains across any 25-week window
     (household baseline: 11 distinct mains in 28 observed breakfasts).
  4. **International persistence:** between 1 and 2 international lunches per week on average in
     every 10-week window of the steady state, never a window at 0. (Guards the week-20 death mode.)
  5. **Plate size:** 4-item lunches under 10 percent of lunch days; 5-item lunches zero. Dessert on
     100 percent of Saturdays.
  6. **Slot stickiness:** no dish occupies the same weekday-meal slot in more than half the weeks
     of the horizon. (Guards the every-Monday-avocado-toast mode; phrased as a share, not as
     cycle-freedom, because a deterministic engine always has cycles.)
  7. **Exploration throughput:** 1 to 2 exploration placements per week, sustained across the whole
     horizon, and at least 60 percent of the horizon's exploration picks are distinct dishes.
  8. **Prep ceiling:** zero days over 120 active minutes.
- **Order of work.** Simulate the §5 and §6 interaction against these thresholds **before** any
  implementation stream opens. A threshold that proves arithmetically unsatisfiable is amended in
  this document first, with the amendment noting the measured reason.

## 11. Carried forward unchanged

These sections of the production `docs/engine.md` carry into v5 as they stand, and the implementation
plan treats them as untouched: §1 eligibility and seasons; §3 forms except the five §4 amendments
above; §6 requested dishes (the favorites pinning reuses it); §8 skipped days; §9 item cap as the
role-aware safety net behind the new ceilings (weekday cap 5, Saturday 3, fruit outside the cap);
§11 nutrition and its reports; §12 field reference minus the deletions below; §13 spec-code parity
and its change-order process. The §5 picker carries forward minus its protein-band-distance term:
head order becomes recency tier then id, and the slot-meal-first partition stays.

## 12. Deliberately absent

Removed or never adopted, listed so no later section revives them by reference:

- **Ingredient consolidation** (old §10 and ranking step 3): dropped entirely. No observed signal in
  206 hand edits; the household confirmed it is not important. `Pack Size` stays in the catalog as
  grocery metadata only.
- **Longest-unused as the primary sort** and **never-cooked-first**: inverted by design (§2, §5).
- **Flat protein diversity** (old step 6): replaced by the streak cap in §5.
- **Picker protein-band distance**: dropped (§11).
- **Breakfast Option C**: deleted as dead logic (§4).
- **`preferred` frontmatter field**: deleted from the schema; the favorites table is the only
  favorites signal.
- **`pairsWith`**: not part of this engine. Data authored for it on an unmerged branch is not carried
  into the spec.
- **Menu 4 as a dessert-less Saturday**: retired (§3).
- **Soya and tofu handling**: a content note, not an engine rule. The household does not prefer
  them; the library task is to deactivate or rework those dishes (and the §4.6 soya normalization
  rows go away with them). The engine itself stays ignorant of specific proteins' likability; the
  record carries that signal.

## 13. Open items for the implementation plan

1. The fate of the open v4.1 branch and PRs #228/#229: which verified-clean pieces (prep budget
   plumbing, `cuisine_neutral` widening, the favorites pin-beats-guard fix, fruit-of-the-day removal
   is NOT one, v5 keeps the fruit) are cherry-picked versus rebuilt.
2. The breakfast Dry-dish retagging batch and the soya/tofu library review (content work, own PRs).
3. Threading the record into generation efficiently (the cumulative record grows forever; the
   derived per-dish aggregates in §2 are all the engine reads, so the record itself never needs to
   be shipped whole into a generation call).
4. Whether `docs/engine.md` is rewritten wholesale from this document at ship time (recommended) or
   amended section by section.
