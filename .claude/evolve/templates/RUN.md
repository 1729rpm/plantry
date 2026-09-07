# Run manifest: engine {{VERSION}}

The state of this engine-evolution run. Copy this file to `features/engine-{{VERSION}}/RUN.md` at step
0, fill the header, and lay out every row as `pending`. The process is specified in
`EVOLVING-THE-ENGINE.md`; the procedure that maintains this file is `.claude/commands/evolve-engine.md`.

**This table is the run's only state.** A resuming session reads it and continues from the first row
that is not `done`. Nothing about the run's progress lives in a session's memory, in a scratchpad, or
in an unpushed commit. If the table and a recollection disagree, the table is right.

## Header

| Field          | Value                                                    |
| -------------- | -------------------------------------------------------- |
| Version        | `{{VERSION}}`                                            |
| Run folder     | `features/engine-{{VERSION}}/`                           |
| Branch         | `evolve/engine-{{VERSION}}`                              |
| Worktree       | `../plantry-evolve-{{VERSION}}`                          |
| Agent model    | (the highest-intelligence model available at spawn time) |
| Agent effort   | (the highest reasoning effort available at spawn time)   |
| Started        | (ISO date)                                               |
| Rounds planned | 3                                                        |

## Rows

Fixed columns, fixed order. `-` means empty, never blank. Status is one of `pending`, `running`,
`done`, `blocked`. A row left `running` by a dead session is treated as not done and re-run from
scratch: every brief has a fixed reading list and deterministic inputs, so a re-run reproduces the
artifact. Overwrite a partial artifact; never repair one.

| step | round | role                   | status  | artifact             | started | finished | last-error | resume-at |
| ---- | ----- | ---------------------- | ------- | -------------------- | ------- | -------- | ---------- | --------- |
| 1    | -     | EM (ledger snapshot)   | pending | engine-requests.md   | -       | -        | -          | -         |
| 1    | -     | recorder               | pending | record.json          | -       | -        | -          | -         |
| 1    | -     | recorder               | pending | as-eaten.md          | -       | -        | -          | -         |
| 1    | -     | recorder               | pending | edit-reasons.md      | -       | -        | -          | -         |
| 2    | -     | rulebook-author        | pending | rulebook.md          | -       | -        | -          | -         |
| 3    | -     | spec-author            | pending | spec.md              | -       | -        | -          | -         |
| 4    | 1     | simulator              | pending | dry-run-1.md         | -       | -        | -          | -         |
| 5    | 1     | differ                 | pending | review-1-differ.md   | -       | -        | -          | -         |
| 5    | 1     | critic                 | pending | review-1-critic.md   | -       | -        | -          | -         |
| 5    | 1     | decider-pass-a         | pending | brief-1.md           | -       | -        | -          | -         |
| 5    | 1     | debater-simplicity-x1  | pending | debate-1.md          | -       | -        | -          | -         |
| 5    | 1     | debater-coverage-x1    | pending | debate-1.md          | -       | -        | -          | -         |
| 5    | 1     | debater-simplicity-x2  | pending | debate-1.md          | -       | -        | -          | -         |
| 5    | 1     | debater-coverage-x2    | pending | debate-1.md          | -       | -        | -          | -         |
| 5    | 1     | debater-simplicity-x3  | pending | debate-1.md          | -       | -        | -          | -         |
| 5    | 1     | debater-coverage-x3    | pending | debate-1.md          | -       | -        | -          | -         |
| 5    | 1     | decider-pass-b         | pending | decisions-1.md       | -       | -        | -          | -         |
| 4    | 2     | simulator              | pending | dry-run-2.md         | -       | -        | -          | -         |
| 5    | 2     | differ                 | pending | review-2-differ.md   | -       | -        | -          | -         |
| 5    | 2     | critic                 | pending | review-2-critic.md   | -       | -        | -          | -         |
| 5    | 2     | decider-pass-a         | pending | brief-2.md           | -       | -        | -          | -         |
| 5    | 2     | debater-simplicity-x1  | pending | debate-2.md          | -       | -        | -          | -         |
| 5    | 2     | debater-coverage-x1    | pending | debate-2.md          | -       | -        | -          | -         |
| 5    | 2     | debater-simplicity-x2  | pending | debate-2.md          | -       | -        | -          | -         |
| 5    | 2     | debater-coverage-x2    | pending | debate-2.md          | -       | -        | -          | -         |
| 5    | 2     | debater-simplicity-x3  | pending | debate-2.md          | -       | -        | -          | -         |
| 5    | 2     | debater-coverage-x3    | pending | debate-2.md          | -       | -        | -          | -         |
| 5    | 2     | decider-pass-b         | pending | decisions-2.md       | -       | -        | -          | -         |
| 4    | 3     | simulator              | pending | dry-run-3.md         | -       | -        | -          | -         |
| 5    | 3     | differ                 | pending | review-3-differ.md   | -       | -        | -          | -         |
| 5    | 3     | critic                 | pending | review-3-critic.md   | -       | -        | -          | -         |
| 5    | 3     | decider-pass-a         | pending | brief-3.md           | -       | -        | -          | -         |
| 5    | 3     | debater-simplicity-x1  | pending | debate-3.md          | -       | -        | -          | -         |
| 5    | 3     | debater-coverage-x1    | pending | debate-3.md          | -       | -        | -          | -         |
| 5    | 3     | debater-simplicity-x2  | pending | debate-3.md          | -       | -        | -          | -         |
| 5    | 3     | debater-coverage-x2    | pending | debate-3.md          | -       | -        | -          | -         |
| 5    | 3     | debater-simplicity-x3  | pending | debate-3.md          | -       | -        | -          | -         |
| 5    | 3     | debater-coverage-x3    | pending | debate-3.md          | -       | -        | -          | -         |
| 5    | 3     | decider-pass-b         | pending | decisions-3.md       | -       | -        | -          | -         |
| 6    | -     | household-brief (EM)   | pending | household-brief.md   | -       | -        | -          | -         |
| 6    | -     | household answers (EM) | pending | spec.md, CHANGES.md  | -       | -        | -          | -         |
| 7    | -     | plan-author            | pending | plan.md              | -       | -        | -          | -         |
| 7    | -     | build (streams)        | pending | the engine on `main` | -       | -        | -          | -         |
| 7    | -     | gate                   | pending | gate-report.md       | -       | -        | -          | -         |
| 7    | -     | differ (final)         | pending | final-comparison.md  | -       | -        | -          | -         |

A fourth round is added only when the round-three decider names an axis on which round three regressed
against round two and cites the measurement. When one is added, append its rows in the same shape and
say in the notes below why it exists.

## Notes

Free prose. The table is authoritative; this is commentary. Record here: the model each row was
spawned on if it differed from the header, any artifact rewritten after a re-run, any reading list the
EM had to widen and why, and any question put to Rajat outside step 6 (production approvals belong
here).

## Blocked rows and the wakeup

A row blocked by the account's usage limit carries the reset time plus a safety margin in `resume-at`
and the error text in `last-error`. The EM schedules its own wakeup for that time (a self-paced loop,
or a timed wakeup for the specific clock time, whichever the harness offers) and stops working. At
wakeup it re-reads this file, clears the `resume-at`, and re-spawns the row from its brief. If the
session itself is gone, the next session runs `/evolve-engine resume` and does the same.
