---
description: Run the slow loop. Reads queued comments, queued manual changes, and incidents from Convex, applies right-size discipline, opens a PR with structural changes (or a no-change-warranted card).
---

You are running the slow loop for Plantry. This is a thinking exercise, not a script. The full spec lives in `MAINTENANCE.md` §1. Re-read it now. Read `docs/product.md` §4 (principles) and `docs/development.md` §5 (diagnosis card).

Slow-loop runs only when Rajat invokes them. Comments, manual changes, dislikes, and incidents accumulate during the week; the coverage and pool-coverage reports describe the library's health independent of any user action. This session is the only path by which the dish library (`data/dishes/<slug>.md`), the ingredient catalog (`data/ingredients.md`), `docs/engine.md`, `engine/src/`, and `data/changelog.md` change.

## Right-size discipline

Right-size discipline is canonical in `docs/product.md` §4 Principle 1, with the slow-loop sizing thresholds in `MAINTENANCE.md` §1; re-read both before any change lands. Do not re-derive the levels or thresholds from memory.

## Diagnosis card

The diagnosis-card format is canonical in `docs/development.md` §5; write one per cluster. Slow-loop-specific field notes: the `Trigger` field carries this cluster's consumed IDs (comments, manual changes, dislikes, incidents), and for a proactive cluster with no consumed rows it cites the report instead ("reports: <which report>"). The per-cluster consumed-id keys (used on merge by the mark-applied action) are detailed in step 9 and `MAINTENANCE.md` §3.1.

## Arguments

- `--fixture <path>`. Read comments, manual changes, dislikes, and incidents from JSON files at that path instead of Convex. Used by the EM to dry-run before real signals accumulate. The path is a directory containing `queued-comments.example.json`, `manual-changes.example.json`, `dish-dislikes.example.json`, and `incidents.example.json` (the files in `data/test-fixtures/slow-loop/`), or a single JSON file with `{ "comments": [...], "manualChanges": [...], "dishDislikes": [...], "incidents": [...] }`. Pass `--fixture data/test-fixtures/slow-loop` for a dry-run. Any fixture file that is absent reads as zero queued rows of that signal, so older fixtures still dry-run cleanly. The reports are read live from `npm run reports`, not from a fixture.
- `since:<date>`. Narrow to comments and incidents from this ISO date forward. Default: process everything queued since the `last_slow_loop` marker in `.maintenance-state`.
- `focus:<keyword>`. Narrow to clusters that touch this keyword (e.g. `focus:spice`, `focus:paneer`).
- `dry-run`. Produce the diagnosis cards but do not edit files or open a PR.

## What to do

1. **Load context.** Read `docs/product.md`, `docs/engine.md`, `docs/engineering.md`, `docs/development.md`, `MAINTENANCE.md`, and `CLAUDE.md`. Read the dish library under `data/dishes/`, the `data/ingredients.md` catalog, `data/menu_history.md`, `data/changelog.md`, and the last few entries of `docs/CHANGELOG.md` for ship context. Run `npm run reports` and read its coverage report and pool-coverage report; these are the proactive inputs (see step 3b and `MAINTENANCE.md` §1.8). The reports never block; a thin pool or a coverage gap is judgment for this loop to act on, not a CI failure.

2. **Read inputs.**
   - If `--fixture <path>` was passed, read comments, manual changes, dislikes, and incidents from that path. Treat the fixture as authoritative for this run; do not also call Convex. Validate the JSON parses and that each row has the shape declared in `app/convex/schema.ts` for the `comments`, `manualChanges`, `dishDislikes`, and `incidents` tables. Any fixture file that is absent reads as zero queued rows of that signal (`manual-changes` predates Stream I; `dish-dislikes` predates slice 9.1).
   - Otherwise call the production Convex deployment, `disciplined-chameleon-263`. Queued comments come from `npx convex run --prod queries/comments:listQueuedComments`. Queued manual changes come from `npx convex run --prod queries/manualChanges:listQueuedManualChanges`. Queued dislikes come from the `dishDislikes` table (`queued` status). Open incidents come from `npx convex run --prod queries/incidents:listIncidents`. The dev deployment, `lovely-curlew-631`, is for live coding only; never source slow-loop input from it. If `since:<date>` or `focus:<keyword>` was passed, narrow client-side after the fetch.

3. **Empty-input case.** If zero comments, zero manual changes, zero dislikes, and zero incidents came back (whether from fixture or Convex), AND the reports surface nothing worth a proactive proposal, write a one-line summary PR that touches only `.maintenance-state` (updates `last_slow_loop` to today's date) and exit. An empty slow loop is a healthy outcome, not a failure. But note that a zero-signal week is not automatically empty: check the reports first (step 3b).

3b. **Proactive read (reports).** Even with zero reactive signals, scan the pool-coverage report for thin pools (slots flagged `<- thin`, two or fewer eligible candidates per season) and the coverage report for gaps. A thin pool or a real gap can justify a proactive cluster: "Monsoon strands the Dessert slot at N candidates, propose activating X and Y" or "the latest expansion batch landed undescribed, here is the enrichment priority". Recipe coverage is currently 100%, so frame coverage proposals around the live gaps (thin pools, or a freshly-landed undescribed batch), not recipes. Activating an existing dish is a slow-loop data-row edit; adding net-new dishes is a B3 expansion content batch the slow loop proposes as a priority rather than authoring. A proactive cluster carries a diagnosis card like any other and consumes no Convex rows.

4. **Cluster.** Group comments, manual changes, dislikes, and incidents into themes. State each theme in one short sentence. A theme can be a single row from any table if structural on its own; a theme can also span rows from multiple tables when they touch the same underlying property. A swap from palak paneer to a non-paneer dish with reason "bored of paneer" clusters naturally with a queued comment "palak paneer again, feels like a lot of paneer this week". The loop reads these signals (skips, deletes, adds, dislikes) as signal for what the engine got wrong, not as violations; the per-signal clustering guidance and its right-size thresholds are canonical in `MAINTENANCE.md` §1.4. Re-read it before clustering rather than working from memory.

5. **Per cluster, diagnose.** Write the diagnosis card above. Be honest: most one-off comments and most one-off manual changes resolve to no change. Some clusters resolve to a single data row edit. A few resolve to a new tag plus rule wording plus engine plus tests. Very few resolve to an engine code change in a single run.

6. **Produce edits.** For each cluster that needs a change:
   - **Data row fix:** edit the dish's `data/dishes/<slug>.md` file (frontmatter field or ingredient row) or the relevant `data/ingredients.md` catalog row. No new frontmatter keys or catalog columns. No name-matching.
   - **Tag addition:** add the tag value to the `tags` list in the handful of relevant `data/dishes/<slug>.md` files, edit the rule text in `docs/engine.md`, edit the engine module in `engine/src/` to consume the tag, add unit tests. Tags are properties, not labels for one dish.
   - **Rule edit:** edit `docs/engine.md` and the matching engine module and tests. Run the simulation harness locally; rule changes that newly break the harness are not ready to ship.
   - **Engine code:** same as rule edit, but the change is algorithmic rather than wording. Same gates.
   - **Preferred / deactivation data fix (saves and dislikes):** for an under-picked saved dish, flip `preferred: Yes` in its `data/dishes/<slug>.md` (or revisit its recency treatment); for a dish disliked repeatedly or by both members, set `active: No`, or lower its explore ranking if it should stay browsable. These are data-row edits, not new fields. (Acting on a dislike via a data-row fix is live; the dislike write-back that marks the rows consumed is not yet wired, so consumed dislikes are listed in the PR but stay queued.)
   - Append a one-paragraph rationale to `data/changelog.md` (the structural changelog at `data/changelog.md`, not `docs/CHANGELOG.md`). The entry names the cluster, the chosen fix level, and the comment, manual-change, dislike, or incident IDs consumed.

7. **No change warranted.** Some clusters resolve to no change. The PR still includes the diagnosis card and still consumes those rows; the consumed comments and manual changes get marked `reviewed_no_change` (not `applied`) on merge, and consumed incidents are resolved, all with the documented reason. (Consumed dislike ids are listed for the record but stay queued until the dislike write-back mutation exists.) If every cluster in this run resolves to no change, the PR touches only `data/changelog.md` (a deferral note) and `.maintenance-state`.

8. **Verify.** Run the CI gates locally before opening the PR: round-trip parsers on the markdown you touched, `npm run typecheck`, `npm run lint`, `npm run test`, and the simulation harness. Fix anything that fails. The PR cannot ship a regression.

9. **Open the PR.**
   - Branch name: `slow-loop/<today's date>` in `YYYY-MM-DD` form (per `docs/development.md` §2).
   - Title: `slow-loop/<date>: <one-line summary of themes>`. Under 70 characters.
   - Body opens with the cluster list (one line each), then one diagnosis card per cluster, then "## File changes" enumerating what moved and why, then "## Out of scope" naming clusters deferred. Include one-line "Consumed comment IDs", "Consumed manual-change IDs", "Consumed incident IDs", and "Consumed dislike IDs" lists so the merge action can mark them on Convex. Also include a "## Consumed comments by cluster" section: one fenced `cluster` block per cluster, each block containing `outcome: applied` or `outcome: reviewed_no_change` (taken verbatim from the cluster's diagnosis card; the outcome is `reviewed_no_change` if the chosen level is "no change warranted", otherwise `applied`), `comment_ids: <comma-separated list>` (use `-` when none), `manual_change_ids: <comma-separated list>` (use `-` when none), `incident_ids: <comma-separated list>` (use `-` when none), and `dislike_ids: <comma-separated list>` (use `-` when none). The mark-applied GitHub Action parses this section: it maps `outcome` to comment ids and manual-change ids per cluster, and parses dislike ids but does NOT write them back yet (the dislike write-back mutation is not yet built; until it lands a listed dislike id stays queued, by design).
   - For a dry-run (the `dry-run` argument), produce the cards in the chat as if you were about to open the PR, but do not write files or push.

10. **Hand off.** Post a one-paragraph status to Rajat: "PR opened, here is the URL, here are the themes touched, here is what I deliberately did not."

## What to refuse

- Sycophantic agreement to a single comment ("the comment said too spicy, so I added a `low_spice` tag"). A single comment is almost never a tag.
- Generalizing from one or two cases. Two paneer comments do not justify a `paneer_alternative` tag; they justify watching for a third.
- Modifying `docs/engine.md` without paired engine code and test edits. The CI gate also catches this; do not fight the gate.
- Hard-coding dish names into the engine. If a special case needs the engine, identify the property and encode the property.
- Silently dropping a signal. Every queued comment, manual change, queue row, dislike, and incident this session reads gets either an `applied` / `reviewed_no_change` / `dropped` / resolved PR action, or a `deferred` note in `data/changelog.md` for next time. (A dislike's only consumed-action today is being listed in the PR; the dislike write-back mutation is not yet built; until it lands a listed dislike id stays queued, by design.)
- Acting on a single instance of any new signal. One skip is not a calendar override; one delete is not an over-generation finding; one save is not a `preferred` flip; one dislike is not a deactivation. The threshold is a pattern across weeks or across both members.

## Why this command exists

Comments arrive sycophantically by nature (someone is annoyed at one bad meal and types it; the model wants to please). The slow loop is the firewall: it forces the right-size discipline above to be applied and audited, and it puts every structural change through human review. Read it as a thinking exercise, not a transformation pipeline.
