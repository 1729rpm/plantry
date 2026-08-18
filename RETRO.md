# RETRO — EM friction ledger

Append-only log of process and system friction the EM hits while running streams. This
is the slow loop pointed at our own process: the maintenance job reads open entries,
clusters them, right-sizes each, and converts recurring friction into process or system
improvements (see `MAINTENANCE.md` §6). Newest first. Append, never rewrite an entry;
the maintenance pass edits only the `Status` line of an existing entry.

## What to log

Log **systemic or recurring** friction only: something that hit more than once this
session, or that will hit every session. Do NOT log one-off self-inflicted slips (a
wrong path, a typo, a tool used from the wrong directory); those are execution noise, not
process gaps. Right-size discipline applies here exactly as it does to dish feedback:
"no change warranted" is a valid outcome, and an over-broad ledger becomes noise. The
entry format forces honest sizing, the same way the diagnosis card does for PRs.

## Entry format

```
## YYYY-MM-DD  <short title>
- Area: infra | ci | coordination | agent-orchestration | verification | scope | tooling
- What happened: one or two concrete sentences.
- Recurrence: one-off | recurring (Nx this session) | systemic (every session)
- Impact: time lost / risk / what nearly shipped wrong.
- Proposed level: brief-template | process-doc | ci-test | tooling | infra | no-change
- Status: open
```

The maintenance pass sets `Status` to `triaged`, then `fixed (PR #NNN)` or
`wont-fix (reason)`. The `.retro-state` marker at root records the last pass date so a
run only reads entries appended since.

---

## 2026-08-18  Agent worktrees living inside the repo break the local gate run
- Area: tooling
- What happened: Claude Code puts agent worktrees at `.claude/worktrees/<id>/`, inside the repo. They are git-excluded via `.git/info/exclude`, so git ignores them, but eslint and Prettier are not git-aware and walked straight into them. From the main directory `npm run lint` reported 119 errors and `npm run format:check` failed on 13 files, every one of them belonging to another branch's checkout. CI never sees these paths, so CI stayed green while the documented local self-test was unusable.
- Recurrence: systemic (every EM session that spawns an agent worktree, for as long as that worktree exists)
- Impact: `docs/development.md` 3 tells engineers and the EM to self-test against the CI gates locally before opening a PR. From the main directory that instruction produced a wall of failures unrelated to the change under test, which trains the reader to ignore two gates.
- Proposed level: tooling (add `.claude/worktrees/` to `.prettierignore` and the eslint ignores, matching how `archive/` and `dist/` are already handled)
- Status: fixed (PR #233) - both ignore lists now skip `.claude/worktrees/`; lint and format:check run clean from the main directory with the prototype worktree still in place.

## 2026-08-18  CI did not run on a pull request that targeted another stream's branch
- Area: ci
- What happened: `.github/workflows/ci.yml` triggered on `pull_request: branches: [main]`. Engine v4.1 Stream B was deliberately stacked on Stream A (hotspot H9: A and B ship as one deploy, so B branched off A's head and its PR targeted `feat/A-v41-selection`). The branch filter matches the PR's base, so PR #230 ran no CI at all and merged into A ungated. The gap was recorded inside the feature spec as 12.5 but never reached RETRO or the workflow.
- Recurrence: systemic (every stacked stream, and stacking is the documented pattern whenever two streams must ship as one deploy)
- Impact: a whole stream's worth of engine and composition changes merged with no typecheck, lint, format, or test gate. Nothing was caught late this time, but the merge gate the EM relies on simply was not there.
- Proposed level: ci (drop the branch filter from `pull_request` so every PR is gated whatever it targets)
- Status: fixed (PR #233) - the filter is gone from `pull_request`; `push` still runs on `main` only.

## 2026-08-18  Two docs claimed a CI gate that was never built
- Area: verification
- What happened: `CLAUDE.md`, `README.md`, and `docs/engine.md` 13 all stated that CI fails when `docs/engine.md` and the engine drift apart, 13 going as far as "CI enforces this with two checks" and describing them. There is no such check in `.github/workflows/`; a grep for any parity check returns nothing. The engine v4.1 verification pass found the practical consequence: a rule 7 that `docs/engine.md` still describes is dead in the code, and the drift survived because the convention was believed to be automated.
- Recurrence: systemic (a documented-but-nonexistent gate is trusted indefinitely, since the only way to discover it is to go looking for the file)
- Impact: spec-code drift shipped and was attributed to a gate that does not exist. Reviewers skip a check they believe CI already runs.
- Proposed level: ci-test (build the check that 13 describes) plus process-doc (until it exists, no doc may claim it)
- Status: fixed in part (PR #233) - `CLAUDE.md` and `README.md` now describe the pairing as the review discipline it is. `docs/engine.md` 13 still overstates it and is held for `/reconcile-docs`, since open PR #229 owns that file. Building the check is already required work in `features/engine-v4.md` 15.5; it was deliberately not added in a maintenance pass with three PRs open, because a new blocking gate could red them.

## 2026-08-18  A day of spec amendments and two ledger entries lived only in an uncommittable working tree
- Area: coordination
- What happened: `features/engine-v4.md` sections 11 to 15 and two `DECISIONS.md` entries were authored in the main directory, which the pre-commit hook blocks from committing code paths and which nobody had branched from. The content included the 2026-08-18 DO-NOT-MERGE verification verdict, the single most consequential fact about the active phase. Worse, the working copy of `DECISIONS.md` had dropped an entry that was already merged on `main`, so the append-only ledger was silently one entry short and would have stayed that way had the file been committed as-is.
- Recurrence: systemic (every EM-authored spec amendment and ledger append, since the EM works in the main directory by design and the hook makes committing there partial)
- Impact: an unbacked-up working tree held the phase's blocking verdict and three worktrees held three divergent copies of the same spec. A ledger entry was already lost and only a diff against HEAD recovered it.
- Proposed level: process-doc (the EM commits ledger and spec amendments the same day they are written, from a short-lived maintenance worktree, rather than accumulating them in the main directory) plus tooling (a session-close check that the main directory has no uncommitted tracked changes)
- Status: open

## 2026-08-18  A design handoff landed at the repo root and outlived its feature there
- Area: coordination
- What happened: `claude-design.md` says a handoff lands at `features/<feature name>/`. The wishlist and favorites handoff instead landed at the repo root as `design_handoff_wishlist_favorites/`. Phase 7 closed on 2026-07-15 and archived a byte-identical copy to `archive/features/wishlist-favorites-v2/handoff/`, but the root copy was never removed. It sat untracked at the root for five weeks, outside the CI root allowlist (which never saw it, being untracked) and inside Prettier's and eslint's scope, contributing 2 of the 119 lint errors and 9 of the 13 format failures above.
- Recurrence: recurring (the previous handoff model drifted the same way; see the 2026-06-17 handoff re-commission)
- Impact: low functional risk, but a stray untracked tree at the root defeats the repo-structure check by construction, since that check only runs in CI against a clean checkout.
- Proposed level: process-doc (feature close-out explicitly removes the working handoff copy once the archived copy is verified identical) plus no-change on the allowlist itself
- Status: open (the archived copy is verified byte-identical; removing the root copy needs Rajat's approval and is pending)

## 2026-07-15  Green engine tests missed a double-placement bug the guaranteed-favorites pass could produce
- Area: verification
- What happened: Stream A's guaranteed-favorites pass could place a favorite twice in one week (a favorite pinned on one day was also drawn by ordinary selection on an earlier day; the reconciliation only flagged under-placement, and `placedIds` being a Set hid the duplicate). All 619 engine tests were green because the favorites fixture used only exclusive-slot HP-gravy mains, which structurally cannot double-place; the companion-pool path that breaks was never exercised. Only an adversarial EM review caught it.
- Recurrence: recurring (any locked-invariant engine change whose tests do not span the pool shapes that can violate it)
- Impact: a core locked guarantee ("no favorite twice in a week") would have shipped broken; caught pre-merge by the review, fixed via pool-exclusion plus a companion-favorite fixture that goes 4x -> <=1.
- Proposed level: ci-test / process-doc; favorites fixtures must include a multi-position companion pool, and locked-invariant engine changes get an adversarial review by default rather than trusting a green suite.
- Status: fixed (PR #233) - the ci-test half already shipped in-stream (#223 added the companion-favorite fixture, 4x -> <=1). The process half lands as a default brief line in `new-stream.md`: a stream touching a locked invariant constructs the fixture that would break it, shows it failing before and passing after, and names the invariant in the PR body for adversarial review. Confirmed twice over since: the engine v4.1 gate found a faithful implementation of a bad spec, the same shape one level up. The `development.md` half is held for `/reconcile-docs`.

## 2026-07-15  Rebasing onto a PR that changed .prettierignore silently broke format:check
- Area: ci
- What happened: after Stream B rebased onto Stream A, `npm run format:check` went red in CI because A's merge had modified `.prettierignore`, shifting prettier's scope onto six frontend files B authored; B's post-rebase gate list ran typecheck/eslint/stylelint/tests/build but not format:check, so it looked green locally. The merge gate caught the red check before merge. This is a recurrence of the 2026-07-13 "brief omitted format:check" entry (fixed in #221 for `/new-stream`-generated briefs) via a new trigger: hand-authored EM briefs did not carry the #221 brief line, and the config change made a clean branch drift on rebase.
- Recurrence: recurring (every stream that rebases onto a base PR touching lint/format config, and every hand-authored brief that omits the #221 gate line)
- Impact: one red CI run and one fix round trip; no wrong code shipped (merge gate held).
- Proposed level: brief-template; every engineer brief (hand-authored included, not only `/new-stream` output) must require the FULL gate set including format:check after every rebase, called out specifically when the base PR touched lint/format config.
- Status: fixed (PR #233) - `new-stream.md` gains a default brief line requiring the full gate set including `format:check` after every rebase, naming `.prettierignore`, `.stylelintrc.json`, and the eslint config as the scope-shifting triggers, and requiring the PR body to say so out loud when the base touched them. PR #233 is itself an instance: it changes `.prettierignore` and `eslint.config.js`, and its own PR body carries the rebase warning.

## 2026-07-15  A lane-scoped removal orphaned an out-of-lane caller
- Area: coordination
- What happened: Stream A removed "Save for next week" within its own lane (engine/, app/convex/) but the deleted `markQueueDropped` mutation was still referenced by `scripts/slow-loop-mark-applied.mjs`, and `MAINTENANCE.md` / the slow-loop command brief still documented the `nextWeekQueue` signal. A's lane-scoped gates could not see the out-of-lane caller; it surfaced only because A flagged it by hand in its PR.
- Recurrence: recurring (any stream that deletes an exported symbol other lanes may call)
- Impact: low this time (the orphaned call is guarded and the queue is always empty, so nothing broke), but a differently-shaped removal could break the next `/slow-loop`; fixed in the close-out PR.
- Proposed level: process-doc; a stream that removes an exported function/table must run a repo-wide caller grep across all lanes (not just its own) before merge, and the EM checks it during review.
- Status: fixed (PR #233) - `new-stream.md` gains a default brief line: removing an exported symbol requires a repo-wide caller grep across `app/`, `engine/`, `scripts/`, `.github/`, and the ops docs, with the grep and its hits listed in the PR body. The practice is already proven; the day-comment removal (#231) relocated `markIncidentsResolved` out of a deleted file for exactly this reason. The `development.md` half is held for `/reconcile-docs`.

## 2026-07-13  Engineer-brief gate list omitted the Prettier format check
- Area: ci
- What happened: PR #215's engineer ran the brief's listed local gates (lint, typecheck, test) and pushed; CI failed on the separate `npm run format:check` step, costing a fix round trip. The brief template names lint/typecheck/tests/simulation but not format:check, which CI runs as its own step.
- Recurrence: recurring (will hit every stream whose brief copies the same gate list)
- Impact: one red CI run and one extra engineer round trip per stream; no wrong code shipped.
- Proposed level: brief-template
- Status: fixed (PR #221) — new-stream.md gains a "run `npm run format:check` before pushing" brief line (CI runs Prettier as its own step).

## 2026-07-13  Untracked feature specs in the main dir block the post-merge pull
- Area: coordination
- What happened: the feature spec lives untracked in the main dir until its activation stream commits it; when that PR merges, `git pull --ff-only` in the main dir aborts because the merge would overwrite the untracked file, and the abort is easy to miss when tailing output (the main dir silently stayed on the old commit until checked).
- Recurrence: systemic (every feature under the specs-committed-by-activation-stream model)
- Impact: a stale main dir masquerading as synced; caught this session by re-checking `git log` after the pull.
- Proposed level: process-doc
- Status: fixed (PR #221) — development.md §3 step 7 notes the post-merge `git pull --ff-only` can abort on the now-tracked untracked spec; confirm the pull landed with `git log`.

## 2026-06-16  Crawl gate cannot reach SSO-walled Vercel previews
- Area: infra
- What happened: Every PR preview returns HTTP 401 (Vercel deployment protection); the app never boots, so the engineering.md §16 per-slice crawl cannot run against the preview as documented. The localStorage gate-bypass only clears Plantry's own passcode, not Vercel's edge protection.
- Recurrence: systemic (every frontend slice this session: #101, #102, #105, #106)
- Impact: The documented crawl gate does not work as written; had to build each branch locally and crawl the static `dist/` as an unofficial workaround.
- Proposed level: infra (provision a Vercel "Protection Bypass for Automation" token; Rajat-approved 2026-06-16) + process-doc (engineering.md §16 crawl method, §11 env vars)
- Status: fixed (PR #109) — token provisioned as `VERCEL_AUTOMATION_BYPASS_SECRET` and verified (curl 401->200; Playwright 200, title Plantry, no Vercel wall); `smoke.mjs` gained a `CRAWL_URL` + bypass-header remote mode; engineering.md §16/§11 document the method, local `dist/` is the fallback. The two iOS-only checks still need a real device.

## 2026-06-16  Engineers editing CHANGELOG/DECISIONS cause merge conflicts
- Area: coordination
- What happened: Engineer briefs told engineers to append a CHANGELOG entry; D, E, and F all then collided on the top CHANGELOG entry and each rebase needed a manual resolve. This violates development.md §12.4 (CHANGELOG/DECISIONS are EM-batched).
- Recurrence: recurring (3x this session)
- Impact: A manual conflict resolution on every parallel branch's rebase.
- Proposed level: brief-template (strike "append a CHANGELOG entry" from `.claude/commands/new-stream.md` and the engineer brief) + process-doc (reinforce §12.4)
- Status: fixed (PR #124) — the process-doc half already shipped: development.md §11.4 (codified in #107) makes CHANGELOG/DECISIONS/feature stream-tables EM-owned and EM-batched. PR #124 adds the matching default brief lines to `new-stream.md` (engineers do not edit those files). The brief had no literal "append a CHANGELOG entry" line left to strike; the positive "do not edit" rule replaces it.

## 2026-06-16  Behind-branch "MERGEABLE/CLEAN" is not the post-merge truth
- Area: ci
- What happened: GitHub reported branches mergeable/clean while they were behind main and would break post-merge; branch protection structurally cannot catch a stale branch. Had to merge main into C, D, E, F and re-run CI on the true merged state before each merge.
- Recurrence: systemic (every parallel merge)
- Impact: A green PR can still break main on merge; only caught by a manual update-and-re-run.
- Proposed level: process-doc (a written pre-merge true-state gate in development.md §3/§4: update branch, re-run CI, re-bake, re-run count-sensitive tests before every merge)
- Status: fixed (PR #125) — development.md §3 step 4 and the §4 definition of done now require updating the branch onto origin/main and confirming a green engine check on the true merged state (re-bake, re-run count-sensitive tests) immediately before merge, not trusting a stale `mergeable` flag. Reinforces the one-line note already in §11.3.

## 2026-06-16  Coverage-ratchet tests hardcode dish counts (local-vs-CI desync)
- Area: ci-test
- What happened: `reports.test.ts` asserts `withPhoto toBe(<n>)`; adding 2 dishes (#100) flipped it to 252 and failed CI even though the local run passed against a stale baked count.
- Recurrence: recurring (every dish-count change)
- Impact: Silent until CI; "green locally" did not mean green in CI.
- Proposed level: ci-test (where 100% coverage is the invariant assert `withPhoto === activeDishCount`; keep exact counts only as a deliberate review signal, with the bake printing the expected value)
- Status: fixed (PR #124) — `reports.test.ts` now asserts `withPhoto === activeDishCount` (full active photo coverage), matching the withDescription/withRecipe/withComplexity invariants. A dish-count change no longer flips a hardcoded number; an active dish shipped without a photo correctly fails.

## 2026-06-16  Subagent watchdog kills long silent commands
- Area: agent-orchestration
- What happened: Streams C and D were killed at "no progress for 600s," almost certainly a long silent `npm install`/`npm test`. Partial work had to be resumed in place.
- Recurrence: recurring (2x this session)
- Impact: Lost in-flight work; required diagnosing and resuming worktrees.
- Proposed level: brief-template (make "run installs early, stream output, avoid single long silent commands" a default brief line)
- Status: fixed (PR #124) — `new-stream.md` now carries a default brief line: run installs and long test runs early and stream their output, since the watchdog kills ~600s of silence.

## 2026-06-16  Verification is indirect for several structural paths
- Area: verification
- What happened: Headless Chromium cannot reproduce the iOS-only fixes (safe-area padding, software-keyboard seam); a new slot type (Fruit of the day) did not render against the live week until it was regenerated, so it needed a seeded/mock week; and F's fruit-swap query was rejected during its crawl because the backend was not deployed at crawl time.
- Recurrence: systemic (every structural slice leaves a residual unverified path)
- Impact: Each slice ends with a "confirm on real device / after deploy" residual that can be lost if only stated verbally.
- Proposed level: process-doc (engineering.md §16: document what the crawl cannot verify headless, the seed-a-mock-week pattern, the crawl-after-preview-deploy rule, and a residual-check channel logged in the PR diagnosis card)
- Status: fixed (PR #125) — engineering.md §16 now documents the three paths the crawl cannot close (a new slot type renders only against a seeded/mock week; a backend-dependent flow must be crawled after the preview Convex deploy is live; real-device and after-deploy checks), and the development.md §5 diagnosis card gains a Residual checks field so each open verification item travels with the PR.

## 2026-06-18  smoke.mjs crawl harness false-positives on the Grocery feature
- Area: tooling
- What happened: Two harness artifacts surfaced while crawling the Grocery Day Selection feature, neither a product defect. (a) A websocket-timing race: the harness asserts after `networkidle` plus a fixed ~400ms delay, which fires before the live Convex data hydrates over the socket, so tabs intermittently report "can't be found" (a longer settle wait then finds them). (b) `SCREEN_GUTTER_CANDIDATES` is stale: it predates the Grocery rewrite and omits `.grocery-chooser` and `.grocery-list`, so the gutter check misfires on the Grocery tab.
- Recurrence: recurring (2x this feature: the timing race and the stale gutter list)
- Impact: A crawl can report a false "tab not found" or a false gutter miss on a tab that is actually correct, eroding trust in the gate and costing a re-run to disambiguate.
- Proposed level: tooling (settle on a real readiness signal in `smoke.mjs` instead of `networkidle` plus a fixed delay; refresh `SCREEN_GUTTER_CANDIDATES` to include the current Grocery selectors)
- Status: fixed (PR #174) — `smoke.mjs` now waits on a per-tab post-hydration selector instead of a fixed delay after `networkidle`, and `SCREEN_GUTTER_CANDIDATES` includes `.grocery-chooser` and `.grocery-list`.

## 2026-06-18  Fresh worktree needs `npm run bake` before typecheck/build/tests
- Area: tooling
- What happened: A freshly created git worktree fails `typecheck`/`build`/tests if run before `npm run bake`, because `engine/src/data/library.ts` and `engine/src/data/history.ts` are generated-and-gitignored (emitted by the bake from the markdown library). CI handles this via its bake step, but an engineer spawned into a fresh worktree who runs typecheck first hits a confusing "missing module" failure with no obvious cause.
- Recurrence: systemic (every fresh worktree that skips bake)
- Impact: A confusing first-run failure that looks like a broken checkout; time lost diagnosing a non-bug.
- Proposed level: brief-template (a one-line "run `npm install && npm run bake` before typecheck/build/tests" note in the engineer onboarding / `new-stream.md` brief; optionally a matching note in development.md)
- Status: fixed (PR #174) — `new-stream.md` now carries a default brief line: run `npm install && npm run bake` before any typecheck/build/test, because the baked `library.ts`/`history.ts` are generated-and-gitignored.

## 2026-06-18  Design-compare crawls were static-only until pushed to add behaviour
- Area: verification
- What happened: The first design-compare crawls (the Menu header and the past-day collapse) verified static rendering plus DOM assertions but not the behaviour of the new interactive affordances; the operator had to ask why the collapsed-day View action was never click-tested before a click-through was added. Later crawls (sheet close button, day-comment card, custom-dish add) then exercised the affordance end to end.
- Recurrence: recurring (2x this session before corrected)
- Impact: A crawl can report "looks right" while leaving a new control's behaviour unverified; an interactive element was nearly merged on a visual-only check.
- Proposed level: process-doc (engineering.md §16 and the development.md §5 diagnosis card: the crawl exercises every new interactive affordance, clicking the control and asserting the resulting state, not only screenshotting it)
- Status: fixed (PR #174) — engineering.md §16 and development.md §3 now state the crawl clicks every new interactive affordance and asserts the resulting state, not only screenshots it. (The §5 card's Residual checks field already covers verification gaps, so §5 was left unchanged.)

## 2026-06-18  A new write mutation can only be functionally tested by a live prod write
- Area: verification
- What happened: The new `appendCustomDish` mutation had no non-prod path to an end-to-end functional test. The dev Convex deployment is empty (no current week renders), so the UI crawl can exercise a new write only against the live prod week. The prod-write guard correctly blocked it pending explicit per-action approval, and once approved the test still had to append-then-delete to avoid leaving a junk dish on the live week. This is the sharper, new-mutation instance of the 2026-06-16 "verification is indirect" entry.
- Recurrence: systemic (every new write mutation)
- Impact: A new mutation's runtime correctness rests on deploy plus code-review unless the operator approves a live prod write, which also pollutes the live week unless manually cleaned up.
- Proposed level: infra (a seeded non-prod Convex test backend or a designated disposable test week the crawl can write to) + process-doc (extend the engineering.md §16 seed-a-mock-week / crawl-after-deploy pattern to the new-mutation functional path)
- Status: fixed (PR #174) — `scripts/seed-dev-week.mjs` seeds the dev deployment with a real generated current week the crawl can exercise write mutations against, and engineering.md §16 documents it. The seed was run against dev and verified (Menu + Grocery read paths populated; updated smoke crawl passes).

## 2026-06-18  Empty dev Convex also blocks visually verifying the Grocery list (a read-path CSS bug shipped)
- Area: verification
- What happened: #155's grocery card shipped with an unreset item-list `<ul>` (kept the browser-default 40px indent + ~16px bottom margin), so every item row sat ~40px right of its group label with dead space under each card. It escaped review because the Grocery list never renders during a crawl: the list needs a hydrated week and the dev Convex deployment is empty, so the populated list is never seen (the screen only shows "Loading grocery list..."). The operator caught it by comparing the live screen to the design. The fix (#165) was verified instead with a static render of `app/web/src/index.css` over a hand-built grocery DOM with mock data. This is the read-path / CSS-regression sibling of the same-day "new write mutation needs a live prod write" entry and the 2026-06-16 "verification is indirect" entry — same empty-dev-Convex root.
- Recurrence: systemic (every Grocery UI change needing visual verification)
- Impact: A grocery-card CSS regression can ship unseen; #155's misaligned rows reached prod and only an operator eyeball caught it.
- Proposed level: infra (a seeded non-prod Convex test week the crawl can render) + process-doc (until then, record in engineering.md §16 the static-`index.css`-render-of-a-mock-grocery-DOM technique as the way to verify Grocery-list CSS)
- Status: fixed (PR #174) — `scripts/seed-dev-week.mjs` seeds a dev current week the crawl renders the Grocery read path against; engineering.md §16 documents both the seeded week and the static-`index.css`-render-of-a-mock-grocery-DOM fallback. Seed run against dev and verified (Grocery list populated; updated smoke crawl passes on the real Grocery selectors).

## 2026-07-12  Finalize-before-cooking makes weekArchive record the planned week, not the cooked one
- Area: verification
- What happened: `finalizeWeek` snapshots archive rows at the moment it runs, and the household finalizes at preparation time (2026-07-06 was finalized ~10 minutes after generation, before 16 swaps and a custom add landed that week; 2026-07-13 was likewise finalized on generation day per Rajat's instruction). Post-finalize swaps never reach the archive, so the recency record that #211 wired into generation partly describes menus that were never cooked (the 2026-07-06 archive holds Thai red curry tofu on Monday; the live week shows it was swapped away).
- Recurrence: systemic (every finalized week that gets edited afterward)
- Impact: recency, Saturday alternation, and fruit rotation rank against partly fictional history; dishes actually cooked can rank as never-cooked and vice versa.
- Proposed level: process-doc or engine (either finalize at week end as the archive semantics assume, or make the archive follow post-finalize edits to a final week); needs a MAINTENANCE.md §6 triage with Rajat since it touches when he taps Finalize.
- Status: triaged (PR #221) — surfaced to Rajat; it touches when he taps Finalize, so it needs his call (finalize-at-week-end semantics vs archive-follows-post-finalize-edits). Not actioned autonomously.

## 2026-07-12  Convex dev smoke from a fresh worktree has two traps (stale dist bundle, anonymous .env.local)
- Area: tooling
- What happened: An engineer running the standard dev-deployment smoke hit both: (1) a stale gitignored `app/convex/dist/` (emitted by the root build) breaks `npx convex dev --once` bundling because `convex.json` declares `functions: "./"`, and (2) the auto-created `app/convex/.env.local` pointed at `anonymous:anonymous-convex` (a local backend), so the first smoke run silently targeted the wrong deployment until rewritten to `dev:lovely-curlew-631`.
- Recurrence: systemic (every engineer worktree that pushes to the dev deployment)
- Impact: ~10 minutes lost per stream; worse, a smoke "pass" against the anonymous local backend can be mistaken for a dev-deployment verification.
- Proposed level: tooling (exclude `dist/` from the Convex bundle or clean it in the smoke path; seed the correct dev deployment into worktree env propagation) + brief-template (name both traps in briefs that include a dev smoke)
- Status: fixed (PR #221) — brief half: new-stream.md names both traps (stale `dist/` bundle, anonymous `.env.local`). The `dist/`-exclude / env-propagation tooling half is flagged for a separate focused chore, not done here.

## 2026-07-13  An Opus engineer subagent was killed mid-rebase by a session usage limit
- Area: tooling
- What happened: during the wishlist feature an Opus engineer subagent was terminated mid-rebase when its session hit a usage limit. The work was not lost only because it was recovered by resuming from the transcript; had the interruption landed during an uncommitted edit or a half-applied rebase with no transcript to resume, the stream would have had to restart.
- Recurrence: systemic (any long-running engineer subagent can hit a usage or session limit mid-task, and a rebase is the worst moment to lose one)
- Impact: near-loss of an in-flight rebase; recovery depended on transcript-resume being available, which is not guaranteed.
- Proposed level: brief-template (engineer briefs for long-running or rebase-owning streams plan for interruption: commit early and push early so an intact remote branch always exists to resume from, and never sit on a large uncommitted working tree across a rebase)
- Status: fixed (PR #221) — new-stream.md gains a "commit and push early on long-running or rebase-owning streams" brief line.

## 2026-07-13  scripts/smoke.mjs is referenced by ops docs but does not exist on main
- Area: tooling
- What happened: the wishlist prod verification wanted the standard smoke script, but `scripts/smoke.mjs` is referenced by operational-doc and registry precedent (the RETRO PR #174 entries and the crawl/smoke workflow language) yet is not present on `main`. The prod smoke had to be improvised via the UI crawl harness instead of running a committed smoke script.
- Recurrence: systemic (every verification pass that follows the ops docs to `scripts/smoke.mjs` hits the same missing file)
- Impact: verification is ad hoc and non-reproducible; a documented smoke path that does not exist erodes trust in the ops docs and costs time re-improvising the check per stream.
- Proposed level: tooling + process-doc (either restore a committed `scripts/smoke.mjs` that the ops docs already assume, or update every reference to point at the real crawl-harness path; flag for the MAINTENANCE.md §6 reconcile-ops pass to reconcile the references against reality)
- Status: wont-fix (PR #221) — the reconcile-ops 2026-07-14 pass confirmed no live ops `.md` references `scripts/smoke.mjs`; the committed crawl/smoke harness is `app/web/e2e/smoke.mjs` with a `CRAWL_URL` remote mode (#109). Verification standardizes on that path; a committed prod-smoke wrapper is a separate tooling decision surfaced to Rajat.
