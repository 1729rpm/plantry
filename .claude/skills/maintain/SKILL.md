---
name: maintain
description: Run a maintenance sitting for Plantry. Five passes (signals, health, docs, retro, hygiene) that keep the data, the docs, the ledgers, and the repository true, in one sitting with at most two PRs. EM-only.
argument-hint: "[signals|health|docs|retro|hygiene|all|resume] [since:YYYY-MM-DD] [dry-run] [--fixture <path>]"
disable-model-invocation: true
---

You are the EM running a maintenance sitting for Plantry. The full spec lives in `MAINTENANCE.md`.
Re-read it now, along with `CLAUDE.md`, `docs/product.md` §4 (the principles), `docs/development.md`
§5 (the diagnosis card) and §11 (parallel-session coordination), and `MAINTENANCE.md` §1 (the
boundary between this skill and `/evolve-engine`, so you can tell a maintenance-sized problem from
an evolution-sized one).

This skill is the second of Plantry's two slow workflows. `/evolve-engine` changes how the engine
decides; `/maintain` keeps everything the engine and the repo depend on true. You orchestrate. The
first three passes are run by fresh agents with exact reading lists; you run the last two yourself.

## Arguments

Arguments arrive as one string. Parse it yourself; tokens may appear in any order.

- **A pass name** (`signals`, `health`, `docs`, `retro`, `hygiene`): run that pass alone and no
  other. The sitting steps below still apply to it (worktree, artifact, commit, marker).
- **`all`, or no argument at all**: run the full sitting, all five passes in the fixed order.
- **`resume`**: read `.maintenance-state` and continue from the first pass whose status is not
  `done`. Takes its worktree and branch from the state file's header. Never resume from memory: if
  the state file and your recollection disagree, the state file is right.
- **`since:YYYY-MM-DD`**: override the input window for every pass that takes a date window
  (`signals`, `docs`). Default: each pass's own `last-run` value in `.maintenance-state`. The retro
  pass ignores this argument for its main window, which is by status, not by date
  (`MAINTENANCE.md` §4.4).
- **`dry-run`**: produce every pass's artifact and report in the session, but write no repository
  file, open no PR, and move no marker.
- **`--fixture <path>`**: signals only. Read the three queued tables from JSON files at that path
  instead of production Convex. `data/test-fixtures/slow-loop` is the standing fixture directory.
  Ignored by every other pass.

Anything else in the argument string is a stop: say what you did not understand and ask, rather than
guessing which pass was meant.

## Standing rules for the whole sitting

- **Spawn `signals`, `health`, and `docs` as subagents**, one per pass, on the highest-intelligence
  model the harness offers at the highest reasoning effort available. Run `retro` and `hygiene`
  inline in this session: `RETRO.md` is the EM's ledger of its own friction and hygiene is five
  minutes of mechanical checks over the finished tree.
- **Inject the brief, with the placeholders filled.** Do not tell an agent to "read the pass brief".
  Copy `passes/<pass>.md` into the prompt with `{{DATE}}`, `{{WORKTREE}}`, `{{WINDOW_FROM}}`,
  `{{CONTENDED}}`, `{{DEFERRED}}` (and `{{FIXTURE}}` for signals) replaced by this sitting's real
  values, and give the agent the exact absolute paths its reading list names.
- **Fill `{{CONTENDED}}` from `coordination/active-streams.md`** before every spawn. A file a live
  stream owns is skipped and recorded in the pass's artifact, never edited (`docs/development.md`
  §11.2). An empty contended list is written as `none`, never left blank.
- **Fill `{{DEFERRED}}` from the state file's Deferred section**, filtered to that pass. Every pass
  reads its deferred items before its date window.
- **Every pass writes its artifact before it reports.** Say so in every prompt. The report back to
  you is a summary; the artifact is the deliverable. Artifacts go to
  `features/maintenance-<date>/<pass>.md`, the sitting's working folder, which travels with both PRs
  and moves to `archive/maintenance/<date>/` at close-out so `features/` is empty between features.
- **Read the artifact before you move the marker.** Check it carries the required sections its brief
  names. A missing section is a re-run, not a note.
- **Commit after every pass, push before the next starts.** Commit message:
  `maintain/<date>: <pass> pass complete`. Never `git add -A`; stage by path. A dead session then
  loses at most one pass.
- **A pass may not report `done` with an unrecorded deferral.** Anything it saw and did not fix goes
  into the Deferred section of `.maintenance-state` under that pass's name, with one line of context.
- **Never write to production.** The only production access in a whole sitting is read-only: the
  signals pass reading the three queued tables, and the health pass exporting the record when a
  monitor is due. Both need Rajat's per-action approval at the harness prompt; that prompt is a
  click, not a decision, so do not stop to ask him for anything else. The write-back on merge is done
  by the `slow-loop-applied` GitHub Action (`MAINTENANCE.md` §3).
- **Do not summarise one pass's findings into the next pass's prompt.** The next pass reads the
  artifact, or it does not read it at all.
- **No em dashes** in anything the sitting writes: artifacts, doc rewrites, commit messages, PR
  bodies. Commas, parentheses, semicolons, sentence breaks.

## The sitting

Order is fixed: `signals`, `health`, `docs`, `retro`, `hygiene`. An empty pass writes one line and
moves its marker. An empty sitting is a healthy outcome, not a failure.

### Step 0. Set up

1. Confirm the main repo working tree is clean and no other maintenance sitting is in flight (no
   `.maintenance-state` row left `running` on a branch that is not merged).
2. Read `coordination/active-streams.md`. Note every live stream and the file lanes it owns; that
   list is this sitting's `{{CONTENDED}}` value. If a live stream owns a file a pass would rewrite,
   the pass skips and records it.
3. `git fetch origin`, then
   `git worktree add ../plantry-maintain-<date> -b slow-loop/<date> origin/main`. Work from the
   worktree; the main directory cannot commit. Create `features/maintenance-<date>/` for this
   sitting's artifacts.
4. Read `.maintenance-state`. Set each pass's window from its `last-run` value, or from
   `since:<date>` when passed. Set every pass you are about to run to `running` with today's date,
   commit, and push. From here the state file is the sitting's only state.
5. Add a row to `coordination/active-streams.md` naming the sitting's lanes.

### Step 1. `signals`

Spawn the pass from `passes/signals.md`. It works on the `slow-loop/<date>` branch. When it reports,
read `features/maintenance-<date>/signals.md`, check its sections, commit its file edits, update the
state row, push.

### Step 2. `health`

Spawn the pass from `passes/health.md`, on the same branch. It writes nothing under `data/`,
`docs/engine.md`, or `engine/`; its output is a table, a set of proposals, and possibly an entry in
`data/engine-requests.md`.

### Step 3. The first PR

Open the `slow-loop/<date>` PR: the signals pass's data edits and `data/changelog.md` rationale, the
health pass's monitor table and proposals. This is the PR that carries judgment, so Rajat reads it.

- Title: `slow-loop/<date>: <one-line summary of themes>`, under 70 characters.
- Body: the diagnosis card per cluster (`docs/development.md` §5), the cluster list, the health
  table, `## File changes`, `## Out of scope`, and the mark-applied contract sections the signals
  brief specifies verbatim (`MAINTENANCE.md` §3.1). The branch prefix and that body contract are
  matched and parsed by `.github/workflows/slow-loop-applied.yml`; neither may drift.

Then move the worktree to the docs branch: `git checkout -b docs/maintenance-<date>` off the same
freshly fetched `origin/main`, so the docs PR does not depend on the first one merging.

### Step 4. `docs`

Spawn the pass from `passes/docs.md`. Two lanes, one PR, one commit per document, lane A (the four
canonical docs) committing before lane B (the root operational docs, the skill briefs, and
`app/web/e2e/`).

### Step 5. `retro`

Run inline, from `passes/retro.md`. Its window is by status, not by date. Its brief-line, CI, and
tooling fixes land as the docs PR's third commit group; anything stream-sized becomes a `chore/*`
request via `/new-stream`; anything needing Rajat is surfaced in the PR body, never actioned.

### Step 6. `hygiene`

Run inline, from `passes/hygiene.md`. Its report is the docs PR's fourth commit group. Safe cases
are done; anything destructive beyond deleting a branch whose PR merged is listed for Rajat.

### Step 7. The second PR

Open the `docs/maintenance-<date>` PR: docs, retro, and hygiene as commit groups. It is mechanical
catch-up, and the spec says so, so Rajat can merge it on your word.

- Title: `docs/maintenance/<date>: <one-line summary>`, under 70 characters.
- Body: the diagnosis card, the CHANGELOG entries processed, the documents touched and what moved in
  each, the retro table (entry, status change, where the fix landed), the hygiene report,
  `## Out of scope`, and anything flagged for Rajat.

### Step 8. Close the sitting

Set every run pass to `done` with today's date and its deferral count, confirm the Deferred section
names every deferred item with its owning pass, `git mv features/maintenance-<date>
archive/maintenance/<date>` while keeping `features/.gitkeep` in place, commit, push. Move the
registry row to Shipped, and on merge remove the worktree and delete the branches
(`docs/development.md` §3 step 7).

## Resume

`/maintain resume` reads `.maintenance-state` and restarts from the first pass whose status is not
`done`. A pass left `running` by a dead session is treated as not done and re-run from scratch:
every brief has a fixed reading list, so a re-run reproduces the artifact. Overwrite a partial
artifact; never repair one.

There is no self-scheduled wakeup here, deliberately. A maintenance sitting is hours, not days, so a
sitting that dies is resumed at the next one rather than waiting on a timer. That is the one
`/evolve-engine` mechanism not imported.

## Branch naming for this skill

- `slow-loop/<date>` for the signals and health PR. The name is load-bearing:
  `.github/workflows/slow-loop-applied.yml` triggers on `startsWith(head.ref, 'slow-loop/')`.
- `docs/maintenance-<date>` for the docs, retro, and hygiene PR (`docs/development.md` §2).
- `chore/<short>` for a stream-sized retro fix, spawned through `/new-stream`.

## What to refuse

- **A rule edit, a new tag value, a new frontmatter key, or an engine behaviour change, in any
  pass.** Those are `/evolve-engine`'s (`MAINTENANCE.md` §1). File an evolution request instead
  (§5) and take the conservative data-level action meanwhile. There is no escape hatch inside
  maintenance for a cheap, obviously right rule edit: if Rajat wants a rule shipped without a full
  evolution, the path is the fast loop, a `/new-stream` feature PR with the full gate green.
- **An engine code edit without a failing test that names the clause of `docs/engine.md` it
  violates.** With that test it is a defect fix and it belongs here. Without it, it is a rule edit.
- **Acting on a single instance of any signal.** One skip is not a calendar override; one delete is
  not an over-generation finding; one dislike is not a deactivation.
- **Writing anything to production**, including a "harmless" test generation.
- **Rewriting an append-only ledger** (`DECISIONS.md`, `RETRO.md`, `docs/CHANGELOG.md`,
  `data/changelog.md`). The retro pass edits `Status:` lines in place and nothing else.
- **Editing a file a live stream owns.** Skip it and record it.
- **Doing a pass's work yourself** because it would be quicker, or summarising one pass's artifact
  into the next pass's prompt instead of handing over the file.
- **Reporting a pass `done` with an unrecorded deferral.**
- **Running this at all when the engine's shape is wrong.** That is `/evolve-engine`. This skill is
  for the data, the docs, the ledgers, and the repository around it.

## Why this skill exists

Three things rot on their own: the library the engine draws from, the documents that say what the
system does, and the repository the work happens in. Each has a different input (queued household
signals, the CHANGELOG, the EM's own friction ledger, the tree itself), and each was previously
either a separate command with its own marker or a job nobody owned. Splitting them produced a
flag-and-defer loop where each pass deferred an item to the next and none closed it, and left the
jobs with no brief to be done on instinct or not at all. One sitting, five briefed passes, one
manifest with a deferred list, and a hard boundary against touching the engine is what closes that
loop. The boundary matters most: an unmeasured rule edit is exactly the failure the v4 and v4.1
engines were, so the only thing this skill sends toward the engine is a written request with the
measurement attached.
