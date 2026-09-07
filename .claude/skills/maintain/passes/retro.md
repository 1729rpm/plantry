# Pass: retro (pass 4)

The EM runs this pass inline, in its own session, not as a spawned agent. `RETRO.md` is the EM's
ledger of its own friction, and every fix is a judgment about how streams actually run.

Placeholders the EM fills before starting: `{{DATE}}` (today, ISO), `{{WORKTREE}}` (the absolute
path of the maintenance worktree), `{{WINDOW_FROM}}` (the retro marker in `.maintenance-state`),
`{{CONTENDED}}` (the files live streams own; skip and record them, never edit them; `none` when
there are none), `{{DEFERRED}}` (this pass's items from the state file's Deferred section; `none`
when there are none).

## Mandate

Turn the EM's own process and system friction into process and system change. The signals pass turns
the household's feedback into product change; this is the same machinery pointed inward, so the
two-loops principle (`docs/product.md` §4) holds: shipping is the fast loop, improving how we ship is
the slow loop.

Friction the EM hits while running streams (a gate that does not work as documented, a recurring
merge conflict, a watchdog that kills agents) evaporates at session end unless it is captured and
triaged. `RETRO.md` is the durable, append-only ledger of that friction; this pass is how it converts
into fixes instead of being re-discovered every session.

By the evidence this is the highest change-per-run pass of the five, and until now it was the only
job with no brief, no command, and no fixed branch name.

## The window is a status, not a date

Read **every entry whose `Status:` is `open`, `triaged`, or `fixed in part`, whatever its date**,
plus everything appended since `{{WINDOW_FROM}}`. A date window loses an entry the moment one pass
declines to close it, and two entries dated 2026-08-18 were already invisible to the date-windowed
read this pass replaces.

`{{DEFERRED}}` comes first, before either.

## Reading list

- `RETRO.md`, every entry matching the status window above, plus every entry appended since
  `{{WINDOW_FROM}}`.
- The documents and files those entries point at: `docs/development.md`, `docs/engineering.md`, the
  skill and command briefs under `.claude/`, `.github/workflows/ci.yml`, the scripts under
  `scripts/`.
- `docs/product.md` §4 (the principles), `docs/development.md` §5 (the diagnosis card), §7
  (escalation), §11 (parallel-session coordination).
- `MAINTENANCE.md` §1 (the boundary) and §4.4.

## Forbidden inputs and forbidden actions

- **Rewriting any part of a `RETRO.md` entry other than its `Status:` line.** The ledger is
  append-only history. You update the status in place and you touch nothing else in the entry.
- **Editing a canonical doc in `docs/` here.** That is the docs pass's lane. A retro fix that needs a
  canonical-doc edit is handed to the docs pass in the same sitting, and if the docs pass has already
  run, it is deferred to the next one and recorded.
- **Silently actioning an infra or cost item.** Anything needing a secret, a paid tier, a new
  merge-blocking CI gate, or a destructive action is surfaced to Rajat in the PR body, never done
  (`docs/development.md` §7).
- **Any file in `{{CONTENDED}}`.**

## What you do

1. **Read the open entries** and cluster them by Area and root cause. Several entries often share one
   fix.
2. **Right-size each cluster** (`docs/product.md` §4 Principle 1): pick the smallest level that
   solves it (a brief-template line, a process-doc edit, a CI or test change, tooling, an infra
   item), or `no-change` with a stated reason. Do not generalize from a single one-off entry; an
   entry whose recurrence reads as `one-off` is usually `no-change`.
3. **Land the fix on the right path.**
   - A brief line, a CI or tooling edit, a script fix: the docs PR's third commit group, in this
     sitting.
   - A canonical-doc edit: hand it to the docs pass in this sitting, or defer it and record it.
   - Anything stream-sized (a Convex mutation, a new script, a schema field): a `chore/*` request
     spawned through `/new-stream`, named in the PR body.
   - Anything needing Rajat: surfaced in the PR body, not actioned.
4. **Update each consumed entry's `Status:` line in place** to `fixed (PR #NNN)`, `fixed in part
   (PR #NNN)` with what remains and who owns it, `wont-fix (reason)`, or `triaged (owner, path)`
   when the fix is filed but not yet landed. Never rewrite the rest of the entry.
5. **Write the artifact**, then carry its table into the docs PR body.

## How EMs file entries

At session close the EM appends a `RETRO.md` entry for each systemic or recurring friction (the
format and the "what to log" test live in `RETRO.md`). One-off self-inflicted slips are not logged.
The entry's `Proposed level` is the EM's first-cut sizing; this pass makes the final call.

## Output artifact

`features/maintenance-{{DATE}}/retro.md`. Write it before the docs PR opens.

Required sections, in this order:

1. **Basis.** How many entries matched the status window, how many were appended since
   `{{WINDOW_FROM}}`, and the deferred items you carried in.
2. **Clusters.** One numbered cluster per root cause, naming the entries in it, the sizing, the
   chosen level, and the reason.
3. **The status table.** One row per consumed entry: the entry's date and title, its old status, its
   new status, and where the fix landed.
4. **Filed as streams.** Every `chore/*` request, with the one-line brief it carries.
5. **For Rajat.** Every infra, cost, secret, or merge-blocking-gate item, each with what it would
   take and what it would buy. `none` when there are none.
6. **Deferred.** Every entry left open and why, plus every file in `{{CONTENDED}}` you skipped. The
   EM copies this into `.maintenance-state`.

## Anti-patterns

- Logging one-off slips, turning the ledger into noise (the over-broad-ledger failure `RETRO.md`
  itself warns about).
- Fixing a single entry with a cross-cutting abstraction before two entries need it
  (`docs/product.md` §4 Principle 8).
- Editing canonical docs in this pass directly instead of routing through the docs pass
  (`docs/development.md` §11.4).
- Silently actioning an infra or cost item that should be surfaced to Rajat.
- Closing an entry because it is old rather than because it is fixed.

## Report format

One paragraph in the sitting's log: how many entries the status window matched, the clusters and
their chosen levels, which entries changed status and to what, what was filed as a stream, what went
to Rajat, and the artifact path.
