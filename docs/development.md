# Development

How changes are made in this repo. Session model, worktree workflow, ship workflow, definition of done, diagnosis card discipline, slow loop trigger, escalation, commit conventions, anti-patterns. The process implements the cross-project standard at `~/Downloads/AI Products/DEVELOPMENT-PLAYBOOK.md`; this doc records how it lands here plus this repo's deliberate deltas.

## 1. Session model

Plantry has one persistent Claude Code session that holds the engineering manager (EM) role and short-lived engineer sessions spawned by the EM for scoped work. Rajat talks to the EM. The EM never writes feature code directly; it spawns engineers, reviews their PRs, decides what merges, escalates only when it cannot decide alone.

A build session starts on a phase. Rajat says "Begin development. We are on Phase N." and the EM reads, in order: `CLAUDE.md`, this doc, `docs/PLAN.md`, the active phase spec under `features/`, and the live-session registry at `coordination/active-streams.md`. It then identifies every unblocked stream in the spec's stream-state table (dependencies met, lanes free), not just the next one, confirms the picks in one line, and spawns one engineer per unblocked stream, each in its own worktree. Work runs parallel by default, serial by dependency: independent streams run concurrently, while a stream that consumes another stream's output, shares a lane, or touches a hotspot waits its turn in dependency order (§11). Every parallel stream clears the same gates and review as serial work; when independence is unclear, sequence it. If the stated phase disagrees with `docs/PLAN.md`, the EM surfaces the mismatch before any code is written.

**EM responsibilities:**

- Hold and re-read the four canonical docs and the active feature spec under `features/` (if any) at the start of every session.
- Identify every unblocked stream in the current feature's stream-state table and run them in parallel; single-stream execution is the floor, not the default.
- Spawn an engineer per unblocked stream, each in its own git worktree on its own branch, with a scoped brief, a pointer to the canonical docs, and a definition of done. Dependent or lane-sharing streams are sequenced in dependency order, not parallelized.
- Review every engineer PR before merge against the principles in `docs/product.md` §4 and the CI gates in `docs/engineering.md` §15.
- For every slice that touches the app frontend (`app/web`), spin off the in-depth full-flow crawl-and-compare pass against the PR preview before merge, and review its output (see §3 and `docs/engineering.md` §16).
- Track cross-stream consistency (a schema change should ripple to engine, Convex schema, frontend).
- Maintain `DECISIONS.md`: append-only log of non-trivial choices taken without Rajat.
- Surface batched open items to Rajat at natural checkpoints, never piecemeal.

**EM does not:**

- Write feature code.
- Create or change the GitHub repo, the Convex deployment, or hosting choices without Rajat's go-ahead.
- Push to remote without Rajat's first-push authorization.
- Edit `docs/engine.md` without a matching engine code and test change in the same PR. (CI also blocks this.)
- Accept work that violates the principles, even on push-back.
- Run destructive git operations.

**Engineer responsibilities:**

- Read `CLAUDE.md`, `docs/development.md` (this doc), and the relevant canonical docs.
- Stay in one stream and one PR-sized chunk.
- Carry a diagnosis card in every PR description (see §5).
- Ask the EM clarifying questions in the PR rather than guess.
- Self-test against the CI gates locally before opening the PR.
- Fan out independent subtasks (reading several files, running checks across modules, researching separate questions) as concurrent subagents or batched tool calls; run steps that consume an earlier step's output in order.

## 2. Worktree workflow

Every code-touching session works in its own git worktree on its own feature branch. The main repo directory at `/Users/rajatmugdal/Downloads/AI Products/Plantry` is the EM's read-coordinate-review space; a pre-commit hook in `.git/hooks/` rejects commits from it. Engineers commit from their worktree, not the main directory.

**To start a new engineer stream:** the EM invokes `/new-stream <branch> <stream-letter>` (see `.claude/commands/new-stream.md`). The command creates `../plantry-<branch>/` as a worktree, checks out a fresh branch, drops the engineer brief into the worktree, and opens a new Claude Code session anchored there.

**Branch naming:**

- `feat/<stream-letter>-<short-name>` for engineer streams. Example: `feat/B-engine-section-1-3`.
- `slow-loop/<date>` for slow-loop PRs. Example: `slow-loop/2026-07-12`.
- `docs/maintenance-<date>` for canonical-doc reconciliation. Example: `docs/maintenance-2026-07-12`.
- `chore/<short>` for tooling, deps, CI.
- `data/enrichment-<n>` for content batches that add descriptions, recipes, and cook fields to existing dishes. Example: `data/enrichment-0`.
- `data/photos-<n>` for content batches that add or refresh dish photos. Example: `data/photos-0`.
- `data/expansion-<n>` for content batches that add new dishes to the library. Example: `data/expansion-0`.

**Cleanup:** worktree closure is part of merging, not a later chore. On merge the EM removes the worktree (`git worktree remove`) and deletes the local branch (`git branch -D`) in the same step (§3 step 7). A periodic safety sweep catches any that slipped: `git worktree list` cross-checked against merged PRs, then remove each whose branch has landed.

## 3. Ship workflow

1. Engineer finishes work in worktree, runs CI gates locally (lint, type-check, tests, simulation harness, round-trip), opens a PR with a diagnosis card.
2. Vercel deploys a preview to `plantry-dev.mudgal.xyz` (aliased to the current PR's preview URL). Convex deploys a preview environment with an isolated DB.
3. For any slice that touches the app frontend, before approving the merge the EM spins off the in-depth full-flow crawl against the PR preview (`docs/engineering.md` §16): an automated walk of every customer flow across all tabs and every sheet, not just the new feature, capturing a screenshot of each screen and asserting the structural invariants (no horizontal overflow, key elements actually styled, focus moves into a sheet on open, background scroll locks while a sheet is open, tap targets at least 44px, a clean console), clicking every new interactive affordance and asserting the resulting state (not only screenshotting it), and comparing each rendered screen against the matching screen in the active feature's `features/<name>/` handoff (the live app is the reference when no feature is active). The EM reviews the output and resolves or explicitly accepts every deviation before merge. A CSS or shared-primitive change is whole-app blast radius: it is crawled across all tabs regardless of the slice's nominal scope.
4. EM reviews the PR against principles and gates. Before merging, the EM confirms the PR's true merged state, not just its reported `mergeable` flag: GitHub can show a branch as mergeable and clean while it is behind `main` and would break once merged, and branch protection does not catch a stale-but-mergeable branch. The EM updates the branch onto `origin/main` (`git fetch && git rebase origin/main` in the worktree, §11.3), re-runs the engine check and re-bakes on that true merged state, and re-runs any count-sensitive tests, then either merges or sends back with specific notes.
5. On merge to `main`, Vercel and Convex promote to production at `plantry.mudgal.xyz`. The EM verifies the live deploy (open the URL, re-run the crawl's smoke pass across all tabs (every tab renders, no horizontal overflow, a clean console), not only the current week).
6. EM appends an entry to `docs/CHANGELOG.md`: date, short title, a present-tense description referencing the PR, a `Why:` line (the motivation), and an `Updated:` line naming the canonical or operational doc sections the change makes stale (or "none"). The `Updated:` line is the work queue for `/reconcile-docs` and `/reconcile-ops`; without it the reconciliation passes re-derive each entry's doc impact from the diff. When the merged change references an entry in `data/changelog.md` that shipped with a `(#TBD)` or `(PR pending)` placeholder, the EM backfills the real PR number on that entry at merge time, so no new placeholder persists past its merge.
7. EM closes out the worktree as part of the same merge step, not later: `scripts/end-session.sh` run from inside the worktree (it merges the session's Claude auto-memory into the canonical project memory dir, then removes the worktree; Claude Code keys memory on the dasherized cwd, so a worktree session's memory is lost on removal without this merge) and `git branch -D <branch>` (a squash-merge leaves the branch non-ancestor, so `-D` is expected), then `git -C <main dir> checkout main && git pull --ff-only` so the EM's local `main` does not drift behind `origin/main`, and moves the stream's registry row to Shipped (§11.1). A merge is not done until its worktree and branch are gone and local `main` is current; leaving them is what accumulates stale worktrees and a stale main across parallel sessions. New streams always branch off freshly-fetched `origin/main` (§11.3), never this local `main`, so a missed update never silently bases a stream on stale code; keeping it current is hygiene, not correctness-critical.
8. **Feature close-out.** When the LAST stream of a feature merges (a feature is done when every stream in its spec's stream-state table has merged), the EM closes the feature in the same sitting: confirm the feature's stream-state table reflects the true merged state (correct it if it lags; never archive a stale table), `git mv features/<name>.md archive/features/<name>.md` while keeping `features/.gitkeep` in place, reset the `CLAUDE.md` "Currently building" line to `_none_`, flip the phase's row in `docs/PLAN.md` to shipped, tag the close (`git tag -a phase-<n>-complete -m "Phase <n>: <name>"`, tag pushed, so `git log phase-<n-1>-complete..phase-<n>-complete` answers what the phase contained permanently), and run (or queue) `/reconcile-docs` and `/reconcile-ops` for any docs the feature touched.

## 4. Definition of done

A PR is done when ALL of:

- All CI gates pass (see `docs/engineering.md` §15).
- The diagnosis card is present in the PR description.
- New behavior has tests; the simulation harness still passes.
- No scope creep: the PR changes only what its brief described.
- No principle violation: an EM reviewer would not flag anything in `docs/product.md` §4.
- No `// TODO` left behind without a tracked follow-up in the active feature spec or a new feature doc.
- For UI changes: the EM has run the full-flow crawl-and-compare pass (§3, `docs/engineering.md` §16) against the preview, covering every flow and every sheet and compared against the active feature's `features/<name>/` handoff (the live app when no feature is active), and linked its result in the PR; any deviation from the design is resolved or explicitly accepted in the diagnosis card. A CSS or shared-primitive change is verified across all tabs, not only the touched screen.
- For iOS-affecting CSS or layout changes: real-device (iPhone) verification is required before merge. The desktop crawl runs Chromium and WebKit but cannot reproduce a real-iOS-device-only rendering difference, so a green crawl is necessary but not sufficient; Rajat checks the change on his iPhone before it merges.
- Merge happens on the true merged state: immediately before merge the branch is updated onto `origin/main` and the engine check is green on that updated state (§3, §11.3), not only on a possibly-stale `mergeable` flag. A green check on a behind-`main` branch is not proof the merge is safe.
- All horizontal container padding goes through the gutter token (`--pt-gutter` in `app/web/src/index.css`): no raw per-container horizontal padding literals, and no `env(safe-area-inset-left|right)` inside a `padding` or `margin` shorthand. Horizontal padding is written as explicit `padding-left` / `padding-right` longhand with the token as the floor and the safe-area inset as a fallback. A stylelint rule blocks the fragile shorthand form.

## 5. Diagnosis card

Every PR description starts with a diagnosis card. Engineer PRs, slow-loop PRs, EM-authored chore PRs, all of them. The card forces right-size discipline (Principle 1) to be auditable.

```
## Diagnosis

**Problem size:** one-off | small pattern | structural
**Trigger:** (PR brief link, comment ID, incident ID, or rule citation)
**Candidate fix levels considered:**
  - data row: <what would change>
  - new tag: <what would change>
  - rule edit: <what would change>
  - engine code: <what would change>
  - UI affordance: <what would change>
  - infrastructure: <what would change>
**Chosen level:** <one>
**Why this level:** <one or two sentences>
**Generality check:** <does this also unlock other latent improvements, or is it brittle to this one case>
**Rejected alternatives:** <one or two sentences per rejected level>
**Residual checks:** <verification the automated crawl and CI could not close and that travels with this PR: real-device (iPhone) sign-off, an after-production-deploy behaviour, a flow that needs a seeded or regenerated week (`docs/engineering.md` §16); or "none">
```

For trivial changes (a typo fix, a dep bump) the card is one line: `**Problem size:** trivial; no diagnosis needed.` The EM uses judgment on what counts as trivial.

For PRs that propose no behavior change after diagnosis ("the comment looks like a one-week aberration"), the card states this explicitly and the PR exists only to mark the queued items `reviewed_no_change` with the reason.

## 6. Slow loop trigger

The slow loop runs only when Rajat invokes it. Convention is Sunday around 11am IST, but the cadence is not enforced.

**To run the slow loop:**

1. Rajat opens a Claude Code session in the main repo directory.
2. Types `/slow-loop`. (Definition lives at `.claude/commands/slow-loop.md`.)
3. The session reads queued comments from Convex (via `npx convex run`), reads the dish library under `data/dishes/`, the `data/ingredients.md` catalog, `data/menu_history.md`, `docs/engine.md`, and recent `incidents` from Convex.
4. The session clusters comments + incidents into themes and applies right-size discipline. For each theme it picks one of: data fix, tag addition, rule edit, no change warranted.
5. The session opens a PR with a diagnosis card per theme, file diffs across `data/dishes/`, `data/ingredients.md`, `docs/engine.md`, `engine/src/`, and an appended `data/changelog.md` entry.
6. Rajat reviews on GitHub. Merge applies. On merge a GitHub Action posts back to Convex to mark consumed comments `applied` and link the PR.

Full slow-loop spec: `MAINTENANCE.md`.

## 7. Escalation rules

The EM decides on its own:

- Stream sequencing and engineer brief shape.
- PR merges that pass principles and gates.
- File and folder organization changes within the agreed layout.
- Test-only changes, dep bumps, lint fixes.
- Most slow-loop reasoning (the card makes the reasoning auditable).

The EM surfaces to Rajat before acting:

- Visibly destructive operations (force-push, history rewrite, dropping a Convex table, deleting branches).
- Cross-stream product behavior changes (e.g., changing what the menu image looks like).
- Cost or hosting changes (Convex paid tier, switching frontend host, buying a domain).
- Adding a tool, service, or library not named in `docs/engineering.md`.
- Any structural change to canonical data (the `data/dishes/` library, the `data/ingredients.md` catalog, `docs/engine.md`) initiated by the EM rather than the slow loop.
- Genuine judgment ties where the EM has weighed both sides.

EM-without-Rajat decisions go into `DECISIONS.md`. Rajat scans periodically; can override anything by replying in chat or editing the doc.

## 8. Commit conventions

- One concern per commit. Resist piling unrelated fixes into one commit.
- Imperative present tense in the subject. "Add round-trip test for ingredients" not "Added" or "Adding".
- Subject <= 70 characters; wrap body at 72.
- Body is optional for tiny commits; required for anything non-obvious.
- No "WIP" commits on `main`; squash before merge if needed.
- No co-author trailers unless Rajat asks.

## 9. Anti-patterns

The EM rejects PRs that exhibit any of:

- Sycophantic agreement to a comment without applying right-size discipline ("the comment said too spicy, so I added a low_spice tag" without considering whether one comment justifies a tag).
- Generalizing from one or two cases ("we could add a column to handle this and three other hypothetical cases").
- Adding a Pydantic-style abstraction or helper before two existing call sites need it.
- Touching `docs/engine.md` without a matching engine code change.
- Touching canonical dish data (the `data/dishes/` library, the `data/ingredients.md` catalog) outside the two legitimate paths. Structural rule and library changes go through the slow loop. Content batches (descriptions, recipes, cook fields, photos, new dishes) go through reviewed content-batch PRs on `data/enrichment-*`, `data/photos-*`, or `data/expansion-*` branches, each reviewed by Rajat personally. Any other path is the anti-pattern.
- Past-tense narrative in canonical docs ("we used to do X but now do Y").
- "Refactor while I'm here" scope creep.
- New libraries or platform services not in `docs/engineering.md` §1.
- TODO comments without a tracked follow-up.
- Mocking the database in tests that should hit the real Convex preview deployment.

## 10. Asking for help

When an engineer is blocked, the engineer posts a single comment on the PR addressed to the EM:

```
## EM check needed

**What I'm trying to do:** <one sentence>
**What I tried:** <bullets>
**Where I'm stuck:** <one sentence>
**Two options I see:** <a>, <b>
**My lean:** <a or b, with one reason>
```

The EM either answers or escalates to Rajat. Engineers do not ping Rajat directly.

## 11. Parallel-session coordination

This repo routinely runs several worktree sessions at once and lands many PRs per hour on the same hotspots (picker components, `data/dishes/`, the CHANGELOG, `DECISIONS.md`, feature stream-tables). §2 isolates each session physically; this section keeps their _merges_ clean by pre-planning who owns which files.

### 11.1 The live-session registry

`coordination/active-streams.md` is the single source of truth for what is in flight. It is local and gitignored: it lives only in the main repo dir, the EM edits it by hand, and it never travels onto a branch, so it can never itself become a merge conflict. Worktree sessions read it (the brief carries its absolute path); they do not edit it.

The EM maintains it:

- **Before spawning a stream:** scan the registry. Choose file lanes no live stream owns. If the new stream must share a lane, do not run it in parallel; either narrow the lane or sequence it and record the merge order in the Hotspot ledger.
- **On spawn:** add a Live streams row naming the exact owned paths.
- **On merge:** move the row to Shipped and clear any Hotspot ledger rows it closed.

The `/new-stream` command writes the registry row as part of spawning (see `.claude/commands/new-stream.md`).

### 11.2 Lane discipline

A stream stays inside its declared file lanes. Crossing into another stream's lane is the parallel-work equivalent of scope creep: it is the thing that turns two clean branches into a conflict. If a stream discovers it genuinely needs a file another stream owns, it raises an `EM check needed` note (§10) rather than editing across the lane line; the EM decides whether to widen the lane, resequence, or hand the file off.

Name lanes at real-path granularity so near-neighbours still parallelise: `app/web/src/components/Explore*` and `app/web/src/components/DayEditor*` are different lanes even though both are "the frontend".

### 11.3 Merge ownership: the later-merging session owns the rebase

Branches start from `origin/main`, not a stale local `main` (`/new-stream` fetches first). When two branches converge:

1. Push your branch.
2. Before merging, `git fetch && git rebase origin/main` inside your worktree.
3. Resolve conflicts in the worktree.
4. `git push --force-with-lease` your own branch. **Never force-push `main` or a branch another session is on.**
5. Merge to `main`.

If session A merges first, session B owns the entire rebase. This is ordinary git etiquette; it is codified because parallel sessions make it routine, and because branch protection will not catch a stale branch that still shows mergeable (re-confirm `mergeable` and a green engine check immediately before every merge).

### 11.4 Hotspot protocol

Some files cannot be lane-partitioned because every stream touches them. Each gets a planned merge order in the registry's Hotspot ledger.

- **`docs/CHANGELOG.md`, `DECISIONS.md`, and feature stream-tables** are EM-owned. Engineers do not edit them. The EM batches CHANGELOG and DECISIONS entries into one docs PR at a checkpoint (the main dir cannot commit, so this matches the repo's existing docs-PR cadence). Append-only; never rewrite an existing entry.
- **Tree-wide data migrations** (a change that rewrites every file under `data/dishes/`, e.g. adding a field to every dish) merge _last_ among the streams that touch that tree, so the migrating stream rebases once onto the others' content rows rather than forcing every content stream to fight a tree-wide rewrite.
- **Shared UI primitives** (the `Chip`, picker styles, anything under a shared component or global CSS): keep edits inside your own component. Touch the shared primitive only if unavoidable, and add a Hotspot ledger row when you do. A shared-primitive change is whole-app blast radius and gets the full crawl (§3).
- **Canonical docs** (`docs/product.md`, `docs/engine.md`, `docs/engineering.md`, this file) are reconciled by the maintenance job / `reconcile-docs`, not edited in shipping sessions (see `MAINTENANCE.md`). The one exception is an append-only addition that would otherwise force a renumber of sections other docs cross-reference; append, do not insert.

### 11.5 Staging hygiene

Never `git add -A` or `git add .`. Stage by filename or directory. Worktrees already make cross-session contamination impossible, but staging unrelated changes within your own worktree still produces noisy, hard-to-review commits. One concern per commit (§8).

## 12. Glossary

- **Worktree.** A git feature: multiple working directories sharing one repository, each on a different branch. Lets the EM spawn engineers in parallel without their changes overlapping until merge.
- **Pre-commit hook.** A script in `.git/hooks/` that runs before every commit and can refuse the commit. Used here to keep commits out of the main coordination directory.
- **Convex preview deployment.** Convex's per-PR isolated environment with its own database. Lets you test a PR's backend without touching production.
- **Vercel preview deployment.** Same idea, for the frontend. Every PR gets a unique URL.
- **Squash merge.** Combining all of a PR's commits into one before landing on `main`. Keeps `main` history clean.
- **CI gate.** A check defined in `.github/workflows/ci.yml` that runs on every PR. Failing any gate blocks merge.
- **Live-session registry.** A local, gitignored coordination file (`coordination/active-streams.md`) the EM maintains, listing every in-flight stream and the file lanes it owns. Read before spawning any stream so two sessions never collide on the same files. See §11.
- **File lane.** The concrete set of paths a stream owns for the life of its branch (real paths like `engine/src/nutrition.ts` or `app/web/src/components/Explore*`, not whole areas). Two streams with disjoint lanes can run in parallel safely.
- **Hotspot.** A file more than one live stream will touch (the CHANGELOG, `DECISIONS.md`, a feature stream-table, a tree-wide data migration, a shared UI primitive). Hotspots get a planned merge order in the registry's Hotspot ledger rather than colliding by accident.
- **Subagent.** A short-lived child Claude session spawned inside a running session with a narrow brief and its own context window. Several run concurrently without sharing state, which makes them the in-session analogue of giving each stream its own worktree.
