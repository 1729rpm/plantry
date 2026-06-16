# Plantry — Maintenance

Spec for the two human-triggered jobs that keep the repo healthy: the slow loop (turning accumulated user feedback into structural change) and canonical-doc reconciliation (keeping `docs/product.md`, `docs/engine.md`, `docs/engineering.md`, `docs/development.md` aligned to shipped reality).

Both jobs run from Claude Code sessions invoked by Rajat. Neither is on a cron. The session is the trigger; the output is always a pull request; the merge is the approval.

## 1. The slow loop

### 1.1 Why

User feedback accumulates in Convex during the week as several signal channels: queued `comments` rows (explicit feedback the user typed), queued `manualChanges` rows (observed behavior, one row per swap, custom one-off, delete, add, day skip, day restore, or save-for-next-week, each with the user's stated reason), queued `nextWeekQueue` rows (dishes the user saved from Explore), queued `dishDislikes` rows (a records-only tap on a dish in Explore), and runtime `incidents` from the auto-recovery middleware. The loop also reads two non-blocking reports (the coverage report and the pool-coverage report, both from `npm run reports`) so it can act proactively, not only reactively. None of these can be applied directly: each cluster needs right-size diagnosis before becoming a structural change. The slow loop is the only path by which the dish library (`data/dishes/<slug>.md`), the ingredient catalog (`data/ingredients.md`), `docs/engine.md`, `engine/`, or `data/changelog.md` change.

### 1.2 Trigger

Rajat opens a Claude Code session in the main repo directory and types `/slow-loop`. Convention is Sunday morning around 11am IST, but the cadence is not enforced. The session can also be passed a specific date range (`/slow-loop since:2026-05-01`), a focus theme (`/slow-loop focus:spice`), or a fixture path (`/slow-loop --fixture data/test-fixtures/slow-loop`). The fixture path is for EM dry-runs against the synthetic signals at `data/test-fixtures/slow-loop/`: `queued-comments.example.json`, `manual-changes.example.json`, `incidents.example.json`, `next-week-queue.example.json`, and `dish-dislikes.example.json`; when passed, the session reads from those files instead of Convex. Any fixture file that is absent reads as zero queued rows of that signal, so older fixtures (which predate a given channel) still dry-run cleanly.

### 1.3 Inputs the session reads

Reactive signals (what the user did or said this week):

- All `queued` rows in Convex `comments` (via `npx convex run queries/comments:listQueuedComments`).
- All `queued` rows in Convex `manualChanges` (via `npx convex run queries/manualChanges:listQueuedManualChanges`). These now span swap, custom, delete, add, skip_day, restore_day, and save_next_week kinds; the kind plus `reason` is the signal.
- All `queued` rows in Convex `nextWeekQueue` (dishes saved from Explore that have not yet been placed by a generation run).
- All `queued` rows in Convex `dishDislikes` (records-only Explore taps). The table is a live signal channel that collects real Explore-tap rows.
- All open `incidents` from Convex (via `npx convex run queries/incidents:listIncidents`).

Proactive signals (the health of the library itself, independent of any user action):

- The coverage report and the pool-coverage report from `npm run reports`. Coverage shows enrichment and macro completeness; pool-coverage shows how many eligible candidates each slot has per season, flagging thin pools (two or fewer). Neither is a CI gate; both are judgment the slow loop acts on.

Context (read, not clustered on directly):

- Current `data/dishes/` (the per-dish files), `data/ingredients.md` (the ingredient catalog), `data/menu_history.md`, `data/changelog.md`.
- Current `docs/engine.md` plus `engine/src/` for the engine state.
- Recent Convex `weekArchive` rows for context on what was actually cooked.

### 1.4 What the session does

1. Cluster comments + manual changes + queue rows + dislikes + incidents by theme (e.g. "spice tolerance varies day to day", "we never cook lauki anymore", "fish pack size feels off", "Tuhina ordered in Thursdays in May", "rajma keeps getting swapped to chole with reason 'bored of rajma'"). A cluster can mix rows from any of the signal tables when they touch the same underlying property. Manual changes, queue rows, and dislikes are observed behavior, not rule violations; the slow loop reads them as signal for what the engine got wrong, then asks whether the rule should change.

   Signal patterns to look for, each subject to right-size discipline (a single instance is almost always no change; the threshold is a pattern across weeks or across both household members):
   - **Skips** (`manualChanges` kind `skip_day`). Recurring skips of the same day read as a calendar pattern. Three Friday skips in a month is a structural look (a standing day-override); one Friday skip is one eat-out night, no change.
   - **Deletes** (`manualChanges` kind `delete`). Repeated deletes from the same slot type read as over-generation: the meal carries more dishes than the household wants. The right-size answer may be an item-cap or composition adjustment for that slot, not a per-dish edit.
   - **Adds** (`manualChanges` kind `add`). Repeated manual adds of the same category read as under-generation: the engine is leaving a slot too sparse. The fix mirrors deletes in the opposite direction.
   - **Saves** (`manualChanges` kind `save_next_week`, and `nextWeekQueue` rows). A dish saved repeatedly is a dish the engine under-picks; the right-size answer may be flipping its `preferred` flag or revisiting its recency treatment. Separately, stale queued rows (saved weeks ago, never placed) are signal too: the loop may mark them `dropped` with a reason rather than carry dead intent forward.
   - **Unplaceable requests** (`nextWeekQueue` rows that stay `queued` with an incident trail). A saved dish that composition keeps rejecting means either the dish is mis-categorized or the composition is too rigid. Both are classic right-size calls (a data-row recategorization versus a rule loosening).
   - **Dislikes** (`dishDislikes` rows). A dish disliked once is no change. A dish disliked repeatedly, or disliked by both household members, is the threshold for a deactivation or an explore down-rank. The optional reason, when present, sharpens which way to go. The fast loop never acts on a dislike; the slow loop is the only path to any consequence.

2. For each cluster, apply right-size discipline (`docs/product.md` §4 Principle 1):
   - Size: one-off, small pattern, structural.
   - Smallest level that fixes it: data row, new tag, rule wording, engine code, UI affordance, infrastructure.
   - Generality: does the fix unlock other latent improvements, or is it brittle to this case.
3. Pick a level. "No change warranted" is a valid output and gets written as an explicit decision, not silence.
4. Produce concrete edits:
   - Data fix: edit the dish's `data/dishes/<slug>.md` file or the ingredient catalog row in `data/ingredients.md`.
   - Tag addition: add the tag to relevant dishes + edit the rule text in `docs/engine.md` + edit the engine module + add tests.
   - Rule change: edit `docs/engine.md` + the engine module + tests + run the simulation harness.
   - Append the rationale to `data/changelog.md`.

### 1.5 Output

A single PR titled `slow-loop/<date>: <one-line summary of themes>`. PR description includes:

- A short list of clusters processed.
- A diagnosis card per cluster (problem size, fix level, generality, rejected alternatives).
- File diffs across `data/`, `docs/engine.md`, `engine/`, and the appended `data/changelog.md`.

### 1.6 On merge

A GitHub Action posts back to Convex:

- Marks the consumed `comments` rows as `applied` with the merged PR URL, or `reviewed_no_change` for clusters with "no change warranted" as the chosen level.
- Marks the consumed `manualChanges` rows with the same outcome per cluster, using the same per-cluster fence section.
- Marks the corresponding `incidents` as resolved.
- Marks the consumed `nextWeekQueue` rows `dropped` (the queue's terminal "consumed by the slow loop without placing" state; the generation run owns `placed`, the slow loop owns `dropped`).
- Lists the consumed `dishDislikes` rows in the PR but leaves them `queued`: the dislike write-back mutation is not yet wired (see §3).

The action then triggers a redeploy: build emits new typed library/history modules from the updated markdown, Convex picks up the new functions, Vercel rebuilds the frontend. The next generated week uses the new rules.

### 1.7 Right-size examples

The fixes name the per-dish-file structure: one dish is one file at `data/dishes/<slug>.md` (frontmatter fields plus ingredient and recipe rows), and ingredient facts (pack sizes, macros) live as rows in the `data/ingredients.md` catalog. One dish change is one file diff.

| Signal pattern                                                                          | Right-sized fix                                                                                                                                          | Wrong response (rejected)                                                                             |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| "We never cook lauki" appearing 3+ weeks running                                        | Set `active: No` in each lauki dish's `data/dishes/<slug>.md` frontmatter.                                                                               | Delete the dish files (loses optionality) or wait for more data.                                      |
| "Too spicy on a sick day" appearing once                                                | No change. Record reason: "single instance, not a pattern; user can swap via the dish-swap affordance."                                                  | Add a `low_spice` tag.                                                                                |
| "Too spicy" + "want milder dinner when traveling" + "after gym I want light" (5+ weeks) | Add `low_spice` to the `tags` of each relevant `data/dishes/<slug>.md`, edit `docs/engine.md` to add the slot rule, update the engine module, add tests. | Add a `low_spice` tag to two dish files and ship without updating the rule.                           |
| Custom one-off "lemon coriander rice" used 4 weeks running                              | Add a new `data/dishes/lemon-coriander-rice.md` file with its ingredient rows (the catalog covers the ingredient names).                                 | Make the engine learn one-off entries automatically.                                                  |
| Pack size for Paneer feels wrong                                                        | Edit the `Pack Size` cell on Paneer's row in the `data/ingredients.md` catalog (one row, all paneer dishes inherit it).                                  | Add a per-dish override field.                                                                        |
| Same dish saved for next week 3+ weeks running, never placed                            | Flip `preferred: Yes` in that dish's `data/dishes/<slug>.md` so the picker ranks it up; or revisit its recency treatment if `preferred` is already set.  | Hard-code the dish into the generation run.                                                           |
| One member dislikes a dish once (one `dishDislikes` row)                                | No change. Record reason: "single dislike, not a pattern; the fast loop never acts on a dislike (Principle 5)." Mark the dislike consumed.               | Set `active: No` on the strength of one tap.                                                          |
| Same dish disliked repeatedly, or disliked by both members                              | Set `active: No` in that dish's `data/dishes/<slug>.md` (deactivation), or lower its explore ranking if it should stay browsable but de-emphasized.      | Leave it active because "it is only a couple of dislikes" (a both-member dislike is a clear pattern). |

### 1.8 Proactive runs (the reports, not just the comments)

The slow loop reads the coverage report and the pool-coverage report from `npm run reports` every run, and a week with zero comments, zero manual changes, zero queue rows, and zero dislikes can still produce a useful PR. Validators keep facts true; the slow loop keeps the library good. The two are different jobs: a thin Dessert pool is not a broken fact, so no validator flags it, but it is a real quality risk worth a proactive proposal.

What to look for in the reports:

- **Thin pools.** The pool-coverage report flags any slot with two or fewer eligible candidates per season (`<- thin`). A thin pool means the engine has almost no room to vary that slot, so the household sees the same one or two dishes repeatedly. The proactive PR proposes activating or adding candidates for that slot. Today the live thinnest pools are seasonal carry slots like "Breakfast Option A: fruit" and "Breakfast Option B: complete_carb" at three candidates, and the Monsoon "Menu 3: Dessert" pool at six; these are the natural targets when no reactive signal dominates a run. (Activating an existing dish is a slow-loop data-row edit; adding net-new dishes is a B3 expansion content batch, which the slow loop proposes as a priority rather than authoring directly.)
- **Coverage gaps.** The coverage report shows enrichment and macro completeness. Recipe coverage is currently 100%, so "N dishes lack recipes" is not a live gap; when a gap does open (for example a new expansion batch lands undescribed), the proactive PR names the next enrichment-batch priority. Photo coverage is the one large standing gap and is tracked separately on the B2 photo track, not via the slow loop.

A proactive PR follows the same shape as a reactive one: a diagnosis card per proposal (problem size "small pattern" or "structural" as the report warrants, chosen level, generality, rejected alternatives) and a `data/changelog.md` rationale. It consumes no Convex rows (there were none), so its cluster blocks list `-` for every id field; the only state it advances is `.maintenance-state`.

### 1.9 Anti-patterns the slow loop must not produce

- Sycophantic agreement: "the comment said X so I added a flag for X" without checking pattern size.
- Generalizing from one or two cases.
- Adding a column when a row fix or a tag would do.
- Modifying `docs/engine.md` without paired engine code and test edits.
- Silent dismissal of a comment without writing a diagnosis card.

## 2. Canonical-doc reconciliation

### 2.1 Why

Canonical docs in `docs/` must read as coherent present-tense specs with no historical seams. Producing that quality of writing while shipping a feature is unreliable, so reconciliation runs as a separate human-triggered pass.

### 2.2 Trigger

Rajat invokes `/reconcile-docs` after a notable run of CHANGELOG entries (typically every two to four weeks, or when something clearly changed the steady state). Sessions can also fire it on demand right after a feature ships.

### 2.3 Inputs the session reads

- `docs/CHANGELOG.md` entries since the last reconciliation (last-run marker stored in `.maintenance-state`, committed).
- The `features/` directory if anything is active, and any feature spec referenced by recent CHANGELOG entries (`archive/features/<name>.md` after ship).
- Current `docs/product.md`, `docs/engine.md`, `docs/engineering.md`, `docs/development.md` — to preserve voice and structure.
- Current code state under `engine/`, `app/`, plus the data files — to cross-check that doc claims match reality.

### 2.4 What the session does

1. Determine the set of CHANGELOG entries since the last run.
2. For each canonical doc, decide which entries affect it.
3. For each affected doc, rewrite the relevant sections in place. Not as appends, not as "now also" additions. The doc must still read as one coherent spec after the edit.
4. Verify factual claims against current code where checkable.
5. Open a PR with one commit per canonical doc touched.
6. Update `.maintenance-state` with the new last-run marker.

### 2.5 Per-doc scope

| CHANGELOG entry touches…                                                                                                                              | Update target         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| Product scope, persona, principles, tone, future direction                                                                                            | `docs/product.md`     |
| Rules, slot composition, selection priority, item cap, ingredient consolidation, field reference                                                      | `docs/engine.md`      |
| Stack, schema, data layer split, deploy model, hosting, integrations, env vars, image format                                                          | `docs/engineering.md` |
| Session model, worktree workflow, ship workflow, definition of done, diagnosis card, slow-loop trigger, escalation, commit conventions, anti-patterns | `docs/development.md` |

A single shipped change often touches more than one doc. Keeping cross-doc consistency is the reconciliation job's responsibility.

### 2.6 Style rules for canonical docs

Apply to every rewrite the reconciliation job produces.

- **Present tense.** "The slow loop runs when Rajat invokes it." Not "The slow loop will run…" or "Slow loop was added in feat/E1…".
- **One coherent document.** Section order is stable. Updates happen in place.
- **No slice, round, sprint, or date references** inside the doc body. The reader should not see the historical seams.
- **No changelog phrasing.** Strip "previously", "now also", "we used to", "this was added because". The CHANGELOG holds the chronology.
- **Preserve voice.** Each doc has an established register; read the existing sections as a style anchor before writing new ones.
- **Cross-reference by section number within a doc**, by canonical filename across docs.
- **No em dashes.** Use commas, parentheses, semicolons, or sentence breaks.

### 2.7 Anti-patterns to reject before opening the PR

- "Added in feat/X" or "introduced in slow-loop/2026-..."
- "Previously X, now Y"
- `(new)` or `(updated)` markers in headings
- Inline dates like "(as of 2026-06-08)"
- Past-tense narrative

If a rewrite needs any of these to make sense, the job is doing it wrong. The doc describes end state; the why goes in the CHANGELOG entry or the (now-archived) feature spec.

### 2.8 Conflict handling

- **Two CHANGELOG entries disagree:** latest ships wins; older statement is overwritten in the canonical doc. Flag in PR description.
- **CHANGELOG disagrees with current code:** code wins; canonical doc updated to match code reality. Flag for human review.
- **Ambiguous which doc owns a change:** open the PR with the job's best guess; flag for review.

### 2.9 Repository structure consistency check

The reconciliation job also runs mechanical checks against `docs/engineering.md` §14:

- Root inventory: every entry at root must be one of these. Files: `.gitignore`, `.githooks/`, `.maintenance-state`, `.retro-state`, `.prettierignore`, `.prettierrc`, `.stylelintrc.json`, `README.md`, `CLAUDE.md`, `DECISIONS.md`, `MAINTENANCE.md`, `ADDING-DISHES.md`, `RETRO.md`, `claude-design.md`, `eslint.config.js`, `package.json`, `package-lock.json`, `tsconfig.json`, `tsconfig.base.json`, `vercel.json`. Directories: `.claude/`, `.github/`, `app/`, `archive/`, `data/`, `design_handoff/`, `docs/`, `engine/`, `features/`, `scripts/`. Gitignored entries the check tolerates: `.git`, `.vercel`, `node_modules`, `coordination/`. This list mirrors the enforced allowlist in `.github/workflows/ci.yml`; the authoritative annotated layout is `docs/engineering.md` §14.
- Empty-but-anticipated directories carry `.gitkeep`.
- Folder naming follows the conventions in `docs/engineering.md` §14.

Mismatches flag in the PR description. The job does not move or rename files autonomously.

## 3. Slow-loop mark-applied action

A GitHub Action at `.github/workflows/slow-loop-applied.yml` closes the slow-loop feedback cycle: when a `slow-loop/*` PR merges into `main`, the action calls internal Convex mutations to mark the consumed `comments` and `manualChanges` rows `applied` or `reviewed_no_change`, the consumed `incidents` rows resolved, and the consumed `nextWeekQueue` rows `dropped`. Without it, the next `/slow-loop` run would reread the same queued signal and reprocess it.

### 3.1 PR body contract

`/slow-loop` produces a PR body with two sources of truth for the action:

1. A `## Consumed comments by cluster` section with one fenced ` ```cluster ` block per cluster. Each block has these keys: `outcome:` (either `applied` or `reviewed_no_change`, derived from that cluster's diagnosis card "Chosen level"), `comment_ids:` (comma-separated comment ids consumed by this cluster, or `-` if none), `manual_change_ids:` (comma-separated `manualChanges` row ids, or `-`), `incident_ids:` (comma-separated, or `-`), `next_week_queue_ids:` (comma-separated `nextWeekQueue` row ids the cluster consumed, or `-`), and `dislike_ids:` (comma-separated `dishDislikes` row ids, or `-`). The action parses this section to map each id to the correct outcome. The `manual_change_ids`, `next_week_queue_ids`, and `dislike_ids` keys are optional in a block; an older PR body that omits them still parses. Queue ids and dislike ids are outcome-independent: a consumed queue row is dropped and a consumed dislike is resolved regardless of the cluster's comment/manual-change outcome, so the action collects them from every block without outcome gating.
2. Flat `Consumed comment IDs:`, `Consumed manual-change IDs:`, `Consumed incident IDs:`, `Consumed next-week-queue IDs:`, and `Consumed dislike IDs:` lines for human readability and as a fallback. If the per-cluster section is absent, the action treats every listed comment and manual-change id as `applied` (conservative default for a PR that touched files) and drops every listed queue id.

### 3.2 Convex mutations called

Six `internalMutation` functions (not exposed to the browser), split across `app/convex/comments.ts`, `app/convex/manualChangesMutations.ts`, and `app/convex/nextWeekQueueMutations.ts`:

- `comments:markCommentsApplied({ commentIds, resolvedPr })` sets each row `status: "applied"`, `resolvedAt: now`, `resolvedPr: <PR URL>`.
- `comments:markCommentsReviewedNoChange({ commentIds, resolvedPr })` same shape, status `reviewed_no_change`.
- `comments:markIncidentsResolved({ incidentIds, resolvedPr })` sets `resolvedAt: now` on each incident row.
- `manualChangesMutations:markManualChangesApplied({ manualChangeIds, resolvedPr })` sets each `manualChanges` row `status: "applied"`, `resolvedAt: now`, `resolvedPr: <PR URL>`.
- `manualChangesMutations:markManualChangesReviewedNoChange({ manualChangeIds, resolvedPr })` same shape, status `reviewed_no_change`.
- `nextWeekQueueMutations:markQueueDropped({ queueIds, resolvedPr })` sets each `queued` `nextWeekQueue` row `status: "dropped"`. The generation run owns the `queued -> placed` transition; the slow loop owns `queued -> dropped`, so this mutation acts only on rows still `queued`.

Each mutation handles missing or already-resolved ids by inserting a `warn`-severity `incidents` row noting which id was skipped, then continuing. The mutations never throw; the post-merge step is best-effort and must not block a merge.

**Dislikes are parsed but not yet written back.** The action parses `dislike_ids:` (and the flat `Consumed dislike IDs:` line) and logs them, but does NOT call a mutation: the `dishDislikes` write-back mutation is not yet built. A slow-loop PR may list consumed dislike ids for the human record, but the rows stay `queued` until that mutation lands.

### 3.3 Debugging a failed run

If the action runs but the next `/slow-loop` invocation still sees stale `queued` comments, follow these steps in order:

1. Open the Actions tab on GitHub, find the `Slow-loop mark applied` run for the merged slow-loop PR, and read the log lines prefixed `[slow-loop-mark-applied]`. They report how many cluster blocks parsed, the applied/reviewed_no_change/incidents/next-week-queue/dislike counts, and any Convex CLI exit codes. The dislike count is logged but no mutation runs for it (the dislike write-back is not yet built).
2. If the parse counts read zero clusters and zero flat ids, the slow-loop PR body did not include either section; edit `.claude/commands/slow-loop.md` if `/slow-loop`'s output drifted, or hand-correct the comments via `npx convex run --prod comments:markCommentsApplied '{ "commentIds": ["..."], "resolvedPr": "..." }'`.
3. If the Convex CLI returned non-zero, check the production deployment (`disciplined-chameleon-263`) for incident rows written by the mutations themselves; they record which ids were skipped and why.
4. The action skips entirely when `pull_request.merged` is false or the head ref is not `slow-loop/*`; that is by design and not a failure.

## 4. State file

`.maintenance-state` at root holds the input-window markers for the maintenance jobs:

```
last_reconcile: 2026-07-12
last_reconcile_ops: 2026-07-12
last_slow_loop: 2026-07-13
```

`last_reconcile` is the canonical-doc reconciliation marker (§2); `last_reconcile_ops` is the operational-doc reconciliation marker (§7); `last_slow_loop` is the slow-loop marker (§1). Committed to the repo. The job history becomes part of `git log` and is visible to anyone who clones.

## 5. First run notes

- The first `/reconcile-docs` run is a no-op: the canonical docs were written fresh as part of the restructure.
- The first `/slow-loop` run after the app is live will have zero queued comments (none have been logged yet). The session writes a one-line PR or simply exits with a status report; an empty slow loop is a healthy outcome, not a failure.

## 6. Process retro intake

The slow loop (§1) turns user feedback into product change. This pass turns the EM's own
process and system friction into process and system change. It is the same machinery
pointed inward, so the two-loops principle (`docs/product.md` §4) holds: shipping is the
fast loop; improving how we ship is the slow loop.

### 6.1 Why

Friction the EM hits while running streams (a gate that does not work as documented, a
recurring merge conflict, a watchdog that kills agents) evaporates at session end unless
it is captured and triaged. `RETRO.md` is the durable, append-only ledger of that
friction; this pass is how it converts into fixes instead of being re-discovered every
session.

### 6.2 Trigger

Runs alongside the existing reconcile/slow-loop cadence (no separate schedule). The EM
runs it when `RETRO.md` has unhandled entries, conventionally during the same sitting as
`/reconcile-docs`.

### 6.3 Inputs the session reads

- `RETRO.md` entries with `Status: open` appended since `last_retro` (see §6.6).
- The canonical docs and operational docs the entries point at (`development.md`,
  `engineering.md`, the `.claude/commands/` brief templates, the CI workflow).

### 6.4 What the session does

1. Read open entries; cluster by Area and root cause (several entries may share one fix).
2. Right-size each cluster (Principle 1): pick the smallest level that solves it
   (brief-template line, process-doc edit, CI/test change, tooling, infra item), or
   `no-change` with a stated reason. Do not generalize from a single one-off entry;
   a `one-off` recurrence is usually `no-change`.
3. Land the fix on the right path: canonical-doc edits go through `/reconcile-docs`
   (§2); brief-template and CI/test fixes go through a `chore/*` PR; infra items that
   need Rajat (a secret, a paid tier) are surfaced to him, not actioned silently
   (`development.md` §7).
4. Update each consumed entry's `Status` line in place to `fixed (PR #NNN)` or
   `wont-fix (reason)`. Never rewrite the rest of the entry; the ledger is append-only
   history.

### 6.5 How EMs file entries

At session close the EM appends a `RETRO.md` entry for each systemic or recurring
friction (format and the "what to log" test live in `RETRO.md`). One-off self-inflicted
slips are not logged. The entry's `Proposed level` is the EM's first-cut sizing; the
intake pass (§6.4) makes the final call.

### 6.6 State

`.retro-state` at root holds the marker for this pass:

```
last_retro: 2026-07-13
```

Committed to the repo, like `.maintenance-state` (§4), so the run history is in `git log`.

### 6.7 Anti-patterns

- Logging one-off slips, turning the ledger into noise (the over-broad-ledger failure).
- Fixing a single entry with a cross-cutting abstraction before two entries need it
  (Principle 8).
- Editing canonical docs in this pass directly instead of routing through
  `/reconcile-docs` (`development.md` §12.4).
- Silently actioning an infra or cost item that should be surfaced to Rajat.

## 7. Operational-doc reconciliation

### 7.1 Why

The operational docs at root (`README.md`, `CLAUDE.md`, `MAINTENANCE.md`, `ADDING-DISHES.md`, `claude-design.md`) and the command briefs under `.claude/commands/` describe how the project is oriented, operated, and changed. They drift the same way the canonical docs in `docs/` drift under ship pressure: a feature lands, the chronology goes into the CHANGELOG honestly, but an orientation line, an operational spec, or a command brief keeps the old steady state until someone notices. README drifts fastest of all, because it restates product and engine facts that live canonically in `docs/`, so the same number ends up maintained in two places and one falls behind. This pass keeps the operational layer aligned to shipped reality and to the canonical docs, in present tense, without historical seams.

### 7.2 Trigger

Rajat invokes `/reconcile-ops` after a notable run of CHANGELOG entries, conventionally during the same sitting as `/reconcile-docs`. The session is the trigger; the output is a pull request; the merge is the approval.

### 7.3 Inputs the session reads

- `docs/CHANGELOG.md` entries since the last operational-doc reconciliation (last-run marker `last_reconcile_ops` in `.maintenance-state`, committed; see §4).
- The current canonical docs in `docs/`, as the source of truth the operational docs summarize and point at. Where an operational doc restates a canonical fact, the canonical doc wins.
- The current operational docs and command briefs in scope (§7.5), as the style and structure anchor.
- Current code and data state where an operational claim is checkable.

### 7.4 What the session does

1. Determine the set of CHANGELOG entries since `last_reconcile_ops` (or since the `since:<date>` argument). If none, write a one-line summary, bump the marker to today, and exit. An empty operational reconciliation is a healthy outcome, the same pattern as §2.
2. For each entry, decide which operational doc(s) or command brief(s) it affects per §7.5.
3. For each affected doc, rewrite the relevant sections in place, in present tense, so the doc still reads as one coherent spec. Verify factual claims against the canonical docs and against code where checkable.
4. For README, prefer a pointer over a re-synced number: when an entry changes a product or engine fact that README restates, trim the restated fact to a link into `docs/` rather than copying the new value. A lean README that points at canon does not drift.
5. For the command briefs, the procedure steps stay aligned to reality and the pointer section-numbers stay valid. The briefs point at canon rather than restating it, so reconciling them means keeping the pointers and the step lists correct, not rewriting the canon they reference.
6. Run the mechanical repository-structure check (§2.9, against the authoritative allowlist mirrored in `.github/workflows/ci.yml` and the annotated layout in `docs/engineering.md` §14). Flag mismatches in the PR; do not move or rename files autonomously.
7. Open a PR on a `docs/ops-<date>` branch (per `docs/development.md` §2), bump `last_reconcile_ops` to today in the same PR.

### 7.5 Per-doc affect map

| CHANGELOG entry touches…                                                          | Update target            |
| --------------------------------------------------------------------------------- | ------------------------ |
| Repo orientation, doc hierarchy, working folders, project status (README, CLAUDE) | `/reconcile-ops`         |
| Operational specs (the slow loop, reconciliation jobs, retro intake, dish-add playbook) | `/reconcile-ops` (`MAINTENANCE.md`, `ADDING-DISHES.md`) |
| The design contract (`claude-design.md`)                                          | `/reconcile-ops`         |
| A slash-command brief's procedure, pointers, or arguments (`.claude/commands/*.md`) | `/reconcile-ops`         |

Out of scope for `/reconcile-ops`: the canonical specs in `docs/` (owned by `/reconcile-docs`, §2.5), and the append-only ledgers `DECISIONS.md`, `RETRO.md`, `docs/CHANGELOG.md`, and `data/changelog.md`, which are never rewritten by any reconciliation pass.

A single shipped change can touch both layers (a canonical doc and an orientation line that points at it). `/reconcile-docs` owns the canonical side; `/reconcile-ops` owns the operational side; keeping the pointer between them valid is this pass's responsibility.

### 7.6 Style rules

The operational docs read as present-tense steady-state specs with no historical seams, the same standard the canonical docs hold. The style rules in §2.6 and the anti-patterns in §2.7 apply unchanged; reference them rather than re-listing them here. Slash-command briefs keep their imperative step lists, but their descriptive prose follows the same no-historical-seams rule. The slow-loop signal-cluster guidance is canonical in §1.4, and `/slow-loop` points there rather than restating it.

### 7.7 Anti-patterns

- Re-syncing a duplicated product or engine number in README instead of trimming it to a pointer into `docs/`; the duplication is the drift source.
- Restating canon in a command brief that should point at it (the brief already opens by telling the reader to re-read the spec).
- Rewriting an append-only ledger (`DECISIONS.md`, `RETRO.md`, `docs/CHANGELOG.md`, `data/changelog.md`); these are out of scope.
- Editing a canonical doc in `docs/` in this pass; that is `/reconcile-docs`'s lane (§2).
- Historical seams in the rewrite: "previously", "now also", a stream letter, a date in the doc body (§2.7).
