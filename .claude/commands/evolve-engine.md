---
description: Re-derive the meal-planning engine from what the household actually ate. Runs the seven-step evolution unattended, stops once for Rajat's taste decisions, then hands the build to /new-stream. EM-only.
---

You are the EM running an engine evolution for Plantry. The full spec lives in
`EVOLVING-THE-ENGINE.md`. Re-read it now, along with `CLAUDE.md`, `docs/development.md` §1, §2, §11,
and `MAINTENANCE.md` §1 (so you can tell a slow-loop-sized problem from an evolution-sized one).

This command runs mostly unattended and can span days. You orchestrate; you never do the judgment
work. Every step's thinking is delegated to a fresh agent with an exact reading list, and every
agent's artifact is committed before the next step starts, so a dead session loses at most one step.

## Arguments

- `<version>`: the engine version this run produces, such as `v7`. Required on a new run. The run
  folder is `features/engine-<version>/` and the branch is `evolve/engine-<version>`.
- `resume`: continue an interrupted run. Reads `RUN.md` from the run folder and restarts at the
  first row that is not `done`. Takes the version from the branch or the folder; if more than one run
  folder exists, ask which.

## Standing rules for the whole run

- **Spawn every step-2-to-7 agent on the highest-intelligence model the harness offers, at the
  highest reasoning effort available** (today that is Opus; record the model you used in the
  manifest row so a resume reproduces it).
- **Inject the reading list into the prompt.** Do not tell an agent to "read the run folder". Give it
  the exact absolute paths it may read and the exact list it must not, both copied from its role
  brief with the placeholders filled.
- **Every agent writes its artifact before it reports.** Say so in every prompt. Its report back to
  you is a summary; the artifact is the deliverable.
- **After every step: update `RUN.md`, `git add features/engine-<version>`, commit, push.** Commit
  message: `evolve/<version>: step <n><, round n> <role> complete`. Never `git add -A`.
- **Read each artifact before marking its row `done`**, and check it carries the required sections its
  role brief names. A missing section is a re-run, not a note.
- **Do not summarise an agent's findings into the next agent's prompt.** The next agent reads the
  artifact, or it does not read it at all.
- **Never write to production.** The only production access in the whole run is the read-only pull at
  step 1, its re-export at step 7, and the cutover. Rajat's invocation of this command is his approval
  for the reads; the writes at cutover keep per-action approval.

## Procedure

### Step 0. Set up the run

1. Confirm the main repo working tree is clean. Confirm no other evolution run is in flight (no other
   `features/engine-*/RUN.md` with rows that are not `done`).
2. `git fetch origin`, then create the branch off freshly fetched `origin/main`:
   `git worktree add ../plantry-evolve-<version> -b evolve/engine-<version> origin/main`. Work from
   the worktree; the main directory cannot commit.
3. Create `features/engine-<version>/` and copy `.claude/evolve/templates/RUN.md` into it as `RUN.md`,
   filling the header (version, branch, worktree path, the model you will spawn agents on) and laying
   out every row of the run as `pending`: step 1; step 2; step 3; step 4 round 1; step 5 round 1 (six
   debate exchange rows plus differ, critic, decider pass A, decider pass B); step 4 round 2; step 5
   round 2; step 4 round 3; step 5 round 3; step 6; step 7.
4. Add a row to `coordination/active-streams.md` naming the run's lane: `features/engine-<version>/`
   plus, at step 7, the lanes the plan declares.
5. Commit and push the empty manifest. From here the manifest is the run's only state.

### Step 1. The truth (`recorder.md`)

1. **Approval.** Rajat's invocation of `/evolve-engine <version>` is his approval for the run's
   production reads, which are this pull and the step 7 re-export. The harness's permission gate may
   still prompt once when a command runs; that prompt is a click, never a decision, so the run carries
   no decision for Rajat before step 6. Do not stop to ask him.
2. Before the export, check whether any custom pick in the served weeks has since been promoted to a
   library dish; re-point those slots first so the record does not split one dish across a label and
   an id.
3. Spawn the recorder with `.claude/evolve/roles/recorder.md`. It runs two read-only commands, which
   are one approval:
   - `npx convex run --prod recordExport:exportRecord '{}'` for the engine-shaped record, which
     becomes `record.json`;
   - `npx convex export --prod --path <run folder>/prod-snapshot.zip`, run from `app/convex`, for the
     raw snapshot of every table and every row whatever its status. It is unzipped into the
     scratchpad or a temp directory, never into the run folder, and `currentWeek/documents.jsonl`
     gives the raw slot state (custom picks with their labels and positions included, which the
     engine-shaped export drops) while `manualChanges/documents.jsonl` gives every hand edit and its
     reason regardless of status. The snapshot is the source of `edit-reasons.md` and the cross-check
     on `record.json`. The zip is not committed; `.gitignore` excludes
     `features/engine-*/prod-snapshot.zip`.

   It writes `record.json`, `as-eaten.md`, and `edit-reasons.md`.

4. Verify the sanity checks in the `as-eaten.md` preamble reconcile with `record.json` yourself before
   marking the row done. Everything downstream measures against this file.

### Step 2. The rulebook (`rulebook-author.md`)

Spawn a fresh agent. Reading list: `as-eaten.md` and `edit-reasons.md`, absolute paths, and nothing
else. Forbidden, stated explicitly in the prompt: `docs/engine.md`, anything under `engine/`, any file
under `archive/features/`, any other `features/` file, and `data/`. Output: `rulebook.md`.

### Step 3. The simple engine (`spec-author.md`)

Spawn a fresh agent. Reading list: `rulebook.md`, `as-eaten.md`, `edit-reasons.md`. Same forbidden
list as step 2, plus every prior engine spec and dry run. Output: `spec.md`.

### Step 4. The dry run (`simulator.md`), rounds 1 to 3

Spawn a fresh agent per round. Reading list: `spec.md` as it currently stands, `record.json`, and the
dish library under `data/`. Output: the simulator source under `sim/` and `dry-run-<n>.md`.

Tell it, in the prompt: implement the most literal reading of every clause and never redesign; record
every ambiguity in the numbered known-approximations list; self-feed for 60 weeks; measure on weeks 20
to 60; run frozen, self-feeding, and corrected; report the determinism check; write the readable
ten-week menu in exactly `as-eaten.md`'s format. Read-only; nothing goes to production.

From round two, also give it the previous round's `sim/` as a starting point and the current
`decisions-<n-1>.md` so it knows which amendments it is implementing.

### Step 5. The round, three times

Run the five roles in this order. Each is its own spawn and its own manifest row.

1. **Differ** (`differ.md`). Reading list in round 1: exactly two files, the `## Week of` sections of
   `dry-run-1.md` (Menu A) and `as-eaten.md` (Menu B). State in the prompt that the dry run's preamble,
   its own measurements, and its long-horizon section are **not** inputs and must not be cited. From
   round two the list adds the previous round's dry-run menu and the previous rounds' differ and
   critic reports, for the resolution audit and the regression hunt. Output: `review-<n>-differ.md`.
2. **Critic** (`critic.md`). Reading list: `dry-run-<n>.md` in full, `spec.md`, `rulebook.md`,
   `as-eaten.md`, `edit-reasons.md`, `review-<n>-differ.md`. Forbidden: `docs/engine.md`, `engine/`,
   any prior engine spec. Output: `review-<n>-critic.md`.
3. **Decider, pass A** (`decider.md`, grounding pass). Reading list: both reviews, `spec.md`,
   `dry-run-<n>.md`, `as-eaten.md`, `edit-reasons.md`, `rulebook.md`, and every previous
   `decisions-*.md`. Output: `brief-<n>.md`, the numbered decision list.
4. **Debate** (`debater-simplicity.md`, `debater-coverage.md`). Six spawns in this order: simplicity
   exchange 1, coverage exchange 1, simplicity exchange 2, coverage exchange 2, simplicity exchange 3,
   coverage exchange 3. Both sides share one reading list: the round's two reviews, `brief-<n>.md`,
   `spec.md`, `dry-run-<n>.md`, `as-eaten.md`, `rulebook.md`. Exchange 1 is an independent opening and
   does not read the other side. Exchanges 2 and 3 additionally read the other side's previous
   exchange from `debate-<n>.md`. Each spawn appends its section to `debate-<n>.md` under a heading
   naming the side and the exchange, verbatim, before reporting.
5. **Decider, pass B** (`decider.md`, decision pass). Reading list: both reviews, `brief-<n>.md`,
   `debate-<n>.md`, `spec.md`, `as-eaten.md`, `edit-reasons.md`, `rulebook.md`. It amends `spec.md` in
   place, writing the measured reason into every changed clause, and writes `decisions-<n>.md`. Give
   it the mandate verbatim from `EVOLVING-THE-ENGINE.md` §4.5: prioritise what changes the household's
   hand edits; weigh a change by the recorded edits it removes; refuse minor optimisation; decide only
   from what the household did and said; "no change this round" is a legitimate outcome; park anything
   needing taste and proceed on the conservative option.

Then append this round's decisions to `CHANGES.md` (from
`.claude/evolve/templates/CHANGES.md`), commit, push, and go back to step 4 for the next round.

**Exit rule.** Three rounds, always. A fourth runs only if the round-three decider names an axis on
which round three's dry run moved away from the household relative to round two, and cites the
measurement. If it does, run a full fourth round and say so in the manifest.

### Step 6. The household round

Write the one page yourself, from `.claude/evolve/roles/household-brief.md`, into
`household-brief.md`. It carries: what changed across the rounds and why, per rule, each with its
measured reason; the parked taste decisions, each as one question with the conservative choice taken
so far and the alternative; and the final comparison between the last dry run and the food actually
eaten. Nothing else goes to Rajat.

Stop here and hand him the page. When his answers come back: write them into `spec.md` (the spec is
now final) and into `CHANGES.md`, log them in `DECISIONS.md` as his decisions, commit, push.

### Step 7. Build and gate

1. Spawn the plan author (`plan-author.md`). Reading list: the final `spec.md`, `CHANGES.md`, the four
   canonical docs, `CLAUDE.md`, the current `engine/` and `app/convex/`, and
   `archive/features/engine-v6-plan.md` as the shape reference. Output: `plan.md`.
2. Open the activation PR: the run folder, the plan row in `docs/PLAN.md`, the `CLAUDE.md` "Currently
   building" pointer, and the `DECISIONS.md` entries. Merge it to `main` on Rajat's word.
3. Create the integration branch off `origin/main` and spawn one engineer per unblocked stream with
   `/new-stream <branch> <stream-letter>`. Every stream PR targets the integration branch; nothing
   merges to `main` until the gate passes on the integrated engine.
4. Each gate fix cycle follows the spec's order of work, in this order: amend `spec.md` with the
   measured reason, then fix the owning stream, then re-run `npm run gate`. Never the other order.
5. At cutover, follow the plan's runbook with Rajat's per-action approval on every production action.
   Commit the gate report as `features/engine-<version>/gate-report.md`.
6. Spawn the differ one last time on the gate's dry run against `as-eaten.md`, in its clean-room
   format, as `final-comparison.md`. Same restriction: two menu files, nothing else.
7. Close the run: mark every manifest row done, finish `CHANGES.md`, append the CHANGELOG and
   DECISIONS entries, move the run folder under `archive/features/` at phase close (the gate report
   stays where it is, as the harness's living output), reset `CLAUDE.md`'s "Currently building" line,
   and remove the run worktree and branch.

## Branch naming for this command

- `evolve/engine-<version>` for the run itself (this brief is where the name is defined; the branch
  list in `docs/development.md` §2 is canonical for everything else and is reconciled separately).
- `feat/engine-<version>` for the integration branch at step 7.
- `feat/<stream-letter>-<version>-<short>` for each build stream, per `docs/development.md` §2.

## Usage limits, session death, and resuming

The run is designed to survive both.

- **A subagent dying with an API 429 naming a session limit and a reset time** is not a failure of the
  step. Parse the reset time from the error, add a safety margin (ten minutes is enough), write it to
  the row's `resume-at`, set the row `blocked` with the error text in `last-error`, commit, and push.
  Then schedule your own wakeup for that time and stop working. Two harness mechanisms do this:
  - **`CronCreate`** creates a timed wakeup at a clock time. This is the primary mechanism, because
    the reset time is known: create a one-shot schedule at the reset time plus a ten-minute margin.
  - **`ScheduleWakeup`** is the self-paced loop wakeup and the fallback when cron is unavailable. It
    is clamped to one hour per hop, so a reset further away than an hour is reached by chaining:
    each wakeup re-reads `RUN.md`, and if `resume-at` is still in the future it schedules the next
    hop rather than re-spawning the row.

  Whichever you use, the requirement is that the session comes back on its own without Rajat.

- **At wakeup**, re-read `RUN.md`, clear the `resume-at`, and re-spawn the blocked row from its brief.
- **If the session is gone entirely**, the next session runs `/evolve-engine resume`: read `RUN.md`
  from the branch, treat any row left `running` as not done, and restart from the first non-`done`
  row. Because every brief carries a fixed reading list and deterministic inputs, a re-run reproduces
  the artifact; overwrite the partial file rather than trying to repair it.
- **Never resume from memory.** If `RUN.md` and your recollection disagree, `RUN.md` is right.

## What to refuse

- **Writing anything to production** at any step before the cutover, including a "harmless" test
  generation. The run only reads production, at step 1 and again before the cutover's gate run.
- **Letting the rulebook author or the spec author see the current engine.** `docs/engine.md`,
  `engine/`, and every prior spec are forbidden to both, and the whole process is worthless if they
  read them. The same applies to the differ and the spec.
- **Stopping for Rajat before step 6.** Every question a round raises that the record can answer is
  answered by the decider. If you are tempted to ask him something, check first whether the record
  answers it; if it does, the decider decides it. The only exceptions are the per-action approvals
  that production access requires.
- **Skipping a round**, or skipping a round's dry run and reasoning about the effect instead. The
  round is the measurement.
- **An unmeasured amendment.** Every changed clause in `spec.md` names the measurement that forced it.
  A clause amended because it reads better does not go in.
- **Doing an agent's work yourself** because it would be quicker, or summarising an agent's artifact
  into the next agent's prompt instead of handing over the file.
- **Widening a threshold until the run passes.** Re-measure the household baseline by the harness's
  own method and set the band around that; if the threshold is arithmetically unsatisfiable, amend the
  spec first with the measured reason.
- **Running this at all for a single wrong rule.** That is `/slow-loop`. This command is for an engine
  whose shape is wrong.

## Why this command exists

The engine's rules describe a household's appetite, and only the household's own record describes it.
Left to itself, a session that edits the engine edits it toward the engine it already has: the author
of a spec cannot see what the spec does not anticipate, and a reviewer who has read the spec inherits
its blind spots. This process replaces the author's judgment with measurement, isolates every reviewer
from the thing it reviews, and hands Rajat only the questions the record genuinely cannot settle. Two
engines were reached this way, and one of them was falsified by its own dry run before it was built,
which is the whole point.
