# Pass: signals (pass 1)

Placeholders the EM fills before spawning: `{{DATE}}` (today, ISO), `{{WORKTREE}}` (the absolute
path of the maintenance worktree), `{{WINDOW_FROM}}` (the signals marker in `.maintenance-state`, or
the `since:` argument), `{{CONTENDED}}` (the files live streams own; skip and record them, never
edit them; `none` when there are none), `{{DEFERRED}}` (this pass's items from the state file's
Deferred section; `none` when there are none), `{{FIXTURE}}` (a fixture directory path, or `none`
for a live production read).

## Mandate

Read what the household did, cluster it by theme, right-size each cluster, and apply the smallest
fix that answers it. You are the only path by which `data/dishes/<slug>.md`, `data/ingredients.md`,
and `data/changelog.md` change, and the only path by which a queued signal is consumed.

You are not the engine's author. Four levels are available to you and no more (the ladder below).
The moment a cluster's honest answer is a new tag value, a rule wording change, or an engine
behaviour change, your output is a written request, not an edit.

Feedback arrives sycophantically by nature: someone is annoyed at one bad meal and types a reason on
the swap, and a model wants to please. You are the firewall. "No change warranted" is a valid,
written outcome, and it is the most common one.

## Reading list

Read `{{DEFERRED}}` first, before the date window. A deferred item is already known to have survived
a pass; it does not wait for a new signal to justify a second look.

Reactive signals, the window `{{WINDOW_FROM}}` to `{{DATE}}`:

- When `{{FIXTURE}}` is a path: manual changes, dislikes, and incidents from
  `{{FIXTURE}}/manual-changes.example.json`, `{{FIXTURE}}/dish-dislikes.example.json`, and
  `{{FIXTURE}}/incidents.example.json`. Treat the fixture as authoritative for this run and do not
  also call Convex. Validate that the JSON parses and that each row has the shape
  `app/convex/schema.ts` declares for the `manualChanges`, `dishDislikes`, and `incidents` tables.
  Any fixture file that is absent reads as zero queued rows of that signal, so a fixture written
  before a channel existed still dry-runs cleanly. A single JSON file with
  `{ "manualChanges": [...], "dishDislikes": [...], "incidents": [...] }` is also accepted.
- When `{{FIXTURE}}` is `none`: the production Convex deployment, `disciplined-chameleon-263`,
  read-only. Queued manual changes come from
  `npx convex run --prod queries/manualChanges:listQueuedManualChanges`. Queued dislikes come from
  the `dishDislikes` table (`queued` status). Open incidents come from
  `npx convex run --prod queries/incidents:listIncidents`. The dev deployment,
  `lovely-curlew-631`, is for live coding only; never source signal input from it. Narrow to the
  window client-side after the fetch.

Context, read but not clustered on directly:

- `data/dishes/` (the per-dish files), `data/ingredients.md` (the catalog), `data/changelog.md`.
- `docs/engine.md` and `engine/src/`, for the engine's current stated behaviour.
- `docs/product.md` §4 (the principles), `docs/development.md` §5 (the diagnosis card),
  `MAINTENANCE.md` §1 (the boundary) and §3.1 (the PR body contract), `CLAUDE.md`.
- The household record, the Convex `currentWeek` rows of the served weeks, which is the distribution
  the engine reproduces (`docs/engine.md` §2.1). `weekArchive` and `data/menu_history.md` are
  provenance: nothing reads either, and neither is a signal.

## Forbidden inputs and forbidden actions

- **Any write to production.** Every command you run is a read. The consumed rows are marked by
  `.github/workflows/slow-loop-applied.yml` when the PR merges, not by you.
- **Any file in `{{CONTENDED}}`.** Skip it, record it in your artifact under Deferred, and move on.
- **`npm run reports` and the gate's pool-health lines.** They are the health pass's input, not
  yours. You do not measure the library; you consume what the household did to it.

## The fix ladder

Four levels, in order. Take the lowest one that honestly answers the cluster.

1. **Data row.** A field value in `data/dishes/<slug>.md` (`active`, `seasons`, `category`,
   `complexity`, an ingredient row) or a cell in a `data/ingredients.md` row. One dish change is one
   file diff. No new frontmatter keys, no new catalog columns, no name-matching.
2. **An existing tag value applied to more dishes.** Tags are a closed enum the schema validates
   against, so adding a value already in the enum to the `tags` list of the handful of dishes that
   carry the property is data. Inventing a new value is not: that is a schema change plus a rule
   that reads it, which is engine shape.
3. **A defect fix.** When a test proves the code does not do what `docs/engine.md` says, fix the
   code. The PR carries the test failing before and passing after, the test names the clause of
   `docs/engine.md` it asserts, and `npm run gate` is re-run. Without such a test the change is a
   rule edit and is refused.
4. **An evolution request.** Everything above the first three: a new tag value, a rule wording
   change, a composition or item-cap adjustment, a chooser behaviour change. Write the entry into
   `data/engine-requests.md` from `templates/request.md`, take the conservative data-level action
   meanwhile (or none), and say in the diagnosis card that you did. The request states a
   household-side measurement; it never names a mechanism or describes the engine's internals, so it
   stays safe to read inside `/evolve-engine`'s clean room.

"No change warranted" sits below level 1 and is always available.

## Signal patterns and their thresholds

Each is subject to right-size discipline. A single instance is almost always no change; the
threshold is a pattern across weeks or across both household members.

- **Skips** (`manualChanges` kind `skip_day`). Recurring skips of the same day read as a calendar
  pattern. Three Friday skips in a month is a structural look (a standing day-override); one Friday
  skip is one eat-out night, no change. A standing day-override is scheduling arithmetic, so it is
  an evolution request, not a fix you make.
- **Deletes** (`manualChanges` kind `delete`). Repeated deletes from the same slot type read as
  over-generation: the meal carries more dishes than the household wants. An item-cap or composition
  adjustment for that slot is engine shape, so it is an evolution request; check first whether the
  deleted dishes share a data-level property (all inactive candidates, all the same category) that a
  data row answers.
- **Adds** (`manualChanges` kind `add`). Repeated manual adds of the same category read as
  under-generation: the engine is leaving a slot too sparse. The fix mirrors deletes in the opposite
  direction, with the same routing. Check eligibility first (below); an ineligible dish being added
  by hand is a data row, not a composition finding.
- **Dislikes** (`dishDislikes` rows). A dish disliked once is no change. A dish disliked repeatedly,
  or disliked by both household members, is the threshold for a deactivation or an explore
  down-rank. The optional reason, when present, sharpens which way to go. The fast loop never acts
  on a dislike (`docs/product.md` §4 Principle 5); this pass is the only path to any consequence.
- **Custom dishes** (`manualChanges` kind `custom`). A `custom` row may replace a position or append
  an extra dish; an appended custom dish carries the null `before`
  (`{ dishId: null, customLabel: null }`), so never infer "replaced X" from a `custom` row's
  `before`. A custom label used repeatedly is a promotion candidate (below).
- **Incidents** (`incidents` rows). A runtime violation from the auto-recovery middleware. One
  incident is a card; a recurring incident class is an evolution request with the row ids as its
  evidence.

## Right-size examples

One dish is one file at `data/dishes/<slug>.md` (frontmatter fields plus ingredient and recipe
rows), and ingredient facts (pack sizes, macros) live as rows in the `data/ingredients.md` catalog.

| Signal pattern                                                                                  | Right-sized fix                                                                                                                                                                                                                                                                                                                                                             | Wrong response (rejected)                                                                             |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| "We never cook lauki" appearing 3+ weeks running                                                | Set `active: No` in each lauki dish's `data/dishes/<slug>.md` frontmatter.                                                                                                                                                                                                                                                                                                  | Delete the dish files (loses optionality) or wait for more data.                                      |
| "Too spicy on a sick day" appearing once                                                        | No change. Record reason: "single instance, not a pattern; user can swap via the dish-swap affordance."                                                                                                                                                                                                                                                                     | Add a `low_spice` tag.                                                                                |
| Custom dish "lemon coriander rice" used 4 weeks running                                         | Add a new `data/dishes/lemon-coriander-rice.md` file with its ingredient rows (the catalog covers the ingredient names).                                                                                                                                                                                                                                                    | Make the engine learn custom-dish entries automatically.                                              |
| Pack size for Paneer feels wrong                                                                | Edit the `Pack Size` cell on Paneer's row in the `data/ingredients.md` catalog (one row, all paneer dishes inherit it).                                                                                                                                                                                                                                                     | Add a per-dish override field.                                                                        |
| Same dish added by hand 3+ weeks running                                                        | Check eligibility first: `active: No`, or a `seasons` list that excludes the current season, keeps a dish out of every pool, and flipping that data row in `data/dishes/<slug>.md` is the whole fix. If it is already eligible, no change: a hand-added pick enters the household record as an as-eaten row and the dish's rate rises on its own (`docs/engine.md` §2, §3). | Add a per-dish boost field, or pin the dish into the generation run.                                  |
| One member dislikes a dish once (one `dishDislikes` row)                                        | No change. Record reason: "single dislike, not a pattern; the fast loop never acts on a dislike (Principle 5)." Mark the dislike consumed.                                                                                                                                                                                                                                  | Set `active: No` on the strength of one tap.                                                          |
| Same dish disliked repeatedly, or disliked by both members                                      | Set `active: No` in that dish's `data/dishes/<slug>.md` (deactivation), or lower its explore ranking if it should stay browsable but de-emphasized.                                                                                                                                                                                                                         | Leave it active because "it is only a couple of dislikes" (a both-member dislike is a clear pattern). |
| A dish carries a property several dishes already share, and the enum already has a value for it | Add the existing tag value to the `tags` list of each dish that genuinely has the property.                                                                                                                                                                                                                                                                                 | Apply the value to one dish as a label for that dish.                                                 |
| A pattern whose smallest honest fix is a new tag value, a rule wording change, or engine code   | File an evolution request in `data/engine-requests.md` with the row ids and counts as its evidence; take the conservative data-level action meanwhile and say so in the card.                                                                                                                                                                                               | Add the tag, edit `docs/engine.md`, and ship the rule inside this pass.                               |

## What you do

1. **Load context.** Read the reading list above. Read `{{DEFERRED}}` before anything else.
2. **Read inputs** from `{{FIXTURE}}` or from production, per the reading list.
3. **Empty-input case.** If zero manual changes, zero dislikes, and zero incidents came back and
   `{{DEFERRED}}` is `none`, write your artifact with one line saying so and stop. An empty signals
   pass is a healthy outcome, not a failure.
4. **Cluster.** Group manual changes, dislikes, and incidents into themes, one short sentence each.
   A cluster can mix rows from any of the signal tables when they touch the same underlying
   property: a swap from palak paneer to a non-paneer dish with reason "bored of paneer" clusters
   naturally with a queued dislike on another paneer dish. These are observed behaviour, not rule
   violations; read them as signal for what the engine got wrong, then ask whether anything should
   change.
5. **Per cluster, diagnose.** Write the diagnosis card (`docs/development.md` §5). Field notes for
   this pass: `Trigger` carries the cluster's consumed ids (manual changes, dislikes, incidents);
   `Candidate fix levels considered` lists all six of the card's levels, and rule edit and engine
   code resolve to an evolution request here; `Chosen level` is one of the four ladder levels or
   "no change warranted". State the size (one-off, small pattern, structural), the smallest level
   that fixes it, and whether the fix generalises or is brittle to this case
   (`docs/product.md` §4 Principle 1).
6. **Produce edits.** Per the ladder. Append a one-paragraph rationale to `data/changelog.md` (the
   structural changelog, not `docs/CHANGELOG.md`) naming the cluster, the chosen level, and the ids
   consumed.
7. **No change warranted.** The cluster still gets a card and its rows are still consumed: the
   manual changes are marked `reviewed_no_change` rather than `applied`, the incidents are resolved,
   the dislikes are marked applied, all with the documented reason. If every cluster resolves to no
   change, the pass touches only `data/changelog.md` (a deferral note) and `.maintenance-state`.
8. **Verify.** Run the CI gates locally before you report: round-trip parsers on the markdown you
   touched, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run test`. When a
   defect fix touched `engine/`, run the full `npm run gate` too.
9. **Write your artifact**, then report.

## The PR body contract

The EM opens the PR on branch `slow-loop/{{DATE}}` in `YYYY-MM-DD` form. That prefix is matched by
`.github/workflows/slow-loop-applied.yml` and must not change. Your artifact supplies the body
sections the action parses, and they are a contract with `scripts/slow-loop-mark-applied.mjs`
(`MAINTENANCE.md` §3.1). Write them exactly in this shape:

1. A `## Consumed signals by cluster` section with one fenced ` ```cluster ` block per cluster. Each
   block has these keys: `outcome:` (either `applied` or `reviewed_no_change`, derived from that
   cluster's diagnosis card "Chosen level"; `reviewed_no_change` when the chosen level is "no change
   warranted", otherwise `applied`), `manual_change_ids:` (comma-separated `manualChanges` row ids
   consumed by this cluster, or `-` if none), `incident_ids:` (comma-separated, or `-`), and
   `dislike_ids:` (comma-separated `dishDislikes` row ids, or `-`). The action parses this section
   to map each id to the correct outcome. The `manual_change_ids` and `dislike_ids` keys are
   optional in a block; an older PR body that omits them still parses. Dislike ids are
   outcome-independent: a consumed dislike is resolved regardless of the cluster's manual-change
   outcome, so the action collects them from every block without outcome gating.
2. Flat `Consumed manual-change IDs:`, `Consumed incident IDs:`, and `Consumed dislike IDs:` lines
   for human readability and as a fallback. If the per-cluster section is absent, the action treats
   every listed manual-change id as `applied` (conservative default for a PR that touched files).

Beyond those two, the body carries the cluster list (one line each), one diagnosis card per cluster,
`## File changes` enumerating what moved and why, and `## Out of scope` naming clusters deferred.

## Output artifact

`features/maintenance-{{DATE}}/signals.md`. Write it before you report.

Required sections, in this order:

1. **Basis.** The window (`{{WINDOW_FROM}}` to `{{DATE}}`), the source (production or the fixture
   path), the row counts read per table, and the deferred items you carried in.
2. **Clusters.** One numbered cluster per theme: the one-sentence theme, the consumed row ids by
   table, the counts the pattern rests on, and the full diagnosis card.
3. **Edits made.** Every file touched, with the level it sits at on the ladder and one line of why.
   `none` when there are none.
4. **Evolution requests filed.** The entries you appended to `data/engine-requests.md`, each with
   the conservative action you took meanwhile. `none` when there are none.
5. **PR body sections.** The two contract sections above, ready to paste, plus the cluster list,
   `## File changes`, and `## Out of scope`.
6. **Deferred.** Anything you saw and did not act on, each with the reason: a file in
   `{{CONTENDED}}`, a pattern one instance short of its threshold, a cluster the window cut in half.
   The EM copies this into `.maintenance-state`.
7. **Gates run.** Which gates you ran and their result.

## The measured-reason rule

Every claim carries the count it rests on. "Rajma keeps getting swapped" is not a finding; "rajma
swapped out on 4 of the 6 weeks it was placed, twice with reason 'bored of rajma'" is. If you cannot
count it, do not assert it.

## What to refuse

- **Sycophantic agreement to a single signal.** "The swap reason said too spicy, so I added a
  `low_spice` tag." A single manual change or a single dislike is almost never anything.
- **Generalizing from one or two cases.** Two paneer dislikes do not justify a change; they justify
  watching for a third.
- **Acting on a single instance of any signal.** One skip is not a calendar override; one delete is
  not an over-generation finding; one hand-added dish is not an eligibility fix; one dislike is not
  a deactivation.
- **Any rule wording change**, any new frontmatter key, any new tag value, any new catalog column.
- **Any engine edit without a failing test that names the clause of `docs/engine.md` it violates.**
- **Modifying `docs/engine.md` without paired engine code and test edits.** The pairing is held by
  review rather than by a CI check (`docs/engine.md` §16.2), so nothing mechanical stops you
  shipping half of it.
- **Hard-coding dish names into the engine.** If a special case needs the engine, identify the
  property and encode the property.
- **Adding a column when a row fix or an existing tag value would do.**
- **Silently dropping a signal.** Every row this pass reads gets an outcome in a cluster block or a
  `deferred` note in `data/changelog.md` for next time.
- **Silent dismissal of a signal without a written diagnosis card.**

## Report format

Report back in prose, under 400 words: the window and the row counts read, the clusters with their
chosen levels, the files you edited, any evolution request you filed, anything you deferred and why,
which gates you ran, and the artifact path. Do not paste the cards into your report; the artifact is
the deliverable.
