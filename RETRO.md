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
