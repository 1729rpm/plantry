# Pass: hygiene (pass 5)

The EM runs this pass inline, in its own session, not as a spawned agent. It is five minutes of
mechanical checks over the finished tree, and it runs last so it sees the state the other four
passes left.

Placeholders the EM fills before starting: `{{DATE}}` (today, ISO), `{{WORKTREE}}` (the absolute
path of the maintenance worktree), `{{WINDOW_FROM}}` (the hygiene marker in `.maintenance-state`),
`{{CONTENDED}}` (the files live streams own; skip and record them, never edit them; `none` when
there are none), `{{DEFERRED}}` (this pass's items from the state file's Deferred section; `none`
when there are none).

## Mandate

Check the repository itself: the tree, the branches, the worktrees, the deployments, the status
lines. Do the safe things; list the rest for Rajat.

This pass exists because every item in it was done on instinct at a previous sitting, or not at all.
Seven merged branches sat on the remote, a prototype worktree lived in the repo for months, retired
tables sat on the dev deployment, an untracked report file sat at root. None of it was in any brief,
so none of it was anybody's job.

## Reading list

`{{DEFERRED}}` first. Then:

- `ls -A` at the repository root, against the enforced allowlist regex in
  `.github/workflows/ci.yml` and the annotated layout in `docs/engineering.md` §14.
- `git status --short` and `git status --ignored --short` at the root of `{{WORKTREE}}`.
- `git branch -r` and, for each remote branch that is not `main`,
  `gh pr list --head <branch> --state all`.
- `git worktree list`, against `coordination/active-streams.md`.
- The dev Convex deployment `lovely-curlew-631`'s table list, against `app/convex/schema.ts`.
- `CLAUDE.md`'s "Currently building" line, against `features/` and `docs/PLAN.md`.
- `MAINTENANCE.md` §4.5 (the written root inventory).

## Forbidden inputs and forbidden actions

- **Any write to production.** The dev deployment is inspected; production is not touched at all.
- **Moving or renaming a file autonomously.** A misplaced file is reported, never relocated.
- **Deleting anything other than a remote branch whose PR is merged or closed.** Every other
  deletion, a worktree, a directory, a table, a file, goes on the list for Rajat.
- **Any file in `{{CONTENDED}}`.**

## The checks

1. **Root inventory.** Run the same loop CI runs, from `.github/workflows/ci.yml`: every entry
   `ls -A` returns at the repository root matches the allowlist regex. An entry that does not is
   either a file that should not be at root (report it) or an addition the allowlist and both
   written inventories should carry (report the three-place edit: the regex, `MAINTENANCE.md` §4.5,
   and `docs/engineering.md` §14). Gitignored local entries CI never sees are noted, not failed.
2. **`.gitkeep`s.** Every empty-but-anticipated directory carries one. `features/` is the standing
   case.
3. **Folder naming.** Against the conventions in `docs/engineering.md` §14: kebab-case folders under
   `archive/`, `docs/`, `features/`, and `app/web/src/components/`; PascalCase TypeScript component
   files; camelCase TypeScript non-component files (a hyphen in a file under `app/convex/` silently
   breaks the Convex deploy); UPPERCASE root markdown with `claude-design.md` as the one named
   exception.
4. **Remote branches.** Every remote branch that is not `main` and whose PR is merged or closed is
   deleted. That is the one destructive action this pass takes on its own. A remote branch with an
   open PR or no PR at all is listed, never deleted.
5. **Worktrees.** Every entry in `git worktree list` other than the main directory has a Live row in
   `coordination/active-streams.md`. One that does not is listed for Rajat with the branch it is on
   and whether that branch has merged.
6. **The dev deployment.** Tables on `lovely-curlew-631` that `app/convex/schema.ts` no longer
   declares are listed for Rajat. Never dropped by this pass.
7. **`CLAUDE.md`'s status line.** "Currently building" reads `_none_` when `features/` holds only
   `.gitkeep`, and names the active feature otherwise (`docs/development.md` §3 step 8).
8. **Untracked and unformatted files.** Anything `git status` shows untracked that is not gitignored,
   and anything `npm run format:check` would redden. A stray report or scratch file at root is the
   recurring case.
9. **The state file.** `.maintenance-state` carries a row for all five passes, every row's status is
   `done` or `pending` (never `running`), and every deferral counted in a row appears in the Deferred
   section with an owning pass.

## Output artifact

`features/maintenance-{{DATE}}/hygiene.md`. Write it before the docs PR opens.

Required sections, in this order:

1. **Basis.** The commands you ran and the deferred items you carried in.
2. **The check table.** One row per check above: the check, `clean` or what you found, and what you
   did about it.
3. **Done.** Every action this pass took, each with the check that justified it.
4. **For Rajat.** Every destructive or ambiguous item, each with what it is, why it looks stale, and
   what deleting it would cost if the judgment is wrong. `none` when there are none.
5. **Deferred.** Anything left, plus every file in `{{CONTENDED}}` you skipped. The EM copies this
   into `.maintenance-state`.

## Anti-patterns

- Deleting on a guess. A branch whose PR merged is safe; anything else is a list item.
- Renaming a file to satisfy a convention without checking what imports it.
- Reporting "the tree is clean" without having run the loop.
- Fixing a root-inventory mismatch in one of the three places and not the other two.

## Report format

One paragraph in the sitting's log: which checks were clean, what you found, what you did, what went
on the list for Rajat, and the artifact path.
