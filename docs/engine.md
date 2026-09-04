# Engine

The meal-planning rules. This document is the human-readable specification; `engine/src/` is its executable form. Both change together: a pull request that edits this document carries the paired change under `engine/src/` and `engine/test/`, and review holds that pairing. See §16 for the parity rule and the verification gate in full.

The engine reproduces what the household eats. The **record** of served weeks is not an input to a ranking, it is the target distribution, and the engine's one job is to reproduce its statistics under the composition constraints. Four instincts of the household explain the rules below; a proposed rule that serves none of them does not belong in the engine.

1. **Familiarity first.** The household rotates a compact repertoire it already eats. The engine proposes what the record shows the household eats, at the frequencies the record shows.
2. **Light by default.** When in doubt the plate gets smaller, not bigger. Item counts are ceilings, never targets.
3. **Protein daily, never doubled.** Every day carries protein, and a protein family never appears at both of a day's meals.
4. **Indulgence lives on Saturday.** The special main and the sweet concentrate there; weekdays stay everyday food.

Novelty is real but bounded: one new dish a week keeps the menu interesting (§7). It is a channel, not the default.

## 1. Data and eligibility

Sources:

- `data/dishes/<slug>.md`: dish library, one file per dish (YAML frontmatter for the dish fields, a `## Ingredients` table for its ingredient rows)
- `data/ingredients.md`: ingredient catalog, one row per canonical ingredient, carrying its grocery group, canonical unit, and pack size
- Convex `currentWeek`: the household record, one row per week (§2)
- `data/menu_history.md` and Convex `weekArchive`: provenance. Both hold week rows for reference; neither is read by generation, Explore, or the picker.

A dish is eligible for the current week if Active=Yes and its Seasons include the current Bangalore season.

Bangalore seasons: Summer (March to May), Monsoon (June to September), Winter (October to February). Seasons=All means year-round.

## 2. The record

The engine's primary signal is the **household record**: every as-eaten row from the served weeks, with swaps applied and skipped days excluded. Two properties are load-bearing and permanent:

- **Cumulative, never windowed.** The record only grows. No rolling window of recent weeks replaces or dilutes it, so the household's real eating history stays in the signal forever.
- **As-eaten, not as-generated.** A swapped-in dish counts; a swapped-out dish does not; a skipped day contributes nothing (the week still counts as one record week). The record measures what the household ate, which makes hand edits the engine's teacher.

### 2.1 Source of truth

The record is read from the Convex `currentWeek` table, one row per `weekStart`: every row whose `weekStart` is earlier than the week being generated is a **record week**, whatever its `status`. The as-eaten state of a record week is its live slot state (swaps, adds, and deletes applied), minus every day named in its `skippedDays`, minus every pick whose `dishId` is null. A free-text custom one-off has no library identity, so it contributes no row until it is promoted to a library dish and its slot re-pointed at the new id.

`weekArchive` is not the record source: finalize snapshots the week at the moment of finalizing and the household edits weeks after that moment, so the archive under-reports as-eaten rows for edited weeks. It stays as provenance, alongside `data/menu_history.md`.

### 2.2 Occasions and rates

Every rate is measured per **occasion**, not per week, because the household does not eat every planned day. An occasion is one non-skipped slot of a given kind in a record week:

| Scope             | Occasion                       | Planned per generated week |
| ----------------- | ------------------------------ | -------------------------- |
| weekday breakfast | a non-skipped Monday to Friday | 5                          |
| weekday lunch     | a non-skipped Monday to Friday | 5                          |
| Saturday          | a non-skipped Saturday         | 1                          |
| fruit             | a non-skipped day, in season   | 6                          |

From the record the engine derives, per dish and per scope it can occupy:

- `eatenCount[scope]`: as-eaten rows of the dish in that scope's slots.
- `occasions[scope]`: the number of record occasions of that scope.
- `rate[scope] = eatenCount[scope] / occasions[scope]`: servings per occasion. A weekday lunch dish eaten 7 times over 36 weekday-lunch occasions has rate 0.194; over a five-occasion week it accrues 0.97.

Scopes are symmetric and disjoint: a dish's Saturday ledger accrues only its Saturday rows and is charged only by Saturday placements; its weekday ledger only its weekday rows and placements. A dish with no as-eaten row in a scope is **absent** from that scope's pools, not present at rate zero, so a weekday pasta never competes for the Saturday treat and a Saturday chole bhature never competes for a weekday star.

For Category=Fruit dishes the scope is the season: as-eaten fruit rows whose week falls in the current season, across all years of the record, over the record's in-season day occasions. A season with zero record occasions falls back to the dish's all-season rate, so an unobserved season still ranks its pool by real signal instead of collapsing to id order.

A dish with `eatenCount = 0` in every scope is a **candidate**, not a repertoire member. Candidates never enter ordinary position pools; they enter menus only through the exploration channel (§7) or the fruit overflow rule (§9). The household does not prioritize what it has not eaten.

The engine also derives per dish its **weekday-occupation memory** (which weekday-meal slots it has occupied in the record, and when), read by §6 step 5, and its `lastEatenWeek`, read by the cold start (§3).

## 3. Rate-deficit scheduling

Every repertoire dish carries one persistent number per scope, its **deficit**: how far behind its own eaten rate the engine currently is. This is error diffusion of fractional rates, the standard deterministic way to reproduce a fractional average with integers: a dish eaten 1.4 times a week comes out as 1, 2, 1, 1, 2, and a dish eaten once a month surfaces about every fourth week, with no randomness anywhere.

The bookkeeping, exactly:

- **Accrual.** Before generating each week, for every dish that is currently eligible (Active and in-season), `deficit += rate × plannedOccasions`, using the rate computed against the current record, so the rate self-updates as the record grows. Ineligible dishes (inactive, out of season) neither accrue nor decay; their deficit freezes until they return. A dish that belongs to no pool (a bare breakfast carb such as Pav, Toast, or Plain paratha) has no ledger at all: it neither accrues nor is a candidate, and stays reachable only by swap.
- **Charge.** When the engine places a dish anywhere in the plan, `deficit -= 1` immediately in the scope it was placed in, so a second same-week placement requires a deficit above 1, which only high-rate staples reach. This is the built-in repeat guard: fish tikka at about 0.19 per weekday lunch earns an occasional second placement, an ordinary dish does not.
- **Reconciliation.** When a record week closes, every as-eaten dish the engine did not place (a hand swap-in) is charged `deficit -= 1` as well, so it is not over-proposed the following week. A dish the engine placed and the household swapped out keeps its charge (no refund): the placement consumed its turn, so it stays away for the weeks its rate implies, and because its `eatenCount` did not rise while its occasions grew, its rate falls. Swaps steer the engine in both directions through this one ledger.
- **Cold start.** At the cutover week each dish's deficit is seeded by backdated accrual, capped at one serving: `deficit = min(rate × occasionsSinceLastEaten, 1)`, with `occasionsSinceLastEaten` counted from the dish's most recent as-eaten week to the cutover week. The seed applies **only to dishes that belong to a structural pool** (lunch stars, carbs, breakfast mains, Saturday treats, desserts, fruit); dishes that only ever fill optional slots (companions, breakfast small items, Saturday accompaniments) start at zero. The ledger behaves as if accrual had been running since each dish's last serving, so the start is staggered instead of synchronized, and the cap keeps a long-unserved dish to at most one banked serving.

Deficits persist across weeks and may go negative.

### 3.1 The ledger is replayed, not stored

No table holds deficits. The ledger is a pure function of persisted data and is replayed on every generation: seed at the cutover week from the record before it, then for each week from the cutover week to the week being generated, accrue against the record as it stood, charge the placements the engine made that week (persisted on the week's `currentWeek` row as its `generatedPlan`, §16), and charge every as-eaten row of that week the plan did not contain. A week with no `currentWeek` row accrues only.

The **cutover week** is derived, never configured: the earliest `weekStart` among record weeks that carry a `generatedPlan`, or the generating week itself when none does. The cold start seeds at that week and the replay starts there.

Replay is linear in weeks times dishes and keeps §14's promise that all state derives from persisted data. It also makes the gate's corrected run (§16) the same code path as production.

## 4. Pools and selection

Pools are role-partitioned (breakfast mains, breakfast small items, lunch stars, companions, carbs, chutneys, fruit, desserts, Saturday treats, dry-protein partners) and gated by Active plus in-season plus presence in the scope (§2.2).

**Selection within any pool is always: highest deficit wins, ties break by dish id ascending, nothing else.**

**Structural versus optional elements.** A slot the plate structurally requires (a lunch star, the carb on a standard plate, the Saturday main and dessert, the daily fruit, a breakfast main) is always filled. When at least one dish in its pool has a positive deficit, the top deficit wins. When every deficit in the pool is negative or zero, the slot is filled by the **highest-rate dish in the pool not already placed this week**, ties by id: the thing the household eats most is what the plate reaches for when nothing is due. The fruit slot's exhausted-pool rule is different and is stated in §9.

An optional element (a lunch companion, a breakfast small item, the Saturday accompaniment) is included only when the top dish in its pool has a positive deficit; otherwise the plate stays smaller. This is how "ceilings, never targets" becomes mechanism: plate sizes are metered by the record's own companion rates instead of being filled to a budget.

**Reopening trigger.** If the §16 self-feeding run shows any optional slot's presence rate more than 25 percent over its record presence rate on weeks 20 to 60, that slot (and only that slot) gains its own presence-rate ledger, accrued and charged like a dish's.

The ledger is the engine's only frequency mechanism: no per-family budget, no streak cap, and no separate due-ness score sits beside it. Family frequencies need none, because a family's served rate is the sum of its dishes' rates: chicken sums to about 1.4 lunches a week, paneer to about 1.25 appearances across all its forms, the dal family to about 1.3, salads and raita to their observed near-equal split, and mutton to about 0.25, surfacing every four to five weeks without any rule naming it. Starvation is impossible by construction: any dish with a positive rate accumulates deficit until it is served.

## 5. The week and the plate

| Day        | Fruit   | Breakfast | Lunch                  |
| ---------- | ------- | --------- | ---------------------- |
| Mon to Fri | 1 fruit | 1-2 items | 2-3 items (ceiling 3)  |
| Sat        | 1 fruit | (none)    | 2-3 items, treat shape |
| Sun        | (none)  | (none)    | (none)                 |

The Fruit of the day (§9) sits outside the breakfast and lunch slots and outside the §11 item cap. Breakfast is savoury only.

**Exactly two weekday anchors exist, and no others.**

1. **Saturday is the treat lunch** (§5.5).
2. **Thursday breakfast is egg-anchored**: its main is an egg dish, or a light grain main (sevai, upma, sabudana khichdi) with boiled eggs as the small item.

No other dish, chutney, carb, cuisine, or fruit is keyed to a weekday by any rule. Everything else lands on days via least-recently-used placement (§6 step 5), so placements drift across days the way the household's do.

### 5.1 Plate rules that hold everywhere

**One HP source per meal.** A single meal (a day's breakfast or a day's lunch) contains at most one HP-tagged dish. Each form below picks its protein main first; once an HP dish occupies the meal, the meal's remaining (non-main) positions exclude HP-tagged dishes. This is keyed on the `HP` tag, never on dish names, so it holds for any HP protein (chicken on chicken, paneer on paneer) and across every form: a "Chicken biryani" complete_meal never sits beside a "Chicken salad" HP accompaniment on one Saturday plate. Thin-pool fallback: if excluding HP-tagged dishes would empty a non-main position pool, the unfiltered pool is used so the slot still fills (one HP-main meal with a second HP side beats an incomplete meal). This is rare given the broad companion pools and surfaces as composition signal for the slow loop, not a hard error.

**One gravy per lunch, hard.** A lunch plate holds at most one Category=Gravy dish item. When the star is itself a Gravy dish, the companion pool excludes Gravy dishes entirely; when a Gravy companion lands, any further companion position excludes Gravy. This is keyed on Category, never on dish names. Unlike the one-HP rule there is NO thin-pool fallback: a plate one companion short beats a two-gravy plate, so the rule never yields to fill a slot. Two wet dishes on one plate is the over-serving the household deletes by hand ("2 gravy dishes already"); this rule removes it at generation time.

**Self-sufficient mains.** A self-sufficient main (tagged `complete_meal`, or Category=Complete meal) fills its slot alone: no separate carb, no accompaniment beyond what its own form allows. The signal is the union of the tag and the category, because a dish can be Category=Complete meal without the `complete_meal` tag (White sauce pasta), and the tag alone would miss it. A non-complete-meal gravy that is itself filling (kadhi, for one) is not structurally distinguishable from a gravy that wants a companion, so it carries no suppression and is left to in-week manual swap.

**Cuisine register.** Cuisine coherence is a meal-level concern, keyed on the `cuisine` field and never on names. An Indian plate composes `cuisine === "Indian"` dishes only, so it never lands a lone non-Indian companion. A non-Indian star's plate keeps one register: a companion is eligible only when it shares the star's cuisine OR carries the `cuisine_neutral` tag (a plain protein with no cuisine character, grilled chicken breast or boiled eggs, that pairs with any register).

**Carb affinity.** The carb on a standard plate is picked by the star's optional `carbAffinity` field (§15):

- `carbAffinity: Rice` picks from the plain Category=Rice pool (kadhi, chhole, sambar, rasam, and the non-Indian curry-type stars).
- `carbAffinity: Roti` picks from the plain Category=Chapati pool.
- Absent picks from Category=Chapati, the default, so most stars leave the field unset. (`Roti` therefore resolves to the same pool as absent; it records the canonical pairing.)

A non-Indian star takes no Indian Chapati or Rice carb, with one exception: a star with `carbAffinity: Rice` (a Thai, Korean, or Chinese curry) takes a register-neutral steamed-rice carb, a Category=Rice dish carrying the `cuisine_neutral` tag. `Roti` affinity never applies on a non-Indian plate.

**Rice preferably not on consecutive days.** Soft, resolved in the §6 constraint pass by swapping the two lunches whose exchange clears it; the violation is accepted when no swap clears it.

**No protein family twice in one day (cross-meal).** A lunch candidate whose protein family already appears in the same day's breakfast is demoted below all other candidates; then the same for an exact `primaryIngredient` match; if no alternative exists the repeat is allowed. The protein-family table collapses cuts of one protein into a single family and passes every other ingredient through unchanged (each is its own family):

| `primaryIngredient` | Protein family |
| ------------------- | -------------- |
| Chicken             | Chicken        |
| Chicken Breast      | Chicken        |
| Chicken Keema       | Chicken        |

Any value not in the table (Paneer, Egg, Fish, Prawn, Mutton, Chickpea, and any non-protein primary such as Couscous or Rice) maps to itself. The table is keyed on the ingredient label, never on dish names, so it holds for any dish carrying that primary. §7's family governor reads the same table.

**The protein floor is day-scoped.** The floor asks whether the day carries protein, not whether the lunch does: a breakfast whose main or small item is an HP-family dish (eggs and paneer included) satisfies the day, and the lunch gets no floor append. The floor fires only when neither meal of the day carries protein, and it appends one plain protein, Category=Keto or Dry dish, never a Gravy dish and never a complete meal. Saturday is exempt from the floor entirely; the treat register's base-plus-special-protein form (§5.5) is how protein reaches a Saturday plate. Soya chunks masala's HP tag does not satisfy the floor: it is an occasional homely veg main that counts as a sabzi, never as the day's protein. An empty floor pool leaves the plate protein-less and writes a `warn` incident (a real gap, not steady-state noise).

**Whole-day prep ceiling: 120 active minutes.** After a day composes, if the summed `prepMinutes` of its breakfast and lunch exceed 120, the longest-prep droppable companion is replaced by the next-ranked shorter alternative, or dropped if none fits. A day whose protected items alone exceed 120 is reported, not repaired further (§16 threshold 10). There is no star replacement for the prep ceiling.

### 5.2 Weekday lunch

Star dish, carb, and at most one companion: 2 or 3 items, never 4 by default. The only way a lunch reaches 4 items is the protein floor appending to a full 3-item plate.

- **The star pool** is every weekday-scope repertoire dish that is HP-tagged or in Category Gravy dish, Keto, or Complete meal. A hearty dal or legume dish is a valid star: the star is a protein, a gravy, or a dal-family dish (dal, kadhi, chole, rajma, sambar), and a dal-led lunch is a normal veg day, not a fallback. Category=Accompaniment dishes (hummus and the salads included) are companions, never stars.
- **The carb** is picked by the star's carb affinity (§5.1) on every standard plate. A self-sufficient main takes none.
- **The companion** is optional under §4's positive-deficit rule, drawn from the non-HP companion pool (Category in Gravy dish, Dry dish, Accompaniment) under the one-gravy rule.
- **Carb-forward international mains take one dry protein.** Noodles, pasta, and fried-rice mains take exactly one protein companion in a grilled, tikka, or dry-fry preparation (an HP or Keto dish in Category Keto or Dry dish), never a gravy, and nothing else on the plate.
- **True complete plates** (biryani, pav bhaji, chole bhature, dosa, khichdi, pulao, and rich single mains) stay solo or with one small companion from Category=Accompaniment under the optional rule.

### 5.3 Weekday breakfast

One main plus at most one small item, never a second main. The breakfast-main pool is every weekday-breakfast-scope repertoire dish of Time=Breakfast that is not a Category=Accompaniment and not a bare carb (a Category=Bread or Paratha dish without the `complete_carb` tag). Breakfast-time Dry dishes (anda bhurji, paneer bhurji, and their kin) are mains in this pool.

The small item is one of two things:

- **A chutney, dish-driven only.** A main in Category Chilla or Paratha, or a standalone Boiled eggs main, carries one breakfast chutney (Category=Accompaniment, Time=Breakfast), chosen by deficit from the chutney pool. No other main takes a chutney, and there is no optional chutney slot. An empty chutney pool omits it.
- **Boiled eggs riding along as the protein** beside a light grain main, under the optional positive-deficit rule; structural on Thursday (§5 anchor 2).

**Boiled eggs standalone is a valid breakfast**, the eggs as the main with just a chutney beside them; the form is reached whenever Boiled eggs tops the breakfast main pool by deficit. Egg-anchored mornings need no quota: the egg dishes' summed rates (about 2.1 mornings a week observed) meter them.

### 5.4 International lunches

**No guaranteed slots.** International mains sit in the ordinary weekday lunch-star pool and compete through their deficits like everything else, under a weekly ceiling of 2 weekday international stars, which is a cap and never a target. Zero-international weeks are normal output. Saturday's treat is governed by its own scope (§5.5) and does not count against the ceiling. The rotation converges on the dishes the household re-eats, because those are the dishes with rates; new international dishes enter through exploration only (§7).

The plate keeps its cuisine register (§5.1). A veg-forward international star (not HP, not Keto, not a complete meal, Continental baked vegetables for one) reaches its protein through the day-scoped floor, whose candidates on that plate must be same-cuisine or `cuisine_neutral`. Thin pools degrade gracefully: a missing companion leaves the star as a valid 1-item international lunch.

### 5.5 Saturday

The Saturday plate is one treat main and one dessert, plus at most one accompaniment: 2 or 3 items. The accompaniment is optional under §4's positive-deficit rule; the protein floor never touches Saturday (§5.1).

- **The treat pool is Saturday-scoped** (§2.2): every eligible dish the record shows eaten as a Saturday main, competing on its Saturday rate, plus the **everyday-base-plus-special-protein** form, an everyday base (khichdi, pulao) elevated by a special protein beside it (mutton pepper fry, grilled chicken breast), which is the natural door for treat-register proteins. The special protein beside an everyday base is a plain protein, Category=Keto or Dry dish, never a `complete_meal` and never a Gravy dish, and it takes the accompaniment's place on the plate. There is no novelty door on Saturday: the pool grows only through the household's own Saturday swap-ins and custom dishes promoted to the library.
- **A carb-forward international treat takes its dry protein on Saturday too.** When the treat is a noodle, pasta, or fried-rice main, the §5.2 dry-protein partner fills the accompaniment slot with precedence over salad, raita, and hummus; the plate stays at three.
- **The dessert is selected by deficit from the dessert pool** and appears on every Saturday. Trigger: if dessert-less Saturdays reach 20 percent or more of the record over twelve or more Saturdays served after cutover, "structural" in this clause flips to "optional" under §4's rule and nothing else changes.

Treat mains and desserts spread naturally because a served treat's deficit goes deeply negative for the weeks its rate implies.

## 6. Generation: plan, then place

Generation plans the whole week before assigning days, in this exact order. Within every step, selection is §4's rule: highest deficit, id ascending on ties, charge on placement.

1. **Replay and accrue deficits** (§3, §3.1) against the current record.
2. **Pin favorites** (§8). Every favorites-table dish is placed into exactly one slot of its meal type, oldest-added first, never breaking a hard composition rule; unplaceable favorites are reported, not forced. Pinning charges deficit like any placement; a favorite may still earn a second placement later through its own deficit.
3. **The exploration pick** (§7): exactly one, into a weekday lunch position, when a placeable candidate exists.
4. **Fill the plan.** Saturday treat main (and its special protein or dry-protein partner where the form calls for one), dessert, and optional accompaniment; the remaining weekday lunch stars (respecting the international ceiling, counting an international exploration pick); each plate's carb (standard plates always, by deficit from the carb pool); each plate's optional companion (positive-deficit rule, §4); the five breakfast mains (Thursday's from the egg-anchored pool of §5, the other four from the full breakfast-main pool); breakfast small items (§5.3); six fruits by deficit from the season's fruit pool (§9).
5. **Assign dishes to days by least-recently-used weekday.** Each dish remembers, in the record, which weekday-meal slots it has occupied. It is placed on the eligible weekday whose most recent occupation by this dish is oldest; a weekday it has never occupied counts as infinitely old; ties among never-occupied weekdays break by fewest total occupations, then Monday-first order. Assignment runs in plan priority order: pinned favorites, then stars by deficit descending, then everything else, and **the exploration pick last**, taking whichever weekday its plate shape still fits.
6. **Constraint pass.** Enforce, in order: the two anchors (§5); one gravy per lunch (hard); cross-meal protein-family and ingredient demotion (§5.1); rice on consecutive days (soft, resolve by swapping the two lunches whose exchange clears it, earliest pair first, and accept the violation if no swap clears it); the day-scoped protein floor with its category restriction; item ceilings; the 120-minute prep ceiling. Every repair is deterministic: replace the offending dish with the next-ranked alternative from its own pool, or swap whole plates between the earliest pair of days that clears the violation. An engine-internal repair refunds the replaced dish's charge and charges the replacement; the no-refund rule of §3 is for household swap-outs only.

The output of generation is the week's plates plus the **generated plan**: the list of every (day, meal, dishId) the engine placed, persisted with the week (§16) so that §3.1's replay and §3's reconciliation can tell an engine placement from a hand swap-in. Generation also emits `incidents`, `unplacedFavorites`, and a `diagnostics` object the gate reads (per-role fills from an exhausted pool, the exploration pick and its family, the constraint-pass repairs, and days over the prep ceiling).

## 7. Exploration and the Explore ranking

Exploration is a deliberate product dial for novelty, and it is the one sanctioned exception to record-matching in the engine.

**Exactly one placement per week**, into a weekday lunch position, is the exploration slot: the only door through which a never-eaten dish enters a menu.

- **Pool:** every Active, in-season Lunch-time dish with `eatenCount = 0` in every scope.
- **Ranking:** the familiar-but-new affinity score (§7.1), computed over record rows of the candidate's own meal type.
- **Family governor:** a candidate whose protein family (§5.1) is already served at or above its record rate, measured over the trailing 8 generated weeks, is demoted below all other candidates.
- **Placement:** a weekday lunch position. The pick may be an international main (it counts against the §5.4 ceiling) or an Indian plate's star or companion. It must satisfy every composition rule of its slot; if no slot accepts it, that week runs no exploration placement. Never on Saturday, never at breakfast.
- **Lifecycle:** an explored dish the household eats enters the record with `eatenCount = 1` and a live rate, and starts earning placements organically; one the household swaps away earns nothing.
- **Spacing:** a dish explored and not eaten is not re-proposed for 8 weeks.

### 7.1 The familiar-but-new affinity score

The same score orders the exploration pool and the Explore surface, which ranks the eligible (Active, in-season) never-eaten dishes "familiar but new": dishes the household has not had yet but that resemble what it cooks, so novelty fits the household's habits rather than surfacing random unseen dishes. On the Explore surface this is a display ranking; it never narrows a pool or blocks a pick.

Each pooled dish scores three affinity signals against the record rows of its own meal type, each normalised to the range zero to one (one being the strongest affinity):

1. **Shared-primary-ingredient frequency.** How dominant the dish's Primary Ingredient is in the record: the share of eaten rows whose Primary Ingredient matches, divided by the most-eaten Primary Ingredient's share, so the single most-eaten ingredient scores one. A paneer dish scores high in a paneer-heavy record.
2. **Protein-band proximity.** Closeness of the dish's per-person protein (§12) to the household's eaten-median protein, measured in fixed 5 g protein bands: one divided by (one plus the band distance), so a dish in the median band scores one and the score decays with distance.
3. **Category familiarity.** How common the dish's Category is in the record, normalised the same way as signal 1 (most-eaten Category scores one).

**Combined score** is the equal-weight sum of the three signals. Dishes rank by combined score descending, ties broken by dish id ascending. Scoping the signals to the candidate's own meal type is what keeps a breakfast-dominant ingredient from reading as the most familiar lunch ingredient.

**Dominant-affinity key.** Each ranked dish also carries the single signal that contributed most to its score, as a structured key (`shared-ingredient`, `protein-match`, or `familiar-category`), not user-facing prose. The Explore UI phrases its "why it fits" line from this key (Principle 7: display is decoupled from structure; no internal label text leaks from the engine). Ties between equal signal values resolve by a fixed priority order (shared-ingredient, then protein-match, then familiar-category), so the key is deterministic too.

## 8. Favorites and requested dishes

**Favorites.** Every dish on the household's standing favorites list (the `favorites` table, curated in the app) is pinned into exactly one slot of every generated week, spread across distinct days by the §6 step 5 placement, oldest added first, never breaking a hard composition rule. Placement respects the dish's meal, a breakfast favorite lands in one day's breakfast and a lunch favorite in one day's lunch plate, because a wrong-meal dish never appears in a slot's composition pools. When the full set cannot all be placed without breaking a hard §5 composition lock (one gravy per plate, the item ceilings, the day-scoped protein floor) or the week runs out of accepting slots, the oldest win and the remainder is returned as `unplacedFavorites` for the caller to log as one incident per week. The pass never breaks a composition lock to force a favorite in.

There is no pool exclusion and no recency exemption: both are subsumed by the deficit ledger (§3), which lets a high-rate favorite earn a second placement and stops a low-rate one from over-repeating. Every week is what the guarantee means: a favorite appears weekly by design even where its own rate is lower.

Free-text custom favorites are display-only and are not a generation input (the engine has no dish to place for a name not in the library). An absent or empty favorites set makes the pass a no-op, so a run with no favorites is byte-identical to one without it.

**Requested dishes.** Generation accepts an optional list of requested dish ids; each must be placed into the upcoming week. The favorites pin reuses the slot-acceptance test this mechanism provides. The mechanism is retained and tested; it has no production feeder today.

- **Placement.** A requested dish is placed into a slot whose §5 composition accepts it. "Composition accepts it" means the dish appears in at least one position pool of that slot's candidate set: it is an Active, in-season, meal-time-matching dish the slot could legitimately hold. Requests are resolved in their given order; each takes the first schedule slot (in schedule order) whose composition accepts it and that is not already claimed by an earlier request or by a pinned favorite. Two requests therefore never collide on one slot.
- **Unplaceable requests.** A request that no slot's composition accepts (out of season, inactive, an unknown id, or no fitting free slot remains) produces an incident and is not placed. Generation never crashes and never forces a dish into an incompatible slot. The dish stays queued; the caller re-queues it the following week.
- **Minimal by design.** A request is a list of dish ids, not a generic directive language: no calendar awareness, no per-day pinning (a request cannot say "place this on Friday"). That can earn its way in later if it proves needed (Principle 1, Principle 8).

The mechanism is additive: with no requests, generation behaves exactly as §2 to §7 describe. A request that lands in a slot is then subject to the same §11 cap as any other pick; the cap dropping a placed request is reported as a §11 incident, so a requested dish is always either placed exactly once or accounted for by an incident.

## 9. Fruit of the day

One fruit per day, Monday to Saturday, Saturday included even though it has no breakfast. The fruit is its own section, separate from breakfast and lunch: it is not a breakfast item, not a lunch item, and not subject to the composition forms of §5.

- **Eligibility.** The candidate pool is every dish that is Active, in-season (§1), and Category=Fruit.
- **Selection.** The season-scoped rate deficit of §2 and §3, so the in-season favorite leads at its observed in-season rate (mango at about 1.4 bowls a week in its season) without monopolizing, because each placement charges a full serving against a fractional rate. Placement is least-recently-used weekday like everything else (§6 step 5).
- **The exhausted-pool rule admits candidates.** When every fruit in the season's repertoire pool has a non-positive deficit, the day's fruit is drawn by least-recently-served from **every Active, in-season Category=Fruit dish, candidates included**, never-served counting as oldest. A candidate served this way enters the record when eaten and earns a rate; the rule fires only while supply is short and extinguishes as the season's pool grows. It needs no threshold, no nominal rate, and no state beyond the occupation memory the engine already keeps. Within-week repeats therefore occur only when the whole eligible in-season set holds fewer than six fruits.
- **Cap.** The Fruit of the day is outside the §11 item cap. It is a fruit, not a meal item, so it never counts toward the 5-item weekday cap or the 3-item Saturday cap and is never a cap-drop candidate.
- **Grocery and record.** A fruit dish is a real library dish with ingredient rows, so its ingredients flow into the grocery list (§10 skip-aware aggregation) like any other day dish, and its slot is a record row like any other (§2.2, the fruit scope).

## 10. Skipped days

A skipped day is a fast-loop override applied after generation. Generation itself is untouched: the day keeps its generated dishes in the data so a restore is lossless. What changes is what a skipped day contributes downstream:

- **Grocery list.** A skipped day's dishes contribute nothing to the buy list. The grocery aggregator (whose list shape `docs/product.md` §3 item 3 fixes) accepts an optional set of skipped days and excludes those days' dishes before summing. With no days skipped, the list is exactly as before.
- **The record.** A skipped day's dishes were not eaten, so they contribute no as-eaten rows and no occasions (§2.1, §2.2). The week still counts as one record week. The same exclusion applies to the provenance rows finalize writes.

Both are pure, additive functions: the skipped-day input defaults to none, so every existing caller is unchanged. The running app wires the override through the Convex `skippedDays` field, the skip-aware grocery query, the finalize exclusion, and the "Skipped" rendering on the Menu tab and the menu share image.

## 11. Item cap

Cap: 5 items per weekday, 3 on Saturday.

The cap counts breakfast and lunch items only. The Fruit of the day (§9) is outside the cap: it is a fruit, not a meal item, so it never counts toward the per-day total and is never a cap-drop candidate.

The cap is role-aware. Each composed pick carries a structural role from §5: `breakfast-main`, `breakfast-small`, `star`, `carb`, `companion`, `floor`, `partner`, `treat`, `special-protein`, `accompaniment`, `dessert`, or `fruit`. When composition produces a menu over the cap, drop picks one at a time:

1. Drop only a droppable side (role `companion` or `accompaniment`) while any remains. The star, carb, breakfast main, breakfast small item, protein floor, dry-protein partner, Saturday treat, special protein, and dessert are protected: they are never dropped while a droppable side is still on the day.
2. Among the droppable sides, drop the lowest Satiety; among those the longest Prep Min; among those the later position in the day (earlier slots win).
3. Fallback (rare): if the day is still over the cap with no droppable side left, drop the worst pick overall by the same Satiety then Prep Min then position order, so the day still resolves.

Repeat until at the cap.

The cap is a safety net, not the per-day budget. §5's ceilings compose each day at or under it by construction (a 1-or-2-item breakfast with a 2-or-3-item lunch, Saturday at 2 or 3), so the cap should not fire in normal generation; when it does, it signals a real defect, and the role-aware order still protects the structural elements by dropping a side first. An over-cap incident is a genuine warning to investigate, not steady-state noise.

## 12. Nutrition

Dish macros are derived, never hand-stored. There is no per-dish protein or carb field and no override field: the single source of truth is each ingredient row's quantity and the catalog's per-100g macros (§15 field reference). `engine/src/nutrition.ts` computes them; correcting one ingredient's macros corrects every dish that uses it.

For one dish:

- **Protein (g per person)** = ( Σ over ingredient rows of `grams × Protein /100g ÷ 100` ) ÷ 2.
- **Carbs (g per person)** = the same with `Carbs /100g` ÷ 2.
- **Fat (g per person)** = the same with `Fat /100g` ÷ 2.
- **Fibre (g per person)** = the same with `Fiber /100g` ÷ 2.
- **Calories (kcal per person)** = 4 × protein + 4 × carbs + 9 × fat, the per-person grams above run through the Atwater factors (the standard food-energy convention: protein and carbohydrate yield about 4 kcal/g, fat about 9 kcal/g). Zero when no macro data exists for the dish.
- **Protein-to-carb ratio** = protein ÷ carbs (per-person and dish-total give the same ratio); undefined when carbs are zero.
- **Healthy** (a boolean) = the dish clears two bars at once: at least `HEALTHY_PROTEIN_CALORIE_FRACTION` of its calories come from protein (4 × protein ÷ calories) AND fibre per person is at least `HEALTHY_FIBER_PER_PERSON`. Both thresholds are named constants in `nutrition.ts`, tunable in one place: the defaults are 0.25 (25 percent of calories from protein) and 3 g of fibre per person. A dish with zero derived calories has no macro data, so it is never healthy: the filter never shows a false positive, and the zero-calorie guard also keeps the protein-fraction division safe.

The ÷ 2 is the household basis: every dish serves two and macros display per person.

Grams per ingredient row:

- `g` rows are already grams.
- `pcs` rows convert via the catalog's `Grams per piece` (an egg is about 50 g). A `pcs` row with no `Grams per piece` contributes zero (it cannot be weighed, so it cannot contribute macro mass).
- `ml` rows convert to grams 1:1, assuming a culinary liquid density of about 1 (milk and coconut milk both sit within noise of this for a display macro). No per-ingredient density column exists until a dish needs one (Principle 8).
- A blank `Protein /100g`, `Carbs /100g`, `Fat /100g`, or `Fiber /100g` reads as zero; an ingredient absent from the catalog contributes zero.

The macros are derived for display and for the reporting layer (below); they are not a §5 composition input or a §4 selection input. The `HP` tag stays the rule input for high-protein composition; the reporting layer only surfaces drift between the tag and the derived protein. The derived `healthy` flag is the single source of truth behind the Explore and picker "Healthy" filter chip: the frontend reads it, never re-implementing the thresholds.

### 12.1 Reports (non-blocking)

Alongside the blocking validators (§1, §15), a reporting layer in `engine/src/data/validators.ts` produces non-blocking reports, regenerated by `npm run reports` and printed in CI output without failing the build. They carry judgment CI cannot make and feed the slow loop:

- **Coverage report:** the share of active dishes carrying each enrichment field (description, recipe, complexity, photo) and the share of macro-relevant catalog rows carrying macros, tracked per macro column (protein/carbs, fat, and fibre, so the energy and Healthy inputs ratchet independently). Macro-relevant rows are the food groups (Proteins and Dairy, Pantry, Vegetables); aromatics and herbs may stay blank, and the Fruit group is excluded from the denominator (the generic "Fruit" placeholder row carries no macros). This is the ratchet the enrichment work burns down; blank macros and unpopulated fields are expected until they are filled, so near-zero coverage is correct, not a failure.
- **Pool-coverage report:** for each §4 pool, per season, the count of eligible candidates. Surfaces thin pools (the source of repetition) and flags when a season change strands a slot. The pools come from the live pool functions, so the report cannot drift from the engine.
- **HP-vs-protein consistency:** warns when a dish's derived protein and its `HP` tag disagree, using a high-protein threshold of 20 g per person. Dishes whose macros are not yet populated are skipped, so the report stays silent until macros exist. The `HP` tag remains the rule input; this only surfaces drift.
- **Special-sourcing report:** for each active dish, the special-sourcing ingredients it uses, resolved against the catalog's `Special` flag (§15). Answers "which dishes need a special shopping trip, and for what", so the week's supermarket or specialty-store run is visible up front; a dish with no special ingredients is omitted. This is the sourcing signal the future Swiggy ordering automation (product.md §8) consumes.

## 13. Picker ranking

§4 ranks generation pools. The picker is the separate ranking the swap and add affordances use when a user opens "Replace with..." or "Add a dish". It answers a different question: given the broad, non-restrictive pool (every Active, in-season dish; `docs/product.md` §6 "a generic ranked picker over the active library", and Principle 4), which alternatives surface first?

For a breakfast or lunch slot the pool is generic across meal-time: every Active, in-season, non-Fruit dish, so a breakfast dish is reachable from a lunch slot and vice versa. The fruit slot keeps its Category=Fruit pool (§9). Meal-time is not a hard pool filter; it is a swap-time ordering signal (below).

The picker does not narrow the pool (Principle 4: a swap may land on any Active, in-season dish, including a cross-meal one; the resulting composition mismatch is signal for the slow loop, not an error the fast loop blocks). It only orders it. The order is a **head** followed by a **tail**, with slot-meal-matching dishes led to the front of the default view.

**Head ("fits this day").** Every pool dish not already placed on that day. Within the head, dishes are ordered by a deterministic lexicographic comparison on a tuple, lower first:

```
headOrder(dish) = (recencyTier, id)
```

- **recencyTier** is the two-value tier the record supplies for the week being edited: a dish not placed anywhere in this week sits in the first tier, a dish already placed elsewhere in the week in the second. It is the dominant term, so a fresh dish always outranks one the week already holds.
- **id** is dish id ascending, the total tie-break. Within a tier the order is stable and total, so the same pool always renders in the same order.

**Tail.** Every other pool dish (the same-day repeats the head excluded), ordered by the same tuple comparison. The tail keeps the pool complete (nothing is dropped) while pushing dishes the day already has below fresh options.

**Slot-meal-first default ordering.** After the head/tail ranking, the swap picker stable-partitions the result so dishes whose own meal-time matches the slot lead and cross-meal dishes follow, each group keeping its ranked order. This is a swap-time ordering, not a pool filter: the full ranked pool is still offered (search and filter pills reach every dish), and only the default suggested order leads with slot-meal-matching dishes. The fruit slot's pool is single-purpose and needs no partition. The ranking engine itself is meal-time-blind; this partition is applied by the picker's caller.

**Determinism.** No RNG. Every tie resolves through the fixed tuple chain: recency tier, then dish id ascending, and the slot-meal-first partition is stable. The same inputs always produce the same order, and input order does not affect output.

## 14. Determinism

No RNG anywhere, including Saturday. Same inputs, same week, byte for byte. Every tie in every ranking bottoms out at dish id ascending, never at input order. All state the engine reads (the record, the replayed ledger, the weekday-occupation memory, the favorites table, the persisted generated plans) derives from persisted data, never from the clock and never from a random source.

## 15. Field reference

**Per-dish file (`data/dishes/<slug>.md`) frontmatter:**

- `id`, `name`: identifiers. The `<slug>` filename is derived from the name (lowercase, hyphenated, punctuation stripped), is unique and permanent, and must match the name; two dishes that share a name are disambiguated by suffixing the id.
- `category`: Gravy dish, Dry dish, Complete meal, Rice, Chapati, Paratha, Bread, Chilla, Accompaniment, Dessert, Keto, Fruit.
- `time`: Breakfast or Lunch.
- `tags` (a list, possibly empty):
  - `HP`: high-protein (paneer, chicken, egg, fish, prawn, soya).
  - `complete_meal`: standalone dish, no sides needed.
  - `complete_carb`: substantial carb needing only an accompaniment.
  - `fruit`: marks a Fruit-of-the-day candidate (§9).
  - `cuisine_neutral`: marks a plain protein with no cuisine character (grilled chicken breast, boiled eggs) that pairs with any register, and the register-neutral steamed rice. An eligible companion on a non-Indian plate regardless of the star's cuisine (§5.1).
- `primaryIngredient`: dominant fresh or packaged ingredient. Drives the §5.1 cross-meal ingredient demotion and, through the protein-family table, the §5.1 cross-meal family rule and §7's family governor. A free categorization label, not required to match a catalog ingredient name. Use `Mixed Veg` when no single vegetable dominates.
- `active`: Yes/No. Eligibility filter per §1.
- `satiety`: High, Medium, or Low. Used by §11.
- `prepMinutes`: estimated active prep time in minutes. Used by the §5.1 whole-day prep ceiling and the §11 tiebreaker.
- `seasons`: a season list, or `All` for year-round.
- `cuisine`: a single cuisine, the human-readable name (Indian, Italian, Chinese, Mexican, Greek, Spanish, Korean, Japanese, Continental, Vietnamese, Lebanese, Mediterranean, Thai). A display, filter, and **composition** field. §5 reads it for meal-level cuisine coherence: an Indian plate composes only `cuisine === "Indian"` dishes, and a non-Indian plate matches its companions same-cuisine or `cuisine_neutral`. §1 eligibility and §4 selection do not read it. It is the single source of truth for the Explore cuisine filter, the Explore card's cuisine display, and the dish-photo prompt's cuisine slot (engineering.md §4). Dishes with no international cuisine are `Indian`, and `cuisine !== "Indian"` is the non-Indian test. Required on every dish.
- `carbAffinity` (optional): `Rice` or `Roti`, the canonical lunch carb of a star dish (§5.1). `Rice` sends the carb position to the plain Category=Rice pool; `Roti` to Category=Chapati; absent leaves the default (Chapati). Set it only where the pairing is canonical (kadhi, chhole, sambar, rasam, and every non-Indian curry-type Gravy star take `Rice`; a non-Indian Rice-affinity star draws a `cuisine_neutral` steamed rice). Read only at the carb position; §1 eligibility and §4 selection never read it. `Roti` and absent resolve to the same pool, so most dishes leave it unset.

Enrichment fields, all optional (absent on a dish parses unchanged; the UI degrades gracefully when missing):

- `complexity`: cooking complexity, one of `Easy`, `Medium`, `Hard`. The data stores only the enum; the plain-language labels ("Easy to cook", "Cook will need some help", "Takes time and effort") live in the UI, not here.
- `skill`: free-text note on the skill a dish demands ("Comfortable, browning matters").
- `equipment`: free-text note on special equipment ("Heavy kadhai").
- `buySpecially`: free-text note on an ingredient that must be bought specially.
- `prePrep`: free-text day-before prep; present only when day-before work exists.
- `photo`: filename of the dish photo under `data/dish-photos/`.

**Per-dish file body conventions** (parsed into the dish, both optional):

- The first body paragraph, the prose before `## Ingredients`, is the one-line `description`.
- A `## Recipe` section after the `## Ingredients` table holds numbered steps (`1.`, `2.`, ...); each step parses into one `recipe` entry.

**Per-dish file `## Ingredients` table:** `Ingredient`, `Quantity`, `Unit`. Every `Ingredient` value must resolve to a catalog row by exact name (a blocking validator); a dish may have zero ingredient rows.

**Ingredient catalog (`data/ingredients.md`) columns:**

- `Ingredient`: canonical name, one row per ingredient (the union of all names used across dish ingredient rows).
- `Group`: the user-facing grocery-list bucket, in fixed order Proteins and Dairy, Fruit, Vegetables, Aromatics and Herbs, Pantry. Pantry renders last and is the fallback bucket; there is no catch-all section.
- `Unit`: the canonical measure (g/ml/pcs) observed for that ingredient.
- `Pack Size`: grocery metadata. Present marks an ingredient sold in packs, so the grocery list can show a pack count beside the summed quantity; blank marks a staple bought by weight. It is not a selection input.
- `Grams per piece`: for `pcs`-unit ingredients only (an egg is about 50 g), so §12 nutrition can convert pieces to grams; blank on every other row.
- `Protein /100g`: protein grams per 100 g, the §12 protein input; blank reads as zero.
- `Carbs /100g`: carbohydrate grams per 100 g, the §12 carbs input; blank reads as zero.
- `Fat /100g`: fat grams per 100 g, the §12 calorie (Atwater) input; blank reads as zero.
- `Fiber /100g`: fibre grams per 100 g, the §12 fibre input (a Healthy threshold); blank reads as zero.
- `Special`: `Yes` for an ingredient that needs special sourcing (not stocked by a regular Bangalore sabziwala/kirana, so a supermarket or specialty-store run); blank means regular sourcing, the common case. Feeds the special-sourcing report (§12.1) and the machine-readable sourcing surface future ordering automation needs (product.md §8).

## 16. Spec-code parity and the verification gate

`docs/engine.md` is the source of truth for what the engine does; `engine/src/` is the source of truth for how it does it. Both stay in lockstep.

### 16.1 The backend contract

The record and the ledger are derivable from persisted data alone:

- `currentWeek` carries an optional `generatedPlan` field: the (day, meal, dishId) list the engine placed when the row was written. Rows written before the cutover week have none and read as record-only weeks.
- Generation reads every `currentWeek` row with `weekStart` before the generating week as the record (§2.1), the favorites table, and the season, and writes the week plus its `generatedPlan`. It takes no rng and no requested-dish argument from production.
- The Explore feed's never-eaten set and the picker's recency tier read the record (§2.1).
- The cutover week is derived, never configured (§3.1).

### 16.2 Section-to-module pairing

Each numbered section above corresponds to a module under `engine/src/` plus a paired test under `engine/test/`:

| Section                            | Module                                     | Test                                                                |
| ---------------------------------- | ------------------------------------------ | ------------------------------------------------------------------- |
| §1 data and eligibility            | `eligibility.ts`, `data/parse.ts`          | `test/eligibility.test.ts`, `test/data/dishFiles.roundtrip.test.ts` |
| §2 the record                      | `v6/record.ts`                             | `test/v6/record.test.ts`                                            |
| §3 rate-deficit scheduling         | `v6/ledger.ts`                             | `test/v6/ledger.test.ts`                                            |
| §4 pools and selection             | `v6/pools.ts`                              | `test/v6/pools.test.ts`                                             |
| §5 the week and the plate          | `v6/compose.ts`                            | `test/v6/compose.test.ts`                                           |
| §6 generation                      | `v6/generateWeekV6.ts`, `v6/place.ts`      | `test/v6/generateWeekV6.test.ts`, `test/v6/place.test.ts`           |
| §7 exploration and Explore ranking | `v6/exploration.ts`                        | `test/v6/exploration.test.ts`                                       |
| §8 favorites and requested dishes  | `v6/favoritesPin.ts`                       | `test/v6/favoritesPin.test.ts`                                      |
| §9 fruit of the day                | `v6/pools.ts` (fruit scope), `v6/place.ts` | `test/v6/pools.test.ts`                                             |
| §10 skipped days                   | `groceryList.ts`, `historyRows.ts`         | `test/groceryList.test.ts`, `test/historyRows.test.ts`              |
| §11 item cap                       | `cap.ts`                                   | `test/cap.test.ts`                                                  |
| §12 nutrition and reports          | `nutrition.ts`, `data/validators.ts`       | `test/nutrition.test.ts`, `test/data/reports.test.ts`               |
| §13 picker ranking                 | `pickerRanking.ts`                         | `test/pickerRanking.test.ts`                                        |
| §14 determinism                    | `v6/generateWeekV6.ts`                     | `test/v6/generateWeekV6.test.ts`                                    |
| §15 field reference                | `data/schemas.ts`, `data/validators.ts`    | `test/data/schemas.test.ts`, `test/data/validators.test.ts`         |
| §16 the gate                       | `engine/scripts/gate.ts`                   | `test/v6/gate.test.ts`                                              |

The pairing is held by review at the PR level: a pull request that modifies `docs/engine.md` also modifies at least one file under `engine/src/` and at least one under `engine/test/`, and the reviewer names the missing pair when it does not.

### 16.3 The verification gate

A rule correct in isolation can be wrong in interaction, and only a long self-feeding simulation shows it, so the gate is part of the spec. `engine/scripts/gate.ts` runs it against the built engine (`npm run gate`) and writes its report; `engine/test/v6/gate.test.ts` is the CI-sized subset that holds the line after merge (the self-feeding run, asserting thresholds 1, 2, 4, 5, and 10, under a minute).

**Method.** The harness runs the engine self-feeding (each generated week is treated as eaten, unedited, and fed into the record that feeds the next) for 60 weeks from the current record. All thresholds are measured on weeks 20 to 60, the steady state, not the warm-up. Three runs:

1. **Frozen:** rates fixed at the cutover record for the whole horizon. Measures the engine's own bias; a family that fails here needs an engine fix.
2. **Self-feeding:** the production path. Measures drift; a family that passes frozen and fails here is the self-feed ratchet, not bias.
3. **Corrected:** the self-feeding run with the record's own swap-away list replayed against the generated weeks (every dish the household swapped out in the served weeks is swapped out of any generated week that proposes it), so §3's reconciliation branch executes at least once.

Variants run alongside for measurement only: the cold-start cap at 0.5 and a pool-level cap beside the structural-only seed; the §7 family governor off; and the alternative rate formula (`eatenCount / occasionsSinceFirstEaten`).

**Thresholds.** Every rate is compared per occasion served against per occasion eaten.

1. **Distribution fidelity, the headline gate:** for each tracked family (chicken, paneer, egg, fish, prawn, mutton, dal-family, international, plain roti, specialty roti, salad, raita/curd), the served rate is within 25 percent of its record rate on the self-feeding run.
2. **Lunch-main uniqueness:** at least 65 percent of lunch mains distinct over any rolling 8 weeks (household baseline 77 percent).
3. **Overlap band:** week-over-week dish-set Jaccard (the size of the intersection of two consecutive weeks' dish sets divided by the size of their union) averaged over the horizon, within 0.05 of the household baseline re-measured by the harness's own method on the record weeks.
4. **Slot anti-lock:** no dish holds the same weekday-meal slot in more than half the weeks of the horizon, favorites included, exempting only the two §5 anchors and any dish whose rate arithmetically forces majority occupancy (a rate above half its role's weekly slots); and no category (international, specialty roti, chutney type) is day-locked in more than half the weeks, Saturday's own scope excepted.
5. **Saturday:** no treat main repeats within any rolling min(8, Saturday pool size) Saturdays; dessert on 100 percent of Saturdays.
6. **Fruit:** at least 4 distinct fruits per week and no fruit more than twice in a week, both measured only when the eligible in-season set holds 4 or more fruits; no consecutive-day repeat except under a thin pool.
7. **Coverage:** every dish with `eatenCount >= 2` at simulation start is served at least once in any rolling 20-week window in which it is eligible.
8. **International persistence:** 0.75 to 1.75 weekday international lunch stars per week averaged over every 10-week window, and never a 10-week window at 0.
9. **Breakfast and forms:** at least 10 distinct breakfast mains across any 25-week window; standalone boiled-egg breakfasts present; dal-led lunches present.
10. **Plate size and effort:** 4-item lunches under 10 percent of lunch days; 5-item lunches zero; days over the 120-minute prep ceiling reported; zero days over 150.
11. **Presence rates:** breakfast small-item presence, weekday companion presence, and Saturday accompaniment presence each within 25 percent of the record's presence rate (this is what arms the §4 reopening trigger).
12. **Drift bound:** each tracked family's rate over weeks 40 to 60 within 10 percent of its rate over weeks 20 to 40 on the self-feeding run.
13. **Reported, not gated:** novelty placements per week; weekday lunches with no animal protein; Saturday plate shape; fills from an exhausted pool per role per week; picks by protein family.

**Order of work.** A threshold that proves arithmetically unsatisfiable is corrected in this document first, and the correction names its measured reason.

### 16.4 Change order

When a rule changes, the order of operations is:

1. Edit this document.
2. Edit the corresponding `engine/src/` module.
3. Update or add tests.
4. Run `npm run gate` locally; fix anything that fails.
5. Open the PR.

The slow loop, when it proposes a rule change, follows the same order and bundles all four changes into one PR.
