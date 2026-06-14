# Structural changelog

Append-only audit of structural changes to the library and rules. Distinct from `docs/CHANGELOG.md`, which tracks shipped code and feature changes. Entries here are written by the slow loop on merged PRs.

Format:

```
## YYYY-MM-DD  short title  (slow-loop PR #N)

- What changed (dish, ingredient, rule, tag).
- Triggering comment(s) summarized.
- One-line rationale.
```

---

## 2026-06-09  First fixture-driven slow-loop run (slow-loop PR pending)

The test-fixture dry-run that proves the slow-loop pipeline end-to-end. All five queued comments in `data/test-fixtures/slow-loop/queued-comments.example.json` and both incidents in `data/test-fixtures/slow-loop/incidents.example.json` were considered under the right-size discipline (`docs/product.md` §4 Principle 1). Every cluster resolved to no change warranted. The pipeline (`/slow-loop` slash command + structural-changelog write + GitHub Action for marking consumed Convex rows) is validated end-to-end; the lack of code changes is the honest output for one synthetic week, not a failure of the discipline.

- Cluster A (cmt_fixture_001, "prawn stir fry too oily"): one-off; oil quantity is a per-cook decision and not in the library; reviewed_no_change. Path back to action: a real future comment hitting the same theme upgrades this to a recipe-note proposal.
- Cluster B (cmt_fixture_002, "no low-spice dish all week"): one comment from one week; one comment does not justify a new dish property such as `low_spice`; reviewed_no_change. Path back: 3+ comments across non-overlapping weeks would trigger a `low_spice` tag proposal.
- Cluster C (cmt_fixture_003, "loved the chicken curry"): positive feedback, no action; reviewed_no_change.
- Cluster D (cmt_fixture_004 + cmt_fixture_005 + inc_fixture_002, paneer fatigue): small pattern within a single week. The engine already flagged it via incident, which is the correct level of behavior. Two cases is not yet a pattern per the right-size discipline; reviewed_no_change. Path back: 3+ weeks of paneer-frequency incidents upgrades to a per-week Primary Ingredient cap rule in §4 priority.
- Cluster E (inc_fixture_001, Wednesday no-gravy dish): the engine's incident system is operating as designed; reviewed_no_change. Path back: when auto-recovery middleware (queued Stream C slice) ships, this incident gates a roll-back to last-good week; no rule edit needed in `docs/engine.md`.

## 2026-06-14  Within-week recency + one-HP-per-meal  (slow-loop PR pending)

Two engine rule changes from a Rajat-directed proactive run (a menu review of the 2026-06-15 generation). No Convex rows were consumed: every consumed-id list is empty. The 2026-06-15 menu showed the same HP gravy (Chicken masala gravy) winning every Mon/Wed/Fri Menu 1 slot, and a Menu 1 HP gravy main paired with a second HP dish (Chicken salad, HP-tagged) in one meal.

- Cluster A (within-week repeats): structural; fix level rule edit + engine code + tests + simulation. Added §4 step 5 "within-week recency": a dish already placed earlier in the week being generated is treated as most-recently-used and sinks below fresh alternatives for every subsequent slot's ranking. It is applied last so it dominates steps 1 to 4 (the root cause was that step 1's longest-unused signal was being re-promoted by step 3 ingredient consolidation and step 4 Preferred=Yes). Honors the existing §4 exemptions (fruit-tagged dishes, lunch carbs in {Chapati, Rice}), so Seasonal fruit on Mon/Wed/Fri and Roti repeating stay intended. Threaded the running week picks through the generateWeek loop and the swap picker via a shared `withinWeekRecencySet` helper. Rationale: the HP pool is broad (21+ active dishes), so rotation was available once within-week recency applied; no new dish or tag warranted.
- Cluster B (one HP source per meal): structural; fix level rule edit + engine code + tests. §3 Menu 1 partner selection now excludes HP-tagged dishes from the partner/accompaniment pool when the main is the HP pick (a meal carries one HP source, not two). Keyed on the `HP` tag, never on dish names, so it holds for any HP protein (chicken on chicken, paneer on paneer). Graceful fallback: if excluding HP empties the partner pool, the unfiltered pool is used so the slot still fills. Rationale: property-based fix on the existing tag; no data or tag change warranted.
- Cluster C (cuisine variety: fish/prawn/mutton): small (one genuine gap); reviewed_no_change for fish/prawn (already active in the library and surfaced by Cluster A's new variety), and deferred for mutton to a separate `data/expansion-*` content batch (zero mutton dishes exist in the catalog; net-new dishes go through the reviewed expansion path, not this rules PR). Rationale: variety is mostly already present and unblocked by Cluster A; only red meat is truly missing.
