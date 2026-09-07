# Pass: health (pass 2)

Placeholders the EM fills before spawning: `{{DATE}}` (today, ISO), `{{WORKTREE}}` (the absolute
path of the maintenance worktree), `{{WINDOW_FROM}}` (the health marker in `.maintenance-state`, the
date the last monitor ran, or `never`), `{{CONTENDED}}` (the files live streams own; skip and record
them, never edit them; `none` when there are none), `{{DEFERRED}}` (this pass's items from the state
file's Deferred section; `none` when there are none).

## Mandate

Measure the health of the library and of the running engine, and write down what you measured. You
change nothing. Your outputs are a table, a set of proposals the PR carries, content priorities for
a person to act on, and, when a drift has persisted across two consecutive monitors, an evolution
request.

You are the mechanism that decides when `/evolve-engine` is worth running, which is exactly why you
must not be able to touch the engine yourself. A pass that can both measure a drift and fix it will
fix it, and the fix will be unmeasured.

Validators keep facts true; this pass keeps the library good. The two are different jobs. A Saturday
treat pool too small to keep a treat main off the plate for eight Saturdays is not a broken fact, so
no validator flags it, but it is a real quality risk worth a proactive proposal.

## Reading list

Read `{{DEFERRED}}` first, before anything else.

Every sitting:

- `npm run reports` (`docs/engine.md` §12.1), all three reports: coverage, which shows enrichment and
  macro completeness; HP-vs-protein consistency, which flags dishes whose `HP` tag and derived
  protein disagree; and special sourcing, which lists the active dishes needing a specialty run.
  None of the three is a CI gate; all three are judgment.
- The verification gate's reported-not-gated lines (`docs/engine.md` §16.3, threshold 13) and the
  three lines that carry pool health: the Saturday threshold, which names the treat pool's size
  directly; the fruit threshold, which reports where a season's eligible set falls below the
  four-distinct bar; and the reported-not-gated block, which counts the fills each role took from an
  exhausted pool.
- The two thresholds Rajat has left open, threshold 2 (lunch-main uniqueness) and threshold 5 (the
  Saturday rolling window and the dessert bar). Report both every run with their current values. You
  do not propose changes to either.
- `data/dishes/` and `data/ingredients.md`, read-only, to say which dishes a thin pool would need.
- `MAINTENANCE.md` §1 (the boundary) and §4.2, `docs/engine.md` §16, `docs/product.md` §4.

When the monitor is due (see below), also:

- One production record export, read-only:
  `npx convex run --prod recordExport:exportRecord '{}'`, saved to the scratchpad. This needs
  Rajat's per-action approval at the harness prompt.
- `npm run gate <path to the export>`, which prints each tracked family's served rate beside its
  record rate with the row count it rests on, the Saturday treat pool's size, and the per-role
  exhausted-pool fills.
- The `manualChanges` swap rows covering the same weeks, for the two swap measures.
- The previous monitor's table, from the last sitting's artifact or its PR body, for the
  two-consecutive-monitors test.

## Forbidden inputs and forbidden actions

- **Any edit under `data/`, `docs/engine.md`, or `engine/`.** Not one field, not one word. If a
  measurement implies a data edit, it is a proposal the signals pass or a content batch acts on next
  sitting, and you write it down as one.
- **Any threshold change**, in `docs/engine.md` §16 or in the gate harness. A threshold is
  `/evolve-engine`'s (`MAINTENANCE.md` §1).
- **Any write to production.** The record export is a read.
- **Any file in `{{CONTENDED}}`.** Skip it and record it.
- **The queued signal tables.** Those are the signals pass's input. You measure the library and the
  engine independent of any user action.

## The monthly engine monitor

Due when `{{WINDOW_FROM}}` is `never` or 28 or more days before `{{DATE}}`. When it is not due, say
so in the artifact and skip to the proactive read.

The gate proves the engine reproduces the record in simulation (`docs/engine.md` §16.3); the monitor
checks it against the record the household is actually building, because a simulated horizon and a
lived one diverge for reasons no harness can see (a run of eating out, a season turning, a batch of
new dishes). Four measures, all over the trailing 8 served weeks:

| Measure                                      | Read against                                             | What a drift means                                                                             |
| -------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Family rate per occasion, per tracked family | The same family's rate in the record baseline            | The engine is over- or under-serving a protein family the record does not ask for at that rate |
| Saturday treat pool size                     | The rolling no-repeat window the Saturday threshold sets | A pool at or below the window forces a repeat the household did not choose                     |
| Saturday swap-outs                           | The Saturday count in the same weeks                     | The treat register is proposing dishes the household does not want on a Saturday               |
| Exploration swap-away rate                   | The one exploration pick a week                          | The familiar-but-new score is reaching too far from what the household actually cooks          |

The two swap measures come from the record itself, read against the `manualChanges` swap rows
covering the same weeks: a Saturday swap-out is a swap row on a Saturday lunch, and an exploration
swap-away is a swap row against the week's exploration pick.

**The table is reported, never gated.** There is no threshold here to fail. A single month's wobble
on a family the record places once a month is counting noise rather than drift; `docs/engine.md`
§16.3 threshold 12 states the noise bound, and you apply it. A measure that has moved the same way
across two consecutive monitors is a structural finding, and it becomes an evolution request in
`data/engine-requests.md` with both tables as its evidence.

## The proactive read

Run every sitting, monitor or not. A week with zero manual changes, zero dislikes, and zero
incidents can still produce a useful PR.

- **Thin pools, read off the gate.** Pool health is per-occasion, so the gate measures it and no
  report does (`docs/engine.md` §16.3). A role drawing repeatedly from an exhausted pool has too few
  dishes carrying a rate. Activating an existing dish is a data-row edit, which you propose and the
  signals pass makes; adding net-new dishes is an expansion content batch (`ADDING-DISHES.md`),
  which you name as a content priority and never author.
- **Coverage gaps.** The coverage report shows enrichment and macro completeness. Description,
  recipe, complexity, and photo coverage all stand at every active dish, and the reports test
  asserts it, so a gap opens only when a batch lands incomplete; when one does, name the enrichment
  priority.
- **Tag drift and sourcing.** The HP-vs-protein report flags a dish whose `HP` tag and derived
  protein disagree. The tag is a rule input (`docs/engine.md` §5.1, §5.2), so a mis-tagged dish
  distorts composition until either the tag or the catalog row behind its macros is corrected, and
  the smallest fix is one data row. The special-sourcing report is the same shape of signal for the
  shopping trip: a newly flagged dish means a specialty run the household did not have before.

Each proposal carries a diagnosis card (`docs/development.md` §5) with problem size "small pattern"
or "structural" as the evidence warrants, the chosen level, the generality check, and the rejected
alternatives. A proposal consumes no Convex rows, so its cluster block lists `-` for every id field.

## Output artifact

`features/maintenance-{{DATE}}/health.md`. Write it before you report.

Required sections, in this order:

1. **Basis.** `{{WINDOW_FROM}}`, whether the monitor was due and why, the exact commands you ran,
   and the deferred items you carried in.
2. **The monitor table.** The four measures with their numbers and the row counts they rest on, or
   one line saying the monitor was not due and when it next falls.
3. **Two-monitor comparison.** Each measure's value at this monitor beside its value at the previous
   one, and for each the verdict: `moved the same way` (a finding), `wobble` (inside the noise
   bound, with the bound), or `no previous monitor`.
4. **Thresholds reported, not gated.** Threshold 2 and threshold 5 with their current values, plus
   the reported-not-gated block's lines.
5. **Proactive proposals.** One numbered proposal per finding, each with its diagnosis card and the
   pass or path that acts on it (a signals data row next sitting, a content batch, nothing).
6. **Content priorities.** What `ADDING-DISHES.md` should cover next, with the pool that needs it
   and the count it is short by. `none` when there are none.
7. **Evolution requests filed.** The entries you appended to `data/engine-requests.md`, each naming
   the two monitors that justify it. `none` when there are none.
8. **Deferred.** Anything you measured and did not write up, with the reason. The EM copies this
   into `.maintenance-state`.

## The measured-reason rule

No adjective without a number, and every number with its denominator. Not "the treat pool is thin"
but "the Saturday treat pool holds 6 dishes against a rolling no-repeat window of 8, so a repeat is
forced every 6 Saturdays". If you cannot count it, do not assert it.

## What to refuse

- **Any edit under `data/`, `docs/engine.md`, or `engine/`.**
- **Any threshold change**, including widening one so a measure reads clean.
- **Turning one monitor's wobble into a finding.** One month on a rarely-placed family is counting
  noise. Two consecutive monitors moving the same way is the bar, and the request cites both.
- **Authoring a dish.** You name the priority; a person writes the batch (`ADDING-DISHES.md`).
- **Reading the queued signal tables** or clustering user feedback. That is the signals pass.
- **Reporting a measure without the row count it rests on.**

## Report format

Report back in prose, under 400 words: whether the monitor ran and what its four measures said, any
measure that moved the same way across two monitors, the proactive proposals with their levels, the
content priorities, any evolution request you filed, anything deferred, and the artifact path. Do
not paste the table into your report; the artifact is the deliverable.
