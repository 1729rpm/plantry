---
description: Run operational-doc reconciliation. Reads CHANGELOG entries since the last operational reconcile, identifies which operational docs and command briefs drifted, rewrites them in place to match shipped reality and the canonical docs, and opens a PR.
---

You are running operational-doc reconciliation for Plantry. This is a thinking exercise, not a script. The full spec lives in `MAINTENANCE.md` §7. Re-read it now. Read `docs/product.md` §4 (principles) and `docs/development.md` §5 (diagnosis card).

This pass reconciles the OPERATIONAL layer (orientation, operational specs, command briefs) against shipped reality and against the canonical docs. It is the sibling of `/reconcile-docs`, which owns the canonical specs in `docs/`.

## Style rules

The operational docs read as present-tense steady-state specs with no historical seams, the same standard the canonical docs hold. Apply the canonical style rules in `MAINTENANCE.md` §2.6 and the anti-patterns in §2.7; they are not restated here. Slash-command briefs keep their imperative step lists, but their descriptive prose follows the same no-historical-seams rule. No em dashes anywhere you write (commas, parentheses, semicolons, sentence breaks).

## Scope

In scope (the operational layer):

- `README.md`, `CLAUDE.md` (repo orientation, doc hierarchy, working folders, status).
- `MAINTENANCE.md`, `ADDING-DISHES.md` (operational specs).
- `claude-design.md` (the design contract).
- `.claude/commands/*.md` (the slash-command briefs).

Out of scope:

- `docs/*` (the canonical specs) are owned by `/reconcile-docs` (`MAINTENANCE.md` §2.5). If a canonical doc drifted, flag it for `/reconcile-docs`; do not edit it here.
- The append-only ledgers `DECISIONS.md`, `RETRO.md`, `docs/CHANGELOG.md`, and `data/changelog.md` are never rewritten by any reconciliation pass.

## Special instructions

- **README stays lean.** README should summarize and link to `docs/` rather than restate canonical product or engine facts; that duplication is what made it drift. When reconciling README, prefer trimming a restated fact to a pointer into `docs/` over re-syncing the duplicated number. A lean README that points at canon does not drift.
- **Command briefs point at canon.** The briefs reference the canonical specs instead of restating them, and each opens by telling the reader to re-read the spec. Reconciling a brief means keeping its pointer section-numbers valid and its procedure steps aligned to reality, not rewriting the canon it references.

## Arguments

- `since:<date>`. Narrow to CHANGELOG entries from this ISO date forward. Default: read `.maintenance-state` and process everything since the `last_reconcile_ops` marker.
- `dry-run`. Produce the per-doc diff sketches in the chat as if you were about to open the PR, but do not write files or push.

## What to do

1. **Load context.** Read the canonical docs in `docs/` (the source of truth the operational layer summarizes and points at), the operational docs and command briefs in scope, `MAINTENANCE.md` §7, and `CLAUDE.md`. Read `docs/CHANGELOG.md`. Cross-check operational claims against the canonical docs and against current code where checkable. Where an operational doc restates a canonical fact, the canonical doc wins.

2. **Determine the input window.** Read `.maintenance-state.last_reconcile_ops`. List every entry in `docs/CHANGELOG.md` since that date (or since the `since:<date>` argument). If none, write a one-line summary, bump `last_reconcile_ops` to today, and exit. An empty operational reconciliation is a healthy outcome, the same pattern `/reconcile-docs` follows.

3. **Per-doc affect map.** For each CHANGELOG entry, decide which operational doc(s) or command brief(s) it affects per `MAINTENANCE.md` §7.5. A single entry can touch both the canonical and operational layers; this pass owns only the operational side and keeps the pointer between the two valid.

4. **Per affected doc, rewrite the relevant sections in place.** Not as appends, not as "now also" additions. Present tense; the doc must still read as one coherent spec. For README, trim a restated fact to a pointer rather than re-syncing it. For command briefs, keep the pointers and procedure steps correct rather than rewriting canon. Verify claims against the canonical docs and code where checkable.

5. **Mechanical checks.** Run the same repository-structure check `/reconcile-docs` runs: verify the root inventory and folder naming against the authoritative allowlist in `MAINTENANCE.md` §2.9 (which mirrors the enforced list in `.github/workflows/ci.yml`) and the annotated layout in `docs/engineering.md` §14. Do not inline the allowlist here; read it from those sources. Flag mismatches in the PR description; do not move or rename files autonomously.

6. **Open the PR.**
   - Branch name: `docs/ops-<today's date>` in `YYYY-MM-DD` form (per `docs/development.md` §2).
   - Title: `docs/ops/<date>: <one-line summary>`. Under 70 characters.
   - Body opens with the CHANGELOG entries processed (one line each), then a list of operational docs touched and what moved in each, then "## Out of scope" naming entries deferred (including any canonical-doc drift flagged for `/reconcile-docs`), then any flagged mismatches.
   - One commit per operational doc touched, plus a final infrastructure commit for `.maintenance-state`.

7. **Update `.maintenance-state`.** Bump `last_reconcile_ops` to today's date in the same PR. Leave the other markers untouched.

8. **Hand off.** Post a one-paragraph status to Rajat: "PR opened, here is the URL, here are the docs touched, here is what I flagged for review."

## What to refuse

- Editing a canonical doc in `docs/`; that is `/reconcile-docs`'s lane (flag the drift instead).
- Rewriting an append-only ledger (`DECISIONS.md`, `RETRO.md`, `docs/CHANGELOG.md`, `data/changelog.md`).
- Re-syncing a duplicated product or engine number in README instead of trimming it to a pointer.
- Restating canon in a command brief that should point at it.
- Adding "previously" or "now also" phrasing, a stream letter, or a date inside a doc body (§2.7).
- Expanding scope beyond the CHANGELOG entries in the input window. If an operational doc is wrong about something not in the window, flag it in the PR description and leave the fix for next time or a focused chore PR.

## Why this command exists

The operational layer drifts under the same ship pressure the canonical docs do, and README drifts fastest because it duplicates facts that live canonically in `docs/`. `/reconcile-docs` keeps the canonical specs current; this command keeps the orientation, the operational specs, and the command briefs current and pointing at canon, so the two layers stay consistent instead of each carrying its own slowly-staling copy.
