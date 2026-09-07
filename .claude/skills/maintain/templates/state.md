# Template: `.maintenance-state`

The maintenance sitting's manifest. Copy the body below into `.maintenance-state` at the repository
root when the file needs rebuilding, and fill it. The spec is `MAINTENANCE.md` §6; the procedure
that maintains it is `.claude/skills/maintain/SKILL.md`.

**This table is the sitting's only state.** A resuming session reads it and continues from the first
pass that is not `done`. Nothing about a sitting's progress lives in a session's memory, in a
scratchpad, or in an unpushed commit. If the table and a recollection disagree, the table is right.

`.maintenance-state` is committed, so the job history is part of `git log` and is visible to anyone
who clones.

## Body

```
| pass    | last-run   | status  | deferred | note                              |
| ------- | ---------- | ------- | -------- | --------------------------------- |
| signals | YYYY-MM-DD | done    | 0        | -                                 |
| health  | never      | pending | -        | monitor never run                 |
| docs    | YYYY-MM-DD | done    | 1        | <shortest useful description>     |
| retro   | YYYY-MM-DD | done    | 2        | <shortest useful description>     |
| hygiene | YYYY-MM-DD | done    | 1        | <shortest useful description>     |

## Deferred

### signals

- (none)

### health

- (none)

### docs

- <one line: what, and why it was not done this run>

### retro

- <one line: what, and why it was not done this run>

### hygiene

- <one line: what, and why it was not done this run>
```

## Column rules

- **pass**: the five pass names, in the fixed run order. Always all five rows, even for a pass that
  has never run.
- **last-run**: the ISO date the pass last completed, or `never`. This is the pass's input-window
  marker: the signals pass reads queued rows since it, the docs pass reads CHANGELOG entries since
  it, the health pass measures the monitor's 28-day gate from it. The retro pass's main window is a
  status rather than a date, so its `last-run` bounds only the "appended since" half.
- **status**: `done`, `pending`, or `running`. A row left `running` by a dead session is treated as
  not done and re-run from scratch.
- **deferred**: the number of items this pass has open in the Deferred section, or `-` for a pass
  that has never run. The count and the section must agree.
- **note**: the shortest sentence that identifies the oldest or most significant deferral, or `-`.
  Never blank.

## The Deferred section

One subsection per pass, in the same order as the table. Each item is one line: what it is, and one
clause of why it was not done. An item stays until the pass that owns it closes it, and every pass
reads its own items before its date window.

**A pass may not report `done` with an unrecorded deferral.** That single rule is why this file is a
manifest and not a list of date markers: five flat markers cannot say "ran and deferred three
items", which is exactly how items fell out of a window and stayed out.
