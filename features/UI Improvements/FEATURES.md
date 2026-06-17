# Plantry feature brief

What this handoff asks the engineering side to build, at the feature level. It is the "what and why"; the pixel and component spec lives in `DESIGN.md`. It assumes and does not restate `docs/product.md` (persona, weekly loop, principles, tone); where this brief and `docs/product.md` agree, the product doc wins on rules, this brief owns the user-facing surface.

The app is four tabs (Menu, Grocery, Explore, Changes) plus two entry screens (passcode, identity), a family of bottom-sheet overlays, and a separate shareable image family. Warm cream surfaces, terracotta accent, serif dish names. Two adults share one week; either can edit; every fast-loop edit carries author, time, and a required reason.

## 1. Entry

- **Passcode gate.** A six-digit household code (six dots, auto-submit on the sixth) keeps the shared URL private. No accounts.
- **Identity.** "Please select the user" with two tiles, "I am Rajat" and "I am Tuhina", stored on the device. Identity attributes every edit.

## 2. Menu (the shared week)

- **Brand header.** The screen leads with "Plantry" and a close subtitle, "June 15 to June 20 menu". No change-summary in the header; the change count lives on the Changes tab.
- **Day cards, Monday to Saturday.** Each card shows Breakfast, Lunch, and a Fruit of the day section. Each dish row carries a photo (or a quiet no-photo fallback), a serif name, a plain-language meta line (time, then the complexity phrase), and a pre-prep marker where a dish needs day-before work.
- **Past days collapse.** A day before today condenses to a compact row (date number, a two-dish glance, a View action). Today and upcoming days stay open, so attention lands on the present day. View opens the same full day editor as Edit.
- **Fruit of the day.** One in-season fruit per day, its own light section, swap-only and category-locked (only another fruit can replace it; no add, no delete, no one-off). Saturday has a fruit though it has no breakfast.
- **Day editor** (from Edit or View). Per-dish actions, add a dish, custom one-off, delete, skip and restore, fruit swap, and an open day-level comment field. Every action that mutates the week asks for a required reason; a comment is optional and queues for review.
- **Share menu.** A primary action opens the share preview: the image family (menu, grocery, one recipe sheet per dish marked to include) on a swipe rail, sent together through the native share sheet.

## 3. Grocery

- Grouped in fixed order (Proteins and Dairy, Pantry, Vegetables, Aromatics and Herbs, Other), plus a Fruit group. Each row is name-left, quantity-right; tracked items round up to whole packs and show the pack count. The list is compact so most of it reads in one scroll. Skip-aware: a skipped day contributes nothing.

## 4. Explore (familiar but new)

- A browse grid of dishes the household has not cooked, ranked familiar-but-new, hiding anything already on this week or saved for next.
- **Nested filter.** Easy to cook and Healthy as quick toggles; Cuisines and Meal time as multi-select panels (each option shows its dish count and an Apply button). Filters combine across dimensions and union within one. The subtitle count reflects the filtered result.
- **Cards.** Top-aligned photo (16:9) and title, then an ordered pill set: a colored difficulty pill, then prep time, then one descriptor (for example High protein). The set degrades gracefully to nothing.
- **Dish sheet.** Description, stats, and the recipe always visible. Use this week (pick a day), save for next week, or "Not for me", a record-only dislike that queues a slow-loop signal and does nothing in session.

## 5. Changes

- A newest-first record of every menu edit (swap, add, one-off, delete, skip, restore, save-for-next-week) and every comment, each with author, time, a plain headline, and the quoted reason or comment. The subtitle and the Changes nav badge show the count of edits this week.

## 6. Pickers (Add and Replace)

- One generic search over the whole active library, across meal-time, so a breakfast dish is reachable from a lunch slot on purpose (a deliberate slow-loop signal, not a blocked action). Results lead with the slot's meal-time. A result-driven filter row shows only the pills the current results can satisfy and resets on new search text.
- **Replace** opens the picked dish's details first, then the required reason. **Add** routes a picked dish to the slot its meal-time names. Both accept a custom one-off: Add appends it as an extra dish; Replace puts it in place of the position.

## 7. Shareable images

- A family sent together, not one PNG: a menu image (one card per day, with the Fruit of the day line), a grocery image (from the same skip-aware data), and one recipe sheet per dish marked "include recipe when sharing". Calm, label-free, legible at phone size, on a warm cream card.

## Decisions that need the product spec or the slow loop

These are user-facing choices in this handoff that imply a rule or data change. They should route through `docs/product.md` and the slow loop, not ship on a design alone. They are detailed in `DESIGN.md` and were the operator's calls:

- A custom one-off can be appended as an extra dish, not only a replacement (reverses `docs/product.md` §7).
- Day-level comment entry returns to the UI (the queued-comments backend already exists).
- Fruit of the day, first-class cuisine, derived Healthy flag, save-for-next-week queue, and day skip/restore each imply new library or engine data.
