# Handoff: Wishlist + Favorites (Plantry)

## Overview

Plantry is a private, two-adult PWA for planning a shared week of home cooking (passcode entry, bottom tabs, bottom-sheet overlays). This handoff covers one major shipment:

1. **New "Yours" tab replaces the Changes tab** — home of two shared household lists: **Your favorites** and **Your wishlist**.
2. **Wishlist** — a one-tap "save it to try" list. Markable from the Explore cards (heart), the dish detail sheet, and the dish action sheet on the week's menu. From the list, any dish can be placed into the week ("Use").
3. **Favorites** — dishes the household wants in **every generated week** (e.g. avocado toast every week). Added from the Yours tab via search (library + free-text custom names), or from a menu dish's action sheet ("Mark as favorite").
4. **Profile sheet** — the avatar on the Menu header now opens a profile: switch username + the relocated **Changes log** (formerly the Changes tab).
5. **"Save for next week" is deprecated** — removed everywhere; previously saved entries are dropped silently on load.

## About the design files

These are **design references in HTML/React-via-Babel** — a runnable prototype showing intended look and behavior, not production code. The `.jsx` files transpile in-browser via Babel standalone and share scope through `window.*`.

Recreate the designs in the live Plantry codebase (`app/web/src/`), using its established components and the tokens in `app/web/src/index.css`. Do not ship the HTML directly.

## Fidelity

**High-fidelity.** Final colors, type, spacing, copy, and interactions. Exact values below and in `hifi-tokens.jsx`.

## How to run the reference

Open `Plantry Hi-Fi.html`. Seed lists: 1 favorite (custom "Avocado toast"), 2 wishlist dishes (Dosa, Chana masala). State persists to localStorage.

---

## 1. The "Yours" tab

Fourth tab, replacing Changes. Icon: a heart (line icon, same 1.7 stroke family as the other tabs). Badge: the wishlist count.

Screen (`YoursScreen`, `hifi-screens.jsx`): header "Yours" (serif 26/700) with subtitle "The household's favorites and wishlist", then two sections, 16px apart, each a green `SectionLabel` + one Card:

- **Your favorites** — one row per favorite: name (serif 16.5/600) over "Added by {who} · in every week's menu" (12.5 sub); an × remove button (44px hit) at the right. Empty state: "No favorites yet. A favorite gets a place in every week's menu." Below the card, a full-width dashed accent button **"Add a favorite"** (48 min-height) opens the Add Favorite sheet.
- **Your wishlist** — one row per dish: 44px photo thumb, name over "Added by {who}"; a **"Use"** pill (accent border, 34 min-height) and an × remove button. Tapping the row body opens the dish detail sheet (explore context). Empty state: "Nothing on the wishlist. Mark a dish from Explore or any dish page."

Rows: 11px vertical padding, hairline separators, none after last.

## 2. Wishlist behavior

One-tap, **no reason dialog**. Entry points:

- **Explore cards:** a 34px circular heart button overlaid top-right of the photo (surface bg, subtle shadow). Outline = not saved; filled accent = saved. Toggles instantly, `aria-pressed`, toast confirms ("{Dish} is on your wishlist").
- **Dish detail sheet (explore/Yours context):** footer pair — primary "Use this week" + quiet **"Add to wishlist"** (→ "Wishlisted ✓" when on).
- **Dish detail sheet (week context):** centered dashed-underline text button "Mark as wishlist" / "On your wishlist ✓".
- **Dish action sheet (long-press a menu dish):** see Favorites below — the action sheet offers *favorite*, the detail sheet offers *wishlist*.

Wishlisting logs to the activity feed ("Wishlisted {Dish}") attributed to the current identity. "Use" from the wishlist opens the existing day picker → placement flow (dish stays on the wishlist; removing is explicit).

## 3. Favorites behavior

A favorite is **auto-pinned into every week's menu when the week is generated** (backend rule; the UI copy "in every week's menu" / "Keep it coming every week" reflects it). Entry points:

- **Yours tab → "Add a favorite"** (`AddFavoriteSheet`): title "Add a favorite", sub "A favorite gets a place in every week's menu", a search field ("Search the library, or type a dish"). Results = library dishes not already favorited, filtered by substring. Any non-empty query also shows a dashed accent row **Add "{query}" as a favorite** for custom dishes not in the library (the avocado-toast case). Picking either saves immediately (attributed, toast, activity log "Added {name} as a favorite") and closes the sheet.
- **Menu dish action sheet:** row **"Mark as favorite"** / "Remove from favorites" with hint "Keep it coming every week" / "In every week's menu". One tap, toggles, toast.

Favorites store either `{ key }` (library dish) or `{ custom }` (free-text name), plus `who`/`when`.

## 4. Profile sheet

The avatar (30px) on the Menu header opens `ProfileSheet`: avatar 44 + name (serif 20/700) + "Edits carry your name", then two rows (52 min-height, hairline-topped, label left / hint right):

- **Switch to {other}** — returns to the identity screen.
- **Changes to this week** — hint "{n} changes" or "None yet"; opens `ChangesLogSheet`: the full old Changes-tab content (attributed entries, timestamps, quoted reasons) as a tall sheet (max-height 92%).

## 5. Deprecation and migration

- Remove "Next week" from the dish detail sheet and the `nextweek` action/reason flow.
- On load, drop any persisted `nextWeek` entries silently (no migration, per product decision).
- Persisted `tab: 'Changes'` maps to `'Yours'`.
- Activity summary phrases: `wishlisted` and `favorite(s) added` replace `saved for next week`.

## Interactions & behavior

- All sheets are the existing bottom-sheet component (scrim tap + × to close).
- Toasts confirm every list mutation.
- No loading/error states; all local.
- Hearts and list mutations are optimistic and instant.

## State management

Extends the persisted app state (localStorage key `plantry-hifi-v2`):

- `lists: { favorites: [{key?|custom?, who, when}], wishlist: [{key, who, when}] }` — shared household lists, attributed.
- `isWishlisted(key)` / `toggleWishlist(key)`, `isFavorited(key)` / `toggleFavorite(key)`, `addFavorite(entry)`, `removeAt(list, i)` in `hifi-app.jsx`.
- Overlay types added: `profile`, `changesLog`, `addFavorite`.
- Tab set: `Menu, Grocery, Explore, Yours`.

## Design tokens

From `hifi-tokens.jsx` (mirror `app/web/src/index.css`): bg `#F7F2E9`, surface `#FFFDF9`, ink `#2C241B`, sub `#94846F`, line `#E9E0D2`, accent `#BC5430`, accentSoft `#F4E4DB`, green `#5F7355`, greenSoft `#EDEFE4`. Serif Source Serif 4, sans Source Sans 3. Radii: card 18, control 14, pill 999. Hit targets ≥ 44px. No new tokens; the heart fill uses accent.

## Assets

- `assets/dishes/*.jpg` — dish photos (reference only; live app uses the real library).
- Heart icon is inline SVG (tab icon + card overlay), stroke 1.7/1.8, path in `hifi-primitives.jsx` / `hifi-screens.jsx`.

## Files

- `hifi-app.jsx` — state, list actions, overlay wiring, deprecation/migration. Start here.
- `hifi-screens.jsx` — `YoursScreen`, Explore card hearts, Menu header profile button.
- `hifi-overlays.jsx` — `ProfileSheet`, `ChangesLogSheet`, `AddFavoriteSheet`, action/detail sheet changes.
- `hifi-primitives.jsx` — tab bar (Yours tab, heart icon, wishlist badge).
- `hifi-tokens.jsx`, `hifi-data.js`, `hifi-share-image.jsx`, `Plantry Hi-Fi.html` — tokens, sample data, share surface (unchanged), entry point.

## Open questions

- How favorites land on generated weeks (which meal/day a pinned favorite occupies) is a generation-rule decision not visualized in this prototype.
- Whether using a wishlist dish should auto-remove it from the wishlist (currently it stays).
