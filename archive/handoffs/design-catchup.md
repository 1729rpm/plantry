# Plantry — design catch-up for Claude Design

> **ARCHIVED 2026-06-17.** This was the correction layer that bridged the stale first `design_handoff/` (see `archive/handoffs/design_handoff/`) to the live app, listing everything that shipped after that handoff. It is now superseded: the `features/UI Improvements/` handoff was commissioned level with the live app and folds this catch-up in, so there is no longer a stale baseline to correct. Moved to `archive/handoffs/` with the handoff it accompanied. Kept for history only; do not read for current truth.

## Why this file exists

`design_handoff/` is the first and only design handoff. It was packaged on 2026-06-11 and is now roughly two dozen shipped features behind the live app. Its own README already says so. Treat the handoff folder as the **style anchor** (direction, tokens, component voice) but **not** as a current screen inventory.

Attach this file to the next commission alongside `docs/product.md`, `claude-design.md`, and the `design_handoff/` folder. It is the correction layer: everything below shipped after the handoff and changes what the app actually looks like and does today. Where this file and the handoff disagree, this file wins.

The freshest visual truth, ahead of even this doc, is the live app itself: the CSS-variable tokens in `app/web/src/index.css`, the components in `app/web/src/`, and the current screenshots in `docs/screenshots/` (embedded in section H below). The product scope is current in `docs/product.md` (rewritten 2026-06-17); read it as authoritative for behaviour. This file translates that into "here is what moved on the design surface, and why."

Conventions unchanged since the handoff: four tabs (Menu, Grocery, Explore, Changes), warm cream surfaces with a terracotta accent and serif dish names, editing entered from a day card's Edit button, every fast-loop action carrying author plus timestamp plus a required reason. Those still hold. The rest of this doc is the delta.

---

## A. Net-new surface: Fruit of the day

This is the largest single change and it is not in the handoff at all.

- **What it is.** Every day Monday to Saturday now carries one "Fruit of the day": a single in-season fruit, shown as its own light section, separate from breakfast and lunch. Saturday has it too, even though Saturday has no breakfast. The fruit sits outside the breakfast and lunch slots and outside the per-day item cap.
- **Breakfast is now savoury-only.** Fruit used to ride along inside breakfast; it was pulled out into its own section. So the Monday/Wednesday/Friday two-item breakfast is now two savoury items, not a savoury item plus a fruit.
- **Where it shows.** A "Fruit of the day" section on each Menu day card; the same section in the day editor, positioned after Lunch; and a "Fruit of the day" block in the menu share image.
- **It is swappable.** In the day editor the fruit row is tappable and swappable like any breakfast or lunch dish, but the fruit slot is category-locked: only another fruit can land there. Fruit has no add, no delete, and no custom one-off (swap only, one fruit per day).
- **Design ask.** The handoff has no fruit section anywhere. The next handoff needs the fruit section designed as a first-class, lightweight row on the day card, in the day editor, and in the share image, visually quieter than a breakfast or lunch dish.

---

## B. Changed surfaces

### B1. Explore filter is now a nested filter, not a flat chip row

The handoff Explore has a flat wrapped row of filter chips. That is replaced.

- A single compact horizontal row holds two quick toggles, **Easy to cook** and **Healthy**, plus two entries, **Cuisines** and **Meal time**, that open multi-select sub-panels.
- Each sub-panel option shows its dish count and has an **Apply** button.
- Filters combine with AND across dimensions and OR within a dimension.
- Cuisine became a real first-class field on every dish (see E1), so the Cuisines panel spans roughly ten cuisines now, not a handful.

### B2. Explore cards show a multi-tag pill set

Handoff cards carry one verbose complexity pill. Live cards carry an ordered wrapping pill set: a concise colored difficulty pill first (Easy / Medium / Hard), then a prep-time pill where prep time exists, then one descriptor pill (for example High protein, Complete meal, a cuisine, or Filling), capped at two lines. Cards with no tags degrade gracefully and never show an empty pill.

### B3. The two pickers (Add a dish, Replace) are now one generic search over the whole library

This is a meaningful behavioural and layout change from the handoff's "ranked picker that fits the day first."

- **Both pickers search the entire active library**, across meal-time. A breakfast dish like Pav is reachable from a lunch slot, and the resulting composition mismatch is deliberate signal for the slow loop, not a blocked action. The default view still leads with dishes whose meal-time matches the slot; the rest stay reachable by search.
- **Add drops its Breakfast/Lunch selector.** A chosen dish routes to the slot its own meal-time names.
- **Dynamic, result-driven filter pills.** Below the search bar sits a single filter row whose pills (Breakfast, Lunch, Easy to cook, Healthy) appear only when the current results actually contain a matching dish, and reset when the search text changes. The Fruit slot keeps quality-only pills (Easy to cook, Healthy).
- **Picker panel holds a stable height** while searching; the header (title, search field, filters) stays pinned and the results list scrolls inside.
- **Picker rows dropped the duplicate complexity pill.** Complexity already appears in the row's subtitle meta line, so the trailing pill was removed to give dish names more width. This is a deliberate divergence from the handoff, which shows the pill (see F).
- **Replace shows the picked dish's details first.** Choosing a library dish opens its detail body with a primary "Replace dish" action and an optional reason, rather than swapping immediately.

### B4. Comment entry is removed from the UI

The handoff puts commenting inside the dish details sheet. Both the dish-level and day-level comment-entry affordances were removed from the app. The Changes tab still renders historical comments, and the queued-comments backend is untouched, but there is no way to enter a new comment from the UI today. Do not design a comment-entry control back in unless the operator asks for it.

### B5. Share image is canvas-rendered and the family is current

The menu share image is now drawn on an HTML canvas (a measured layout pass, then a draw pass) rather than rasterized from DOM, which fixed an iOS Safari text-overlap bug. The on-screen preview and the exported PNG come from the same canvas, so they cannot drift. The grocery and recipe sheets still rasterize from their React components. The share output is the multi-image family (menu, grocery, one recipe sheet per dish marked "include recipe when sharing"), delivered through the native share sheet with a download-all fallback, previewed as a horizontal swipe rail. The menu share image now also carries the Fruit of the day block (A).

### B6. Bottom nav has distinct per-tab line icons

The handoff TabBar uses a single placeholder dot for every tab. Live tabs each have a minimal line icon: Menu (calendar), Grocery (basket), Explore (compass), Changes (swap arrows). Icons inherit the active terracotta or inactive muted color. This was a deliberate step beyond the handoff.

### B7. Unified Back / history navigation

The browser and Android hardware Back gesture now unwinds the user's real visit order across the whole app (tab switches, the day editor, bottom sheets share one history controller). Back from the homepage (Menu tab, no day open) is gated behind a "Leave Plantry?" confirm sheet. If the next feature adds new navigable surfaces or sheets, they should slot into this one back-stack model.

### B8. "Include recipe when sharing" toggle placement

This per-dish toggle is surfaced at the page level of the Menu dish-details sheet, and deliberately left off the Explore detail sheet (an unplaced Explore dish has no week slot to write the preference to).

### B9. Smaller surface tweaks worth honouring

- Identity (welcome) screen title is "Please select the user"; the per-tile "Stored on this phone only" sub-line was dropped, so a tile shows just the avatar and "I am Rajat" / "I am Tuhina".
- Explore tab subtitle count reflects the filtered count, not the full feed.
- Explore cards top-align photo and title in stretched rows.
- An offline banner appears only when the device is genuinely offline (it no longer flashes on normal online opens).
- Passcode gate is six digits (six dots, auto-submit at the sixth), not four.

---

## C. Explore dislike ("Not for me")

The handoff does not describe a dislike. Live Explore has a "Not for me" affordance on the dish sheet that records a slow-loop signal and does nothing in-session: it neither re-ranks Explore nor hides the dish. Reason is optional there. It reads as tappable (dashed underline, large tap target). Keep it record-only in any redesign; an immediate effect would violate product Principle 5.

---

## D. Visual language and assets

### D1. Real dish photos exist now (the biggest asset change)

The handoff ships Wikimedia Commons placeholder photos flagged "replace before shipping." That replacement happened. Every active dish (roughly 260 of them) now carries an AI-generated photo from a committed style spec (`data/dish-photos/STYLE.md`), generated with FLUX.1-dev. The agreed look is candid home-style realism: a natural angle (low or three-quarter, not flat overhead), shallow depth of field, a real everyday vessel (steel katori or thali, karahi, cast-iron pan, plain home plate), a softly out-of-focus home background, ordinary warm light, honest muted color, matte not glossy. When the next handoff needs reference imagery, the live `data/dish-photos/*.jpg` set is the truth, not the handoff's `assets/dishes/`.

The no-photo fallback (a quiet diagonal-stripe `Thumb` placeholder) still exists as the graceful default for any future dish added before its photo lands.

### D2. Photo crop ratios are fixed by aspect-ratio, not pixel height

A crop bug on narrow phones (a pale rim band above the food) was fixed by switching photo containers from fixed pixel height to aspect-ratio. Explore card photos crop at 16:9; the dish detail-sheet hero crops at 5:2 (about 2.5:1). Any new photo surface should specify an aspect ratio, not a fixed height against a fluid width, and should be checked at a real narrow phone width.

### D3. Tokens

The handoff `hifi-tokens.jsx` values were ported into `app/web/src/index.css` as CSS variables and are the live token source now. Anchor new work on `index.css`, not the JSX token file.

---

## E. Data-model additions that affect display

These are display-relevant because they put new values on screen or change what a filter means.

### E1. First-class cuisine field

Every dish now carries a required `cuisine` field (a display and filter value only, never a rule input), spanning roughly ten cuisines: Indian baseline plus Thai, Chinese, Italian, Lebanese, Mexican, Spanish, Continental, Korean, Japanese, Vietnamese, Greek/Mediterranean. It drives the Explore cuisine pill and the Cuisines filter panel (B1). The library grew from about 120 dishes at handoff time to roughly 260.

### E2. "Healthy" is a derived flag, not a tag

Healthy is now computed by the engine (at least 25 percent of calories from protein and at least 3 g of fibre per person), not a hand-applied tag. The Healthy toggle in Explore and in the pickers reads this derived flag. Nothing visual changes about the toggle, but the set of dishes it surfaces is now principled.

### E3. Richer per-dish data is populated

Descriptions and recipes are complete across the active library, and dishes carry complexity, derived per-person macros, pre-prep markers, and special-sourcing metadata. The detail sheet and pickers can rely on these being present rather than degrading.

---

## F. Deliberate divergences from the handoff (do not "fix" these back)

These were intentional EM or operator calls. Carry them forward; do not restore the handoff version.

1. **Picker rows have no trailing complexity pill** (complexity lives in the row subtitle instead). Operator-directed.
2. **The swap and add pickers are generic over the whole active library** and allow cross-meal picks; they are not restricted to dishes that fit the slot. Product Principle 4.
3. **Bottom nav uses distinct line icons**, not the placeholder dot.
4. **No comment-entry control in the UI** (B4).
5. **Breakfast is savoury-only; fruit is its own section** (A).

---

## G. One-line change ledger

Newest first. PR numbers in parentheses; see `docs/CHANGELOG.md` for full entries.

- Generic picker search with dynamic, result-driven filter pills (#131)
- Generic, cross-meal swap pool with slot-meal-first ordering (#130)
- Unified Back / history navigation across the app (#111)
- Explore count respects the active filter; cards top-align (#112, #113)
- Fruit of the day shown and swappable in the day editor (#106)
- First-class cuisine field plus nested Explore filter (#105)
- Fruit of the day, breakfast savoury-only, plus seasonal fruit dishes (#103, #104)
- "Healthy" defined from a real protein-to-calorie and fibre rule (#102)
- Offline banner no longer flashes on online opens (#119)
- Photo crop locked to aspect-ratio on Explore cards and detail hero (#93, #94)
- Identity screen copy and tile cleanup (#92)
- Menu share image rendered on canvas to stop iOS overlap (#81)
- Menu and Explore design-feedback fixes; comment entry removed (#78)
- Picker rows drop the duplicate complexity pill (#86)
- Swap picker search reaches the full meal-time pool (#85)
- Search pickers: stable height, spacing, quick filters (#82)
- Explore cards show a multi-tag pill set (#76)
- Bottom nav distinct line icons per tab (#74)
- Full dish-photo library generated, realism style (multiple PRs through #122)
- Passcode gate accepts the six-digit household code (#98)
- Explore tab plus record-only dislike signal (#56)
- Share image family plus Web Share (#55)
- Changes tab plus Menu summary line (#54)

---

## H. Live screenshots

These are the current app, captured 2026-06-16, and are the most accurate visual reference for the deltas above. Three of the four tabs are shown (the Changes tab is not captured here). Files live in `docs/screenshots/`.

### Menu tab

![Menu tab](docs/screenshots/menu.png)

Shows, top to bottom: the "This week / Jun 15 to 20" header; the change-summary line ("18 swaps, 6 dishes added, 7 dishes deleted, 1 skip, 1 restore this week"); day cards with a per-day date badge and an Edit button. Note the three sections inside a day card, **BREAKFAST**, **LUNCH**, and the new **FRUIT OF THE DAY** (Banana bowl) section (A), each dish row carrying a real photo, a serif name, and a plain-language meta line ("25 min · Cook will need some help", "5 min · Easy to cook"). The breakfast is savoury-only. At the bottom: the terracotta "Share this week" button and the four-tab nav with its distinct line icons (B6), Menu active in terracotta.

### Explore tab

![Explore tab](docs/screenshots/explore.png)

Shows the "Explore / 155 dishes you have not cooked yet" header; the nested filter row (Easy to cook, Healthy quick toggles plus **Cuisines** and **Meal time** dropdown entries) (B1); the "CLOSE TO YOUR USUAL, NEW ON THE PLATE" section label; and the two-column card grid with the multi-tag pill set per card, a colored difficulty pill (Easy / Medium), a prep-time pill ("25 min"), and a descriptor ("High protein") (B2). The subtitle count and a filtered count behave per B9.

### Grocery tab

![Grocery tab](docs/screenshots/grocery.png)

Shows the "Grocery / 38 items to order for Jun 15 to 20" header and the fixed-order grouped list (PROTEINS AND DAIRY, then PANTRY, and so on), with tracked ingredients rounded up to whole packs ("500 g (1 pack)", "400 g (2 packs)"). This surface is largely unchanged from the handoff intent; it is included for completeness and to show the current type and spacing rhythm.
</content>
</invoke>
