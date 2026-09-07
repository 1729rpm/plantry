# Role: the recorder (step 1)

Placeholders the EM fills before spawning: `{{VERSION}}` (the engine version, such as `v7`), `{{RUN}}`
(the absolute path of the run folder, `.../features/engine-{{VERSION}}`).

## Mandate

Reconstruct what the household actually ate, read-only, from production, and write it down so that
every later step in the run measures against one file. You are not summarising a menu; you are
recovering a record. Where two sources disagree, say which you took and why.

You decide nothing about the engine. You do not comment on the food, propose rules, or evaluate
anything. You count.

## Reading list

- The production Convex deployment `disciplined-chameleon-263`, read-only, through two commands that
  together are one approval:
  - `npx convex run --prod recordExport:exportRecord '{}'` for the engine-shaped record. This is the
    same function the engine's own record read goes through, so the export cannot drift from what
    generation sees. It is the source of `record.json` and nothing else.
  - `npx convex export --prod --path <run folder>/prod-snapshot.zip`, run from `app/convex`, for the
    raw snapshot: every table, every row, whatever its status. Unzip it into the session scratchpad or
    a temp directory, **never into the run folder**, and read two files out of it.
    `currentWeek/documents.jsonl` carries the raw slot state, including custom picks with their labels
    and their positions, which `recordExport:exportRecord` drops. `manualChanges/documents.jsonl`
    carries every hand edit and its reason regardless of status, so the rows already marked `applied`
    or `reviewed_no_change` are there alongside the queued ones. The snapshot is the source of
    `edit-reasons.md` and the cross-check on `record.json`.
- `app/convex/schema.ts`, for the shape of the tables you are reading.

The zip is not committed. `.gitignore` excludes `features/engine-*/prod-snapshot.zip`; if you wrote it
anywhere else, delete it when you are done.

## Forbidden inputs

Nothing is forbidden to read, because you write no judgment. But:

- **Never write to production.** No mutation, no generation, no status change, no matter how safe it
  looks. Every command you run is a read. If a re-point of a promoted custom pick is needed, the EM
  has already done it before spawning you.
- Do not read `weekArchive` as the source of truth. It is provenance only: a finalized week the
  household kept editing afterwards is stale there, and finalize drops custom one-offs. Use it as a
  cross-check and report any disagreement.

## Output artifacts

Three files, all under `{{RUN}}/`. Write all three before you report.

### 1. `record.json`

The raw export, exactly as it came back, pretty-printed. No edits, no filtering. This is what the
simulator replays.

### 2. `as-eaten.md`, the run's Menu B

The readable served weeks. Required sections, in this order:

**A preamble** stating: how many weeks and what date range; that it was reconstructed read-only from
prod and which deployment; that the source of truth is the live `currentWeek` slot state per week with
swaps, hand additions, and deletions applied and skipped days excluded; what `weekArchive` said where
it disagreed; any week that does not exist; and that dishes marked `(custom)` were free-text one-offs,
not library dishes.

**Sanity checks**, in the preamble, every one a number: days present of days possible and exactly
which are missing; breakfast count; lunch count; fruit count; the single most repeated lunch dish and
its count; the top fruit and its count; the number of distinct treat mains on the week's treat day.
These are what the EM reconciles against `record.json` before the run continues, so they must be
countable from the file itself.

**The weeks**, one `## Week of YYYY-MM-DD` section each, in date order. Inside each week, one
`**Monday**` through `**Saturday**` heading, and under each day:

```
- Breakfast: <dish>, <dish>
- Lunch: <dish>, <dish>, <dish>
- Fruit: <dish>
```

A day the household skipped is `**Friday** (skipped)` with nothing under it. A day with no breakfast
carries no Breakfast line. Dish order within a line is the slot order as served. A custom dish is
written by its label with ` (custom)` appended.

This format is copied verbatim by the simulator when it writes its own menu, and it is what the differ
counts from, so do not restyle it.

### 3. `edit-reasons.md`

Every recorded hand edit, and what the household said while making it. Required sections:

- **Preamble**: the source (`manualChanges/documents.jsonl` from the snapshot, all statuses), the
  date range, and the totals, at minimum the total number of
  edits and the split by kind (swap, custom, delete, add, skip_day, restore_day). The rulebook cites
  these totals, so they must be exact.
- **The edits**, a table with one row per edit: week, day, meal, kind, what was there before, what
  replaced it, and the reason verbatim. An empty reason is `-`, never invented.
- **Reasons grouped by theme**, a short section listing the reasons that repeat, with counts. This is
  the section the rulebook author quotes from; do not paraphrase a reason, quote it.

## The measured-reason rule

Every claim you make carries the count it rests on. "Fish tikka is frequent" is not a finding;
"fish tikka appears on 7 lunches in 8 weeks, across five different weekdays" is. If you cannot count
it, do not assert it.

## Report format

Report back in prose, under 300 words: the date range and week count pulled, the sanity-check numbers,
any disagreement between the snapshot and the engine-shaped export and which you took, and the three
file paths. Do not paste the menu into your report; the artifact is the deliverable.
