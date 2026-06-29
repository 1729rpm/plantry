# Feature: Menu composition v2 — coherence, day-budget, role-aware cap

Status: shipped + closed out 2026-06-29 (Stream 1 #200, Stream 2 #201). Owner: EM. Opened 2026-06-29. Archived; do not read for current truth — the shipped rules live in `docs/engine.md` §3/§3.2/§4/§9/§12 and the CHANGELOG 2026-06-29 entry.

Second round of composition-from-feedback, driven by Rajat's 16 manual edits to the
2026-06-29 week (prod `manualChanges`, weekStart 2026-06-29). The first round (R1-R4,
PRs #177-179) encoded earlier edits; this round addresses five issues those rules did not
cover, and does so by **modifying existing structure, not adding standalone rules**.

## The five issues (from the 2026-06-29 edits)

1. **Multi-cuisine plates.** Generated Mon and Tue lunches each mixed 3 cuisines
   (Mon: Thai + Continental + Indian; Tue: Indian + Chinese + Continental). Rajat rebuilt
   each to one coherent register (Mon → Indian thali; Tue → continental protein+veg).
2. **Indian carb on a non-Indian plate.** Rajat deleted Roti from the continental Tue plate;
   he added/kept Roti on the Indian plates. The carb is cuisine-dependent.
3. **A veg-forward non-Indian dish wants one protein, not a pile.** Tue: he stripped the
   pile to Continental baked vegetables + one grilled protein ("needed with baked veggies").
4. **Chilla served without a chutney.** Besan paneer chilla landed on the Tue/Thu single-pick
   breakfast, which has no accompaniment slot; Rajat added Garlic chutney ("needed with cheela").
5. **Lunch carb dropped by the cap.** Thu was over the 5-item cap (breakfast 2 + lunch 4);
   the §9 cap drops by lowest satiety, and Roti is `satiety=Low`, so the carb was dropped
   (the `dropped: Roti` incident). Rajat re-added Roti and dropped a side instead.

Plus the **Monday signal**: with a light (1-item) breakfast, Rajat filled the Indian lunch to
a 4-item thali (protein + dal + dry sabzi + roti); Menu 1 only makes 3.

## Locked decisions (Rajat, 2026-06-29)

- **Cuisine coherence: meal-level.** One coherent cuisine per meal is a standing rule.
- **International dial: 2 non-Indian lunches/week** (was ~3 non-Indian dishes, often clustered).
- **Indian lunch: day-budget to the 5-item cap** — a 4-item thali when breakfast is light,
  trimmed to 3 when breakfast is full.

## Root causes (code-grounded)

- §3 composition is cuisine-blind (`composition.ts` filters on time/category/tags only).
  Cuisine lives only in `priority.ts` step 5 (`byCuisineDiversity`), applied **independently per
  position pool**, so one lunch can promote a non-Indian main AND a non-Indian side AND keep an
  Indian carb — the 3-cuisine plate.
- Breakfast accompaniment is **form-hardcoded**: Option B adds it; the Tue/Thu single-pick has
  no accompaniment slot. A chilla on Tue/Thu gets none.
- The §9 cap (`cap.ts isWorse`) drops by **lowest satiety, then longest prep**, with **no notion
  of structural role**. Roti (`satiety=Low`) is the first casualty though it is the carb.
- Menu 1 (Mon/Wed/Fri) makes a 3-item lunch (protein + one partner + carb); Menu 2 (Tue/Thu)
  makes 4 (protein + gravy + dry + carb). The fuller thali Rajat wants is Menu 2's shape.

## The three structural levers (no new standalone rules)

### Lever A — cuisine becomes a §3 meal-level input (fixes 1, 2, 3)

- A meal-level designation picks **2 weekday lunches/week** to be non-Indian (replacing the
  §4 step-5 per-position nudge). Selection reuses the existing recency/preferred signals to
  choose which cuisine/dishes anchor those meals.
- Those lunches compose via a new **international form**: one cuisine main + at most one
  **same-cuisine-or-neutral** companion, and **no Indian carb** (a cuisine-appropriate carb only
  if the cuisine has one; most non-Indian complete dishes are already self-sufficient).
  - A veg-forward non-Indian main (e.g. Continental baked vegetables) takes exactly one protein
    companion (cuisine-fitting or neutral) — issue 3.
- **Delete §4 step 5** (`byCuisineDiversity`, `placedNonIndianCount`, `WEEKLY_NON_INDIAN_TARGET`)
  and its spec text; cuisine moves to §3. `docs/engine.md` §12 line "§3 never reads cuisine" is
  reversed — update it.
- Data: mark **cuisine-neutral proteins** (grilled chicken breast #113, boiled eggs #30, and
  peers) so they may fill the international form's protein companion regardless of register.
  (Grilled chicken breast is currently `cuisine=Indian` but is functionally neutral.)

### Lever B — breakfast accompaniment becomes dish-driven (fixes 4)

- "A `Category∈{Chilla,Paratha}` breakfast main carries a chutney accompaniment" becomes a
  property of the **main dish**, applied in **any** breakfast slot, including the Tue/Thu
  single-pick. Generalizes the existing Option-B-only "Chilla/Paratha keeps its chutney" clause.
  The `Category=Bread` "served alone" suppression is unchanged.

### Lever C — role-aware cap + 4-item Indian thali (fixes 5 + Monday)

- The Indian weekday lunch aspires to the **4-item thali**: protein main + dal (non-HP gravy) +
  dry sabzi (non-HP) + lunch carb. Menu 1 (Mon/Wed/Fri) gains the second partner so it matches
  Menu 2's fullness — the two Indian-lunch forms converge.
- Each composed pick carries a **structural role** (protein-main / dal / sabzi / carb /
  accompaniment / dessert / breakfast-main / breakfast-accompaniment / protein-floor). The §9 cap
  drops **companion sides** (dry sabzi, accompaniment) before the carb or the protein main.
- The **day-budget is emergent**: the 4-item aspiration trimmed by the role-aware cap yields a
  4-item lunch on light-breakfast days and a 3-item lunch (drop the dry sabzi) on 2-item-breakfast
  days. No separate budgeting mechanism.

## Validation against Rajat's edits

- **Tue** → A: coherent continental plate (baked veg + one grilled protein, no roti); B: chilla
  gets its chutney. 2 + 2 = 4 items. Matches.
- **Thu** → over cap at 6; C drops the dry sabzi, keeps protein + dal + roti. 2 + 3 = 5. Matches.
- **Mon** → light (1-item complete-meal) breakfast; C: full 4-item thali. 1 + 4 = 5. Matches.

## Stream plan (sequenced — shared hotspots `composition.ts`, `generateWeek.ts`, `engine.md`)

The two streams share the composition hotspots, so they run **sequentially**, Stream 2 after
Stream 1 merges; Stream 2 owns the rebase.

- **Stream 1 — Lever B + Lever C + 4-item Indian thali (bug-fixes + day-budget).** Lower risk.
  Lanes: `engine/src/composition.ts` (Menu 1 second partner, breakfast accompaniment),
  `engine/src/generateWeek.ts` (pick roles, breakfast pick), `engine/src/cap.ts` (role-aware
  drop), `engine/src/priority.ts` (only if role plumbing needs it), `docs/engine.md` §3/§3.1/§9,
  and the engine tests + simulation snapshot.
- **Stream 2 — Lever A (meal-level cuisine + international form) + data.** Higher risk (semantics).
  Lanes: `engine/src/composition.ts` (international form), `engine/src/generateWeek.ts` (meal
  cuisine designation), `engine/src/priority.ts` (delete step 5), `docs/engine.md` §3/§4/§12,
  `data/dishes/*` (neutral-protein tags), tests + snapshot.

## Spec & CI

`docs/engine.md` is the source of truth and CI checks spec-code parity; every lever updates the
spec in the same PR. Simulation snapshots will move intentionally — read the diff, confirm it is
the designed behavior, explain in the PR. EM writes the CHANGELOG; engineers do not.

## Out of scope

- Rewiring `generateCurrentWeek` to read the live `weekArchive` (generation reads the baked seed).
- Changing the §4 recency exemptions or the protein-diversity step.
- Per-cuisine bespoke forms beyond the single generic international form.
