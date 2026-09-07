# Pass: docs (pass 3)

Placeholders the EM fills before spawning: `{{DATE}}` (today, ISO), `{{WORKTREE}}` (the absolute
path of the maintenance worktree), `{{WINDOW_FROM}}` (the docs marker in `.maintenance-state`, or
the `since:` argument), `{{CONTENDED}}` (the files live streams own; skip and record them, never
edit them; `none` when there are none), `{{DEFERRED}}` (this pass's items from the state file's
Deferred section; `none` when there are none).

## Mandate

Make every document in the repo say what the repo actually does, in present tense, with no
historical seams. One pass, two lanes, one PR.

- **Lane A: the canonical specs.** `docs/product.md`, `docs/engine.md`, `docs/engineering.md`,
  `docs/development.md`.
- **Lane B: the operational layer.** `README.md`, `CLAUDE.md`, `MAINTENANCE.md`,
  `ADDING-DISHES.md`, `EVOLVING-THE-ENGINE.md`, `claude-design.md`, the skill and command briefs
  under `.claude/`, `RETRO.md`'s instructional header (its entries are history and stay untouched;
  its header is spec), and `app/web/e2e/*.mjs` (the UI crawl harnesses: their tab lists, selectors,
  and sheet flows are checked against the live app's surfaces, so a surface change never leaves the
  crawl asserting a retired tab).

Where an operational doc restates a canonical fact, the canonical doc wins. Keeping the pointer
between the two layers valid is this pass's job, and it is the job neither of the two passes this
one replaces owned.

Producing this quality of writing while shipping a feature is unreliable, which is why it is a
separate pass and not a step in a ship workflow.

## Reading list

Read in this order. The deferred list comes before the window, deliberately: an item that survived a
pass does not wait for a new CHANGELOG entry to justify a second look.

1. `{{DEFERRED}}`, this pass's deferred items.
2. The standing checks below, every run, regardless of the window.
3. `docs/CHANGELOG.md` entries from `{{WINDOW_FROM}}` to `{{DATE}}`. Each entry's `Updated:` line is
   the primary work queue: it names the doc sections the shipping session judged stale. Verify that
   judgment rather than re-deriving every entry's doc impact from the diff, and still scan the entry
   body for impact the line missed.
4. The current canonical docs and operational docs in scope, to preserve voice and structure. Each
   has an established register; read the existing sections as a style anchor before writing new
   ones.
5. `features/` if anything is active, plus any feature spec a recent CHANGELOG entry references
   (`archive/features/<name>.md` after ship).
6. Current code under `engine/`, `app/`, plus the data files, to cross-check that doc claims match
   reality.

## Forbidden inputs and forbidden actions

- **Rewriting an append-only ledger.** `DECISIONS.md`, `RETRO.md`, `docs/CHANGELOG.md`, and
  `data/changelog.md` are never rewritten by this pass. The retro pass edits `RETRO.md` `Status:`
  lines in place and nothing else. The one carve-out is `RETRO.md`'s instructional header, which is
  spec rather than history and is this pass's to correct.
- **Editing `docs/engine.md` for anything but wording that describes shipped code.** If shipped
  reality changed the engine's rules, that is `/evolve-engine`'s (`MAINTENANCE.md` §1), and this
  pass records the divergence rather than resolving it in the spec's favour.
- **Any file in `{{CONTENDED}}`.** Skip it and record it.
- **Widening beyond the window**, except for the standing checks and `{{DEFERRED}}`. Anything else a
  doc is wrong about goes into the artifact's Deferred section, not into this PR.

## Standing checks

Claims known to have gone false once, verified every run whatever the window says. Four false or
stale claims survived two window-scoped passes because each predated the window; these are the
shapes that produced them.

1. **The spec-code parity claim.** `docs/product.md` §4 Principle 3, `docs/engineering.md` §15, and
   `docs/engine.md` §13 and §16.2 all describe how `docs/engine.md` and `engine/` are kept in
   lockstep. The pairing is held by review, not by a CI check. Every document that describes it says
   so, in those words, until a check actually exists.
2. **Section-number pointers.** Every `<file>.md §<n>` cross-reference in a canonical or operational
   doc resolves to a section that exists and is about what the citing sentence says it is about.
   Grep them and check them; a renumber in one doc silently rots pointers in five others.
3. **The command and skill inventory.** Every skill under `.claude/skills/` and every command under
   `.claude/commands/` appears where the docs enumerate them (`CLAUDE.md`, `docs/engineering.md`
   §14), and nothing appears there that does not exist.
4. **The root inventory.** The two written inventories, `MAINTENANCE.md` §4.5 and
   `docs/engineering.md` §14, agree with each other and with the enforced allowlist regex in
   `.github/workflows/ci.yml`. The regex is authoritative for what CI permits; the annotated layout
   in `docs/engineering.md` §14 is authoritative for what each entry is. The live tree is checked by
   the hygiene pass, not here: this check is about what the documents claim.
5. **Branch names.** Every branch convention a doc names is one `docs/development.md` §2 defines.

## Per-doc affect map

Lane A:

| CHANGELOG entry touches                                                                                                                                 | Update target         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| Product scope, persona, principles, tone, future direction                                                                                              | `docs/product.md`     |
| Rules, slot composition, selection priority, item cap, ingredient consolidation, field reference                                                        | `docs/engine.md`      |
| Stack, schema, data layer split, deploy model, hosting, integrations, env vars, image format                                                            | `docs/engineering.md` |
| Session model, worktree workflow, ship workflow, definition of done, diagnosis card, maintenance trigger, escalation, commit conventions, anti-patterns | `docs/development.md` |

Lane B:

| CHANGELOG entry touches                                          | Update target                                                  |
| ---------------------------------------------------------------- | -------------------------------------------------------------- |
| Repo orientation, doc hierarchy, working folders, project status | `README.md`, `CLAUDE.md`                                       |
| The two slow workflows and the dish-add playbook                 | `MAINTENANCE.md`, `EVOLVING-THE-ENGINE.md`, `ADDING-DISHES.md` |
| The design contract                                              | `claude-design.md`                                             |
| A skill or command brief's procedure, pointers, or arguments     | `.claude/skills/**`, `.claude/commands/*.md`                   |
| An app surface, tab, or sheet flow the crawl asserts             | `app/web/e2e/*.mjs`                                            |

A single shipped change often touches more than one doc, and often both lanes. Cross-doc consistency
is this pass's responsibility.

## What you do

1. **Load context** per the reading list.
2. **Determine the window.** If there are no CHANGELOG entries since `{{WINDOW_FROM}}` and
   `{{DEFERRED}}` is `none`, still run the standing checks, then write a one-line artifact and stop.
   An empty docs pass is a healthy outcome.
3. **Map each entry** to its documents per the affect map. Start with the `Updated:` lines.
4. **Rewrite the relevant sections in place.** Not as appends, not as "now also" additions. The
   document must still read as one coherent spec after the edit. Verify factual claims against
   current code where checkable.
5. **README stays lean.** When an entry changes a product or engine fact that `README.md` restates,
   trim the restated fact to a link into `docs/` rather than copying the new value. The duplication
   is the drift source; a lean README that points at canon does not drift.
6. **Briefs point at canon.** A skill or command brief references the canonical spec instead of
   restating it, and each opens by telling the reader to re-read the spec. Reconciling a brief means
   keeping its pointer section-numbers valid and its procedure steps aligned to reality, not
   rewriting the canon it references.
7. **Run the standing checks** and fold their findings into the same PR.
8. **Commit one document per commit**, lane A's commits before lane B's, so the canonical layer
   lands ahead of the operational restatements of it.

## Style rules

Apply to every rewrite this pass produces, in both lanes.

- **Present tense.** "The docs pass runs when Rajat invokes it." Not "The docs pass will run" or
  "reconciliation was added in feat/E1".
- **One coherent document.** Section order is stable. Updates happen in place.
- **No slice, round, sprint, or date references** inside the document body. The reader should not
  see the historical seams.
- **No changelog phrasing.** Strip "previously", "now also", "we used to", "this was added
  because". The CHANGELOG holds the chronology.
- **Preserve voice.** Each document has an established register; read the existing sections as a
  style anchor before writing new ones.
- **Cross-reference by section number within a document**, by canonical filename across documents.
- **No em dashes.** Commas, parentheses, semicolons, sentence breaks.

Skill and command briefs keep their imperative step lists, but their descriptive prose follows the
same no-historical-seams rule.

## Anti-patterns to reject before opening the PR

- "Added in feat/X" or "introduced in slow-loop/2026-..."
- "Previously X, now Y"
- `(new)` or `(updated)` markers in headings
- Inline dates like "(as of 2026-06-08)"
- Past-tense narrative
- Re-syncing a duplicated product or engine number in `README.md` instead of trimming it to a
  pointer into `docs/`
- Restating canon in a brief that should point at it

If a rewrite needs any of these to make sense, the pass is doing it wrong. The document describes end
state; the why goes in the CHANGELOG entry or the archived feature spec.

## Conflict handling

- **Two CHANGELOG entries disagree:** latest ships wins; the older statement is overwritten in the
  document. Flag it in the PR description.
- **CHANGELOG disagrees with current code:** code wins; the document is updated to match code
  reality. Flag it for human review.
- **Ambiguous which document owns a change:** write your best guess and flag it for review.
- **A canonical doc and an operational doc disagree:** the canonical doc wins, and the operational
  restatement is trimmed to a pointer where it can be.

## Output artifact

`features/maintenance-{{DATE}}/docs.md`. Write it before you report.

Required sections, in this order:

1. **Basis.** The window (`{{WINDOW_FROM}}` to `{{DATE}}`), the CHANGELOG entries in it (one line
   each), and the deferred items you carried in.
2. **Standing checks.** Each of the five, with `pass` or the drift you found and what you did.
3. **Lane A: canonical documents.** One block per document: what moved, and the CHANGELOG entry or
   standing check that forced it. `untouched` for a document you did not change.
4. **Lane B: operational documents and briefs.** Same shape.
5. **Conflicts and flags.** Every conflict you resolved under the rules above, and how.
6. **Deferred.** Anything a document is wrong about that fell outside the window and outside the
   standing checks, plus every file in `{{CONTENDED}}` you skipped, each with one line of context.
   The EM copies this into `.maintenance-state`.
7. **Commit plan.** The commit order, one document per commit, lane A first.

## What to refuse

- **Rewriting an append-only ledger.**
- **Editing `docs/engine.md` for anything but wording that describes shipped code.** The pairing is
  held by review rather than by a CI check (`docs/engine.md` §16.2), so nothing mechanical will stop
  you shipping half of an engine change here. Do not start one.
- **A historical seam of any kind**, in either lane.
- **Widening beyond the window**, except the standing checks and the deferred list. Flag it and
  defer it instead.
- **Moving or renaming a file autonomously.** Mismatches are flagged; the hygiene pass and Rajat
  decide.
- **Editing a file a live stream owns.**

## Report format

Report back in prose, under 400 words: the window and the entries in it, the standing checks and
what they found, the documents touched in each lane with one line each, the conflicts you flagged,
anything you deferred and why, and the artifact path. Do not paste the rewrites into your report;
the artifact and the diff are the deliverables.
