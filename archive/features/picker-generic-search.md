# Feature: picker-generic-search

Generic (non-meal-time) picker search with dynamic, result-driven filters across
the Add-a-dish and Replace (swap) sheets.

## Why

Today the Add and Replace pickers hard-filter their candidate pool by the slot's
meal-time. A breakfast carb (e.g. Pav) is therefore unreachable from any lunch
context, and the Add sheet carries two separate chip rows (a meal selector plus
the quick filters) that confuse "what am I filtering" with "where does it go".

We want the picker to be a generic search over the whole active library, let a
breakfast dish land in a lunch slot (the resulting §3 composition mismatch is
deliberate signal for the slow loop, per `docs/product.md` §4 Principle 4), and
give one dynamic filter row that reflects what the current results actually
contain.

## Decisions (locked)

1. **Add routes by the dish's own meal-time.** Picking a breakfast dish adds it
   to the day's breakfast slot, a lunch dish to the lunch slot. The Add sheet has
   NO destination control. Cross-meal placement is done via **Replace** only.
2. **Fruit of the day stays category-locked.** The generic-search relaxation
   applies to breakfast/lunch slots only. The fruit slot keeps its Category=Fruit
   pool and the `dish-not-fruit` guard.
3. **(EM) The generic breakfast/lunch pool excludes `Category: Fruit`.** Fruit
   belongs to its own slot; it must not surface in a meal swap/add.
4. **(EM) Saturday (lunch-only day) Add pool is restricted to dishes whose
   meal-time has a slot that day** (i.e. lunch-time dishes), since a breakfast
   dish would have no slot to route to. Structural, not a meal-preference filter.

## Key architectural fact

`rankPickerAlternatives` (`engine/src/pickerRanking.ts`) does NOT read its `meal`
arg — the head/tail split is purely on-the-day vs not-on-the-day. The meal-time
restriction lives only in the Convex callers (`broadPool`, `addablePool`) and the
two mutations. **The engine ranking module's logic does not change**; only its doc
comments (which currently claim a "meal-time pool") are updated to match.

---

## Streams

### Stream 1 — lib helpers + tests (lane A)

**Branch:** `feat/picker-generic-lib`
**Owns:** `app/web/src/lib/dishFilters.ts`, `app/web/src/lib/library.ts`,
`app/web/test/dishFilters.test.ts`, `app/web/test/library.test.ts`
**Must NOT touch:** any component `.tsx`, any `app/convex/*`, any `engine/*`, docs.

Changes:

1. `library.ts` → `addablePool(weekStart, addableMeals)`: drop the `d.time`
   single-meal filter. New signature takes the day's addable meal-times. Pool =
   Active + in-season + `category !== "Fruit"` + `d.time` is one of `addableMeals`
   (so a breakfast dish is excluded on a lunch-only day). Stays name-sorted.
   (Decision 1 means the chosen dish routes to `d.time`'s slot; decision 4 is the
   `addableMeals` membership test.)
2. `library.ts` → `swapPickerVisible`: replace `dishMatchesFilters` with the new
   `dishMatchesPickerFilters` so meal-time pills work. Behaviour (corpus = full
   pool; default-cap only when no query and no selected pill) is otherwise
   unchanged.
3. `dishFilters.ts` — add the dynamic-filter machinery:
   - A picker pill vocabulary that includes meal-time: `Breakfast`, `Lunch`,
     plus the existing `Easy to cook`, `Healthy`. Keep `PICKER_FILTERS` for the
     fruit slot (quality pills only).
   - `availablePickerFilters(corpus, candidates)`: returns only the candidate
     pills that have >= 1 matching dish in `corpus` (this is "hide the Lunch pill
     when there are no lunch items").
   - `dishMatchesPickerFilters(dish, selected)`: AND across dimensions, OR within
     the meal-time dimension. Reuse `dishInMealTime` for the meal pills and the
     existing complexity/healthy logic for the quality pills.
4. Unit tests covering: addablePool generic + non-fruit + addableMeals
   restriction; availablePickerFilters hides zero-match pills and keeps both meal
   pills when both present; dishMatchesPickerFilters AND/OR semantics.

DoD: `npm -w @plantry/engine run typecheck` + web build/typecheck/test green.
Watch the coverage-ratchet assertions (`x < total`) — bump the totals if new
lines/branches move them; do not weaken the ratchet.

### Stream 2 — backend pool/mutation relaxation + docs (lanes B + D)

**Branch:** `feat/picker-generic-backend`
**Owns:** `app/convex/swap.ts`, `app/convex/dayMutations.ts`, their tests,
`docs/engine.md`, `docs/product.md`, `engine/src/pickerRanking.ts` (doc comments
only — NO logic change), `features/picker-generic-search.md` (commit this file),
and the CLAUDE.md "Currently building" line if not already set.
**Must NOT touch:** `app/web/src/lib/*`, any component `.tsx`, `engine` logic.

Changes:

1. `swap.ts` → `broadPool` (breakfast/lunch branch): drop the `d.time` filter.
   Pool = Active + in-season + `category !== "Fruit"`. Fruit branch unchanged.
2. `swap.ts` → `getSlotAlternatives`: rank the generic pool, then **stable-
   partition** the result so slot-meal-matching dishes (`d.time === engineMeal`)
   lead and cross-meal dishes follow. No engine change — partition is caller-side,
   after `rankPickerAlternatives`. The full array is still returned (search/pills
   reach everything); only the default suggested head changes.
3. `swap.ts` → `swapDish` (breakfast/lunch): drop the `dish-not-meal-time`
   rejection. Keep Active + in-season. Keep the non-Fruit invariant for meal
   slots (reject a Fruit-category dish into a breakfast/lunch slot, mirroring the
   pool). Fruit branch + `dish-not-fruit` untouched.
4. `dayMutations.ts` → `addDish`: the frontend now derives `meal` from the chosen
   dish's `time`, so the meal-time check is never violated. Leave it as a safety
   net (minimal/no change). Do NOT remove the Active+season guard.
5. Docs: `engine.md` §5 and `product.md` §1 / §6 / Principle 4 — the picker pool
   is "every Active, in-season dish" (not "meal-time-matching"); the default view
   leads with slot-meal-matching dishes; meal-time is a swap-time ordering/filter,
   not a hard pool filter. Update `pickerRanking.ts` doc comments to match (drop
   "meal-time" from the pool description; the module already ignores `meal`).
6. Tests: relaxed `swapDish` accepts a cross-meal dish; rejects a Fruit into a
   meal slot; fruit slot still rejects non-fruit; getSlotAlternatives partition
   leads with slot-meal dishes.

DoD: engine "Lint, typecheck, build, test" gate green; Deploy Convex action green
after merge (camelCase module names already fine). No Convex schema change, so no
row-revalidation risk.

### Stream 3 — component rewiring + dynamic filters (lane C) — AFTER 1 & 2 merge

**Branch:** `feat/picker-generic-ui` (branch off origin/main once 1 & 2 are in).
**Owns:** `app/web/src/components/AddDishSheet.tsx`,
`app/web/src/components/SwapPickerSheet.tsx`,
`app/web/src/components/DayScreen.tsx`, picker CSS in `index.css` if needed.
**Must NOT touch:** `app/web/src/lib/*`, `app/convex/*`, docs.

Changes:

1. `AddDishSheet.tsx`: remove the `add-dish__meals` selector and `meal` state.
   Pool = `addablePool(weekStart, availableMeals)`. On confirm, derive
   `meal = chosenDish.time === "Breakfast" ? "breakfast" : "lunch"` and pass it to
   `addDish`. Render ONE dynamic filter row below the search bar (req #2).
2. `DayScreen.tsx`: `AddDishSheet` no longer needs a meal selector; keep passing
   `availableMeals` (now used for the addablePool restriction, decision 4).
3. Both sheets: wire the dynamic-filter behaviour (req #3) — see spec below.

---

## Dynamic-filter behaviour (req #3) — shared spec

Let `textCorpus` = pool filtered by **search text only** (ignoring selected pills).

- **Pills shown** = `availablePickerFilters(basis, candidates)` (only pills with
  >= 1 match):
  - Pristine state (no query, no selection): `basis` = the suggested head that is
    actually displayed → "filters based on the suggested dishes for that slot".
  - Otherwise: `basis` = `textCorpus` (so selecting one meal pill never hides its
    sibling — the user can switch between Breakfast and Lunch).
- **Displayed list** = `textCorpus` narrowed by selected pills (uncapped); the
  pristine state shows the capped suggested head.
- **Reset on search:** a `useEffect` on the trimmed query clears the selected
  pills whenever the query changes ("filters get reset when search is fired").
- **Fruit slot:** candidate pills = quality only (`Easy to cook`, `Healthy`); no
  meal pills.

## Acceptance (whole feature)

- From a **lunch** slot's Replace, searching "Pav" finds Pav (a breakfast dish);
  confirming the swap succeeds and logs a `manualChanges` row (slow-loop signal).
- From a **breakfast** slot's Replace, lunch dishes are reachable by search/pills.
- The **Add** sheet shows one filter row below search; picking Pav adds it to the
  breakfast slot, picking a lunch dish adds it to lunch.
- Filter pills appear only when results contain a matching dish; the Lunch pill is
  hidden when there are no lunch items in the current results; both appear when
  both are present.
- The **fruit** slot's Replace still offers only fruits and rejects non-fruit.
- Per-slice all-flows crawl + design-handoff compare before the Stream 3 merge
  (standing `app/web` gate).

## Doc/coordination follow-ups (EM)

- CHANGELOG entry on each merge; DECISIONS.md entries for EM decisions 3 and 4.
- Reset CLAUDE.md "Currently building" to `_none_` when the last stream merges.
