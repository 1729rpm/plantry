---
description: Run canonical-doc reconciliation. Reads CHANGELOG entries since the last reconcile, identifies which canonical docs are affected, rewrites them in place to match shipped reality, and opens a PR.
---

You are running canonical-doc reconciliation for Plantry. This is a thinking exercise, not a script. The full spec lives in `MAINTENANCE.md` §2. Re-read it now. Read `docs/product.md` §4 (principles) and `docs/development.md` §5 (diagnosis card).

Reconcile-docs runs only when Rajat invokes it. Canonical docs in `docs/` must read as coherent present-tense specs with no historical seams; producing that quality of writing while shipping a feature is unreliable, so reconciliation runs as a separate human-triggered pass.

## Style rules and anti-patterns

Apply the style rules canonical in `MAINTENANCE.md` §2.6 and the anti-patterns canonical in `MAINTENANCE.md` §2.7 to every rewrite. Re-read both before writing; they are not restated here. The short of it: present tense, one coherent document, no historical seams (no slice, round, sprint, or date references in the body), no changelog phrasing, no em dashes.

## Per-doc scope

The per-doc scope map (which CHANGELOG entry updates which canonical doc) is canonical in `MAINTENANCE.md` §2.5. A single shipped change often touches more than one doc; keeping cross-doc consistency is the reconciliation job's responsibility.

`MAINTENANCE.md` is not a canonical doc; it is the spec for the canonical-doc reconciliation. If the session finds drift in `MAINTENANCE.md` itself (for example, references to functions that were renamed), include the fix in this PR with a clear scope note in the description, but do not let it expand into a broader rewrite. Drift in the other operational docs (`README.md`, `CLAUDE.md`, `ADDING-DISHES.md`, `claude-design.md`, the command briefs) is `/reconcile-ops`'s lane (`MAINTENANCE.md` §7); flag it rather than fixing it here.

## Conflict handling

Conflict handling (two CHANGELOG entries disagree, CHANGELOG disagrees with code, ambiguous ownership) is canonical in `MAINTENANCE.md` §2.8. Follow it and flag the resolution in the PR description.

## Arguments

- `since:<date>`. Narrow to CHANGELOG entries from this ISO date forward. Default: read `.maintenance-state` and process everything since the `last_reconcile` marker.
- `dry-run`. Produce the per-doc diff sketches in the chat as if you were about to open the PR, but do not write files or push.

## What to do

1. **Load context.** Read `docs/product.md`, `docs/engine.md`, `docs/engineering.md`, `docs/development.md`, `MAINTENANCE.md`, and `CLAUDE.md`. Read `data/changelog.md` and `docs/CHANGELOG.md`. Read `features/` if anything is active, plus any feature spec referenced by recent CHANGELOG entries (`archive/features/<name>.md` after ship). Cross-check doc claims against current code under `engine/`, `app/`, plus the data files.

2. **Determine the input window.** Read `.maintenance-state.last_reconcile`. List every entry in `docs/CHANGELOG.md` since that date (or since the `since:<date>` argument). If none, write a one-line summary, bump `last_reconcile` to today, and exit. An empty reconciliation is a healthy outcome.

3. **Per-doc affect map.** For each CHANGELOG entry, decide which canonical doc(s) it affects per §2.5. A single entry can affect multiple docs; keep cross-doc consistency in mind from the start.

4. **Per affected doc, rewrite the relevant sections in place.** Not as appends, not as "now also" additions. The doc must still read as one coherent spec after the edit. Verify factual claims against current code where checkable. Apply the style rules above.

5. **Open the PR.**
   - Branch name: `docs/maintenance-<today's date>` in `YYYY-MM-DD` form (per `docs/development.md` §2).
   - Title: `docs/maintenance/<date>: <one-line summary>`. Under 70 characters.
   - Body opens with the CHANGELOG entries processed (one line each), then a list of canonical docs touched and what moved in each, then "## Out of scope" naming entries deferred, then any flagged conflicts per §2.8.
   - One commit per canonical doc touched, plus a final infrastructure commit for `.maintenance-state` and any `.claude/commands/` updates.
   - For a dry-run (the `dry-run` argument), produce the per-doc diff sketches in the chat as if you were about to open the PR, but do not write files or push.

6. **Update `.maintenance-state`.** Bump `last_reconcile` to today's date in the same PR.

7. **Mechanical checks (per `MAINTENANCE.md` §2.9).** Verify the root inventory and folder naming against the authoritative allowlist in `MAINTENANCE.md` §2.9 (which mirrors the enforced list in `.github/workflows/ci.yml`) and the annotated layout in `docs/engineering.md` §14. Empty-but-anticipated directories carry `.gitkeep`. Flag mismatches in the PR description; do not move or rename files autonomously.

8. **Hand off.** Post a one-paragraph status to Rajat: "PR opened, here is the URL, here are the docs touched, here is what I flagged for review."

## What to refuse

- Rewriting a doc to mention a specific PR, stream letter, or date.
- Adding "previously" or "now also" phrasing.
- Touching `docs/engine.md` without a paired engine code and test change (the CI parity gate also catches this; do not fight the gate). If shipped reality changed engine rules, the slow loop is the right tool, not reconciliation.
- Expanding scope beyond the CHANGELOG entries in the input window. If a doc is wrong about something not in the window, flag it in the PR description and leave the fix for next time or for a focused chore PR.

## Why this command exists

Canonical docs drift fastest under ship pressure: a feature lands, the CHANGELOG entry records the chronology honestly, but the canonical doc carries the old steady-state until someone notices. Reconciliation runs against the CHANGELOG so the docs catch up methodically, in present tense, without the seams the rest of the repo accumulates.
