---
description: Spawn a new engineer in a fresh git worktree on a scoped branch with a generated brief. EM-only.
---

You are spawning a new engineer for a Plantry stream. Read `CLAUDE.md`, `docs/development.md` §1-2, and the active feature spec under `features/` (the file named in `CLAUDE.md` "Currently building"; if that line reads "none", the work is a standalone stream and there is no feature spec to read) to know the stream's scope.

## Arguments

- `<branch>` — short branch name suffix. The full branch follows `docs/development.md` §2 branch naming: `feat/<stream-letter>-<branch>` when the work is a lettered stream in the active feature spec, otherwise the right prefix for the work (`feat/<branch>`, `fix/<branch>`, `chore/<branch>`, or a `data/enrichment-<n>` / `data/photos-<n>` / `data/expansion-<n>` content batch).
- `<stream-letter>` — optional; the stream letter from the active feature spec's stream table when the work is part of a lettered feature. Stream letters are per-feature (each feature spec defines its own set), not a fixed global list. Omit for standalone work.

## What to do

1. **Read the live-session registry.** Open `coordination/active-streams.md` (`docs/development.md` §11). Decide the new stream's file lanes and confirm no live stream already owns them. If they overlap, do not spawn in parallel: narrow the lane, or sequence the stream and add a Hotspot ledger row with an explicit merge order. Branch off `origin/main`, not stale local main (`git fetch origin` first).
2. **Verify clean state.** Confirm the main repo working tree is clean (`git status`). If not, abort and ask Rajat what to commit or stash.
3. **Create the worktree.** Run (substituting the full branch name chosen above):
   ```
   git worktree add ../plantry-<branch> -b <full-branch-name> origin/main
   ```
4. **Register the stream.** Add a Live streams row to `coordination/active-streams.md`: branch, worktree path, the exact file lanes this stream owns, any Hotspot ledger reference, the date, and status `in progress`. This is what the next spawn reads to stay off your files.
5. **Drop in the engineer brief.** Write `../plantry-<branch>/.engineer-brief.md` with:
   - The stream's scope (one paragraph from the active feature spec under `features/` for this stream, or the task description for standalone work).
   - **This stream's declared file lanes**, and the rule: stay inside them; raise an `EM check needed` note before touching another stream's files (`docs/development.md` §11.2).
   - **The other live streams and their lanes** (copied from the registry) so the engineer knows what to avoid, plus the absolute path to `coordination/active-streams.md` to re-read.
   - **Merge ownership** (`docs/development.md` §11.3): branch is off `origin/main`; the later-merging session owns the rebase; `--force-with-lease` your own branch only, never `main`.
   - **Do not edit `docs/CHANGELOG.md`, `DECISIONS.md`, or feature stream-tables.** These are EM-owned and EM-batched (`docs/development.md` §11.4); engineers appending their own CHANGELOG entry is a recurring merge-conflict source. Describe what shipped in the PR body; the EM writes the CHANGELOG line.
   - **Run installs and long commands early, and stream their output.** Run `npm install` / `npm test` up front, not buried mid-task, and avoid a single long silent command: the subagent watchdog kills a stream after about 600s with no output, so a silent `npm install` or full test run can lose in-flight work. Break long runs up or emit progress as they go.
   - **Run `npm install && npm run bake` before any typecheck / build / test.** A fresh worktree has no `engine/src/data/library.ts` or `engine/src/data/history.ts`; the bake generates them from the markdown library (they are gitignored), so a typecheck or test run before the bake fails with a confusing "missing module" error that looks like a broken checkout, not a real defect.
   - **Run `npm run format:check` before pushing.** CI runs Prettier as its own step, separate from lint / typecheck / tests, so a branch that passes the other gates can still fail CI on formatting alone. Run it (or `npm run format` to fix) as part of the local gate pass, not just lint and tests.
   - **Commit and push early on a long-running or rebase-owning stream.** Keep an intact remote branch to resume from: a usage limit or the watchdog can terminate a session mid-task, and a rebase is the worst moment to lose one. Never carry a large uncommitted working tree across a rebase; commit first, then rebase.
   - **If your stream runs a Convex dev smoke, know two traps.** A stale gitignored `app/convex/dist/` (emitted by the root build) breaks `npx convex dev --once` bundling because `convex.json` declares `functions: "./"`; clean it first. And the auto-created `app/convex/.env.local` may point at `anonymous:anonymous-convex` (a local backend) rather than `dev:lovely-curlew-631`, so a smoke "pass" can silently target the wrong deployment; confirm the deployment before trusting the result.
   - The definition of done (`docs/development.md` §4).
   - The diagnosis card format (`docs/development.md` §5).
   - The CI gates (`docs/engineering.md` §15).
   - The principles (`docs/product.md` §4) as a quick load.
   - A pointer to `CLAUDE.md`.
6. **Open a session in the worktree.** Output the command Rajat (or EM) runs to enter:
   ```
   cd ../plantry-<branch> && claude
   ```
7. **Update stream state.** If the work is part of an active feature, set this stream to "in progress" in that feature spec's stream-state table and add the worktree path under its owner column. The live registry (`coordination/active-streams.md`, step 4) is the source of truth for in-flight coordination either way.
8. **Log to DECISIONS.md** if any scoping choice was made (which sub-slice, why).

## Engineer contract (what the brief encodes)

The engineer:

- Stays in this worktree. Does not touch the main directory.
- Stays in this stream. Does not silently expand scope.
- Carries a diagnosis card in the PR description.
- Self-runs the CI gates locally before opening the PR.
- Asks the EM (via PR comment with the "EM check needed" template in `docs/development.md` §10) instead of pinging Rajat.
- Does not edit `docs/CHANGELOG.md`, `DECISIONS.md`, or feature stream-tables (EM-owned, §11.4); describes what shipped in the PR body instead.
- Runs installs and long test runs early and streams their output, so the watchdog does not kill a silent long-running command.
- Opens one PR per slice. Squash-merges on approval.

## Cleanup on merge

Worktree closure is part of merging a PR, not an optional afterthought (`docs/development.md` §2, §3). The moment a stream's PR merges to `main`, the EM runs, in the same step as the merge:

```
(cd ../plantry-<branch> && ../Plantry/scripts/end-session.sh)   # memory merge + worktree removal
git branch -D <full-branch-name>            # local branch (squash-merge leaves it non-ancestor)
```

`end-session.sh` merges the worktree session's Claude auto-memory into the canonical project memory dir before removing the worktree (Claude Code keys memory on the dasherized cwd, so without the merge a worktree session's learnings are lost). Pass `--dry-run` to preview the merge. A plain `git worktree remove` is the fallback when the session wrote no memory.

then updates the active feature spec's stream-state table (if any), and moves the stream's row in `coordination/active-streams.md` to Shipped, clearing any Hotspot ledger rows it closed. Leaving a merged worktree or branch behind is the failure mode that accumulates stale worktrees across parallel sessions; a periodic sweep is `git worktree list` cross-checked against merged PRs, then `git worktree remove` each one whose branch has landed.
