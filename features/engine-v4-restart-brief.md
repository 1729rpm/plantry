# Engine v4.1: restart brief

**What this is.** A cold-start briefing for a session picking up the engine reconstruction after it
stopped midway. Read it end to end before touching anything. It exists because the phase has now
failed twice for the same underlying reason, and the reasons are not visible from the code.

**What it is not.** Not a spec. `features/engine-v4.md` is the spec and it is long; this file tells you
which parts of it are still true, which parts are dead, and what went wrong. Where the two disagree,
`features/engine-v4.md` §15 wins, because it is the most recent measurement.

**Status in one line.** Phase 8 is `building`. Nothing has merged to production. Two open PRs hold the
whole phase. The last verification gate returned DO NOT MERGE with four blocking findings, and the root
cause is a design defect in the selection mechanism, not a bug in anyone's implementation.

---

## 1. Read these, in this order

1. This file.
2. `features/engine-v4.md` **§15** (the verdict). The single most important section. §15.1 is the root cause.
3. `features/engine-v4.md` **§10** (the v4.1 target), then **§11 to §14** which amend it. §10 alone is misleading.
4. `docs/engine-as-built.md`. A read-through of the engine **actually live in production today** (v3), in
   execution order, with a §6 listing seven places where `docs/engine.md` and the code disagree. This is
   your baseline. v4.1 is not in production; nothing in that file describes it.
5. `docs/engine.md`, the normative rules spec. Treat with suspicion: §15.7 proves it currently documents a
   plate rule the engine does not have.
6. `coordination/active-streams.md`, top banner, for branch and worktree state.

Skip `features/engine-v4.md` §3 to §7 unless you are doing history. They are the retained record of the
**first** falsified spec and are explicitly superseded by §10. See mistake 2 below: leaving them in place
while §10 revived parts of them by reference is what orphaned a whole layer of the engine.

---

## 2. Where the work physically stands

Nothing merged. `main` is still v3.

```
origin/main
  └── feat/A-v41-selection   (PR #229)   <- THE WHOLE PHASE lives here
        ├── Stream A  selection ranker
        ├── Stream C  data + backend      (also open separately as PR #228)
        ├── Stream B  composition/wiring  (was PR #230, merged into A)
        └── Stream E  remove fruit        (was PR #232, merged into A)

origin/feat/C-v41-data-backend  (PR #228)  <- subset of the above, targets main on its own
origin/proto/engine-v4-simulation          <- throwaway prototype + 25-week simulation harness
```

Both PRs are open, mergeable, CI green. **Green CI means nothing here.** The gate that matters is the
25-week self-feeding simulation, and it failed. Do not read "all checks passed" as permission to merge.

`feat/A-v41-selection` already contains C, so PR #228 is a subset of PR #229. Decide early whether #228
should be closed in favour of the integrated branch; two PRs describing overlapping content is a review
trap.

**The worktrees were deleted** during maintenance cleanup (nothing lost, branches are in sync with
origin). To resume:

```
git worktree add ../plantry-v41-selection feat/A-v41-selection
cd ../plantry-v41-selection && npm install && npm run bake
```

The `bake` step is not optional. `engine/src/data/library.ts` and `history.ts` are generated and
gitignored, so a typecheck before the bake fails with a confusing missing-module error.

Then rebase onto `main` and re-run the **full** gate set including `format:check`. Maintenance changed
`.prettierignore` and `eslint.config.js` on 2026-08-25, which shifts Prettier's and eslint's scope onto
files that were previously out of scope. This exact trigger reddened Stream B in July.

---

## 3. What v4.1 was trying to do

v3 selects by **longest unused**. Because the library holds far more never-cooked dishes than cooked
ones, the engine's default instinct is to propose something new every week. Measured week-over-week
overlap on `main` is 0.194 against the household's own 0.28 to 0.35. The engine churns more than the
household does.

v4.1's answer was to make a **saturating frequency count** the primary sort: credit `min(eatenCount, 3)`
over the 10 most recent week-records, with longest-unused demoted to a tiebreak. Plus simplified day
templates, a whole-day prep-time budget, and the removal of the Fruit of the day.

---

## 4. What was built, and what is worth keeping

Verified clean in the gate run and **not** implicated in any blocking finding:

- The whole-day prep-time budget. Zero days over 120 minutes across 150 days.
- Plate rule 9 and the one-gravy rule. Zero violations in 88 carb plates.
- Protein spread: prawn and mutton appear in every 4-week block.
- Stream C's `cuisine_neutral` widening. The protein-side pool went from 2 chicken dishes to 6 dishes
  across 5 protein families, and a test now prevents a future content batch quietly re-narrowing it.
- The favorites pin-beats-guard fix.
- The complete removal of the Fruit of the day, with 34 legacy history rows still parsing.
- Week-over-week overlap landed at 0.295, inside the target band.

§15.6 is right that this is one more iteration and not a restart. Keep the branch.

---

## 5. Why it failed

### The root cause: the frequency window is self-referential

The seed record is 11 weeks. The frequency window is the 10 most recent week-records. So **from week 11
onward the window contains only the engine's own output.** The household's real eaten record has been
flushed out of the signal entirely, and what the engine reinforces is whatever it happened to place in
its own first ten weeks.

Measured over 150 days: **32 of the 65 dishes the household actually eats are never served**, against 10
under v3. Every dal is missing. Dal runs 0.64 per week against 2.00 observed. A mechanism adopted so the
engine would propose what the household eats does the exact opposite in steady state.

This is a defect in decision **D3** (rolling 10 most recent week-records, chosen for simplicity over
season scoping). It is not a coding error. Nobody implemented D3 wrongly.

### The four blocking findings

1. **Breakfast is a period-5 carousel.** 125 breakfasts yield 6 distinct mains, against 19 for v3 and 11
   in the household's own 28 breakfasts. By week 11 exactly 6 mains sit at credit 3 and the other 17 sit
   at credit 0 forever. The §10.4 widening is inert: all eleven restored dishes are served zero times.
   `explorationPositions` is lunch-only, so breakfast has no novelty channel at all.
2. **International lunch dies permanently at week 20** and never returns (exactly 2.00 per week for 19
   weeks, then exactly 0.00 for 33). Stream A changed placement to frequency-first while v3's
   longest-unused substitution trigger was left standing in nobody's lane, so the trigger compares an
   anchor against a pool the placer will never touch. No single stream could see this.
3. **The favorites guarantee breaks**, caused by finding 2. Invisible with the one real favorite; add two
   ordinary ones and the dish is genuinely absent for six consecutive weeks. This is the Phase 7
   user-facing promise failing silently.
4. **Household staples are starved** (the root cause above).

### Also failing

No position at period 1 (Avocado toast on 25 of 25 Mondays from a 21-dish pool). Explored dishes recur
(67 percent served exactly once). The prep-time curve sits **above** the household's at every percentile
(p50 90 against 80) rather than under it.

---

## 6. The mistakes, which are the reason this file exists

Read this section twice. The phase has burned two full cycles and every one of these is repeatable.

**1. A rule interaction was specified without simulating it. Twice.** In both cycles the implementation
was faithful and the specification was wrong. The first cycle: frequency-first plus a recency exemption
is an absorbing state. The second: the frequency window is a feedback loop that eats its own signal.
Neither is reachable by reasoning about a rule in isolation, and both were obvious within 25 simulated
weeks. **Simulate the rule interaction before writing the spec section, not after building it.**

**2. An entire layer of the engine was never assigned to anyone.** §10's day templates were not
implemented by any stream. §3 says "do not implement", §10.3 and §10.4 revive parts of §3 by reference,
but nothing revives §3.2's templates and no brief carried them. The engine still runs v3's Menu 1/2/3/4
forms. This is an EM scoping error and it is the direct cause of blocking finding 2. **A spec section
that says "superseded" while later sections cite it by reference is a scoping trap. Resolve §10 versus §3
before writing a single brief.**

**3. The gate horizon was wrong.** The 25-week window stopped one week before the engine changes shape
permanently. International lunch died at week 20. **Future gate runs measure weeks 20 to 60, not 1 to 25.** The steady state is where this engine actually lives and it is a different engine from the one the
first 19 weeks show.

**4. Streams verified in isolation cannot see integration defects.** Every stream's own checks were green.
The international-lunch death only appears when A's placement change meets B's untouched trigger. **The
integration measurement is the gate, not the sum of the stream gates.**

**5. Thresholds were written that were arithmetically unreachable.** §13 had to amend two of them after
the fact, and §11.4 a third. One demanded "no position on a fixed cycle" which §3.4's own determinism rule
makes impossible. Another demanded a placement ceiling below the floor a 3-dish seasonal pool
mathematically allows. **Check a threshold is satisfiable before making it a gate.**

**6. A documented gate that did not exist let drift survive for months.** `docs/engine.md` §13 claimed
"CI enforces this with two checks". There were zero. Reviewers skipped a check they believed was
automated. That claim is now corrected in `CLAUDE.md` and `README.md`, but **§13 itself still overstates
it** and the check still does not exist. Related: CI did not run at all on PRs targeting another branch,
so Stream B merged completely ungated (fixed 2026-08-25).

**7. A fully documented, fully validated rule was never wired in.** `pairsWith` is parsed, validated,
baked, and **read nowhere in generation**. Outside the data layer its only appearances are two prose
comments in `explore.ts` and `favorites.ts`. Re-verified for this brief. The test suite passes because
the one test covering it checks name resolution at bake time and nothing about placement. Consequently
§10.3's rule 7 rewrite was a no-op and the zero pairing incidents in the gate run are **not evidence the
rewrite worked, they are evidence nothing ran.** **Add a parity test that fails when a documented plate
rule has no generation coverage.**

Note the scoping precisely, because it is easy to misread: **the parity violation lives on
`feat/A-v41-selection`, not on `main`.** On the branch, `docs/engine.md` documents `pairsWith` as a live
plate rule at line 43 and line 365, complete with a precedence order for a rule that never fires. On
`main`, `pairsWith` does not appear in `docs/engine.md` at all. A session that checks `main` will
conclude §15.7 was wrong. It was not; it measured the integrated branch.

**8. Two doc assertions were falsified by measurement**, both about mechanisms called load-bearing.
`docs/engine.md` line 206 claims the guard's delay lets a starved dish climb toward the cap; for breakfast
the rotation drifts one weekday per week, which is 8 days between appearances and permanently clears a
7-day guard, so 17 of 23 mains sit at credit 0 forever. Line 282 claims the 6-item rule is a backstop
rather than the thing that sizes the plate; measured, it sizes the plate (60 of 150 days land exactly at
6, rising to 197 of 360 over 60 weeks).

---

## 7. The work list

**Blocking. The gate cannot be re-run until these are done.**

1. **Redesign the frequency signal so the household's real record stays in it permanently.** Anchor the
   seed and archive weeks, or separate a fixed household-record term from a rolling-recency term. This is
   the central design decision of the next cycle and everything else is downstream of it.
2. **Give breakfast a novelty channel.** `explorationPositions` is lunch-only.
3. **Own the §3.2 template layer**, or delete it from the spec and state that v3's forms stand. Whoever
   owns it also owns the international substitution trigger.
4. **Re-verify the favorites guarantee with two or more ordinary favorites**, not just the one real one.

**Required by §15.5 before the next attempt.**

5. Lower the 6-item backstop, or size lunch by shape rather than by leftover day capacity. 4-item lunches
   run 76 of 150 against 2 of 34 observed; 6-item days 60 of 150 against a household maximum of 5.
6. Either wire rule 7 into generation with a generation test, or delete `pairsWith` from the data, the
   frontmatter, the validator and `docs/engine.md`. Add the parity test from mistake 7.
7. Fix §10.3 rule 9's prose, which contradicts its own evidence. The code implements the correct weaker
   reading; the prose states the strong one.
8. Add pinned favorites to §13.1's exemption list.
9. Resolve §10 versus §3 (mistake 2).
10. Re-take every §12 gate number against the production favorites list. Two were measured without it.
11. Fix the tiebreak: `byLongestUnused` and `bySaturatingFrequency` tie-break on **input array index**,
    not dish id, while `rankExploration` uses id. Reversing the library array changes 7 of 11 slots. This
    is a second determinism hole.
12. Restate every overlap threshold against a measured baseline with a named metric. The thresholds never
    say whether they mean week-level dish-set Jaccard (0.295) or position-keyed (0.106), and the
    household's own six weeks measure 0.263, below the 0.28 to 0.35 band the spec attributes to them.
13. Saturday alternation is not implemented. 13 of 24 transitions repeat, including five consecutive
    Menu 3.

**Pre-existing, not introduced by this phase, but it invalidates determinism claims.**

14. Production generation is **not deterministic**. Re-verified for this brief, with one nuance §15.5
    states too flatly: `generateCurrentWeek` does accept an optional `rng` argument and threads it
    through, but production invocations never supply it, and `lastSaturdayMenu` is never passed anywhere
    in `app/convex/` at all. So the Saturday menu coin-flips on `Math.random` in production and the
    intended alternation never happens, contradicting §3.4's no-RNG claim. `main` behaves identically, so
    this is not a regression, but §3.4 is currently false in production. The fix is small: thread the
    last Saturday's form through the Convex call, or have the engine read it from history.

---

## 8. Decisions that are Rajat's, not the session's

- Whether the frequency signal is repaired or abandoned. Two cycles have now failed on it. A third
  attempt is defensible; so is returning to longest-unused with a repeat guard and treating the churn
  problem as a smaller fix. **Do not pick this silently.**
- Whether `pairsWith` is wired in or deleted. It is real data that took judgment to produce, and five of
  its six seed pairs were rejected by its own validator.
- Whether PR #228 stays open alongside PR #229.
- Whether the day templates get a stream or the spec concedes that v3's forms stand.

---

## 9. Before you write any code

- Re-create the worktree and bake (§2 above). Rebase onto `main` and re-run the full gate set including
  `format:check`.
- The simulation harness lives at `origin/proto/engine-v4-simulation` and in the in-repo prototype
  worktree at `.claude/worktrees/agent-af7fdbe04cb7d2290`. It is reusable and it is the only way to see
  any of these defects. Use it **before** amending the spec.
- Set the gate horizon to weeks 20 to 60.
- Read `docs/engine-as-built.md` §6 so you know which `docs/engine.md` claims are already known false.
- Check `coordination/active-streams.md` before spawning anything. It currently records no active
  sessions.

**The one-line lesson from two failed cycles:** in this engine, a rule that is correct in isolation can
still be wrong in interaction, and the only instrument that has ever caught it is the self-feeding
simulation run long enough to reach steady state. Reach for it first, not last.
