# Feature: Tuhina feedback batch (2026-06)

Nine items of feedback from Tuhina on the live PWA, planned against the four canonical docs and split into five streams. Four items are pure frontend; the rest are structural (canonical data, the engine rules spec, or the Convex schema) and carry Rajat-approved decisions recorded below.

## Source feedback

1. On iPhone, left/right page padding is missing throughout (fine on OnePlus).
2. A black line appears over the keyboard while searching.
3. The Healthy filter is empty; define "healthy" from protein-to-calorie ratio and fiber.
4. Fruit should not sit inside Breakfast; it should be a separate "Fruit of the day" section showing seasonal fruit.
5. Explore needs a nested multi-level filter: Cuisines and Meal time. Tapping Cuisines lists cuisines with a dish count each, multi-select, with an Apply button.
6. Add Avocado toast as a dish (believed to be a placeholder; it is not in the library yet).
7. Could not search for plain rice in the picker.
8. The Edit button overlaps the dish title on iPhone.
9. Pills take too much vertical space in Explore and the dish-search pickers.

## Truth-check (from code exploration)

- `Healthy` is an inert filter-only tag; no dish carries it and there is no rule behind it. The engine derives only protein and carbs per person. `data/ingredients.md` has no Fat, Calories, or Fiber columns. (`app/web/src/lib/dishFilters.ts`, `engine/src/nutrition.ts`, `data/ingredients.md`.)
- Avocado toast does not exist; only `guacamole` does. New dish, not an activation.
- No plain rice dish exists (13 rice dishes, none plain). Search is case-insensitive substring on dish name (`library.ts` `swapPickerVisible`), so "plain rice" correctly matches nothing. The gap is a missing staple, not a search bug.
- No first-class `cuisine` field. Cuisine appears only as loose secondary tags on international dishes; Indian dishes have none.
- Fruit exists as both a `Fruit` category and a `fruit` tag, picked today as breakfast Option A position 2 on Mon/Wed/Fri (`engine/src/composition.ts`).
- The CSS items are real: the shared `Chip` is locked to 44px min-height; screen containers use no `env(safe-area-inset-left/right)`; `.day-card__edit` is absolutely positioned and floats over the title.

## Decisions (Rajat, 2026-06-15)

- **Healthy:** Add `Fat /100g` and `Fiber /100g` columns to the catalog. Compute calories per person via Atwater (4·protein + 4·carbs + 9·fat). A dish is healthy when its protein-to-calorie ratio and its fiber per serving both clear a threshold. Proposed defaults, tunable: at least 30 percent of calories from protein AND fiber per person at least 3 g. Healthy is computed only where the macro data exists; data-sparse dishes are treated as not-healthy so the filter never shows a false positive.
- **Fruit of the day:** Every day Mon-Sat carries a Fruit of the day, chosen from in-season fruit, rendered as its own section separate from breakfast. Breakfast becomes savoury-only.
- **Cuisine:** Add a first-class `cuisine` field to every dish in one migration; uncategorised dishes default to Indian.

## Streams

| Stream | Scope | Size | Layers / docs | Depends on | Status |
|---|---|---|---|---|---|
| A | iOS layout & CSS polish (items 1, 2, 8, 9) | small pattern | `app/web` only | none | MERGED #101 (prod-verified; 2 iOS-only items need a real-iPhone check) |
| B | Plain rice + Avocado toast (items 7, 6) | content | `data/dishes`, `data/ingredients.md`, photos | none | PR #100 CLEAN, awaiting Rajat content review |
| C | Healthy definition (item 3) | structural | `data/ingredients.md`, `engine.md` §11 + `engine/src/nutrition.ts` + tests, `app/web` predicate | none | PR #102 green; tuning gate to 25% (24 dishes); then crawl + merge |
| D | Fruit of the day (item 4) | structural | `engine.md` §2-3 + composition/schedule/generateWeek + tests, Convex schema, `app/web` DayCard + share canvas, `product.md` weekly loop | none | PR #103 green; needs crawl + prod regenerate of live week post-merge |
| E | Explore nested cuisine + meal-time filter (item 5, absorbs item 9 for Explore) | structural | `cuisine` field migration + bake, `app/web` Explore filter | D (meal-time taxonomy), B+C optional | not started |

### EM decisions taken (to log in DECISIONS.md via the batched docs PR)

- **D retires breakfast Option A.** Pulling fruit out of breakfast leaves the Mon/Wed/Fri 2-item breakfast needing two savoury items; Option B and C already provide that, so Option A (complete_meal + fruit) is retired. Consequence: complete_meal breakfasts appear only on the Tue/Thu single-item slot. Flagged to Rajat 2026-06-15.
- **Fruit of the day is cap-exempt** and selected longest-unused among in-season Fruit-category dishes, on all six days including Saturday.
- **Healthy thresholds:** at least 25% of calories from protein AND fiber per person >= 3 g (Rajat picked 25% from a sensitivity table: 30%->10 dishes, 25%->24, 20%->43); calories via Atwater (4/4/9). Tunable constants in `engine/src/nutrition.ts`.
- **Fruit of the day rotation:** fruit is selected longest-unused and rotated across the week's days (day index modulo pool size), so with a thin pool the distinct fruits spread across the first days and then repeat. Accepted by EM (sensible variety; reversible). With the current 3-fruit pool, Mon/Tue/Wed get distinct fruits, Thu/Fri/Sat repeat them.
- **CHANGELOG/DECISIONS** for this feature are batched into one docs PR at a checkpoint (the EM main dir cannot commit; matches the repo's existing docs-PR cadence).

### Stream notes

- **A** is whole-app CSS blast radius: it gets the full crawl across all tabs. Compact the shared `Chip` primitive (helps the pickers); the Explore filter row is replaced wholesale by E.
- **B** is a content batch on a `data/expansion-*` branch, reviewed by Rajat personally per development.md §9. Avocado toast is Breakfast; plain rice ("Steamed rice") is a Lunch carb (Category=Rice, subject to the once-per-week rice rule). Both need catalog rows and photos.
- **C** extends the §11 derived-macro pattern; calories and fiber stay derived from catalog macros, never hand-stored on the dish. The coverage report (§11.1) gains calories/fiber/fat columns to ratchet down. Frontend predicate moves off the inert tag onto the derived flag.
- **D** is the largest: it changes the breakfast rule (§3), the weekly schedule table (§2 and product.md §2), the `currentWeek` schema (a new fruit section is a breaking schema change needing a regenerate, see [[convex_schema_breaking_change]]), the Menu render, and the menu share image (so it falls under development.md §7 "changing what the menu image looks like"). Seasonal fruit selection keys on the existing season logic. Needs an in-season fruit pool per season; confirm the fruit library covers all three Bangalore seasons.
- **E** depends on D for the "Fruit of the day" meal-time option and on the new `cuisine` field. Per-cuisine counts come from the baked library. Reduces Explore pill height as part of the redesign.

## Sequencing

A and B run in parallel immediately (independent, no structural decisions left). C runs independently. D runs independently but is the heaviest. E runs last (depends on D and on the cuisine field from its own migration step).
