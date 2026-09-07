# Template: one `data/engine-requests.md` entry

Copy the block below, fill it, and append it to `data/engine-requests.md`. The ledger is append-only:
a later sitting edits an entry's `Status:` line and nothing else. The spec is `MAINTENANCE.md` §5.

Who writes one: the signals pass, when a cluster's smallest honest fix is a new tag value, a rule
wording change, or an engine behaviour change; the health pass, when a monitor measure has moved the
same way across two consecutive monitors.

## The block

```
## YYYY-MM-DD  <one-line title, the pattern in the household's terms>

- Raised by: <signals | health>
- Pattern: <one sentence, what the household did or what the record shows>
- Evidence: <row ids, counts and their denominators, dates, the two monitor tables>
- Meanwhile: <the conservative data-level action taken, or "none, and why">
- Status: open
```

## Rules for the entry

- **State a household-side measurement, never a mechanism.** "Rajma was swapped out on 4 of the 6
  weeks it was placed, twice with the reason 'bored of rajma'" is an entry. "The chooser's
  longest-unused tiebreak is over-weighting rajma" is not: it names the engine's internals, and the
  entry has to stay safe to read inside `/evolve-engine`'s clean room, where the rulebook author and
  the spec author must never see the current engine.
- **Every number carries its denominator.** An adjective without a count is not evidence.
- **Name the conservative action you took meanwhile**, or say plainly that you took none and why. A
  request is not a substitute for the smallest fix that was actually available.
- **One entry per finding.** Two clusters that share a root cause are one entry with both sets of
  ids; two findings that merely happened in the same sitting are two entries.

## Statuses

| Status                 | Set by                           | Means                                                                         |
| ---------------------- | -------------------------------- | ----------------------------------------------------------------------------- |
| `open`                 | the pass that raised it          | Filed, unresolved, and visible to the next `/evolve-engine` run               |
| `taken into <version>` | the EM at an evolution's cutover | The run's spec answers it; the version names which                            |
| `dismissed (reason)`   | the EM at an evolution's cutover | The run measured it and chose not to act, with the reason stated in the entry |

## Who reads it

`/evolve-engine`'s **critic** and **decider**, from round one, as one added line on each reading
list. Not the recorder, which recovers a record and this is not one; not the rulebook author or the
spec author, whose clean room forbids anything that references engine behaviour.

At step 1 of an evolution the EM snapshots the open entries into the run folder so the run is
deterministic against a moving ledger, and at cutover it marks each one `taken into <version>` or
`dismissed`.
