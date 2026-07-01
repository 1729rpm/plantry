# Adding dishes — content-batch playbook

The single procedure for adding a new dish (or a batch of dishes) to the library. Operational doc, sibling to `MAINTENANCE.md`: where `MAINTENANCE.md` is the playbook for the *automated* structural-change path (the slow loop), this is the playbook for the *manual, reviewed* structural-change path (content-batch dish adds).

Read this before authoring any new dish. It does not restate the specs; it orchestrates them and bakes in every trap we have actually hit. Authoritative homes it points at:

- Dish + catalog schema, field-by-field: `docs/engine.md` §12.
- The rules a dish feeds (eligibility, composition, recency, HP, protein diversity): `docs/engine.md` §1-§10.
- Photo system (model, prompt skeleton, params, env): `docs/engineering.md` §4 and `data/dish-photos/STYLE.md`.
- The change path, branch naming, definition of done, diagnosis card: `docs/development.md` §2, §4, §5, §9.

## 0. The legitimate path

New dishes go through a **reviewed content-batch PR**, never silently into the engine or rules (`docs/development.md` §9 anti-patterns). Branch: `data/expansion-<n>` (`docs/development.md` §2). Rajat reviews every batch personally. Structural rule/tag changes are a *different* path (the slow loop); a dish add never edits `docs/engine.md` or `engine/src/`.

Right-size first (`docs/product.md` §4, Principle 1): a single comment is not a new dish. Net-new dishes are a content-coverage decision (the library wants more of some kind of meal), not a response to one week's noise.

## 1. Read order

1. This file.
2. `docs/engine.md` §12 (the schema you are about to fill) and §1-§3 (so you tag `category`/`time`/`tags`/`seasons` such that the dish actually lands in a slot, not in limbo).
3. `data/dish-photos/STYLE.md` (the photo look and the per-dish detail mechanism).

## 2. The dish file

One file per dish at `data/dishes/<slug>.md`. The `<slug>` is the name lowercased, hyphenated, punctuation stripped; it is **unique and permanent** and must match the `name`. Two dishes that share a name are disambiguated by suffixing the id (`docs/engine.md` §12).

Pick the next free integer `id` (scan `data/dishes/` for the current max; ids are never reused). Frontmatter template:

```yaml
---
id: <next free integer>
name: <Display name>
category: <Gravy dish | Dry dish | Complete meal | Rice | Chapati | Paratha | Bread | Chilla | Accompaniment | Dessert | Keto | Fruit>
time: <Breakfast | Lunch>          # Fruit-category dishes still carry a time, but the Fruit slot is separate (§3.3)
tags: []                            # subset of [HP, complete_meal, complete_carb, fruit, cuisine_neutral]; HP only if it truly clears the protein bar
primaryIngredient: <dominant ingredient, or "Mixed Veg" when none dominates>
preferred: No                       # new dishes ship preferred: No
active: <No while batch-reviewing | Yes if shipping live now>
satiety: <Low | Medium | High>
prepMinutes: <integer>
seasons: <[Summer]|[Monsoon]|[Winter]|All>   # MUST include the current season to be eligible now
cuisine: <one of the taxonomy below; Indian by default>
complexity: <Easy | Medium | Hard>
buySpecially: <free text, only if an ingredient needs a special run>
photo: <slug>.jpg                   # set automatically by the photo tool; see §5
---

<One-line description. This first paragraph IS the description field.>

## Ingredients

| Ingredient | Quantity | Unit |
|------------|----------|------|
| <Catalog name, exact> | <number> | <g|ml|pcs> |

## Recipe

1. <step>
2. <step>
```

Field traps that have actually bitten us:

- **`tags` is for rule logic only.** Do not encode display facts as tags; cuisine is its own first-class `cuisine` field (§12), not a tag. One canonical source per fact.
- **`HP` is a rule input.** It drives one-HP-per-meal (§3) and protein diversity (§4.6). Tag it only if the dish genuinely is high-protein; a mis-tag distorts generation. It is keyed on the tag, never the dish name.
- **`category: Fruit`** routes a dish to the Fruit-of-the-day slot (§3.3), which is separate from breakfast and lunch. Fruit dishes are recency-exempt.
- **`seasons` gates eligibility now.** `[Winter]` on a dish added in June means it will not appear until October. Include the current Bangalore season (Summer Mar-May, Monsoon Jun-Sep, Winter Oct-Feb) or use `All`.
- **`preferred: No`** on every new dish. Promotion is Rajat's call later, not a default of authoring.

### Cuisine taxonomy (exactly one, required)

`Indian` (default for any dish with no international cuisine), `Italian`, `Chinese`, `Mexican`, `Greek`, `Spanish`, `Korean`, `Japanese`, `Continental`, `Vietnamese`, `Lebanese`, `Mediterranean`, `Thai`. §3 composition reads it for meal-level cuisine coherence (the Indian thali composes only `Indian` dishes; the international lunch form and its §3.2 selection use `cuisine !== "Indian"` for the anchor pool and same-cuisine companion match, with `cuisine_neutral` proteins eligible in any register); eligibility (§1) and §4 selection do not read it. It also feeds the Explore cuisine filter and the photo prompt's cuisine slot. See `docs/engine.md` §12.

## 3. Ingredients (catalog-first)

The `## Ingredients` table is parsed into rows; **every `Ingredient` value must resolve to a `data/ingredients.md` row by exact name** (a blocking validator). Rules:

- **Catalog before dish.** If the dish uses an ingredient not yet in the catalog, add the catalog row first. A bare/typo name fails the bake.
- **Reuse, never duplicate.** One row per ingredient. Mango and Pineapple were reused, not re-added, in the fruit batch (PR #104).
- **New catalog row needs:** `Group` (Proteins and Dairy | Fruit | Vegetables | Aromatics and Herbs | Pantry), `Unit` (g/ml/pcs), and macros (`Protein/Carbs/Fat/Fiber per 100g`) **for macro-relevant groups only** (Proteins and Dairy, Pantry, Vegetables). Aromatics/Herbs may stay blank. There is no `Other` catch-all: an ingredient left without an explicit group falls to Pantry, which renders last on the buy list. `pcs`-unit rows need `Grams per piece`. Set `Special: Yes` if it needs a supermarket/specialty run (it surfaces in the special-sourcing report). Honour the grouping judgment calls documented at the top of `data/ingredients.md` (Onion/Tomato/Lemon are Aromatics, Capsicum/Cucumber are Vegetables, Coconut Milk/Sprout are Pantry, fruit is its own Fruit group).
- **Untracked staples are never itemized.** Water, salt, common spices, base cooking oil, plain rice-as-water do not get ingredient rows; they live in recipe prose. A dish with no tracked ingredients ships an **empty but present** `## Ingredients` table (Steamed rice, PR #100).
- **Macros are derived, never hand-stored.** There is no per-dish protein/carb field. Fix a catalog row's macros and every dish using it is corrected (`docs/engine.md` §11).

## 4. Description and recipe

- The first body paragraph (prose before `## Ingredients`) is the one-line `description`. Keep it to one honest sentence.
- `## Recipe` after the table holds numbered steps (`1.`, `2.`, ...); each parses into one recipe entry.
- **No em dashes or long dashes** in description, recipe, or any other user-facing string (project style). Commas, parentheses, semicolons, or separate sentences instead.
- Every active dish must carry description + recipe + complexity (the coverage report asserts it; see §8). Ship dishes complete, not as stubs.

## 5. Photo

Full system: `docs/engineering.md` §4 and `data/dish-photos/STYLE.md`. The look is one shared realism skeleton; per-dish truth lives in a one-line detail. Steps:

1. **Write the per-dish detail line** in `data/dish-photos/details.md`: `<slug> | <form, cut, garnish, dry-vs-gravy state, texture>`. This is where you beat the model's wrong priors. A dish with no line falls back to its description (worse results).
2. **Load the key** (the tool reads `NVIDIA_API_KEY` from the environment; it lives in `~/.secrets/.env`, never in git):
   ```bash
   export NVIDIA_API_KEY=$(grep -E '^[[:space:]]*(export[[:space:]]+)?NVIDIA_API_KEY=' "$HOME/.secrets/.env" | head -1 | sed -E 's/^[^=]*=//' | sed 's/#.*//' | tr -d '"')
   ```
3. **Generate** (FLUX.1-dev via NVIDIA NIM):
   ```bash
   node scripts/generate-dish-photos.mjs <slug> [<slug> ...]   # named dishes
   node scripts/generate-dish-photos.mjs --dry-run <slug>      # print the assembled prompt, no API call
   node scripts/generate-dish-photos.mjs --one <slug>          # single fail-fast probe
   node scripts/generate-dish-photos.mjs --all                 # (alias --force) re-shoot EVERY active dish
   ```
   The tool writes `data/dish-photos/<slug>.jpg` (square 1024², JPEG, under ~300 KB via `sips`) and sets the dish's `photo:` field automatically. Set the detail line and commit the photo in the **same PR** as the dish file: the validator only fires on a declared `photo:`.
4. **Review every photo by eye.** Acceptance bar: correct ingredients/cut/colour, correct dry-vs-gravy state, candid-real (matte, not glossy/CGI), food well inside the frame. The tool guards mechanics only (luminance > 25 rejects black frames, size < 300 KB, square crop); it cannot judge whether the food is right.

### Prompt-refining: known FLUX priors and the fixes that beat them

Per-dish detail lines override the model's defaults. The proven counters (CHANGELOG #77, #80, #84):

| Prior the model wants | Wrong output | Detail-line fix |
|---|---|---|
| Paneer | Yellow cubes | "soft WHITE paneer cubes like fresh white tofu or white feta, never yellow" (crumbled: "white cottage cheese"). Improved but seed-sensitive; a hard FLUX ceiling on a few dishes. |
| Boiled egg in gravy | Cut, patterned/sunburst yolk | "whole peeled hard-boiled eggs, kept WHOLE and uncut, smooth glossy white, no cut yolk shown" |
| Okra | Whole pods | "cut into ROUNDS (not whole pods)" |
| Dry dish | Sitting in sauce | explicit "dry, no gravy, no pooling" |
| Rice | Fused/noodle-like mass | "loose separate individual grains, clearly distinct, never fused" |
| Dal | Smooth puree | "thick dal with visible cooked lentils, grainy, not pureed soup" |
| Shrikhand / thick set dish | Runny | "very thick dense, mounded high, stiff peaks, absolutely not runny" |
| Flatbread / chilla | Puffy, naan-like, garnished | "thin flat flatbread, not puffy, not naan"; "plain, no garnish" |
| Garnish | Flat-leaf parsley, centred sprig | skeleton already forces "fresh green coriander (cilantro), never parsley"; scatter, not a centre sprig |
| Coriander on a bare dish (bread, dessert, fruit, plain rice) | Coriander sprinkled on regardless | put **"no garnish"** in the detail line: the builder then drops the skeleton's coriander clause entirely (a negation alone fails; the named token leaks). See the next-but-one bullet (PR #121) |

Other photo facts to know:

- **Positive constraint only.** FLUX barely honours "no X". Name what is in frame (dish, vessel, blurred context), never what is forbidden. The skeleton already does this; keep detail lines positive too.
- **Content-filter token rewrites are automatic.** The tool rewrites "fried", "sweet-salty", "flat-leaf" (and kin) to visually-equivalent tokens before sending, because NVIDIA's filter false-positives on them and returns a black `CONTENT_FILTERED` frame. The rewrite touches the prompt string only, never the dish file. You do not need to pre-sanitize; just know that is why a black frame can appear.
- **Some dishes the filter declines outright** (historically a few rice/heavily-"fried" dishes). The tool skips them (no file, no `photo:` set) and the no-photo placeholder renders cleanly. Partial coverage never looks broken.
- **Per-dish seed gives variety**, derived from the slug; a re-run reproduces the same set. Re-roll a bad result by re-running the slug (seed varies across attempts on black frames) or by tightening the detail line. Do not edit the shared skeleton for one dish.
- **"no garnish" in a detail line suppresses the coriander clause.** The shared skeleton names "fresh green coriander (cilantro)" in every prompt, and FLUX renders that named token even when the detail line negates it, so bare categories (bread, dessert, fruit, plain rice) got coriander sprinkled on. The builder now reads the detail line: when it contains "no garnish" (case-insensitive), the coriander clause is replaced with a positive bare-surface statement so the token never reaches the model; savoury dishes (no opt-out) keep the cue unchanged. Keyed on the property, not the dish name (PR #121). Canonical home: `data/dish-photos/STYLE.md`.
- **"Missing photo" reports are usually a stale Workbox cache, not a defect.** Confirm prod serves the hashed `.jpg` at HTTP 200 before suspecting the repo; advise a hard PWA refresh.

## 6. Active vs inactive: the review gate

`active` is the master switch. An `active: No` dish can be fully built (description, recipe, photo) yet is invisible to every generation pool, coverage denominator, and report. This decouples authoring from going live:

- **Large or unfamiliar batch:** ship `active: No` (and `preferred: No`), complete with photos, for Rajat to review as real cards (the 50-dish batch, PR #97). Then a one-line-per-file flip to `active: Yes` activates them after review (PR #99).
- **Small, confidently-correct, seasonal-now batch:** may ship `active: Yes` directly (the 7 monsoon fruits, PR #104).

When in doubt, ship inactive and let Rajat flip.

## 7. Validate locally before the PR

```bash
npm run bake     # parses every dish + catalog, runs the blocking validators
npm test         # vitest: schema, ingredient-resolution, byte-identical round-trip, simulation, live-data snapshots
npm run reports  # coverage + pool + special-sourcing reports (sanity-check your dish appears where expected)
```

The blocking validators (`engine/src/data/validators.ts`) will fail the bake on: invalid frontmatter, **duplicate id**, **duplicate slug**, **slug not matching name**, an **out-of-set `tags` or `cuisine` value** (both are closed enums, so a typo is a parse failure, not a silent menu change), an **ingredient name that does not resolve** to the catalog, or a dish file that does **not round-trip byte-identical**. Fix at the source; do not hand-massage generated output.

## 8. The live-data snapshots that move (only when activating)

`engine/test/data/reports.test.ts` pins live counts. Activating dishes (or shipping active) moves them; an `active: No` dish moves nothing. Update the exact assertion(s):

- **`cov.withPhoto` → new active count.** Every active dish carries a photo, so this tracks `activeDishCount`. (Was 259 at last edit.)
- **`withDescription` / `withRecipe` / `withComplexity` === `activeDishCount`** must stay green: a dish shipped without those drops a count and fails. This is the guard that forces complete dishes.
- **Pool counts** if the dish changes a slot pool: the per-season slot-row count (19/season) and, for fruit, the Summer Fruit pool count (`toBe(5)` at last edit). Re-run `npm run reports` to read the new numbers, then pin them.
- **Special-sourcing array** if the dish uses a `Special: Yes` ingredient: the sorted-by-dishId array gains a row.

These are report snapshots tracking live data, not rules. Bump them to the truth; never loosen an assertion to make it pass.

## 9. Schema-field caution (rare)

Adding a *new frontmatter field* (not a new dish) is a different, heavier change: Convex validates every existing row against the new schema on deploy, so a new required field is a breaking change needing a wipe-and-regenerate or transitional-schema plan in the PR diagnosis card. A normal dish add uses only existing fields and never touches this.

## 10. Ship

- Branch `data/expansion-<n>` (or `data/photos-<n>` for a photo-only refresh). Commit from a worktree, never the main dir.
- PR description opens with the **diagnosis card** (`docs/development.md` §5): problem size, fix level (data row), why, generality, rejected alternatives.
- Append a **structural-changelog entry** to `data/changelog.md` (the append-only library audit: date, title, PR#, what changed, rationale).
- The EM appends a one-line entry to `docs/CHANGELOG.md` on merge, and logs any judgment call (active-vs-inactive, new catalog rows) to `DECISIONS.md`.
- Definition of done: all CI gates green (engine "Lint, typecheck, build, test" must be **pass**, not merely mergeable), diagnosis card present, no scope creep, simulation still passes.

## Checklist

- [ ] Right-sized: this is a content-coverage decision, not a reaction to one comment.
- [ ] `data/dishes/<slug>.md`: unique id, slug matches name, valid `category`/`time`/`tags`/`satiety`/`complexity`.
- [ ] `seasons` includes the current season (or `All`); `cuisine` set (Indian default); `preferred: No`.
- [ ] Every ingredient resolves to a `data/ingredients.md` row; new rows added with group + macros (macro-relevant groups) + special flag; untracked staples left out.
- [ ] One-line description + numbered recipe; no em dashes in user-facing text.
- [ ] `details.md` line written; photo generated, reviewed by eye, `photo:` set, committed in the same PR.
- [ ] `active` chosen deliberately (inactive for review, or active if small/correct/in-season).
- [ ] `npm run bake && npm test && npm run reports` green locally.
- [ ] `reports.test.ts` snapshots bumped to the new truth (only if activating).
- [ ] `data/changelog.md` entry; diagnosis card in the PR; branch `data/expansion-<n>`.
