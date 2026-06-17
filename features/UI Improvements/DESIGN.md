# Plantry design spec

The detailed build spec for the Plantry PWA and its shareable images. Read `FEATURES.md` first for the feature-level "what and why"; this document is the "how". It links the tokens and the live references so the implementation matches intent.

## How to use this document

1. Open the interactive prototype, `Plantry Hi-Fi.html`, and click through every flow. It is the behavioural source of truth.
2. Open `Plantry Screens Canvas.html` to see every screen and overlay, plus the states (skipped day, busy week, share preview, filter panel, pickers) laid out together.
3. Port the tokens in `hifi-tokens.jsx` verbatim into `app/web/src/index.css`, then build against this spec. The JSX files are reference implementations, not ship code; the live app lives in `app/web/src/`.

Reference files:

- Tokens: `hifi-tokens.jsx`
- Primitives (components): `hifi-primitives.jsx`
- Screens: `hifi-screens.jsx`
- Overlays (sheets, dialogs): `hifi-overlays.jsx`
- Share images: `hifi-share-image.jsx`
- Sample data and the shapes each record needs: `hifi-data.js`
- Prototype state and flow wiring: `hifi-app.jsx`

---

## 1. Foundations (tokens)

Canonical values live in `hifi-tokens.jsx` and should be ported to `index.css` CSS variables. No token values changed from the previous handoff.

### Color

| Token | Value | Use |
|---|---|---|
| `bg` | `#F7F2E9` | app background, warm cream; also the inset fills (stat chips, reason box) |
| `surface` | `#FFFDF9` | cards, sheets, pills on cream |
| `ink` | `#2C241B` | primary text |
| `sub` | `#94846F` | secondary text, meta |
| `line` | `#E9E0D2` | hairlines, borders |
| `accent` | `#BC5430` | terracotta; primary actions, active nav, links |
| `accentSoft` | `#F4E4DB` | selected and highlighted fills, Edit pill, today border |
| `green` | `#5F7355` | meal/section labels, positive states |
| `greenSoft` | `#EDEFE4` | soft green fill |
| `danger` | `#A33B25` | destructive actions |
| `dangerLine` | `#D8B7AC` | destructive borders |
| `scrim` | `rgba(44,36,27,0.45)` | sheet backdrop |
| `onAccent` | `#FFF8F2` | text/icon on terracotta |

Non-token accents in use: pre-prep marker and Medium-difficulty text `#8A6D3B` on fill `#F2E8D5`. Share-image surfaces use `#FBF6ED` (card), `#FFFEFA` (inner), `#EBE2D2` (hairline) to print slightly warmer than the app.

### Type

Two families: serif `'Source Serif 4'` (dish names, headings, the date number) and sans `'Source Sans 3'` (everything else). Sizes (px): screen title 26, day-detail title 22, dish name 16.5, body 14.5, meta 12.5, micro 11. Section labels are 11px, uppercase, letter-spacing 0.12em, weight 600, green.

### Radius and spacing

Radius: card 18, control (buttons, inputs) 14, chip 12, pill 999, thumb 10. Spacing scale is multiples of 4. Screen body gutters are 16px; header gutters 20px. Card gap in a list is 12 (8 on the compacted Grocery).

### Safe area

Screen headers reserve the device status bar with `calc(env(safe-area-inset-top, 0px) + 24px)` of top padding, not a flat band. Bottom nav and sheets pad with `env(safe-area-inset-bottom)`.

---

## 2. Components

All components read tokens from `window.PT`. Source: `hifi-primitives.jsx`.

### DishRow

A photo thumb (48, or 40 compact, radius 10; no-photo fallback is a diagonal cream stripe), serif name (16.5), and one plain-language meta line: `{time} min · {complexity phrase}`. Complexity phrases: Easy → "Easy to cook", Medium → "Cook will need some help", Hard → "Takes time and effort". Append ` · Pre prep` in `#8A6D3B` when the dish has a pre-prep note. A custom one-off shows the name and "One off this week". An optional `trailing` slot holds the caller's affordance (the ⋯ actions button, a meal tag, a "New" marker).

### FruitRow

Same weight as DishRow: a rounded tile (48, the fruit's soft swatch colour; stands in for the real fruit photo the live app carries), serif name, and a plain "In season" meta line (styled like the regular meta, no pill). Tappable to swap; the trailing slot shows a "Swap" link in the day editor.

### Pills

- **DifficultyPill** (Explore cards): concise colored pill, Easy/Medium/Hard. Easy = green on greenSoft, Medium = `#8A6D3B` on `#F2E8D5`, Hard = danger on accentSoft. 11.5px, weight 600, pill radius.
- **MetaPill**: neutral outlined pill (sub text, surface fill, line border) for prep time and the descriptor.
- **DishPills**: the ordered set on an Explore card — difficulty, then `{time} min`, then the one descriptor — wrapping, capped at two lines (`maxHeight` ~58, overflow hidden). Renders nothing if a dish has none.

### DateBadge

Default: weekday short (uppercase 11px), date number (serif 30), "Jun" (11px), 52 wide. `muted` dims the number to `sub`. `compact` (collapsed cards) renders only the date number (serif 22), 34 wide, dropping the weekday and month.

### DayCard

Three states.

- **collapsed** (a day before today): a low card on `bg`, compact date badge, a one-line glance ("first two dish names" + " +N more", or "Skipped"), and a **View** pill (sub text, line border) at the right. Padding `10px 14px`.
- **today** / **default** (current and upcoming days): full card. Border is `accentSoft` for today, `line` otherwise (no "Today" pill). A 52 date badge, then Breakfast and Lunch sections (each a green SectionLabel over its DishRows), then a Fruit of the day section (SectionLabel + FruitRow, no divider rule above it). An **Edit** pill (accent on accentSoft) sits top-right. A skipped day shows "Skipped" and the quoted reason in place of meals.

### TabBar

Four tabs, each a distinct 22px line icon over a 12px label: Menu (calendar), Grocery (basket), Explore (compass), Changes (swap arrows). Active = accent, inactive = sub. The Changes icon carries a count badge (accent circle, onAccent text, surface ring) equal to the number of this-week edits, i.e. activity entries whose kind is not `comment`. Hidden at zero.

### Sheet (bottom sheet)

Scrim backdrop (tap to dismiss), panel pinned to the bottom with a 24px top radius. A 36×4 drag handle is centered at the top, and a circular close (×) button sits at the top right (surface fill, soft shadow, 32px) so dismissal is explicit, not only by drag. Content scrolls inside; the panel caps at 88% height (92% for the tall pickers).

### Buttons and inputs

- **PrimaryButton**: terracotta fill, onAccent text, control radius, min-height 48, full width.
- **QuietButton**: surface fill, line border (dangerLine + danger text when destructive).
- **SearchField / textarea**: surface or bg fill, line border, control radius, min-height 46.
- **Chip / FilterChip**: pill, surface/line by default, accent fill when active; FilterChip adds a small caret for the panel entries.

---

## 3. Screens

Source: `hifi-screens.jsx`. Every screen is a flex column: a scrolling body with a `data-screen-label`, then (where present) a fixed action bar, then the TabBar.

### Passcode gate

Centered "Plantry" wordmark, "Enter the kitchen passcode", a row of six dots that fill as digits are entered, and a 3-column keypad (1–9, 0, Delete). Auto-submits on the sixth digit.

### Identity

"Please select the user" / "Edits carry your name", then two tiles (avatar 44 + "I am {name}"). No "stored on this phone" sub-line.

### Menu

Header: "Plantry" (serif 30) with the close subtitle "June 15 to June 20 menu" (sub 14) directly beneath, and the identity avatar (30) at the top right (tap to switch). Then the day list: days with date before `TODAY` render collapsed, the rest expanded (today flagged). Fixed action bar: a single **Share menu** PrimaryButton. `TODAY` is a constant (17) in the prototype; the real app reads the device date.

### Day editor

Opened from a card's Edit or View. Header: a back chevron, "{Day}, Jun {date}", and "Changes apply to this week right away". Body: a Card per non-empty meal (SectionLabel + DishRows, each with a ⋯ actions button; tapping a library dish row opens its details, tapping a one-off opens its actions). Then the Fruit of the day Card (FruitRow with a "Swap" trailing link). Then **Add a dish** (dashed accent button), **Skip this day** (danger outline), and a **Note for the weekly review** Card: an always-visible textarea ("Leave a comment about this day. It changes nothing now; it queues for the review.") with a **Post comment** pill, disabled until there is text. A skipped day instead shows a centered "This day is skipped" card with the reason and a **Restore this day** button.

### Grocery

Header "Grocery" / "{count} items to order for Jun 15 to 20". Then one Card per group: a green SectionLabel and tight rows (name left at 14.5, quantity right at 13.5 sub, tabular numerals, hairline between rows). Groups in fixed order plus a Fruit group. Rows are deliberately compact so the list reads in roughly one scroll.

### Changes

Header "Changes" / "{n} changes to this week's menu" (n excludes comments; falls back to "Everything done to this week's menu" at zero). Then newest-first Cards: an avatar, a bold headline, "{who} · {when}", and the quoted reason or comment in a bg box. Empty state is a centered line.

### Explore

Header "Explore" / "{filtered count} dishes you have not cooked yet". A horizontal filter row: FilterChips for Easy to cook and Healthy (toggle), and Cuisines and Meal time (carets, open a panel; the chip shows "· N" when selections exist). The open panel is an inline Card of checkbox rows, each with its dish count and a disabled state at zero, plus Clear and an **Apply** button. Then the label "Close to your usual, new on the plate" and a two-column grid of cards (top-aligned 16:9 photo, serif name, DishPills). Empty state when filters exclude everything.

#### Filter logic

The pool is dishes never cooked and not already used this week or saved for next. Filters AND across dimensions and OR within a dimension. A panel option's count is computed with the other dimensions applied, so counts guide the next tap. See `ExploreScreen` and `passes()` in `hifi-screens.jsx`.

---

## 4. Overlays

Source: `hifi-overlays.jsx`. All use the `Sheet` (drag handle + close ×).

### Dish action sheet

Opened from a dish ⋯. The dish row, then rows: Details and recipe (library dishes only), Replace, Delete (danger).

### Dish detail sheet

Hero image cropped 5:2, serif name, description, a `{cuisine} · {meal} · last-cooked` line, three stat chips (Protein, Protein to carb, Time), then an always-open details block: the complexity phrase as a heading, then Skill / Equipment / Buy specially / Pre prep / Time, then the numbered recipe. No show/hide toggle, no info icon. Footer actions depend on context:

- **week** (a dish on the plan): an "Include recipe when sharing" toggle row (page level), then Replace this dish / Remove.
- **explore**: Use this week / Next week, then a record-only **Not for me** (dashed underline, large tap target).
- **replacePreview** (a dish picked in the Replace flow): a single **Use this dish**.

### Generic picker (Add and Replace)

Pinned header (title, "{day} {meal} · search the whole library", search field, and the result-driven filter Chips), then a scrolling result list. Ordering and the dynamic filter pills are described in `FEATURES.md` §6; the logic is `orderLibrary()` and `PICKER_FILTERS` in `hifi-overlays.jsx`. Rows are DishRows with no trailing complexity pill; a cross-meal dish shows a small meal tag, a never-cooked dish a "New" marker. Typing an unknown name offers a one-off: "Add … as a one off" (Add, appends) or "Replace with one off …" (Replace, replaces the position).

### Fruit picker

Category-locked: lists only other in-season fruits with their season; picking one routes to the required-reason dialog. No add, no delete.

### Reason dialog

Title, hint, a row of quick-reason chips, a textarea, and a submit button disabled until there is text. `optional` (the dislike) allows an empty submit. Required for swap, add, one-off, delete, skip, restore, fruit swap, save-for-next-week.

### Day picker (from Explore "Use this week")

Lists the week's days with their current count for that dish's meal; picking one routes to the required-reason dialog.

### Share preview

A horizontal swipe rail of the image family (menu, grocery, then one recipe sheet per included dish), each labelled "{i} of {n}", with a "Send on WhatsApp" action.

---

## 5. Shareable images

Source: `hifi-share-image.jsx`. A distinct surface from the PWA: calm, label-free, on `#FBF6ED`, rendered ~360 wide (export at 3×). Per the live app these draw on a canvas (measure pass, then draw pass) so the on-screen preview and the exported PNG cannot drift.

- **Menu image**: header, then one row per day (date badge left; Breakfast, Lunch, and a quieter Fruit line right; "Skipped" where skipped).
- **Grocery image**: header, then each group as a two-column list of name + quantity, from the same skip-aware data as the Grocery tab.
- **Recipe sheet**: one per dish marked to include; title, "about {time} minutes · serves 2", an equipment/sourcing box, and the numbered recipe. Degrades gracefully where cook fields are incomplete.

No internal labels reach any image (no "Menu 3", no tag names, no reuse callouts).

---

## 6. Data shapes the design assumes

From `hifi-data.js`; these are display-relevant and should exist on the live records.

- **Dish**: name, photo, meal-time, cuisine, protein, protein-to-carb, time, complexity (Easy/Medium/Hard), derived `healthy`, one `descriptor` (the Explore pill: High protein / Complete meal / Filling / Light), `lastCooked`, optional `prep` note, description, and cook detail (skill, equipment, special sourcing, recipe steps).
- **Fruit**: name, a soft tile colour, season; one per day Mon to Sat, category-locked.
- **Week day**: id, day, short, date, `fruit`, `breakfast[]`, `lunch[]`, optional `skipped`. Entries are `{ key, includeRecipe }` or `{ custom }`.
- **Grocery**: groups of `{ name, qty }`, fixed order, plus a Fruit group; tracked items round to whole packs and show the count.
- **Activity**: `{ who, kind, text, when, reason }`; kinds are swap, add, oneoff, delete, skip, restore, nextweek, comment. The Menu/Changes count and badge exclude `comment`.

---

## 7. Context for the engineer (Claude Code)

To build these the way they are intended:

- **Read in order**: `docs/product.md` (rules, principles, tone) → `FEATURES.md` (what each surface does) → this spec (how) → the prototype (`Plantry Hi-Fi.html`) for behaviour and the canvas for every state.
- **Tokens are the contract.** Port `hifi-tokens.jsx` into `app/web/src/index.css` and consume the CSS variables; do not hand-pick new colours. If a feature needs a new token, flag it rather than inlining a hex.
- **The JSX is reference, not ship code.** It encodes layout, states, copy, and measurements. Re-implement against the live `app/web/src/` stack; match the structure and the token usage, not the React shape.
- **Honour the rules that are not visual.** Required reasons on every fast-loop edit; the dislike and comments record without applying; Explore never re-ranks or hides in session; no internal labels and no em dashes in any user-facing string or image; the picker is generic and allows cross-meal picks on purpose.
- **Treat §"Decisions that need the product spec" (in `FEATURES.md`) as gated.** One-off append, returned comment entry, fruit, cuisine, derived Healthy, save-for-next-week, and skip/restore each imply a library, rule, or engine change. Land the spec and data through the slow loop before or alongside the UI, not after.
- **Check at a real narrow phone width.** Photos are cropped by aspect-ratio (16:9 cards, 5:2 hero), not fixed pixel height; the bottom nav, sheets, and headers depend on `env(safe-area-inset-*)`.
- **Open question still to resolve**: the collapsed past-day action label (currently "View"). Pick before shipping.
