# Development

How changes are made in this repo: the session model, the worktree workflow, the ship workflow, the definition of done, the diagnosis card, the maintenance trigger, escalation, commit conventions, anti-patterns, and parallel-session coordination. The process implements the cross-project standard at `~/Downloads/AI Products/DEVELOPMENT-PLAYBOOK.md` in its EM mode; this doc records how that standard lands here plus this repo's deliberate deltas: the two slow workflows are skills (`/maintain` and `/evolve-engine`) rather than the playbook's three reconciliation commands, the pre-commit hook guards code paths rather than every commit, and every frontend slice carries a full-flow UI crawl before merge.

## 1. Session model

Plantry has one persistent Claude Code session that holds the engineering manager (EM) role and short-lived engineer sessions the EM spawns for scoped work. Rajat talks to the EM. The EM never writes feature code directly; it spawns engineers, reviews their PRs, decides what merges, runs the two slow workflows when Rajat invokes them, and escalates only when it cannot decide alone.

A build session starts on a phase. Rajat says "Begin development. We are on Phase N." and the EM reads, in order: `CLAUDE.md`, this doc, `docs/PLAN.md`, the active phase spec under `features/`, and the live-session registry at `coordination/active-streams.md`. It then identifies every unblocked stream in the spec's stream-state table (dependencies met, lanes free), not just the next one, confirms the picks in one line, and spawns one engineer per unblocked stream, each in its own worktree. Work runs parallel by default, serial by dependency: independent streams run concurrently, while a stream that consumes another stream's output, shares a lane, or touches a hotspot waits its turn in dependency order (§11). Every parallel stream clears the same gates and review as serial work; when independence is unclear, sequence it. If the stated phase disagrees with `docs/PLAN.md`, the EM surfaces the mismatch before any code is written.

Between phases the same session handles standalone streams (a fix, a chore, a content batch), a maintenance sitting (`/maintain`, §6), an engine evolution (`/evolve-engine`, `EVOLVING-THE-ENGINE.md`), and the household's operational needs: generating the week by hand, promoting a custom dish the household ate into the library, and the production reads and writes each of these takes with Rajat's per-action approval.

**EM responsibilities:**

- Hold and re-read the four canonical docs and the active feature spec under `features/` (if any) at the start of every session.
- Identify every unblocked stream in the current feature's stream-state table and run them in parallel; single-stream execution is the floor, not the default.
- Spawn an engineer per unblocked stream, each in its own git worktree on its own branch, with a scoped brief, a pointer to the canonical docs, and a definition of done (§2). Dependent or lane-sharing streams are sequenced in dependency order, not parallelized.
- Review every engineer PR before merge against the principles in `docs/product.md` §4 and the CI gates in `docs/engineering.md` §15, and confirm the engine check is green by name, not only the mergeable flag (§3 step 4).
- For every slice that touches the app frontend (`app/web`), spin off the in-depth full-flow crawl-and-compare pass against the PR preview before merge, and review its output (§3, `docs/engineering.md` §16).
- Track cross-stream consistency: a schema change ripples to the engine, the Convex schema, and the frontend, and a Convex signature change ships backend-compatible first (`docs/engineering.md` §9).
- Own the hotspot files: `docs/CHANGELOG.md`, `DECISIONS.md`, and feature stream-tables (§11.4). Maintain `DECISIONS.md` as the append-only log of non-trivial choices taken without Rajat, and append to `RETRO.md` at session close (§6).
- Surface batched open items to Rajat at natural checkpoints, never piecemeal.

**EM does not:**

- Write feature code. Documentation PRs, chore PRs, and the ledgers are the EM's to author.
- Create or change the GitHub repo, the Convex deployments, or hosting choices without Rajat's go-ahead.
- Merge to `main`, run a `--prod` Convex command, or push to remote without Rajat's approval for that action; approval in one turn does not carry to the next.
- Edit `docs/engine.md` without a matching engine code and test change in the same PR. Review holds this pairing and no CI check does, so the EM is the check.
- Accept work that violates the principles, even on push-back.
- Run destructive git operations.

**Engineer responsibilities:**

- Read `CLAUDE.md`, this doc, and the relevant canonical docs.
- Stay in one stream and one PR-sized chunk.
- Carry a diagnosis card in every PR description (§5).
- Ask the EM clarifying questions in the PR (§10) rather than guess.
- Self-test against the CI gates locally, in CI order, before opening the PR (§3 step 1).
- Fan out independent subtasks (reading several files, running checks across modules, researching separate questions) as concurrent subagents or batched tool calls; run steps that consume an earlier step's output in order.

## 2. Worktree workflow

Every code-touching session works in its own git worktree on its own branch. The main repo directory at `/Users/rajatmugdal/Downloads/AI Products/Plantry` is the EM's read-coordinate-review space. A pre-commit hook (`.githooks/pre-commit`, installed into `.git/hooks/` by `scripts/install-hooks.sh` on every `npm install`) rejects any commit from the main directory that touches a code path: `engine/`, `app/`, `data/`, or `docs/engine.md`. Coordination edits from the main directory (the ledgers, `CLAUDE.md`, the other canonical docs, `features/`) are not blocked by the hook, but a canonical-doc rewrite still lands as a reviewed PR from a worktree (playbook principle 3: the merge is the approval). Commits from any worktree are allowed.

**To start a new engineer stream:** the EM invokes `/new-stream <branch> <stream-letter>` (`.claude/commands/new-stream.md`). The command reads the registry (§11.1), fetches `origin`, creates `../plantry-<branch>/` as a worktree on a fresh branch off `origin/main` (never off a possibly stale local `main`), registers the stream, drops the engineer brief into the worktree as `.engineer-brief.md`, and prints the command that opens a Claude Code session there. The brief carries the stream's scope and lanes, the other live streams' lanes, the merge-ownership rule, the hotspot rule, and the local-gate traps a fresh worktree hits: run `npm install && npm run bake` before any typecheck, build, or test (the baked library is gitignored and absent until then), run the gates in CI order and re-bake after the engine tests (the bake test deletes the baked module in its `afterAll`), re-run the full gate set including `format:check` after every rebase, and stream long commands' output so the subagent watchdog does not kill a silent run.

**Branch naming:**

- `feat/<stream-letter>-<short-name>` for engineer streams inside a feature. Example: `feat/B-engine-section-1-3`. A standalone feature stream with no letter is `feat/<short-name>`.
- `feat/engine-<version>` for the integration branch of an engine evolution's build (`EVOLVING-THE-ENGINE.md` §4.7); every build stream PR targets it, and it squash-merges to `main` once the gate passes.
- `fix/<short-name>` for a defect fix that is not part of a feature stream.
- `chore/<short-name>` for tooling, deps, CI, and the stream-sized fixes the retro pass files.
- `docs/<short-name>` for a documentation-only PR outside a maintenance sitting: a canonical or operational doc correction, a CHANGELOG or DECISIONS batch.
- `evolve/engine-<version>` for an `/evolve-engine` run: the run folder under `features/engine-<version>/` and every artifact the run commits. Example: `evolve/engine-v7`.
- `slow-loop/<date>` for the first PR of a `/maintain` sitting, the signals and health passes. Example: `slow-loop/2026-09-07`. The prefix is load-bearing: the mark-applied action (`MAINTENANCE.md` §3) triggers on it.
- `docs/maintenance-<date>` for the second PR of a sitting, the docs, retro, and hygiene passes. Example: `docs/maintenance-2026-09-07`.
- `data/enrichment-<n>` for content batches that add descriptions, recipes, and cook fields to existing dishes.
- `data/photos-<n>` for content batches that add or refresh dish photos.
- `data/expansion-<n>` for content batches that add new dishes to the library (`ADDING-DISHES.md`).

**Cleanup:** worktree closure is part of merging, not a later chore. On merge the EM runs `scripts/end-session.sh` from inside the worktree and deletes the local branch in the same step (§3 step 7). A periodic safety sweep catches any that slipped: `git worktree list` cross-checked against merged PRs, then remove each whose branch has landed; the hygiene pass of `/maintain` runs this sweep every sitting.

## 3. Ship workflow

1. The engineer finishes work in the worktree, runs the CI gates locally in CI order (bake, typecheck, lint, format check, CSS lint, build, engine tests, web tests; `docs/engineering.md` §15), and opens a PR with a diagnosis card (§5). A stream that stacks on another stream targets that stream's branch, not `main`; CI runs on every PR whatever it targets.
2. Vercel deploys a frontend preview for the PR (`plantry-dev.mudgal.xyz` aliases the current PR's preview). There is no per-PR Convex deployment: a branch that changes a Convex function pushes it to the dev deployment with `npx convex dev --once` before its flows are crawled, and a preview frontend talks to dev (`docs/engineering.md` §9). Two traps: a stale gitignored `app/convex/dist/` breaks the bundling, and the auto-created `app/convex/.env.local` can point at a local backend rather than dev, so the deployment is confirmed before a smoke result is trusted.
3. For any slice that touches the app frontend, before approving the merge the EM spins off the in-depth full-flow crawl against the PR preview (`docs/engineering.md` §16): an automated walk of every customer flow across all tabs and every sheet, not just the new feature, capturing a screenshot of each screen and asserting the structural invariants (no horizontal overflow, the content gutter held, key elements actually styled, focus moving into a sheet on open, background scroll locked while a sheet is open, tap targets at least 44px, a clean console), clicking every new interactive affordance and asserting the resulting state, and comparing each rendered screen against the matching screen in the active feature's `features/<name>/` handoff (the live app is the reference when no feature is active). The EM reviews the output and resolves or explicitly accepts every deviation before merge. A CSS or shared-primitive change is whole-app blast radius: it is crawled across all tabs regardless of the slice's nominal scope. When the preview is unreachable the crawl runs against a local build of the branch, and the two iOS-only checks go to Rajat's iPhone (§4).
4. The EM reviews the PR against the principles and the gates. Before merging, the EM confirms the PR's true merged state, not its reported `mergeable` flag: GitHub can show a branch as mergeable while it is behind `main` and would break once merged, and branch protection does not catch a stale-but-mergeable branch or a red engine check. The EM updates the branch onto `origin/main` (`git fetch && git rebase origin/main` in the worktree, §11.3), re-runs the engine check and re-bakes on that state, re-runs any count-sensitive tests (a coverage assertion of the form `x < total` can flip when the base adds rows), then either merges or sends back with specific notes. This repo lands several PRs a day on the same hotspots, so `mergeable` is re-checked immediately before every merge, not once at review time.
5. Merging is Rajat's approval to give per PR; the EM asks and merges on a yes, squash by default. On merge to `main`, Vercel builds the frontend and, when `app/convex/`, `engine/`, or `data/` changed, the `Deploy Convex` action deploys the backend; the two are asynchronous (`docs/engineering.md` §9). The EM verifies the live deploy: the `Deploy Convex` run is green when it ran, `plantry.mudgal.xyz` opens, and the crawl's smoke pass across all tabs reads clean (every tab renders, no horizontal overflow, a clean console).
6. The EM appends an entry to `docs/CHANGELOG.md`: date, short title, a present-tense description referencing the PR, a `Why:` line (the motivation), and an `Updated:` line naming the canonical or operational doc sections the change makes stale (or "none"). The `Updated:` line is the work queue for the docs pass of `/maintain` (`MAINTENANCE.md` §4.3); without it the pass re-derives each entry's doc impact from the diff. An EM-authored PR carries its own CHANGELOG entry; an engineer's entry is written by the EM at merge (§11.4). When the merged change references an entry in `data/changelog.md` that shipped with a `(#TBD)` or `(PR pending)` placeholder, the EM backfills the real PR number on that entry at merge time.
7. The EM closes out the worktree as part of the same merge step, not later: `scripts/end-session.sh` run from inside the worktree (it merges the session's Claude auto-memory into the canonical project memory directory, then removes the worktree; Claude Code keys memory on the dasherized working directory, so a worktree session's memory is lost on removal without this merge), `git branch -D <branch>` (a squash merge leaves the branch non-ancestor, so `-D` is expected), the remote branch deleted, then `git -C <main dir> checkout main && git pull --ff-only` so the EM's local `main` does not drift behind `origin/main`, and the stream's registry row moved to Shipped (§11.1). When the merged PR tracks a file that was untracked in the main directory, the `git pull --ff-only` aborts rather than overwrite it, and the abort is easy to miss when tailing output; confirm the pull landed with `git -C <main dir> log -1` and, if it aborted, remove or stash the untracked file and pull again. A merge is not done until its worktree and branches are gone and local `main` is current. New streams always branch off freshly fetched `origin/main` (§11.3), never local `main`, so a missed update never silently bases a stream on stale code; keeping it current is hygiene, not correctness-critical.
8. **Feature close-out.** When the LAST stream of a feature merges (a feature is done when every stream in its spec's stream-state table has merged), the EM closes the feature in the same sitting: confirm the feature's stream-state table reflects the true merged state (correct it if it lags; never archive a stale table), `git mv features/<name>.md archive/features/<name>.md` while keeping `features/.gitkeep` in place, reset the `CLAUDE.md` "Currently building" line to `_none_`, flip the phase's row in `docs/PLAN.md` to shipped, tag the close (`git tag -a phase-<n>-complete -m "Phase <n>: <name>"`, tag pushed, so `git log phase-<n-1>-complete..phase-<n>-complete` answers what the phase contained permanently), and queue a `/maintain` sitting: its docs pass reconciles any doc the feature touched, and its signals pass consumes the queued signals the phase's engine generated, so an engine replacement never leaves a backlog behind (`MAINTENANCE.md` §8). When the feature carried a design handoff (a `features/<name>/` folder), verify that the archived copy under `archive/features/` is byte-identical to it, then remove the working copy in the same close-out, so a handoff never outlives its feature.

## 4. Definition of done

A PR is done when ALL of:

- All CI gates pass (`docs/engineering.md` §15), and the engine check is green on the true merged state (§3 step 4), not only on a possibly stale `mergeable` flag.
- The diagnosis card is present in the PR description (§5).
- New behavior has tests; the CI-sized gate subset still passes, and a change that touches selection or composition has run the full `npm run gate` locally.
- No scope creep: the PR changes only what its brief described.
- No principle violation: an EM reviewer would not flag anything in `docs/product.md` §4.
- No `// TODO` left behind without a tracked follow-up in the active feature spec or a new feature doc.
- Removing an exported symbol came with a repo-wide caller grep (`app/`, `engine/`, `scripts/`, `.github/`, the operational docs), listed in the PR body, because a lane's gates cannot see an out-of-lane caller.
- A change to a locked engine invariant (a favorite never placed twice, one gravy per plate, the protein floor) came with the fixture that would break it, shown failing before the change and passing after, and names the invariant in the PR body so the EM reviews it adversarially; a green existing suite is not evidence.
- For UI changes: the EM has run the full-flow crawl-and-compare pass (§3 step 3, `docs/engineering.md` §16) against the preview, covering every flow and every sheet and compared against the active feature's `features/<name>/` handoff (the live app when no feature is active), and linked its result in the PR; any deviation from the design is resolved or explicitly accepted in the diagnosis card. A CSS or shared-primitive change is verified across all tabs, not only the touched screen.
- For iOS-affecting CSS or layout changes: real-device (iPhone) verification before merge. The desktop crawl runs Chromium and WebKit but cannot reproduce a real-iOS-device-only rendering difference, so a green crawl is necessary but not sufficient; Rajat checks the change on his iPhone before it merges. A share-image change is verified through the real export on the device, not through CSS.
- All horizontal container padding goes through the gutter token (`--pt-gutter` in `app/web/src/index.css`): no raw per-container horizontal padding literals, and no `env(safe-area-inset-left|right)` inside a `padding` or `margin` shorthand. Horizontal padding is written as explicit `padding-left` and `padding-right` longhand with the token as the floor and the safe-area inset as a fallback. The stylelint gate blocks the shorthand form.
- A Convex schema change is additive, or the diagnosis card carries the plan for the rows that no longer validate (`docs/engineering.md` §3); a Convex signature change is deployable backend-first (`docs/engineering.md` §9).

## 5. Diagnosis card

Every PR description starts with a diagnosis card. Engineer PRs, maintenance PRs, EM-authored docs and chore PRs, all of them. The card forces right-size discipline (`docs/product.md` §4 Principle 1) to be auditable.

```
## Diagnosis

**Problem size:** one-off | small pattern | structural
**Trigger:** (PR brief link, manual-change ID, dislike ID, incident ID, or rule citation)
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

The card keeps all six levels everywhere. Inside `/maintain`, a cluster whose honest level is a rule edit or engine code resolves to an evolution request in `data/engine-requests.md` (`MAINTENANCE.md` §1 and §5), with the conservative data-level action taken meanwhile; the card names both levels as considered and says so.

For trivial changes (a typo fix, a dep bump) the card is one line: `**Problem size:** trivial; no diagnosis needed.` The EM uses judgment on what counts as trivial.

For PRs that propose no behavior change after diagnosis ("the comment looks like a one-week aberration"), the card states this explicitly and the PR exists only to mark the queued items `reviewed_no_change` with the reason.

## 6. Maintenance trigger

Maintenance runs only when Rajat invokes it. Convention is Sunday around 11am IST, but the cadence is not enforced; a sitting that is skipped is caught up by the next one, because every pass reads its own deferred list before its window. A feature close-out (§3 step 8) queues a sitting explicitly.

**To run a sitting:**

1. Rajat opens a Claude Code session in the main repo directory.
2. Types `/maintain`. The skill lives at `.claude/skills/maintain/`: an orchestrator, one brief per pass, and two templates. A pass name runs that pass alone; `resume` continues a sitting from `.maintenance-state`, the committed manifest that carries each pass's marker, status, and deferred list; `since:` overrides the window; `dry-run` reads fixtures instead of production.
3. The EM creates one maintenance worktree off freshly fetched `origin/main` and runs five passes in a fixed order. **Signals** reads the queued signal channels from production, read-only through the listing queries (`manualChanges`, `dishDislikes`, open `incidents`; `docs/engineering.md` §5), plus the household record, the dish library, the ingredient catalog, and `docs/engine.md`; it clusters the rows into themes and applies right-size discipline through a four-level ladder: a data row, an existing tag value applied to more dishes, a defect fix proved by a failing test that names the clause of `docs/engine.md` it violates, or an evolution request. "No change warranted" sits below all four. **Health** runs the three reports from `npm run reports` (coverage, HP-versus-protein consistency, special sourcing) and reads the gate's pool-health lines; every 28 days it also runs the monthly engine monitor over a production record export. It writes a table and proposals and changes nothing. **Docs** rewrites the canonical and operational documents in place against the CHANGELOG's `Updated:` lines, a standing-checks list, and its deferred list. **Retro** triages every open `RETRO.md` entry into brief lines, CI or tooling fixes, `chore/*` requests, or items for Rajat. **Hygiene** checks the tree, the branches, the worktrees, and the dev deployment; it deletes remote branches whose PR merged and lists anything else destructive for Rajat. Signals, health, and docs run as subagents; retro and hygiene run inline in the EM session.
4. The sitting ends with at most two PRs, each carrying a diagnosis card per cluster or proposal. `slow-loop/<date>` holds the signals pass's file diffs across `data/dishes/` and `data/ingredients.md` (and, for a proved defect, `engine/src/` with its test), the appended `data/changelog.md` entries, the health pass's monitor table, and any evolution request appended to `data/engine-requests.md`; it is the PR that carries judgment, so Rajat reads it. `docs/maintenance-<date>` holds docs, retro, and hygiene as three commit groups and is mechanical catch-up.
5. Rajat reviews on GitHub. Merge applies. On merge of the `slow-loop/*` PR a GitHub Action posts back to Convex to mark the consumed `manualChanges` rows `applied` or `reviewed_no_change`, mark the consumed `dishDislikes` rows `applied`, resolve the consumed incidents, and link the PR.

Maintenance never edits a rule, adds a tag value or frontmatter key, or changes engine behaviour: those belong to `/evolve-engine` (`EVOLVING-THE-ENGINE.md`), reached through the evolution-request ledger. Full spec, including the boundary between the two and the state file: `MAINTENANCE.md`.

**Feeding the retro pass.** At session close the EM appends a `RETRO.md` entry for each systemic or recurring friction it hit (the format and the "what to log" test live in the file's header). One-off slips are not logged. The retro pass sizes each entry and lands the fix on the right path (`MAINTENANCE.md` §4.4).

## 7. Escalation rules

The EM decides on its own:

- Stream sequencing and engineer brief shape.
- Which PRs are ready to merge (the merge itself waits for Rajat's yes).
- File and folder organization changes within the agreed layout.
- Test-only changes, dep bumps, lint fixes.
- Most maintenance reasoning (the card makes the reasoning auditable).

The EM surfaces to Rajat before acting:

- Merging to `main`, every `--prod` Convex command (generation, an export, a data repair), and any push to a shared branch. Each is approved per action; the harness enforces this.
- Visibly destructive operations (force-push, history rewrite, dropping a Convex table, deleting a branch whose PR did not merge, `rm -rf` of anything tracked).
- Cross-stream product behavior changes (for example, changing what the menu image looks like).
- Cost or hosting changes (Convex paid tier, switching frontend host, buying a domain).
- Adding a tool, service, or library not named in `docs/engineering.md` §1.
- Any structural change to canonical data (the `data/dishes/` library, the `data/ingredients.md` catalog, `docs/engine.md`) initiated by the EM rather than by a `/maintain` sitting, an `/evolve-engine` run, or a reviewed content batch.
- Genuine judgment ties where the EM has weighed both sides.

EM-without-Rajat decisions go into `DECISIONS.md`. Rajat scans periodically and can override anything by replying in chat or editing the doc.

## 8. Commit conventions

- One concern per commit. Resist piling unrelated fixes into one commit.
- Imperative present tense in the subject. "Add round-trip test for ingredients", not "Added" or "Adding".
- Subject at most 70 characters; wrap the body at 72.
- Body is optional for tiny commits; required for anything non-obvious, and it explains the why.
- No "WIP" commits on `main`; a PR squash-merges.
- No co-author trailers unless Rajat asks.
- No em dashes in a subject, a body, or a PR description.

## 9. Anti-patterns

The EM rejects PRs that exhibit any of:

- Sycophantic agreement to a single signal without applying right-size discipline (one swap with the reason "too spicy" becomes a `low_spice` tag, without asking whether one row justifies a rule).
- Generalizing from one or two cases ("we could add a column to handle this and three other hypothetical cases").
- Adding an abstraction or helper before two existing call sites need it.
- Touching `docs/engine.md` without a matching engine code and test change.
- Touching canonical dish data (the `data/dishes/` library, the `data/ingredients.md` catalog) outside the legitimate paths. Changes to existing values go through the signals pass of `/maintain`; rule and engine changes go through `/evolve-engine`; content batches (descriptions, recipes, cook fields, photos, new dishes) go through reviewed content-batch PRs on `data/enrichment-*`, `data/photos-*`, or `data/expansion-*` branches, each reviewed by Rajat personally. Any other path is the anti-pattern.
- Past-tense narrative in canonical docs ("we used to do X but now do Y").
- "Refactor while I'm here" scope creep.
- New libraries or platform services not in `docs/engineering.md` §1.
- TODO comments without a tracked follow-up.
- Mocking the database in tests that should hit the dev Convex deployment.
- An engineer editing `docs/CHANGELOG.md`, `DECISIONS.md`, or a feature stream-table (§11.4).
- A frontend slice merged on a green CI run alone, without the crawl (§3 step 3).

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

This repo routinely runs several worktree sessions at once and lands several PRs a day on the same hotspots (picker components, `data/dishes/`, the CHANGELOG, `DECISIONS.md`, feature stream-tables). §2 isolates each session physically; this section keeps their _merges_ clean by pre-planning who owns which files.

### 11.1 The live-session registry

`coordination/active-streams.md` is the single source of truth for what is in flight. It is local and gitignored: it lives only in the main repo directory, the EM edits it by hand, and it never travels onto a branch, so it can never itself become a merge conflict. Worktree sessions read it (the brief carries its absolute path); they do not edit it.

The EM maintains it:

- **Before spawning a stream:** scan the registry. Choose file lanes no live stream owns. If the new stream must share a lane, do not run it in parallel; either narrow the lane or sequence it and record the merge order in the Hotspot ledger. When two streams' briefs would both name the same exported symbol or predicate, the Hotspot ledger row names one owner, and the other stream takes it as a parameter or an import, never a second definition.
- **On spawn:** add a Live streams row naming the branch, the worktree path, the PR target, the exact owned paths, any hotspot touch, the date, and the status.
- **On merge:** move the row to Shipped and clear any Hotspot ledger rows it closed.

The `/new-stream` command writes the registry row as part of spawning. A worktree that has no Live row is a hygiene finding (`MAINTENANCE.md` §4.5).

### 11.2 Lane discipline

A stream stays inside its declared file lanes. Crossing into another stream's lane is the parallel-work equivalent of scope creep: it is the thing that turns two clean branches into a conflict. If a stream discovers it genuinely needs a file another stream owns, it raises an `EM check needed` note (§10) rather than editing across the lane line; the EM decides whether to widen the lane, resequence, or hand the file off.

Name lanes at real-path granularity so near-neighbours still parallelise: `app/web/src/components/Explore*` and `app/web/src/components/DayScreen*` are different lanes even though both are "the frontend".

### 11.3 Merge ownership: the later-merging session owns the rebase

Branches start from `origin/main`, not a stale local `main` (`/new-stream` fetches first). When two branches converge:

1. Push your branch, early and often on a long-running stream, so a dead session leaves an intact remote branch to resume from. Never carry a large uncommitted working tree across a rebase; commit first, then rebase.
2. Before merging, `git fetch && git rebase origin/main` inside your worktree.
3. Resolve conflicts in the worktree.
4. `git push --force-with-lease` your own branch. **Never force-push `main` or a branch another session is on.**
5. Re-run the full gate set on the rebased state, `format:check` included: a rebase can turn a clean branch red without touching one of your lines when the base changed a lint or format config. Then merge to `main`.

If session A merges first, session B owns the entire rebase. This is ordinary git etiquette; it is codified because parallel sessions make it routine, and because branch protection will not catch a stale branch that still shows mergeable (re-confirm `mergeable` and a green engine check immediately before every merge).

### 11.4 Hotspot protocol

Some files cannot be lane-partitioned because every stream touches them. Each gets a planned merge order in the registry's Hotspot ledger.

- **`docs/CHANGELOG.md`, `DECISIONS.md`, and feature stream-tables** are EM-owned. Engineers do not edit them; they describe what shipped in the PR body and the EM writes the entry. The EM batches CHANGELOG and DECISIONS entries into its own PRs (an EM-authored PR carries its entries; an engineer's entries land in the EM's next docs PR). Append-only; never rewrite an existing entry.
- **Tree-wide data migrations** (a change that rewrites every file under `data/dishes/`, for example adding a field to every dish) merge _last_ among the streams that touch that tree, so the migrating stream rebases once onto the others' content rows rather than forcing every content stream to fight a tree-wide rewrite.
- **Shared UI primitives** (`app/web/src/components/primitives.tsx`, the picker styles, `app/web/src/index.css`): keep edits inside your own component. Touch the shared primitive only if unavoidable, and add a Hotspot ledger row when you do. A shared-primitive change is whole-app blast radius and gets the full crawl (§3).
- **Canonical docs** (`docs/product.md`, `docs/engine.md`, `docs/engineering.md`, this file) are reconciled by the docs pass of `/maintain` (`MAINTENANCE.md` §4.3) or by an EM `docs/*` PR, not edited in shipping sessions. The one exception is an append-only addition that would otherwise force a renumber of sections other docs cross-reference; append, do not insert. Section numbers are pointers: every `<file>.md §<n>` reference across the repo must keep resolving after an edit.

### 11.5 Staging hygiene

Never `git add -A` or `git add .`. Stage by filename or directory. Worktrees already make cross-session contamination impossible, but staging unrelated changes within your own worktree still produces noisy, hard-to-review commits. One concern per commit (§8). Scratchpad filenames are prefixed with the stream letter, because the session scratchpad directory is shared across sibling streams.

## 12. Glossary

- **Worktree.** A git feature: multiple working directories sharing one repository, each on a different branch. Lets the EM spawn engineers in parallel without their changes overlapping until merge.
- **Pre-commit hook.** A script in `.git/hooks/` that runs before every commit and can refuse the commit. Used here to keep code-path commits out of the main coordination directory (§2).
- **Dev Convex deployment.** The second Convex deployment (`lovely-curlew-631`), with its own empty database, that local development, branch smoke tests, and the UI crawl run against. Production is `disciplined-chameleon-263`.
- **Vercel preview deployment.** A per-PR build of the frontend at a unique URL, behind Vercel's deployment protection.
- **Squash merge.** Combining all of a PR's commits into one before landing on `main`. Keeps `main` history clean and each PR revertable as a unit.
- **CI gate.** A check defined in `.github/workflows/ci.yml` that runs on every PR. Failing any gate blocks merge.
- **Live-session registry.** A local, gitignored coordination file (`coordination/active-streams.md`) the EM maintains, listing every in-flight stream and the file lanes it owns. Read before spawning any stream so two sessions never collide on the same files. See §11.
- **File lane.** The concrete set of paths a stream owns for the life of its branch (real paths like `engine/src/nutrition.ts` or `app/web/src/components/Explore*`, not whole areas). Two streams with disjoint lanes can run in parallel safely.
- **Hotspot.** A file more than one live stream will touch (the CHANGELOG, `DECISIONS.md`, a feature stream-table, a tree-wide data migration, a shared UI primitive). Hotspots get a planned merge order in the registry's Hotspot ledger rather than colliding by accident.
- **Subagent.** A short-lived child Claude session spawned inside a running session with a narrow brief and its own context window. Several run concurrently without sharing state, which makes them the in-session analogue of giving each stream its own worktree. A subagent watchdog ends one after about ten minutes with no output, so long commands stream their progress.
- **Diagnosis card.** The block at the top of every PR description that sizes the problem and names the fix level (§5).
- **Residual check.** A verification item CI and the crawl could not close (a real-device check, an after-deploy behaviour) that the diagnosis card carries with the PR instead of leaving in chat.
