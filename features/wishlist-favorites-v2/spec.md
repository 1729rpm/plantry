# Feature: Yours tab (wishlist + favorites, v2)

Status: ACTIVE (Rajat approved the shape in chat, 2026-07-14). Phase 7 in
`docs/PLAN.md`. Redesign of the Phase 6 wishlist (shipped #217/#214/#218, now in
`archive/features/wishlist.md`). The design handoff Rajat delivered lives beside this
spec at `features/wishlist-favorites-v2/handoff/` (README + runnable HTML/JSX
prototype + `assets/`); it is high-fidelity and owns final colors, type, spacing,
copy, and interactions. This spec owns scope, contracts, migration, and stream
sequencing. When the two disagree on a pixel or a copy string, the handoff wins;
when they disagree on a data contract or a rule, this spec wins.

The first-merging stream (A) commits this spec, the handoff folder, the `docs/PLAN.md`
Phase 7 row, and the `CLAUDE.md` Currently-building line, per `docs/development.md` §3.

## 1. What this feature is

The Phase 6 wishlist was a hidden sub-view of Explore holding two lists: Favorites
and a "Saved for next week" queue. This feature promotes the household's lists to a
first-class **Yours** tab, redefines the wishlist, strengthens favorites, and retires
the next-week queue entirely.

Five shipments (handoff README §1):

1. **A "Yours" tab replaces the Changes tab.** Fourth bottom-nav tab, heart icon,
   badge = wishlist count. Holds two sections: **Your favorites** and **Your
   wishlist**.
2. **Wishlist, redefined.** A one-tap "save it to try" list (no reason dialog).
   Markable from Explore card hearts, the dish detail sheet, and the menu dish
   detail sheet. From the Yours tab, any wishlist dish can be placed into the week
   with **Use** (opens the existing day picker). This is a NEW concept; it is not the
   old next-week queue (which auto-fed generation). Using a dish leaves it on the
   wishlist.
3. **Favorites, guaranteed.** A favorite is auto-pinned into **every** generated
   week (see §3). Added from the Yours tab (search the library, or type a custom
   free-text name), or from a menu dish's detail/action sheet ("Mark as favorite").
4. **Profile sheet.** The Menu-header avatar (today a bare identity switch) opens a
   profile: switch username + the relocated **Changes log** (the old Changes tab
   content, now a sheet).
5. **"Save for next week" is removed everywhere** (§5): UI, mutations, generation
   reads, the `nextWeekQueue` table, and the `save_next_week` change-kind.

## 2. Locked decisions (Rajat, 2026-07-14)

1. **Favorites are guaranteed every week, composition-locks-win.** Every library
   favorite is pinned into one slot in every generated week (breakfast favorite →
   one day's breakfast; lunch favorite → one day's lunch plate), spread across
   distinct days. When the full favorites set cannot all be placed without breaking a
   locked composition rule (one wet per plate, never 5 dishes/meal, daily protein
   floor, budget-fit), the engine places as many as fit (oldest-added favorites
   first) and logs an incident naming the ones it could not place that week. There is
   no fixed numeric weekly cap; the bound is composition feasibility. This retires the
   Phase 6 `FAVORITE_WEEKLY_CAP` capped-promotion model.
2. **Custom (free-text) favorites are display-only.** A favorite may be a free-text
   name not in the library (the "Avocado toast every week" case). Custom favorites are
   a visible reminder in the Yours tab with no generation effect; the engine only
   pins library favorites (it has no dish to place for a free-text name). The "in
   every week's menu" copy is literally true for library favorites and aspirational
   for custom ones; the handoff copy stands.
3. **"Save for next week" is fully removed, data wiped.** Drop the `nextWeekQueue`
   table and the `save_next_week` change-kind, with a migration that clears existing
   rows so the deploy validates (§5). This is a breaking schema change; it ships
   backend-first with a documented prod runbook (§5.3).
4. **The unread-changes badge moves onto the avatar.** Today the Changes tab carries
   a badge counting this-week edits by the other person the viewer has not seen. With
   the Changes tab gone, that badge relocates onto the Menu-header avatar so the
   "your partner edited the week" nudge survives. The Yours tab badge is the wishlist
   count.
5. **The wishlist is a shared Convex table**, attributed by author, consistent with
   favorites (not the prototype's localStorage). Either person can remove either
   person's entry.
6. **Wishlist/favorite actions do not enter the Changes feed.** That feed stays
   week-edits-only (the slow loop's input). Attribution shows on each Yours row
   ("Added by {who}"). The prototype's merged activity feed is a prototype artifact;
   do not log wishlist/favorite mutations as `manualChanges`.
7. Engineers build on Opus. This spec is written to execute without further product
   decisions.

## 3. Design part 1: engine (§4 favorites step → guaranteed pinning)

Today `byFavorites(pool, favoriteDishIds, favoritesPlacedThisWeek)` (§4 step 4,
`engine/src/priority.ts`) is a stable ranking partition capped at
`FAVORITE_WEEKLY_CAP = 6`: favorites rank above non-favorites within each slot's
selection, no-op past the cap. That is a soft promotion, not a guarantee.

This feature replaces it with a **guaranteed placement pass**. Behavioral contract
(the engineer owns the mechanism; `docs/engine.md` §4 step 4 and §12 are rewritten in
the same PR to match, and CI enforces the doc/engine mirror):

- **Every** library favorite dish appears **exactly once** in a generated week when
  it can be placed without violating any hard composition lock (one wet per plate,
  never 5 dishes/meal, daily protein floor, budget-fit) or capacity.
- Placement respects the dish's meal: a breakfast favorite lands in one day's
  breakfast, a lunch favorite in one day's lunch plate.
- Favorites spread across **distinct days** where feasible (no two favorites forced
  onto the same day while another day is open).
- When not all favorites fit, **oldest-added favorites win** (stable, deterministic).
  The generation run receives the ordered favorite list from Convex (createdAt
  ascending) and honors that order.
- **Unplaced favorites are returned by the engine** (e.g. an `unplacedFavorites:
number[]` field on the generate result) so the Convex layer can log one incident
  per generated week naming them. The engine never breaks a lock to force a favorite.
- Custom (non-library) favorites are **not** engine inputs.
- Swaps and Explore adds remain untouched by favorites (Phase 6 behavior; the swap
  path passes no favorite set).

`FAVORITE_WEEKLY_CAP` is removed. `GenerateWeekArgs.favoriteDishIds` stays (now the
guaranteed-pin set, ordered); `favoritesPlacedThisWeek` and the cap-threading go away.
Absent/empty favorite set = the pass is a no-op and generation is identical to a
household with no favorites.

**Simulation fixtures (`engine/src` tests):** (a) every favorite in the set appears
in the generated week; (b) no favorite appears twice in one week; (c) favorites
spread across distinct days; (d) when the favorite set cannot all be placed under the
locks, the oldest-added subset is placed and the remainder is reported in
`unplacedFavorites`; (e) an empty favorite set leaves generation byte-identical to the
no-favorites baseline.

## 4. Design part 2: Convex + schema

### 4.1 Schema (`app/convex/schema.ts`)

**`favorites` — extend (additive, non-breaking).** A favorite is now either a library
dish or a free-text custom name. Loosen `dishId` to optional and add an optional
`customLabel`; every existing row (all carry `dishId`, no `customLabel`) still
validates.

```ts
favorites: defineTable({
  createdAt: v.number(),
  author: v.union(v.literal("rajat"), v.literal("tuhina")),
  dishId: v.optional(v.number()),      // library favorite; absent for custom
  customLabel: v.optional(v.string()), // free-text favorite; absent for library
}).index("by_dishId", ["dishId"]),
```

A valid row has exactly one of `dishId` / `customLabel` set; enforce in the mutation,
not the schema.

**`wishlist` — new table.** Shared household "save to try" list, parallel in shape to
the old favorites table.

```ts
wishlist: defineTable({
  createdAt: v.number(),
  author: v.union(v.literal("rajat"), v.literal("tuhina")),
  dishId: v.number(),                  // wishlist is library dishes only
}).index("by_dishId", ["dishId"]),
```

**`nextWeekQueue` — remove** (§5). **`manualChanges.changeKind` — remove the
`save_next_week` literal** (§5). Both are breaking; see the migration runbook.

### 4.2 Convex functions

New `app/convex/wishlist.ts` (camelCase filename; hyphens silently break Deploy
Convex — see the Convex-module-naming rule) and `app/convex/queries/wishlist.ts`:

- `addToWishlist({ author, dishId })` → `{ ok: true; wishlistId } | { ok: false;
reason: "dish-not-in-library" | "already-wishlisted" }`. Guards dish-in-library and
  not-already-present via `by_dishId`. Writes NO `manualChanges` row (Decision 6).
- `removeFromWishlist({ author, dishId })` → `{ ok: true } | { ok: false; reason:
"not-wishlisted" }`. Keyed on `dishId` (shared list; either person removes either's
  entry). Writes NO `manualChanges` row.
- `listWishlist` → rows, `createdAt` ascending.

`app/convex/favorites.ts` — extend for custom favorites:

- `addFavorite({ author, dishId })` unchanged in shape; still guards
  dish-in-library + already-favorite.
- `addCustomFavorite({ author, customLabel })` → `{ ok: true; favoriteId } | { ok:
false; reason: "empty-label" | "already-favorite" }`. Trims the label; rejects
  empty; dedupes case-insensitively against existing custom labels.
- `removeFavorite` — support removing a custom favorite by id as well as a library
  favorite by dishId. Recommend a `removeFavoriteById({ favoriteId })` for the custom
  case; keep the existing `removeFavorite({ author, dishId })` for library rows.
- `listFavorites` returns both kinds, `createdAt` ascending, each row carrying
  `dishId?` and `customLabel?` so the frontend renders the right row.

`app/convex/generateWeek.ts`:

- Remove the `nextWeekQueue` read and the `requests` input entirely (§5).
- Read favorites (`dishId`-bearing rows only, `createdAt` ascending) and pass the
  ordered dish ids to the engine's guaranteed-pin pass (§3).
- After generation, log one `incidents` row per week if the engine reports
  `unplacedFavorites` (source `engine`, severity `warn`, context lists the ids and the
  weekStart).

`app/convex/explore.ts` — remove the `nextWeekQueue` exclusion (queued dishes no
longer hidden from Explore; nothing queues anymore).

`app/convex/queries/activity.ts` — remove `save_next_week` from the fed kinds (§5).

### 4.3 Deploy ordering

Backend ships first (this stream A merges before frontend stream B). New mutation and
query signatures must exist in prod before the frontend calls them; removed signatures
(`saveForNextWeek`, `removeFromNextWeekQueue`, the next-week queries) must not be
removed until no deployed frontend calls them — since B deploys after A, A may remove
them, but A's PR must confirm no other live caller. See the deploy-ordering rule.

## 5. Deprecation and migration: "Save for next week"

### 5.1 Frontend removal (stream B)

Remove every next-week surface: the "Next week" button in `ExploreDishSheet`, the
`saveForNextWeek`/`next-reason` flow in `ExploreScreen`, the "Saved for next week"
section in the old wishlist screen, and the `save_next_week` headline in the Changes
log. (Full current inventory is in the stream B brief.)

### 5.2 Backend removal (stream A)

Remove `saveForNextWeek` (in `dayMutations.ts`), `nextWeekQueueMutations.ts`,
`queries/nextWeekQueue.ts`, the `nextWeekQueue` reads in `generateWeek.ts`, the
exclusion in `explore.ts`, and the `save_next_week` handling in `queries/activity.ts`.

### 5.3 Data migration (breaking; prod runbook in the diagnosis card)

Convex validates every existing row against the new schema on deploy, and refuses to
drop a non-empty table. Removing the `nextWeekQueue` table and the `save_next_week`
enum value therefore needs the rows gone first. Sequence (document exact commands in
the PR diagnosis card; the `--prod` runs are gated on Rajat's approval at merge):

1. Ship an internal migration mutation that (a) deletes all `nextWeekQueue` rows and
   (b) deletes all `manualChanges` rows whose `changeKind === "save_next_week"`
   (Decision 3: wipe, do not rewrite; these are deprecated-concept history).
2. Run the migration against prod (and any preview DB the deploy validates).
3. Deploy the schema with `nextWeekQueue` removed and `save_next_week` gone from the
   `changeKind` union.

The migration mutation is a throwaway; note in the PR that it is deleted in a
follow-up once prod is clean, or guard it so a second run is a no-op. Verify the
`Deploy Convex` action is green after merge (schema changes + module renames both gate
on it).

## 6. Design part 3: frontend (stream B)

The handoff (`features/wishlist-favorites-v2/handoff/`) is the visual and interaction
reference; recreate it in `app/web/src/` with the existing components and the tokens
in `app/web/src/index.css`. No new design tokens (handoff README §"Design tokens").
All horizontal padding goes through `--pt-gutter` (`docs/development.md` §4). Key
surfaces:

- **Tab bar** (`primitives.tsx`): `Changes` → `Yours` (heart icon, 1.7 stroke),
  `TabKey` and `TABS` updated; Yours badge = wishlist count. Relocate the unread badge
  off the tab.
- **Yours screen** (new): header "Yours" + subtitle, two sections (Your favorites,
  Your wishlist) per handoff `YoursScreen`. Favorites rows: name over "Added by {who}
  · in every week's menu", × remove, dashed "Add a favorite" button. Wishlist rows:
  44px thumb, name over "Added by {who}", "Use" pill + × remove; row body opens the
  dish detail sheet (explore context). Empty states per handoff. Replaces the Explore
  wishlist sub-view; retire the `WISHLIST_MARKER`/`exploreSub` back-stack sentinel in
  `App.tsx`.
- **Profile sheet** (new, from the Menu-header avatar): avatar + name + "Edits carry
  your name", then "Switch to {other}" (→ identity screen) and "Changes to this week"
  (→ Changes log sheet). The avatar carries the relocated unread badge.
- **Changes log sheet** (new): the old `ChangesScreen` feed content rendered as a tall
  sheet (max-height 92%). The Changes tab and its screen-as-tab go away; the feed
  rendering is reused.
- **Explore** (`ExploreScreen`): a 34px circular heart button overlaid top-right of
  each card photo (outline = not saved, filled accent = saved), one-tap toggle,
  `aria-pressed`, toast. Remove the "Wishlist" header affordance (wishlist now lives
  in the Yours tab) and the whole next-week flow.
- **Explore dish sheet** (`ExploreDishSheet`): footer pair "Use this week" + quiet
  "Add to wishlist" (→ "Wishlisted ✓"); remove "Next week".
- **Menu dish detail sheet** (`DishDetailSheet`, week context): a centered
  dashed-underline "Mark as wishlist" / "On your wishlist ✓" text button.
- **Menu dish action sheet** (`DishActionSheet`): a "Mark as favorite" / "Remove from
  favorites" row with the handoff hints.
- **Add favorite sheet** (`FavoriteAddSheet`): search the library (dishes not already
  favorited) plus, for any non-empty query, a dashed `Add "{query}" as a favorite`
  row for the custom case; picking either saves and closes.

Wishlist/favorite mutations are optimistic and instant with a confirming toast, over
the shared Convex tables (loading/empty states like the Phase 6 wishlist screen).

## 7. Streams and sequencing

Lanes are disjoint by directory, so A and B run in parallel; A merges first (owns the
schema and deploys backend-first). B binds to the §4 contract names untyped
(`anyApi.*`) and rebases onto A before merge. If B's PR is too large for one clean
review it splits into B1 (tab + Yours + Profile + Changes-log sheet + next-week UI
removal + wishlist/favorite state wiring) then B2 (Explore hearts + dish-sheet
controls + custom-favorite add), sequenced (shared `app/web` files); the EM decides at
review time.

| Stream | Scope                                                                                                                                                                                                        | File lanes                                                                                                           | Depends on    | Merge order        |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------ |
| A      | Engine guaranteed-favorites pass, Convex schema + wishlist/favorites functions, next-week removal + data migration, `docs/engine.md` §4/§12 mirror. Commits this spec, the handoff, PLAN Phase 7, CLAUDE.md. | `engine/src/**`, `app/convex/**`, `docs/engine.md`, `features/wishlist-favorites-v2/**`, `docs/PLAN.md`, `CLAUDE.md` | —             | 1st                |
| B      | Frontend: Yours tab, Profile + Changes-log sheets, Explore hearts, dish-sheet wishlist/favorite controls, custom-favorite add, all next-week UI removal, unread badge → avatar.                              | `app/web/src/**`                                                                                                     | A (contracts) | 2nd (rebases on A) |

Stream-state:

| Stream | Status      | Worktree                         | PR  |
| ------ | ----------- | -------------------------------- | --- |
| A      | in progress | `../plantry-wishlist-v2-backend` | —   |
| B      | not started | —                                | —   |

## 8. Out of scope / deferred

- No change to swap-picker or Explore ranking beyond removing the next-week
  exclusion.
- No promotion of custom favorites into real library dishes (Rajat chose
  display-only; a future content-batch could add "Avocado toast" as a real dish, at
  which point it could be re-added as a library favorite).
- No scheduler change; weekly generation still runs on demand
  (`generateCurrentWeek`).
- The `preferred` frontmatter field stays parsed and unused as a §4 input (unchanged
  from Phase 6).

## 9. Definition of done (feature-level)

Per `docs/development.md` §4 for each PR, plus: engine guarantee proven by the §3
fixtures; `docs/engine.md` §4/§12 rewritten to match and CI mirror green; Convex
`Deploy Convex` green after each `app/convex/**` merge; the breaking migration run
against prod with Rajat's approval and verified (no `nextWeekQueue`, no
`save_next_week` rows); stream B's full-flow crawl-and-compare against
`features/wishlist-favorites-v2/handoff/` linked in its PR with every deviation
resolved or accepted; real-iPhone sign-off on the new sheets and the Explore card
heart (iOS-affecting CSS).
