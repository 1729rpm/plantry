# Feature: Wishlist page and favorites frequency

Status: ACTIVE (Rajat approved the shape in chat, 2026-07-13). Phase 6 in
`docs/PLAN.md`. **Built in its own session, separate from the engine-v3 session.**
That session's first stream commits this spec, the PLAN.md Phase 6 row, and appends
to the CLAUDE.md Currently-building line.

This spec REPLACES the earlier draft of the same file (written by a now-closed
session). Rajat's 2026-07-13 decisions changed its shape: the wishlist lives as an
Explore sub-view (not a bottom-nav tab; no profile-sheet/Changes relocation), and a
standing Favorites list is IN scope (the draft had excluded it). The draft's other
ideas are deferred, listed in §8.

## 1. What this feature is

Two things, one loop:

1. **A wishlist page**, reached from the Explore header, with two sections:
   **Favorites** (the household's standing "we want this regularly" list: view
   current favorites, add via search over all dishes, remove) and **Saved for next
   week** (the existing `nextWeekQueue`, finally visible: today a saved dish
   disappears after the confirmation toast because nothing reads the queue).
2. **Favorites feed generation frequency.** A favorite dish surfaces about weekly
   in the generated menu. This replaces the git-file `preferred` field as the §4
   preference signal, giving the household a live dial the engine actually obeys.
   Evidence: "Like to have avocado toast once a week" (a literal cadence rule,
   manually re-enacted every week), "Tuhina loves rajma", "Saturday like to eat
   aaloo".

## 2. Locked decisions (Rajat, 2026-07-13)

- Placement: sub-view of Explore. No new tab, no navigation restructure.
- The page shows favorites AND the saved-for-next-week queue.
- Favorites section: current favorites listed; an Add flow searching all dishes,
  with already-favorite dishes visible in the results.
- Favorites are one shared household list (author recorded per row; either person
  can remove either person's entry).
- Engineers build on Opus; this spec is written to be executed without further
  product decisions.

## 3. Design part 1: engine (§4 favorites step)

`byPreferredYes` (§4 step 4, `engine/src/priority.ts`) is replaced by
`byFavorites(pool, favoriteDishIds, favoritesPlacedThisWeek)`: a stable partition
that leads with favorite dishes, modeled exactly on the removed step's shape (it
must remain a stable partition so steps 5 and 6 still dominate). Weekly cadence is
emergent: §4 step 5 (within-week recency) already prevents the same favorite twice
in one week, so a favorite lands about once a week with no due-date arithmetic.

- `GenerateWeekArgs` gains optional `favoriteDishIds?: ReadonlySet<number>`
  (absent or empty = step is a no-op; every existing caller unchanged).
- **Weekly promotion budget:** new constant `FAVORITE_WEEKLY_CAP = 6` in
  `priority.ts`. The generateWeek loop counts placed picks whose id is in
  `favoriteDishIds` (thread a running count the same way `withinWeekRecencySet`
  is threaded); once the count reaches the cap, the step is a no-op for the rest
  of the week. Prevents a long favorites list from swamping rotation and
  discovery. One-line tunable; flag the default to Rajat on the PR.
- The `preferred` frontmatter field stays parsed (no 261-file migration) but is no
  longer a §4 input; `docs/engine.md` §4 and §12 state that plainly. No automatic
  seeding of favorites from Preferred=Yes: Rajat curates the list in the UI from
  day one. Flag on the PR that current Preferred staples stop being promoted at
  merge until favorites are added in the app.
- §5 picker ranking and §7 Explore are deliberately untouched by favorites.
- Simulation: add a fixture week generated with a favorites set and assert (a) a
  favorite absent last week lands this week, (b) no favorite repeats within the
  week, (c) promotion stops after `FAVORITE_WEEKLY_CAP` placements.

## 4. Design part 2: Convex

New table in `app/convex/schema.ts` (house style: `v` validators, `by_` index):

```ts
favorites: defineTable({
  createdAt: v.number(),
  author: v.union(v.literal("rajat"), v.literal("tuhina")),
  dishId: v.number(),
}).index("by_dishId", ["dishId"]),
```

New file `app/convex/favorites.ts` (camelCase filename; hyphens silently break the
Convex deploy), modeled line-for-line on `dishDislikes.ts` (assertAuthor,
baked-library guard, explicit result union):

- `addFavorite({ author, dishId })` → guards dish-in-library and already-favorite
  (`by_dishId` lookup), inserts, returns `{ ok: true, favoriteId }` or
  `{ ok: false, reason: "dish-not-in-library" | "already-favorite" }`.
- `removeFavorite({ author, dishId })` → deletes the row. Returns
  `{ ok: true } | { ok: false, reason: "not-a-favorite" }`.

New queries under `app/convex/queries/`:

- `queries/favorites.ts: listFavorites` → all rows, `createdAt` ascending. Raw
  rows only; the client resolves names/photos from the baked library.
- `queries/nextWeekQueue.ts: listQueuedNextWeek` → `nextWeekQueue` rows with
  status `queued`, `createdAt` ascending (placement order, so "what lands next
  week" reads top-down).

New public mutation `removeFromNextWeekQueue({ author, queueId })` in
`app/convex/nextWeekQueueMutations.ts` (distinct from the existing
`internalMutation markQueueDropped`): sets status `dropped` and writes a
`manualChanges` row (changeKind `delete`, the dish in `before`; do NOT invent a
new changeKind, the Changes feed already renders deletes) so the unmark is
visible in the feed.

`generateCurrentWeek` (`app/convex/generateWeek.ts`) collects the favorites table
and passes `favoriteDishIds` to the engine. Optional engine arg, so the deploy is
backward-compatible; generation is CLI-invoked, so engine + Convex ship in one PR.

## 5. Design part 3: frontend (the wishlist page)

- Entry: a "Wishlist" affordance in the Explore header. Navigation mirrors the
  Menu tab's DayScreen pattern (`App.tsx` `renderActive` switches on a state
  value); it is a sub-screen, not a Sheet. Any sheet opened from it uses the
  shared module-level history-marker pattern for browser-Back (never a per-sheet
  marker; per-sheet markers self-close sibling sheets).
- Section 1, **Favorites**: current favorites as rows (photo thumb via
  `dishPhotoUrl`, name, meta line, remove affordance with a 44px tap target). An
  "Add a favorite" button opens a search sheet modeled on `AddDishSheet.tsx`:
  `matchesQuery` over `allDishes` from the baked `@plantry/engine/library`, every
  dish reachable, rows already in the favorites list render with a
  filled/selected state and tap to remove (Rajat: "the existing dishes are also
  shown"). Optimistic toggle with revert on failure, toast on add.
- Section 2, **Saved for next week**: `listQueuedNextWeek` rows (dish resolved
  from the baked library, the saved reason, who saved it, when), each removable
  via `removeFromNextWeekQueue`. The save flow itself (ExploreDishSheet "next
  week" action, required reason) is unchanged.
- Empty states teach the loop in one sentence each ("Favorites show up about once
  a week in the generated menu." / "Saved dishes get placed into next week's
  menu, oldest first.").
- Style: gutter token (`--pt-gutter`) longhand for horizontal padding, no raw
  literals; no em dashes in any UI string; hand-authored inline SVG if an icon is
  needed, matching the existing tab icons.

## 6. Streams

| Stream | Scope                                                                                                                                                    | Lanes                                                                                                                                                                                                                                                                                                                                      | Depends on                                                                                                                              | Status               |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| A      | Engine §4 favorites step + Convex (§3 + §4 of this spec); engine.md §4/§12; feature activation (spec commit, PLAN.md Phase 6 row, CLAUDE.md line append) | engine/src/priority.ts, engine/src/generateWeek.ts, engine/test/priority*, engine/test/simulation*, docs/engine.md §4/§12, app/convex/schema.ts, app/convex/favorites.ts, app/convex/queries/{favorites,nextWeekQueue}.ts, app/convex/nextWeekQueueMutations.ts, app/convex/generateWeek.ts, features/wishlist.md, docs/PLAN.md, CLAUDE.md | engine-v3 Stream A MERGED (see §7)                                                                                                      | MERGED (#217)        |
| B      | Wishlist sub-view UI (§5 of this spec)                                                                                                                   | app/web/src/App.tsx, app/web/src/components/ExploreScreen.tsx (header wiring only), new app/web/src/components/WishlistScreen.tsx, new FavoriteAddSheet.tsx, app/web/src/index.css                                                                                                                                                         | A merged AND the Deploy Convex action verified green (the frontend reads A's queries; deploying B first blanks the page during the gap) | MERGED (#214)        |

## 7. Cross-session coordination (read first, this is the sharp edge)

The engine-v3 feature (`features/engine-v3.md`, built in the main EM session)
rewrites `engine/src/composition.ts` and `engine/src/generateWeek.ts` and moves
the simulation snapshots. This feature's Stream A shares `generateWeek.ts`,
`docs/engine.md`, `engine/test/simulation.test.ts`, `docs/PLAN.md`, and
`CLAUDE.md` with it.

Rules:

- **Do not spawn this feature's Stream A until engine-v3 Stream A has merged.**
  Check `coordination/active-streams.md` (the shared live registry in the main
  repo dir; briefs carry its absolute path) and the Shipped section; when in
  doubt, `git log origin/main` for the engine-v3 PR.
- Branch off freshly fetched `origin/main` after that merge. If anything else
  lands mid-flight, this session owns the rebase (`docs/development.md` §11.3).
- Register every stream in `coordination/active-streams.md` before spawning, and
  move rows to Shipped on merge, exactly as the main session does. Two sessions
  coordinating through one registry is the designed model (§11).
- PLAN.md/CLAUDE.md activation lines: engine-v3's stream adds Phase 5 and its
  Currently-building entry; this feature adds Phase 6 and appends its own entry.
  Trivial adjacent-line conflicts; the later merger rebases.

## 8. Execution notes for engineers

- Run `npm install && npm run bake` before any typecheck/build/test (fresh
  worktrees lack the gitignored baked `library.ts`/`history.ts`). Stream output
  early (the subagent watchdog kills silent 600s commands). No em dashes anywhere,
  including code comments and PR bodies. Diagnosis card per
  `docs/development.md` §5. Any `docs/engine.md` edit needs paired `engine/src/`
  and `engine/test/` changes in the same PR (CI enforces).
- Stream A: verify the `Deploy Convex` GitHub action is green after merge (a
  silent deploy failure looks like "the queries do not exist" from the frontend).
- Stream B: full-flow crawl before merge (Vercel previews are SSO-walled, so
  crawl a local `dist/` build of the PR branch). Dev Convex (`lovely-curlew-631`)
  is empty: seed favorites and queue rows there for the crawl, or static-render
  the two sections for the CSS pass; never write to prod. 44px tap targets;
  real-iPhone sign-off on the new CSS before merge. ExploreScreen is a hotspot
  lane: touch only the header wiring.

## 9. Deferred from the earlier draft (tracked, not dropped)

- Wishlist as a bottom-nav tab replacing Changes; profile sheet holding identity
  switch + the Changes feed; avatar on all headers with the unread dot.
- Heart toggles on `ExploreDishSheet`/`DishDetailSheet`/Explore cards with pulse
  animation; optional-note save replacing the required reason.
- Per-week placement cap on `nextWeekQueue` consumption (engine `requests` max).
- A "from your wishlist" marker on placed dishes (additive `source: "wishlist"`
  slot value).

Each is a candidate follow-up feature; none blocks this one.

## 10. Acceptance (feature-level, verifiable)

- A dish added to Favorites in the app and not cooked last week appears in the
  next generated week (subject to slot eligibility), and never twice in one week.
- Removing a favorite stops its promotion at the next generation.
- The wishlist page lists both sections with live data; removing a saved row
  drops it from the queue and surfaces in the Changes feed.
- At most `FAVORITE_WEEKLY_CAP` favorite placements per generated week.
- The Explore tab itself renders unchanged for a user who never opens the
  wishlist.
