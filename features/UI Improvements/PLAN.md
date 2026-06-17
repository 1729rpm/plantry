# UI Improvements — EM development plan

The engineering-side scoping for the `features/UI Improvements/` design handoff. The handoff
(`README.md`, `FEATURES.md`, `DESIGN.md` plus the JSX/HTML reference) is the design authority;
this file is the EM's slicing of it into streams, with dependencies, file lanes, and the
slow-loop routing for the two gated items. Read the handoff first, then this.

## Shape of the work

The handoff is mostly a **resync** of surfaces that already shipped (fruit, cuisine, derived
Healthy, the generic pickers, the canvas share image, the nested Explore filter, the dislike).
The genuinely new work is seven deltas. Five are pure frontend, two are gated (they reverse the
current product spec and route through the slow loop).

| # | Item | Type | Gated |
|---|------|------|-------|
| 1 | Menu brand header ("Plantry" wordmark + long date subtitle; drop the in-header change-summary) | frontend | no |
| 2 | Past-day collapse (compact card, two-dish glance, "View" pill; is-before-today predicate) | frontend | no |
| 6a | Changes TabBar count badge | frontend | no |
| 6b | Changes subtitle count ("{n} changes to this week's menu") | frontend | no |
| 6c | Sheet close-× button | frontend | no |
| 3 | Day-level comment entry returns ("Note for the weekly review") | gated | yes |
| 4 | "Add a custom dish" — manual dish addition that feeds the library via the slow loop | gated | yes |

Items 1, 6a, 6b are one semantic move: the week's change count **leaves the Menu header and
reappears on the Changes tab** (subtitle plus the nav badge).

### Fruit of the day — no special handling (handoff override)

The handoff's DESIGN.md §2 asks for a "quieter" Fruit of the day row (a soft swatch tile, an "In
season" meta line, a Swap link). **Rajat overrode this:** Fruit of the day needs no special visual
treatment; it renders like the breakfast and lunch sections. The only fruit-specific behaviour is
that **replacing a fruit limits the picker results to fruits** (category-locked).

Both are **already true in the live app** and need no work: fruit renders as a normal `DishRow`
through the same meal loop (`DayCard.tsx`, `DayScreen.tsx`), and the fruit-replace picker is locked
to the in-season Category=Fruit pool (`SwapPickerSheet.tsx:75`, with the engine's `dish-not-fruit`
guard). So there is nothing to build for fruit, and the handoff's quieter-FruitRow spec is dropped.
Carry this override into the next Claude Design commission so it is not reintroduced.

## Locked decisions (this session)

- **Collapsed past-day action label: "View"** (the handoff default; alternatives Open / Review /
  See day were considered).
- **"One-off" is reframed and renamed.** It becomes a **manual dish addition** ("Add a custom
  dish", row marker "Custom dish"): when a user wants a dish that is not in the library yet, they
  add it to this week and it **queues to the slow loop, which enriches it and adds it to the
  library** on approval. The throwaway free-text "one-off" framing is retired. See `DECISIONS.md`.

Both gated items (#3, #4) are greenlit, routed through the slow loop.

## Phase 0 — slow-loop / spec work (precedes the matching UI)

**G1 · Day-comment entry (product reconciliation).** Re-allows day-level comment entry, reversing
the PR-#78 removal. The `addComment` Convex mutation already exists, so this is a `docs/product.md`
change routed through a docs / slow-loop PR; no schema work. Unblocks Stream L.

**G2 · "Add a custom dish" → library pipeline.** The heavier gated item:

- `docs/product.md` §7 (drop "appending a one-off is out of scope") and §6 (history exclusion holds
  only until the dish is promoted to the library); reframe the concept and copy to "custom dish".
- `docs/engine.md` — confirm the per-day item cap covers an appended custom dish.
- `MAINTENANCE.md` / the slow-loop spec — the slow loop treats a custom-dish addition as a
  candidate to enrich and add to the library via the `ADDING-DISHES.md` playbook.
- A **new Convex mutation** in `app/convex/` that appends a custom dish as an extra dish to a meal
  slot (the existing replace-at-position path stays). The fast-loop capture stays lightweight
  (name plus day/meal plus the required reason); enrichment happens during slow-loop review.

Unblocks Stream M.

## Phase 1 — frontend streams

Each `app/web` slice goes behind the per-slice all-flows crawl plus design-compare gate before merge
(`docs/development.md` §3-4, `engineering.md` §16).

| Stream | Scope | File lanes | Depends on |
|--------|-------|-----------|-----------|
| **J1** | Menu header rebrand (#1) + relocate change count to Changes subtitle (#6b) + TabBar Changes badge (#6a) | `MenuScreen.tsx`, `ChangesScreen.tsx`, `primitives.tsx` (TabBar), `App.tsx`, `lib/days.ts` (long date label), `index.css` | — |
| **J2** | Past-day collapse (#2); label "View"; compact `DateBadge`, two-dish glance, is-before-today predicate | `DayCard.tsx`, `MenuScreen.tsx`, `lib/days.ts`, `index.css` | after J1 |
| **K** | Sheet close-× button (#6c) | `primitives.tsx` (Sheet), `index.css` | sequence vs J1 (`primitives.tsx`) |
| **L** | Day-comment entry UI (#3) — "Note for the weekly review" card wired to `addComment` | `DayScreen.tsx`, `index.css` | after G1 |
| **M** | "Add a custom dish" UI — append affordance in the Add picker + rename across picker / dish row / Changes feed | `AddDishSheet.tsx`, `SwapPickerSheet.tsx`, `DishRow.tsx`, `ChangesScreen.tsx`, `index.css` | after G2 |

### Sequencing and lanes

- J1 then J2 (shared `MenuScreen.tsx` and `index.css`); the later stream owns the rebase.
- K shares `primitives.tsx` with J1 (Sheet vs TabBar — different components); order them so the
  later one rebases. K is now a tiny standalone slice (one × button) and could fold into J1.
- L waits on G1; M waits on G2.
- Recommended order once Phase 0 is moving: **J1 → J2 → K**, with L and M following their gates.

## Housekeeping

- `claude-design.md` is already updated for the new feature-folder handoff model.
- CLAUDE.md "Currently building" is set to "UI Improvements"; reset to `_none_` on the last stream's
  merge.

### Consolidated doc-update PR at feature close-out (operator-directed)

Per Rajat, the documentation lands in **one consolidated doc-update PR once development is over**, not
as a kickoff PR up front. During development the handoff folder, `PLAN.md`, and the EM doc edits stay
uncommitted in the main dir (the pre-commit hook blocks commits from the main dir), and each stream's
brief embeds its spec since the handoff is not on `main` yet. The EM runs the per-slice design-compare
gate from the main dir where the handoff lives.

The close-out doc-update PR (authored from a worktree, needs operator merge approval) lands:

- The handoff folder `features/UI Improvements/` (incl. `PLAN.md`) onto `main`.
- The `claude-design.md` update (new feature-folder handoff model + three-doc set).
- The `DECISIONS.md` entries (custom-dish reframe, day-comment re-add, fruit override).
- All per-slice `docs/CHANGELOG.md` entries — **pending so far: #133 (J1)**; append each stream's on merge.
- CLAUDE.md "Currently building" reset to `_none_`.
- **Delete `design-catchup.md`** (superseded; the handoff is now level with live).
- Refresh main-dir working copies from `origin/main` first, additions-only, so no merged
  CHANGELOG/DECISIONS entry is dropped (the known main-dir-divergence caution).
