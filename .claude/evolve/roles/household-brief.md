# Role: the household brief (step 6)

The EM writes this one itself, from the run's own artifacts. It is the only thing Rajat reads in a
whole run, and it is the only point at which the run stops.

Placeholders: `{{VERSION}}`, `{{RUN}}` (the absolute path of the run folder).

## Mandate

One page. What changed, what needs his taste, and how the result compares to the food he actually ate.

Two rules govern the whole document:

- **Only the parked decisions are questions.** Every item the record could settle has already been
  settled by the decider, and re-opening one here wastes the round that settled it. If you are
  tempted to ask him something that is not parked, check `decisions-*.md` first: it is almost always
  already decided, with the measurement.
- **Every rule carries its measured reason.** He should be able to read any line and see the number
  that forced it. This is what makes the page short: a measured reason needs no argument around it.

Write plainly. Explain any term an experienced product manager would not already carry, at the point
it is used. No jargon carried over from the reviews, no stream letters, no file paths in the body
beyond the four he might want to open.

## Reading list

- every `{{RUN}}/decisions-<n>.md`
- `{{RUN}}/CHANGES.md` as it stands
- `{{RUN}}/review-3-differ.md` (the last round's comparison), for the final numbers
- `{{RUN}}/spec.md`, for the clause text of anything you quote

## Output artifact

`{{RUN}}/household-brief.md`. Required sections, in this order:

1. **What this is**, in three sentences. The engine was re-derived from the served weeks; three rounds
   of measurement have happened; here is what changed and the handful of things that need your taste.
2. **What changed, and why.** One entry per changed rule, grouped so the shape is readable (the week,
   the plate, protein, variety, novelty, fruit, whatever the spec's own grouping is). Each entry: the
   rule in one sentence as the household would describe it, then its measured reason in one sentence
   with the number. Round numbers do not appear; he is reading the outcome, not the history.
3. **What did not change, and why.** The things a reader might expect to see changed and that were
   consciously left alone, each with the measurement behind leaving them. Three to six items.
4. **Your decisions.** The parked items, and nothing else. One per item, in this shape:
   - the question, one sentence, in his language;
   - what the record shows, with the count;
   - **the conservative option, which is what the engine does today** unless he says otherwise;
   - the alternative;
   - what the conservative option costs if it is the wrong call.
     Number them so he can answer "1 conservative, 2 alternative" in a line.
5. **How the result compares to what you actually ate.** The final comparison in numbers, not prose:
   a short table of the axes that matter (the ones the last differ report ranks highest, plus the ones
   he has asked about in earlier runs), each with the engine's rate and the household's rate on the same
   denominator, and a one-line note on any axis still out of band and why.
6. **What happens when you answer.** Two sentences: his answers go into the spec, the spec becomes
   final, and the build starts; the build's own gate is the merge condition and he will be asked for
   per-action approval on anything that touches production.

## Length

One page as read on a phone. If it does not fit, the "what changed" section is too detailed, not the
decision section: cut explanation, never a question.

## What to refuse

- Asking him to arbitrate between two mechanisms the record can distinguish.
- Asking him to approve a round, a review, or a spec section.
- Presenting a parked item without a conservative default already taken. He should be able to answer
  nothing at all and still have a shippable engine.
- Carrying a number into this page that the last round did not measure.
