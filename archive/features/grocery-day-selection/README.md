# Handoff: Plantry — Grocery Day Selection + Compact Passes

## Overview

Plantry is a private, two-adult PWA for planning a shared week of home cooking (passcode entry, four tabs — Menu, Grocery, Explore, Changes — and a family of bottom-sheet overlays + shareable images). This handoff covers **one shipment** on top of that existing app:

1. **Grocery day selection** — the household chooses which upcoming days to order groceries for, and the list totals up exactly what those days need (replacing a fixed whole-week list).
2. **Compact Grocery layout** — the day chooser + list are tightened so the order reads in one glance.
3. **Compact past-day tiles** on the Menu home — collapsed (already-passed) day rows are slimmer so finished days recede.

Everything else about the app is unchanged. This README is self-sufficient for these three changes; the broader app spec lives in `design_handoff/FEATURES.md` and `design_handoff/DESIGN.md` in the same project if you need surrounding context.

## About the Design Files

The files in this bundle are **design references created in HTML/React-via-Babel** — a runnable prototype showing intended look and behavior, **not production code to copy directly**. The `.jsx` files are transpiled in the browser with Babel standalone and share scope through `window.*`; they are reference implementations, not a build target.

Your task is to **recreate these designs in the target codebase's existing environment** (the live Plantry app is a React app under `app/web/src/`), using its established patterns, component library, and the design tokens already ported into `app/web/src/index.css`. If you are starting fresh with no environment, choose an appropriate framework and implement there. Do not ship the HTML directly.

## Fidelity

**High-fidelity.** Final colors, typography, spacing, copy, and interactions. Recreate the UI to match, using the codebase's existing primitives and the Plantry tokens. Exact values are listed below and in `hifi-tokens.jsx`.

## How to run the reference

Open `Plantry Hi-Fi.html` in a browser. It loads React 18 + Babel from unpkg and the local `.jsx`/`.js` files and `assets/dishes/*`. The prototype clock is **June 18 (Thursday), 2:05 PM** — set in `NOW` in `hifi-data.js` — which is what makes the Grocery default land on the "after 11 AM" branch. To exercise the "before 11 AM" branch, set `NOW.hour` below 11.

---

## Change 1 — Grocery day selection

### Purpose
The household no longer sees a frozen week-long grocery list. They pick **which upcoming days to order for**, matching how they actually shop (a run covers the next day or two, not the whole week). The list is derived live from the dishes on the selected days.

### Layout
The Grocery tab is a flex column: scrolling body (`data-screen-label="Grocery"`) then the four-tab `TabBar`.

1. **Header** (padding `calc(env(safe-area-inset-top,0) + 24px) 20px 12px`): title "Grocery" (serif 26, weight 700) and a subtitle (sans 13.5, `sub`).
   - Subtitle with days chosen: **"{N} items for {range}"** — e.g. "25 items for Thu 18 to Fri 19" (item count tabular; range is "{short} {date}" or "{short} {date} to {short} {date}").
   - Subtitle with nothing chosen: **"Pick the days you want to order for"**.
2. **"Order for" selector** (padding `0 16px 14px`, column gap 10): a green `SectionLabel` "Order for" above a single row of day chips (`DaySelect`).
3. **Grocery list** (padding `0 16px 16px`, column gap 8): one Card per group, or the empty-state card.

### The day chips (`DaySelect`, in `hifi-screens.jsx`)
A flex row, 6px gap, each chip `flex: 1` (equal width). Each chip is a `<button>` with two centered lines: a relative **tag** (uppercase, 9.5px, weight 700) over the **date number** (serif 18, weight 600).

- **Tag text:** today → "Today", today+1 → "Tom", otherwise the weekday short ("Mon", "Tue"…).
- **States:**
  - **Disabled** (date in the past, or `skipped`): `bg` fill, `sub` text, opacity 0.5, date number struck through (`line-through`), `cursor: default`, not tappable.
  - **Selected** (on, not disabled): `accentSoft` fill, `accent` border (1.5px), `accent` text on both lines.
  - **Unselected/selectable:** `surface` fill, `line` border (1.5px), `ink` date / `sub` tag.
- `aria-pressed` reflects selection; `disabled` reflects past/skipped.

### Default selection (time-aware) — the core rule
Implemented in `GroceryScreen`:

- `selectable` = days with `date >= today` and not `skipped`.
- `late = NOW.hour >= 11`.
- **Before 11 AM:** default = first two of `selectable` → **Today + Tomorrow**.
- **From 11 AM on:** default = first two of `selectable` excluding today → **Tomorrow + the day after**. (Past 11, the day's own shopping run is assumed done, so the window rolls forward a day.)
- Near week's end this naturally yields one or two remaining days. Default is **two days** whenever two are available.

The user can then add/remove any selectable day; toggling a disabled day is a no-op.

### How the list is computed
Derived, not hand-authored — reproduce this contract against the real dish library.

- **`INGREDIENTS`** (`hifi-data.js`): each dish on the week → its shopping ingredients `[name, qty]` in a canonical unit (only items you buy; not salt/oil staples).
- **`ING_META`**: per ingredient → `{ g: group, u: unit, pack?: size }`. Units: `g`, `ml`, `pc`, `bunch`, `sprig`.
- **`computeGrocery(days)`**: sums ingredient quantities across the selected days' `breakfast` + `lunch` dishes (skipped days and the fruit-only Saturday breakfast contribute nothing), adds each day's one fruit purchase to a **Fruit** group, rounds tracked items **up to whole packs** (showing "(N packs)"), formats weights (g→kg at 1000) / volumes (ml→L) / counts, and returns `{ groups, count }`.
- Quantities in the prototype are representative, not authoritative — the live app supplies real per-dish ingredient lists.

### Group order (set by review)
Fixed order:

> **Proteins and Dairy · Fruit · Vegetables · Aromatics and Herbs · Other · Pantry**

- **Fruit is second** (right after Proteins and Dairy); **Pantry is last**.
- **Tamarind belongs to Pantry** ("Other" now only shows if some ingredient genuinely has no group).
- Within a group, items are **A–Z**, except an `ITEM_LAST` override map sinks specific items to the bottom — currently **Besan** (pinned to the end of Pantry).

### List rows
One Card per non-empty group (padding `12px 16px 2px`): a green `SectionLabel` (group name), then rows. Each row: name left (sans 14.5, `ink`), quantity right (sans 13.5, `sub`, `tabular-nums`, nowrap), hairline (`1px solid line`) between rows, none after the last.

### Empty state (no days selected)
Subtitle becomes the pick prompt; body shows one centered Card (padding `28px 20px`): "Pick a day to order" (serif 19, weight 700) / "Tap the days above and we'll total up exactly what to buy." (13.5, `sub`).

### Copy rule
**Do not explain the selection logic to the user.** No "it's 2 PM / past 11 AM" sentences in the UI — the chips and their disabled/struck state carry the meaning. The only Grocery copy is the title, the count+range (or pick prompt) subtitle, the "Order for" label, group names, and the empty-state card.

---

## Change 2 — Compact Grocery layout

The "Order for" selector is a single equal-flex chip row (6px gap) sitting directly above the list, with **no helper paragraph** between chooser and list. Group cards use an 8px gap; rows keep the compact rhythm above. The whole order is meant to read in roughly one scroll.

---

## Change 3 — Compact past-day tiles (Menu home)

The collapsed `DayCard` (a day before today, on the Menu tab — `hifi-primitives.jsx`) is slimmer so finished days settle into the background while today and upcoming days stay full-height.

| Property | Before | After (this change) |
|---|---|---|
| Card padding | `10px 14px` | `5px 12px` |
| Date | DateBadge `compact` (serif 22, 34 wide, weekday + month) | bare serif **16** date number, **26** wide, `sub` colour, line-height 1 |
| Row gap | 12 | 10 |
| Glance line | sans 13.5 | sans 13 |
| View button | 12.5, padding `7px 16px`, min-height 36 | **12, padding `4px 13px`, min-height 28** |

Card stays on `bg` fill. Behavior unchanged: a one-line glance ("first two dish names" + " +N more", or "Skipped"), a **View** pill at the right (sub text, `line` border, `surface` fill, pill radius) that opens the same full day editor. Today and upcoming cards are untouched.

> Open question carried from the main spec: the collapsed action label ("View") is not yet final.

---

## Interactions & Behavior

- **Tap a day chip** → toggles it in `selected` (guarded against past/skipped); the grocery list and the header count/range recompute synchronously via `computeGrocery(chosenDays)`. No animation required beyond the codebase's normal list updates.
- **Deselect all** → empty state appears.
- **Tap View on a collapsed day** → opens the day editor (existing flow, unchanged).
- **Tab bar** → switches Menu / Grocery / Explore / Changes (unchanged).
- No new loading/error states; the list is local-derived. No new transitions introduced.

## State Management

New/affected state (all local to the Grocery screen unless noted):

- `selected: string[]` — chosen day ids. Initialized to the time-aware 2-day default on mount.
- `toggle(id)` — adds/removes an id, ignoring past/skipped days.
- Derived (no state): `selectable`, `late`, `chosen` (selected, non-skipped, date-sorted), `base = computeGrocery(chosen)`, `range`.
- `week` is passed in from app state (`hifi-app.jsx`: `<GroceryScreen week={state.week} … />`); each day is `{ id, day, short, date, fruit, breakfast[], lunch[], skipped? }`.
- The prototype reads "now" from the `NOW` constant in `hifi-data.js`; the live app must read the **device date/time** (date for past/today/tomorrow, hour for the 11 AM rule).

## Design Tokens

From `hifi-tokens.jsx` (port to / reuse `app/web/src/index.css` variables — do not hand-pick new colors):

**Color** — `bg #F7F2E9` · `surface #FFFDF9` · `ink #2C241B` · `sub #94846F` · `line #E9E0D2` · `accent #BC5430` · `accentSoft #F4E4DB` · `green #5F7355` · `greenSoft #EDEFE4` · `danger #A33B25` · `dangerLine #D8B7AC` · `onAccent #FFF8F2`.

**Type** — serif `'Source Serif 4'` (date numbers, headings), sans `'Source Sans 3'` (UI). Sizes used here: title 26, empty-state heading 19, dish/row name 14.5, quantity 13.5, subtitle/meta 13–13.5, chip date 18 / collapsed date 16, chip tag 9.5. Section labels: 11px, uppercase, letter-spacing 0.12em, weight 600, green.

**Radius** — card 18, control 14, chip 12, pill 999, thumb 10. **Spacing** — multiples of 4; screen body gutters 16, header gutters 20. **Safe area** — headers pad `calc(env(safe-area-inset-top,0) + 24px)`; nav/sheets use `env(safe-area-inset-bottom)`.

## Assets

- `assets/dishes/*.jpg` — dish photos referenced by `hifi-data.js`. In the live app these come from the real dish library; the bundled JPGs exist only so the reference prototype renders.
- Fonts: Source Serif 4 + Source Sans 3 (Google Fonts), already in the app.
- No new icons introduced by this change.

## Not in this change

- **Shareable images** (`hifi-share-image.jsx`) still render the **full week** grocery from the legacy static data. If the shared grocery image should also become day-selected, that's a follow-up.
- Tokens unchanged; no new colors.

## Files

Reference files in this bundle:

- `Plantry Hi-Fi.html` — entry point; loads everything below.
- `hifi-data.js` — **the changed data model**: `INGREDIENTS`, `ING_META`, `FRUIT_BUY`, `GROUP_ORDER`, `ITEM_LAST`, `computeGrocery()`, and the `NOW` clock. Start here.
- `hifi-screens.jsx` — **`DaySelect` and `GroceryScreen`** (the day-selection UI + logic), plus the other tab screens.
- `hifi-primitives.jsx` — shared components incl. the **compact collapsed `DayCard`**.
- `hifi-tokens.jsx` — design tokens.
- `hifi-overlays.jsx`, `hifi-share-image.jsx`, `hifi-app.jsx` — overlays, share images, and app/state wiring (context; unchanged by this shipment except the `week` prop passed to `GroceryScreen`).
