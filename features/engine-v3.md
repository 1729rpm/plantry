# Feature: Engine v3, plate composition

Status: ACTIVE (Rajat approved the locking decisions in chat, 2026-07-13).
Phase 5 in `docs/PLAN.md`. Built in the main EM session. Stream A commits this
spec, the PLAN.md Phase 5 row, and the CLAUDE.md Currently-building entry as part
of its PR.

Sibling feature: `features/wishlist.md` (wishlist page + favorites frequency),
built in a SEPARATE session. The two share engine hotspots; see §7 coordination.
This feature deliberately does not touch §4 selection priority or anything under
`app/`.

## 1. Why (signal, condensed)

Post-composition-v2 weeks (2026-07-06, 25 manual edits; 2026-07-13, 13 edits) plus
the finalized 2026-07-13 week and the open incident list show three recurring,
multi-week, both-member patterns that survive v2:

1. **Two wet dishes on one plate.** "2 gravy dishes already" (Fri 07-13, deleted
   Soya chunks masala next to Vegetable korma), "Don't need 2 gravy dishes"
   (Fri 07-06), "Too much food" (Wed 07-13, deleted Dal tadka next to Chicken
   masala gravy). Root cause: the thali's "dal" position is keyed on
   Category=Gravy dish (Vegetable korma legitimately won it), and the protein main
   may itself be a Gravy, so the form composes two wet dishes.
2. **The carb belongs to the main.** "With kadhi we have rice", "Thursday also has
   rice, don't have rice on continuous days", "With Thai curry" (steamed rice added
   to a carbless international lunch), "To have with palak paneer" (missi roti),
   Jeera rice deleted once Rajma chawal arrived. The §3.1 carb rule is dish-blind
   and once even served Curd rice as a generic plate carb.
3. **Compose-then-trim is noise.** All 7 open incidents are the same weekly
   warning: Wed/Thu/Fri over cap, sabzi dropped. The 4-item aspiration plus a
   2-item breakfast is structurally over budget, so the trim is steady state and
   drowns real incidents; the household then still deletes more ("Too much food").

Plus one gap Rajat re-affirmed: protein must be present every day; the generated
Tue lunch (Veg hakka noodles alone) carried none.

## 2. Locked decisions (Rajat, 2026-07-13)

- One wet dish per plate is a hard rule. One is sufficient; never two.
- No 4-item thali aspiration. A lunch never has 5 items (hard per-meal max 4);
  compose to the day budget instead of trimming after.
- No normalizer / edit-time recomposition (deferred; the success metric is fewer
  manual edits per week from better generation alone).
- Protein is needed every day; the generated menu always provides it.
- Frequency/favorites are OUT of this feature (they live in `features/wishlist.md`).
- Engineers build on Opus; this spec is written to be executed without further
  product decisions.

## 3. Design

### 3.1 Budget-aware composition replaces compose-then-trim

Breakfast composes first (unchanged forms). The lunch item budget is then:

```
lunchBudget = clamp(WEEKDAY_CAP - breakfastItemCount, 2, LUNCH_MAX_ITEMS)
```

with `WEEKDAY_CAP = 5` (unchanged) and new constant `LUNCH_MAX_ITEMS = 4` in
`composition.ts`. Saturday keeps its 3-item budget and Menu 3/4 forms. The §9 cap
(`cap.ts`) survives unchanged as a safety net that should never fire in normal
generation; an over-cap incident now signals a real defect, not steady state.
Typical outcomes: Mon/Wed/Fri (2-item breakfast) compose a 3-item lunch; Tue/Thu
(1-item breakfast, 2 with the protein floor) compose a 4- or 3-item lunch.

### 3.2 Menu 1 and Menu 2 become one weekday-plate form

Both keep their names (Saturday alternation and archive history strings depend on
menu numbering elsewhere; do not rename). The form, in order:

1. **Protein lead** (protected, role `protein-main`): Menu 1 = HP-tagged dish,
   Category in {Gravy dish, Dry dish}; Menu 2 = Category=Keto. Indian cuisine only,
   as today.
2. **Carb** (protected, role `carb`): picked by the lead's carb affinity (§3.4).
   Suppressed only by self-sufficient mains, as today.
3. **Companions** (droppable roles) filling the remaining budget
   (`lunchBudget - 2` positions, so 1 or 2): pool = eligible non-HP Lunch dishes,
   Category in {Gravy dish, Dry dish, Accompaniment}, Indian cuisine, ranked by §4.
   Role by category: Gravy dish → `dal`, Dry dish → `sabzi`, Accompaniment →
   `accompaniment`.

**One wet dish per plate (hard, all lunch forms).** A plate holds at most one
Category=Gravy dish item. If the lead is a Gravy dish, the companion pool excludes
Gravy dishes entirely. If a Gravy companion lands, any further companion position
excludes Gravy. There is NO thin-pool fallback for this rule (unlike one-HP-per-
meal): a plate short one companion beats a two-gravy plate. Keyed on Category,
never on names. The old dedicated dal and drySabzi positions are removed; the
`Menu1CandidateSet`/`Menu2CandidateSet` shapes change accordingly, and
`candidateSetPools` must stay consistent (the swap picker and §6 requests read it).

One-HP-per-meal, meal-level Indian cuisine, self-sufficient-main suppression, and
all breakfast forms are unchanged. §4 selection priority is untouched by this
feature.

### 3.3 Lunch protein floor (every day has protein)

After any lunch plate is composed (weekday plate, Menu intl, Menu 3, Menu 4, and
the thin-pool carb-only fallback), if no picked item is HP-tagged or
Category=Keto, append one protein companion (role `protein-floor`, protected):

- Pool: eligible Lunch dishes with the HP tag or Category=Keto.
- Cuisine: on an Indian plate, `cuisine === "Indian"` or the `cuisine_neutral`
  tag; on an international plate, same-cuisine-or-`cuisine_neutral` (the existing
  intl companion rule).
- Texture: excludes Gravy dishes when the plate already holds one (§3.2 hard rule).
- The floor counts inside `lunchBudget`; if the plate is already at budget the
  floor still appends (protein beats budget, per "protein is needed every day")
  but never exceeds `LUNCH_MAX_ITEMS`.
- Empty pool: omit and write a `warn` incident (this is a real gap, unlike the old
  weekly cap noise).

Consequence worth spelling out in `docs/engine.md`: a self-sufficient main still
suppresses its carb and veg sides, but no longer suppresses the protein floor. A
non-HP complete_meal international anchor (e.g. Veg hakka noodles) now lands with
one protein companion (e.g. boiled eggs), mirroring what Menu 4 already does with
its Keto position. Menu 1/2/3 satisfy the floor by construction, so it no-ops
there.

### 3.4 Carb affinity replaces the dish-blind carb rule

New optional dish frontmatter field `carbAffinity: Rice | Roti` (absent = no
preference, current behavior). Semantics at the carb position:

- Lead has `carbAffinity: Rice` → the carb pool is plain Category=Rice dishes.
- Lead has `carbAffinity: Roti` → plain Category=Chapati dishes.
- Absent → default Category=Chapati, as today (§3.1).

**Rice spacing (hard) replaces "Rice at most once per week".** A Category=Rice
item never lands on two consecutive generated days. When affinity demands Rice but
the previous day carries rice, the carb falls back to Chapati. Tuhina's stated
rule ("don't have rice on continuous days") is spacing, not count; with affinity
driving rice, a fixed weekly count would fight the affinity. Flag this replacement
in the PR description explicitly.

**International carb.** The intl form keeps "no Indian carb" except: an anchor
with `carbAffinity: Rice` takes a carb from Category=Rice dishes carrying the
`cuisine_neutral` tag (plain steamed rice is register-neutral; a Thai curry needs
rice). Data below tags Steamed rice. `Roti` affinity never applies on an intl
plate.

Field wiring: `DishSchema` in `engine/src/data/schemas.ts` (zod enum, optional),
`parse.ts`, `serialize.ts`, round-trip test, `docs/engine.md` §12 field reference,
and a line in `ADDING-DISHES.md`. No catalog (`data/ingredients.md`) change.

### 3.5 Data edits shipped with Stream A (Rajat reviews the PR listing)

- `carbAffinity: Rice` on lunch mains whose canonical serving is rice: kadhi
  (id 8), chhole/chana-type gravies, sambar-type South Indian gravies, rajma
  gravy if a non-complete-meal one exists, and every non-Indian curry-type Gravy
  anchor (Thai red curry tofu id 160, Thai green curry chicken, and siblings).
  Derive the list by reading `data/dishes/`; enumerate every assignment in the PR
  body for Rajat's review. Use `Roti` only where roti is strictly canonical
  (leave most dishes absent; absent = today's default).
- Recategorize Curd rice (id 16) from Category=Rice to Category=Complete meal with
  the `complete_meal` tag (it is a standalone dish that was being served as a
  plate carb; property-honest fix).
- Add the `cuisine_neutral` tag to Steamed rice (id 272).

## 4. Streams

| Stream | Scope | Lanes | Depends on | Status |
| --- | --- | --- | --- | --- |
| A | Everything in §3: budget-aware composition, one-wet hard rule, lunch protein floor, carbAffinity field + data edits, cap-as-safety-net; engine.md §3/§3.1/§3.2/§9/§12; feature activation (spec, PLAN.md row, CLAUDE.md line) | engine/src/composition.ts, generateWeek.ts, cap.ts, schedule.ts, engine/src/data/{schemas,parse,serialize,validators}.ts, engine/test/**, docs/engine.md, data/dishes/ (listed edits), ADDING-DISHES.md, features/engine-v3.md, docs/PLAN.md, CLAUDE.md | none | in progress (`feat/A-plate-composition`, worktree `../plantry-plate-composition`) |

One stream: the rules, the field, and the data that keys them are one reviewable,
CI-coherent unit (engine.md parity requires paired src + test anyway).

## 5. Stream A execution notes (read before coding)

- Run `npm install && npm run bake` before any typecheck/build/test (fresh
  worktrees lack the gitignored baked `library.ts`/`history.ts`). Stream output
  early and often (the subagent watchdog kills silent 600s commands). No em dashes
  anywhere, including code comments and PR bodies. Diagnosis card per
  `docs/development.md` §5. Any `docs/engine.md` edit needs a paired
  `engine/src/` and `engine/test/` change in the same PR (CI enforces).
- The simulation harness snapshots (`engine/test/simulation.test.ts`) WILL move:
  regenerate deliberately, hand-review the new weeks against §3 of this spec (one
  wet max, 3-item MWF lunches, rice spacing, floor on intl plates), and say so in
  the PR body. Do not chase old snapshots.
- `engine/test/data/reports.test.ts` pins live pool-coverage counts (19 slot rows
  per season) and the pool-coverage report enumerates §3 position pools from the
  live composition functions: update the report's slot enumeration in
  `validators.ts` to the new companion-pool shape and adjust the pinned literals
  knowingly.
- `candidateSetPools` consumers: `requests.ts` (§6 placement acceptance) and
  `rankCandidatesForSlot` / Convex `swap.ts getSlotAlternatives` (§5 picker pool).
  Keep the flattened pools complete or swaps lose reachable dishes.
- Roles: reuse the existing `PickRole` vocabulary; companion roles map by category
  (§3.2). `DROPPABLE_ROLES` in cap.ts is unchanged.
- The Convex incident write path (`app/convex/generateWeek.ts`) is unchanged and
  out of lane; after this stream a generated week should produce zero over-cap
  incidents, and the simulation asserts that.
- Activation edits: commit this spec verbatim as `features/engine-v3.md` (copy
  from the main dir path; never edit main-dir files), add the PLAN.md Phase 5 row
  ("Engine v3 | Generated lunches compose one-wet, budget-fit, protein-floored
  plates with main-driven carbs | in flight"), and add `features/engine-v3.md` to
  the CLAUDE.md Currently building line (the sibling wishlist feature may list
  itself there too; keep both lines, later merger owns the rebase).

## 6. Deploy and acceptance

Engine + data only; no Convex surface or frontend change. After merge the EM
re-bakes the main dir (`node engine/dist/scripts/bake.js`). The 2026-07-20 week is
the first generated with the new composition (weekly
`npx convex run --prod generateWeek:generateCurrentWeek`, per-action approval as
always).

Feature-level acceptance, verifiable on the simulation and the next generated week:

- No meal contains two Category=Gravy dish items.
- No lunch exceeds 4 items; no day exceeds 5; zero over-cap incidents on a normal
  library.
- Every generated day carries lunch protein (HP or Keto item on every lunch).
- A kadhi/chhole/Thai-curry plate carries rice; rice never lands on consecutive
  days; Curd rice never appears as a plate carb.
- Weekly manual-edit count is the success metric across the next 3 weeks
  (baseline: 25 then 13).

## 7. Coordination with the wishlist feature (separate session)

`features/wishlist.md` (favorites frequency + wishlist page) has an engine stream
that touches `engine/src/priority.ts`, `engine/src/generateWeek.ts`,
`docs/engine.md` §4, and the simulation snapshots. Shared hotspots with Stream A:
`generateWeek.ts`, `docs/engine.md`, `engine/test/simulation.test.ts`, plus the
PLAN.md/CLAUDE.md activation lines.

Merge order: **engine-v3 Stream A merges first; the wishlist engine stream
branches from (or rebases onto) the merged result and owns the rebase.** Both
sessions record their streams in `coordination/active-streams.md` before spawning
and re-read it before merging; the Hotspot ledger there carries this order.

## 8. Out of scope (deferred, tracked)

- Favorites, frequency, wishlist page: `features/wishlist.md`.
- The normalizer / edit-time recomposition: revisit only if edit counts stay high
  after three post-v3 weeks.
- Per-person preferences, dislike write-back, tofu/soya curation: slow-loop
  candidates. The next `/slow-loop` run should also resolve the 7 stale over-cap
  incidents (design superseded) and consume the manual-change rows this spec's
  analysis covered.
