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

## 2026-06-16  Crawl gate cannot reach SSO-walled Vercel previews
- Area: infra
- What happened: Every PR preview returns HTTP 401 (Vercel deployment protection); the app never boots, so the engineering.md §16 per-slice crawl cannot run against the preview as documented. The localStorage gate-bypass only clears Plantry's own passcode, not Vercel's edge protection.
- Recurrence: systemic (every frontend slice this session: #101, #102, #105, #106)
- Impact: The documented crawl gate does not work as written; had to build each branch locally and crawl the static `dist/` as an unofficial workaround.
- Proposed level: infra (provision a Vercel "Protection Bypass for Automation" token; Rajat-approved 2026-06-16) + process-doc (engineering.md §16 crawl method, §11 env vars)
- Status: open

## 2026-06-16  Engineers editing CHANGELOG/DECISIONS cause merge conflicts
- Area: coordination
- What happened: Engineer briefs told engineers to append a CHANGELOG entry; D, E, and F all then collided on the top CHANGELOG entry and each rebase needed a manual resolve. This violates development.md §12.4 (CHANGELOG/DECISIONS are EM-batched).
- Recurrence: recurring (3x this session)
- Impact: A manual conflict resolution on every parallel branch's rebase.
- Proposed level: brief-template (strike "append a CHANGELOG entry" from `.claude/commands/new-stream.md` and the engineer brief) + process-doc (reinforce §12.4)
- Status: open

## 2026-06-16  Behind-branch "MERGEABLE/CLEAN" is not the post-merge truth
- Area: ci
- What happened: GitHub reported branches mergeable/clean while they were behind main and would break post-merge; branch protection structurally cannot catch a stale branch. Had to merge main into C, D, E, F and re-run CI on the true merged state before each merge.
- Recurrence: systemic (every parallel merge)
- Impact: A green PR can still break main on merge; only caught by a manual update-and-re-run.
- Proposed level: process-doc (a written pre-merge true-state gate in development.md §3/§4: update branch, re-run CI, re-bake, re-run count-sensitive tests before every merge)
- Status: open

## 2026-06-16  Coverage-ratchet tests hardcode dish counts (local-vs-CI desync)
- Area: ci-test
- What happened: `reports.test.ts` asserts `withPhoto toBe(<n>)`; adding 2 dishes (#100) flipped it to 252 and failed CI even though the local run passed against a stale baked count.
- Recurrence: recurring (every dish-count change)
- Impact: Silent until CI; "green locally" did not mean green in CI.
- Proposed level: ci-test (where 100% coverage is the invariant assert `withPhoto === activeDishCount`; keep exact counts only as a deliberate review signal, with the bake printing the expected value)
- Status: open

## 2026-06-16  Subagent watchdog kills long silent commands
- Area: agent-orchestration
- What happened: Streams C and D were killed at "no progress for 600s," almost certainly a long silent `npm install`/`npm test`. Partial work had to be resumed in place.
- Recurrence: recurring (2x this session)
- Impact: Lost in-flight work; required diagnosing and resuming worktrees.
- Proposed level: brief-template (make "run installs early, stream output, avoid single long silent commands" a default brief line)
- Status: open

## 2026-06-16  Verification is indirect for several structural paths
- Area: verification
- What happened: Headless Chromium cannot reproduce the iOS-only fixes (safe-area padding, software-keyboard seam); a new slot type (Fruit of the day) did not render against the live week until it was regenerated, so it needed a seeded/mock week; and F's fruit-swap query was rejected during its crawl because the backend was not deployed at crawl time.
- Recurrence: systemic (every structural slice leaves a residual unverified path)
- Impact: Each slice ends with a "confirm on real device / after deploy" residual that can be lost if only stated verbally.
- Proposed level: process-doc (engineering.md §16: document what the crawl cannot verify headless, the seed-a-mock-week pattern, the crawl-after-preview-deploy rule, and a residual-check channel logged in the PR diagnosis card)
- Status: open
