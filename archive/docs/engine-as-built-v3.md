# How a menu is generated, as built

**What this is.** A read-through of the rule engine that is live in production today, written in the order the code actually runs, so you can follow one generation from "here is a Monday date" to "here is the week on the phone".

**What it is not.** It is not a fifth canonical spec. `docs/engine.md` stays the normative rules document and owns rule decisions. This file is its verification companion: it describes observed behaviour of the shipped code, and its last section lists every place where `docs/engine.md` and the code disagree.

**Scope and provenance.**

- Verified against `origin/main` at commit `47d258c`, which is what Vercel and Convex deploy.
- Sources read: `engine/src/generateWeek.ts`, `schedule.ts`, `composition.ts`, `priority.ts`, `cap.ts`, `favorites.ts`, `requests.ts`, `eligibility.ts`, `historyRows.ts`, and the calling mutation `app/convex/generateWeek.ts`.
- The engine v4.1 work (frequency-first selection, the whole-day prep budget, `pairsWith`, the exploration slot) is **not** in production. It lives on feature branches. Nothing in this document describes it.

---

## 1. The inputs

A generation run is one Convex internal mutation, `generateWeek:generateCurrentWeek`, triggered by hand:

```
npx convex run --prod generateWeek:generateCurrentWeek '{"weekStart":"2026-08-24"}'
```

It takes three arguments, only the first of which is required:

| Argument              | Meaning                                                                                        |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| `weekStart`           | The Monday that anchors the week. Must be a real calendar Monday; the engine throws otherwise. |
| `rng`                 | An optional fixed number that replaces the random draw. Used to make a run reproducible.       |
| `userRequestedDishId` | An optional complete-meal lunch dish to force onto a weekday.                                  |

From those, the mutation assembles the rest:

- **The dish library.** All 266 dish files under `data/dishes/`, baked into the engine at build time. 261 are `active: Yes`.
- **The season.** Read from the month in `weekStart` alone. March to May is Summer, June to September is Monsoon, October to February is Winter. One season governs the whole week, including a week that straddles a month boundary.
- **The history.** The baked snapshot of `data/menu_history.md` plus one row per finalized `weekArchive` row in Convex. Every row is `(weekStart, day, meal, dishName, dishId)`.
- **The favorites.** Every row of the Convex `favorites` table that carries a `dishId`, sorted oldest-added first. Free-text custom favorites are skipped; the engine has no dish to place for a name.
- **The ingredient catalog and pack sizes**, for the consolidation step.

**How recency is measured, and why it matters.** The engine reduces the history to one map: for each dish id, the **latest `weekStart` it appears in**. That is a week-level granularity, not a day-level one. Every dish cooked in the same week is exactly as recent as every other. All the "longest unused" language below compares those week strings.

---

## 2. The pipeline

Seven stages, in this order.

### Stage 1: lay out the week's slots

`weekSchedule` produces a fixed list of eleven slots, in this order:

```
Mon Breakfast, Mon Lunch, Tue Breakfast, Tue Lunch, Wed Breakfast, Wed Lunch,
Thu Breakfast, Thu Lunch, Fri Breakfast, Fri Lunch, Sat Lunch
```

Sunday is not scheduled. Saturday has no breakfast. The order is load-bearing: **a day's breakfast always composes before that day's lunch**, which is what lets lunch read the morning's ingredient and the morning's item count.

Each weekday lunch is stamped with a menu form by day: **Menu 1 on Mon, Wed, Fri; Menu 2 on Tue, Thu**.

Saturday is stamped Menu 3 or Menu 4. The intent recorded in `docs/engine.md` is that it alternates with last Saturday. **In production it does not.** The engine only alternates if the caller hands it `lastSaturdayMenu`, and the Convex mutation never does, so the form falls through to `rng() < 0.5`, which defaults to `Math.random()`. In practice Saturday's form is an independent coin flip every week, and regenerating the same week can produce a different Saturday. This is the single clearest gap between the written rules and the running code; it is listed again in section 6.

### Stage 2: decide which weekday lunches stop being Indian

Before anything is picked, the engine decides which weekday lunches will swap their default Menu 1 or Menu 2 for a different form. Up to three of the five weekday lunches can be substituted.

**First, the international lunches, up to two.** Cuisine coherence is treated as a whole-meal concern, so non-Indian food arrives as a complete non-Indian meal rather than as one foreign dish dropped into a thali.

1. Build the anchor pool: active, in-season, `time: Lunch`, `cuisine` is not `Indian`, and category is one of Gravy dish, Dry dish, Keto, Complete meal.
2. Sort it longest-unused first, never-cooked counting as longest unused.
3. Take up to two anchors, **preferring two different cuisines**. Only if there are not two distinct cuisines available does it take a second anchor of the same cuisine.
4. Give each anchor the earliest unclaimed weekday whose would-be Indian protein lead is **not strictly longer unused** than the anchor. Ties go to the international form.

Because the library holds many never-cooked international dishes and never-cooked counts as longest unused, this step almost always finds its two anchors, and they land on the earliest weekdays. That is why Monday and Tuesday are so often the non-Indian days.

**Then, at most one complete-meal lunch.** One further weekday may swap to the Saturday-style Menu 3 or Menu 4 form. It fires when either:

- you passed `userRequestedDishId` naming a `complete_meal` lunch dish, or
- the longest-unused `complete_meal` lunch dish is older than the protein lead that would otherwise fill that day.

The form follows the dish: an HP-tagged complete meal runs Menu 3, a non-HP one runs Menu 4.

**They never collide.** The international pass claims its days and its dishes first; the complete-meal pass runs only on what is left and cannot re-pin an anchor. A day is never substituted twice.

### Stage 3: pin the dishes that are guaranteed a place

Two mechanisms pin a dish to the front of a slot's ranked pool, overriding recency for that one position. Both use identical machinery.

**Requested dishes.** A list of dish ids that generation must place. Each takes the first slot in schedule order whose composition accepts it. This mechanism is live and tested but **has no production feeder today**; nothing calls it. It is retained because favorites reuse it.

**Favorites, the guarantee.** Every library dish on the favorites list is pinned into exactly one slot of every week:

- Resolved oldest-added first. When the whole set cannot fit, the oldest win.
- A favorite prefers a slot on a day that holds no favorite yet, so favorites spread across the week.
- Meal routing is automatic. A breakfast dish never appears in a lunch slot's pools, so it can only be accepted by a breakfast slot.
- The pin never breaks a composition lock. If no slot's composition accepts the dish, it is reported unplaced rather than forced.
- **Exactly once.** Every pinned favorite is removed from the selectable pool of every _other_ slot in the week, so ordinary ranking cannot draw it a second time somewhere else.

"Composition accepts it" has a precise meaning: the dish appears in at least one of the position pools that slot's form builds. Note the consequence: a favorite that only appears in a slot's fallback pool (say, the protein floor) is counted as accepted, but it will only actually land if that fallback position fires.

Favorites never touch the swap picker or Explore. They are a generation-time guarantee, not a ranking tilt.

### Stage 4: compose and pick, slot by slot

This is the heart of it. The engine walks the eleven slots in schedule order. For each one it does the same four things:

1. **Recompute what the week looks like so far.** Every input is derived fresh from the running list of dishes already placed: the ingredient ledger, the lunch carbs used, a synthetic set of history rows dating this week's picks to `weekStart`, the set of dish ids already placed, and the set of protein families already spent on a protein main.
2. **Build the position pools** for that slot's form (below). Filtering is always by field, never by dish name.
3. **Rank each pool** by the §4 chain (section 3 of this document).
4. **Take the top-ranked dish** for each position.

#### The eligibility floor

Every pool starts from the same filter, and it is short: **`active: Yes`, and `seasons` includes the current season** (or is `All`). That is all. There is no cooking-difficulty filter in production: a `complexity: Hard` dish is as eligible as any other on a Tuesday.

#### Breakfast, Monday / Wednesday / Friday

Two forms exist on paper, and the engine tries them in order.

- **Option B:** one `complete_carb` breakfast dish, plus one breakfast accompaniment (`category: Accompaniment`, `time: Breakfast`).
- **Option C:** one breakfast `Dry dish`, plus one plain breakfast carb (Bread, Paratha or Chilla without the `complete_carb` tag).

Option C is only reached if Option B produces nothing. **It never does.** Option B's lead pool holds 6 dishes in Summer and Monsoon and 8 in Winter, and its accompaniment pool holds 4 year-round. So in the live library **Option C never fires**, and the four breakfast Dry dishes (Anda bhurji, Egg podimas, Paneer bhurji, Vegetable omelette) are unreachable by generation. They are reachable only by a manual swap, because the Tuesday and Thursday pool does not accept them either.

One exception inside Option B: a `complete_carb` whose category is **Bread** (avocado toast, masala toast) is self-sufficient and is served **alone**, a one-item breakfast with no accompaniment. A Chilla or Paratha lead keeps its chutney.

#### Breakfast, Tuesday / Thursday

One dish from the pool of breakfast dishes tagged `complete_meal` or `complete_carb` (17 dishes in Summer and Monsoon, 19 in Winter). Then two dish-driven attachments:

- **Protein floor.** If the chosen main carries no `HP` tag, one HP `Keto` breakfast dish is appended. **That pool holds exactly one dish in the whole library: Boiled eggs.** So a non-HP Tuesday or Thursday breakfast is boiled eggs, always.
- **Chutney.** If the chosen main is a Chilla or a Paratha, one breakfast chutney is appended, whatever else is on the plate.

A non-HP chilla can therefore carry both, making a three-item breakfast. That is allowed; the day cap trims later if it has to.

Note the asymmetry: the protein floor is a Tuesday and Thursday rule only. Monday, Wednesday and Friday breakfasts are already two items and get no protein guarantee, so a Monday avocado toast served alone carries no protein at all.

#### Lunch, the Indian weekday plate (Menu 1 and Menu 2)

Both days run one shared form. They differ only in where the protein comes from.

| Position     | Menu 1 (Mon, Wed, Fri)                                     | Menu 2 (Tue, Thu)             |
| ------------ | ---------------------------------------------------------- | ----------------------------- |
| Protein lead | HP-tagged, category Gravy dish or Dry dish, cuisine Indian | category Keto, cuisine Indian |
| Carb         | by the lead's `carbAffinity`                               | same                          |
| Companions   | `lunchBudget - 2` of them                                  | same                          |

**The carb.** `carbAffinity: Rice` draws from the plain Rice pool, `Roti` and absent both draw from the Chapati pool. Rice is subject to a hard spacing rule: **a Rice carb never lands two generated days running**, and when spacing blocks it the carb falls back to Chapati. Carbs are exempt from every recency rule, which is why roti recurs all week by design.

**The companions.** One ranked pool: non-HP, Indian, category in Gravy dish, Dry dish or Accompaniment. The engine walks it in ranked order and fills the available positions, skipping any Gravy dish once the plate already holds one.

**How many companions.** The plate composes to a budget rather than composing four items and trimming:

```
lunchBudget = clamp(5 - breakfastItemCount, 2, 4)
companions  = lunchBudget - 2
```

`breakfastItemCount` is the number of items the same day's breakfast **actually** placed, not a number fixed in advance. A two-item breakfast leaves a three-item lunch and therefore one companion. A one-item breakfast (avocado toast alone) leaves a four-item lunch and two companions.

**Fallback.** If no protein lead is eligible at all, the slot lands a carb only, and the protein floor below then adds protein.

#### Lunch, the international form

Runs on a day the substitution pass claimed. The pinned anchor leads, and the whole meal stays in one cuisine register: a companion qualifies only if it shares the anchor's cuisine **or** carries the `cuisine_neutral` tag (a plain protein such as grilled chicken breast or boiled eggs).

What follows the anchor depends on what the anchor is:

- **Self-sufficient anchor** (`complete_meal` tag or category Complete meal, such as a pasta or a fried rice): served **alone**. The carb is built into the dish.
- **Protein anchor** (HP or Keto): takes at most one same-cuisine-or-neutral **non-HP** veg side.
- **Veg-forward anchor** (neither HP, nor Keto, nor a complete meal): takes one same-cuisine-or-neutral **protein** companion, so vegetables are never served without protein.

The form takes no Indian carb, with one exception: an anchor with `carbAffinity: Rice` takes a `cuisine_neutral` steamed rice, subject to the same rice-spacing rule.

#### Lunch, Saturday (Menu 3 and Menu 4)

Three items, fixed shape.

- **Menu 3:** a dish tagged both `complete_meal` and `HP`, plus an Accompaniment, plus a Dessert.
- **Menu 4:** a `complete_meal` dish without `HP`, plus a Keto dish, plus an Accompaniment.

Saturday does not use the lunch budget; its size is fixed at three.

#### The protein floor, applied to every lunch

After any lunch form finishes composing, the engine checks whether any picked item is HP-tagged or category Keto. If none is, it appends one protein dish:

- drawn from the eligible HP-or-Keto lunch dishes that are Indian or `cuisine_neutral` (or same-cuisine-or-neutral on an international plate),
- never a second Gravy dish if the plate already holds one,
- appended even if the plate is at its item budget, because protein beats budget,
- but never past four lunch items.

Menu 1, Menu 2 and Menu 3 satisfy this by construction. It fires on the carb-only fallback, on a Menu 4 whose Keto pool is empty, and on a self-sufficient non-HP international anchor. If the floor pool itself is empty the plate ships without protein and the week records a warning.

### Stage 5: the day cap

Only now, after the whole week is composed, does the engine count items per day.

**Cap: 5 items on a weekday, 3 on Saturday.** Breakfast plus lunch. The fruit is not counted; it has not even been picked yet.

When a day is over, dishes are dropped one at a time:

1. Drop only a **droppable side**, meaning a `sabzi`, an `accompaniment` or a `dessert`, while any remains. The carb, the protein main, the dal, the breakfast main, the breakfast chutney and the protein floor are protected.
2. Among the droppable sides, drop the one with the **lowest satiety**, then the **longest prep time**, then the one **later in the day**.
3. If the day is still over with nothing droppable left, drop the worst pick overall by the same ordering, so the day always resolves.

Every drop writes an incident naming the day and the dish. Because the lunch already composed to a budget, this should rarely fire; when it does it is a signal that something composed larger than expected.

### Stage 6: the fruit of the day

Picked last, after the cap, and attached to the day rather than to a meal. It is not a breakfast item and not a lunch item, and it is outside the cap entirely.

The rule as implemented is a **rotation, not a per-day pick**:

1. Take every active, in-season `category: Fruit` dish. That pool is 9 in Monsoon, 4 in Summer and **3 in Winter**.
2. Sort it longest-unused first, using cross-week history only.
3. Hand them out in that order across the scheduled days, wrapping when the pool runs out. Monday gets the longest-unused fruit, Tuesday the next, and so on.

So in Winter, with three fruits and six days, each fruit lands exactly twice a week, every week. That is intended behaviour under a thin pool, not a bug: fruit is exempt from the within-week no-repeat rule.

The fruit pick reads only the committed history. It does not see this week's other picks, and it does not feed back into any ranking, because it happens after every other decision.

### Stage 7: reconcile, warn, and persist

- **Requests.** Every planned request is re-checked against the finished week. One that did not survive produces an incident, so a requested dish either appears exactly once or is accounted for by a warning.
- **Favorites.** Same check. Favorites that did not land are returned as `unplacedFavorites`, and the Convex layer logs one warning per week naming them.
- **Persist.** The week is written to the `currentWeek` table as `status: "draft"`, `version: 1`, one slot per day and meal, plus a separate `fruit` slot per day. Any existing row for the same `weekStart` is deleted first. Every incident becomes a row in `incidents` with severity `warn`.

---

## 3. The ranking rules, in one place

Every pool, in every slot, is ordered by the same chain. Each step is a stable reordering of the whole pool, so a later step dominates an earlier one and the earlier ones survive as its tiebreaks.

**Step 1. Longest unused.** Oldest last-cooked week first. Never cooked counts as longest unused, so it sorts to the very front. This is the engine's basic bias: it proposes the dish you have avoided the longest.

**Step 2. Same-day ingredient.** A lunch candidate whose `primaryIngredient` matches the same day's **breakfast lead** is pushed to the bottom. If every candidate matches, nothing moves and the repeat is allowed.

**Step 3. Ingredient consolidation.** A candidate that consumes an above-threshold leftover from an earlier pick this week is preferred. The threshold is 50 g, and only ingredients with a `Pack Size` in the catalog are tracked. A secondary tiebreak prefers dishes sharing fresh produce already on the list.

**Step 4. Favorites.** Not a ranking step at all. It is the placement guarantee described in stage 3.

**Step 5. Within-week recency.** A dish already placed earlier this week sinks below every dish not yet placed. Applied near the end, so it overrides consolidation. If every candidate has already been placed, nothing moves and the repeat is allowed. This is what stops one broad pool's favourite winning Monday, Wednesday and Friday identically.

**Step 6. Within-week protein diversity, protein mains only.** A protein main whose protein family already led a meal this week sinks below the fresh proteins, so fish, prawn, mutton and egg get a turn instead of chicken every day. A "protein main" is an HP-tagged Gravy dish, Dry dish, Complete meal or Keto dish; an HP side does not count. Soft: if every candidate's protein is already spent, nothing moves.

Chicken, Chicken Breast and Chicken Keema all count as one family. The four soya spellings count as one family. Everything else is its own family.

**The recency exemptions.** Two classes are exempt from steps 1 and 5: dishes carrying the **`fruit` tag**, and **lunch carbs** (category Chapati or Rice). Roti every day and the same fruit twice a week are intended.

**One subtlety worth knowing.** Within a single generation, each dish already placed is also written into a synthetic history row dated `weekStart`. So step 1 sees this week's picks as freshly cooked and sinks them, on top of step 5 doing the same thing more forcefully.

**Determinism.** There is no randomness anywhere in ranking. Every tie bottoms out in the pool's input order, which is library order, which is dish id. The **only** random draw in the whole engine is the Saturday menu form.

---

## 4. The rules that are never bent

Everything above is a preference. These four are hard.

1. **One HP dish per meal.** Once an HP dish occupies a breakfast or a lunch, every remaining position of that meal drops HP-tagged candidates. Has a thin-pool fallback: if that would empty a pool, the unfiltered pool is used so the slot still fills.
2. **One gravy per lunch.** At most one `category: Gravy dish` item on a plate. **No fallback at all.** A plate one companion short beats a plate with two gravies.
3. **Rice never on consecutive days.** A Rice carb blocked by spacing falls back to Chapati, or is simply omitted on an international plate.
4. **Cuisine register per plate.** The Indian thali composes Indian dishes only. The international form composes the anchor's cuisine plus `cuisine_neutral` dishes only. Saturday's Menu 3 and Menu 4 are **not** covered by this rule; their accompaniment and dessert pools are not cuisine-filtered.

---

## 5. Every number in one table

| Constant                                   | Value                             | Where it acts                        |
| ------------------------------------------ | --------------------------------- | ------------------------------------ |
| Weekday item cap                           | 5                                 | breakfast plus lunch, fruit excluded |
| Saturday item cap                          | 3                                 | lunch only                           |
| Max lunch items                            | 4                                 | any single lunch plate               |
| Lunch budget                               | `clamp(5 - breakfastItems, 2, 4)` | weekday Menu 1 and Menu 2            |
| International lunches per week             | up to 2                           | weekday substitution                 |
| Complete-meal lunch substitutions per week | at most 1                         | weekday substitution                 |
| Consolidation leftover threshold           | 50 g                              | ranking step 3                       |
| Rice spacing                               | never 2 days running              | carb position                        |
| Favorites per week                         | 1 slot each                       | placement guarantee                  |
| Breakfast HP Keto pool                     | **1 dish**                        | Tue/Thu protein floor                |
| Fruit pool                                 | 9 Monsoon, 4 Summer, **3 Winter** | fruit of the day                     |

---

## 6. Parity with `docs/engine.md`

Reading the spec against the code turned up seven disagreements. **Six were spec drift and are now corrected in `docs/engine.md`**; the code was right and the words were stale. What was rewritten:

| Section   | What the spec said                           | What it now says                                                                                                                            |
| --------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| §2        | Saturday alternates by reading history       | The caller drives the alternation, and with no previous form supplied the choice is a random draw                                           |
| §2        | At most one weekday lunch is substituted     | Up to two international lunches plus at most one complete-meal swap                                                                         |
| §2        | A fixed items-per-day table                  | Item counts fall out of the dishes and the §3.1 budget; only Saturday has a fixed size                                                      |
| §3        | Breakfast Options B and C are a choice       | Option B composes first and Option C is its empty-pool fallback, which does not fire against the current library                            |
| §3.1      | Mon/Wed/Fri budget 3, Tue/Thu budget 4       | The budget follows the breakfast count that actually landed, worked through all three cases                                                 |
| §3.3      | Pick the longest-unused fruit, per §4 step 1 | Order the pool longest-unused and deal it across the days; §4 step 1 exempts fruit and cannot do this, so the fruit path has its own sorter |
| §4 step 1 | Sort by last-cooked date                     | Week-grained recency over seed plus archive, with the in-week synthetic rows spelled out                                                    |
| §4 step 4 | Locks include "never five items per meal"    | The real locks, plus exactly-once by pool exclusion and reconciliation against the finished week                                            |
| §4 step 5 | Recency stops a favorite winning twice       | It does not; step 4's pool exclusion is what guarantees exactly once                                                                        |
| §3        | (silent on Saturday cuisine)                 | Menu 3 and Menu 4 carry no cuisine filter, stated rather than left to inference                                                             |

The seventh, two stale comments in `composition.ts` and `favorites.ts`, is a code cleanup and is untouched.

**What was already accurate**, and matched the code line for line: §1 eligibility, §3's four hard plate rules, the whole of §4's ranking chain including the exemption list and the protein-family table, §3.1's carb affinity and rice spacing, §3.2's substitution ordering and coexistence guarantee, §9's role-aware drop order, and §6's statement that requests have no production feeder.

### Three behaviours the spec now describes accurately but that are still worth changing

Correcting the words does not correct the machine. These are decisions, not drift.

**The Saturday coin flip.** Regenerating the same week can produce a different Saturday, and the intended alternation never happens, because the one caller never passes the previous form. It is a small fix (thread the last Saturday's form through the Convex run, or have the engine read it from history) and it removes the only non-determinism in the system.

**Four breakfast dishes are unreachable.** Anda bhurji, egg podimas, paneer bhurji and vegetable omelette can only reach a menu through a manual swap, because Option C never fires and the Tue/Thu pool does not accept them. Either the breakfast form changes or the dishes get retagged.

**Two pools are effectively one dish deep.** The Tue/Thu breakfast protein attach draws from a pool of exactly one (boiled eggs), and Winter fruit from a pool of three across six days. No ranking rule can produce variety from those, so the fix is content, not code.

## 7. Two things the rules do not say, but that shape every week

Neither is a defect. Both explain output that looks surprising.

**Never-cooked sorts first.** "Longest unused" puts a never-cooked dish ahead of every cooked one. The library holds far more never-cooked dishes than cooked ones, so the engine's default instinct is to propose something new. That is the deliberate design, and it is also why the international substitution almost always finds its two anchors.

**Two pools have one dish in them.** The Tuesday and Thursday breakfast protein floor draws from a pool of exactly one dish (Boiled eggs), and Winter fruit draws from a pool of three across six days. Where a pool is that thin, no ranking rule can produce variety; the output is a property of the content, not of the rules.
