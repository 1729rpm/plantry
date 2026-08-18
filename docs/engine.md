# Engine

The meal-planning rules. This document is the human-readable specification; `engine/src/` is its executable form. Both must change together; any pull request that edits this document without a paired change in `engine/src/` and `engine/test/` fails CI. See §13 for the parity rule in full.

## 1. Data and Eligibility

Sources:

- `data/dishes/<slug>.md`: dish library, one file per dish (YAML frontmatter for the dish fields, a `## Ingredients` table for its ingredient rows)
- `data/ingredients.md`: ingredient catalog, one row per canonical ingredient, carrying its grocery group, canonical unit, and pack size (present marks a tracked ingredient)
- `data/menu_history.md` (seed) and Convex `weekArchive` (runtime): record of past weeks

A dish is eligible for the current week if Active=Yes and its Seasons include the current Bangalore season.

Bangalore seasons: Summer (March to May), Monsoon (June to September), Winter (October to February). Seasons=All means year-round.

## 2. Weekly Schedule

| Day        | Breakfast | Lunch            |
| ---------- | --------- | ---------------- |
| Mon to Fri | breakfast | Menu 1 or Menu 2 |
| Sat        | (none)    | Menu 3 or Menu 4 |
| Sun        | (none)    | (none)           |

Menu 1 runs on Mon, Wed and Fri, Menu 2 on Tue and Thu. The numbering is load-bearing: the Saturday alternation and the archive's history strings depend on it.

**The schedule fixes which forms run on which day, not how many items they hold.** A slot plan carries no item count. Breakfast composes one main and attaches what that main calls for (§3), so it lands at one or two items depending on the dish. Lunch composes to the day's remaining budget (§3.1, §9). The size of a day is therefore a property of the dishes that landed, not a number written down in advance, which is the whole of §10.1: a menu is composed to a budget the household has, never composed large and trimmed back.

A scheduled day holds breakfast and lunch and nothing else. Every dish the engine places belongs to one of those two slots and spends the day's §9 budget; there is no third day-level section outside it.

Saturday alternates between Menu 3 and Menu 4. Read `menu_history.md` for the most recent Saturday and pick the other menu. If history is empty, pick at random.

Up to two weekday lunches per week may run the international form and at most one further weekday lunch may substitute Menu 3 or Menu 4 for its default Menu 1 or Menu 2. See §3.2 for the triggers.

## 3. Slot Composition

**One HP source per meal (all forms).** A single meal (a day's breakfast or a day's lunch) contains at most one HP-tagged dish. Each meal form below picks its protein main first; once an HP dish occupies the meal, the meal's remaining (non-main) positions exclude HP-tagged dishes. This is keyed on the `HP` tag, never on dish names, so it holds for any HP protein (chicken on chicken, paneer on paneer) and across every form: a "Chicken biryani" complete_meal never sits beside a "Chicken salad" HP accompaniment in one Saturday Menu 3. Thin-pool fallback: if excluding HP-tagged dishes would empty a non-main position pool, the unfiltered pool is used so the slot still fills (one HP-main meal with a second HP side beats an incomplete meal). This is rare given the broad companion pools and surfaces as composition signal for the slow loop, not a hard error.

**One wet dish per meal (all lunch forms), hard.** A lunch plate holds at most one Category=Gravy dish item. When the protein lead is itself a Gravy dish, the companion pool excludes Gravy dishes entirely; when a Gravy companion lands, any further companion position excludes Gravy. This is keyed on Category, never on dish names. Unlike the one-HP rule there is NO thin-pool fallback: a plate one companion short beats a two-gravy plate, so the rule never yields to fill a slot. Two wet dishes on one plate ("2 gravy dishes already") was the recurring over-serving the household kept deleting; this rule removes it at generation time.

**A carb is never eaten with a salad alone (all lunch forms), hard.** On any plate carrying a carb (Category in {Chapati, Rice}), at least one companion is a Category=Gravy dish or Dry dish, that is a dal, a curry or a sabzi. An Accompaniment (salad, raita, chutney) is only ever an ADDITIONAL item on such a plate, never its sole companion, so the first companion position of a carb plate draws from the Gravy/Dry pool only and a later position draws from the whole companion pool. Where the budget allows one companion, the Accompaniment pool is therefore excluded from it. Like the one-wet rule this has no thin-pool fallback: a plate one companion short beats a roti with nothing to eat it with. Verified against the record: 0 of 16 observed carb lunches lacked a gravy or a sabzi, while the pre-rule engine produced 27 of 81, every one of them a Keto lead with a roti and a salad.

**Precedence between the plate rules.** The hard rules (one HP per meal, one wet per plate, the carb rule above, the protein floor) constrain the POOL a position may draw from, and every ranking, including the §4.8 exploration slot's, then chooses inside that pool. So a plate rule can never be bypassed by a ranking, and no plate rule may consume the exploration slot: a pairing rule (`pairsWith`, §12) proposes a companion but never overrides the one-wet rule, never takes the week's novelty position, and never places a dish the within-week no-repeat rule (§4 step 5) excludes.

**Lunch protein floor (all lunch forms).** Every generated lunch carries protein. After a lunch plate is composed, if no picked item is HP-tagged or Category=Keto, one protein companion is appended (role `protein-floor`, protected): an eligible HP-or-Keto Lunch dish, cuisine-coherent (Indian or `cuisine_neutral` on an Indian plate; same-cuisine-or-`cuisine_neutral` on an international plate), and never a second Category=Gravy dish when the plate already holds one. The floor counts inside the lunch budget (below) but still appends when the plate is out of minutes (protein beats budget, §9), never past four items or the §9 item backstop. Menu 1/2/3 satisfy it by construction (their lead is HP or Keto); it fires on the carb-only fallback, a Menu 4 with an empty Keto pool, and a self-sufficient non-HP international anchor (a `complete_meal` such as Veg hakka noodles then lands with one protein companion, mirroring Menu 4's Keto position). On a plate carrying a carb the floor prefers a Gravy or Dry dish, so it cannot itself create a carb plate with no substantial companion. An empty floor pool leaves the plate protein-less and writes a `warn` incident (a real gap, not steady-state noise).

**Self-sufficient mains (all forms).** A self-sufficient main (tagged `complete_meal`, or Category=Complete meal) fills its slot alone: no separate carb, no accompaniment (the lunch protein floor above still applies to a non-HP one). The signal is the union of the tag and the category, because a dish can be Category=Complete meal without the `complete_meal` tag (White sauce pasta), and the tag alone would miss it. At breakfast the same signal runs through the attachment rules below: a Category=Bread `complete_carb` and a `complete_meal` are served alone, while a Chilla or Paratha main keeps its chutney. A non-complete-meal gravy that is itself filling (e.g. kadhi) is not structurally distinguishable from a gravy that wants a companion, so it carries no suppression and is left to in-week manual swap.

### Breakfast

Breakfast is savoury only.

**One form, every day.** Every breakfast slot Mon to Fri composes the same way: rank one main pool, place the winner, then attach what the WINNER calls for. There is no day-shaped option to choose between, and the item count (one or two) falls out of the dish rather than being fixed in advance.

**The main pool.** A Time=Breakfast dish that is either tagged `complete_meal` or `complete_carb`, or is Category=Dry dish. The Dry-dish arm is what makes anda bhurji, paneer bhurji, egg podimas and vegetable omelette reachable: the two forms this replaced (a Mon/Wed/Fri pair that only fell through to its dry-main option when the other option's pools were EMPTY, and a Tue/Thu single pick whose pool excluded Dry dishes outright) stranded every one of them on every day of the week. Whether a stranded dish then gets SERVED is §4's business, not §3's; a never-cooked main still has to climb the frequency ranking like any other candidate.

**Attachments, keyed on the main.**

- A Category=Dry dish main draws 1 plain breakfast carb (Time=Breakfast, Category in {Bread, Paratha, Chilla}, without `complete_carb`): anda bhurji with toast, paneer bhurji with plain paratha. An empty carb pool serves the main alone.
- A Chilla or Paratha main draws 1 breakfast chutney (Category=Accompaniment, Time=Breakfast), so a cheela or a paratha is never served without it. An empty chutney pool omits it.
- Anything else is self-sufficient and served alone: a Category=Bread `complete_carb` (avocado toast, masala toast) and a `complete_meal` (poha, upma).

The chutney is a property of the main dish, not of the slot, which is why it is expressed this way rather than as a fixed second position.

**Breakfast protein floor.** When the composed breakfast holds no `HP` dish AND its main carries no chutney, the slot adds one HP Category=Keto companion (boiled eggs), making a 2-item breakfast. It fires only at HP count zero, so it never conflicts with one-HP-per-meal, and an empty companion pool falls back to the 1-item breakfast. The chutney exception matters: a main with both a chutney and an HP Keto side is the 3-item breakfast that drove most of the retired cap's over-cap days.

The fruit-bearing Option A is retired, so every breakfast form is savoury.

### Lunch

**Menu 1 (Mon, Wed, Fri) and Menu 2 (Tue, Thu), the Indian weekday plate.** Both keep their menu numbers (Saturday alternation and archive history strings depend on the numbering) but compose one shared form, differing only in the protein lead:

- 1 protein lead: Menu 1 an HP-tagged dish (Category=Gravy dish or Dry dish), Menu 2 a Category=Keto dish. Indian cuisine only.
- 1 carb, picked by the lead's carb affinity (§3.1).
- companions filling the remaining budget (`lunchBudget - 2` positions, so one or two; see §3.1): the non-HP Indian companion pool, Category in {Gravy dish, Dry dish, Accompaniment}, ranked by §4, under the one-wet-dish rule and the carb rule above. Each position is filled against the day's remaining minutes, so a companion that would take the day past its budget is skipped for the next candidate that fits.

The plate composes to the day budget (§3.1, §9) rather than composing four items and trimming: a light breakfast or a quick plate leaves room for a second companion, a heavy one does not. **Cuisine is meal-level: the plate composes Indian-cuisine dishes only** (`cuisine === "Indian"`, keyed on the field, never on names), so it never lands a lone non-Indian companion in an otherwise-Indian plate; non-Indian dishes reach the menu through the international form (Menu intl, §3.2). The protein lead is the meal's only HP position; the companion pool is non-HP, so one-HP-per-meal holds. The one-wet rule above governs the gravy count: an HP Gravy lead admits no gravy companion (the dal is excluded), while a Dry-dish or Keto lead admits at most one gravy companion. The carb rule then governs what the first companion may be: with a roti or rice on the plate it is a gravy or a sabzi, never a salad. A slot with no eligible protein lead falls back to a carb plus the protein floor so it still fills. Complete_meal lunches are exempt (a self-sufficient main fills its slot alone; see Self-sufficient mains above), so they reach the Menu 3 / Menu 4 forms rather than this plate.

**Menu intl (substituted weekday lunch), the coherent non-Indian form:**

- 1 non-Indian anchor main (`cuisine !== "Indian"`, Category in {Gravy dish, Dry dish, Keto, Complete meal})
- at most 1 companion, same-cuisine-or-`cuisine_neutral`
- no Indian carb, except a register-neutral steamed-rice carb for a rice-affinity anchor (§3.1)

Up to two weekday lunches per week run this form instead of the Indian thali (the §3.2 international substitution selects which days and which anchors). The form keeps a meal in one cuisine register: a companion is eligible only when it shares the anchor's cuisine OR carries the `cuisine_neutral` tag (a plain protein that pairs with any register, e.g. grilled chicken breast, boiled eggs). The companion depends on the anchor:

- A **self-sufficient** anchor (`complete_meal` tag or Category=Complete meal, e.g. a fried rice or pasta) fills the slot alone (the self-sufficient-main rule above); the cuisine's carb is built into the dish.
- A **protein** anchor (HP or Category=Keto) takes at most one same-cuisine-or-neutral NON-HP veg side. The anchor is the meal's one HP source, so the side pool excludes HP-tagged dishes (one HP per meal).
- A **veg-forward** anchor (not HP, not Keto, not a complete_meal, e.g. Continental baked vegetables) takes one same-cuisine-or-neutral HP/Keto protein companion, so a veg-forward dish is never served without a protein.

The form takes no Indian Chapati/Rice carb, with one exception: an anchor with `carbAffinity: Rice` (a Thai, Korean, or Chinese curry) takes a register-neutral steamed-rice carb, a Category=Rice dish carrying the `cuisine_neutral` tag, subject to the same rice-spacing rule as the Indian plate (§3.1); `Roti` affinity never applies on an international plate. When the steamed rice lands, the carb rule applies to the one side as it does on the Indian plate: the side is then a gravy or a dry veg, not a salad. Thin pools degrade gracefully: a missing companion leaves the anchor as a valid 1-item international meal (the protein floor still guarantees it carries protein).

**Menu 3 (Saturday), 3 items:**

- 1 dish with both `complete_meal` and HP tags
- 1 Accompaniment (non-HP; the lead is always HP, so one-HP-per-meal excludes HP accompaniments, with the thin-pool fallback)
- 1 Dessert

**Menu 4 (Saturday), 3 items:**

- 1 dish with `complete_meal` tag and no HP tag
- 1 Keto dish
- 1 Accompaniment

The lead is non-HP, so the meal's one HP source (if any) is whichever of the Keto dish or the Accompaniment lands one first; once it does, the later position excludes HP-tagged dishes (with the thin-pool fallback). Breakfast forms apply the same rule: an HP breakfast main excludes an HP partner (an HP accompaniment partner is dropped under Option B).

### 3.1 Lunch budget and carb rule

**Budget-aware composition.** Breakfast composes first. The lunch then composes to what is left of the day, in items and in minutes, instead of composing to a fixed size and trimming after.

The item half:

```
lunchBudget = clamp(DAY_MAX_ITEMS - breakfastItemCount, 2, LUNCH_MAX_ITEMS)
```

with `DAY_MAX_ITEMS = 6` (§9) and `LUNCH_MAX_ITEMS = 4`. `breakfastItemCount` is the count of breakfast items actually placed on that day, so a 2-item breakfast leaves a 4-item lunch and a 3-item one leaves 3. `LUNCH_MAX_ITEMS` is a shape rule, not a capacity rule: a protein lead, a carb and two companions is the largest plate the household has eaten, so the plate never grows past it however much of the day is unspent. The Menu 1/2 plate spends the budget as protein lead + carb + companions, so the companion count is `lunchBudget - 2`. Saturday has no breakfast, so its Menu 3/4 form composes against the whole day.

The minute half is checked per candidate rather than per position, because it depends on WHICH dishes land, not how many: at each position the plate takes the first candidate in ranked order that keeps the day inside `DAY_PREP_BUDGET_MINUTES` (§9). At the household's observed prep times this is usually the limit that binds, which is why the item backstop sits a notch above the observed envelope.

**Nothing is dropped.** A candidate that would breach either limit is skipped for the next that fits; when no candidate fits, the position lands empty and the week reports a `budget-short` incident naming it. A plate one companion short beats a plate that costs more time than the household has, the same principle as the one-wet rule. There is no post-hoc trim anywhere in the pipeline.

**Carb affinity.** The carb is picked by the protein lead's optional `carbAffinity` field (§12):

- `carbAffinity: Rice` picks from the plain Category=Rice pool (kadhi, chhole, Thai and other non-Indian curries).
- `carbAffinity: Roti` picks from the plain Category=Chapati pool.
- Absent picks from Category=Chapati, the default, so most leads leave the field unset. (`Roti` therefore resolves to the same pool as absent today; it records the canonical pairing.)

**Rice spacing (hard).** A Category=Rice carb never lands on two consecutive generated days. When a lead's affinity asks for Rice but the previous generated day's lunch carried rice, the carb falls back to Chapati (or, on the international form, is omitted). This replaces the earlier "Rice at most once per week" count: with carb affinity driving rice, a fixed weekly count would fight the affinity, and the household's stated rule ("don't have rice on continuous days") is spacing, not a count. The recency rule (§4) still does not apply to lunch carbs.

### 3.2 Weekday lunch substitution

Some weekday lunches swap their default Indian thali (Menu 1/2) for another form. Two kinds of substitution share this machinery and are planned together so a day is never substituted twice.

**International substitution (up to two weekday lunches).** Cuisine coherence is a meal-level concern, so the week's non-Indian lunches are placed here, as whole coherent meals, rather than nudged in per position. Selection:

- **Anchor pool:** Active, in-season, non-Indian (`cuisine !== "Indian"`) Lunch dishes in an anchor category (Gravy dish, Dry dish, Keto, Complete meal).
- **Ranking:** rank the anchor pool longest-unused (§4.1) and take up to two anchors, **preferring two distinct cuisines** (don't make both international meals the same cuisine when an alternative exists).
- **Placement:** assign each chosen anchor to the earliest weekday lunch whose would-be Indian protein main is not strictly longer-unused than the anchor (a recency comparison mirroring trigger (b) below, with ties favouring the international form, since meal-level cuisine coherence is the goal). Each anchor takes a distinct day. The day then runs the Menu intl form (§3 above), anchored on that dish.

An empty or only-recently-cooked anchor pool yields fewer than two (or zero) international lunches; the other weekday lunches stay the Indian thali.

**Complete_meal substitution (at most one weekday lunch).** One further weekday lunch may swap its default menu for Menu 3 or Menu 4:

- Menu 3 form (complete_meal+HP + Accompaniment + Dessert) when the lead complete_meal is HP-tagged.
- Menu 4 form (complete_meal + Keto + Accompaniment) when the lead complete_meal is non-HP.

Triggered when either:

- a. The user requests a specific complete_meal Lunch dish for the week, or
- b. The longest-unused eligible complete_meal Lunch dish (per §4.1) is older than the longest-unused candidate that would otherwise fill the day's Indian protein slot (HP for Menu 1, Keto for Menu 2).

The supporting items (Accompaniment, Dessert) are then picked per §4 from their composition-defined candidate sets.

**Coexistence.** The international substitution claims its days and its anchor dishes first; the complete_meal substitution then runs on a remaining day and never re-pins an international anchor. So a day is never double-substituted, and the two-vs-one counts never collide. Saturday's own Menu 3/4 alternation (§2) is independent of all weekday substitution.

### 3.3 (no section)

There is no Fruit of the day. A day holds breakfast and lunch, nothing else, and every Category=Fruit dish in the library is inactive (§1), so no fruit is eligible for any pool. The household did not follow the fruit, so the section is gone rather than tuned.

The number is held rather than reused so the §3.x and §4.x cross-references in the rest of this document, in `engine/src/`, and in the other canonical docs keep pointing at what they always pointed at.

Two legacy shapes remain in the stored data and every reader tolerates them without ever writing another:

- **`meal:"Fruit"` history rows** in `weekArchive` and `menu_history.md`. They are read as ordinary recency rows (§4): each carries a real dish id and weekStart and contributes recency for a dish that is now inactive and so never eligible. The archive is the household's eaten record and the only training signal §4 has, so it is never rewritten to remove them.
- **`meal:"fruit"` slot rows and `manualChanges` entries** in the live Convex data. Nothing generates them; readers skip them (they render no section and contribute no grocery rows), and the Convex schema keeps the literals because Convex validates every stored document against the schema on deploy.

## 4. Selection Priority

After §3 composition has produced the candidate set for a slot, the slot's pool is filtered by the repeat guard (§4.7) and then ranked in this order. Each ranking step is a stable reordering of the whole pool, so a step applied later dominates the ones before it and the ones before it survive as its tiebreaks. Steps 1 to 3, 5, and 6 rank candidates within a pool; step 4 is different in kind, a placement guarantee applied before ranking rather than a per-pool tiebreak.

Read as precedence, strongest first, that is: step 6, then 5, then 2, then 1, with step 3 as a residual tiebreak beneath step 1. The engine chooses for what the household actually cooks (step 1) and the steps above it spread that choice so no one answer holds a position.

1. **Saturating frequency, then longest unused.** The primary sort is a dish's **frequency credit**, highest first: `min(eatenCount, 3)` counted over the **10 most recent week-records** present in the history (the seed file plus the archive, skip-aware), not over 10 calendar weeks, so a gap in the record does not shrink the window. Proven dishes lead, because the household eats a concentrated repertoire of roughly 40 dishes out of 250 active and ranking by what they have avoided longest is an anti-preference chooser. The **cap is what stops that becoming an incumbency lock**: an uncapped count grows every week its holder wins, so nothing can dislodge it and each position converges to a fixed cycle whose period is its pool size. Capped, the whole proven repertoire ties on the top rung. A dish the household stops keeping decays out of the window on its own. Ties on credit break by **longest unused** (last-cooked date in `menu_history.md`, oldest first; never-cooked counts as longest unused), which is where rotation actually happens: with the repertoire tied at the cap, longest-unused decides which of them leads this week.
   Nothing but the eaten count feeds the credit. A dish's provenance is recorded on the archive row but is not a §4 input: an explored dish, a hand-placed dish and a generated dish that were each eaten once all rank at credit 1. A dish introduced by the exploration slot (§4.8) therefore has no head start, and its route back onto a plate is §4.7 opening a slot for it or a human signal (a favorite, the wishlist, a swap).
2. **Same-day key ingredient deprioritisation.** If breakfast's Primary Ingredient on the same day matches a candidate's Primary Ingredient, deprioritise the candidate. If no viable alternative exists, allow the repeat.
3. **Ingredient consolidation (§10).** Prefer candidates that consume leftover from earlier picks in the week. It sits BELOW frequency, as a tiebreak among dishes the household cooks equally often: it is a deterministic function of the week's earlier picks, so ranking it above frequency would make it the rotation driver in longest-unused's place.
4. **Favorites (guaranteed placement).** Unlike the other items, favorites are not a per-pool ranking tiebreak; they are a placement guarantee applied before ranking. Every library dish on the household's standing favorites list (the `favorites` table, curated in the app) is pinned into exactly one slot of every generated week, spread across distinct days, using the same pinning mechanism as a §6 request: the favorite leads its slot's ranked pool, overriding recency for that one position. Placement respects the dish's meal, a breakfast favorite lands in one day's breakfast and a lunch favorite in one day's lunch plate, because a wrong-meal dish never appears in a slot's composition pools. Favorites are placed oldest-added first (the generation run passes the favorites ordered by `createdAt` ascending). When the full set cannot all be placed without breaking a hard §3 composition lock (one wet per plate, the daily protein floor, budget-fit) or the week runs out of accepting slots, the oldest win and the remainder is returned as `unplacedFavorites` for the caller to log as one incident per week. **That remainder is computed against the finished week, not against the pinning plan:** a favorite the pinning pass skipped can still land, because composition places dishes the pass never touched (boiled eggs is both a favorite and what the breakfast protein-floor attach rule reaches for), and reporting the plan instead of the outcome makes the incident fire on dishes that are on the plate. The pass never breaks a composition lock to force a favorite in. **A pinned favorite is subject to within-week no-repeat:** the pin buys one slot and nothing more, so the pin can never combine with a plate rule to place the dish twice. There is no per-favorite frequency dial; one favorite is one placement. Free-text custom favorites are display-only and are not a generation input (the engine has no dish to place for a name not in the library). An absent or empty favorites set makes the pass a no-op, so a run with no favorites is byte-identical to one without it. The `preferred` frontmatter field is not a §4 input; it stays parsed (§12) but does not affect selection.
5. **Within-week recency.** A dish already placed in an earlier slot of the week being generated is treated as most-recently-used for every subsequent slot's ranking, so it sinks below any fresh (not-yet-placed-this-week) alternative. This is a dominant ordering: unlike step 1's `menu_history.md` recency, it is applied near-last, so consolidation (step 3) cannot re-promote an already-placed dish above an equally eligible fresh one. It exists because the cross-week history (step 1) is silent on the in-progress week, so without it a single broad pool's top-ranked dish wins every Menu 1 slot Mon/Wed/Fri identically. When every candidate has already been placed this week, demoting them all is the same as demoting none, so the pool is returned unchanged and the repeat is allowed (the fresh-alternative fallback, mirroring step 2). A pinned favorite (step 4) leads its own slot regardless of recency, but recency still governs every other slot and a pinned favorite is excluded from every pool it is not pinned to, so a favorite never wins two slots in one week.
6. **Within-week protein diversity (HP mains only).** This is the protein-level analogue of step 5, scoped to HP mains. An HP main is an `HP`-tagged dish in a meal's protein-main slot: Category in {Gravy dish, Dry dish, Complete meal, Keto}. (HP accompaniments are sides, not mains, so they neither consume nor are governed by this step; the one-HP-per-meal rule in §3 already keeps them off an HP-main meal.) When ranking an HP-main pool, a candidate whose **protein family** (see §4.6) already appeared as an HP main earlier in the week is deprioritised below the fresh-protein candidates, so a fresh protein ranks up and the week's HP mains spread across proteins (fish, prawn, mutton, egg get a fair shot) rather than repeating chicken or paneer. Frequency ranking without this step is a chicken monoculture: measured over 25 simulated weeks, chicken-family items ran 4.32 per week against 1.83 observed while prawn and mutton appeared zero times in 150 days. This is a soft preference, not a hard constraint: if every candidate's protein family already appeared (no fresh-protein alternative), the pool is returned unchanged so the slot still fills (the fresh-alternative fallback, mirroring steps 2 and 5). It never narrows §3 composition eligibility and never overrides the recency exemptions (below). It applies only to HP-main position pools; companion (non-main) pools are never reordered by protein.

Cuisine is no longer a §4 ranking step. It was a per-position within-week nudge (the former step 5); cuisine coherence is now a §3 meal-level composition concern (the Indian thali composes Indian dishes, and the international form, §3/§3.2, places coherent non-Indian lunches), so the per-position nudge is removed. §4 selection no longer reads `cuisine`.

Recency exemptions (apply to §4.7, to step 1's longest-unused tiebreak, and to step 5): **lunch carbs only** (Category in {Chapati, Rice}). Roti repeating across every lunch is intended, not a defect. Nothing else is exempt, and the list stays this narrow deliberately: a role exempt from every recency mechanism has nothing at all opposing its frequency count, so its leader is mathematically unassailable and the role becomes an absorbing state. A daily staple is the intended outcome for roti and for nothing else. Step 6 (protein diversity) has its own fresh-alternative fallback instead of an exemption list: it acts only on HP mains, none of which are exempt categories, so the exemption list does not interact with it.

### 4.6 Protein-family normalization

Step 6 compares dishes by protein family, not by raw `primaryIngredient`, so cuts of the same protein count as one protein for diversity. The mapping collapses these families and passes every other ingredient through unchanged (each is its own family):

| `primaryIngredient` | Protein family |
| ------------------- | -------------- |
| Chicken             | Chicken        |
| Chicken Breast      | Chicken        |
| Chicken Keema       | Chicken        |
| Soyabean Chunk      | Soyabean Chunk |
| Soya Chunk          | Soyabean Chunk |
| Soyabean            | Soyabean Chunk |
| Soya                | Soyabean Chunk |

Any value not in the table (Paneer, Egg, Fish, Prawn, Mutton, Tofu, Chickpea, and any non-protein primary such as Couscous or Rice) maps to itself. The normalization is keyed on the ingredient label, never on dish names, so it holds for any dish carrying that primary.

### 4.7 Repeat guard

A filter, not a reordering, and the only step in §4 that removes a candidate rather than moving it. A candidate cooked within the last **7 days** of the slot's own calendar date is excluded from that slot's pool.

It exists because under frequency ranking a demotion is not enough: the leader would simply win again the next day. A dish blocked on one weekday clears the guard the following day, so the guard delays rather than suppresses, and the delay is what lets a starved dish take a slot, accumulate a count of its own, and climb toward the cap. Without it, saturating the count is not sufficient on its own: the proven dishes tie with each other while the challengers sit at zero with no way up, and the carousel survives.

Exempt: lunch carbs only, per the exemption list above. If the guard would leave a pool empty it relaxes for that pool, so the slot still fills; a thin pool is a composition problem, not a reason to ship a hole in the plate (the same principle as the one-gravy rule). The guard needs the slot's calendar date, so a caller that ranks without a slot context (the §5 picker, which ranks alternatives for a user rather than composing a week) leaves it off.

### 4.8 The exploration slot

One position of each generated week is ranked for novelty instead of by §4: **pure longest unused with never-cooked first**, ignoring both the frequency credit and §4.7. Applying frequency here would rank the proven repertoire first and there would be no discovery at all.

It **rotates across the week's companion positions** rather than sitting on a fixed weekday, advancing one position per calendar week. A fixed novelty position is still a fixed position: only that weekday's companion ever sees a new dish, and measured over 25 weeks, 19 of the 20 dishes it introduced were served exactly once and never returned. No plate rule may consume it.

Discovery is budgeted at one position a week. Retention is not: an explored dish carries no ranking advantage afterwards, so what brings it back is §4.7 opening a slot or a human signal (a favorite, the wishlist, a swap). The slot is discovery only.

## 5. Picker Ranking

§4 ranks generation candidate sets. The picker is the separate ranking the swap and add affordances use when a user opens "Replace with..." or "Add a dish". It answers a different question: given the broad, non-restrictive pool (every Active, in-season dish; `docs/product.md` §6 "a generic ranked picker over the active library", and Principle 4), which alternatives surface first?

Every slot is a breakfast or lunch slot and its pool is generic across meal-time: every Active, in-season dish, so a breakfast dish is reachable from a lunch slot and vice versa. Meal-time is no longer a hard pool filter; it is a swap-time ordering signal (below).

The picker does not narrow the pool (Principle 4: a swap may land on any Active, in-season dish, including a cross-meal one; the resulting §3 composition mismatch is signal for the slow loop, not an error the fast loop blocks). It only orders it. The order is a **head** followed by a **tail**, with slot-meal-matching dishes led to the front of the default view.

**Head ("fits this day").** Every pool dish not already placed on that day. Within the head, dishes are ordered by a deterministic lexicographic comparison on a tuple, lower first:

```
headOrder(dish) = (recencyTier, proteinBandDistanceForSwaps, id)
```

- **recencyTier** is a coarse longest-unused bucket, not a unique index. All never-cooked dishes share the single best (first) tier; cooked dishes are tiered by last-cooked weekStart, oldest weekStart = better tier, so dishes last cooked the same week share a tier. A dish's last-cooked date is the most recent matching history row. This is the dominant term: a longer-unused dish in a better tier always outranks a closer-protein-band dish in a worse tier. Unlike §4, the picker does not exempt lunch carbs from recency: a swap is a deliberate user choice, so every dish is ranked by recency uniformly. Because the tier is coarse, genuine ties exist (all never-cooked dishes tie; same-week dishes tie), which is what the next term resolves.
- **proteinBandDistanceForSwaps** applies to swaps only (a dish is being replaced). It is the protein-band distance between the candidate and the outgoing dish, where a protein band is the per-person derived protein (§11) divided into fixed 5 g buckets. Same band is distance zero. Because it sits second in the tuple, it only ever orders candidates that share a recencyTier; it can never move a dish across tiers, so it can never push a more-recently-cooked dish above a longer-unused one. The effect: among equally fresh options, the one in the same protein band as the dish being replaced surfaces first, then nearer bands before farther. For adds (no outgoing dish) this term is absent and the head is pure recency tier then id.
- **id** is dish id ascending, the final total tie-break.

**Tail.** Every other pool dish (the same-day repeats the head excluded), ordered by the same tuple comparison. The tail keeps the pool complete (nothing is dropped) while pushing dishes the day already has below fresh options.

**Slot-meal-first default ordering.** After the head/tail ranking, the swap picker stable-partitions the result so dishes whose own meal-time matches the slot lead and cross-meal dishes follow, each group keeping its ranked order. This is a swap-time ordering, not a pool filter: the full ranked pool is still offered (search and filter pills reach every dish), and only the default suggested order leads with slot-meal-matching dishes. The ranking engine itself is meal-time-blind; this partition is applied by the picker's caller.

**Determinism.** No RNG. Every tie resolves through the fixed tuple chain: recencyTier, then protein-band distance (swaps), then dish id ascending, and the slot-meal-first partition is stable. The same inputs always produce the same order, and input order does not affect output.

## 6. Requested Dishes

Generation accepts an optional list of requested dish ids. Each requested dish must be placed into the upcoming week, overriding recency. The mechanism is retained and tested but has no production feeder today (the retired next-week queue was its only caller); §4 step 4 favorites reuse the same slot-pinning it provides. This generalises the §3.2 trigger (a) into one mechanism: where §3.2 (a) pinned a complete_meal Lunch dish to drive a weekday substitution, a request can pin any dish into any slot whose composition accepts it.

- **Placement.** A requested dish is placed into a slot whose §3 composition accepts it, overriding §4 recency for that position. "Composition accepts it" means the dish appears in at least one position pool of that slot's §3 candidate set: it is an Active, in-season, meal-time-matching dish the slot could legitimately hold. Requests are resolved in their given order; each takes the first schedule slot (in schedule order) whose composition accepts it and that is not already reserved (by a §3.2 substitution) or claimed by an earlier request. Two requests therefore never collide on one slot.
- **Unplaceable requests.** A request that no slot's composition accepts (out of season, inactive, an unknown id, or no fitting free slot remains) produces an incident and is not placed. Generation never crashes and never forces a dish into an incompatible slot. The dish stays queued; the caller re-queues it the following week.
- **Minimal by design.** A request is a list of dish ids, not a generic directive language: no calendar awareness, no per-day pinning (a request cannot say "place this on Friday"). That can earn its way in later if it proves needed (Principle 1, Principle 8).

The mechanism is additive: with no requests, generation behaves exactly as §2 to §5 describe, so every existing caller is unchanged. A request that lands in a slot is subject to the same §9 day budget as any other pick, so a request whose position could not be filled inside the budget is reported as an incident. A requested dish is therefore always either placed exactly once or accounted for by an incident.

## 7. Explore Ranking

The Explore surface ranks the eligible (Active, in-season), never-cooked dishes "familiar but new": dishes the household has not had yet but that resemble what it actually cooks, so novelty still fits the household's habits rather than surfacing random unseen dishes. Like §5, this is a display ranking, not a generation input; it never narrows a pool or blocks a pick.

The pool is every Active, in-season dish with no row in the cooking history. Each pooled dish scores three affinity signals, each normalised to the range zero to one (one being the strongest affinity):

1. **Shared-primary-ingredient frequency.** How dominant the dish's Primary Ingredient is in cooking history: the share of cooked dishes whose Primary Ingredient matches, divided by the most-cooked Primary Ingredient's share, so the single most-cooked ingredient scores one. A paneer dish scores high in a paneer-heavy history.
2. **Protein-band proximity.** Closeness of the dish's per-person protein (§11) to the household's cooked-median protein, measured in fixed 5 g protein bands: one divided by (one plus the band distance), so a dish in the median band scores one and the score decays with distance. A dish in the household's usual protein range scores high.
3. **Category familiarity.** How common the dish's Category is in history, normalised the same way as signal 1 (most-cooked Category scores one).

**Combined score** is the equal-weight sum of the three signals. Dishes rank by combined score descending, ties broken by dish id ascending. No RNG: the same inputs always produce the same ranking, and input order does not affect output.

**Dominant-affinity key.** Each ranked dish also carries the single signal that contributed most to its score, as a structured key (`shared-ingredient`, `protein-match`, or `familiar-category`), not user-facing prose. The Explore UI phrases its "why it fits" line from this key (Principle 7: display is decoupled from structure; no internal label text leaks from the engine). Ties between equal signal values resolve by a fixed priority order (shared-ingredient, then protein-match, then familiar-category), so the key is deterministic too.

## 8. Skipped Days

A skipped day is a fast-loop override applied after generation. Generation itself is untouched: the day keeps its generated dishes in the data so a restore is lossless. What changes is what a skipped day contributes downstream:

- **Grocery list.** A skipped day's dishes contribute nothing to the buy list. The grocery aggregator (whose list shape `docs/product.md` §3 item 3 fixes) accepts an optional set of skipped days and excludes those days' dishes before summing. With no days skipped, the list is exactly as before.
- **History append.** On finalize, the week's dishes append to the historical record that drives the §4 recency rule. A skipped day's dishes were not cooked, so they must not append: recency must not see them. The history-row derivation accepts the same optional set of skipped days and emits zero rows for each.

Both are pure, additive functions: the skipped-day input defaults to none, so every existing caller is unchanged. The running app wires the override through the Convex `skippedDays` field, the skip-aware grocery query, the finalize archive exclusion, and the "Skipped" rendering on the Menu tab and the menu share image.

## 9. Day Budget

Every day is composed to a whole-day budget, and nothing is ever dropped.

- **Prep budget: 120 minutes** of summed `prepMinutes` across the day's breakfast and lunch items.
- **Item backstop: 6 items** across breakfast and lunch.

Both numbers sit at the envelope of what the household has actually eaten: their busiest observed day is exactly 120 minutes and their largest is 5 items, so the item rule keeps one item of headroom and is a backstop rather than the thing that sizes the plate. The prep budget is what binds: at observed prep times a day runs out of minutes before it runs out of item slots. Both are uniform across the week; there is no separate Saturday number, so a Saturday can carry a proper weekend lunch.

Both limits count every dish on the day, because breakfast and lunch are the only places a dish can be. Nothing sits outside them.

**Composed as a budget, never as a post-hoc trim.**

1. Breakfast composes first (§3), spending from the day's budget as it places.
2. The same day's lunch composes to the remaining minutes and items (§3.1).
3. At each position, the plate takes the first candidate in ranked order that fits both limits; a candidate that would breach either is skipped for the next that fits.
4. When no candidate fits, the position lands empty, the plate is one companion short, and the week records a `budget-short` incident naming the position.

The old rule was a post-hoc cap (5 items per weekday, 3 on Saturday) applied after composition, which dropped picks in a role-aware order. It is retired in full, along with the pick roles that existed only to order those drops. The premise was false: a menu that has already been composed is the wrong place to discover it is too much work, and the household's complaint was never about the number of items but about the time and the shape. A day is now correct by construction, so a `budget-short` incident is a genuine signal that a pool is too thin or too slow, not weekly steady-state noise.

Two positions may spend past the minute budget, never past the item backstop, because a plate without them is a worse outcome than a long day: the §3 lunch protein floor (protein beats budget) is the only one today.

## 10. Ingredient Consolidation

Tracked: ingredients whose catalog row in `ingredients.md` carries a `Pack Size`. By-weight items (curry-cut chicken, fresh fish sold loose, fresh vegetables) and pantry staples are not tracked (blank `Pack Size`); buy as needed.

Leftover threshold: 50 g.

Process:

1. After each dish is picked, compute leftover for its tracked ingredients: pack size minus dish usage, rounded up to the next pack multiple if a single pack falls short.
2. If leftover is at least 50 g, the next slot needing that ingredient prefers a dish that consumes the leftover.
3. If no such pairing fits §3 composition, accept the leftover (freeze or carry to next week's plan).

Soft consolidation: prefer dishes that share fresh produce already on the buy list (capsicum, tomato, cucumber, onion, mint, coriander). One purchase covering multiple dishes beats two small ones.

## 11. Nutrition

Dish macros are derived, never hand-stored. There is no per-dish protein or carb field and no override field: the single source of truth is each ingredient row's quantity and the catalog's per-100g macros (§12 field reference). `engine/src/nutrition.ts` computes them; correcting one ingredient's macros corrects every dish that uses it.

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

The macros are derived for display and for the reporting layer (below); they are not a §3 composition input or a §4 ranking input. The `HP` tag stays the rule input for high-protein composition; the reporting layer only surfaces drift between the tag and the derived protein. The derived `healthy` flag is the single source of truth behind the Explore and picker "Healthy" filter chip: the frontend reads it, never re-implementing the thresholds.

### 11.1 Reports (non-blocking)

Alongside the blocking validators (§1, §12), a reporting layer in `engine/src/data/validators.ts` produces non-blocking reports, regenerated by `npm run reports` and printed in CI output without failing the build. They carry judgment CI cannot make and feed the slow loop:

- **Coverage report:** the share of active dishes carrying each enrichment field (description, recipe, complexity, photo) and the share of macro-relevant catalog rows carrying macros, tracked per macro column (protein/carbs, fat, and fibre, so the energy and Healthy inputs ratchet independently). Macro-relevant rows are the food groups (Proteins and Dairy, Pantry, Vegetables); aromatics and herbs may stay blank, and the Fruit group is excluded from the denominator (the generic "Fruit" placeholder row carries no macros). This is the ratchet the enrichment work burns down; blank macros and unpopulated fields are expected until they are filled, so near-zero coverage is correct, not a failure.
- **Pool-coverage report:** for each §3 composition slot, per season, the count of eligible candidates. Surfaces thin pools (the source of repetition) and flags when a season change strands a slot. The pools come from the live §3 composition functions, so the report cannot drift from the engine.
- **HP-vs-protein consistency:** warns when a dish's derived protein and its `HP` tag disagree, using a high-protein threshold of 20 g per person. Dishes whose macros are not yet populated are skipped, so the report stays silent until macros exist. The `HP` tag remains the rule input; this only surfaces drift.
- **Special-sourcing report:** for each active dish, the special-sourcing ingredients it uses, resolved against the catalog's `Special` flag (§12). Answers "which dishes need a special shopping trip, and for what", so the week's supermarket or specialty-store run is visible up front; a dish with no special ingredients is omitted. This is the sourcing signal the future Swiggy ordering automation (product.md §8) consumes.

## 12. Field Reference

**Per-dish file (`data/dishes/<slug>.md`) frontmatter:**

- `id`, `name`: identifiers. The `<slug>` filename is derived from the name (lowercase, hyphenated, punctuation stripped), is unique and permanent, and must match the name; two dishes that share a name are disambiguated by suffixing the id.
- `category`: Gravy dish, Dry dish, Complete meal, Rice, Chapati, Paratha, Bread, Chilla, Accompaniment, Dessert, Keto, Fruit.
- `time`: Breakfast or Lunch.
- `tags` (a list, possibly empty):
  - `HP`: high-protein (paneer, chicken, egg, fish, prawn, soya).
  - `complete_meal`: standalone dish, no sides needed.
  - `complete_carb`: substantial carb needing only an accompaniment.
  - `fruit`: carried by the Category=Fruit dishes, all of which are inactive (§3.3). Parsed, never a rule input.
  - `cuisine_neutral`: marks a plain protein with no cuisine character (grilled chicken breast, boiled eggs) that pairs with any register. An eligible companion in the §3 international lunch form regardless of the anchor's cuisine.
- `primaryIngredient`: dominant fresh or packaged ingredient. Drives §4.2 same-day deprioritisation and §10 consolidation. A free categorization label, not required to match a catalog ingredient name. Use `Mixed Veg` when no single vegetable dominates (it never triggers consolidation but does trigger same-day deduplication).
- `preferred`: Yes/No. Parsed and retained, but not a selection input: §4 step 4 pins the household's live favorites list (the `favorites` table, curated in the app), not this field. It stays on the dish files for reference and possible future use.
- `active`: Yes/No. Eligibility filter per §1.
- `satiety`: High, Medium, or Low. A display field; the retired §9 item cap used it to order drops and nothing reads it as a rule input today.
- `prepMinutes`: estimated active prep time in minutes. The §9 whole-day prep budget sums it across a day's breakfast and lunch items, so it is a hard composition input: a dish whose prep time will not fit the day's remaining minutes is skipped for one that does.
- `seasons`: a season list, or `All` for year-round.
- `cuisine`: a single cuisine, the human-readable name (Indian, Italian, Chinese, Mexican, Greek, Spanish, Korean, Japanese, Continental, Vietnamese, Lebanese, Mediterranean, Thai). A display, filter, and **§3 composition** field. §3 reads it for meal-level cuisine coherence: the Indian thali (Menu 1/2) composes only `cuisine === "Indian"` dishes, and the international form and its §3.2 selection use `cuisine !== "Indian"` for the anchor pool and same-cuisine companion match. §1 eligibility and §4 selection do not read it (the former per-position cuisine-diversity step is gone, §4). It is the single source of truth for the Explore cuisine filter, the Explore card's cuisine display, and the dish-photo prompt's cuisine slot (engineering.md §4). Dishes with no international cuisine are `Indian`, and `cuisine !== "Indian"` is the non-Indian test. Required on every dish.
- `pairsWith` (optional): a list of dish names, each of which must resolve to a library dish by exact name (a blocking validator, like the ingredient rows). Names the canonical partner of a lead dish, so that when the lead is placed its partner leads the companion pool of the same plate. **It proposes, it never overrides** (§3): it cannot put a second gravy on a plate, cannot supply a carb plate's sole companion in place of a gravy or a sabzi, cannot consume the §4.8 exploration slot, and cannot place a dish the within-week no-repeat rule (§4 step 5) excludes. A pair that the composition rules cannot actually place is dead data, so any new pair is validated against the plate rules before it ships.
- `carbAffinity` (optional): `Rice` or `Roti`, the canonical lunch carb of a protein-lead dish (§3.1). `Rice` sends the §3 carb position to the plain Category=Rice pool; `Roti` to Category=Chapati; absent leaves the default (Chapati). Set it only where the pairing is canonical (kadhi, chhole, sambar, rasam, and every non-Indian curry-type Gravy anchor take `Rice`; a non-Indian Rice-affinity anchor draws a `cuisine_neutral` steamed rice on the international form). Read only at the carb position; §1 eligibility and §4 selection never read it. `Roti` and absent resolve to the same pool today, so most dishes leave it unset.

Enrichment fields, all optional (absent on a dish parses unchanged; the UI degrades gracefully when missing):

- `complexity`: cooking complexity, one of `Easy`, `Medium`, `Hard`. The data stores only the enum; the plain-language labels ("Easy to cook", "Cook will need some help", "Takes time and effort") live in the UI, not here.
- `skill`: free-text note on the skill a dish demands (e.g. "Comfortable, browning matters").
- `equipment`: free-text note on special equipment (e.g. "Heavy kadhai").
- `buySpecially`: free-text note on an ingredient that must be bought specially.
- `prePrep`: free-text day-before prep; present only when day-before work exists.
- `photo`: filename of the dish photo under `data/dish-photos/`.

**Per-dish file body conventions** (parsed into the dish, both optional):

- The first body paragraph, the prose before `## Ingredients`, is the one-line `description`.
- A `## Recipe` section after the `## Ingredients` table holds numbered steps (`1.`, `2.`, ...); each step parses into one `recipe` entry.

**Per-dish file `## Ingredients` table:** `Ingredient`, `Quantity`, `Unit`. Every `Ingredient` value must resolve to a catalog row by exact name (a blocking validator); a dish may have zero ingredient rows.

**Ingredient catalog (`data/ingredients.md`) columns:**

- `Ingredient`: canonical name, one row per ingredient (the union of all names used across dish ingredient rows plus any tracked ingredient).
- `Group`: the user-facing grocery-list bucket, in fixed order Proteins and Dairy, Fruit, Vegetables, Aromatics and Herbs, Pantry. Pantry renders last and is the fallback bucket; there is no catch-all section.
- `Unit`: the canonical measure (g/ml/pcs) observed for that ingredient.
- `Pack Size`: present marks a tracked ingredient (used by §10); blank marks an untracked staple bought by weight.
- `Grams per piece`: for `pcs`-unit ingredients only (an egg is about 50 g), so §11 nutrition can convert pieces to grams; blank on every other row.
- `Protein /100g`: protein grams per 100 g, the §11 protein input; blank reads as zero.
- `Carbs /100g`: carbohydrate grams per 100 g, the §11 carbs input; blank reads as zero.
- `Fat /100g`: fat grams per 100 g, the §11 calorie (Atwater) input; blank reads as zero.
- `Fiber /100g`: fibre grams per 100 g, the §11 fibre input (a Healthy threshold); blank reads as zero.
- `Special`: `Yes` for an ingredient that needs special sourcing (not stocked by a regular Bangalore sabziwala/kirana, so a supermarket or specialty-store run); blank means regular sourcing, the common case. Feeds the special-sourcing report (§11.1) and the machine-readable sourcing surface future ordering automation needs (product.md §8).

## 13. Spec-code parity

`docs/engine.md` is the source of truth for what the engine does; `engine/src/` is the source of truth for how it does it. Both must stay in lockstep. CI enforces this with two checks:

1. Any PR that modifies `docs/engine.md` must also modify at least one file under `engine/src/` and at least one file under `engine/test/`. The check fails with a message naming the missing pair.
2. Each numbered section above corresponds to a module under `engine/src/` plus a paired `engine/test/*.test.ts`: `eligibility.ts` for §1, `schedule.ts` for §2, `composition.ts` for §3, `priority.ts` for §4, `pickerRanking.ts` for §5, `requests.ts` for §6, `explore.ts` for §7, `groceryList.ts` (grocery half) and `historyRows.ts` (finalize half) for §8, `cap.ts` for §9, `consolidation.ts` for §10, `nutrition.ts` and the reporting layer in `data/validators.ts` for §11. Requested-dish placement is also exercised end-to-end in `generateWeek` (`generateWeek.ts` consumes `requests.ts`). §4 step 4 guaranteed favorites placement is a placement pass in `favorites.ts` (paired with `test/favorites.test.ts`) that `generateWeek.ts` consumes the same way it consumes `requests.ts`; the per-pool ranking tie-breaks of §4 stay in `priority.ts`. The simulation harness (`test/simulation.test.ts`) exercises all sections end-to-end against `data/menu_history.md` plus four to six weeks of forward simulation, including a skipped-day week that asserts the §8 property: a skipped day contributes zero grocery rows and zero history rows.

When a rule changes, the order of operations is:

1. Edit this document.
2. Edit the corresponding `engine/src/` module.
3. Update or add tests.
4. Run the simulation harness locally; fix anything that fails.
5. Open the PR.

The slow loop, when it proposes a rule change, follows the same order and bundles all four changes into one PR.
