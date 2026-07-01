# Product

Plantry is a weekly meal planner for a two-adult Indian household in Bangalore. Each week it produces a Monday-to-Saturday menu (breakfast and lunch) from a fixed dish library, following composition and selection rules, then a shareable image family and a grocery list. Sunday is a rest day. The system runs as a small Progressive Web App (PWA) installable on both phones, organised as four tabs (Menu, Grocery, Explore, Changes), with a slow review loop that turns accumulated feedback into structural improvements through human-approved pull requests.

## 1. Persona and household

Two adults: Rajat (product owner) and Tuhina (second user). Cooking style is high-protein and lean, with a strong vegetarian baseline and frequent paneer, eggs, chicken, fish, and prawns. Seasonality matters: ingredients shift across Bangalore's three seasons (Summer March to May, Monsoon June to September, Winter October to February). Both users hold equal control of the week; either can swap a dish, add a dish, drop in a custom dish, delete a dish, skip a day, save a dish for next week, or dislike a dish in Explore.

## 2. Weekly loop

| Day           | Fruit   | Breakfast | Lunch   | Items |
| ------------- | ------- | --------- | ------- | ----- |
| Mon, Wed, Fri | 1 fruit | 2 items   | 3 items | 5     |
| Tue, Thu      | 1 fruit | 1 item    | 4 items | 5     |
| Sat           | 1 fruit | none      | 3 items | 3     |
| Sun           | none    | none      | none    | 0     |

Every day Mon to Sat also carries a Fruit of the day: one in-season fruit, shown as its own light section separate from breakfast and lunch (Saturday included, even though it has no breakfast). Breakfast itself is savoury. The fruit sits outside the breakfast and lunch slots and outside the item cap, so the "Items" column above (the capped breakfast plus lunch count) is unchanged by it.

Each week, the engine reads the dish library, the rules, the season, and the recent history, then produces a complete valid menu plus a grocery list. The week opens on the Menu tab. From a day's Edit button, either user can swap any dish (the engine offers a generic ranked picker over the active library, searchable across meal-time and led by the dishes whose meal-time matches the slot, so a breakfast dish can land in a lunch slot), add a library dish to a day, drop in a custom dish (a free-text dish not in the library) in place of a position or as an extra dish on the day, delete a dish, or skip a whole day (eating out or away) and restore it later. Swaps, adds, custom dishes, deletes, skips, restores, and saves-for-next-week apply immediately and are recorded against the week with author, timestamp, and a required reason that feeds the slow loop. A skipped day keeps its dishes (restore is lossless) but counts no groceries and does not enter the history on finalize. A dislike does nothing immediately; it queues for the slow loop. The day editor also offers a day-level comment: a free-text note about the day that changes nothing in the week and queues for the slow-loop review. A comment carries no required reason (the note text is itself the content) and, like a dislike, records without applying (Principle 5).

The Explore tab is a separate surface for browsing dishes the household has not cooked yet (see §3 item 5). The Changes tab is the week's running record of every edit and comment (see §3 item 6).

## 3. What Plantry produces

1. **Shared current-week view (Menu tab).** A read-only-by-default page both phones see. A header carries the Plantry wordmark, the week's date range, and the identity avatar, over six day cards (Mon to Sat) showing breakfast and lunch dishes with a photo or a quiet no-photo fallback, a plain-language complexity marker per dish, pre-prep markers where a dish needs day-before work, and a date badge per day. A day before today collapses to a compact row (its date, a short glance of its dishes, and a View action that opens the same day editor as Edit); today and the days ahead stay open, so attention lands on the present. A skipped day renders as "Skipped". The week's edit count lives on the Changes tab, not on the Menu. Editing is entered per day from the day's Edit button.

2. **Grocery list (Grocery tab).** The household chooses which upcoming days to order for (a shopping run covers the next day or two, not the whole week), and the list totals exactly those days. A day chooser sits above the list with a sensible default off the device clock: before 11 AM it pre-selects today and tomorrow; from 11 AM on it rolls forward to tomorrow and the day after (the day's own run is assumed done). Once either user changes the selection it sticks across leaving the tab and backgrounding the app, so an in-progress shop is not lost; a new week resets to the time-aware default. The list groups in fixed order: Proteins and Dairy, then Fruit, then Vegetables, then Aromatics and Herbs, then Pantry (last). There is no catch-all section; an ingredient with no explicit group falls to Pantry. Quantities aggregate across the selected days' dishes. Tracked ingredients (those with a declared pack size) are rounded up to the next pack multiple. Common pantry staples (flour, oil, salt, common spices, base rice) are omitted unless a dish explicitly lists them. A skipped day contributes nothing even if selected.

3. **Share image family.** The shareable output is a set of images sent together, not one PNG: a menu image (a compact single-column ledger, one row per day with the day and date badge alongside its meals; a skipped day shows as "Skipped") and one recipe sheet per dish marked "include recipe when sharing" that week (de-duplicated by dish, degrading gracefully where cook fields are incomplete). No internal labels (no "Menu 3", no "weekend", no ingredient-reuse callouts). Calm, kitchen-friendly, on a warm cream card. The images render on the phone, from the same components the on-screen preview uses, and go out through the native share sheet, so they land in WhatsApp at week-start. The family is a pure function of the cached week and the baked library, so sharing works offline (no backend call in the share path). When file-sharing is unavailable, the fallback downloads every image so the user can attach them by hand. This is the "locked in" output.

4. **Explore feed (Explore tab).** A browse surface ranking the dishes the household has not cooked yet, "familiar but new": novelty that still resembles what the household actually cooks. A nested filter narrows the grid: Easy to cook and Healthy as quick toggles, plus Cuisines and Meal time as multi-select sub-panels (each option shows its dish count, with an Apply button). Filters combine across dimensions and union within a dimension. Dishes already on this week's plan or already saved for next week are hidden, so everything on Explore is genuinely new on the plate. Tapping a dish opens its detail sheet with the recipe visible plus a plain "why it fits" line (no internal labels). From the sheet the user can use the dish this week (pick a day, which adds it like any library dish), save it for next week (which the next generation favors), or dislike it. A dislike records a signal for the slow loop and does nothing in-session: it neither re-ranks Explore nor hides the dish (Principle 5). The reason on a dislike is optional.

5. **Changes feed (Changes tab).** A newest-first record of the week: every menu edit (swap, add, custom dish, delete, skip, restore, save-for-next-week) and every comment, each with its author, timestamp, a plain-language headline, and the quoted reason or comment text. The tab subtitle and a badge on the Changes nav icon show the count of this week's edits; comments are feedback, not edits, so they are not counted. Dish ids resolve to names; no internal label or enum value reaches the screen.

6. **History update.** On finalize, the week's cooked dishes append to the historical record, which drives the no-repeat (recency) logic on subsequent weeks. Skipped days and custom dishes are excluded: a skipped day was not cooked, and a custom dish has no library id, so recency must not see either.

## 4. Principles

These are decision rules. Every change to Plantry (engineer pull request, slow-loop proposal, EM autonomous call) is judged against them.

1. **Right-size the fix.** Before any change lands, state the size of the problem (one-off, small pattern, structural), the smallest level it can be solved at (data row, new tag, rule wording, engine code, UI affordance, infrastructure), and whether the proposed fix generalizes. A single-row data fix beats a new column; a new tag beats a new cross-cutting rule; a UI affordance beats a new rule altogether. Do not generalize from one or two cases.
2. **Solve structurally, not by name.** When a special case appears, identify the property that makes it special and encode that property. Tag presence is preferred over dish-name matching.
3. **Spec and code stay in lockstep.** `docs/engine.md` is the human-readable rules spec; `engine/` is its executable form. Any change to one without the other is a continuous-integration failure.
4. **Two loops, never one.** The fast loop is operational and immediate (swap, add, custom dish, delete, skip, save, dislike). The slow loop is structural and human-approved (library, rules, engine). The fast loop never silently mutates the rules. It does not block a §3-incompatible pick either: the swap picker is generic over the whole active library, so a user can land a cross-meal dish (a breakfast dish in a lunch slot) on purpose; the resulting composition mismatch is deliberate signal the slow loop reads, not an error the fast loop refuses. The only hard guards a meal swap keeps are Active, in-season, and not-Fruit (the fruit slot stays category-locked); meal-time is an ordering signal, not a pool filter.
5. **Record, do not apply.** Feedback that implies structural change is queued, not applied. A dislike records a signal; the slow loop is the only path by which structure changes.
6. **Non-sycophantic feedback handling.** When feedback arrives, diagnose size and level before proposing a fix. "No change warranted" is a valid output, with a stated reason. Agreeable acceptance of every request is a failure mode.
7. **Decouple display from structure.** Internal labels (Option A/B/C, Menu 1/2/3/4, tag names, affinity keys) never leak to the user-facing output.
8. **Simplicity over flexibility.** Three similar rows beat a premature abstraction. A column earns its place by changing outputs.
9. **Reversibility first.** Fast-loop actions are easily undone. Slow-loop actions are not, so they always pass through human approval.

## 5. Tone

The user-facing output is plain, readable, and uncluttered. No internal jargon, no rule citations, no labels users do not need. Prose in any doc Rajat reads (specs, decision log, PR descriptions, EM status updates) avoids em dashes and long dashes; uses commas, parentheses, semicolons, or sentence breaks. Brief is preferred to long; complete sentences are preferred to fragments.

## 6. Scope

- Four tabs: Menu, Grocery, Explore, Changes.
- Six day cards (Mon to Sat) with breakfast and lunch, photos or a no-photo fallback, and complexity and pre-prep markers; past days collapse to a compact row with a View action while today and the days ahead stay open. The Menu leads with the Plantry wordmark and the week's date range; the week's edit count shows on the Changes tab.
- Dish swap with a generic ranked picker over the active library (every Active, in-season dish, searchable across meal-time; the default view leads with dishes whose meal-time matches the slot); required reason.
- Add a library dish to any day; required reason.
- Custom dish entry on any day: a free-text dish not in the library, either replacing a position or appended as an extra dish; required reason.
- Dish delete from any day (the day may then hold fewer dishes than its usual shape); required reason.
- Day skip and restore (eating out or away); the day's dishes are kept so restore is lossless; required reason.
- Save a dish for next week from Explore; the next generation favors it; required reason.
- Explore browse with familiar-but-new ranking, a nested filter (Easy to cook and Healthy toggles plus multi-select Cuisines and Meal time), and a records-only dislike (optional reason) read only by the slow loop.
- Day-level comment entry from the day editor: a free-text note that applies nothing in-week and queues for the slow loop (record-only, no required reason); it appears in the Changes feed (§3 item 5).
- The grocery list, grouped (Proteins and Dairy, Fruit, Vegetables, Aromatics and Herbs, Pantry last, no catch-all), day-selected with a time-aware default, and skip-aware, plus the share image family (menu, recipe sheets) over the native share sheet.
- A library of roughly 260 dishes across roughly ten cuisines (Indian baseline plus international and world cuisines), spanning vegetarian, egg, dairy, seafood, and red-meat (mutton) proteins, each carrying a first-class cuisine, a description, a recipe, complexity, derived macros (including a derived Healthy flag), and special-sourcing metadata.
- Identity is light: a device-stored "I am Rajat" or "I am Tuhina" profile attributes edits; a shared passcode keeps the URL private. No accounts.

## 7. Out of scope

- Further day-level overrides beyond skip and restore (swap two days, mark a day eating-out ahead of the week). Designed for so they slot in cleanly later; not built. Skipping and restoring a day is in scope.
- Calendar awareness (read a shared calendar; mark days unavailable upfront).
- Per-user dietary variants.
- Multi-household support.

## 8. Future scope

- **Day-level overrides.** Solves an estimated 80 percent of weekly disruptions (travel, eating out, day swaps) beyond the skip-and-restore that ships today. Data model and UI are designed to accept these without restructuring.
- **Photo coverage.** Every active dish carries a description, recipe, complexity, derived macros, and a photo. A committed style spec (`data/dish-photos/STYLE.md`) plus a per-dish detail map fix the look so photos generated months apart match, and a build-time generation tool produces them from it (`docs/engineering.md` §4). The no-photo fallback stays the graceful default for any new dish added before its photo lands, keeping a gap intentional rather than broken; the generation tool fills it in the same content batch that adds the dish.
- **Swiggy MCP integration (ordering automation).** A future Convex action consumes the engine's structured grocery list and builds a Swiggy cart via the Swiggy MCP, returning a deep link the user opens to checkout. Four design invariants protect this path:
  1. Ingredient names are canonical and machine-resolvable (one name per ingredient, no spelling drift, no inline qualifiers like "(200g)"), enforced by a blocking name-resolution validator.
  2. The grocery list is available as structured data via a dedicated query, not parsed from markdown.
  3. Pack sizes live in a machine-readable column on the ingredient catalog, distinct from per-dish quantity rows.
  4. A special-sourcing flag on the ingredient catalog already marks which ingredients need a supermarket or specialty-store run; a per-dish report surfaces which dishes that affects. This is the first of the additive sourcing fields the catalog anticipates.
     Brand preference and substitution policy are future additive fields, not current columns. No SKU or store-specific identifier ever lives in the canonical data.
- **Calendar awareness.** Generator plans around stated absences upfront, removing the need for after-the-fact day overrides.
- **Variance analysis.** Once a few months of history accumulates with author attribution, surface patterns like "paneer appears in 70 percent of weeks because Rajat or Tuhina keep voting it in".

## 9. Glossary

- **PWA, Progressive Web App.** A website built so a phone can install it to the home screen and run it full-screen like a native app, with the page cached for instant, offline-tolerant loads. Avoids the app stores; one web codebase serves both phones.
- **Slow loop and fast loop.** The fast loop is what happens this week (swap, add, custom dish, delete, skip, save, dislike), applied immediately to one week. The slow loop is how the system itself evolves (library, rules, engine code), applied via a human-approved pull request.
- **Structural vs operational.** Operational changes are local to one week and reversible. Structural changes touch the library or the rules and affect every future menu, so they pass through review.
- **Familiar but new.** The Explore ranking idea: surface dishes the household has not cooked, ranked by how much they resemble what it does cook (shared key ingredients, usual protein range, common categories), so novelty still fits the household's habits.
- **MCP, Model Context Protocol.** An open standard for letting a language model call external tools through a uniform interface. A Swiggy MCP would expose Swiggy's catalog and cart actions as MCP tools the engine could call.
