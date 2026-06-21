# Feature: Composition from feedback

## Why

Rajat manually reworked next week's auto-generated menu (2026-06-22) with 38 edits, each carrying a reason (logged in the prod `manualChanges` table). Decoded, the edits encode four standing preferences the engine should produce on its own. This feature bakes them into the rules. The source signal and the per-edit reasons are summarized below; the raw rows live in `manualChanges` (status `queued`).

Scope decisions taken with Rajat (see DECISIONS.md 2026-06-21):
- **R2 is a curation problem, not a difficulty rule.** The `complexity` field contradicts the "too hard for our cook" reason (Ratatouille is tagged Easy; the removed tofu dishes and the chicken curry Rajat added are all Medium), so a difficulty filter would not have changed any swap. Handle international quality via dish data (`preferred`/`active`) plus a small §4 ordering tweak.
- **R4 stays within the §9 weekday cap (5 items/day).** A lighter 3-item complementary lunch, not the full 4-item thali (which would need the cap raised to 6).

## The four rules

### R1 — Suppress sides on self-sufficient mains  (Stream A)

A self-sufficient main takes no accompaniment and no separate carb. Signal (property-based, never dish names):
`isSelfSufficientMain(dish) = dish.tags.includes("complete_meal") || dish.category === "Complete meal"`.
The union is required: White sauce pasta (254) is Category=Complete meal but is **not** `complete_meal`-tagged, so the tag alone misses it.

- **Breakfast Option B** (`composition.ts:173` `breakfastOptionB`; pick in `generateWeek.ts:465` `tryPair`): Option B currently pairs every `complete_carb` with a Category=Accompaniment. Change: when the chosen Option-B lead is **Category=Bread** (avocado toast, masala toast), serve it alone (a 1-item breakfast), no accompaniment. A `complete_carb` that is a **Chilla or Paratha keeps** its accompaniment (this preserves "garlic chutney needed with cheela").
- **Lunch complete_meal main**: already carries no carb in Menu 3/Menu 4. R1's lunch half is mainly the explicit exemption that complete_meal lunches are **out of scope for R4** (no dal/sabzi/carb added). **Menu 4's designed Accompaniment position stays** — Rajat objected only to carbs on complete mains, not to a side.
- **Edge case left to manual swap:** kadhi + bhindi ("not needed with kadhi"). Kadhi is a non-complete_meal Gravy dish; "a filling gravy that needs no sabzi" is not a property the data carries, and encoding it would fight R4. Documented as an acknowledged taste exception.

Spec wording (engine.md §3): "A self-sufficient main (tagged `complete_meal`, or Category=Complete meal) fills its slot alone: no separate carb, no accompaniment. In breakfast Option B a Category=Bread `complete_carb` is served without the accompaniment; a Chilla or Paratha `complete_carb` keeps it. A non-complete-meal gravy that is itself filling (e.g. kadhi) is not structurally distinguishable and is left to in-week manual swap."

### R2 — International curation  (Stream B = §4 tweak; Stream C = data)

Two parts, both small:
- **Stream B (§4):** in `byCuisineDiversity` (`priority.ts:295`, step 5 of `rankCandidates` `priority.ts:453`), order the **promoted non-Indian group** so `preferred === "Yes"` ranks first within it (a stable sub-sort, keyed on `preferred`). Today the step promotes any non-Indian flat; this surfaces Rajat's liked international ahead of the rest. It stays subordinate to steps 6/7 (recency, protein) and keeps the fresh-alternative fallback.
- **Stream C (data):** mark the international dishes by Rajat's revealed taste. All international dishes are currently `preferred: No`, so the §4 tweak has nothing to float until data is set. **Proposed (confirm per-dish at the data PR, content review gate):**
  - `preferred: Yes`: White sauce pasta (254), Pesto pasta (172), Thai green curry chicken (161) — his keeps/adds.
  - Consider `active: No` for the tofu dishes (Thai red curry tofu 160, Korean tofu soup 208) if Rajat confirms a standing tofu aversion (3 of 4 removals were tofu); otherwise leave `preferred: No`.
  - Ratatouille (205): if genuinely hard in Rajat's kitchen, re-tag its `complexity` honestly (data correctness), independent of the engine.
  Broader international curation (the other ~50 non-Indian dishes) is a future content pass; this stream acts only on the dishes with actual signal.

No difficulty rule is added. `complexity` stays UI-only.

### R3 — Breakfast protein floor  (Stream A)

When a breakfast's main carries no protein (no `HP` tag), add one HP protein companion. Scoped to the **Tue/Thu single pick** (`generateWeek.ts:486` `pickBreakfastSingle`), which has item headroom (1 → 2 under the 5-cap) and is exactly where the sevai case occurred. After the single main is picked, if `!isHp(main)`, append one HP Category=Keto breakfast companion (boiled eggs, keto bhurji), ranked via `rank`.

- Signal: `!picks.some(isHp)` (HP-tag absence — the engine's protein rule input; not a derived-protein threshold, which the engine deliberately avoids).
- Composes with one-HP-per-meal (`composition.ts:164` `excludeHpIfMealHasHp`): the floor fires only at HP count 0, the cap removes only at count 1 — disjoint, never produces two HP.
- **Mon/Wed/Fri** breakfasts already run 2 items and would brush the cap, so they are left to manual.
- A Bread `complete_carb` made standalone by R1 (avocado toast) does **not** get an egg — R3 fires after R1, only on non-self-sufficient non-HP mains.

Spec wording (engine.md §3 Breakfast): "Breakfast protein floor (Tue/Thu single pick): when the single breakfast main carries no `HP` tag, the slot adds one HP Category=Keto companion (e.g. boiled eggs), making a 2-item breakfast. It fires only on a no-HP breakfast, so it never conflicts with the one-HP-per-meal cap; an empty companion pool falls back to a 1-item breakfast. Mon/Wed/Fri, already two items, are left to in-week manual addition."

### R4 — Lunch thali structure (cap-neutral)  (Stream A)

Make the Menu 1 partner complement the main's form, so an Indian lunch always pairs a gravy and a dry dish around its protein, without exceeding 3 items. In `menu1` (`composition.ts:245`) / `pickMenu1` (`generateWeek.ts:502`):
- HP main is a **Dry dish** → partner = non-HP **Gravy** (a dal). *Unchanged.*
- HP main is a **Gravy dish** → partner = non-HP **Dry sabzi** (replacing the former Accompaniment/salad). *The change.*
- Thin Dry-sabzi pool → fall back to Accompaniment (mirror the existing fallback), slot still fills.

Stays 3 items, so weekday total stays 5 (cap-safe). The full 4-item dal+sabzi+protein+carb thali is **not** built (it would need the §9 cap raised to 6 — Rajat chose to keep the cap).

- **Exemptions:** complete_meal lunches (Menu 3/4) get none of this (R1). Kadhi as the dal still pairs a sabzi under R4 — the kadhi+bhindi case Rajat removed — so kadhi stays the documented manual exception (R1).

Spec wording (engine.md §3 Menu 1): "Menu 1's partner complements the main's form: an HP Dry-dish main pairs a non-HP Gravy (a dal); an HP Gravy-dish main pairs a non-HP Dry sabzi (replacing the former Accompaniment), so an Indian lunch always carries both a gravy and a dry dish around its protein. A non-HP Accompaniment is the thin-pool fallback. Complete_meal lunches are exempt (they fill alone). Pairing a sabzi with a self-sufficient gravy such as kadhi is left to manual swap."

## Streams

| Stream | Scope | File lanes | Branch | Status |
|---|---|---|---|---|
| A | R1 + R4 + R3 (composition), internal order R1→R4→R3 | `engine/src/composition.ts`, `engine/src/generateWeek.ts`, `engine/test/composition.test.ts` (+ generateWeek test), `docs/engine.md` §3 | `feat/a-composition-feedback` | not started |
| B | R2 §4 cuisine Preferred-first ordering | `engine/src/priority.ts`, `engine/test/priority.test.ts`, `docs/engine.md` §4 step 5 | `feat/b-cuisine-preferred` | not started |
| C | R2 dish curation (data) | `data/dishes/*.md` (named dishes only), `data/changelog.md` | `data/intl-curation` | blocked on A merge (snapshot rebase); confirm dishes with Rajat at PR |

Streams A and B have disjoint code lanes (composition/generateWeek vs priority) and touch different sections of `docs/engine.md` (§3 vs §4), so they run in parallel; the later merger owns the `engine.md` + CHANGELOG rebase (development.md §11). Merge B first (small, self-contained), then A (owns rebase). Stream C runs after A merges so it rebases the moved simulation expectations once.

## Test expectations (all streams)

- R1: Option B with a Bread complete_carb lead → 1-item breakfast, no accompaniment; with a Chilla/Paratha complete_carb → still pairs the accompaniment; no Accompaniment ever placed beside a Category=Complete meal main (except Menu 4's designed side).
- R2/B: promoted non-Indian group ranks Preferred=Yes first; at/above `WEEKLY_NON_INDIAN_TARGET` still a no-op; all-Indian pool unchanged.
- R3: Tue/Thu non-HP single main → gains one HP Keto companion (meal has exactly one HP); HP main → no companion; empty companion pool → graceful 1-item; cap stays ≤ 5.
- R4: Menu 1 Gravy HP main → partner is a non-HP Dry dish; Dry HP main → partner non-HP Gravy (regression); both companions non-HP; empty sabzi pool → Accompaniment fallback; Menu 1 stays 3 items; complete_meal lunch carries no added dal/sabzi.
- The simulation harness still passes (it asserts properties, not literal snapshots); the engineer inspects the new simulated weeks to confirm the intended shape and no cap breach. Watch the coverage ratchet.

## Open confirmations for Rajat (at the relevant PR, non-blocking)

1. Stream C dish list: confirm `active: No` vs `preferred: No` for the tofu dishes, and whether to re-tag Ratatouille's complexity.
2. R1 Menu 4: confirm a complete_meal lunch keeps its Menu 4 Accompaniment (only the carb is suppressed).
