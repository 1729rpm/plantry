# Playbook migration: Plantry

Brief for aligning this repo with the cross-project standard at
`~/Downloads/AI Products/DEVELOPMENT-PLAYBOOK.md`. Plantry is the closest of the three projects to the
playbook; most of the playbook IS Plantry's system generalized. The gaps are the new
phase layer, the changelog format, and two small adoptions from Cadence. Section
numbers below (§) refer to the playbook.

How to land this: the EM batches the ledger and tooling changes into one
`chore/playbook-migration` PR, adds the CHANGELOG entry with an `Updated:` line, then
routes the `docs/development.md`, `MAINTENANCE.md`, and CLAUDE.md edits through
`/reconcile-docs` and `/reconcile-ops` per this repo's own rules.

## Already aligned (no change)

EM session model, worktree-per-session with the main-dir pre-commit hook, the
live-session registry with file lanes and the hotspot ledger, later-merger-owns-the-
rebase, the true-merged-state pre-merge gate, squash merge via reviewed PR, cleanup as
part of the merge step, the diagnosis card, DECISIONS.md and RETRO.md with the retro
intake pass, human-triggered reconciliation (docs and ops), single-writer CHANGELOG,
no co-author trailers, imperative commit style, staging by path. All of these are now
the cross-project standard, largely verbatim from this repo.

## P1: Structural changes

1. **Add the phase layer (§3).** Create `docs/PLAN.md` with the phase table
   (retroactively record the shipped state as completed phases at whatever grain is
   honest; one "V1 shipped" row is fine). Going forward, phase-sized work gets a
   `features/phase-<n>-<name>.md` spec; the existing feature-spec shape (stream-state
   table, lanes, decisions) already matches the template, so this is a naming and
   framing change, not a rework. Add the session-start ritual ("Begin development. We
   are on Phase XYZ.", §3.4) to `docs/development.md`.

2. **Extend feature close-out into the phase-close checklist (§3.5).**
   `docs/development.md` §3 step 8 already covers archiving the spec, resetting the
   CLAUDE.md line, and queueing reconciliation. Add the two missing steps: flip the
   phase's row in `docs/PLAN.md`, and push an annotated tag
   (`git tag -a phase-<n>-complete -m "..."`). The repo has zero tags today; tags give
   `git log tagA..tagB` answers to "what did that phase contain" permanently.

3. **Changelog entry format (§9.1).** Current entries are one line (date, what
   shipped, PR link). Add the `Why:` and `Updated:` lines. The `Updated:` line is the
   load-bearing one: it is the work queue for `/reconcile-docs`, which today has to
   re-derive each entry's doc impact by reading the diff. This was resolved
   deliberately in the playbook (§12 row 3): Cadence's rich format was too much
   ceremony, but the one-liner loses the reconciliation queue. Entries stay EM-batched
   and single-writer; only the shape changes.

## P2: Process and doc edits

4. **Ban em dashes everywhere, not just user-facing.** CLAUDE.md's project-specific
   style section currently allows em dashes in internal docs (specs, CHANGELOG,
   DECISIONS, briefs). The playbook (§12 row 12) and the standing global formatting
   preference ban them in all produced documents. Edit the CLAUDE.md style section via
   `/reconcile-ops`; strip existing ones opportunistically as reconciliation touches
   sections.

5. **Adopt the memory-merge step from Cadence (§12 row 10).** Engineer sessions run in
   worktrees, and Claude Code derives its memory directory from the working directory
   path, so a worktree session writes memory to a different directory than the main
   repo. Today those memories evaporate when the worktree is removed. Port Cadence's
   `end-session.sh` merge step (diff the worktree memory dir into the canonical one,
   surface conflicts, never auto-resolve) into the worktree-closure step of the ship
   workflow, or fold it into the EM's merge-time checklist.

6. **Point at the playbook.** Add one line to CLAUDE.md: process standard is
   `~/Downloads/AI Products/DEVELOPMENT-PLAYBOOK.md`; `docs/development.md` keeps only this repo's
   genuine deltas (EM mode, the slow loop, content-batch branch series, the crawl
   gate, real-device iOS verification). Record the session-model choice explicitly:
   EM mode (§4).

## P3: Optional

7. **Automated cleanup backstop (§5.2).** The synchronous cleanup-at-merge rule stays
   primary; port Cadence's three-guard sweep (branch gone from origin, worktree clean,
   commits on main by patch-id) as a scheduled safety net for the strays the manual
   sweep catches today.
8. **`.worktreeinclude`** for gitignored env files, if engineer worktrees ever need
   env that `/new-stream` does not already provision.

Root-allowlist note: `docs/PLAN.md` lives inside `docs/` and should pass the CI root
allowlist untouched, but confirm the docs-folder checks in `MAINTENANCE.md` §2.9 and
the CI workflow do not enumerate `docs/` contents; if they do, add the file.

## Definition of done for this migration

- P1 and P2 landed; P3 decided (adopt or record as skipped in the PR).
- CHANGELOG entry (in the new format, as its own first example) with the `Updated:`
  line.
- `/reconcile-docs` and `/reconcile-ops` PRs merged so `docs/development.md`,
  `MAINTENANCE.md`, and CLAUDE.md describe the new steady state.
- This brief moved to `archive/features/`.
