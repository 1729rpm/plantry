# Evolving the engine

Spec for the process that re-derives Plantry's meal-planning engine from what the household actually
ate. It is invoked as `/evolve-engine <version>`, it runs mostly unattended, and it ends with a new
engine on `main` plus the four artifacts §11 names. This document owns the process; `docs/engine.md`
owns the rules the process produces.

## 1. Purpose and lineage

The engine's rules cannot be reasoned out from first principles, because the thing they model is a
household's appetite and only the household's own record describes it. So the engine is rederived
rather than edited: the served weeks are pulled from production as they were eaten, a rulebook is
written from that food alone, an engine spec is drafted from the rulebook, a throwaway simulator
runs the spec forward for a long horizon, and the resulting menu is compared against the real one by
reviewers who have never seen the spec. What the comparison shows decides what the spec says next.
Engine v5 and engine v6 were both reached this way, and the process is written down because it
works: the v5 architecture was falsified by its own dry run before a line of it was built, and v6's
remaining defects were found by clean-room reviewers rather than by the engine's authors.

The process is expensive. It is the right instrument when the engine's shape is wrong, not when a
rule is wrong. A single rule that misfires belongs to the slow loop (`MAINTENANCE.md` §1); a chooser
that produces a menu the household would not eat belongs here.

## 2. The run at a glance

| Step | Name                | Who runs it                           | Output artifact                                                                                                        |
| ---- | ------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1    | The truth           | recorder agent                        | `record.json`, `as-eaten.md`, `edit-reasons.md`                                                                        |
| 2    | The rulebook        | rulebook-author agent                 | `rulebook.md`                                                                                                          |
| 3    | The simple engine   | spec-author agent                     | `spec.md`                                                                                                              |
| 4    | The dry run         | simulator agent                       | `sim/`, `dry-run-<n>.md`                                                                                               |
| 5    | The round (x3)      | differ, critic, two debaters, decider | `review-<n>-differ.md`, `review-<n>-critic.md`, `brief-<n>.md`, `debate-<n>.md`, `decisions-<n>.md`, amended `spec.md` |
| 6    | The household round | the EM, then Rajat                    | `household-brief.md`, final `spec.md`, `CHANGES.md`                                                                    |
| 7    | Build and gate      | plan-author agent, then engineers     | `plan.md`, `gate-report.md`, `final-comparison.md`, the engine on `main`                                               |

Steps 2 to 6 are each carried out by a fresh agent running on the highest-intelligence model the
harness offers, at the highest reasoning effort available, with the reading list its brief states and
no other input. The EM orchestrates, commits, and never does the judgment work itself. Rajat is asked
for exactly two things across a whole run: the parked taste decisions at step 6, and the per-action
approvals that production reads and writes require.

## 3. The clean-room rule

Every agent's brief states an exact reading list and an exact forbidden list, and the agent reads
nothing outside the first and nothing at all from the second. The rule exists because a reviewer who
has read the spec inherits its assumptions and then measures the menu against the spec's intent
rather than against the food. Three consequences are load-bearing:

- The rulebook author has never seen an engine. It may not read `docs/engine.md`, anything under
  `engine/`, or any prior engine spec, so the rules it writes describe the household and not the
  machine that has been feeding it.
- The spec author reads the rulebook and the record, never the engine that is running. A spec drafted
  by amending the current engine reproduces the current engine's blind spots.
- The differ reads two menu files and nothing else. Not the spec, not the simulator's own preamble,
  not the measurements the simulator reported about itself. A dry-run file's preamble is the author's
  account of its own work and is never evidence; every number in a comparison is counted from the raw
  menu text and re-verified before it is written down.

An agent that finds its reading list insufficient says so in its report and stops. It does not widen
its own inputs.

## 4. The seven steps

### 4.1 Step 1: the truth

A read-only pull of the served weeks from production, written as the record every later step measures
against. Nothing is written to production at this step or at any step before the cutover.

- The as-eaten state of each week is its live `currentWeek` slot state with every swap, hand
  addition, and deletion applied. `weekArchive` is provenance and is not the source: a finalized week
  the household kept editing is stale, and finalize drops custom one-offs.
- Skipped days are removed, not backfilled. A missing day is a fact about the household.
- Custom dishes are carried by their label and marked as custom, because a custom pick has no library
  id and therefore contributes no rows to any rate.
- The reasons the household typed while editing are pulled alongside the food. They are the only
  place the record says why, and half the rulebook's rules are quotations from them.
- The pull is a production read and needs Rajat's per-action approval. That approval is a permission
  grant, not a decision, and it is the one interruption the run carries before step 6.

Before the pull, any custom pick that has since been promoted to a library dish is re-pointed at its
library id, so the record does not split one dish across a label and an id.

The readable weeks file is the run's **Menu B** and never changes again during the run.

### 4.2 Step 2: the rulebook

A fresh agent whose reading list is Menu B and the edit reasons writes how this household decides its
meals. It states only rules that repeat; a thing that happened once or twice is excluded and said to
be excluded. Every frequency is stated per occasion, with the count it rests on. Missing days are
stated as normal.

The rulebook is a description of a household, not an instruction to a machine, and it is the document
the whole run is measured against. Its known failure mode, which the brief names, is stating a
frequency without stating how the household distributes it, because a planner reading "about once a
week" compiles it into "every Tuesday".

### 4.3 Step 3: the simple engine

A second fresh agent, reading the rulebook, Menu B, and the edit reasons, drafts an engine spec.

- It opens with a household model: a short list of instincts that explain the recorded hand edits. A
  proposed rule that serves none of them does not belong in the engine, and the spec says so.
- Every rule cites the observed behaviour that justifies it.
- It carries an explicit "deliberately absent" list, so a later reader cannot revive a mechanism by
  reference.
- It carries its own verification gate: the measurement method and the thresholds, each with the
  household baseline it was set against.

### 4.4 Step 4: the dry run

A throwaway simulator implements the spec exactly. Its mandate is the most literal implementable
reading of every clause, never a redesign; where a clause is ambiguous it takes the most literal
reading and records the choice in a numbered "known approximations against the spec" list, which is
the single most useful output the step produces, because an approximation that changes the menu is a
spec defect the round will otherwise blame on the mechanism.

The simulator self-feeds: each generated week is treated as eaten, unedited, and added to the record
that generates the next. It runs the horizon §7 sets, in the three runs §7 names, and writes:

- a readable ten-week menu in exactly Menu B's format, which is the run's **Menu A**; and
- the long-horizon measurements against every threshold in the spec's gate, each failure carrying a
  one-line diagnosis classified as mechanism, threshold arithmetic, content, or counting ambiguity.

The simulator source lives in the run folder at `<run>/sim/` and is committed with the run, so a dead
session can re-run the same numbers. It is not build code: lint and format ignore
`features/engine-*/sim/` by an eslint ignore entry and a `.prettierignore` line, and no CI check
touches it.

The dry run reads production data only through the step 1 export. It writes nothing anywhere but the
run folder.

### 4.5 Step 5: the round

The round runs three times. Each round starts from a fresh dry run of the spec as it currently
stands, and ends with the spec amended in place and the next dry run queued.

1. **The differ.** Menu A against Menu B as pure data. Inputs restricted to the two menu files.
   Findings are patterned differences ranked most systematic first, each carrying both menus' counts
   normalized to occasions actually present. It also reports what it checked and found the same, and
   what it deprioritized as too infrequent to call a pattern. From round two it additionally audits
   every previous finding as resolved, improved, persists, or worse, hunts regressions against the
   previous round's menu, spot-checks the numbers earlier rounds asserted, and separates warm-up
   artifacts from steady behaviours.
2. **The critic.** First principles, reading the dry run, the spec, the rulebook, and Menu B. It
   verifies every claim in the differ's report against the food before using it, then recommends
   amendments to how the engine operates: mechanism and architecture, never tuning. It is explicitly
   allowed to conclude that the architecture is wrong, which is the conclusion that ended v5. Where
   the defect is in the rulebook rather than the engine, it proposes the rulebook amendment instead,
   with the replacement text written out in full.
3. **The grounding pass.** The decider, in its first pass, collapses the two reviews into a numbered
   decision list: where the run is, what the reviews settled and must not be reopened, what is still
   open grouped by root cause rather than by symptom, and one numbered decision per open item with
   its question, its evidence, its options, and a recommendation. Items that need taste rather than
   evidence are marked as such. This list is the agenda the debate argues over; without a shared
   numbered agenda two debaters cannot converge or name what is irreducible.
4. **The debate.** Two agents with one shared reading list argue three exchanges. One argues for
   simplicity: the few changes that actually matter, against complexity, weighing each mechanism by
   the recorded hand edits it removes against the state and rules a reader of the spec must hold; a
   thing that happened twice in eight weeks is a tap, not a use case. The other argues for coverage:
   every recorded pattern handled properly, with the discipline that each mechanism it asks for must
   be one the engine already trusts, bounded by a demand it cannot exceed, and unable to feed itself.
   The first exchange is two independent openings; the second and third are rebuttals. The third
   ends with final verdicts, what was resolved, and the irreducible items, each carrying its crux,
   whether it is taste or evidence, the measurement that would settle it, and the exact question to
   put to the household.
5. **The decider.** The household's proxy, and the job the process exists to delegate. It reads both
   reviews, the grounding list, and the debate, and it decides. Its mandate:
   - prioritise what changes the household's hand edits;
   - weigh a change by the recorded edits it removes, not by how interesting it is;
   - refuse minor optimisation;
   - decide only from what the household did and what it said while doing it;
   - treat "no change this round" as a legitimate outcome;
   - park anything that needs taste rather than evidence for the household's round, and proceed on
     the conservative option meanwhile.

   It then amends the spec in place, writing the measured reason into every changed clause, and
   records the decisions, the parked items, and what the next dry run must measure.

Step 4 then re-runs on the amended spec and the next round begins.

### 4.6 Step 6: the household round

After the third round the EM writes one page and stops. The page carries what changed across the
rounds and why, per rule, each with its measured reason; the parked taste decisions, each as a single
question with the conservative choice taken so far and the alternative; and the final comparison
between the last dry run and the food actually eaten. Rajat decides the parked items only. Nothing
else is put to him: every item the record could settle has already been settled.

His answers go into the spec and into the change document, and the spec is final.

### 4.7 Step 7: build and gate

A development plan is written in the shape the last one took: outcome, scope with an explicit "not to
be smuggled in" list, an integration branch, a stream table with each stream's exact file lanes and
dependencies, the contract every stream builds against, a brief-ready section per stream, a hotspot
ledger with merge order, the verification gate as the merge condition, and a cutover runbook.

Engineers build in parallel through `/new-stream`, each in its own worktree, every stream PR
targeting the integration branch. Nothing merges to `main` until the gate passes on the integrated
engine.

The gate harness lives in the repository as `npm run gate` and replaces the throwaway simulator at
this point: the simulator was a reading of the spec, the harness runs the built engine. A failing
threshold follows the same rule the rounds followed, in this order: amend the spec with the measured
reason, then fix the owning stream, then re-run. A threshold that proves arithmetically unsatisfiable
is amended in the spec first, with the amendment naming the measurement that showed it.

Cutover follows the plan's runbook, with Rajat's per-action approval on every production action.

## 5. The roles

Every role brief lives under `.claude/evolve/roles/` and is written to be reusable across versions:
it carries placeholders for the version and the run folder and no facts about any particular run.
Each brief states its mandate, its exact and exclusive reading list, its forbidden inputs, its output
artifact and that artifact's required sections, the measured-reason rule, and its report format.

| Role                | Brief                   | Reads                                                                                                                                  | Must not read                                          | Writes                                                        |
| ------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------- |
| recorder            | `recorder.md`           | Production `currentWeek` and `manualChanges`, read-only                                                                                | Nothing is forbidden; nothing is written               | `record.json`, `as-eaten.md`, `edit-reasons.md`               |
| rulebook author     | `rulebook-author.md`    | `as-eaten.md`, `edit-reasons.md`                                                                                                       | `docs/engine.md`, `engine/`, any engine spec, `data/`  | `rulebook.md`                                                 |
| spec author         | `spec-author.md`        | `rulebook.md`, `as-eaten.md`, `edit-reasons.md`                                                                                        | `docs/engine.md`, `engine/`, any prior spec or dry run | `spec.md`                                                     |
| simulator           | `simulator.md`          | `spec.md`, `record.json`, the dish library under `data/`                                                                               | The reviews, the rulebook's commentary, prior dry runs | `sim/`, `dry-run-<n>.md`                                      |
| differ              | `differ.md`             | The two menu files (round two onward: the previous menu and the previous rounds' reports)                                              | The spec, the dry run's preamble and measurements      | `review-<n>-differ.md`                                        |
| critic              | `critic.md`             | `dry-run-<n>.md`, `spec.md`, `rulebook.md`, `as-eaten.md`, `review-<n>-differ.md`                                                      | `docs/engine.md`, `engine/`, prior engine specs        | `review-<n>-critic.md`                                        |
| debater, simplicity | `debater-simplicity.md` | The round's two reviews, `brief-<n>.md`, `spec.md`, `dry-run-<n>.md`, `as-eaten.md`, `rulebook.md`, the other side's previous exchange | Anything outside that list                             | a section of `debate-<n>.md`                                  |
| debater, coverage   | `debater-coverage.md`   | The same list                                                                                                                          | Anything outside that list                             | a section of `debate-<n>.md`                                  |
| decider             | `decider.md`            | Pass A: the round's two reviews and the run's own artifacts. Pass B: those plus `brief-<n>.md` and `debate-<n>.md`                     | `docs/engine.md`, `engine/`                            | `brief-<n>.md`, then amended `spec.md` and `decisions-<n>.md` |
| household brief     | `household-brief.md`    | `CHANGES.md` in progress, every `decisions-<n>.md`, the last differ report                                                             | Nothing further is needed                              | `household-brief.md`                                          |
| plan author         | `plan-author.md`        | Final `spec.md`, `CHANGES.md`, the repo's canonical docs and current code                                                              | Nothing is forbidden                                   | `plan.md`                                                     |

## 6. The round loop and its exit rule

Three rounds. The loop does not stop early because a round looked clean, and it does not run a fourth
because a reviewer is still unhappy.

- **No change is a valid round.** A round whose decider takes no amendment is complete and counts.
  Its value is the measurement: an unchanged spec that survives a fresh dry run and a clean-room
  comparison is evidence, not a wasted round.
- **A fourth round runs only if the decider finds that round three's dry run regressed**, that is, an
  axis on which round three moved away from the household relative to round two. The decider states
  the regression and the measurement that shows it; a reviewer's opinion is not sufficient. If a
  fourth round runs, it is a full round with all five roles.
- **A round is never skipped**, and neither is its dry run. Amending the spec and reasoning about the
  effect is not a round; the round is the measurement.
- Every round starts from a dry run of the current spec. A review of a previous round's menu against
  a spec that has since changed measures nothing.

## 7. Measurement rules

These bind the simulator, the reviewers, and the gate harness alike.

1. **Long horizon.** The simulation runs 60 weeks self-feeding from the current record, and every
   threshold is measured on weeks 20 to 60. The early weeks are dominated by the starting conditions;
   the steady state is what the mechanism does on its own. A ten-week read is written for a human to
   read as a menu, never as a gate: the two windows disagree, and the shorter one flatters exactly
   the families the self-feed later pushes out of band.
2. **Three runs.** Frozen rates, held at the cutover record, measure the engine's own bias; a family
   that fails here needs an engine fix. Self-feeding, the production path, measures drift; a family
   that passes frozen and fails self-feeding is the ratchet, not bias. Corrected replays the record's
   own swap-aways against the generated weeks so the reconciliation path executes at least once.
3. **Rates per occasion, never per week.** The household does not eat every planned day. A per-week
   rate overstates every family by the ratio of planned days to served days, and the effect is the
   size of the errors the measurement exists to find. Served rate per occasion is compared against
   eaten rate per occasion, in every direction.
4. **Per-family fidelity.** Each tracked family's served rate sits within a stated band of its record
   rate. A family with fewer than four rows in the record is reported, not gated: a percentage bar on
   two rows is half a serving over the horizon, which no schedule can meaningfully meet or miss.
5. **The household baseline is re-measured by the harness's own method** on the record weeks before
   any band is set around it. A baseline quoted from an earlier document and not reproduced is not a
   baseline. Bands are set around the measured number, never widened until the current run passes.
6. **Drift is measured against counting noise, not a fixed percentage.** A family's rate over the
   back half of the horizon is compared with its rate over the front half, and the bound is the
   families' own counting noise at that sample size. A fixed percentage smaller than the noise
   measures the noise.
7. **Determinism is checked, not assumed.** Two full runs of the same horizon produce byte-identical
   output, and the check is reported.
8. **Satisfiability before tuning.** A threshold that cannot be met at all given the pool and the
   record is amended in the spec first, with the measured reason, and the amendment says whether the
   fix is a threshold, a mechanism, or a content task.
9. **Warm-up versus steady is classified, not asserted.** Every divergence a round reports is labelled
   as one or the other, with the arithmetic behind the label, so the next round knows what should
   have self-corrected.
10. **Every count is re-verified from the raw text.** A number carried forward from a previous report
    or from a dry run's own preamble is spot-checked before it is used, and disagreements are
    reported with both figures.

## 8. The run folder and its artifacts

The run folder is created at step 1 as `features/engine-<version>/` and holds the whole run. Artifact
names are fixed, so a resuming session can find every input by name without reading the prose.

```
features/engine-<version>/
  RUN.md                    the manifest (§9)
  record.json               step 1, the raw read-only production export
  as-eaten.md               step 1, Menu B, the readable served weeks
  edit-reasons.md           step 1, every recorded hand edit and its stated reason
  rulebook.md               step 2, how this household decides its meals
  spec.md                   step 3, amended in place by the decider each round
  sim/                      step 4, the throwaway simulator source, committed, unlinted
  dry-run-<n>.md            step 4, round n's Menu A and its long-horizon measurements
  review-<n>-differ.md      step 5, the clean-room comparison
  review-<n>-critic.md      step 5, the first-principles review
  brief-<n>.md              step 5, the numbered decision list the debate argues
  debate-<n>.md             step 5, both debaters, three exchanges, in order
  decisions-<n>.md          step 5, what the decider decided, parked, and left alone
  household-brief.md        step 6, the one page for Rajat
  CHANGES.md                the change document (§11)
  plan.md                   step 7, the development plan
  gate-report.md            step 7, the committed output of `npm run gate`
  final-comparison.md       step 7, the differ's comparison of the gate's dry run against Menu B
```

`<n>` is the round number, 1 to 3, and the dry run a round reviews carries that round's number.

The folder is committed to the branch `evolve/engine-<version>` and pushed after every completed
step. The gate report stays in the folder as the harness's living output after the run closes; the
rest of the folder is archived with the phase.

## 9. The manifest and the resume protocol

`RUN.md` is the run's state. It is human-readable and machine-parseable: a pipe table with fixed
columns in a fixed order, one row per agent run, and prose only outside the table.

| Column       | Meaning                                                          |
| ------------ | ---------------------------------------------------------------- |
| `step`       | `1` to `7`                                                       |
| `round`      | the round number, or `-` outside step 5                          |
| `role`       | the role brief's name, plus an exchange suffix inside the debate |
| `status`     | `pending`, `running`, `done`, or `blocked`                       |
| `artifact`   | the path the row writes, relative to the run folder              |
| `started`    | ISO timestamp, or `-`                                            |
| `finished`   | ISO timestamp, or `-`                                            |
| `last-error` | the last failure's one-line summary, or `-`                      |
| `resume-at`  | ISO timestamp at which a `blocked` row may be retried, or `-`    |

The template is `.claude/evolve/templates/RUN.md`.

**The protocol.**

1. Every agent writes its artifact to the run folder **before** it reports. An artifact that exists
   without a `done` row is a partial write and is discarded on resume.
2. The EM sets a row to `running` before spawning, and to `done` only after reading the artifact and
   confirming it carries its required sections.
3. After every completed step the EM commits the run folder and pushes it. A dead session therefore
   loses at most the step in progress, and that step is re-run from its brief.
4. Agent briefs are written so a re-run from scratch reproduces the artifact: deterministic inputs,
   fixed reading lists, no dependence on conversation state.
5. **On a usage-limit error** (a subagent dying with an API 429 naming a session limit and a reset
   time), the EM parses the reset time, adds a safety margin, writes it to `resume-at`, sets the row
   `blocked` with the error in `last-error`, commits, and pushes. It then schedules its own wakeup
   for that time and stops working. Two harness mechanisms serve this: a self-paced loop that wakes
   the session on its own cadence, and a timed wakeup created for a specific clock time. Either is
   acceptable; the timed one is the better fit for a known reset time, and the intent is what
   matters: the session must come back by itself without Rajat.
6. **At wakeup** the EM re-reads `RUN.md` and resumes from the first row that is not `done`, clearing
   its `resume-at`.
7. **If the session itself is gone**, the next session invoked as `/evolve-engine resume` reads
   `RUN.md` from the branch and continues from the first non-`done` row. A row left `running` by a
   dead session is treated as not done and re-run from scratch.
8. The manifest is the only state. Nothing about the run's progress lives in a session's memory, in a
   scratchpad, or in an unpushed commit.

## 10. Who does what

**The EM** orchestrates and nothing else. It creates the run folder and the branch, spawns each agent
with its brief and its reading list, checks each artifact against its required sections before
marking the row done, commits and pushes after each step, handles the usage limit and the wakeup,
writes the one page at step 6, and hands the plan to `/new-stream` at step 7. It does not write the
rulebook, the spec, the reviews, the debate, or the decisions, and it does not amend the spec: those
are the delegated judgment the process exists for.

**The agents** do the work. Each is fresh, each has an exact reading list, and each writes one
artifact.

**Rajat** answers the parked taste questions at step 6 and grants the per-action approvals that
production reads and writes require. He is not asked to arbitrate between reviewers, to choose
between mechanisms the record can distinguish, or to approve a round.

## 11. The final outputs

A run produces exactly four things, named and placed.

1. **The engine on `main`**, merged as one revertable integration unit after its gate passes.
2. **The change document**, `features/engine-<version>/CHANGES.md`: what changed and why, per rule,
   each with its measured reason, across all three rounds; plus the parked decisions and how Rajat
   settled them. It is written incrementally from each round's `decisions-<n>.md` and finished at
   step 6. The template is `.claude/evolve/templates/CHANGES.md`.
3. **A dry run of the final engine on the real record**, the output of `npm run gate` against a fresh
   production export, committed as `features/engine-<version>/gate-report.md`.
4. **The comparison report** between that dry run and the food actually eaten, produced by the differ
   role in its clean-room format, as `features/engine-<version>/final-comparison.md`.

The ledger entries that record the run (`docs/CHANGELOG.md`, `DECISIONS.md`, `RETRO.md`,
`data/changelog.md`) are written by the EM as the run's steps land, not by any agent.

## 12. Anti-patterns

Each of these has cost a cycle.

- **Building before a dry run.** An engine whose first long-horizon measurement happens after it is
  built cannot be falsified cheaply. A spec that passes review and fails its first simulation has
  cost one review; a spec that passes review and fails after five streams have built it has cost a
  phase.
- **A windowed record.** A rolling window of recent weeks fills with the engine's own output and
  flushes the household from its own signal. The record is cumulative and only grows.
- **Per-week rates.** The household skips days. Dividing by planned weeks rather than served
  occasions overstates every family by the skip rate, which is the same size as the errors being
  hunted.
- **A reviewer that has read the spec it is reviewing.** It measures the menu against the intent
  rather than against the food, and it stops finding the differences the intent did not anticipate.
- **A rule that serves no household instinct.** The spec's household model exists so that a proposed
  rule can be refused for serving none of them. A rule that serves the gate instead of the household
  is the same defect wearing a number.
- **A change without a measured reason.** Every amended clause names the measurement that forced it.
  A clause amended because it read better is unfalsifiable and survives forever.
- **Treating the fixture as the record.** A fixture is a snapshot taken to make a harness runnable.
  Thresholds calibrated on it are calibrated on a sample, and they are re-based on the real record
  before the engine ships.
- **A decider that tunes instead of deciding.** Widening a band until the run passes, adding a
  per-family exception, or accepting a mechanism because a reviewer asked twice. The decider's
  question is what the household's hand edits would change, and "no change this round" answers it as
  often as a mechanism does.
- **A ten-week read taken as steady state.** It disagrees with the long horizon, and it disagrees
  flatteringly.
- **An agent that reports without writing its artifact.** The report is lost when the session dies;
  the artifact is not.
- **Reviving something on the deliberately-absent list by reference.** That list exists because each
  entry was removed on evidence, and a later section that reaches for it silently undoes the removal.
