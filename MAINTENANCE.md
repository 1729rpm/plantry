# Plantry maintenance

Spec for the process that keeps everything the engine and the repo depend on true. It is invoked as
`/maintain`, it runs as one sitting of five passes, and it ends with at most two pull requests. This
document owns the process; the passes' briefs live under `.claude/skills/maintain/`.

Every sitting runs from a Claude Code session Rajat invokes. Nothing here is on a cron. The session
is the trigger; the output is always a pull request; the merge is the approval.

## 1. Purpose and the boundary

Plantry keeps exactly two slow workflows, each a skill with its own operational document.

- **`/evolve-engine`** (`EVOLVING-THE-ENGINE.md`) re-derives the engine from the household record.
  It changes how the engine decides.
- **`/maintain`** (this document) keeps everything the engine and the repo depend on true. It
  changes what the engine reads and what the docs say.

The line between them is stated here, once, and cross-referenced from both documents.

| Maintenance owns                                                                                                                                           | Evolution owns                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Values of existing fields in `data/dishes/*.md` (`active`, `seasons`, `category`, existing `tags` values, `complexity`) and the promotion of custom dishes | Any new field, any new tag value, any change to `engine/src/data/schemas.ts`        |
| Rows in `data/ingredients.md`                                                                                                                              | The pools, the chooser, the ledgers, the scheduling arithmetic, the household model |
| `docs/engine.md` and `engine/src/` only where they disagree with each other (a defect, proved by a failing test)                                           | `docs/engine.md` and `engine/src/` where they agree and the behaviour is wrong      |
| Gate reporting: recording a known failure, printing a number, the monthly monitor                                                                          | Gate thresholds: any band, bar, or exemption                                        |
| The four canonical docs, the root operational docs, the skill briefs, CI, tooling, the ledgers' status lines, the repository layout                        | The "deliberately absent" list in the engine spec                                   |

Three consequences are load-bearing.

- **A new tag value is evolution, not a maintenance level.** Tags are a closed enum, a fixed list of
  allowed values the schema validates against, so a new value is a schema change plus a rule that
  reads it, which is engine shape. Applying an existing value to more dishes is data.
- **A defect is not evolution.** When a test proves the code does not do what `docs/engine.md` says,
  maintenance fixes the code, with the failing-then-passing test in the PR and `npm run gate`
  re-run. Without such a test the change is a rule edit and is refused.
- **There is no escape hatch inside maintenance for a cheap, obviously right rule edit.** An
  unmeasured rule edit is exactly the failure the v4 and v4.1 engines were. If Rajat wants a rule
  shipped without a full evolution, the path is the fast loop: a `/new-stream` feature PR with the
  full gate green, which already exists and needs no exception here. Maintenance files the evolution
  request either way (§5), so the ledger shows what was asked and what shipped.

The one-line test for an ambiguous case: **can the change be justified from the current record
alone, at one file, reversibly?** If yes it is maintenance. If knowing whether it is right needs a
20-to-60-week simulation, it is evolution. A misfiring rule is an evolution request; a misbehaving
implementation of a stated rule is maintenance.

## 2. The sitting at a glance

| #   | Pass      | Reads                                                                                                                  | Writes                                                                                                | Runs as    |
| --- | --------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------- |
| 1   | `signals` | queued `manualChanges`, `dishDislikes`, open `incidents`; the library; `data/changelog.md`                             | data-row edits; `data/changelog.md`; diagnosis cards; evolution requests                              | subagent   |
| 2   | `health`  | `npm run reports`; the gate's pool-health lines; the monitor when due (a production record export)                     | the monitor table; proactive proposals; content priorities for `ADDING-DISHES.md`; evolution requests | subagent   |
| 3   | `docs`    | `docs/CHANGELOG.md` since the marker; the deferred list; the canonical docs, the ops layer, the briefs, `app/web/e2e/` | in-place rewrites, one commit per document                                                            | subagent   |
| 4   | `retro`   | every `RETRO.md` entry not closed, whatever its date, plus entries since the marker                                    | `Status:` lines in place; brief lines; CI and tooling fixes; items for Rajat                          | EM, inline |
| 5   | `hygiene` | the root inventory, `git branch -r`, `git worktree list`, the dev deployment's tables, `CLAUDE.md`'s status line       | a report; deletion of branches whose PR merged; a list for Rajat of anything destructive              | EM, inline |

Order is fixed: `signals`, `health`, `docs`, `retro`, `hygiene`. Signals and health run first because
they are the passes that can change `data/` and, for a defect, the engine, and the docs pass
reconciles against the result. Docs runs before retro because retro's fixes are brief-and-CI shaped
and several open entries are blocked on a docs edit. Hygiene runs last, as a check over the finished
tree. An empty pass writes one line and moves its marker; an empty sitting is healthy.

**The sitting.** One maintenance worktree off freshly fetched `origin/main`,
`../plantry-maintain-<date>`, because the main directory cannot commit. The signals and health
passes work on branch `slow-loop/<date>`; once that PR is open the worktree moves to
`docs/maintenance-<date>` for the remaining three. Each pass writes its artifact to
`features/maintenance-<date>/<pass>.md` before it reports, and the EM reads the artifact before it
moves the marker. Commit after every pass, push before the next starts, so a dead session loses at
most one pass. At close-out the sitting's folder moves to `archive/maintenance/<date>/`.

**Two PRs at most.** `slow-loop/<date>` carries the data edits and the health table, and it is the
PR that carries judgment: Rajat reads it. `docs/maintenance-<date>` carries docs, retro, and hygiene
as three commit groups; it is mechanical catch-up, and Rajat can merge it on the EM's word.

**Subagents for the first three passes**, spawned by the EM with the brief's placeholders filled:
the date window, the contended-file list from `coordination/active-streams.md` (a file another live
stream owns is skipped and recorded, not edited), and the pass's deferred list. Retro and hygiene run
in the EM session, because `RETRO.md` is the EM's own ledger and hygiene is five minutes of
mechanical checks.

**No production writes.** The only production access is the signals pass's read of the three queued
tables and the health pass's record export. The `slow-loop-applied` action does the write-back on
merge (§3).

## 3. Slow-loop mark-applied action

A GitHub Action at `.github/workflows/slow-loop-applied.yml` closes the feedback cycle: when a
`slow-loop/*` PR merges into `main`, the action calls internal Convex mutations to mark the consumed
`manualChanges` rows `applied` or `reviewed_no_change`, the consumed `dishDislikes` rows applied, and
the consumed `incidents` rows resolved. Without it, the next signals pass would reread the same
queued signal and reprocess it.

### 3.1 PR body contract

The signals pass produces a PR body with two sources of truth for the action:

1. A `## Consumed signals by cluster` section with one fenced ` ```cluster ` block per cluster. Each
   block has these keys: `outcome:` (either `applied` or `reviewed_no_change`, derived from that
   cluster's diagnosis card "Chosen level"), `manual_change_ids:` (comma-separated `manualChanges`
   row ids consumed by this cluster, or `-` if none), `incident_ids:` (comma-separated, or `-`), and
   `dislike_ids:` (comma-separated `dishDislikes` row ids, or `-`). The action parses this section
   to map each id to the correct outcome. The `manual_change_ids` and `dislike_ids` keys are
   optional in a block; an older PR body that omits them still parses. Dislike ids are
   outcome-independent: a consumed dislike is resolved regardless of the cluster's manual-change
   outcome, so the action collects them from every block without outcome gating.
2. Flat `Consumed manual-change IDs:`, `Consumed incident IDs:`, and `Consumed dislike IDs:` lines
   for human readability and as a fallback. If the per-cluster section is absent, the action treats
   every listed manual-change id as `applied` (conservative default for a PR that touched files).

### 3.2 Convex mutations called

Four `internalMutation` functions (not exposed to the browser), split across
`app/convex/manualChangesMutations.ts`, `app/convex/incidentsMutations.ts`, and
`app/convex/dishDislikesMutations.ts`:

- `incidentsMutations:markIncidentsResolved({ incidentIds, resolvedPr })` sets `resolvedAt: now` on
  each incident row.
- `manualChangesMutations:markManualChangesApplied({ manualChangeIds, resolvedPr })` sets each
  `manualChanges` row `status: "applied"`, `resolvedAt: now`, `resolvedPr: <PR URL>`.
- `manualChangesMutations:markManualChangesReviewedNoChange({ manualChangeIds, resolvedPr })` same
  shape, status `reviewed_no_change`.
- `dishDislikesMutations:markDislikesApplied({ dislikeIds, resolvedPr })` sets each `dishDislikes`
  row `status: "applied"`, `resolvedAt: now`, `resolvedPr: <PR URL>`, and `consumedWeekStart` to the
  Monday of the consuming week. The mark-applied script calls it for every `dislike_ids` value it
  collects, so a consumed dislike leaves the queue and the next signals pass reads only new taps.

Each mutation handles missing or already-resolved ids by inserting a `warn`-severity `incidents` row
noting which id was skipped, then continuing. The mutations never throw; the post-merge step is
best-effort and must not block a merge.

### 3.3 Debugging a failed run

If the action runs but the next signals pass still sees stale `queued` rows, follow these steps in
order:

1. Open the Actions tab on GitHub, find the `Slow-loop mark applied` run for the merged PR, and read
   the log lines prefixed `[slow-loop-mark-applied]`. They report how many cluster blocks parsed and
   the applied, reviewed_no_change, incident, and dislike counts, plus any Convex CLI exit codes.
2. If the parse counts read zero clusters and zero flat ids, the PR body did not include either
   section; check the signals brief at `.claude/skills/maintain/passes/signals.md` if the output
   drifted, or hand-correct the rows via
   `npx convex run --prod manualChangesMutations:markManualChangesApplied '{ "manualChangeIds": ["..."], "resolvedPr": "..." }'`.
3. If the Convex CLI returned non-zero, check the production deployment
   (`disciplined-chameleon-263`) for incident rows written by the mutations themselves; they record
   which ids were skipped and why.
4. The action skips entirely when `pull_request.merged` is false or the head ref is not
   `slow-loop/*`; that is by design and not a failure. The `slow-loop/<date>` branch prefix is
   therefore load-bearing and does not change.

## 4. The passes

Each pass's brief carries its mandate, its exact reading list, its forbidden inputs, its artifact and
that artifact's required sections, its refusal list, and its report format. The briefs are the
operative text; this section is the spec they implement.

### 4.1 `signals`

**Why.** Household feedback accumulates in Convex during the week as three signal channels: queued
`manualChanges` rows (observed behaviour, one row per swap, custom dish, delete, add, day skip, or
day restore, each with the user's stated reason), queued `dishDislikes` rows (a records-only tap on a
dish in Explore), and runtime `incidents` from the auto-recovery middleware. None of these can be
applied directly: each cluster needs right-size diagnosis before becoming a structural change. This
pass is the only path by which `data/dishes/<slug>.md`, `data/ingredients.md`, and
`data/changelog.md` change, and the only path by which a queued signal is consumed.

**Inputs.** The three queued tables, read-only from production or from a fixture directory
(`data/test-fixtures/slow-loop/`, whose absent files read as zero rows of that signal, so an older
fixture still dry-runs cleanly). Context: the dish library, the ingredient catalog,
`data/changelog.md`, `docs/engine.md`, `engine/src/`, and the household record, the `currentWeek`
rows of the served weeks, which is the distribution the engine reproduces (`docs/engine.md` §2.1).
`weekArchive` and `data/menu_history.md` are provenance: nothing reads either, and neither is a
signal.

**What it does.** Clusters the rows by theme, writes one diagnosis card per cluster
(`docs/development.md` §5), and applies a four-level fix ladder: a data row; an existing tag value
applied to more dishes; a defect fix proved by a failing test that names the clause of
`docs/engine.md` it violates; an evolution request (§5). "No change warranted" sits below all four
and is a valid, written outcome. The signal patterns and their thresholds (skips, deletes, adds,
dislikes, custom dishes, incidents) and the right-size examples live in the brief.

**Output.** Data-row edits, an appended rationale in `data/changelog.md`, any evolution requests, and
the PR body sections §3.1 specifies, on branch `slow-loop/<date>`.

**Refuses.** Any rule wording change; any new frontmatter key, tag value, or catalog column; any
engine edit without a failing test that names the spec clause; acting on a single instance of any
signal.

**Anti-patterns.** Sycophantic agreement ("the swap reason said X so I added a flag for X" without
checking pattern size); generalizing from one or two cases; adding a column when a row fix or an
existing tag value would do; modifying `docs/engine.md` without paired engine code and test edits;
silent dismissal of a signal without a written diagnosis card.

### 4.2 `health`

**Why.** Validators keep facts true; this pass keeps the library good. The two are different jobs. A
Saturday treat pool too small to keep a treat main off the plate for eight Saturdays is not a broken
fact, so no validator flags it, but it is a real quality risk. This pass is also the mechanism that
decides when `/evolve-engine` is worth running, which is why it must not be able to touch the engine
itself: a pass that can both measure a drift and fix it will fix it, and the fix will be unmeasured.

**Inputs.** Every sitting: the three reports from `npm run reports` (`docs/engine.md` §12.1) and the
gate's pool-health lines, which are per-occasion and so live in `npm run gate` rather than in any
report over the library (`docs/engine.md` §16.3). When the monitor is due, also one production record
export (`npx convex run --prod recordExport:exportRecord '{}'`, a read, with Rajat's per-action
approval), `npm run gate` run against it, and the `manualChanges` swap rows covering the same weeks.

**What it does.** Reads the reports and the gate lines for thin pools, coverage gaps, tag drift, and
newly flagged specialty sourcing, and writes a proactive proposal with a diagnosis card for each.
When the last monitor is 28 or more days old it runs the monthly engine monitor: four measures over
the trailing eight served weeks, the production counterpart to the verification gate.

| Measure                                      | Read against                                             | What a drift means                                                                             |
| -------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Family rate per occasion, per tracked family | The same family's rate in the record baseline            | The engine is over- or under-serving a protein family the record does not ask for at that rate |
| Saturday treat pool size                     | The rolling no-repeat window the Saturday threshold sets | A pool at or below the window forces a repeat the household did not choose                     |
| Saturday swap-outs                           | The Saturday count in the same weeks                     | The treat register is proposing dishes the household does not want on a Saturday               |
| Exploration swap-away rate                   | The one exploration pick a week                          | The familiar-but-new score is reaching too far from what the household actually cooks          |

**Output.** The monitor table in the PR body, the proactive proposals, content priorities named for
`ADDING-DISHES.md`, and evolution requests. The table is reported, never gated: there is no threshold
here to fail, and a single month's wobble on a family the record places once a month is counting
noise (`docs/engine.md` §16.3, threshold 12, states the noise bound). A measure that has moved the
same way across two consecutive monitors is a structural finding and becomes an evolution request
with both tables as its evidence.

**Refuses.** Any edit under `data/`, `docs/engine.md`, or `engine/`; any threshold change; turning
one monitor's wobble into a finding; authoring a dish.

**Anti-patterns.** Reporting a measure without the row count it rests on; widening a threshold so a
measure reads clean; treating a thin pool as a reason to write dishes rather than to name a content
priority.

### 4.3 `docs`

**Why.** Canonical docs must read as coherent present-tense specs with no historical seams, and the
operational layer at root must stay aligned to them. Producing that quality of writing while shipping
a feature is unreliable, so it runs as a separate pass. The two layers reconcile together because
they share every step but the file list, and splitting them produced a flag-and-defer loop in which
each half deferred an item to the other and neither closed it.

**Inputs.** The pass's deferred list, then the standing checks, then `docs/CHANGELOG.md` entries
since the marker. Each entry's `Updated:` line is the primary work queue: it names the sections the
shipping session judged stale, and the pass verifies that judgment rather than re-deriving every
entry's impact from the diff, while still scanning the entry body for impact the line missed. Also
the current documents themselves, as the style anchor, and the code under `engine/` and `app/` for
claims that are checkable.

**What it does.** One pass, two lanes, one PR. Lane A is the four canonical docs; lane B is the root
operational docs, the skill and command briefs, and `app/web/e2e/`. It maps each entry to its
documents, rewrites the relevant sections in place, verifies claims against code, runs the standing
checks, and opens `docs/maintenance-<date>` with one commit per document, lane A committing first.
Where an operational doc restates a canonical fact the canonical doc wins, and keeping the pointer
between the two layers valid is this pass's job.

**The window is not the whole input.** The brief carries a standing-checks list of claims known to
have gone false once, verified every run regardless of the window: the spec-code parity claim, which
is held by review and not by a CI check; section-number pointers; the command and skill inventory;
the root inventory in its three places; and the branch names `docs/development.md` §2 defines. Four
false or stale claims survived two window-scoped passes because each predated the window.

**Output.** In-place rewrites, one commit per document, plus the conflicts it flags.

**Refuses.** Rewriting an append-only ledger; editing `docs/engine.md` for anything but wording that
describes shipped code; historical seams; widening beyond the window except for the standing checks
and the deferred list; moving or renaming a file autonomously.

**Anti-patterns.** "Added in feat/X"; "previously X, now Y"; `(new)` or `(updated)` markers in
headings; inline dates in a document body; past-tense narrative; re-syncing a duplicated product or
engine number in `README.md` instead of trimming it to a pointer into `docs/`; restating canon in a
brief that should point at it.

### 4.4 `retro`

**Why.** The signals pass turns the household's feedback into product change; this pass turns the
EM's own process and system friction into process and system change. It is the same machinery pointed
inward, so the two-loops principle (`docs/product.md` §4) holds: shipping is the fast loop, improving
how we ship is the slow loop. Friction the EM hits while running streams evaporates at session end
unless it is captured and triaged, and `RETRO.md` is the durable ledger of it.

The EM runs it inline, because `RETRO.md` is the EM's ledger of its own friction and every fix is a
judgment about how streams actually run.

**Inputs.** Its window is a status, not a date: every entry whose `Status:` is `open`, `triaged`, or
`fixed in part`, whatever its date, plus everything appended since the marker. A date window loses an
entry the moment one pass declines to close it. Also the documents and files those entries point at.

**What it does.**

1. Reads the open entries and clusters them by Area and root cause; several entries often share one
   fix.
2. Right-sizes each cluster (`docs/product.md` §4 Principle 1): the smallest level that solves it (a
   brief line, a process-doc edit, a CI or test change, tooling, an infra item), or `no-change` with
   a stated reason. It does not generalize from a single one-off entry; a `one-off` recurrence is
   usually `no-change`.
3. Lands each fix on the right path: brief lines and CI or tooling edits in the docs PR's third
   commit group; a canonical-doc edit handed to the docs pass in the same sitting; anything
   stream-sized (a mutation, a script, a schema field) as a `chore/*` request via `/new-stream`;
   anything needing Rajat (a secret, a paid tier, a merge-blocking CI gate) surfaced, never actioned
   (`docs/development.md` §7).
4. Updates each consumed entry's `Status:` line in place to `fixed (PR #NNN)`, `fixed in part
(PR #NNN)`, `wont-fix (reason)`, or `triaged (owner, path)`. It never rewrites the rest of the
   entry; the ledger is append-only history.

**How EMs file entries.** At session close the EM appends a `RETRO.md` entry for each systemic or
recurring friction (the format and the "what to log" test live in `RETRO.md`). One-off self-inflicted
slips are not logged. The entry's `Proposed level` is the EM's first-cut sizing; this pass makes the
final call.

**Output.** Status lines updated in place, the fixes on their paths, and a table in the docs PR.

**Refuses.** Rewriting any part of an entry other than its `Status:` line; editing a canonical doc
here; silently actioning an infra or cost item; closing an entry because it is old rather than
because it is fixed.

**Anti-patterns.** Logging one-off slips, turning the ledger into noise (the over-broad-ledger
failure); fixing a single entry with a cross-cutting abstraction before two entries need it
(Principle 8); editing canonical docs in this pass instead of routing through the docs pass
(`docs/development.md` §11.4).

### 4.5 `hygiene`

**Why.** Every item in this pass was done on instinct at a previous sitting or not at all: merged
branches left on the remote, a prototype worktree kept for months, retired tables on the dev
deployment, an untracked report file at root. None of it was in any brief, so none of it was
anybody's job. The EM runs it inline, last, so it sees the tree the other four passes left.

**Inputs and checks.** Mechanical:

- **Root inventory.** Every entry at the repository root is one of these. Files: `.gitignore`,
  `.githooks/`, `.maintenance-state`, `.prettierignore`, `.prettierrc`, `.stylelintrc.json`,
  `README.md`, `CLAUDE.md`, `DECISIONS.md`, `MAINTENANCE.md`, `ADDING-DISHES.md`,
  `EVOLVING-THE-ENGINE.md`, `RETRO.md`, `claude-design.md`, `eslint.config.js`, `package.json`,
  `package-lock.json`, `tsconfig.json`, `tsconfig.base.json`, `vercel.json`. Directories:
  `.claude/`, `.github/`, `app/`, `archive/`, `data/`, `docs/`, `engine/`, `features/`, `scripts/`.
  Gitignored entries the check tolerates: `.git`, `.vercel`, `node_modules`, `coordination/`. This
  list mirrors the enforced allowlist regex in `.github/workflows/ci.yml`; the authoritative
  annotated layout is `docs/engineering.md` §14. A change to the inventory is a three-place edit:
  the regex, this list, and that layout.
- **`.gitkeep`s.** Every empty-but-anticipated directory carries one. `features/` is the standing
  case.
- **Folder naming**, per `docs/engineering.md` §14.
- **Remote branches** whose PR is merged or closed.
- **Worktrees** with no Live row in `coordination/active-streams.md`.
- **Retired tables** on the dev deployment, against `app/convex/schema.ts`.
- **`CLAUDE.md`'s "Currently building" line**, against `features/` and `docs/PLAN.md`.
- **Untracked files** that are not gitignored, and anything `npm run format:check` would redden.
- **`.maintenance-state`** itself: five rows, no row left `running`, every counted deferral present
  in the Deferred section.

**What it does.** Safe cases are done: deleting a remote branch whose PR merged is the one
destructive action this pass takes on its own. Everything else destructive or ambiguous goes on a
list for Rajat in the PR body. The pass never moves or renames a file autonomously.

**Output.** A report, as the docs PR's fourth commit group.

**Refuses.** Any write to production; moving or renaming a file; deleting anything other than a
remote branch whose PR merged; acting on a file a live stream owns.

**Anti-patterns.** Deleting on a guess; renaming a file to satisfy a convention without checking what
imports it; reporting "the tree is clean" without having run the loop; fixing a root-inventory
mismatch in one of its three places and not the other two.

## 5. The evolution-request ledger

`data/engine-requests.md`, append-only, committed, beside `data/changelog.md`. It is the only thing
that flows between the two skills, and it flows one way.

One entry per evolution-sized finding: the date, the pass that raised it, the pattern in one
sentence, the evidence (row ids, the two monitor tables, dates, counts), what maintenance did
meanwhile (a conservative data-level action, or nothing), and a status of `open`,
`taken into <version>`, or `dismissed (reason)`. The entry template is
`.claude/skills/maintain/templates/request.md`.

Entries state a household-side measurement. They never name a mechanism or describe the current
engine's internals, so the file is safe to read inside `/evolve-engine`'s clean room.

**What qualifies:** a monitor measure that moved the same way across two consecutive monitors; a
dislike repeated or shared by both members on a dish the data levels cannot serve; a recurring
incident class; a skip or delete pattern that reads as a slot-composition problem; a rule the signals
pass wanted to edit and could not. Each of these is invisible to the record an evolution run pulls,
which sees served food and hand edits and nothing else.

**Who reads it in `/evolve-engine`:** the critic and the decider, from round one, as one added line
on each reading list. Not the recorder, which recovers a record and this is not one; not the rulebook
author or the spec author, whose clean room forbids anything that references engine behaviour. At
step 1 the EM snapshots the open entries into the run folder so the run is deterministic, and at
cutover it marks them `taken into <version>` or `dismissed`.

It lives in `data/` rather than `features/` because `features/` is empty between features by
convention and this file persists across runs, and `data/` already holds the structural changelog. It
is not `RETRO.md`, which is process friction only and would become the over-broad ledger it warns
about, and it is not `DECISIONS.md`, which records decisions taken rather than findings pending.

## 6. The state file and resume

`.maintenance-state` at the repository root is the sitting's only state: a manifest with one row per
pass.

```
| pass    | last-run   | status  | deferred | note                              |
| ------- | ---------- | ------- | -------- | --------------------------------- |
| signals | 2026-07-14 | done    | 0        | -                                 |
| health  | never      | pending | -        | monitor never run                 |
| docs    | 2026-09-07 | done    | 1        | product.md P3 CI claim            |
| retro   | 2026-09-07 | done    | 2        | 2026-08-18 entries still open     |
| hygiene | 2026-09-07 | done    | 1        | merged branches left on the remote|
```

Below the table, a **Deferred** section lists each deferred item under the pass that owns it.

- `last-run` is the pass's input-window marker: the signals pass reads queued rows since it, the docs
  pass reads CHANGELOG entries since it, the health pass measures the monitor's 28-day gate from it.
  The retro pass's main window is a status rather than a date, so its `last-run` bounds only the
  "appended since" half.
- `status` is `done`, `pending`, or `running`. A row left `running` by a dead session is treated as
  not done and re-run from scratch: every brief has a fixed reading list, so a re-run reproduces the
  artifact. Overwrite a partial artifact; never repair one.
- **A pass may not report `done` with an unrecorded deferral**, and every pass reads its deferred
  items before its date window. That is the whole fix for open items falling out of a window forever,
  and it is what flat date markers cannot express.

The file is committed, so the job history is part of `git log`. The template is
`.claude/skills/maintain/templates/state.md`.

`/maintain resume` reads this file and continues from the first pass not marked `done`. There is no
self-scheduled wakeup: a sitting is hours, not days, and a sitting that dies is resumed at the next
one. That is the one `/evolve-engine` mechanism deliberately not imported.

## 7. What `/maintain` refuses as a whole

- **A rule edit, a new tag value, a new frontmatter key, or an engine behaviour change, in any
  pass.** Those are `/evolve-engine`'s (§1). The output is an evolution request (§5) plus the
  conservative data-level action.
- **An engine code edit without a failing test that names the clause of `docs/engine.md` it
  violates.**
- **Acting on a single instance of any signal.** One skip is not a calendar override; one delete is
  not an over-generation finding; one dislike is not a deactivation; one monitor's wobble is not a
  drift.
- **Writing anything to production.** The only production access is the signals pass's read of the
  queued tables and the health pass's record export. The write-back happens on merge, through the
  action (§3).
- **Rewriting an append-only ledger** (`DECISIONS.md`, `RETRO.md`, `docs/CHANGELOG.md`,
  `data/changelog.md`). The retro pass edits `Status:` lines in place and nothing else. An entry is
  history and is never rewritten; a ledger's instructional header is spec and the docs pass may
  correct it.
- **Editing a file a live stream owns** (`docs/development.md` §11.2). Skip it and record it.
- **Reporting a pass `done` with an unrecorded deferral.**
- **Running at all when the engine's shape is wrong.** That is `/evolve-engine`. This skill is for
  the data, the docs, the ledgers, and the repository around it.

## 8. First sitting

Two items the first sitting carries and no later one does.

- **The pre-v6 signal backlog is consumed with a stated cutoff.** The signals marker is 2026-07-14
  and engine v6 replaced the whole chooser on 2026-09-07. Every queued row before that cutover was
  generated by an engine that no longer exists, and the 2026-07-14 run already showed what that
  produces: 144 rows, seven clusters, every one `reviewed_no_change`. The first signals pass consumes
  everything before the cutover as `reviewed_no_change` with the single reason "generated by engine
  v5; superseded by v6 (#256)" and starts its real window at the first v6-generated week. From then
  on the signals pass is bound to phase close-out (`docs/development.md` §3 step 8) so it cannot lag
  an engine replacement again.
- **The monitor has never run.** The health pass owns it, gated on 28 days, and it is that pass's
  headline output. Its first run has no previous monitor to compare against, so no measure can be a
  finding on it; the two-consecutive-monitors test starts at the second.
