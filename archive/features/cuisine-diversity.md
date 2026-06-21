# Feature: Cuisine diversity (fewer Indian dishes, slightly)

## Why

Rajat wants the generated week to lean a little less Indian on a standing basis,
not as a one-off. Today the menu is heavily Indian (~77% of the library is
`cuisine: "Indian"`, and the §3 slot pools are keyed on Category/Time/tags, most
of which are inherently Indian categories), and the engine does not balance by
cuisine at all: per `docs/engine.md` §dish-fields, `cuisine` is explicitly a
display/filter field and **not** a rule input. So there is no lever to pull. This
feature introduces a small, soft cuisine-balance rule so a handful of non-Indian
dishes reliably land each week, while everything else is unchanged.

"Slightly" is the load-bearing word: the rule must NOT flip the menu to maximally
international. It nudges the week toward a small target of non-Indian dishes and
then stops.

## Scope

One stream, engine-only. No frontend, no Convex schema, no data/library change.

### Stream A — §4 cuisine-diversity ranking step

Add a soft, target-gated within-week cuisine-diversity step to §4 selection
priority, modeled exactly on the existing §4 step 6 (within-week protein
diversity, `byProteinDiversity` in `engine/src/priority.ts`): a stable partition,
property-keyed (never dish names), with a fresh-alternative fallback, that never
narrows §3 composition eligibility.

**Mechanism.**

- Track a running count of non-Indian dishes (`dish.cuisine !== "Indian"`) already
  placed in the week being generated, built the same way `withinWeekRecencySet`
  and `proteinFamiliesUsedAsHpMain` are built from `weekPicks`, and threaded into
  every `rankCandidates` call via a new optional arg (mirror
  `withinWeekDishIds` / `usedHpMainProteinFamilies`).
- A new constant `WEEKLY_NON_INDIAN_TARGET` (default **3**) sets how many non-Indian
  dishes the week aims for.
- In the ranking step: **while** the week's placed non-Indian count is below the
  target, partition the pool so non-Indian candidates rank above Indian ones
  (stable within each group). **Once** the target is met, the step is a no-op, so
  the rest of the week ranks exactly as before. This is what bounds the effect to
  "slightly": ~3 international dishes/week instead of the incidental ~0-1, with
  every other slot unchanged.
- **Fresh-alternative fallback (soft, never forces):** if a slot's pool has no
  non-Indian candidate (e.g. an all-Chapati/Rice lunch-carb pool, or a
  Category=Fruit pool), the partition is a no-op and the slot fills normally. This
  fallback means fruit slots and lunch-carb slots need no explicit exemption: they
  contain no non-Indian candidate, so the step never touches them. Document this
  rather than adding an exemption list.

**Placement in the §4 chain.** Insert as a new step **between step 4
(Preferred=Yes) and step 5 (within-week recency)**, shifting the current steps 5
and 6 down by one. Rationale: cuisine is a soft nudge that outranks the
longest-unused / consolidation / Preferred tiebreaks (steps 1-4) among fresh
candidates, but stays subordinate to the two dominant terminal partitions
(within-week recency, within-week protein diversity), so it can never force a
dish repeat or an HP-protein clash just to hit the cuisine target.

**Deliberate tradeoff to flag in the diagnosis card for Rajat's review:** because
the step sits after Preferred=Yes, it WILL promote a non-Indian candidate above a
Preferred=Yes Indian dish in the (at most `target`) slots where it fires. This is
intentional and bounded, but it is a real behavior change to the Preferred signal;
call it out explicitly so Rajat can veto on the PR if he would rather the rule sit
before Preferred (weaker effect, may under-shoot the target when preferred Indian
dishes dominate a pool).

**Spec reversal (must be explicit in the PR and in `docs/engine.md`).** This
feature changes `cuisine` from "NOT a rule input" to a §4 ranking input. The
dish-fields line that currently reads "eligibility, selection, and composition
never read it" must be corrected to: composition (§3) and eligibility (§1) still
never read it, but §4 selection now does, for the cuisine-diversity step only. Add
the new step's subsection to §4 with the constant and the fallback semantics, in
present-tense steady-state spec voice. Renumber the existing §4 steps 5 and 6 and
update every cross-reference to them in `docs/engine.md` (search "step 5", "step
6", "§4 step").

### Out of scope

- No change to §1 eligibility, §3 composition, §5 cap, or §6 consolidation.
- No library/data edits. The set of non-Indian dishes is whatever the library
  already tags; this feature only re-ranks, it does not add dishes.
- No frontend or Convex change. `app/convex/generateWeek.ts` calls the engine's
  `generateWeek` unchanged; the threading is internal to `engine/src/`.

## File lanes (Stream A)

- `engine/src/priority.ts` — the new step + its set-builder + the constant.
- `engine/src/generateWeek.ts` — thread the placed-non-Indian count into
  `rankCandidates` (mirror the existing within-week threading at lines ~196-207,
  ~343-391).
- `engine/test/priority.test.ts` — unit tests for the new step (promotes when
  under target; no-op at/above target; no-op when pool has no non-Indian
  candidate; stable within groups; subordinate to recency/protein).
- `engine/test/simulation.test.ts` and any snapshot fixtures it owns — the
  simulated weeks change (a few slots flip to non-Indian); regenerate and review
  the diff to confirm the change is "slightly," not a wholesale flip.
- `docs/engine.md` — the §dish-fields correction + the new §4 step + step
  renumbering and cross-reference updates.

## Test expectations

- New unit tests cover: under-target promotion, at-target no-op, empty-non-Indian
  fallback, stability, and subordination to within-week recency/protein.
- The simulation harness still passes; its snapshots MOVE (expected). The engineer
  inspects the moved snapshot and confirms each simulated week gains roughly
  `WEEKLY_NON_INDIAN_TARGET` non-Indian dishes and no more, then updates the
  snapshot in the same PR.
- Watch the coverage ratchet (`x < total` assertions) per the merge-gate rule;
  bump the expected total if the new step adds lines the ratchet counts.

## Stream-state table

| Stream | Scope | Branch | Owner / worktree | Status |
|---|---|---|---|---|
| A | §4 cuisine-diversity ranking step | `feat/a-cuisine-diversity` | TBD on spawn | not started |

## Open items for Rajat (resolve on the PR, not blocking the build)

1. **Target value.** Default `WEEKLY_NON_INDIAN_TARGET = 3`. Tunable via one
   constant; confirm or adjust on the PR after seeing the moved simulation
   snapshot.
2. **Preferred=Yes override.** The step sits after Preferred and so can outrank a
   Preferred Indian dish in up to `target` slots. Confirm acceptable, or move the
   step before Preferred for a weaker, preference-respecting version.
