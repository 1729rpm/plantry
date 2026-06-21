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

| Day           | Fruit   | Breakfast | Lunch                      | Items |
| ------------- | ------- | --------- | -------------------------- | ----- |
| Mon, Wed, Fri | 1 fruit | 2 items   | Menu 1 (3 items)           | 5     |
| Tue, Thu      | 1 fruit | 1 item    | Menu 2 (4 items)           | 5     |
| Sat           | 1 fruit | (none)    | Menu 3 or Menu 4 (3 items) | 3     |
| Sun           | (none)  | (none)    | (none)                     | 0     |

Every day Mon to Sat also carries a Fruit of the day (one in-season fruit, §3.3), Saturday included even though it has no breakfast. The fruit sits outside the breakfast and lunch slots and outside the §9 item cap, so the "Items" column above (the capped breakfast + lunch count) is unchanged by it.

Saturday alternates between Menu 3 and Menu 4. Read `menu_history.md` for the most recent Saturday and pick the other menu. If history is empty, pick at random.

At most one weekday lunch per week may substitute Menu 3 or Menu 4 for its default Menu 1 or Menu 2. On the substituted day the lunch item count matches the substituted menu (3 items); the day's total drops accordingly. See §3.2 for the trigger.

## 3. Slot Composition

**One HP source per meal (all forms).** A single meal (a day's breakfast or a day's lunch) contains at most one HP-tagged dish. Each meal form below picks its protein main first; once an HP dish occupies the meal, the meal's remaining (non-main) positions exclude HP-tagged dishes. This is keyed on the `HP` tag, never on dish names, so it holds for any HP protein (chicken on chicken, paneer on paneer) and across every form: a "Chicken biryani" complete_meal never sits beside a "Chicken salad" HP accompaniment in one Saturday Menu 3. Thin-pool fallback: if excluding HP-tagged dishes would empty a non-main position pool, the unfiltered pool is used so the slot still fills (one HP-main meal with a second HP side beats an incomplete meal). This is rare given the broad companion pools and surfaces as composition signal for the slow loop, not a hard error.

### Breakfast

Breakfast is savoury only: the Fruit of the day (§3.3) is its own section, never a breakfast item.

Mon, Wed, Fri (2 items), pick exactly one option per day:

- Option B: 1 dish with `complete_carb` tag, plus 1 breakfast accompaniment (Category=Accompaniment, Time=Breakfast)
- Option C: 1 breakfast main (Category=Dry dish, Time=Breakfast), plus 1 plain breakfast carb (Time=Breakfast, Category in {Bread, Paratha, Chilla}, without `complete_carb` tag)

The fruit-bearing Option A is retired (fruit is now §3.3), so both 2-item options are savoury. A consequence: a `complete_meal` breakfast dish, which Option A used to lead, now appears only on the Tue/Thu single-item slot below.

Tue, Thu (1 item):

- 1 dish with `complete_meal` OR `complete_carb` tag (no accompaniment)

### Lunch

**Menu 1 (Mon, Wed, Fri), 3 items:**

- 1 HP dish (Category=Gravy dish or Dry dish)
- 1 partner: if HP is Dry, pick a non-HP Gravy dish; if HP is Gravy, pick a non-HP Accompaniment
- 1 lunch carb (see §3.1)

The partner is always non-HP: this is the one-HP-source-per-meal rule (above) applied to Menu 1. The Menu 1 main is the meal's HP pick, so the partner pool (the non-HP Gravy when the main is Dry, the Accompaniment when the main is Gravy) excludes any dish carrying the HP tag, with the same thin-pool fallback.

**Menu 2 (Tue, Thu), 4 items:**

- 1 Keto dish
- 1 non-HP Gravy dish (any satiety)
- 1 non-HP Dry dish
- 1 lunch carb (see §3.1)

The Keto dish is the meal's protein lead and the only position that may be HP; the Gravy and Dry companions are already non-HP, so one-HP-per-meal holds by construction.

**Menu 3 (Saturday), 3 items:**

- 1 dish with both `complete_meal` and HP tags
- 1 Accompaniment (non-HP; the lead is always HP, so one-HP-per-meal excludes HP accompaniments, with the thin-pool fallback)
- 1 Dessert

**Menu 4 (Saturday), 3 items:**

- 1 dish with `complete_meal` tag and no HP tag
- 1 Keto dish
- 1 Accompaniment

The lead is non-HP, so the meal's one HP source (if any) is whichever of the Keto dish or the Accompaniment lands one first; once it does, the later position excludes HP-tagged dishes (with the thin-pool fallback). Breakfast forms apply the same rule: an HP breakfast main excludes an HP partner (a fruit partner is never HP; an HP accompaniment partner is dropped under Option B).

### 3.1 Lunch carb rule

Default: pick a dish with Category=Chapati.
Constraint: dishes with Category=Rice appear at most once per week.
The recency rule (§4) does not apply to lunch carbs.

### 3.2 Weekday complete meal substitution

One weekday lunch per week may swap its default menu for Menu 3 or Menu 4:

- Menu 3 form (complete_meal+HP + Accompaniment + Dessert) when the lead complete_meal is HP-tagged.
- Menu 4 form (complete_meal + Keto + Accompaniment) when the lead complete_meal is non-HP.

Substitution is triggered when either:

- a. The user requests a specific complete_meal Lunch dish for the week, or
- b. The longest-unused eligible complete_meal Lunch dish (per §4.1) is older than the longest-unused candidate that would otherwise fill the day's protein slot (HP for Menu 1, Keto for Menu 2).

The supporting items (Accompaniment, Dessert) are then picked per §4 from their composition-defined candidate sets. Saturday's own Menu 3/4 alternation (§2) is independent of this weekday substitution.

### 3.3 Fruit of the day

Every day Mon to Sat carries exactly one Fruit of the day, Saturday included even though it has no breakfast. The fruit is its own section, separate from breakfast and lunch: it is not a breakfast item, not a lunch item, and not subject to the breakfast/lunch composition forms above.

- **Eligibility.** The candidate pool is every dish that is Active, in-season (§1), and Category=Fruit.
- **Selection.** Pick the longest-unused eligible fruit dish (§4 step 1, oldest last-cooked date first; never-cooked counts as longest unused). Fruit stays recency-exempt (§4), so the within-week no-repeat rule does not apply to it: when the eligible pool is thin the same fruit may recur across days of one week, which is intended, not a defect.
- **Cap.** The Fruit of the day is outside the §9 item cap. It is a fruit, not a meal item, so it never counts toward the 5-item weekday cap or the 3-item Saturday cap and is never a cap-drop candidate.
- **Grocery and history.** A fruit dish is a real library dish with ingredient rows, so its ingredients flow into the grocery list (§8 skip-aware aggregation) like any other day dish. Because fruit is recency-exempt, the fruit pick does not append to the finalize history rows (§8): a history row for it would have no effect on later selection, and Saturday has no breakfast or lunch meal to attach it to.

## 4. Selection Priority

After §3 composition has produced the candidate set for a slot, rank candidates in this order. Each step breaks ties from the previous.

1. **Longest unused.** Sort by last-cooked date in `menu_history.md`, oldest first. Never-cooked counts as longest unused.
2. **Same-day key ingredient deprioritisation.** If breakfast's Primary Ingredient on the same day matches a candidate's Primary Ingredient, deprioritise the candidate. If no viable alternative exists, allow the repeat.
3. **Ingredient consolidation (§10).** Prefer candidates that consume leftover from earlier picks in the week.
4. **Preferred=Yes** over Preferred=No.
5. **Within-week cuisine diversity.** A soft, target-gated nudge that leans the week slightly less Indian on a standing basis without flipping it international. It tracks how many non-Indian dishes (`cuisine !== "Indian"`, the only `cuisine` use in any rule) have already been placed in the week being generated, against the constant `WEEKLY_NON_INDIAN_TARGET` (default 3). While that count is below the target, the step partitions each slot's pool so non-Indian candidates rank above Indian ones, stable within each group; once the target is met the step is a no-op, so the rest of the week ranks exactly as before. That gate is what bounds the effect to "slightly": roughly `WEEKLY_NON_INDIAN_TARGET` non-Indian dishes a week (a slot can carry the week just over the target, since the count updates between slots, not between the positions of one slot), with every other slot unchanged. The step sits after Preferred=Yes (step 4), so in the at-most-target slots where it fires it can promote a non-Indian candidate above a Preferred=Yes Indian dish; it stays subordinate to the two terminal partitions (steps 6 and 7), which run after it, so it can never force a dish repeat or an HP-protein clash to hit the cuisine target. It is soft with a fresh-alternative fallback (mirroring step 2): if a slot's pool holds no non-Indian candidate (an all-Indian lunch-carb pool, a Category=Fruit pool), promoting none equals promoting all and the pool is returned unchanged, so fruit and lunch-carb slots need no explicit exemption. It never narrows §3 composition eligibility and never empties a slot.
6. **Within-week recency.** A dish already placed in an earlier slot of the week being generated is treated as most-recently-used for every subsequent slot's ranking, so it sinks below any fresh (not-yet-placed-this-week) alternative. This is a dominant ordering: unlike step 1's `menu_history.md` recency, it is applied near-last, so none of consolidation (step 3), Preferred=Yes (step 4), or cuisine diversity (step 5) can re-promote an already-placed dish above an equally eligible fresh one. It exists because the cross-week history (step 1) is silent on the in-progress week, so without it a single broad pool's top-ranked dish (e.g. the longest-unused HP gravy) wins every Menu 1 slot Mon/Wed/Fri identically. When every candidate has already been placed this week, demoting them all is the same as demoting none, so the pool is returned unchanged and the repeat is allowed (the fresh-alternative fallback, mirroring step 2).
7. **Within-week protein diversity (HP mains only).** This is the protein-level analogue of step 6, scoped to HP mains. An HP main is an `HP`-tagged dish in a meal's protein-main slot: Category in {Gravy dish, Dry dish, Complete meal, Keto}. (HP accompaniments are sides, not mains, so they neither consume nor are governed by this step; the one-HP-per-meal rule in §3 already keeps them off an HP-main meal.) When ranking an HP-main pool, a candidate whose **protein family** (see §4.6) already appeared as an HP main earlier in the week is deprioritised below the fresh-protein candidates, so a fresh protein ranks up and the week's HP mains spread across proteins (fish, prawn, mutton, egg get a fair shot) rather than repeating chicken or paneer. This is a soft preference, not a hard constraint: if every candidate's protein family already appeared (no fresh-protein alternative), the pool is returned unchanged so the slot still fills (the fresh-alternative fallback, mirroring steps 2 and 6). It never narrows §3 composition eligibility and never overrides the recency exemptions (below). It applies only to HP-main position pools; companion (non-main) pools are never reordered by protein.

Recency exemptions (apply to step 1 and step 6): dishes with the `fruit` tag, and lunch carbs (Category in {Chapati, Rice}). A fruit-tagged dish repeating across days as the Fruit of the day (§3.3) and Roti repeating across lunches are intended, not defects. Step 5 (cuisine diversity) and step 7 (protein diversity) have their own fresh-alternative fallbacks instead of an exemption list: a fruit or lunch-carb pool that holds no non-Indian candidate is a cuisine no-op, and step 7 acts only on HP mains, none of which are exempt categories, so the exemption list does not interact with either.

### 4.6 Protein-family normalization

Step 7 compares dishes by protein family, not by raw `primaryIngredient`, so cuts of the same protein count as one protein for diversity. The mapping collapses these families and passes every other ingredient through unchanged (each is its own family):

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

## 5. Picker Ranking

§4 ranks generation candidate sets. The picker is the separate ranking the swap and add affordances use when a user opens "Replace with..." or "Add a dish". It answers a different question: given the broad, non-restrictive pool (every Active, in-season dish; `docs/product.md` §6 "a generic ranked picker over the active library", and Principle 4), which alternatives surface first?

For a breakfast/lunch slot the pool is generic across meal-time: every Active, in-season, non-Fruit dish, so a breakfast dish is reachable from a lunch slot and vice versa. The fruit slot keeps its Category=Fruit pool (§3.3). Meal-time is no longer a hard pool filter; it is a swap-time ordering signal (below).

The picker does not narrow the pool (Principle 4: a swap may land on any Active, in-season dish, including a cross-meal one; the resulting §3 composition mismatch is signal for the slow loop, not an error the fast loop blocks). It only orders it. The order is a **head** followed by a **tail**, with slot-meal-matching dishes led to the front of the default view.

**Head ("fits this day").** Every pool dish not already placed on that day. Within the head, dishes are ordered by a deterministic lexicographic comparison on a tuple, lower first:

```
headOrder(dish) = (recencyTier, proteinBandDistanceForSwaps, id)
```

- **recencyTier** is a coarse longest-unused bucket, not a unique index. All never-cooked dishes share the single best (first) tier; cooked dishes are tiered by last-cooked weekStart, oldest weekStart = better tier, so dishes last cooked the same week share a tier. A dish's last-cooked date is the most recent matching history row. This is the dominant term: a longer-unused dish in a better tier always outranks a closer-protein-band dish in a worse tier. Unlike §4, the picker does not exempt fruit or lunch carbs from recency: a swap is a deliberate user choice, so every dish is ranked by recency uniformly. Because the tier is coarse, genuine ties exist (all never-cooked dishes tie; same-week dishes tie), which is what the next term resolves.
- **proteinBandDistanceForSwaps** applies to swaps only (a dish is being replaced). It is the protein-band distance between the candidate and the outgoing dish, where a protein band is the per-person derived protein (§11) divided into fixed 5 g buckets. Same band is distance zero. Because it sits second in the tuple, it only ever orders candidates that share a recencyTier; it can never move a dish across tiers, so it can never push a more-recently-cooked dish above a longer-unused one. The effect: among equally fresh options, the one in the same protein band as the dish being replaced surfaces first, then nearer bands before farther. For adds (no outgoing dish) this term is absent and the head is pure recency tier then id.
- **id** is dish id ascending, the final total tie-break.

**Tail.** Every other pool dish (the same-day repeats the head excluded), ordered by the same tuple comparison. The tail keeps the pool complete (nothing is dropped) while pushing dishes the day already has below fresh options.

**Slot-meal-first default ordering.** After the head/tail ranking, the swap picker stable-partitions the result so dishes whose own meal-time matches the slot lead and cross-meal dishes follow, each group keeping its ranked order. This is a swap-time ordering, not a pool filter: the full ranked pool is still offered (search and filter pills reach every dish), and only the default suggested order leads with slot-meal-matching dishes. The fruit slot's pool is single-purpose and needs no partition. The ranking engine itself is meal-time-blind; this partition is applied by the picker's caller.

**Determinism.** No RNG. Every tie resolves through the fixed tuple chain: recencyTier, then protein-band distance (swaps), then dish id ascending, and the slot-meal-first partition is stable. The same inputs always produce the same order, and input order does not affect output.

## 6. Requested Dishes

Generation accepts an optional list of requested dish ids (the next-week queue feeds it). Each requested dish must be placed into the upcoming week, overriding recency. This generalises the §3.2 trigger (a) into one mechanism: where §3.2 (a) pinned a complete_meal Lunch dish to drive a weekday substitution, a request can pin any dish into any slot whose composition accepts it.

- **Placement.** A requested dish is placed into a slot whose §3 composition accepts it, overriding §4 recency for that position. "Composition accepts it" means the dish appears in at least one position pool of that slot's §3 candidate set: it is an Active, in-season, meal-time-matching dish the slot could legitimately hold. Requests are resolved in their given order; each takes the first schedule slot (in schedule order) whose composition accepts it and that is not already reserved (by a §3.2 substitution) or claimed by an earlier request. Two requests therefore never collide on one slot.
- **Unplaceable requests.** A request that no slot's composition accepts (out of season, inactive, an unknown id, or no fitting free slot remains) produces an incident and is not placed. Generation never crashes and never forces a dish into an incompatible slot. The dish stays queued; the caller re-queues it the following week.
- **Minimal by design.** A request is a list of dish ids, not a generic directive language: no calendar awareness, no per-day pinning (a request cannot say "place this on Friday"). That can earn its way in later if it proves needed (Principle 1, Principle 8).

The mechanism is additive: with no requests, generation behaves exactly as §2 to §5 describe, so every existing caller is unchanged. A request that lands in a slot is then subject to the same §9 cap as any other pick; the cap dropping a placed request is reported as a §9 incident, so a requested dish is always either placed exactly once or accounted for by an incident.

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

## 9. Item Cap

Cap: 5 items per weekday, 3 on Saturday.

The cap counts breakfast and lunch items only. The Fruit of the day (§3.3) is outside the cap: it is a fruit, not a meal item, so it never counts toward the per-day total and is never a cap-drop candidate.

If §3 composition produces a menu over the cap, drop dishes one at a time:

1. From the dishes with the lowest Satiety value present in the menu
2. Among those, drop the one with the longest Prep Min

Repeat until at the cap.

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
  - `fruit`: marks a Fruit-of-the-day candidate (§3.3); recency-exempt.
- `primaryIngredient`: dominant fresh or packaged ingredient. Drives §4.2 same-day deprioritisation and §10 consolidation. A free categorization label, not required to match a catalog ingredient name. Use `Mixed Veg` when no single vegetable dominates (it never triggers consolidation but does trigger same-day deduplication).
- `preferred`: Yes/No. Used as a tiebreaker in §4.4.
- `active`: Yes/No. Eligibility filter per §1.
- `satiety`: High, Medium, or Low. Used by §9.
- `prepMinutes`: estimated active prep time in minutes. Used by §9 tiebreaker.
- `seasons`: a season list, or `All` for year-round.
- `cuisine`: a single cuisine, the human-readable name (Indian, Italian, Chinese, Mexican, Greek, Spanish, Korean, Japanese, Continental, Vietnamese, Lebanese, Mediterranean, Thai). A display and filter field that §4 selection reads for the within-week cuisine-diversity step (§4 step 5) only: §1 eligibility and §3 composition never read it, so it never narrows a pool or makes a dish eligible or ineligible. It is the single source of truth for the Explore cuisine filter, the Explore card's cuisine display, and the dish-photo prompt's cuisine slot (engineering.md §4). Dishes with no international cuisine are `Indian`, and `cuisine !== "Indian"` is the non-Indian test §4 step 5 uses. Required on every dish.

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
2. Each numbered section above corresponds to a module under `engine/src/` plus a paired `engine/test/*.test.ts`: `eligibility.ts` for §1, `schedule.ts` for §2, `composition.ts` for §3, `priority.ts` for §4, `pickerRanking.ts` for §5, `requests.ts` for §6, `explore.ts` for §7, `groceryList.ts` (grocery half) and `historyRows.ts` (finalize half) for §8, `cap.ts` for §9, `consolidation.ts` for §10, `nutrition.ts` and the reporting layer in `data/validators.ts` for §11. Requested-dish placement is also exercised end-to-end in `generateWeek` (`generateWeek.ts` consumes `requests.ts`). The simulation harness (`test/simulation.test.ts`) exercises all sections end-to-end against `data/menu_history.md` plus four to six weeks of forward simulation, including a skipped-day week that asserts the §8 property: a skipped day contributes zero grocery rows and zero history rows.

When a rule changes, the order of operations is:

1. Edit this document.
2. Edit the corresponding `engine/src/` module.
3. Update or add tests.
4. Run the simulation harness locally; fix anything that fails.
5. Open the PR.

The slow loop, when it proposes a rule change, follows the same order and bundles all four changes into one PR.
