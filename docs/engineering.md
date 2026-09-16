# Engineering

How Plantry is built. Stack, data layer split, the Convex schema, the build-time bake, the read and write paths, failure handling, concurrency, identity, the deploy model, DNS, environment variables, the share image family, the future ordering integration, the repository structure, the CI gates, and UI verification. The rules of the meal-planning engine itself live in `docs/engine.md`; this doc owns everything else technical.

## 1. Stack

| Layer                  | Choice                                     | Notes                                                                                                                                         |
| ---------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Engine (rules in code) | TypeScript module under `engine/`          | Pure functions, no I/O. Imported by the Convex functions, the frontend (the baked library), the scripts, and the tests.                       |
| Data parsing           | `yaml`, `zod`                              | `yaml` reads each dish file's frontmatter at bake time; `zod` holds the dish and catalog schemas the bake validates against.                  |
| Backend / API          | Convex                                     | Managed backend platform: a typed schema, server functions (queries and mutations), and live sync to clients over a WebSocket. No own server. |
| Frontend               | Vite + React 18 + TypeScript               | Installable PWA; `vite-plugin-pwa` with Workbox generates the service worker.                                                                 |
| Share rendering        | HTML canvas, `html-to-image`               | The menu image draws on a canvas; recipe sheets rasterise React components (§12).                                                             |
| Hosting (frontend)     | Vercel                                     | Static deploy from `main` through the GitHub integration; a preview deployment per pull request.                                              |
| Hosting (backend)      | Convex (managed)                           | Two deployments: production and dev. The free tier covers this scale.                                                                         |
| DNS                    | Cloudflare, domain registered at Spaceship | `plantry.mudgal.xyz` for prod, `plantry-dev.mudgal.xyz` for preview (§10).                                                                    |
| CI                     | GitHub Actions                             | The gates in §15, the Convex deploy on push to `main` (§9), and the slow-loop mark-applied action (`MAINTENANCE.md` §3).                      |
| Tests                  | Vitest                                     | Engine and frontend unit tests; the CI-sized gate subset (`docs/engine.md` §16.3).                                                            |
| UI crawl               | Playwright (optional dependency)           | The smoke and back-navigation crawls under `app/web/e2e/` (§16); not a CI step.                                                               |
| Lint and format        | ESLint, Prettier, stylelint                | All three are CI gates (§15).                                                                                                                 |
| Source control         | GitHub, repository `1729rpm/plantry`       | Squash merges to `main` through reviewed pull requests (`docs/development.md` §3).                                                            |

TypeScript is the single language across engine, backend, frontend, and scripts. The repository is one npm workspace with three packages: `@plantry/engine`, `@plantry/web`, and `app/convex`. Node 20 is the runtime in CI and locally. No library or platform service outside this table is added without Rajat's go-ahead (`docs/development.md` §7).

## 2. Data layer split

Plantry has two stores by design. The split is the load-bearing engineering decision; if a piece of data sits in the wrong place, fix the placement rather than working around it.

| Stays in git markdown                                                                                  | Stays in Convex tables                                                   |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| `data/dishes/<slug>.md`, one file per dish (frontmatter, ingredient rows, description, recipe)         | `currentWeek`, one row per week: the live Mon to Sat plan with its edits |
| `data/ingredients.md`, the ingredient catalog (one row per ingredient: group, unit, pack size, macros) | `weekArchive`, finalized past weeks, kept as provenance                  |
| `data/dish-photos/`, the dish photos plus the photo style spec and the per-dish detail map             | `manualChanges`, the append-only log of user edits to the week           |
| `data/menu_history.md`, the pre-app menu record, kept as provenance                                    | `dishDislikes`, the records-only dislike signal from Explore             |
| `data/changelog.md`, the structural-change audit                                                       | `favorites` and `wishlist`, the household's two shared lists             |
| `data/engine-requests.md`, the evolution-request ledger (`MAINTENANCE.md` §5)                          | `incidents`, the runtime trail written by generation and the slow loop   |
| `data/test-fixtures/`, the signals pass's dry-run fixtures                                             | `userProfiles`, device identity ("I am Rajat" or "I am Tuhina")          |
| `docs/engine.md`, the rules spec, and `engine/`, its executable form                                   |                                                                          |

Principle for the split: anything a human edits by hand stays in git, because git's pull-request, diff, and review workflow is what structural change wants. Anything the running app writes stays in Convex, because committing on every swap would be slow, noisy, and would turn git history into a transactional log. The audit-trail argument for git is preserved where it matters (library and rules); operational state carries author and timestamp inside Convex.

The record the engine generates from is the `currentWeek` table itself (§3, `docs/engine.md` §2.1). Nothing reads `weekArchive` or `data/menu_history.md`: both are provenance.

## 3. Convex schema

`app/convex/schema.ts` is the authoritative schema. The sketch below mirrors it; every table is listed.

```
currentWeek                            # index: by_weekStart
  weekStart: string                    # ISO date of the Monday
  status: "draft" | "final"
  slots: array of {
    day: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat"
    meal: "breakfast" | "lunch" | "fruit"
    dishes: array of {                 # one entry per dish in the meal, position-ordered
      dishId: number | null            # null for a custom dish
      customLabel: string | null       # set when dishId is null
      source: "generated" | "swapped" | "custom"
      author: "rajat" | "tuhina" | "system"
      updatedAt: number
      includeRecipe?: boolean          # share preference: include this dish's recipe sheet
    }
  }
  skippedDays?: array of {             # days marked skipped this week
    day: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat"
    reason: string
    author: "rajat" | "tuhina"
    skippedAt: number
  }
  generatedPlan?: array of {           # what the engine placed when the row was written
    day: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat"
    meal: "breakfast" | "lunch" | "fruit"
    dishId: number
  }
  version: number                      # optimistic concurrency (§7)
```

Each (day, meal) slot holds the engine's full pick list for that meal. Breakfast carries one or two dishes, weekday lunch two or three, Saturday lunch two or three; the counts are ceilings, so a plate with nothing due lands smaller (`docs/engine.md` §5). Every day Mon to Sat also carries a `meal: "fruit"` slot of exactly one dish, the Fruit of the day (`docs/engine.md` §9), outside the breakfast and lunch composition and outside the item cap. Per-dish `author` and `updatedAt` let the slow loop attribute who changed which dish in a multi-dish meal. `includeRecipe` lives on the week so it resets when a new week document is generated. `skippedDays` records days the household is eating out or away; the day's dishes stay in `slots` (restore is lossless), and skipped days are excluded from the grocery list, from the household record, and from the finalized archive.

`currentWeek` is the household record the engine reads (`docs/engine.md` §2.1): every row with an earlier `weekStart` than the week being generated is one record week, in its live edited state. `generatedPlan` is what makes the ledger replayable: it holds the (day, meal, dishId) list the engine placed when the row was written, so a later run can tell an engine placement from a hand swap-in (`docs/engine.md` §3.1). It is optional; rows written before the cutover week carry none and read as record-only weeks. The slot `meal` type (`breakfast | lunch | fruit`) and the narrower `breakfast | lunch` meal-time used at the add, delete, recipe, and custom-dish call boundaries both derive from one validator in `app/convex/lib/meals.ts`; `schema.ts` and every server consumer share that definition, so a new slot meal is a compile error in any unhandled consumer rather than a silent gap.

```
weekArchive                            # index: by_weekStart
  weekStart: string
  finalizedAt: number
  rows: array of {
    day: "Monday" | ... | "Sunday"
    meal: "Breakfast" | "Lunch" | "Fruit"
    dishName: string
    dishId: number
  }                                    # mirrors the menu_history.md row format

# Provenance, not signal. Finalize snapshots the week at the moment of finalizing
# and the household edits weeks after that moment, so the archive under-reports
# as-eaten rows for edited weeks. Nothing in generation, Explore, or the picker
# reads it; the record comes from currentWeek (docs/engine.md §2.1).

manualChanges                          # indexes: by_status, by_weekStart
  createdAt: number
  author: "rajat" | "tuhina"
  weekStart: string                    # ISO Monday, mirrors currentWeek
  day?: "Mon" | ... | "Sat"            # set by every kind; optional so a day-less kind could fit
  meal?: "breakfast" | "lunch" | "fruit"  # absent for day-level kinds
  position?: number                    # index into slots[].dishes; absent for day-level kinds
  changeKind: "swap" | "custom" | "delete" | "add" | "skip_day" | "restore_day"
  before: { dishId: number | null, customLabel: string | null }
  after:  { dishId: number | null, customLabel: string | null }
  reason: string                       # optional from the user; "" when none given
  status: "queued" | "in_review" | "applied" | "dismissed" | "reviewed_no_change"
  resolvedAt: number | null
  resolvedPr: string | null

# One row per user edit to the live week. Dish-level kinds (swap, custom, delete,
# add) carry meal and position and the before/after pick state; add uses a null
# before, delete a null after. A Fruit-of-the-day swap is a swap row with
# meal: "fruit" and position 0; the fruit slot takes no add, delete, or custom
# dish. Day-level kinds (skip_day, restore_day) carry the day and null entries on
# both sides. This table is the data behind the Changes log.

dishDislikes                           # index: by_status
  createdAt: number
  author: "rajat" | "tuhina"
  dishId: number
  reason: string | null                # optional
  status: "queued" | "applied" | "dismissed"
  consumedWeekStart: string | null     # the ISO Monday of the sitting that consumed the row
  resolvedPr?: string                  # the merged slow-loop PR URL, set by the mark-applied action

# A records-only signal: the dislike affordance writes one row and does nothing
# in-session (no re-rank, no hide). The signals pass of /maintain clusters
# dislikes and may deactivate a dish under right-size discipline; the mark-applied
# action marks every consumed row applied on merge.

favorites                              # index: by_dishId
  createdAt: number
  author: "rajat" | "tuhina"
  dishId?: number                      # library favorite; absent for a custom favorite
  customLabel?: string                 # free-text favorite; absent for a library favorite

# Exactly one of dishId / customLabel is set; the mutation enforces it. Generation
# guarantees every library favorite a place in the week (docs/engine.md §8); a
# custom favorite has no library id, so it is display-only.

wishlist                               # index: by_dishId
  createdAt: number
  author: "rajat" | "tuhina"
  dishId: number                       # library dish id; no custom entries

# A list the household reads, not a queue the engine consumes: nothing in
# generation reads this table. A row is placed into the week through the ordinary
# day picker and stays on the list afterwards. Removal keys on dishId, so either
# user removes either person's row.

incidents                              # index: by_resolved
  createdAt: number
  source: "engine" | "backend" | "frontend"
  severity: "info" | "warn" | "error"
  context: object                      # structured fields
  message: string
  resolvedAt: number | null

# The routine trail and the problem log in one table. Generation writes one info
# row per constraint repair (docs/engine.md §6 step 6) and warn rows for a
# favorite no slot accepted or a day over the prep ceiling; the mark-applied
# mutations write a warn row for an id they could not resolve. The health and
# signals passes of /maintain read it.

userProfiles                           # index: by_deviceId
  deviceId: string
  identity: "rajat" | "tuhina"
  installedAt: number
```

`manualChanges`, `dishDislikes`, and `incidents` are the signal channels the signals pass of `/maintain` consumes. Manual changes are observed behavior, one row per swap, custom dish, delete, add, day skip, or day restore, carrying the user's reason when one was given. Dislikes record dishes the user does not want, surfaced from Explore. Incidents are the engine's and the slow loop's own trail. All three carry a status the mark-applied action moves on merge, so every consumed row leaves the queue the same way (`MAINTENANCE.md` §3). `favorites` and `wishlist` are not signal channels: they are live household state the app reads and writes directly.

The library and the rules are not in Convex. Convex functions load them by importing the typed module the bake emits from the markdown files (§4).

Convex validates every existing row of every table against the schema at deploy time, so a schema change must be additive (an optional field, a widened union) or it must ship with a plan for the rows that no longer validate; the PR's diagnosis card names which (`docs/development.md` §5).

## 4. Build-time bake of library + rules

Convex functions and the frontend cannot read the markdown files at runtime. `npm run bake` (`engine/scripts/bake.ts`) reads every `data/dishes/<slug>.md` file plus the `data/ingredients.md` catalog and emits one gitignored module, `engine/src/data/library.ts` (typed export of the dishes, the flattened per-dish ingredient rows, the catalog, and the catalog-derived pack-size list), reachable as the engine package's `./library` export path. The Convex functions and the frontend import it, so the engine can rank and the share family can render on the phone with no backend call. The engine module itself reads typed objects and never markdown.

The bake also parses and validates `data/menu_history.md`, so the file cannot rot, but it emits no module for it and nothing imports it: the household record comes from `currentWeek` (§3).

Round-trip discipline: the bake's parser is the parser the round-trip tests use, so drift between markdown source and bundled output fails CI. Before emitting, the bake runs the blocking validators: every dish file parses against the schema, every catalog row has a group, every dish ingredient row resolves to a catalog row by exact name, every pack size in use is declared, dish ids and slugs are unique, slugs match filenames, and the menu history resolves against the library. Bad data fails the build rather than reaching the bundle. The bake runs before typecheck in CI and before every frontend build and test run (`prebuild` and `pretest` hooks), and a fresh worktree needs it before anything compiles (`docs/development.md` §2).

### Dish-photo generation

Dish photos are produced by an offline build-time tool, `scripts/generate-dish-photos.mjs`, run by hand outside the app and the CI pipeline. It builds each prompt from a shared realism skeleton with three slots: the dish name, the cuisine, and a per-dish visual-detail line. The cuisine-aware skeleton lives in `data/dish-photos/STYLE.md`; the per-dish detail line comes from `data/dish-photos/details.md`, a committed one-line-per-dish map of form, cut, garnish, dry-versus-gravy state, and texture (a dish with no line falls back to its dish-file first paragraph). The prompt aims for candid realism (a photo that looks like a real person photographed their own meal) and is positive-constraint: it names only what is in frame, never what is forbidden, because the FLUX model family barely honours negative instructions. The cuisine comes from the dish's first-class `cuisine` field (`docs/engine.md` §15) as a bare adjective ("a home-style {cuisine} dish"), Indian by default. Generation parameters are tuned for realism: `cfg_scale` 3.0 (lower guidance renders looser, more natural food and cuts the over-styled gloss), `steps` 40, 1024² square, and a per-dish base seed derived from each dish's slug so vessels, backgrounds, and angles vary across the library while a re-run reproduces the same set (`IMAGE_SEED` pins every dish to one seed for A/B testing a prompt change). The prompt assembler substitutes a visually-equivalent synonym for the filter-tripping tokens "fried", "sweet-salty", and "flat-leaf" before sending, because the provider's content filter false-positives on those exact tokens; the substitution touches only the assembled prompt string, never the canonical dish description on disk. The per-dish prompt craft (the realism cues, the known FLUX priors and the detail-line counters that beat them, the conditional coriander-garnish clause) lives in `ADDING-DISHES.md` §5 and `data/dish-photos/STYLE.md`; this section owns the generation pipeline, those own the prompt content.

The active provider is FLUX.1-dev via NVIDIA NIM (`ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-dev`), a JSON endpoint that returns the image as base64 in `artifacts[0].base64`; the tool reads `NVIDIA_API_KEY` from the environment. A Hugging Face FLUX.1-schnell path is kept in the tool as a dormant fallback, selected with `PROVIDER=hf`. The decoded image is normalized with macOS `sips` to a square 1024² JPEG under about 300 KB, so there is no npm image library. For each dish the tool writes `data/dish-photos/<slug>.jpg` and sets the dish's `photo:` frontmatter. Generation parallelizes: a bounded concurrency pool (`PHOTO_CONCURRENCY`, default 6 in flight) runs against a client-side sliding-window rate limiter (`PHOTO_MAX_RPM`, default 35, under NVIDIA's free-tier cap of about 40 a minute), with exponential backoff plus jitter and retry on HTTP 429, 500, and 503. `--all` (alias `--force`) regenerates every active dish; named slugs re-roll targeted dishes; `--dry-run` prints the assembled prompt without a call. A render the provider's safety filter rejects comes back as a black frame with `finishReason: CONTENT_FILTERED`; the tool detects that (and a luminance check guards against any other all-black frame), skips the dish without writing a file or setting `photo:`, and leaves it for the placeholder.

Coverage is complete: every active dish carries a photo, and the coverage report asserts `withPhoto` equals the active dish count rather than a fixed number, so the library can grow without a brittle count to bump. The no-photo placeholder (the `Thumb` diagonal-stripe fallback in `app/web/src/components/primitives.tsx`) remains the graceful default for any dish that ships without one or that the provider declines to render.

## 5. Read paths and write paths

Every browser-callable function lives under `app/convex/`; the read-only listing queries sit in `app/convex/queries/`. Every mutation that edits household state takes an `author` argument and rejects a value other than `"rajat"` or `"tuhina"` (`app/convex/lib/author.ts`). Mutations return a tagged union: `{ ok: true, version }` or `{ ok: false, reason }` with a recoverable reason the UI handles inline; only a programming error (a missing author, an unknown week on a query) throws.

**Read (frontend opens):**

1. The PWA loads from Vercel; the service worker serves the precached app shell offline.
2. The app connects to Convex over a WebSocket. Library and rules are already bundled into the JS (§4).
3. `queries/week:getCurrentWeek({})` returns the live week and streams every edit either user makes; `queries/activity:listManualChangesForWeek({ weekStart })` backs the Changes log and the unread badge; `queries/wishlist:listWishlist({})` backs the Yours badge.
4. The Menu screen saves each loaded week to `localStorage` (`plantry:lastWeek:v2`) and renders that copy under an offline banner when the backend is unreachable (§6).

**Read (swap picker alternatives):**

1. The frontend calls `swap:getSlotAlternatives({ weekStart, day, meal, position, limit? })`.
2. The query builds a non-restrictive candidate pool: every dish in the library that is Active, in-season for the current Bangalore season, and non-Fruit, so a breakfast dish is reachable from a lunch slot and vice versa. For a fruit slot the pool is category-based instead: every Active, in-season, Category=Fruit dish (`docs/engine.md` §9). There is no per-position eligibility filter; the composition rules of `docs/engine.md` §5 are not enforced.
3. The query derives the recency tier off the live week itself (the set of dish ids its slots already hold, excluding the position being ranked) and passes it to the engine, which ranks the pool by `docs/engine.md` §13: a head of dishes not already on that day, ordered by that tier then dish id, then a tail of the same-day repeats in the same order. The query then stable-partitions slot-meal-matching dishes to the front for a breakfast or lunch slot. No history beyond the live week is read.
4. The dish currently at this position is filtered out; the frontend renders the ranked list with search and filter pills that reach every dish, and the user picks any dish.

**Read (grocery list):**

1. The frontend calls `groceryList:getGroceryList({ weekStart, selectedDays? })`. `selectedDays` (optional, short day names "Mon" to "Sat") narrows the buy list to the upcoming days the household chose to order for; the Grocery screen derives it with a time-aware default off the device clock (today plus tomorrow before 11 AM, tomorrow plus the day after from 11 AM). An explicit user selection persists to `localStorage` (`plantry:groceryDays`, one `{ weekStart, days }` record) so it survives a tab switch and the PWA being evicted in the background; a stored selection for a different `weekStart` is ignored, so a new week falls back to the default, and a stored day that has since become past or skipped is dropped on load. Omitting `selectedDays` returns the whole non-skipped week, which is what a future ordering integration calls.
2. The query groups the week's library-dish picks by day, keeps only the selected days when `selectedDays` is present, and hands the day-tagged shape plus `currentWeek.skippedDays` to the engine aggregator, which drops skipped days before summing. Custom dishes (null `dishId`) contribute nothing. The result is `{ groups: [{ group, items }] }` in the fixed group order (Proteins and Dairy, Fruit, Vegetables, Aromatics and Herbs, Pantry last; empty groups omitted; no catch-all), each item carrying `ingredient, quantity, unit, tracked` and, for a tracked ingredient, `packs` and `packTotalGrams`. This is the structured shape the ordering integration (§13) consumes.

**Read (activity feed):**

1. The frontend calls `queries/activity:listManualChangesForWeek({ weekStart })`.
2. The query returns every `manualChanges` row for the week, newest first, all statuses, because the Changes log is a history and not a work queue. The frontend phrases each row's headline from `changeKind`, `before`, and `after`; no enum value reaches the screen. Each identity keeps its own seen marker in `localStorage` (`plantry:changesSeenAt:<identity>`, the newest `createdAt` it has looked at), and the avatar badge counts the other person's rows above it.

**Read (explore feed):**

1. The frontend calls `explore:getExploreFeed({ weekStart })`.
2. The query loads the record through `loadRecord` (§3), reduces it with the engine's `deriveRecordStats`, and feeds `rankExploreV6` those stats plus the library, the season for `weekStart`, the record, and the nutrition inputs. The engine returns the eligible (Active, in-season) dishes with no as-eaten row in any scope, ranked familiar-but-new against record rows of the candidate's own meal type, each with its `dominantAffinity` key (`shared-ingredient`, `protein-match`, or `familiar-category`). The query then removes every dish already placed in the week being eaten (the record deliberately excludes the current week, so it is read separately) and projects `{ dishId, name, dominantAffinity }`. The UI phrases the "why it fits" line from the key; no UI prose leaves the engine. With an empty record every eligible dish is never-eaten, so the feed is the whole active in-season library ranked by id. The wishlist never hides an Explore dish.

**Write (swap a dish):**

1. The frontend optimistically updates the UI.
2. `swap:swapDish({ author, weekStart, day, meal, position, newDishId, reason, version })` validates: `version` matches the loaded version (§7); the (day, meal) slot exists and `position` is within `slot.dishes`; the new dish is in the library, Active, and in season. For a breakfast or lunch slot the only category guard is the inverse of the fruit slot's: a Category=Fruit dish is rejected with `dish-is-fruit`, and meal-time is not enforced, so a cross-meal dish is an accepted, deliberate pick whose composition mismatch becomes slow-loop signal (`docs/product.md` §4 Principle 4). For a fruit slot the dish must be Category=Fruit (`dish-not-fruit`). The `reason` is optional: it is trimmed and an empty one stores as "". The composition rules of `docs/engine.md` §5 are not validated at swap time.
3. On success the slot's `dishes[position]` becomes `{ dishId: newDishId, customLabel: null, source: "swapped", author, updatedAt: now }` (an `includeRecipe` flag on the position carries over), `version` increments, and a `manualChanges` row inserts in the same Convex transaction carrying the slot's pre-change `before`, the new `after`, the user's `reason`, `changeKind: "swap"`, and `status: "queued"`. The grocery list is re-derived on read.
4. On failure the frontend rolls back. Recoverable reasons: `version-mismatch`, `no-current-week`, `no-such-slot`, `no-such-position`, `dish-not-in-library`, `dish-is-fruit`, `dish-not-fruit`, `dish-not-active-or-in-season`.

**Write (custom dish):** A custom dish is a free-text dish that is not in the library. It can replace a position or be appended as an extra dish; both record `changeKind: "custom"` and feed the slow loop, which may promote a repeatedly requested custom dish into a library dish.

1. To replace a position, the frontend calls `weekMutations:addCustomOneOff({ author, weekStart, day, meal, position, customLabel, reason, version })`, which patches `slot.dishes[position]` to `{ dishId: null, customLabel, source: "custom", author, updatedAt: now }`.
2. To append an extra dish, the frontend calls `weekMutations:appendCustomDish({ author, weekStart, day, meal, customLabel, reason, version })` (no `position`), which pushes the same custom pick onto `slot.dishes` and returns the new `position`. The per-day cap is a generation-time constraint and is not enforced here.
3. Either way `version` increments and a `manualChanges` row with `changeKind: "custom"` inserts in the same transaction; an append carries a null `before`. The fruit slot takes no custom dish. Recoverable reasons: `version-mismatch`, `no-current-week`, `no-such-slot`, and `no-such-position` on the replace path.

**Write (delete a dish):**

1. The frontend calls `dayMutations:deleteDish({ author, weekStart, day, meal, position, reason, version })`.
2. It validates author, version, slot, and position (the `reason` is optional and trimmed), removes `slot.dishes[position]`, increments `version`, and inserts a `manualChanges` row with `changeKind: "delete"`, `before` the removed pick, `after` a null entry. Delete is permissive: the day may end below its composition shape. Recoverable reasons: `version-mismatch`, `no-current-week`, `no-such-slot`, `no-such-position`.

**Write (add a library dish to a day):**

1. The frontend calls `dayMutations:addDish({ author, weekStart, day, meal, newDishId, reason, version })`. The Add sheet derives `meal` from the chosen dish's own meal-time, and the Explore and wishlist "use this week" paths do the same, so the user never picks a meal for a library add.
2. It validates author, version, slot, and the dish: in the library, Active, in season, and of the meal-time the slot names (`dish-not-meal-time` otherwise; this is the one meal-time-strict edit). No composition check. It appends `{ dishId: newDishId, customLabel: null, source: "swapped", author, updatedAt: now }` to `slot.dishes`, increments `version`, inserts a `manualChanges` row with `changeKind: "add"` (`before` a null entry, `after` the added dish), and returns the new `position`. Recoverable reasons: `version-mismatch`, `no-current-week`, `no-such-slot`, `dish-not-in-library`, `dish-not-meal-time`, `dish-not-active-or-in-season`.

**Write (skip or restore a day):**

1. The frontend calls `dayMutations:skipDay({ author, weekStart, day, reason, version })` or `dayMutations:restoreDay({ author, weekStart, day, reason, version })`.
2. `skipDay` appends `{ day, reason, author, skippedAt: now }` to `currentWeek.skippedDays` (rejecting `already-skipped`); `restoreDay` removes the day's entry (rejecting `not-skipped`). The day's `slots` are never touched, so restore is lossless. Each increments `version` and inserts a day-level `manualChanges` row (`changeKind: "skip_day"` or `"restore_day"`, no meal or position, null entries on both sides). Recoverable reasons: `version-mismatch`, `no-current-week`, and the kind-specific `already-skipped` or `not-skipped`.

**Read (the household's shared lists):**

1. The frontend calls `queries/favorites:listFavorites({})` and `queries/wishlist:listWishlist({})`, one subscription each, both backing the Yours tab; the favorites list also backs the "Mark as favorite" row in the day editor's dish action sheet and the wishlist backs the Explore heart.
2. Each returns the whole shared list with the author on every row. Neither is week-scoped: the lists outlive any one week.

**Write (favorites and wishlist):**

1. The frontend calls `favorites:addFavorite({ author, dishId })` for a library favorite, `favorites:addCustomFavorite({ author, customLabel })` for a free-text one, and `favorites:removeFavorite({ dishId })` or `favorites:removeFavoriteById({ id })` to remove either person's row. The wishlist mirrors this with `wishlist:addToWishlist({ author, dishId })` and `wishlist:removeFromWishlist({ dishId })`.
2. None of these writes a `manualChanges` row: they change a standing list, not this week's menu, so the Changes log does not record them. Removal keys on `dishId` (or the row id for a custom favorite) rather than on the author. Adds are idempotent against the `by_dishId` index, so a double tap cannot duplicate a row.

**Write (include a recipe in the share):**

1. The frontend calls `dayMutations:setIncludeRecipe({ author, weekStart, day, meal, position, include, version })` from the toggle on the dish detail sheet.
2. It sets `includeRecipe` on `slot.dishes[position]` and increments `version`. A share preference is not a menu change, so no `manualChanges` row is written. Recoverable reasons: `version-mismatch`, `no-current-week`, `no-such-slot`, `no-such-position`.

**Write (finalize the week):**

1. `weekMutations:finalizeWeek({ author, weekStart, version })` is browser-callable but has no UI affordance; it is run by hand when a week is closed.
2. It validates `author`, version, that the week exists, and that it is not already `final`. It appends a `weekArchive` row whose `rows` mirror the `menu_history.md` format (long-form day, capitalised meal, dish name from the baked library, dish id), then flips `currentWeek.status` to `"final"` and increments `version`. Skipped days and custom dishes are excluded from the archive; the day's `slots` are untouched. The archive is provenance; `currentWeek` stays the record generation reads. Recoverable reasons: `version-mismatch`, `no-current-week`, `already-final`.

**Generation (generate the week):**

1. `generateWeek:generateCurrentWeek({ weekStart })` is an `internalMutation`, not browser-callable. The EM triggers it by hand (`npx convex run --prod generateWeek:generateCurrentWeek '{"weekStart":"<Monday>"}'`, with Rajat's per-action approval); there is no scheduler. It takes no rng and no requested-dish argument: the engine is deterministic (`docs/engine.md` §14) and nothing supplies a request in production.
2. It loads four inputs. The **record** comes from `app/convex/lib/record.ts`: `loadRecord(ctx, weekStart)` returns every `currentWeek` row with an earlier `weekStart`, each reduced by `recordWeekFromDoc` to its live slot state minus skipped days minus null-`dishId` custom picks, with its `generatedPlan` passed through (null for a pre-cutover row). The **favorites** are every `favorites` row, `createdAt` ascending; the library ones go to the engine as the guaranteed-placement set (`docs/engine.md` §8) and custom favorites, which carry no `dishId`, are skipped. The **season** is read off `weekStart`. The **nutrition inputs** (the ingredient rows and the catalog from the baked library) feed the exploration score's protein-band signal.
3. The engine replays the ledger from the record (`docs/engine.md` §3.1), pins the favorites, and plans and places the week. A favorite that no slot accepts is left unplaced and named in one `warn` incident, so the run still produces a complete menu. The favorites list is standing state, so nothing is consumed or marked.
4. If a `currentWeek` row already exists for the same `weekStart` it is deleted and replaced; the new row starts at `version: 1`, `status: "draft"`. The mutation writes the week's slots **and its `generatedPlan`**, the (day, meal, dishId) list the engine placed. Without it the next run cannot separate an engine placement from a hand swap-in, so the write is not optional.
5. It then writes the run's incidents, all `source: "engine"`: one `warn` per engine incident, one `warn` naming any favorite no slot accepted, one `info` per constraint repair the pass made (the routine trail, in order), and one `warn` per day whose protected items alone exceed the prep ceiling.

**Record maintenance (internal functions, no UI):**

1. `recordExport:exportRecord`, an `internalQuery` returning the same `RecordWeek[]` shape `loadRecord` builds, for a read-only pull of the production record (`npx convex run --prod recordExport:exportRecord '{}'`). Its output is the fixture the `docs/engine.md` §16 gate harness and the monthly engine monitor run against, so both measure the real record.
2. `promoteCustomPick:promoteCustomPick`, an `internalMutation` that re-points one custom pick (`weekStart, day, meal, position, dishId`) at a library id once that dish is authored. It touches only a pick whose `dishId` is null and whose `customLabel` matches the argument, and it writes no `manualChanges` row, because a re-point is a data repair rather than a household edit. A custom pick contributes no record row until it is promoted this way (`docs/engine.md` §2.1). A session-start hook in the EM's main directory lists un-promoted custom picks so none is forgotten.
3. `seed:seedCurrentWeek` and `recordSeed:seedRecordWeeks`, `internalMutation`s the dev deployment is seeded through (`scripts/seed-dev-week.mjs` runs the real generation path against dev; `scripts/seed-dev-record.mjs` loads past weeks from `scripts/fixtures/record-sample.json`). Never run against production.

**Slow-loop reads (the maintenance sitting):** `queries/manualChanges:listQueuedManualChanges`, `queries/dishDislikes:listQueuedDislikes`, and `queries/incidents:listIncidents` list the queued rows of the three signal channels through their status indexes, `createdAt` ascending; `queries/manualChanges:listManualChangesByWeek({ fromWeekStart, toWeekStart })` returns every row of any status in an inclusive ISO-Monday range for the monitor. The write-back on merge goes through the four `internalMutation`s in `manualChangesMutations.ts`, `incidentsMutations.ts`, and `dishDislikesMutations.ts` (`MAINTENANCE.md` §3.2).

## 6. Failure handling and recovery

The system degrades rather than blanks, at four layers.

- **Generation reports, it does not repair silently.** The engine's own constraint pass makes deterministic repairs and every repair is written as an `info` incident; what it cannot clear (an unplaceable favorite, a day over the prep ceiling, an over-cap day) is written as a `warn` incident and the week still lands. Incidents are read by the maintenance sitting, not shown in the app. There is no automatic fallback to a previous week: a generation either commits a complete week or throws before the replace, in which case the existing row stays.
- **Mutations fail closed and recoverably.** Every write validates its inputs and returns a tagged `{ ok: false, reason }` for a recoverable condition (a stale version, a missing slot, an ineligible dish) that the UI handles inline; only a missing or invalid `author` throws. All write mutations require an `author` argument; the mutation rejects writes without it. Two writes that must land together (the slot patch and its `manualChanges` row) run in one Convex transaction, so the log can never disagree with the week.
- **The frontend survives a broken screen.** A React error boundary (`app/web/src/components/ErrorBoundary.tsx`) wraps the active screen below the tab bar, so an unhandled render or query error on one screen degrades to a recoverable fallback card with a reload action while navigation survives. It logs to the console and shows no stack trace.
- **The app opens without the network.** The Workbox service worker precaches the app shell (JS, CSS, HTML, icons), activates a new build on the next load (`skipWaiting` plus `clientsClaim`, so no device keeps serving a stale bundle), and falls back to `index.html` for navigation. The Menu screen keeps the last loaded week in `localStorage` and renders it under the banner "Showing the last menu saved on this phone." when Convex is unreachable; the share family renders from that copy too, so sharing works offline.

The slow-loop write-back has its own best-effort rule: the mark-applied mutations never throw, and an id they cannot resolve becomes a `warn` incident rather than a failed merge (`MAINTENANCE.md` §3.2).

## 7. Optimistic concurrency

Each `currentWeek` document carries a `version` field. The frontend includes the loaded version on every mutation. The mutation refuses with `version-mismatch` if the version on disk has changed since load; the UI tells the user the week changed under them and the live subscription delivers the other person's edit, after which the action can be retried. No locking, no automatic three-way merge. Standing-list writes (favorites, wishlist) carry no version because they are idempotent per dish.

## 8. Identity and auth

- **URL gate:** a shared six-digit passcode on the frontend. Until it is entered on the keypad, the app stays on the gate. The passcode value is a frontend build-time environment variable (`VITE_PLANTRY_PASSCODE`, §11); the gate validates entry against it client-side and records a passing entry in `localStorage` (`plantry:auth`, with a timestamp) so repeat visits skip the gate for seven days. When the variable is unset the gate is off. It is a light private-URL gate, not an authentication boundary, and the value itself is a secret: it lives only in the gitignored `app/web/.env.local` and the Vercel project environment, never in git, the CHANGELOG, or a PR.
- **Device profile:** after the passcode, the user picks "I am Rajat" or "I am Tuhina" once per device. The choice is stored in `localStorage` (`plantry:identity`) as the UI's source of truth and mirrored to `userProfiles` keyed by a generated device id (`plantry:deviceId`) through `users:setUserProfile`. Every mutation reads the local choice and attaches it as `author`. The profile sheet switches identity. No per-user accounts.

## 9. Deploy model

- **Production:** the `main` branch. The GitHub-Vercel integration builds the frontend (`vercel.json`: install, bake, build `@plantry/web`, serve `app/web/dist`) and deploys it to `plantry.mudgal.xyz`. The `Deploy Convex` GitHub Action (`.github/workflows/deploy-convex.yml`) runs on a push to `main` that touches `app/convex/`, `engine/`, `data/`, or itself: it bakes the library, then runs `npx convex deploy --yes` against the production deployment `disciplined-chameleon-263` using the `CONVEX_DEPLOY_KEY` secret. One deploy runs at a time; a newer push cancels an in-progress one.
- **Preview:** every pull request gets a Vercel preview deployment of the frontend, behind Vercel's deployment protection (§16 explains how the crawl gets through). There is no per-PR Convex deployment: a preview frontend talks to the Convex URL in the Vercel preview environment, which is the dev deployment `lovely-curlew-631`. Dev is also what local development and the UI crawl run against; it is seeded by hand (§5) and carries no household data.
- **Deploy ordering:** the two production deploys are asynchronous, so a frontend can briefly run against the previous backend or the reverse. A change to a Convex function's signature therefore ships backend-compatible first (a new argument is optional, an old one keeps working) so the frontend never blanks in the gap.
- **Branch convention:** `main` is production; every other branch follows `docs/development.md` §2. Every PR gets a frontend preview whatever its prefix.
- **Convex module naming:** files under `app/convex/` are camelCase; a hyphenated filename breaks the deploy silently. The `Deploy Convex` run is verified after every merge that touches `app/convex/`.

## 10. DNS records

`mudgal.xyz` is registered at Spaceship and delegated to Cloudflare nameservers; Cloudflare answers every lookup for the domain and holds the two Plantry records. Both were created by the Vercel-Cloudflare integration when the custom domains were added, so their target is the project-specific hostname Vercel assigns (shown under the project's Domains settings) rather than the generic `cname.vercel-dns.com`. Either target works; if the Vercel project is ever recreated, the target changes and the records need re-pointing.

| Type  | Name          | Value                                          | Notes                                                                        |
| ----- | ------------- | ---------------------------------------------- | ---------------------------------------------------------------------------- |
| CNAME | `plantry`     | `414bed3bf3dfc259.vercel-dns-017.com` (Vercel) | Production frontend. Vercel issues the cert.                                 |
| CNAME | `plantry-dev` | `414bed3bf3dfc259.vercel-dns-017.com` (Vercel) | Preview frontend. Vercel alias updates to point at the current PR's preview. |

Convex deployments have their own `<deployment>.convex.cloud` URLs; the frontend reads the one it talks to from `VITE_CONVEX_URL` at build time. No DNS records are needed for Convex.

## 11. Environment variables

**Frontend build (`app/web/.env.local` locally, the Vercel project environment in deploy; `app/web/.env.example` is the template):**

- `VITE_CONVEX_URL`: the Convex deployment URL, production or dev per environment.
- `VITE_PLANTRY_PASSCODE`: the shared passcode the gate validates against (§8). Build-time, so it is baked into the bundle; a private-URL gate, not a secret boundary, but never committed. Unset means no gate.

**GitHub Actions secrets:**

- `CONVEX_DEPLOY_KEY`: the production deploy key the `Deploy Convex` action and the slow-loop mark-applied action use.

**Convex deployment:** no application-level variable is required; every function reads its inputs from the database and the baked library. The placeholders in `app/convex/.env.example` are unused by any function.

**Offline tooling (the local environment of whoever runs the tool; the keys live in `~/.secrets/.env`, extracted one at a time):**

- `NVIDIA_API_KEY`: the NVIDIA NIM key the dish-photo tool (§4) reads. `HF_TOKEN` is read instead when the tool runs with `PROVIDER=hf`.
- `VERCEL_AUTOMATION_BYPASS_SECRET`: the Vercel "Protection Bypass for Automation" token the pre-merge crawl uses to reach a protected preview (§16). `VERCEL_TOKEN` (the Vercel API key) lists deployment URLs and is not used by the app.
- `CRAWL_URL`: points the smoke crawl at a deployed URL instead of a local build (§16).

## 12. Share image family

The shareable output is a family of PNGs sent together, not a single image: a menu image and one recipe sheet per dish the user marked "include recipe when sharing" that week. The user shares the week from the Menu's "Share this week" button, which opens a swipe-rail preview (the menu, then the recipe sheets) and a Send action.

**Surface.** The images are a separate surface from the PWA chrome: calm, label-free, legible at phone size on WhatsApp, on a warm cream card. No tags, no day-type labels, no internal menu numbers, no ingredient-reuse callouts (`docs/product.md` §4 Principle 7).

- **Menu image:** a compact single-column ledger, one row per day, with the day name and date badge alongside that day's meals. A skipped day renders "Skipped" in place of its meals. The near-square aspect keeps the export's longest edge under WhatsApp's downscale cap (about 1600 px), so it ships un-downscaled; shared-image quality is governed by aspect ratio and that cap, not by export resolution.
- **Recipe sheets:** one per dish whose `currentWeek` entry carries `includeRecipe: true`, de-duplicated by dish id. Each sheet shows the dish name, cook notes (skill, equipment, buy-specially, pre-prep where present), and the numbered recipe; fields degrade gracefully where enrichment is incomplete.

**Rendering.** The images are generated client-side; there is no Convex action and no headless render in the share path. The menu image renders on an HTML `<canvas>` (`app/web/src/components/menuShareCanvas.ts`): a layout pass measures every text line with `measureText` and breaks it manually (hard-breaking any single over-long token), then a draw pass places each element from the measured line counts, so a wrapped dish list can never overlap the meal below it. The same canvas backs both the on-screen preview slide and the exported PNG (the preview shows the canvas; the export reads `toBlob()` of its backing store at the export scale), so the two cannot drift, and the share fonts are awaited before any measure or draw so wrap points stay stable. The canvas exists because iOS Safari freezes heights inside the `foreignObject` that `html-to-image` uses, which overlapped rows on a real iPhone; a share fix is verified through the real export on a device, never through CSS alone. The recipe sheets render from React components (`app/web/src/components/ShareImages.tsx`) via `html-to-image`, which walks the live DOM of a hidden render of each slide and paints it to a PNG at 3x pixel ratio; their preview slides and exported PNGs come from the same components.

**Delivery.** The PNGs are handed to the Web Share API level 2 (files), which opens the native share sheet with all images attached; this is how an installed PWA shares into WhatsApp on both iOS and Android. The share family is a pure function of the cached week and the baked library, with no Convex call in the share path, so sharing works offline. When file-sharing is unavailable (desktop, older browsers), the fallback downloads every image so the user can attach them by hand.

`archive/menu_images/` holds the earlier single-PNG outputs as history only; nothing in the runtime writes to it.

## 13. Swiggy MCP integration shape (future)

Not built. The shape is recorded so that nothing shipped today closes the path.

- A Convex action reads `currentWeek`, asks the engine for the structured grocery list (§5, the whole non-skipped week when `selectedDays` is omitted), and calls the Swiggy MCP per line item to build a cart. The real Swiggy MCP is invite-only, cash-on-delivery, and offers no app hand-off link, so the viable end state is build-the-cart-then-stop and the user opens the Swiggy app to check out, not a checkout deep link.
- Three invariants already hold and keep this path open without rework:
  1. Ingredient names are canonical (one name per ingredient, no qualifiers like "(200g)", no spelling drift). The catalog is the single home for each ingredient, and the name-resolution validator blocks any dish ingredient row that does not resolve to a catalog row by exact name, so drift cannot reach the bundle.
  2. The grocery list is a structured Convex query, not a markdown parse: `getGroceryList` returns groups of items with `ingredient, quantity, unit, tracked, packs, packTotalGrams`. The on-screen render is a view on top.
  3. Pack sizes live in the catalog's machine-readable `Pack Size` column; the bake carries them through as the catalog-derived pack-size list, and the `Special` column marks ingredients that need a supermarket or specialty run.
- Brand preference and substitution policy are future additive fields on the ingredient row. No SKU or store-specific identifier ever lives in the canonical data; the integration layer resolves at runtime.

## 14. Repository structure

Authoritative root layout. CI enforces the root entries on every PR through the allowlist regex in `.github/workflows/ci.yml`; the hygiene pass of `/maintain` (`MAINTENANCE.md` §4.5) checks the live tree against it every sitting. The regex, the inventory in `MAINTENANCE.md` §4.5, and this layout move together.

```
plantry/
  README.md            # repo readme, lean; points into docs/ rather than restating it
  CLAUDE.md            # orientation: doc hierarchy, read order by task, the "Currently building" line
  MAINTENANCE.md       # /maintain spec: the boundary against evolution, the five passes, the ledger, the state file, the mark-applied action
  EVOLVING-THE-ENGINE.md # /evolve-engine spec: the seven steps, the clean-room roles, the measurement rules, the run folder
  ADDING-DISHES.md     # add-a-dish content-batch playbook
  DECISIONS.md         # EM autonomy log (append-only)
  RETRO.md             # EM friction ledger (append-only; triaged by the /maintain retro pass, MAINTENANCE.md §4.4)
  claude-design.md     # design contract for Claude Design (lowercase by convention from the file itself)
  .gitignore
  .githooks/           # the pre-commit hook source; scripts/install-hooks.sh copies it into .git/hooks on npm install
  .maintenance-state   # per-pass manifest for /maintain (last-run, status, deferred list)
  .prettierrc          # formatter config
  .prettierignore      # formatter ignore list (data/, archive/, the ledgers, the generated client, the gate report)
  .stylelintrc.json    # CSS lint config: standard rules plus the safe-area shorthand ban
  eslint.config.js     # lint config
  tsconfig.json        # root TS project references (engine, app/web, app/convex)
  tsconfig.base.json   # shared TS compiler options
  package.json         # workspace root manifest and the script entry points (bake, reports, gate, typecheck, lint, format, build, test)
  package-lock.json    # locked dependency tree
  vercel.json          # hosting config
  .github/workflows/   # ci.yml (§15), deploy-convex.yml (§9), slow-loop-applied.yml (MAINTENANCE.md §3)
  .claude/skills/      # /maintain (SKILL.md, passes/, templates/)
  .claude/commands/    # /evolve-engine, /new-stream
  .claude/evolve/      # /evolve-engine's role briefs (roles/) and templates (RUN.md, CHANGES.md)
  scripts/             # end-session.sh and merge_memory.py (worktree close-out), install-hooks.sh, the photo tool, the two dev seeds and their fixtures/, the cuisine migration, the mark-applied script
  docs/                # the four canonical specs, CHANGELOG.md, PLAN.md
    screenshots/       # the app screenshots README.md embeds
    reviews/           # committed review artifacts (the dish data audit and its validation)
  data/                # human-edited canonical data
    dishes/            # one file per dish: data/dishes/<slug>.md (frontmatter, ingredient rows, description, recipe)
    dish-photos/       # data/dish-photos/<slug>.jpg, STYLE.md (the photo spec), details.md (the per-dish detail map)
    ingredients.md     # ingredient catalog: one row per ingredient (group, unit, pack size, grams per piece, macros, special)
    menu_history.md    # the pre-app menu record, provenance; parsed at bake time, read by nothing
    changelog.md       # structural-change audit (the signals pass's rationale entries and content-batch entries)
    engine-requests.md # append-only evolution-request ledger (MAINTENANCE.md §5)
    test-fixtures/     # signals-pass dry-run fixtures (test-fixtures/slow-loop/*.example.json)
  features/            # the active feature's documents (a phase carries a spec, a plan, reviews, and dry runs); a maintenance sitting's artifacts and an evolution run's folder while each runs; the gate harness's living report (engine-v6-gate-report.md); .gitkeep otherwise
  engine/              # @plantry/engine: the TS engine module
    src/               # the shared modules, src/data/ (parse, serialize, schemas, validators, slug, the baked library.ts), src/v6/ (the selection engine)
    scripts/           # bake.ts, reports.ts, gate.ts
    test/              # Vitest suites paired to docs/engine.md sections (docs/engine.md §16.2), test/data/, test/v6/
  app/convex/          # the Convex backend: schema.ts, the function modules, convex.json
    lib/               # shared server helpers (meals.ts, author.ts, record.ts)
    queries/           # read-only listing queries
    _generated/        # machine-generated Convex client (committed; Prettier-ignored)
  app/web/             # @plantry/web: the Vite + React + TS PWA
    src/               # App.tsx, index.css (the design tokens), components/, lib/
    test/              # Vitest suites for the frontend helpers
    e2e/               # the Playwright smoke and back-navigation crawls (§16)
    public/            # favicon.svg (the PWA icon)
  archive/             # history (shipped feature specs and handoffs, evolution runs, maintenance sittings, retired docs, salvaged patches, generated menu images)
```

Gitignored entries the structure check tolerates but the tree omits: `.git`, `.vercel`, `node_modules`, and `coordination/` (the EM's local live-session registry and the session-start hook that lists un-promoted custom picks; `docs/development.md` §11.1). Two generated files are gitignored and rebuilt by the bake: `engine/src/data/library.ts` and `engine/src/data/history.ts`.

Naming:

- Folder names under `archive/`, `docs/`, `features/`, `app/web/src/components/`: kebab-case.
- TypeScript component files: PascalCase.
- TypeScript non-component files: camelCase. Under `app/convex/` this is a deploy requirement, not only a convention (§9).
- Markdown files in `docs/`: lowercase single-word names for the four canonical specs; `CHANGELOG.md` and `PLAN.md` are UPPERCASE like the root ledgers.
- Markdown files at root: UPPERCASE, with one named exception: `claude-design.md` is lowercase by convention from the design contract itself.

## 15. CI gates

`.github/workflows/ci.yml` runs one job, "Lint, typecheck, build, test", on every pull request (whatever branch it targets, so a stacked stream is gated too) and on every push to `main`. Branch protection requires it, and it is checked by name before every merge: a branch can read mergeable on GitHub with this check red. The steps, in order:

1. **Repo structure check.** Every root entry matches the allowlist regex (§14).
2. **Bake.** `npm run bake` emits the library module and runs the blocking data validators (§4): schema-valid dish files, catalog groups present, every ingredient name resolving to the catalog, pack sizes declared, unique ids and slugs, slugs matching filenames, the menu history resolving.
3. **Typecheck.** `tsc -b` across the three packages. `app/convex/_generated/` is committed, so every server function compiles against the checked-in API types; a stale regeneration fails here.
4. **Lint.** ESLint, no warnings.
5. **Format check.** Prettier over everything `.prettierignore` does not exclude; a branch that passes every other gate can still fail on formatting alone.
6. **Lint CSS.** stylelint over `app/web/src/**/*.css`: it fails on unbalanced or unclosed CSS, which Vite would otherwise tolerate and ship, and it bans `env(safe-area-inset-left|right)` inside a `padding` or `margin` shorthand (`docs/development.md` §4).
7. **Build frontend.** The Vite build, which type-checks and bundles the service worker.
8. **Test engine.** Vitest over `engine/test/`: the round-trip tests (each dish file and the catalog re-serialize byte-identical; the menu history parses), the validators, the section-paired unit tests of `docs/engine.md` §16.2, determinism (the same inputs are byte-identical across runs and a reversed input order changes nothing), the cap never exceeded, the picker and Explore rankings, the reports, the photo prompt assembler, the mark-applied script parser, and the CI-sized gate subset (`engine/test/v6/gate.test.ts`: the 60-week self-feeding run against the record fixture, asserting distribution fidelity, lunch-main uniqueness, slot anti-lock, the Saturday thresholds, and plate size and effort, kept under a minute). The full three-run harness with its variants is `npm run gate` (`engine/scripts/gate.ts`), run per phase and at the monthly monitor against the production record export rather than per PR; its report is committed at `features/engine-v6-gate-report.md`.
9. **Test web.** Vitest over `app/web/test/`: the frontend helpers (day maths, the grocery day selection and its storage, the dish filters and Healthy availability, search, the favorites sheet, the Yours screen, the changes badge, the library view).

Two checks are held by review, not by a CI check:

- **Engine spec/code parity.** A PR that modifies `docs/engine.md` also modifies at least one file under `engine/src/` and at least one under `engine/test/`. The EM confirms the pairing at review and names the missing half when it is absent (`docs/engine.md` §16.2).
- **The UI crawl** (§16), which needs a running app and a browser, and so runs from the EM's machine, not from CI.

## 16. UI verification: full-flow crawl-and-compare

The CI gates catch data, engine, type, and CSS-syntax errors, but not how the app renders or behaves. Rendering and interaction are verified by an in-depth crawl the EM spins off for every frontend-touching slice (`docs/development.md` §3 and §4), run against the PR preview before merge and against production after.

The crawl is Playwright-driven and walks every customer flow, not only the slice's feature: the passcode gate and identity picker, the Menu week, the Day editor and every sheet (dish actions, details and recipe with the share toggle, replace and swap, add a dish, reason, skip, restore), Grocery, Explore (grid, filters, dish sheet, wishlist toggle, dislike), Yours (both lists, the favorite add sheet, a place-into-the-week from the wishlist), the profile sheet and the Changes log it opens, the Share preview, the identity switch, and the exit-confirm prompt on Back at the home screen. It enters the app by injecting the auth and identity records into `localStorage` (`plantry:auth`, `plantry:identity`), so it needs no passcode and writes no user profile; read-only passes take no other writes, and mutating flows are exercised on the dev deployment, or mutate-then-revert against production with explicit approval.

Reaching the preview takes one more step: Vercel preview deployments sit behind deployment protection, so a bare request returns HTTP 401 and the SPA never boots. The crawl passes the project's Protection Bypass for Automation token (`VERCEL_AUTOMATION_BYPASS_SECRET`, §11) as the `x-vercel-protection-bypass` header and opens the first page with `?x-vercel-set-bypass-cookie=true`, which sets the bypass cookie so subsequent asset requests are let through. The localStorage gate-bypass clears only Plantry's own passcode, not Vercel's edge protection, so both are needed together. Production (`plantry.mudgal.xyz`, a custom domain) is not protected and needs no token. The token lives only in the crawler's environment. When a token is unavailable or a preview is down, the fallback is to build the PR branch and crawl the static `dist/` locally (`CRAWL_URL` unset), which renders the same build-baked output and is faithful for CSS and shared-primitive slices; the two iOS-only checks (`env(safe-area-inset)` side padding and the software-keyboard seam) are unverifiable in headless desktop engines either way and go to a real device.

For each screen the crawl captures a screenshot and asserts structural invariants: no element overflows the viewport horizontally, a minimum left and right content gutter is held (no container collapses its horizontal padding toward zero), key elements are actually styled (computed-style checks: a grid resolves to a grid, cards are phone-sized rather than overflowing), focus moves into a sheet when it opens, the page behind a sheet cannot scroll, tap targets are at least 44px, and the console is clean. The crawl exercises every new interactive affordance, not only its rendering: it clicks the control and asserts the resulting state (the sheet opens, the day collapses, the row appears). Each screenshot is compared against the matching screen in the active design handoff (the `features/<name>/` folder of the feature in flight); when no feature is active the live app is the reference (`claude-design.md`). A deviation is either fixed or recorded as an accepted difference in the PR's diagnosis card. Because the stylesheet and the shared primitives are global, a CSS or primitive change is crawled across all tabs regardless of which screen the slice nominally touched.

The crawl runs both desktop engines, Chromium and WebKit (the engine behind Safari), at two phone widths, 390 and 412. It opens every bottom sheet and asserts the same invariants on it, at minimum the dish-detail sheet and the swap picker, reporting which sheets it reached and which it could not. Because both engines are desktop, the crawl cannot reproduce a real-iOS-device-only rendering difference. It catches the broad under-padding and omitted-gutter class deterministically; it is not proof that an iOS-device-specific CSS bug is fixed. iOS-affecting CSS and layout changes therefore require real-device (iPhone) sign-off before merge in addition to a green crawl (`docs/development.md` §4). A "missing image" or stale-UI report is usually a stale service-worker cache on the device rather than a repo defect; the check is whether production serves the hashed asset (HTTP 200) before suspecting code.

Some paths the crawl cannot close on its own, and each leaves a residual the slice must carry rather than drop:

- **Read-path screens render only against data that contains them.** A structural slice that adds a kind of slot will not appear on the crawled week until a week carrying that slot exists, and a read-path screen like the Grocery list never populates while its week is empty; crawling against an empty deployment shows only loading states and a green crawl proves nothing about the new section. The dev deployment carries a seeded current week (`scripts/seed-dev-week.mjs`, which runs the real generation path against dev so it cannot drift from the live schema) and, when the record matters, seeded past weeks (`scripts/seed-dev-record.mjs`). When a seeded week is unavailable, Grocery-list CSS is verified by rendering `app/web/src/index.css` over a hand-built grocery DOM with mock data.
- **Backend-dependent flows are crawled after the backend that serves them is live.** A flow that calls a new or changed Convex query or mutation is rejected until the dev deployment carries it; sequence the crawl after `npx convex dev --once` has pushed the branch's functions to dev, not at PR-open.
- **Real-device and after-deploy checks the headless crawl cannot reach** (the two iOS-only CSS checks; a behaviour that only manifests once production has redeployed) are logged as an explicit residual in the PR's diagnosis card (`docs/development.md` §5), so the open verification item travels with the PR instead of living only in chat.

The scriptable floor of this crawl is `app/web/e2e/smoke.mjs` (`npm run test:smoke --workspace @plantry/web`): it loads each of the four tabs, opens the reachable sheets (the dish-detail sheet from Explore, the swap picker from the day editor, the profile sheet and the Changes log), and asserts no horizontal overflow, phone-sized cards, and the minimum content gutter, on both desktop engines at both widths. By default it builds and serves `dist/` locally; setting `CRAWL_URL` (plus `VERCEL_AUTOMATION_BYPASS_SECRET` for a protected preview) points it at a deployed URL instead. Its sibling `app/web/e2e/back-nav.mjs` walks the browser-Back behaviour across tabs, the day editor, and sheets. Both need `npx playwright install chromium webkit`; a missing engine is skipped, not failed. The EM runs the fuller in-depth crawl-and-compare per slice.

## 17. Anti-patterns

- Reading markdown files inside Convex functions or the frontend at runtime. Markdown is read at build time; runtime reads the baked module.
- Adding a new frontmatter key to the per-dish files or a new column to the `ingredients.md` catalog for a one-off case (`docs/product.md` §4 Principle 8). A new key or tag value is engine evolution, not a data edit (`MAINTENANCE.md` §1).
- A non-additive Convex schema change without a plan for the existing rows (§3).
- A hyphenated filename under `app/convex/` (§9).
- Encoding Swiggy SKUs or any store-specific identifier in canonical data.
- Auto-applying any slow-loop suggestion. The PR-merge gate is the only path.
- Skipping author attribution on any mutation. The author assertion rejects unattributed writes; do not patch around it.
- Adding a library, platform service, or tool not named in §1 without Rajat's go-ahead.
- Verifying a share-image fix through CSS or a desktop render instead of the real export on a device (§12).
