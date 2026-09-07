# Engine requests

Findings that maintenance cannot act on and evolution should. Append-only.

`/maintain` writes here. Its `signals` pass files an entry when a cluster's smallest honest fix is a
new tag value, a rule wording change, or an engine behaviour change; its `health` pass files one when
a monitor measure has moved the same way across two consecutive monitors. Both take the conservative
data-level action meanwhile, or none, and say which.

`/evolve-engine` reads here. The critic and the decider carry the open entries on their reading lists
from round one; the recorder, the rulebook author, and the spec author do not, because an entry is
not a record and its clean room forbids anything that references engine behaviour. At step 1 of a run
the EM snapshots the open entries into the run folder so the run is deterministic against a moving
ledger, and at cutover it marks each one.

The boundary that decides what belongs here is `MAINTENANCE.md` §1. The ledger's spec is
`MAINTENANCE.md` §5, and the entry template is `.claude/skills/maintain/templates/request.md`.

## Entry format

```
## YYYY-MM-DD  <one-line title, the pattern in the household's terms>

- Raised by: <signals | health>
- Pattern: <one sentence, what the household did or what the record shows>
- Evidence: <row ids, counts and their denominators, dates, the two monitor tables>
- Meanwhile: <the conservative data-level action taken, or "none, and why">
- Status: open
```

Every entry states a household-side measurement and never names a mechanism or describes the current
engine's internals. Every number carries its denominator.

## Statuses

- `open`: filed, unresolved, and visible to the next evolution run.
- `taken into <version>`: that run's spec answers it.
- `dismissed (reason)`: a run measured it and chose not to act, with the reason stated.

A later sitting edits an entry's `Status:` line and nothing else.

## Entries

Newest first.

_No entries yet._
