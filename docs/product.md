# Product

Plantry is a weekly meal planner for a two-adult Indian household in Bangalore. Each week it produces a Monday-to-Saturday menu of breakfasts and lunches from a fixed dish library, following the composition and selection rules in `docs/engine.md`, then a shareable image family and a grocery list. Sunday is a rest day. The system runs as a small Progressive Web App (PWA) installed on both phones, organised as four tabs (Menu, Grocery, Explore, Yours), with two slow workflows behind it: a maintenance sitting that keeps the data and the documents true, and an engine evolution that re-derives the rules from what the household actually ate. Both land as human-approved pull requests.

## 1. Persona and household

Two adults: Rajat (product owner) and Tuhina (second user). Cooking style is high-protein and lean, with a strong vegetarian baseline and frequent paneer, eggs, chicken, fish, and prawns. Seasonality matters: ingredients shift across Bangalore's three seasons (Summer March to May, Monsoon June to September, Winter October to February). Both users hold equal control of the week: either can swap a dish, add a dish, drop in a custom dish, delete a dish, skip a day, mark a favorite, save a dish to the wishlist, or dislike a dish in Explore. Every edit carries the name of whoever made it, and nothing either person does needs the other's approval.

## 2. Weekly loop

| Day        | Fruit   | Breakfast    | Lunch                     | Item ceiling |
| ---------- | ------- | ------------ | ------------------------- | ------------ |
| Mon to Fri | 1 fruit | 1 or 2 items | 2 or 3 items              | 5            |
| Sat        | 1 fruit | none         | 2 or 3 items, treat shape | 3            |
| Sun        | none    | none         | none                      | 0            |

Every day Mon to Sat carries a Fruit of the day: one in-season fruit, shown as its own light section separate from breakfast and lunch (Saturday included, even though it has no breakfast). Breakfast is savoury. The fruit sits outside the breakfast and lunch slots and outside the item cap, so the "Item ceiling" column (the capped breakfast plus lunch count) is unchanged by it. Saturday is the week's indulgence: its lunch is a treat main with a dessert beside it and at most one accompaniment. The counts are ceilings, never targets. A lighter day is a good day, and the day-by-day shapes live in `docs/engine.md` §5.

Each week the engine reads the dish library, the rules, the season, the household's favorites, and the household record (every week the household has been served, counted as it was actually eaten), then produces a complete valid menu. The record is the target rather than one input among many: the engine proposes the dishes the household already eats, at the frequencies the record shows, with one exploration pick a week as the bounded channel for something new (`docs/engine.md` §2 and §7). Generation is triggered by hand from the backend; there is no scheduler.

The week opens on the Menu tab. From a day's Edit button either user can:

- **Swap a dish.** The picker ranks every Active, in-season dish in the library, searchable across meal-time and led by the dishes whose meal-time matches the slot, so a breakfast dish can land in a lunch slot on purpose. The fruit slot's picker offers only fruit.
- **Add a library dish to the day.** The dish lands in the meal its own meal-time names (a breakfast dish in the day's breakfast, a lunch dish in its lunch), so an add is never cross-meal. Nothing in the fruit slot is added to.
- **Drop in a custom dish.** A free-text dish not in the library, either replacing a position through the picker or appended as an extra dish on the day.
- **Delete a dish.** The day may then hold fewer dishes than its usual shape.
- **Skip the day, and restore it later.** Eating out or away. The day's dishes are kept, so restore is lossless; a skipped day counts no groceries and contributes nothing to the record.
- **Mark a dish as a favorite, or remove it**, from the dish's action sheet.
- **Include a dish's recipe when sharing**, from the dish's detail sheet.

Swaps, adds, custom dishes, deletes, skips, and restores apply immediately and are recorded against the week with author, timestamp, and an optional reason that feeds the slow loop when one is given. Marking a favorite and toggling a recipe for sharing change standing state rather than the week's menu, so neither is a recorded edit. A dislike does nothing immediately; it queues for the slow loop (Principle 5).

The Explore tab is a separate surface for browsing dishes the household has not cooked yet (§3 item 4). The Yours tab holds the household's two shared lists, favorites and the wishlist (§3 item 5). The week's running record of every edit is the Changes log, reached from the profile sheet (§3 item 6).

## 3. What Plantry produces

1. **Shared current-week view (Menu tab).** A read-only-by-default page both phones see. The header carries the Plantry wordmark with the week's full-month date range beneath it, and the identity avatar, over six day cards (Mon to Sat) showing breakfast and lunch dishes with a photo or a quiet no-photo fallback, a plain-language complexity marker per dish, pre-prep markers where a dish needs day-before work, and a date badge per day. A day before today collapses to a compact row (its date, a short glance of its dishes, and a View action that opens the same day editor as Edit); today and the days ahead stay open, so attention lands on the present. A skipped day renders as "Skipped". The avatar carries an unread-changes badge (edits by the other person the viewer has not yet looked at) and opens the profile sheet, which names who is editing, offers a switch to the other identity, and shows the week's edit count as the row into the Changes log. Editing is entered per day from the day's Edit button. A "Share this week" button below the cards opens the share preview. When the backend is unreachable the page shows the last week saved on the phone, under a banner that says so.

2. **Grocery list (Grocery tab).** The household chooses which upcoming days to order for (a shopping run covers the next day or two, not the whole week), and the list totals exactly those days. A day chooser sits above the list with a sensible default off the device clock: before 11 AM it pre-selects today and tomorrow; from 11 AM on it rolls forward to tomorrow and the day after (the day's own run is assumed done). Once either user changes the selection it sticks across leaving the tab and backgrounding the app, so an in-progress shop is not lost; a new week resets to the time-aware default, and a selected day that has since passed or been skipped drops out. The list groups in fixed order: Proteins and Dairy, then Fruit, then Vegetables, then Aromatics and Herbs, then Pantry (last). There is no catch-all section; an ingredient with no explicit group falls to Pantry. Quantities aggregate across the selected days' dishes. Tracked ingredients (those with a declared pack size) show a pack count rounded up to the next whole pack. Common pantry staples (flour, oil, salt, common spices, base rice) are omitted unless a dish explicitly lists them. A skipped day contributes nothing even if selected. The grocery list is an in-app surface only; it is not part of the share family.

3. **Share image family.** The shareable output is a set of images sent together, not one PNG: a menu image (a compact single-column ledger, one row per day with the day and date badge alongside its meals; a skipped day shows as "Skipped") and one recipe sheet per dish marked "include recipe when sharing" that week (de-duplicated by dish, degrading gracefully where cook fields are incomplete). No internal labels (no "Menu 3", no "weekend", no ingredient-reuse callouts). Calm, kitchen-friendly, on a warm cream card. The images render on the phone, from the same components the on-screen preview uses, and go out through the native share sheet, so they land in WhatsApp at week-start. The family is a pure function of the cached week and the baked library, so sharing works offline (no backend call in the share path). When file-sharing is unavailable, the fallback downloads every image so the user can attach them by hand. This is the "locked in" output.

4. **Explore feed (Explore tab).** A browse surface ranking the dishes the household has not cooked yet, "familiar but new": novelty that still resembles what the household actually cooks. A nested filter narrows the grid: Easy to cook as a quick toggle, plus Cuisines and Meal time as multi-select sub-panels (each option shows its dish count, with an Apply button). A Healthy toggle is visible but disabled, labelled "Healthy (under review)", until the library carries complete recipe nutrition (§8). Filters combine across dimensions and union within a dimension. Dishes already on this week's plan are hidden, so everything on Explore is genuinely new on the plate; a dish on the wishlist stays visible. Each card carries a heart that adds the dish to the wishlist or removes it in one tap. Tapping a card opens its detail sheet with the recipe visible plus a plain "why it fits" line (no internal labels). From the sheet the user can use the dish this week (pick a day; the dish lands in the meal its meal-time names, like any library add), add it to the household wishlist, or mark it "Not for me". A dislike records a signal for the slow loop and does nothing in-session: it neither re-ranks Explore nor hides the dish (Principle 5). The reason on a dislike is optional.

5. **Shared lists (Yours tab).** Two lists both users read and write, each row attributed to whoever added it and removable by either person. **Favorites** are the dishes the household wants in rotation; generation guarantees each one a place in every week. A favorite is added from the tab's "Add a favorite" sheet (search the library, or add the typed name as a free-text favorite) or from a dish's action sheet in the day editor. A free-text favorite has no library dish behind it, so it is a display-only reminder that generation cannot place. **The wishlist** is a shared "save it to try" list of library dishes, filled from Explore; each row carries a Use action that places it into the week through the same day picker Explore uses, and placing it leaves it on the list. The wishlist never feeds generation: it is a list the household reads, not a queue the engine consumes. A badge on the Yours tab icon carries the wishlist count.

6. **Changes log (profile sheet).** A newest-first record of the week: every menu edit (swap, add, custom dish, delete, skip, restore), each with its author, timestamp, a plain-language headline, and the quoted reason when one was given. It is reached from the identity avatar on the Menu header, which carries the unread badge and opens the profile sheet; opening the log marks the week's edits as seen for that identity on that phone. Dish ids resolve to names; no internal label or enum value reaches the screen.

7. **The household record.** Every week the household has been served, counted as it was eaten, is the record the next week is generated from (`docs/engine.md` §2). A hand edit therefore teaches the engine directly: a swapped-in dish counts and a swapped-out one does not. A skipped day contributes nothing, because it was not cooked, and a free-text custom dish contributes nothing until the dish it names becomes a library dish and the slot is re-pointed at it. Finalizing a week also files an archived copy of it, kept as provenance rather than as signal.

## 4. Principles

These are decision rules. Every change to Plantry (engineer pull request, maintenance or evolution proposal, EM autonomous call) is judged against them.

1. **Right-size the fix.** Before any change lands, state the size of the problem (one-off, small pattern, structural), the smallest level it can be solved at (data row, new tag, rule wording, engine code, UI affordance, infrastructure), and whether the proposed fix generalizes. A single-row data fix beats a new column; a new tag beats a new cross-cutting rule; a UI affordance beats a new rule altogether. Do not generalize from one or two cases.
2. **Solve structurally, not by name.** When a special case appears, identify the property that makes it special and encode that property. Tag presence is preferred over dish-name matching.
3. **Spec and code stay in lockstep.** `docs/engine.md` is the human-readable rules spec; `engine/` is its executable form. A change to one lands with the matching change to the other in the same pull request. The pairing is held by review, not by a CI check (`docs/engine.md` §16.2).
4. **Two loops, never one.** The fast loop is operational and immediate (swap, add, custom dish, delete, skip, favorite, wishlist, dislike). The slow loop is structural and human-approved (library, rules, engine). The fast loop never silently mutates the rules. It does not block a composition-incompatible pick either: the swap picker is generic over the whole active library, so a user can land a cross-meal dish (a breakfast dish in a lunch slot) on purpose, and the resulting composition mismatch is deliberate signal the slow loop reads, not an error the fast loop refuses. The only hard guards a meal swap keeps are Active, in-season, and not-Fruit (the fruit slot stays category-locked); meal-time is an ordering signal, not a pool filter. An add is the one meal-time-strict edit, because the meal it lands in is chosen from the dish rather than by the user.
5. **Record, do not apply.** Feedback that implies structural change is queued, not applied. A dislike records a signal; a swap reason is read at the next maintenance sitting; the slow loop is the only path by which structure changes.
6. **Non-sycophantic feedback handling.** When feedback arrives, diagnose size and level before proposing a fix. "No change warranted" is a valid output, with a stated reason. Agreeable acceptance of every request is a failure mode.
7. **Decouple display from structure.** Internal labels (tag names, category names, affinity keys, threshold names) never leak to the user-facing output.
8. **Simplicity over flexibility.** Three similar rows beat a premature abstraction. A column earns its place by changing outputs.
9. **Reversibility first.** Fast-loop actions are easily undone. Slow-loop actions are not, so they always pass through human approval.

## 5. Tone

The user-facing output is plain, readable, and uncluttered. No internal jargon, no rule citations, no labels users do not need. Prose in any doc Rajat reads (specs, decision log, PR descriptions, EM status updates) avoids em dashes and long dashes; uses commas, parentheses, semicolons, or sentence breaks. Brief is preferred to long; complete sentences are preferred to fragments.

## 6. Scope

- Four tabs: Menu, Grocery, Explore, Yours.
- Six day cards (Mon to Sat) with breakfast and lunch, a Fruit of the day, photos or a no-photo fallback, and complexity and pre-prep markers; past days collapse to a compact row with a View action while today and the days ahead stay open. The Menu leads with the Plantry wordmark and the week's date range; the identity avatar carries the unread-changes badge and opens the profile sheet, which holds the identity switch, the week's edit count, and the Changes log.
- Dish swap with a generic ranked picker over the active library (every Active, in-season dish, searchable across meal-time; the default view leads with dishes whose meal-time matches the slot; the fruit slot offers only fruit); optional reason.
- Add a library dish to any day, landing in the meal its meal-time names; optional reason.
- Custom dish entry on any day: a free-text dish not in the library, either replacing a position or appended as an extra dish; optional reason.
- Dish delete from any day (the day may then hold fewer dishes than its usual shape); optional reason.
- Day skip and restore (eating out or away); the day's dishes are kept so restore is lossless; optional reason.
- Two shared lists on the Yours tab: favorites, which generation guarantees a place in every week (a favorite may be a free-text name, which is display-only), and a wishlist of library dishes to try, placeable into the week and never read by generation. Either user adds and removes either person's rows.
- Explore browse with familiar-but-new ranking, a nested filter (an Easy to cook toggle, a disabled Healthy toggle held under review, and multi-select Cuisines and Meal time panels), a one-tap wishlist heart, and a records-only dislike (optional reason) read only by the slow loop.
- The grocery list, grouped (Proteins and Dairy, Fruit, Vegetables, Aromatics and Herbs, Pantry last, no catch-all), day-selected with a time-aware default, and skip-aware.
- The share image family (menu image and recipe sheets) over the native share sheet, from a "Share this week" preview.
- A library of about 260 active dishes across thirteen cuisines (Indian baseline plus international and world cuisines), spanning vegetarian, egg, dairy, seafood, and red-meat (mutton) proteins, each carrying a first-class cuisine, a description, a recipe, a complexity marker, a photo, partial tracked-ingredient macro estimates, and special-sourcing metadata. Every active dish has a photo; the no-photo fallback stays the graceful default for a dish added before its photo lands.
- Identity is light: a device-stored "I am Rajat" or "I am Tuhina" profile attributes edits; a shared six-digit passcode keeps the URL private and is remembered on the phone for seven days. No accounts.
- Offline tolerance: the app shell installs to the home screen, and the last week saved on the phone renders when the backend is unreachable.

## 7. Out of scope

- Further day-level overrides beyond skip and restore (swap two days, mark a day eating-out ahead of the week). Designed for so they slot in cleanly later; not built.
- Calendar awareness (read a shared calendar; mark days unavailable upfront).
- Per-user dietary variants.
- Multi-household support.
- A grocery share image; the grocery list is an in-app surface.
- Scheduled generation; each week is generated by hand from the backend.

## 8. Future scope

- **Day-level overrides.** Solves an estimated 80 percent of weekly disruptions (travel, eating out, day swaps) beyond the skip-and-restore that ships today. Data model and UI are designed to accept these without restructuring.
- **Complete recipe nutrition and the Healthy filter.** Dish macros are derived from tracked grocery ingredients only, so they are partial and cannot honestly classify a dish as Healthy (`docs/engine.md` §12). The Healthy toggle on Explore stays visible and disabled until recipes carry complete, quantified inputs including pantry staples; the filter then returns without a UI change.
- **Swiggy MCP integration (ordering automation).** A future Convex action consumes the engine's structured grocery list and builds a Swiggy cart via the Swiggy MCP. Four design invariants protect this path:
  1. Ingredient names are canonical and machine-resolvable (one name per ingredient, no spelling drift, no inline qualifiers like "(200g)"), enforced by a blocking name-resolution validator.
  2. The grocery list is available as structured data via a dedicated query, not parsed from markdown.
  3. Pack sizes live in a machine-readable column on the ingredient catalog, distinct from per-dish quantity rows.
  4. A special-sourcing flag on the ingredient catalog marks which ingredients need a supermarket or specialty-store run; a per-dish report surfaces which dishes that affects. This is the first of the additive sourcing fields the catalog anticipates.
     Brand preference and substitution policy are future additive fields, not current columns. No SKU or store-specific identifier ever lives in the canonical data. The real Swiggy MCP is invite-only and cash-on-delivery with no app hand-off link, so the viable shape is build-the-cart-then-open-the-app rather than a checkout deep link (`docs/engineering.md` §13).
- **Calendar awareness.** Generator plans around stated absences upfront, removing the need for after-the-fact day overrides.
- **Variance analysis.** Once a few months of history accumulates with author attribution, surface patterns like "paneer appears in 70 percent of weeks because Rajat or Tuhina keep voting it in". The monthly engine monitor in the maintenance sitting (`MAINTENANCE.md` §4.2) is the first step on this path.

## 9. Glossary

- **PWA, Progressive Web App.** A website built so a phone can install it to the home screen and run it full-screen like a native app, with the page cached for instant, offline-tolerant loads. Avoids the app stores; one web codebase serves both phones.
- **Slow loop and fast loop.** The fast loop is what happens this week (swap, add, custom dish, delete, skip, favorite, wishlist, dislike), applied immediately to one week or to a standing list. The slow loop is how the system itself evolves (library, rules, engine code), applied via a human-approved pull request through the two slow workflows, `/maintain` (`MAINTENANCE.md`) and `/evolve-engine` (`EVOLVING-THE-ENGINE.md`).
- **Structural vs operational.** Operational changes are local to one week and reversible. Structural changes touch the library or the rules and affect every future menu, so they pass through review.
- **The household record.** Every served week, counted as it was eaten: swaps applied, skipped days excluded. The engine reproduces its frequencies; it is the target, not an input among many.
- **Familiar but new.** The Explore ranking idea: surface dishes the household has not cooked, ranked by how much they resemble what it does cook (shared key ingredients, usual protein range, common categories), so novelty still fits the household's habits.
- **Exploration pick.** The one never-eaten dish generation places each week, into a weekday lunch, as the bounded door for novelty.
- **MCP, Model Context Protocol.** An open standard for letting a language model call external tools through a uniform interface. A Swiggy MCP exposes Swiggy's catalog and cart actions as MCP tools the ordering automation could call.
