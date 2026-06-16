---
description: Spawn a new engineer in a fresh git worktree on a scoped branch with a generated brief. EM-only.
---

You are spawning a new engineer for a Plantry stream. Read `CLAUDE.md`, `docs/development.md` §1-2, and `features/phase2.md` §3 first to know which stream and which slice within it.

## Arguments

- `<branch>` — short branch name suffix. The full branch will be `feat/<stream-letter>-<branch>`.
- `<stream-letter>` — one of 0, A, B, C, D, E, F, G as defined in `features/phase2.md` §2.

## What to do

1. **Read the live-session registry.** Open `coordination/active-streams.md` (`docs/development.md` §11). Decide the new stream's file lanes and confirm no live stream already owns them. If they overlap, do not spawn in parallel: narrow the lane, or sequence the stream and add a Hotspot ledger row with an explicit merge order. Branch off `origin/main`, not stale local main (`git fetch origin` first).
2. **Verify clean state.** Confirm the main repo working tree is clean (`git status`). If not, abort and ask Rajat what to commit or stash.
3. **Create the worktree.** Run:
   ```
   git worktree add ../plantry-<branch> -b feat/<stream-letter>-<branch> origin/main
   ```
4. **Register the stream.** Add a Live streams row to `coordination/active-streams.md`: branch, worktree path, the exact file lanes this stream owns, any Hotspot ledger reference, the date, and status `in progress`. This is what the next spawn reads to stay off your files.
5. **Drop in the engineer brief.** Write `../plantry-<branch>/.engineer-brief.md` with:
   - The slice's scope (one paragraph from `features/phase2.md` §3 for this stream).
   - **This stream's declared file lanes**, and the rule: stay inside them; raise an `EM check needed` note before touching another stream's files (`docs/development.md` §11.2).
   - **The other live streams and their lanes** (copied from the registry) so the engineer knows what to avoid, plus the absolute path to `coordination/active-streams.md` to re-read.
   - **Merge ownership** (`docs/development.md` §11.3): branch is off `origin/main`; the later-merging session owns the rebase; `--force-with-lease` your own branch only, never `main`.
   - The definition of done (`docs/development.md` §4).
   - The diagnosis card format (`docs/development.md` §5).
   - The CI gates (`docs/engineering.md` §15).
   - The principles (`docs/product.md` §4) as a quick load.
   - A pointer to `CLAUDE.md`.
6. **Open a session in the worktree.** Output the command Rajat (or EM) runs to enter:
   ```
   cd ../plantry-<branch> && claude
   ```
7. **Update stream state.** Edit `features/phase2.md` §4: set the stream to "in progress", add the worktree path under "Owner".
8. **Log to DECISIONS.md** if any slice choice was made (which sub-slice, why).

## Engineer contract (what the brief encodes)

The engineer:
- Stays in this worktree. Does not touch the main directory.
- Stays in this stream. Does not silently expand scope.
- Carries a diagnosis card in the PR description.
- Self-runs the CI gates locally before opening the PR.
- Asks the EM (via PR comment with the "EM check needed" template in `docs/development.md` §10) instead of pinging Rajat.
- Opens one PR per slice. Squash-merges on approval.

## Cleanup on merge

After the engineer's PR merges to `main`, the EM runs:
```
git worktree remove ../plantry-<branch>
git branch -D feat/<stream-letter>-<branch>  # local
```
updates `features/phase2.md` §4 (stream state), and moves the stream's row in `coordination/active-streams.md` to Shipped, clearing any Hotspot ledger rows it closed.
