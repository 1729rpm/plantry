# Retro pass, sitting 2026-09-07

Run inline by the EM (`.claude/skills/maintain/passes/retro.md`, `MAINTENANCE.md` §4.4).

## 1. Basis

- Status window: every `RETRO.md` entry whose `Status:` was `open`, `triaged`, or `fixed in part`,
  whatever its date. Six entries matched: 2026-08-18 "Two docs claimed a CI gate that was never
  built" (fixed in part), 2026-08-18 "A day of spec amendments and two ledger entries lived only in
  an uncommittable working tree" (open), 2026-08-18 "A design handoff landed at the repo root and
  outlived its feature there" (open), 2026-07-12 "Finalize-before-cooking makes weekArchive record
  the planned week, not the cooked one" (triaged), and two sub-entries of the 2026-09-07 "Phase 9
  build" block: "Docs claim CI checks that do not exist" (fixed on the doc side, CI step for Rajat)
  and "The plan's stream briefs contradicted each other on one ownership point" (triaged).
- Appended since the marker (2026-09-07): none before this pass; one entry appended by this pass
  (below).
- Deferred carried in (two, from `.maintenance-state`): the two 2026-08-18 open entries named above.

## 2. Clusters

1. **The spec-code parity claim** (2026-08-18 "Two docs claimed a CI gate", 2026-09-07 "Docs claim
   CI checks"). Root cause: a documented-but-nonexistent gate trusted indefinitely. Sizing: the doc
   half is process-doc and is closed by the docs pass this sitting (`docs/product.md` §4 Principle 3,
   the last document that overstated it, now says "held by review, not by a CI check"); the check
   itself is a merge-blocking CI gate, so it is Rajat's (D8 in the structure decisions, approved in
   principle, not built). Chosen level: process-doc done; ci-test surfaced to Rajat.
2. **EM edits stranded in the uncommittable main directory** (2026-08-18 "A day of spec
   amendments"). Sizing: the process half already exists in the two skills (commit after every pass
   or step; the docs-PR cadence of `docs/development.md` §11.4). The tooling half is right-sized as
   a brief line, not a script: the sitting's step 0 already refuses to start on a dirty main tree,
   and the hygiene pass now runs `git status` in the main directory too (check 8), so a stranded
   edit is caught at most one sitting later. Chosen level: brief-template.
3. **A design handoff outliving its feature at the root** (2026-08-18 "A design handoff landed at
   the repo root"). The root copy is gone (verified absent at this sitting); the process half is a
   canonical-doc edit, handed to the docs pass and landed in `docs/development.md` §3 step 8.
   Chosen level: process-doc, via the docs pass.
4. **Finalize semantics versus the archive** (2026-07-12 "Finalize-before-cooking"). Superseded:
   engine v6 reads the live `currentWeek` rows as the record and `weekArchive` is provenance read by
   nothing (`docs/engine.md` §2.1). Chosen level: no-change, closed as wont-fix with the reason.
5. **One owner per shared symbol** (2026-09-07 "The plan's stream briefs contradicted each other").
   Sizing: brief-template; `.claude/commands/new-stream.md` step 1 now says the Hotspot ledger row
   names one owner and the other stream imports or parameterises. Chosen level: brief-template.
6. **This sitting's own friction: the two-branch close-out gap** (new entry, appended by this pass).
   `/maintain` step 8 said to move the sitting's folder once, but the folder and the state file are
   split across two branches by step 3's design. Sizing: brief-template; SKILL.md step 8 now says
   each branch moves its own half and the docs branch starts from the slow-loop branch's state file.
   Not logged: the same-day branch-name reuse (`docs/maintenance-2026-09-07` was also PR #262's
   head today; a one-off of two sittings on one date) and a sed that touched an older changelog
   heading carrying the same placeholder (one-off, self-inflicted, corrected in the same branch).

## 3. The status table

| Entry | Old status | New status | Where the fix landed |
| --- | --- | --- | --- |
| 2026-08-18 Two docs claimed a CI gate that was never built | fixed in part (PR #233) | triaged (Rajat, D8) | `docs/product.md` §4 P3 (PR #272); the CI check is Rajat's call |
| 2026-08-18 Spec amendments lived only in an uncommittable working tree | open | fixed (PR #272) | commit-after-every-pass in both skills; hygiene check 8 runs `git status` in the main dir |
| 2026-08-18 A design handoff landed at the repo root | open | fixed (PR #272) | root copy gone; `docs/development.md` §3 step 8 (docs pass) |
| 2026-07-12 Finalize-before-cooking and weekArchive | triaged (PR #221) | wont-fix (superseded by engine v6) | `docs/engine.md` §2.1: the record is the live `currentWeek` rows |
| 2026-09-07 Docs claim CI checks that do not exist | fixed on the doc side | triaged (Rajat, D8) | as row 1 |
| 2026-09-07 Stream briefs contradicted on one ownership point | triaged | fixed (PR #272) | `.claude/commands/new-stream.md` step 1 |
| 2026-09-07 Two branches share one folder and one state file (new) | open | fixed (PR #272) | `.claude/skills/maintain/SKILL.md` step 8 |

## 4. Filed as streams

- `chore/maintain-queries` (to be spawned through `/new-stream` after this sitting closes): two
  read-only Convex query functions the next sitting needs, `queries/dishDislikes:listQueuedDislikes`
  (mirroring `listQueuedManualChanges` on the `by_status` index) and a `manualChanges` listing by
  `weekStart` range regardless of status (for the monitor's Saturday swap measure). Raised by the
  signals and health passes, not by a retro entry; named here because it is the stream-sized item
  the sitting produced.
- Not filed this sitting (recorded in `.maintenance-state` under health and docs): the gate
  preamble conditional in `engine/scripts/gate.ts`, a validator for an Active dish with 0 ingredient
  rows, persisting the exploration pick beside each `generatedPlan` entry (owned by engineering; the
  same shape as the open "persist the role" item in `DECISIONS.md`).

## 5. For Rajat

- **The spec-code parity CI check** (D8): approved in principle, not built. What it takes: one CI
  step that fails a PR touching `docs/engine.md` without a change under `engine/src/` and
  `engine/test/`. What it buys: the pairing stops depending on review alone. It is a merge-blocking
  gate, so it is yours to switch on.

## 6. Deferred

- None from the status window: every matched entry has a new status.
- No contended files.
