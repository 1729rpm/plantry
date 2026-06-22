# Handoff: Shareable menu image refresh (Plantry)

> **ARCHIVED 2026-06-22.** Design handoff for the shareable menu image refresh, which is live (the feature shipped). Moved to `archive/handoffs/` because between features the design reference reverts to the live app until the next handoff is commissioned (`claude-design.md`). Kept for history only; do not read for current truth.

## Overview

Plantry generates a weekly Monday-to-Saturday menu for a two-adult household and, at week start, shares it into WhatsApp as a "locked in" image family. This handoff covers one shipment to that share surface:

1. **Redesign the menu image** ("This week" PNG) so it stays legible after WhatsApp re-encodes it. It was a tall, narrow portrait; it becomes a compact, near-square **single-column ledger**.
2. **Remove grocery from the share family.** The grocery list is internal only now and is never shared. The shareable family becomes the **menu image plus one recipe sheet per dish marked "include recipe when sharing"**.

Nothing else in the app changes.

## About the design files

The files in this bundle are **design references created in HTML/React-via-Babel** — a runnable prototype showing the intended look and behavior. They are **not production code to copy directly**; the `.jsx` files transpile in the browser with Babel standalone and share scope through `window.*`.

Your task is to **recreate these designs in Plantry's existing codebase** (the live PWA under `app/web/src/`), using its established components, patterns, and the design tokens already declared as CSS variables in `app/web/src/index.css`. Do not ship the HTML directly.

**Important codebase note:** the live menu image is **painted on a 2D `<canvas>`** with a manual measure-then-draw pass (this exists to dodge an iOS Safari text-overflow bug; the on-screen preview and the exported PNG come from the same canvas so they cannot drift). The grocery and recipe sheets rasterize from their React components. So the menu-image change below is primarily a change to that **canvas layout pass** — §"Menu image: canvas geometry" gives exact, deterministic geometry to port. The bundled JSX (`hifi-share-image.jsx`) is a faithful visual reference of the same layout, but the source of truth on device is the canvas.

## Fidelity

**High-fidelity.** Final colors, typography, spacing, copy, geometry, and behavior. Recreate to match, using the codebase's tokens and patterns. Exact values are below.

## How to run the reference

Open `Plantry Hi-Fi.html` for the whole app (tap **Share menu** on the Menu tab to see the share rail). Open `Menu Share Image.html` to see the menu image rendered on its own at full size. Both load React 18 + Babel from unpkg and the local `.jsx`/`.js` and `assets/dishes/*`. The sample week is hard-coded in `hifi-data.js`.

---

## Change 1 — Menu image: single-column ledger

### Why the shape changed (the actual problem)

The softness on arrival was **not** a render-resolution problem (the app already exports at 3x). **WhatsApp re-encodes every shared image to JPEG and downscales it so its longest side fits a cap of about 1600 px.** The old menu was a tall portrait (~360 × 960 layout units), so its height was the longest side; WhatsApp shrank it until the height fit and dragged the width down to ~540 px, rendering the dish text soft. **The surviving width is governed by the aspect ratio, not the pixel count** — a taller image is simply downscaled more.

The fix is the shape. A near-square layout survives at a much larger width:

- `survivingLongEdge = min(exportLongEdge, 1600)`
- `survivingWidth = survivingLongEdge ÷ aspect` (aspect = height ÷ width)

| | Old portrait | New ledger |
|---|---|---|
| Aspect (h:w) | ≈ 2.67 | ≈ 1.26 |
| Surviving in-chat width | ≈ 600 px | ≈ 1200 px |

So the ledger lands ~2x wider in chat, which is what makes the text crisp.

### Layout (what it looks like)

A single cream frame: a centered header, then one cream panel holding six day rows (one per day, Mon to Sat), then a footer. Each day row is a left **date rail** (weekday + date) and a **meals column** where Breakfast, Lunch, and Fruit each sit on their own labeled line (a fixed-width green label, then the dishes; wrapped dishes hang under the value, not under the label). A skipped day shows "Skipped". Saturday omits its Breakfast line. Calm, warm, label free.

### Menu image: canvas geometry (port this precisely)

All values are layout units at 1x. Export at scale **S = 2** (see "Export scale" below); multiply every constant by S for the bitmap. Fonts: **Source Serif 4** (date numerals, title) and **Source Sans 3** (everything else).

**Frame / header / footer**
- Image width **600**. Background `#FBF6ED`. Padding: top 30, right 26, bottom 24, left 26. Content width = **548**.
- Header, centered, margin-bottom 22: title "This week" — Source Serif 4, 700, **30px**, `#2C241B`, line-height ~1.1. Sub (date range, e.g. "June 15 to 20") — Source Sans 3, 400, **15px**, `#94846F`, margin-top 4.
- Footer "Plantry" — Source Serif 4, **15px**, `#B5A78F`, letter-spacing 0.06em, centered, margin-top 18.

**Ledger panel**
- One panel: background `#FFFEFA`, border 1px `#EBE2D2`, radius 16, clipped to radius, full content width (548).
- **Day row:** flex, column gap 16; padding 14 top/bottom, 18 left/right; 1px `#EBE2D2` bottom border between rows (none on the last).
  - **Date rail** (width 40, fixed): weekday short "MON" — Source Sans 3, 700, **10px**, letter-spacing 0.12em, uppercase, `#94846F`; below it the date "15" — Source Serif 4, 600, **24px**, `#2C241B`, line-height 1.1.
  - **Meals column** (fills the rest): vertical stack, gap 6, one labeled line per present meal in order Breakfast, Lunch, Fruit. A meal with no dishes is omitted (Saturday Breakfast).
    - **Meal line:** flex, gap 10. Label (width 66, fixed): Source Sans 3, 700, **9.5px**, letter-spacing 0.08em, uppercase, `#5F7355` (green), padding-top 3. Value (fills rest): Source Sans 3, 400, **14px**, line-height 1.4 (line advance 20), `#2C241B`; dishes joined with ", ".
  - **Skipped day:** in place of meal lines, one line "Skipped" — Source Sans 3, 14px, `#94846F`.
- **Value column width** = 548 − 2 (panel border) − 18 − 18 (row padding) − 40 (rail) − 16 (column gap) − 66 (label) − 10 (label gap) = **378**.

**Word wrap (manual, per meal value, within 378):**
1. Split the joined value on single spaces into tokens (the ", " separators keep each comma attached to the word before it).
2. Start line 1 with the first token. For each next token, measure `currentLine + " " + token`; if ≤ 378 append, else push the line and start a new one with `token`.
3. No hyphenation, no mid-word breaks. A lone token wider than 378 (rare) overflows rather than breaks.
4. Line advance = round(14 × 1.4) = **20**.

**Heights (size the bitmap):**
- `mealLineHeight = max(13, lineCount × 20)` (one line = 20).
- `mealsHeight = Σ mealLineHeight + (meals − 1) × 6`.
- `railHeight ≈ 13 (weekday) + 26 (date) = 39`.
- `rowHeight = 14 + max(railHeight, mealsHeight) + 14`. (Skipped row: meals block is a single 20px line.)
- `panelHeight = Σ rowHeight + 2 (panel border)`.
- `imageHeight = 30 (pad) + 55 (header: 33 + 4 + 18) + 22 (header gap) + panelHeight + 18 (footer gap) + 20 (footer) + 24 (pad)`.
- Sample week → **600 × 754**, aspect ≈ 1.26.

**Export scale:** render at **S = 2** → 1200 × 1508. The long edge (1508) is under WhatsApp's ~1600 cap, so it ships un-downscaled and the in-chat width stays 1200. Pushing S past ~2.1 sends the long edge over 1600 and WhatsApp begins downscaling, buying no extra sharpness (the cap, not source resolution, sets the surviving size).

### Content rules
- No internal labels in image text (no "Menu 3", no tag names). No em dashes anywhere in the image; use commas (the recipe sub-line reads "serves 2", not "— serves 2").
- The image reads the same week data it always did: per day, the breakfast list, lunch list, fruit, and skip flag. Saturday has no breakfast.

---

## Change 2 — Remove grocery from the share family

- Delete the grocery share image from the share family entirely. In the reference, `GroceryShareImage` is removed from `hifi-share-image.jsx` and from the share rail in `hifi-overlays.jsx` (`SharePreviewSheet`). In the live app, remove the grocery entry from whatever assembles the shared image set, and drop its renderer.
- The share family is now: **menu image first, then one recipe sheet per dish flagged "include recipe when sharing"** that week (de-duplicated by dish). With no flagged dishes, it is a single image.
- This does **not** remove the grocery list from the app — the on-screen Grocery tab is untouched. Only *sharing* drops grocery.

---

## Interactions & behavior

- **Share preview rail** (`SharePreviewSheet`): a horizontal swipe rail previewing the family in order (menu, then recipe sheets), each as a card; a "Send on WhatsApp" action; an empty-recipe hint that explains the per-dish recipe toggle. Delivery is the native share sheet (inline PNGs), with a download-all fallback when file sharing is unavailable. Unchanged except that grocery is no longer in the family.
- No new animations, loading, or error states. The menu image is locally derived from week data.

## State management

- **No new state.** The menu image is a pure function of the current week (days, meals, fruit, skip flags). The "include recipe when sharing" per-dish flag already exists and drives which recipe sheets appear. Removing grocery removes one item from the share-family list; no store changes.

## Design tokens

Reuse `app/web/src/index.css`. Values used here:

- **App tokens:** ink `#2C241B`, sub `#94846F`, green `#5F7355`, accent `#BC5430`.
- **Share-surface literals** (distinct, warmer; already used by the existing share images): cream `#FBF6ED`, card `#FFFEFA`, hairline `#EBE2D2`, footer `#B5A78F`.
- **Type:** Source Serif 4 (date numerals, title); Source Sans 3 (labels, dish text). Sizes: title 30, date 24, dish/value 14, weekday 10, meal label 9.5, sub/footer 15.
- **Radius:** panel 16. **No new tokens** are introduced.

## Assets

- `assets/dishes/*.jpg` — dish photos used by the reference to render the app's other screens. The menu **image** itself uses no photos (text only). In the live app, dish data comes from the real library.
- Fonts: Source Serif 4 + Source Sans 3 (already in the app).
- No new icons.

## Files

- `hifi-share-image.jsx` — **the changed surface.** `MenuShareImage` (ledger: `MenuMealLine`, `MenuLedgerRow`, the `LEDGER` constants) and `RecipeShareImage`. Grocery image removed. This is the visual reference for the canvas port.
- `hifi-overlays.jsx` — `SharePreviewSheet` (share rail; grocery removed from `slides`).
- `Menu Share Image.html` — renders just the menu image at full size.
- `Plantry Hi-Fi.html` — the whole app, for context (Menu, Grocery, Explore, Changes, day editor, overlays).
- `hifi-tokens.jsx`, `hifi-data.js`, `hifi-primitives.jsx`, `hifi-screens.jsx`, `hifi-app.jsx` — tokens, sample data, and the rest of the app the share flow lives in.
</content>
