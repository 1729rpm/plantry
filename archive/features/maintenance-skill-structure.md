# The maintenance skill: final structure

The structure of `/maintain`, the second of Plantry's two slow workflows, decided 2026-09-07 by the
EM session. It supersedes `archive/features/maintenance-skill-review.md` (PR #265), which it agrees with on
the shape and overrules on six specifics (§9). It is grounded in three inputs: that review; an
independent clean-room study of the repo, its ledgers, and the git history of every maintenance run
since June, done by an agent forbidden from reading the review; and a check of the current Claude
Code documentation on how skills, arguments, and subagents are laid out. It decides; the next
session builds from it. Nothing in the repo changes on its account until that build lands.

## 1. Two skills, and the line between them

Plantry keeps exactly two slow workflows, each a skill with its own operational document:

- **`/evolve-engine`** (`EVOLVING-THE-ENGINE.md`) re-derives the engine from the household record.
  It changes how the engine decides.
- **`/maintain`** (`MAINTENANCE.md`) keeps everything the engine and the repo depend on true. It
  changes what the engine reads and what the docs say.

The line is stated once, here, and cross-referenced from both documents.

| Maintenance owns                                                                                                                                           | Evolution owns                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Values of existing fields in `data/dishes/*.md` (`active`, `seasons`, `category`, existing `tags` values, `complexity`) and the promotion of custom dishes | Any new field, any new tag value, any change to `engine/src/data/schemas.ts`        |
| Rows in `data/ingredients.md`                                                                                                                              | The pools, the chooser, the ledgers, the scheduling arithmetic, the household model |
| `docs/engine.md` and `engine/src/` only where they disagree with each other (a defect, proved by a failing test)                                           | `docs/engine.md` and `engine/src/` where they agree and the behaviour is wrong      |
| Gate reporting: recording a known failure, printing a number, the monthly monitor                                                                          | Gate thresholds: any band, bar, or exemption                                        |
| The four canonical docs, the root operational docs, the skill briefs, CI, tooling, the ledgers' status lines, the repository layout                        | The "deliberately absent" list in the engine spec                                   |

Three clarifications that the current `MAINTENANCE.md` gets wrong or leaves open:

- **A new tag value is evolution, not a slow-loop level.** Tags are a closed enum (a fixed list of
  allowed values the schema validates against), so a new value is a schema change plus a rule that
  reads it, which is engine shape. Applying an existing value to more dishes is data. §1.4 and §1.7
  of `MAINTENANCE.md` currently list "new tag + rule wording + engine + tests" as a maintenance
  fix; that row goes.
- **A defect is not evolution.** When a test proves the code does not do what `docs/engine.md`
  says, maintenance fixes the code, with the failing-then-passing test in the PR and `npm run gate`
  re-run. Without such a test the change is a rule edit and is refused.
- **There is no escape hatch inside maintenance for a "cheap, obviously right" rule edit.** The two
  slow-loop PRs that changed rules (#61 and #62, both 2026-06-14) were Rajat-directed proactive runs,
  not signal-driven, and they predate the record-derived engine. Under v6 an unmeasured rule edit is
  exactly the failure v4 and v4.1 were. If Rajat wants a rule shipped without a full evolution, the
  path is the fast loop: a `/new-stream` feature PR with the full gate green, which already exists
  and needs no exception in this skill. Maintenance files the evolution request either way (§5), so
  the ledger still shows what was asked and what shipped.

The one-line test for an ambiguous case: **can the change be justified from the current record
alone, at one file, reversibly?** If yes it is maintenance. If knowing whether it is right needs a
20-to-60-week simulation, it is evolution.

`EVOLVING-THE-ENGINE.md` §1 currently says "a single rule that misfires belongs to the slow loop".
That sentence changes to point at this boundary: a misfiring rule is an evolution request; a
misbehaving implementation of a stated rule is maintenance.

## 2. The skill at a glance

One command, `/maintain`, with five passes. No argument runs the sitting in order; a pass name runs
one pass. Each pass has a brief, a reading list, one artifact, and a refusal list, in the shape the
evolve roles have.

| #   | Pass      | Absorbs                                         | Reads                                                                                                                  | Writes                                                                                                | Runs as    |
| --- | --------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------- |
| 1   | `signals` | The slow loop's reactive half                   | queued `manualChanges`, `dishDislikes`, open `incidents`; the library; `data/changelog.md`                             | data-row edits; `data/changelog.md`; diagnosis cards; evolution requests                              | subagent   |
| 2   | `health`  | The slow loop's proactive half and §1.9         | `npm run reports`; the gate's pool-health lines; the monitor when due (a prod record export)                           | the monitor table; proactive proposals; content priorities for `ADDING-DISHES.md`; evolution requests | subagent   |
| 3   | `docs`    | `/reconcile-docs` and `/reconcile-ops`          | `docs/CHANGELOG.md` since the marker; the deferred list; the canonical docs, the ops layer, the briefs, `app/web/e2e/` | in-place rewrites, one commit per document                                                            | subagent   |
| 4   | `retro`   | `MAINTENANCE.md` §6, by hand today              | every `RETRO.md` entry not closed, whatever its date, plus entries since the marker                                    | `Status:` lines in place; brief lines; CI and tooling fixes; items for Rajat                          | EM, inline |
| 5   | `hygiene` | The §2.9 structure check plus what no job owned | the root inventory, `git branch -r`, `git worktree list`, the dev deployment's tables, `CLAUDE.md`'s status line       | a report; deletion of branches whose PR merged; a list for Rajat of anything destructive              | EM, inline |

Order is fixed: `signals`, `health`, `docs`, `retro`, `hygiene`. Signals and health first because
they are the passes that can change `data/` and (for a defect) the engine, and the docs pass
reconciles against the result. Docs before retro because retro's fixes are brief-and-CI shaped and
several open entries are blocked on a docs edit. Hygiene last, as a check over the finished tree. An
empty pass writes one line and moves its marker; an empty sitting is healthy.

Why five and not the three commands plus two by-hand jobs of today:

- **Signals and health are separate** because one consumes rows and writes data and the other
  measures and writes nothing to the library. The health pass has no fix ladder. Its outputs are the
  table and, when a drift has persisted across two monitors, an evolution request. That is the
  mechanism that decides when `/evolve-engine` is worth running, and it must not be able to touch
  the engine itself.
- **The two reconciles merge** because they share every step but the file list, they have run in the
  same sitting every time it mattered, and the split's only product is a flag-and-defer loop: the
  `docs/engine.md` §13 CI-parity claim was deferred by two consecutive passes (#233, #235) and
  closed on the third. The split also let the run order invert twice (the ops pass merged before the
  canonical pass on 2026-08-18 and 2026-09-07, so it reconciled against canon that had not caught
  up). Two lanes survive as two commit groups in one PR.
- **Retro gets a brief for the first time.** It is the only job with no command, no fixed branch
  name (it has landed on `chore/retro-*`, `docs/maintenance-*`, inside an ops PR, and inside a phase
  close-out), and, by the evidence, the best change-per-run ratio of the four. It stays a separate
  pass rather than folding into docs: different input, different output, different quality bar.
- **Hygiene is named** because every item in it was done on instinct at the last sitting (seven
  merged branches on the remote, a prototype worktree kept for months, retired tables on the dev
  deployment, an untracked report file). None of it was in any brief.

## 3. The passes

Each pass's brief carries: mandate, exact reading list, forbidden inputs, the artifact and its
required sections, the refusal list, and the report format. The substantive rules that exist today
are kept whole and move into the matching pass: `MAINTENANCE.md` §1.4's signal patterns and
thresholds, §1.7's right-size table (minus the rows that end in a rule edit or a new tag), §1.8's
proactive reads, §1.9's monitor, §1.10's anti-patterns, §2.6's style rules, §2.7's anti-patterns,
§2.8's conflict handling, §2.9's structure check, §6.4's retro procedure, §6.7's anti-patterns,
§7.4's README-stays-lean and briefs-point-at-canon rules.

### 3.1 `signals`

Reads the three queued tables from production (or a fixture), clusters by theme, writes one
diagnosis card per cluster, and applies a **four-level fix ladder**: data row, existing tag value,
defect fix (test-proved), evolution request. "No change warranted" stays a valid, written outcome.
The PR keeps the `slow-loop/<date>` branch prefix and the §3.1 body contract, because the
`slow-loop-applied` action matches on that prefix and parses that body; both are unchanged.

Refuses: any rule wording change; any new frontmatter key, tag value, or catalog column; any engine
edit without a failing test that names the spec clause; acting on a single instance of any signal.

### 3.2 `health`

Runs `npm run reports` and reads the gate's reported-not-gated lines every sitting. When the last
monitor is 28 or more days old it runs the §1.9 monitor: one production record export (a read, with
Rajat's per-action approval), `npm run gate` on it, the four measures over the trailing eight served
weeks. The table goes in the PR body. A measure that has moved the same way across two consecutive
monitors becomes an evolution request with the two tables as its evidence. A thin pool becomes a
content priority the PR names for `ADDING-DISHES.md`; the pass never authors a dish.

Refuses: any edit under `data/`, `docs/engine.md`, or `engine/`; any threshold change; turning one
monitor's wobble into a finding.

### 3.3 `docs`

One pass, two lanes, one PR. Lane A is the four canonical docs; lane B is the root operational docs,
the skill briefs, and `app/web/e2e/`. It reads the CHANGELOG window plus the deferred list from the
state file (§6), maps each entry to its docs, rewrites in place, verifies claims against code, runs
the structure check, and opens `docs/maintenance-<date>` with one commit per document, lane A
commits first. The canonical doc wins over an operational restatement, and the pass keeps the pointer
between the two layers valid, which today neither pass owns.

The window is not the whole input. The clean-room study found four false or stale claims in files the
2026-09-07 passes had open and left alone, because each predates the window: `docs/product.md` §4
Principle 3 still says spec-code parity is a CI failure; `MAINTENANCE.md` §6.7 cites a
`development.md` §12.4 that is the glossary; `MAINTENANCE.md` §7.4 cites a `docs/ops-<date>`
branch rule `development.md` §2 does not define; `docs/engineering.md` §14 counts four commands.
So the brief carries a short **standing checks** list of claims known to have gone false once
(the CI-parity claim, section-number pointers, the command and root inventories), verified every
run regardless of the window.

Refuses: rewriting an append-only ledger; editing `docs/engine.md` for anything but wording that
describes shipped code; historical seams; widening beyond the window except for the standing
checks and the deferred list.

### 3.4 `retro`

The EM runs it inline, because `RETRO.md` is the EM's ledger of its own friction and every fix is a
judgment about how streams actually run. Its input window changes from a date to a status: every
entry whose status is `open`, `triaged`, or `fixed in part`, regardless of date, plus everything
appended since the marker. Today's date-windowed read has already lost two 2026-08-18 entries that
are still open. Fixes land on the right path: brief lines and CI or tooling edits in the docs PR's
third commit group; anything needing a stream (a mutation, a script) as a `chore/*` request via
`/new-stream`; anything needing Rajat (a secret, a paid tier, a CI gate) surfaced, never actioned.

### 3.5 `hygiene`

The EM runs it inline. Mechanical: the root inventory against the CI allowlist, `.gitkeep`s, folder
naming, remote branches whose PR merged, worktrees with no live stream in the registry, retired
tables on the dev deployment, `CLAUDE.md`'s "Currently building" line, untracked files that Prettier
would redden. Safe cases are done (deleting a branch whose PR merged); anything destructive beyond
that is listed for Rajat in the PR body. The report is part of the docs PR.

## 4. The sitting

- **Worktree.** One maintenance worktree off freshly fetched `origin/main`, `../plantry-maintain-<date>`,
  because the main directory cannot commit. The signals and health passes work on branch
  `slow-loop/<date>`; once that PR is pushed and opened the worktree moves to
  `docs/maintenance-<date>` for the remaining three passes. Commit after every pass, push before
  the next starts. A dead session loses at most one pass, and `RETRO.md`'s still-open entry about a
  day of work lost in an uncommittable tree closes.
- **Two PRs at most.** `slow-loop/<date>` carries data and the health table, and it is the PR that
  carries judgment: Rajat reads it. `docs/maintenance-<date>` carries docs, retro, and hygiene as
  three commit groups; it is mechanical catch-up (all thirteen canonical reconciles to date merged
  unchanged), and the spec says so, so Rajat can merge it on the EM's word.
- **Subagents for the first three passes**, spawned by the EM with the brief's placeholders filled:
  the date window, the contended-file list from `coordination/active-streams.md` (a file another
  live stream owns is skipped and recorded, not edited), and the deferred list. Retro and hygiene
  run in the EM session. Every spawned pass writes its artifact before it reports, and the EM reads
  the artifact before moving the marker.
- **Resume.** `/maintain resume` reads the state file and continues from the first pass not marked
  `done`. No usage-limit wakeup: a maintenance sitting is hours, not days, and a sitting that dies is
  simply resumed at the next one. That is the one evolve mechanism deliberately not imported.
- **No production writes.** The only production access is the read of the three queued tables and
  the monitor's record export. The `slow-loop-applied` action does the write-back on merge, as today.

## 5. The evolution-request ledger

The only thing that flows between the two skills, and it flows one way.

`data/engine-requests.md`, append-only, committed, beside `data/changelog.md`. One entry per
evolution-sized finding: the date, the pass that raised it, the pattern in one sentence, the evidence
(row ids, the two monitor tables, dates, counts), what maintenance did meanwhile (a conservative
data-level action, or nothing), and a status: `open`, `taken into <version>`, or
`dismissed (reason)`. Entries state a household-side measurement; they never name a mechanism or
describe the current engine's internals, so the file is safe inside the evolve clean room.

Why `data/` and not `features/`: `features/` is empty between features by convention, and this
file persists across runs. `data/` is already "the slow loop's target" and already holds the
structural changelog; a sibling file is the smallest addition. Not `RETRO.md` (process friction only;
mixing product findings in recreates the over-broad-ledger failure it warns about) and not
`DECISIONS.md` (decisions taken, not findings pending).

What qualifies: a monitor measure moved the same way across two consecutive monitors; a dislike
repeated or shared by both members on a dish the data levels cannot serve; a recurring incident
class; a skip or delete pattern that reads as a slot-composition problem; a rule the signals pass
wanted to edit and could not. Each of these is invisible to the record the evolve run pulls, which
sees served food and hand edits and nothing else.

Who reads it in `/evolve-engine`: the **critic** and the **decider**, from round one, as one added
line on each reading list. Not the recorder (it recovers a record, and this is not one), and not the
rulebook author or the spec author (the entries reference engine behaviour, which their clean room
forbids). At step 1 the EM snapshots the open entries into the run folder so the run is
deterministic, and at cutover it marks them `taken into <version>` or `dismissed`.

## 6. State and resume

One committed file, `.maintenance-state`, replacing itself and `.retro-state`. A manifest in the
spirit of the evolve `RUN.md` at a tenth of the size:

```
| pass    | last-run   | status  | deferred | note                              |
| ------- | ---------- | ------- | -------- | --------------------------------- |
| signals | 2026-07-14 | done    | 0        | -                                 |
| health  | never      | pending | -        | monitor never run                 |
| docs    | 2026-09-07 | done    | 1        | product.md P3 CI claim            |
| retro   | 2026-09-07 | done    | 2        | 2026-08-18 entries still open     |
| hygiene | 2026-09-07 | done    | 1        | root design handoff dir           |
```

Below the table, a **Deferred** section lists each deferred item with the pass that owns it. A pass
may not report `done` with an unrecorded deferral, and every pass reads its deferred items before
its date window. That is the whole fix for open items falling out of a window forever, and it is
what four flat markers cannot express.

Deleting `.retro-state` touches three places that move together: the file, the CI root allowlist
regex in `.github/workflows/ci.yml`, and the inventories in `MAINTENANCE.md` §2.9 and
`docs/engineering.md` §14.

## 7. Files

### 7.1 Layout

Claude Code's current recommended layout is a skill folder, `.claude/skills/<name>/SKILL.md`, with
supporting files beside it; `.claude/commands/` still works but is the legacy form, and a skill and
a command with the same name conflict with the skill winning. `/maintain` is built in the skill
layout from the start:

```
.claude/skills/maintain/
  SKILL.md                 the orchestrator: arguments, the sitting, the standing rules, what to refuse
  passes/signals.md        one brief per pass, in the shape of .claude/evolve/roles/
  passes/health.md
  passes/docs.md
  passes/retro.md
  passes/hygiene.md
  templates/state.md       the .maintenance-state manifest template
  templates/request.md     the engine-requests entry template
```

`SKILL.md` frontmatter: `description`, `argument-hint: "[pass|all|resume] [since:YYYY-MM-DD] [dry-run] [--fixture <path>]"`,
and `disable-model-invocation: true` so only Rajat or the EM invokes it by name, never the model on
its own judgment. Arguments arrive as one string and the brief parses them.

The passes stay as briefs the EM reads and injects with placeholders filled, not as `.claude/agents/`
definitions. Both work; briefs are what the evolve skill uses, and a maintenance brief needs per-run
values (the window, the contended files, the deferred list) that the EM fills at spawn time.

`/evolve-engine` stays where it is for now. Moving it to the same layout is a mechanical rename
(`git mv` of the command file and `.claude/evolve/` into `.claude/skills/evolve-engine/`, then the
caller grep) and is queued as a hygiene item, not bundled into this build, because the evolve skill
shipped 24 hours ago and its file paths are cited in two specs, eleven briefs, and a template.

### 7.2 Deleted

`.claude/commands/slow-loop.md`, `.claude/commands/reconcile-docs.md`,
`.claude/commands/reconcile-ops.md`, `.retro-state`. The retro intake had no file to delete.

### 7.3 Kept by name because code depends on them

`MAINTENANCE.md` (cited from the Convex mutations, the mark-applied script, the pre-commit hook, the
prettier ignore, and three evolve briefs) and the `slow-loop/<date>` branch prefix (matched by
`slow-loop-applied.yml`). A repo-wide grep before the build PR merges finds 178 references across 25
files to the maintenance machinery's names; the two names above are the ones that must not move. The
`new-stream.md` caller-grep rule applies.

### 7.4 What `MAINTENANCE.md` becomes

The spec of `/maintain`, in the shape `EVOLVING-THE-ENGINE.md` has: purpose and the boundary (§1
above, stated once); the sitting at a glance (§2's table); one section per pass with why, inputs,
what it does, output, refusals, anti-patterns; the ledger (§5); the state file and resume (§6); the
mark-applied contract (today's §3, unchanged); what the skill refuses as a whole. The four stale
claims §3.3 lists are fixed in the rewrite.

### 7.5 Other documents that change

- `EVOLVING-THE-ENGINE.md` §1: the boundary sentence (§1 above). §5: the critic's and decider's
  reading lists gain the ledger. `.claude/commands/evolve-engine.md` step 1: snapshot the open
  entries; cutover: mark them. `.claude/evolve/roles/critic.md` and `decider.md`: one line each.
- `docs/development.md` §6 becomes "Maintenance trigger" and describes all five passes at the depth
  it gives the slow loop today; §2 gains `docs/maintenance-<date>` as the docs pass's branch and
  drops `docs/ops-<date>`; §5's diagnosis card keeps its six levels (every PR uses it) and gains one
  line: inside `/maintain`, rule edit and engine code resolve to an evolution request.
- `docs/engineering.md` §14: the skill folder, the ledger, the single state file.
- `CLAUDE.md`: the commands list names `/evolve-engine`, `/maintain`, `/new-stream`; the read-order
  line for maintenance points at `MAINTENANCE.md`.
- These are canonical or operational docs, so they go through the first `/maintain docs` pass after
  the build merges, not through the build PR, except the lines the build PR must carry to be
  coherent (`CLAUDE.md`'s command list, `docs/engineering.md` §14's allowlist mirror).

## 8. What stays out

- **`ADDING-DISHES.md`** stays a playbook. The health pass names a content priority; a person
  authors the batch. Nine content batches have landed cleanly through it.
- **Weekly generation** stays a hand-triggered production write outside both skills, paused today.
- **`/new-stream`** is the fast loop's spawning tool, not a job.
- **Phase close-out** (`development.md` §3 step 8) is triggered by a merge, not a cadence; it has
  ridden along with sittings but is not a pass.
- **The custom-dish SessionStart hook** stays as local EM tooling; the signals pass consumes what it
  surfaces.
- **Gate thresholds 2 and 5** stay as Rajat left them; the health pass reports them each run.

## 9. Where this differs from the review

| Topic                    | Review (#265)                                               | Decided here                                                                      | Why                                                                                                         |
| ------------------------ | ----------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Ledger location          | `features/engine-requests.md`                               | `data/engine-requests.md`                                                         | `features/` is empty between features by convention; `data/` already holds the structural changelog         |
| Who reads the ledger     | The recorder, at step 1                                     | The critic and decider, from round one; the EM snapshots it at step 1             | It is not a record, and its entries reference engine behaviour, which the two authors' clean room forbids   |
| State file               | One file, five date markers                                 | One file, a manifest with status and a deferred list                              | Five markers cannot say "ran and deferred three items", which is the failure the history shows              |
| Retro's window           | Since the marker                                            | Every not-closed entry regardless of date, plus since the marker                  | Two 2026-08-18 entries are open and already invisible to a date window                                      |
| Which passes are spawned | All five, each an agent                                     | Signals, health, docs spawned; retro and hygiene inline                           | Retro is EM judgment about the EM's own ledger; hygiene is five minutes of mechanical checks                |
| Layout                   | `.claude/commands/maintain.md` + `.claude/maintain/passes/` | `.claude/skills/maintain/SKILL.md` + `passes/`                                    | The current recommended layout, with `disable-model-invocation`; evolve migrates later as a mechanical move |
| PR for retro             | Inside the docs PR                                          | Inside the docs PR (agreed); stream-sized fixes go to `chore/*` via `/new-stream` | Same as the review, stated                                                                                  |
| Docs pass scope          | The window                                                  | The window plus a standing-checks list plus the deferred list                     | Four false claims survived two window-scoped passes                                                         |

## 10. Before the first run

Items the clean-room study surfaced that the build or the first sitting should carry, each right-sized:

1. **The pre-v6 backlog is dead on arrival.** `last_slow_loop` is 2026-07-14; engine v6 replaced the
   whole chooser on 2026-09-07. Every queued row before the cutover was generated by an engine that
   no longer exists, and the 2026-07-14 run already showed what that produces: 144 rows, seven
   clusters, all `reviewed_no_change`. The first `signals` pass consumes everything before the
   cutover as `reviewed_no_change` with the single reason "generated by engine v5; superseded by v6
   (#256)" and starts the real window at the first v6-generated week. The spec then binds the
   signals pass to phase close-out so it cannot lag an engine replacement again.
2. **The dislike write-back mutation does not exist.** Every dislike ever tapped is still `queued`, so
   every signals pass re-reads the whole history. One `internalMutation` mirroring
   `manualChangesMutations`, plus the lines in the mark-applied script: a `chore/*` stream, the first
   thing the retro pass requests.
3. **The monitor has never run.** It was written into `MAINTENANCE.md` on 2026-09-07 by the ops
   reconcile and nothing has run it. The health pass owns it, gated on 28 days, and it is the pass's
   headline output.
4. **The spec-code parity check.** Three docs claimed a CI check that was never built; one still does.
   The cheap half (a PR that touches `docs/engine.md` must also touch `engine/src/` and
   `engine/test/`) is mechanical and already described in `docs/engineering.md` §15. It is a
   merge-blocking gate and therefore Rajat's call (D8 below); the docs pass stops implying the full
   check exists either way.

## 11. Decisions for Rajat

Each with the EM's recommendation, which the build follows unless overruled.

| #   | Decision                                                                             | Recommendation                                                      |
| --- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| D1  | One `/maintain` with five passes, or separate commands?                              | One command; each pass invocable alone.                             |
| D2  | Merge the two reconciles into one `docs` pass?                                       | Yes.                                                                |
| D3  | Retro as its own pass, inline with the EM?                                           | Yes.                                                                |
| D4  | The boundary in §1, with no rule-edit escape hatch inside maintenance?               | Yes; the fast loop is the escape hatch and it already exists.       |
| D5  | The defect exception, gated on a failing test that names the spec clause?            | Yes; without the test it is refused.                                |
| D6  | `data/engine-requests.md`, read by the critic and decider?                           | Yes; the highest-value single addition.                             |
| D7  | One manifest-style state file with a deferred list; delete `.retro-state`?           | Yes.                                                                |
| D8  | Build the mechanical spec-code parity CI check?                                      | Yes, the cheap half only; it is a merge-blocking gate, so his call. |
| D9  | Build the dislike write-back mutation first?                                         | Yes.                                                                |
| D10 | Clear the pre-v6 signal backlog with a stated cutoff on the first run?               | Yes, before anything else.                                          |
| D11 | Skill-folder layout for `/maintain` now, evolve migrated later as a mechanical move? | Yes.                                                                |
| D12 | Keep the names `MAINTENANCE.md` and `slow-loop/<date>`?                              | Yes; code depends on both.                                          |
