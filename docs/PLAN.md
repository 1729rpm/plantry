# Plan

The phase plan for the build. A phase is a coherent chunk of work that ends in a
verifiable, shippable state; its outcome is written as an observable behavior, not an
activity. The active phase's full spec lives at `features/<name>.md` and is named in
`CLAUDE.md`'s Currently building section. Shipped rows are history and are never
rewritten; the chronology behind them lives in `docs/CHANGELOG.md`.

A session starts on a phase with "Begin development. We are on Phase N." The session
then reads `CLAUDE.md`, `docs/development.md`, this plan, the active phase spec, and
the live-session registry at `coordination/active-streams.md`, picks the next
unblocked stream from the spec's stream-state table, and confirms the pick in one
line before spawning. If the stated phase disagrees with this plan, the session
surfaces the mismatch before any code is written.

| Phase | Name                                  | Outcome (verifiable)                                                                                                                                                                     | Status   |
| ----- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1     | Planner v1                            | The PWA generates a Mon-to-Sat menu from the dish library, with groceries and share image                                                                                                | shipped  |
| 2     | Operating machinery                   | The slow loop, reconciliation passes, retro intake, and content-batch tracks all run                                                                                                     | shipped  |
| 3     | UI improvements                       | The redesigned surfaces (pickers, day editor, comment entry, custom-dish add) are live                                                                                                   | shipped  |
| 4     | Menu composition v2                   | Meal-level cuisine, 4-item thali, and the role-aware cap compose the generated week                                                                                                      | shipped  |
| 5     | Engine v3                             | Generated lunches compose one-wet, budget-fit, protein-floored plates with main-driven carbs                                                                                             | shipped  |
| 6     | Wishlist page and favorites frequency | Favorites and the next-week queue are visible and editable in the app, and favorites surface about weekly in generation                                                                  | shipped  |
| 7     | Yours tab (wishlist and favorites v2) | A Yours tab holds the household's wishlist and favorites, favorites are guaranteed into every generated week, the profile sheet carries the Changes log, and the next-week queue is gone | shipped |

No phase is in flight. Future phases are
added here when they are planned, not
before. On phase close the row flips to shipped, the spec moves to
`archive/features/`, and the close is tagged `phase-<n>-complete`
(`docs/development.md` §3 step 8).
