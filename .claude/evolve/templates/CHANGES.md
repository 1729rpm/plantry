# Engine {{VERSION}}: what changed and why

The change document for this engine evolution. Copy this file to
`features/engine-{{VERSION}}/CHANGES.md` at the end of round 1 and append to it after every round;
finish it at step 6 once Rajat has settled the parked decisions. It is one of the four outputs a run
produces (`EVOLVING-THE-ENGINE.md` §11) and it is the document that answers, a year later, why a rule
is what it is.

Two standing rules for everything below:

- **Every change carries its measured reason**, inline, with the number. A change whose reason is
  "it reads better" does not belong in the engine and does not belong in this file.
- **Write it as the outcome, not the history.** A reader wants to know what the engine does and why,
  not which round it happened in. The round columns exist for auditing, not for narrative.

## 1. What this engine is

Three or four sentences. What the chooser does, what signal it reads, and what it does not do. Enough
that the rest of the document is readable without the spec open.

## 2. What changed, rule by rule

One entry per changed rule, grouped the way the spec groups its sections. Do not group by round.

| Rule or section | What it now does | Measured reason | Round |
| --------------- | ---------------- | --------------- | ----- |
|                 |                  |                 |       |

The measured reason column is the load-bearing one: it names the measurement that forced the change,
with its number and its denominator, in one clause. "The differ found the carb slot demanding 3.4
fills a week against a pool supplying 3.1, so the overflow landed on low-rate rotis at +76 percent" is
a measured reason. "Rotis were over-served" is not.

## 3. What was deliberately not changed

Items a reviewer flagged and the decider consciously declined, each with the reason and the
measurement that would change the answer. This section stops the next run re-litigating a settled
question, so it is worth as much as section 2.

| Item | Why it was left alone | What would change the answer |
| ---- | --------------------- | ---------------------------- |
|      |                       |                              |

## 4. What was deleted

Mechanisms removed from the design during the run, each with the measurement that condemned it and a
note that it now sits on the spec's deliberately-absent list. A deletion is a change and is recorded
like one.

## 5. The parked decisions and how they were settled

One entry per item parked for the household's round. Each:

- **The question**, one sentence, as it was put to him.
- **What the record showed**, with the count, and why it could not settle the question.
- **The conservative option** that was taken while the item was parked.
- **His answer**, and the date.
- **What changed in the spec as a result**, with the section.

An item he declined to decide stays on the conservative option, and that is recorded here as the
answer.

## 6. Round by round

A short audit trail, three or four lines per round: what the dry run measured, what the reviews found,
what the decider changed, and whether it was a no-change round. This is the only place the run's
chronology appears. A no-change round is recorded as a result, not as an absence.

## 7. What the next run should know

Anything this run learned about the process rather than the engine: a reading list that had to widen,
a threshold that was unsatisfiable and why, an artifact format that did not survive a re-run, a role
whose brief needs amending. The EM carries this into `RETRO.md` and, where it is a process change,
into `EVOLVING-THE-ENGINE.md` through the docs pass of `/maintain`.
