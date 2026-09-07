# Review: the structure of the maintenance skill

A review, written 2026-09-07 by the EM session, of what the second skill should be now that
`/evolve-engine` owns engine evolution. It is grounded in `MAINTENANCE.md` as it stands after the
2026-09-07 operational reconcile, `.claude/commands/slow-loop.md`, `.claude/commands/reconcile-docs.md`,
`.claude/commands/reconcile-ops.md`, the `slow-loop-applied` GitHub Action, and the two state files.
It recommends; it changes nothing. The next session builds from it.

## 1. What the maintenance machinery is today

Four jobs live in `MAINTENANCE.md`, run by three commands, one GitHub Action, and two state files.

| Job                            | Spec                        | Command           | State marker                  | Trigger today                               |
| ------------------------------ | --------------------------- | ----------------- | ----------------------------- | ------------------------------------------- |
| The slow loop                  | `MAINTENANCE.md` §1, §3, §5 | `/slow-loop`      | `last_slow_loop` (2026-07-14) | Rajat, Sunday by convention                 |
| Canonical-doc reconciliation   | §2                          | `/reconcile-docs` | `last_reconcile`              | after a phase or a run of CHANGELOG entries |
| Process retro intake           | §6                          | none (EM by hand) | `.retro-state`                | alongside a reconcile sitting               |
| Operational-doc reconciliation | §7                          | `/reconcile-ops`  | `last_reconcile_ops`          | alongside `/reconcile-docs`                 |

Two facts stand out from the grounding.

**The slow loop is two jobs wearing one name.** Its reactive half reads the household's queued
signals (`manualChanges`, `dishDislikes`, open `incidents`), clusters them, and right-sizes a fix
across six levels: data row, new tag, rule wording, engine code, UI affordance, infrastructure.
Three of those six levels (rule wording, engine code, and a new tag the engine must learn to read)
are engine evolution in miniature: they edit `docs/engine.md`, the engine module, and the tests,
and they run the gate. Its proactive half reads the library reports and, since this sitting, the
monthly engine monitor (§1.9), which measures the live engine against the record and is explicitly
"reported, never gated". So the slow loop already contains the seed of the split Rajat wants: it
maintains data and content, and it separately measures the engine's health, and until now it was
also allowed to change the engine.

**The two reconciles and the retro intake are one job with three lanes.** All three read the same
input window (`docs/CHANGELOG.md` since a marker, or `RETRO.md` since a marker), apply the same
style rules (§2.6, §2.7), run the same mechanical repository-structure check (§2.9), open one PR
each, and bump a marker. They differ only in which files they may touch: `docs/*` for canonical,
the root docs and command briefs for operational, the process docs and briefs for retro. They were
separated for ownership reasons, and the separation is worth keeping as lanes inside one pass, not
as three commands with three markers. This sitting ran all three back to back and each flagged
items for the other two, which is the cost of the split.

## 2. The boundary between the two skills

The line that keeps the skills separate is not "engine versus everything else"; it is "how the
engine operates versus what it operates on". Stated as a rule the maintenance skill can apply:

- **Maintenance changes what the engine reads.** Dish files, tags the engine already reads, the
  ingredient catalog, activation, the promotion of custom dishes, the household record's repairs
  (a re-pointed custom pick), the docs that describe the shipped state, the briefs, the repository
  layout, the state markers, the dev deployment's residue.
- **Evolution changes how the engine operates.** Any clause of `docs/engine.md` that states a rule,
  a threshold, a pool definition, a scope, or a mechanism; any engine module edit that changes a
  menu; any new tag or field the engine must learn to read. These go through `/evolve-engine`,
  which is the only path that measures a change over a long horizon against the household before
  it ships.
- **One exception, named so it is not argued each time: a defect is not evolution.** When the
  engine disagrees with its own spec (a test proves the code does not do what `docs/engine.md`
  says), maintenance fixes the code with a failing-then-passing test and re-runs `npm run gate`,
  because the spec did not change. When the spec itself needs to change, it is evolution, however
  small.

With the boundary stated, the slow loop's fix ladder loses three rungs. What it gains is an
**evolution request**: a maintenance run that finds a pattern only an engine change could serve
writes it down with its evidence (the signal rows, the monitor line, the dates) in a small ledger
that the next `/evolve-engine` run reads at step 1 beside the record. The record shows what the
household ate; the ledger shows what the maintenance loop saw that the record alone may not
express (a recurring incident, a skip pattern, a dislike that repeated). That is the only
information that flows from one skill to the other, and it flows in one direction.

## 3. Recommendation: one skill, `/maintain`, with five passes

Replace the three commands and the by-hand retro with one command whose argument selects a pass
or runs all of them in order. Each pass keeps the lane and the discipline of the job it absorbs.

| Pass        | Absorbs                                                | Reads                                                                                                 | Writes                                                                                                        | PR                                      |
| ----------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| 1 `signals` | The slow loop's reactive half                          | queued `manualChanges`, `dishDislikes`, open `incidents`, the reports                                 | `data/dishes/*`, `data/ingredients.md`, `data/changelog.md`, the evolution-request ledger                     | `slow-loop/<date>` (Rajat reviews data) |
| 2 `health`  | The slow loop's proactive half and §1.9                | `npm run reports`; the prod record export; `npm run gate` on it                                       | the monitor table in the PR body; the ledger when a drift persists two monitors running; nothing else         | none, or folded into pass 1's PR body   |
| 3 `docs`    | `/reconcile-docs` and `/reconcile-ops`                 | `docs/CHANGELOG.md` since the marker; the canonical docs; the ops layer                               | `docs/*` in one commit group, root docs and briefs in another                                                 | `docs/maintenance-<date>`               |
| 4 `retro`   | §6                                                     | `RETRO.md` since the marker                                                                           | status lines in place; brief-template lines; `chore/*` follow-ups                                             | inside pass 3's PR, or its own          |
| 5 `hygiene` | The repository-structure check, plus what no job owned | `git worktree list`, `git branch -r`, the dev deployment's tables, the root inventory, the state file | a report in the PR body; deletions only of branches whose PR merged; a list for Rajat of anything destructive | inside pass 3's PR                      |

Why five and not the current three plus two by-hand jobs:

- **`signals` and `health` are separated** because one consumes rows and writes data and the other
  measures and writes nothing. Keeping the monitor inside the reactive loop is how a measurement
  turns into a tweak: the run that sees a family drifting is tempted to fix it in the same PR. The
  health pass has no fix ladder at all; its only two outputs are the table and, when a drift has
  persisted across two monitors, an evolution request. That is the mechanism that decides when
  `/evolve-engine` is worth running, and it should not be able to change the engine itself.
- **`docs` merges the two reconciles** because they share every step but the file list; the lanes
  survive as two commit groups inside one PR, and the two markers collapse into one. The cross-lane
  flags each pass raised for the other this sitting disappear, because one pass now owns both.
- **`retro` stops being by-hand.** It is the only job in `MAINTENANCE.md` with no command, which is
  why its marker lagged the others by weeks. As a pass it runs whenever `docs` runs.
- **`hygiene` is new as a named pass** because every item in it was done this sitting by the EM on
  instinct: seven merged branches left on the remote, a prototype worktree kept for months, retired
  tables on the dev deployment, an untracked report file that Prettier would have reddened. None of
  it was in any brief. A pass that lists and (for the safe cases) clears it is cheap, and its
  report is where the destructive items are put to Rajat.

The order matters and is fixed: `signals` before `docs`, because the docs pass reconciles shipped
state and a data PR of the same run is not shipped until merged; `health` beside `signals`, since
they share the record pull; `retro` and `hygiene` with `docs`. A run therefore produces at most two
PRs, one for data (Rajat's personal review, as today) and one for docs and process (the EM merges,
as today). An empty pass writes one line and bumps its marker; an empty run is healthy.

## 4. What changes in each existing artifact

- **`MAINTENANCE.md`** becomes the spec of `/maintain`, in the shape `EVOLVING-THE-ENGINE.md` now
  has: purpose and the boundary (§2 above, stated once and cross-referenced from the sibling doc),
  the five passes each with inputs, what the pass does, output, and anti-patterns, the evolution
  request ledger and its format, the state file, the mark-applied action contract (§3 today,
  unchanged), and a short section on what maintenance refuses. The slow loop's §1.4 fix ladder is
  rewritten to four levels (data row, existing tag, defect fix, evolution request), and §1.7's
  right-size table loses the rows that end in a rule edit or a `low_spice` tag the engine would
  have to learn. §1.9 moves whole into the health pass. §2, §6, §7 fold into the docs, retro, and
  hygiene passes; §2.6, §2.7, §2.9 stay as they are, referenced by every pass.
- **`.claude/commands/maintain.md`** replaces `slow-loop.md`, `reconcile-docs.md`, and
  `reconcile-ops.md`. Arguments: a pass name, `all` (the default), `since:<date>`, `dry-run`,
  `--fixture <path>` for the signals pass. The pass procedures move to `.claude/maintain/passes/`
  as one brief each, in the shape `.claude/evolve/roles/` uses, so each can be spawned as its own
  agent with an exclusive reading list. The three retired command files are deleted, and
  `CLAUDE.md`'s commands list names two commands: `/evolve-engine` and `/maintain`
  (`/new-stream` stays as the EM's spawning tool, not a job).
- **`.maintenance-state` and `.retro-state`** merge into one `.maintenance-state` with five
  markers (`last_signals`, `last_health`, `last_docs`, `last_retro`, `last_hygiene`), so `git log`
  on one file shows every run.
- **`EVOLVING-THE-ENGINE.md`** gains two sentences: step 1's recorder also reads the evolution
  request ledger, and §1's "the right instrument" paragraph points at `/maintain` for everything
  that is not the engine's shape.
- **The evolution request ledger** is a new append-only file, `features/engine-requests.md`,
  one entry per request: date, the pass that raised it, the pattern in one sentence, the evidence
  (row ids, monitor lines, dates), and what the maintenance run did meanwhile (the conservative
  data-level action, or nothing). `/evolve-engine` archives it into the run folder at step 1 and
  starts a fresh one at cutover.
- **`slow-loop-applied.yml`** is unchanged; the signals pass keeps the PR-body fence contract it
  posts back through.
- **`docs/development.md` §6** (the slow-loop trigger) and **`docs/engineering.md` §14** describe
  the command and the folder; both are canonical and go through the docs pass of the first
  `/maintain` run, not through the build PR.

## 5. What this review deliberately leaves alone

- **`ADDING-DISHES.md`** stays a playbook, not a pass. Authoring a dish is content work Rajat
  reviews personally; the signals pass may propose a promotion and open the batch through the
  playbook, but the playbook is not a job that runs on a marker.
- **The weekly generation** stays a hand-triggered production action outside both skills, until
  Rajat asks for a scheduler.
- **The custom-dish SessionStart hook** (local EM tooling) stays; the signals pass consumes what it
  surfaces.
- **The gate thresholds 2 and 5** stay as Rajat left them; the health pass reports them each run
  without a fix ladder to reach for.

## 6. The decisions the next session should confirm before building

1. One command with passes, or two commands (`/maintain` for signals and health, `/reconcile` for
   docs, retro, hygiene)? The review recommends one: the boundary with `/evolve-engine` is the
   important line, and a second split inside maintenance recreates the marker drift this sitting
   found.
2. Does the health pass write anything at all when a drift persists, or only raise the request?
   The review recommends request only; the conservative data-level action belongs to the signals
   pass, which has the diagnosis card.
3. Is the defect exception too wide? The test that proves "the code disagrees with the spec" is
   the safeguard; a fix without such a test is evolution by another name and is refused.
4. Should the signals pass keep the six-level diagnosis card wording in `docs/development.md` §5
   (it names rule edit and engine code as candidate levels)? The card is used by every PR in the
   repo, not only maintenance, so the review recommends keeping it and adding one line: inside
   `/maintain`, those two levels resolve to an evolution request.
