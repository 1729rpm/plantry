# Hygiene pass, sitting 2026-09-07

Run inline by the EM (`.claude/skills/maintain/passes/hygiene.md`, `MAINTENANCE.md` §4.5), last, over
the tree the other four passes left.

## 1. Basis

Commands run: the root allowlist loop from `.github/workflows/ci.yml` over `ls -A` at the main
directory root; `ls -a features/` and an empty-directory find; folder-name scans of `archive/`,
`docs/`, `features/`, `app/web/src/components/`, and `app/convex/`; `git fetch --prune`,
`git branch -r`, and `gh pr list --head <branch> --state all` per remote branch; `git worktree list`
against `coordination/active-streams.md`; `npx convex data` on the dev deployment
(`lovely-curlew-631`) against `app/convex/schema.ts`; `CLAUDE.md`'s status line against `features/`
and `docs/PLAN.md`; `git status --short` and `git status --ignored --short` in the worktree and
`git status --short` in the main directory; `npm run format:check`; a read of `.maintenance-state`.

Deferred carried in (two): three remote branches surviving their pull requests (`data/photos-4`,
`data/photos-7`, `docs/maintenance-skill-structure`); `/evolve-engine` still in the legacy command
layout.

## 2. The check table

| Check                        | Found                                                                                                                                                                                                                                                                                                                       | Done                                                                                         |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1. Root inventory            | Every entry matches the allowlist except `.DS_Store`, which is gitignored and never reaches CI                                                                                                                                                                                                                              | Noted, not failed                                                                            |
| 2. `.gitkeep`s               | `features/.gitkeep` present; the only empty directory is `.claude/worktrees/`, Claude Code's git-excluded agent-worktree parent                                                                                                                                                                                             | Clean                                                                                        |
| 3. Folder naming             | `archive/features/UI Improvements/` carries a space and capitals against the kebab-case rule; it is referenced by name from `claude-design.md` and three `DECISIONS.md` entries. `app/convex/` has no hyphenated file                                                                                                       | Listed for Rajat (a rename is never done here)                                               |
| 4. Remote branches           | `data/photos-4` (#65 closed, 1 unmerged commit, 22 files) and `data/photos-7` (#73 closed, 1 unmerged commit, 11 files) survive closed, unmerged PRs; `docs/maintenance-skill-structure` (#266 merged) is already gone; `slow-loop/2026-09-07` (#271 open) and `docs/maintenance-2026-09-07` (#272 open) are this sitting's | Listed for Rajat: closed-but-unmerged is not the merged case the brief lets this pass delete |
| 5. Worktrees                 | Only the sitting's worktree, which has a Live row                                                                                                                                                                                                                                                                           | Clean                                                                                        |
| 6. Dev deployment            | `comments` and `nextWeekQueue` exist on `lovely-curlew-631` and are not in `schema.ts` (their rows were cleared at the Phase 9 close-out; the tables remain)                                                                                                                                                                | Listed for Rajat (a table is never dropped here)                                             |
| 7. `CLAUDE.md` status line   | `_none_`; `features/` holds the living gate report and this sitting's folder, both of which `CLAUDE.md` now names as allowed contents; no feature is active and `docs/PLAN.md` has no open phase                                                                                                                            | Clean                                                                                        |
| 8. Untracked and unformatted | Worktree and main directory both clean; `format:check` green over the finished tree                                                                                                                                                                                                                                         | Clean                                                                                        |
| 9. `.maintenance-state`      | Five rows; every row `done` at close-out; every counted deferral present under its pass                                                                                                                                                                                                                                     | Clean at close-out                                                                           |

## 3. Done

- None beyond the checks: nothing qualified for the one deletion this pass may make (a remote branch
  whose PR merged), because the only such branch was already gone.

## 4. For Rajat

- **`data/photos-4` and `data/photos-7`** (closed PRs #65 and #73, never merged). Each holds one
  commit of dish-photo work that later batches (#97, #99) superseded. Deleting them loses those two
  commits' photo variants, which nothing references; keeping them costs nothing but clutter.
- **`comments` and `nextWeekQueue` on the dev deployment.** Both retired from the schema and emptied;
  dropping them is a dashboard action on `lovely-curlew-631` only (production is not touched by this
  pass either way).
- **`archive/features/UI Improvements/`** breaks the kebab-case folder rule. A rename to
  `ui-improvements` is a `git mv` plus the four name references in `claude-design.md` and
  `DECISIONS.md` (the latter is append-only history, so its three mentions would stay as written and
  simply point at the old name).

## 5. Deferred

- The three items above, each awaiting Rajat's word.
- `/evolve-engine` still lives in the legacy `.claude/commands/` layout; the move to
  `.claude/skills/evolve-engine/` (D11) is a mechanical `git mv` plus a caller grep across two specs,
  eleven briefs, and a template, deferred again because nothing this sitting touched needs it.
- No contended files.
