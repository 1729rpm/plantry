# Docs pass, sitting of 2026-09-07

## 1. Basis

**Window.** 2026-09-07 to 2026-09-07: the six `docs/CHANGELOG.md` entries dated 2026-09-07 that
landed after the previous docs and ops reconciles (#260, #262). The two entries below them (engine v6
cutover, #257; engine v6 integration, #256) were reconciled by #260 and #262; their `Updated:` lines
name nothing left open beyond items the later entries carry, so they were confirmed closed and not
reworked.

**Entries in the window.**

1. `/maintain`, the maintenance machinery as one skill with five passes (#269). `Updated:`
   `MAINTENANCE.md` (rewritten in the PR), `CLAUDE.md` and `docs/engineering.md` §14 (partly),
   `docs/development.md` §2, §3, §5, §6, `docs/product.md` §4 Principle 3.
2. Dislike write-back on slow-loop merge (#268). `Updated:` `MAINTENANCE.md` §3 (done in #269).
3. `/evolve-engine` reads the evolution-request ledger (#267). `Updated:` none.
4. The engine-evolution process is a skill: `/evolve-engine` (#264). `Updated:`
   `docs/development.md` §2 (`evolve/engine-<version>`), `docs/engineering.md` §14 (the root doc,
   `.claude/evolve/`).
5. Hummus is a lunch main; the 8-week fixture's threshold 1 artifact recorded (#259). `Updated:`
   none.
6. Phase 9 closes: engine v6 shipped, docs reconciled, harness and cleanup PRs landed (#263).
   `Updated:` none (the gate report stays under `features/` as the harness's living output, which the
   folder descriptions in `CLAUDE.md` and `docs/engineering.md` §14 did not say).

**Deferred items carried in** (from `.maintenance-state`, docs section).

1. `docs/product.md` §4 Principle 3 says spec-code parity is a CI failure. Closed.
2. `docs/engineering.md` §14 describes `MAINTENANCE.md` as the slow-loop plus reconciliation plus
   retro-intake spec and cites sections that moved. Closed (with the two DECISIONS-flagged
   additions folded in: `EVOLVING-THE-ENGINE.md` at root, `.claude/evolve/`).
3. `docs/development.md` §2 gains `docs/maintenance-<date>` as the docs pass's branch and drops
   `docs/ops-<date>`; §6 becomes "Maintenance trigger"; §5's card gains the evolution-request line.
   Closed (with the DECISIONS-flagged `evolve/engine-<version>` folded in).

**Handoffs carried in.**

- From the retro pass: `docs/development.md` §3 step 8 gains the handoff clean-up step (the working
  copy of a design handoff is removed once the archived copy is verified byte-identical). Done.
- From `DECISIONS.md` (2026-09-07, the evolve-engine entry) and the #264 entry: the two items above,
  folded into deferred items 2 and 3. Done.

## 2. Standing checks

1. **The spec-code parity claim.** Drift found in `docs/product.md` §4 Principle 3 ("a
   continuous-integration failure"); rewritten to "held by review, not by a CI check
   (`docs/engine.md` §16.2)". `docs/engineering.md` §15 gate 2 and `docs/engine.md` §16.2 already
   say so; `docs/engine.md` §16's opening ("Both stay in lockstep") is qualified by §16.2 two
   paragraphs down and was left as written. The brief's own pointer for this check named
   `docs/engine.md` §13, which is "Picker ranking"; corrected to §16 and §16.2.
2. **Section-number pointers.** Every `<file>.md §<n>` reference in lane A, lane B, the skill and
   command briefs, the evolve roles and templates, the e2e harnesses, and the mark-applied script was
   enumerated by grep and resolved against each document's heading list. All resolve to a section
   about what the citing sentence says. Two pointers were corrected as a by-product: the docs
   brief's `docs/engine.md` §13 (above) and `docs/engineering.md` §14's `MAINTENANCE.md` §6 for the
   retro intake (now §4.4). No pointer into a section that does not exist was found.
3. **The command and skill inventory.** `.claude/skills/` holds `maintain`; `.claude/commands/` holds
   `evolve-engine.md` and `new-stream.md`. `CLAUDE.md` and `docs/engineering.md` §14 enumerate exactly
   those. Pass. `docs/development.md` §6 pointed at `.claude/commands/slow-loop.md`, which does not
   exist; fixed by the §6 rewrite.
4. **The root inventory.** The CI allowlist regex, `MAINTENANCE.md` §4.5, and `docs/engineering.md`
   §14 agree on every entry, with one drift: §14's layout omitted `EVOLVING-THE-ENGINE.md`, which the
   regex and §4.5 both carry. Added. `.claude/evolve/` and `app/web/e2e/` were also added to the
   layout as annotated sub-entries (the regex is root-only, so neither affects it).
5. **Branch names.** `.claude/commands/evolve-engine.md` named `evolve/engine-<version>` and
   `feat/engine-<version>`, and `.claude/commands/new-stream.md` named `fix/<branch>`, none of which
   `docs/development.md` §2 defined (`fix/*` is the prefix of 28 merged PRs). All three are now
   defined in §2; the evolve command's "this brief is where the name is defined" note was trimmed to
   a pointer. `docs/engineering.md` §9's branch line was trimmed to a pointer at §2.

## 3. Lane A: canonical documents

**`docs/product.md`** (606904b). §4 Principle 3: parity is held by review, not by a CI check
(standing check 1, deferred item 1). §4 preamble: "slow-loop proposal" becomes "maintenance or
evolution proposal" (#269).

**`docs/engine.md`**: untouched. Its parity wording (§16.2) is already correct, and nothing in the
window changed a rule's description. Hummus (#259) is a data value, not a rule.

**`docs/engineering.md`** (78ed191). §2: the data-layer table gains `data/engine-requests.md` on the
git side (#269). §3: the `dishDislikes` sketch gains `resolvedPr?` and its `consumedWeekStart`
comment states the ISO Monday (#268; the entry's `Updated:` line named only `MAINTENANCE.md`, the
sketch was found by scanning the body); the paragraph after the schema names the signals pass and
says all three signal tables leave the queue through the mark-applied action. §9: the branch line is
a pointer at `docs/development.md` §2 (standing check 5). §14: the header names CI's enforcement and
the hygiene pass's check and the three-place rule; the layout describes `MAINTENANCE.md` as the
`/maintain` spec, adds `EVOLVING-THE-ENGINE.md`, points `RETRO.md` at §4.4, annotates
`.github/workflows/`, adds `.claude/evolve/` and `app/web/e2e/`, retitles the `data/` and
`test-fixtures/` lines for the signals pass, and says what `features/` and `archive/` hold between
and during sittings and runs (#269, #264, #263; deferred item 2; standing checks 3 and 4).

**`docs/development.md`** (73eb39d). Intro: "maintenance trigger". §2: `feat/<short-name>` for a
standalone stream, `feat/engine-<version>`, `fix/<short-name>`, `evolve/engine-<version>`, and the
two `/maintain` PR branches with their roles (deferred item 3, #264, standing check 5). §3 step 6:
the `Updated:` line queues the docs pass of `/maintain`; step 8: close-out queues a `/maintain`
sitting (docs and signals) and removes a design handoff's working copy once the archive is verified
byte-identical (#269, `MAINTENANCE.md` §8, the retro handoff). §5: "maintenance PRs"; one paragraph
that inside `/maintain` a rule edit or engine code resolves to an evolution request (deferred item
3). §6: rewritten as "Maintenance trigger", the five passes at the depth the slow loop had (deferred
item 3, #269). §7: "maintenance reasoning"; "a `/maintain` sitting or an `/evolve-engine` run". §9:
existing values go through the signals pass, rules through `/evolve-engine`. §11.4: reconciled by the
docs pass of `/maintain`. §7, §9, and §11.4 were not in the `Updated:` line; each named the retired
`/slow-loop` or `reconcile-docs` command, which the #269 entry replaces.

## 4. Lane B: operational documents and briefs

**`README.md`**: untouched. It restates no fact the window moved.

**`CLAUDE.md`** (6f10dd0). Doc hierarchy: "maintenance trigger"; the CHANGELOG line names the
`/maintain` docs pass. Working folders: `data/` names the ledger and the signals pass; `features/`
says it also holds a sitting's artifacts, a run's folder, and the living gate report (#269, #263).
Style: the docs pass strips em dashes, not "reconciliation passes".

**`MAINTENANCE.md`** (175154d). §3.2: the dislike mutation sets `status`, `resolvedPr`, and
`consumedWeekStart`; it does not set `resolvedAt`, and the table has no such column (code wins over
the document; see §5 below). Everything else read as current against the structure document and
the skill tree.

**`ADDING-DISHES.md`** (93fc2a8). Intro: sibling to both `MAINTENANCE.md` and
`EVOLVING-THE-ENGINE.md`, with the boundary stated in one clause. §0: a rule change or a new tag
value is `/evolve-engine`'s via the ledger; the health pass names content priorities for this
playbook and never authors a dish (#269).

**`EVOLVING-THE-ENGINE.md`**: untouched. #264 and #267 wrote it; its §1 boundary, §4.1 snapshot,
and §4.7 cutover marking match the command brief and the evolve roles.

**`claude-design.md`**: untouched. It names "the slow loop" only as the product concept
(`docs/product.md` §4 Principle 4), not the retired command.

**`RETRO.md` header** (6cb02a7). Title dash stripped; the header names the `/maintain` retro pass
instead of "the maintenance job". Entries untouched.

**`.claude/skills/maintain/passes/docs.md`** (46664ce). Standing check 1's pointer: `docs/engine.md`
§16 and §16.2, not §13.

**`.claude/skills/maintain/SKILL.md`, `passes/signals.md`, `passes/health.md`, `passes/retro.md`,
`passes/hygiene.md`, `templates/*`**: untouched. Every pointer resolves; the root inventory in
`passes/hygiene.md` and `MAINTENANCE.md` §4.5 matches the regex.

**`.claude/commands/evolve-engine.md`** (fd7f8f7). Branch-naming section: both names point at
`docs/development.md` §2 now that §2 defines them.

**`.claude/commands/new-stream.md`**: untouched. Its `fix/<branch>` is now defined in §2.

**`.claude/evolve/templates/CHANGES.md`** (763cbb9). §7: "the docs pass of `/maintain`" replaces
"the operational reconciliation pass". Role briefs untouched (no section pointers; #267's lines
present in the critic and decider briefs).

**`app/web/e2e/smoke.mjs`, `back-nav.mjs`**: untouched. The tab list (`Menu`, `Grocery`, `Explore`,
`Yours`), the per-tab readiness selectors, the profile sheet via `.menu__switch`, the "Changes to
this week" row into the tall sheet, the swap picker path, and the exit-confirm labels were each
checked against `app/web/src/` and all exist. The crawl asserts no retired tab.

## 5. Conflicts and flags

1. **CHANGELOG disagrees with code (code wins).** The #268 entry says the dislike mutation stamps
   "the ISO Monday of the run and the merged PR URL", and `MAINTENANCE.md` §3.2 (rewritten in #269)
   additionally said `resolvedAt: now`. `app/convex/schema.ts` declares no `resolvedAt` on
   `dishDislikes` and `dishDislikesMutations.ts` patches only `status`, `consumedWeekStart`, and
   `resolvedPr`. §3.2 now matches the code. For human review only in the sense that the entry's
   wording was right and the spec's was not.
2. **Canonical and operational disagree (canonical wins, operational trimmed).**
   `.claude/commands/evolve-engine.md` claimed to be where `evolve/engine-<version>` is defined;
   `docs/development.md` §2 now defines it and the brief points there. `docs/engineering.md` §9's
   branch list is likewise a pointer.
3. **Ownership guess.** `fix/<short-name>` was named only in `new-stream.md` and used by 28 PRs;
   defining it in §2 was the smaller change against removing it from the brief. Flagged as a
   judgment; reversible by deleting one line.
4. **Brief narrower than the spec.** `MAINTENANCE.md` §7 says "a ledger's instructional header is
   spec and the docs pass may correct it" (any ledger); this pass's brief carves out only
   `RETRO.md`'s header. The brief was obeyed, so `docs/CHANGELOG.md`'s format header, which still
   names `/reconcile-docs` and `/reconcile-ops` as the `Updated:` line's consumers, was not touched.
   Recorded under Deferred with the decision it needs.
5. **`docs/product.md` line 1 versus §6.** The opening paragraph says the app is "four tabs (Menu,
   Grocery, Explore, Changes)"; §6 says Menu, Grocery, Explore, Yours, and the app agrees with §6.
   Outside the window and the standing checks, so deferred rather than fixed while the file was
   open.

## 6. Deferred

- `docs/product.md` line 1 names the tabs as Menu, Grocery, Explore, Changes; the fourth is Yours
  (§6 and the app agree). One word, predates the window.
- `docs/product.md` §1, §4 Principle 4, and §9 still list "save a dish for next week" / "save"
  among the fast-loop actions; save-for-next-week was removed with the Yours tab. Predates the
  window.
- `docs/CHANGELOG.md` format header (lines 12 to 13) names `/reconcile-docs` and `/reconcile-ops`
  as the `Updated:` line's consumers. `MAINTENANCE.md` §7 lets the docs pass correct any ledger's
  header; the pass brief carves out `RETRO.md` only. Needs one decision: widen the brief's carve-out
  to match §7, or narrow §7. Either way a two-line edit.
- `docs/engineering.md` §2's Convex column omits `favorites`, `wishlist`, and `dishDislikes`; the
  table is illustrative but a reader of the data-layer split would expect the signal tables there.
  Predates the window.
- `docs/PLAN.md` Phase 2's outcome cell reads "The slow loop, reconciliation passes, retro intake,
  and content-batch tracks all run": a shipped phase's historical outcome, not in either lane; left
  as a note in case the EM wants the plan's wording to name the skills.
- The gate report's corrected-run preamble sentence ("every week of this fixture predates cutover")
  is produced by `engine/scripts/gate.ts` line 1799 and is now wrong for a prod export that carries
  a `generatedPlan` (the health pass's handoff). It sits in `engine/`, which this pass may not edit;
  a chore-sized conditional on whether the fixture carries any generated plan, plus a re-run of the
  report.
- `app/web/e2e/smoke.mjs` line 448 carries a code comment that narrates a phase ("Phase 7 moved the
  Changes log out of its own tab"). The crawl's assertions are current; the comment is a historical
  seam in code, which the style rules address for documents. Left for the next e2e-touching stream.
- `README.md` says Explore hides "anything already planned or already on a shared list"; the
  product spec (§3 item 4) says only dishes on this week's plan are hidden. Not verified against
  `getExploreFeed` this pass; one of the two documents is wrong.

No contended files this sitting.

## 7. Commit plan

Lane A, then lane B, one document per commit, on `docs/maintenance-2026-09-07`:

1. 606904b `docs: reconcile docs/product.md (Principle 3 parity held by review)`
2. 78ed191 `docs: reconcile docs/engineering.md (root layout, dislike write-back, branch pointer)`
3. 73eb39d `docs: reconcile docs/development.md (branch names, maintenance trigger, close-out, card)`
4. 6f10dd0 `docs: reconcile CLAUDE.md (maintenance trigger, features folder, docs-pass pointers)`
5. 175154d `docs: reconcile MAINTENANCE.md (dislike mutation writes no resolvedAt)`
6. 93fc2a8 `docs: reconcile ADDING-DISHES.md (sibling workflows, evolution path, health-pass priorities)`
7. 6cb02a7 `docs: reconcile RETRO.md header (retro pass named, title dash stripped)`
8. 46664ce `docs: reconcile .claude/skills/maintain/passes/docs.md (parity check pointer to engine.md §16)`
9. 763cbb9 `docs: reconcile .claude/evolve/templates/CHANGES.md (docs pass named)`
10. fd7f8f7 `docs: reconcile .claude/commands/evolve-engine.md (branch names point at development.md §2)`

Gates: `npm run format:check` and `npm run lint` green on the committed tree. This artifact and
`.maintenance-state` are left uncommitted for the EM.
