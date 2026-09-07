# Plantry: repo orientation

Read this first.

## What Plantry is

A weekly meal planner for Rajat and Tuhina in Bangalore. A Progressive Web App reads a fixed dish library and a rules spec, generates a Mon-to-Sat menu (breakfast and lunch) every week, renders a shareable menu image and grocery list, and supports in-week dish swaps, custom dishes, and queued feedback. A separate slow loop turns that accumulated feedback into structural changes via human-approved pull requests.

Full product spec: `docs/product.md`.

## Doc hierarchy

Four canonical specs plus a phase plan and a changelog in `docs/`; the operational docs live at root.

- `docs/product.md`: what we are building, persona, scope, principles, tone, future scope. Owns scope decisions.
- `docs/engine.md`: the meal-planning rules spec. The TS engine mirrors it section by section, each section paired to a module under `engine/src/` and a test file; the pairing is held by review, not by a CI check. Owns rule decisions.
- `docs/engineering.md`: stack, Convex schema, data layer split, deploy model, hosting, Swiggy MCP shape, env vars. Owns stack and integration decisions.
- `docs/development.md`: session isolation, worktree workflow, ship workflow, definition of done, diagnosis card, slow-loop trigger, escalation rules, commit conventions. Owns "how to make changes" decisions. Implements the cross-project standard at `~/Downloads/AI Products/DEVELOPMENT-PLAYBOOK.md` and records this repo's deliberate deltas.
- `docs/PLAN.md`: the phase plan for the build, one row per phase with a verifiable outcome. Owns sequencing.
- `docs/CHANGELOG.md`: append-only chronological index of shipped changes. One entry per change, each ending with the `Updated:` line the reconciliation passes consume.

Read order by task:

- Starting any session that will touch code → `docs/development.md`. Always.
- Starting a session on a phase ("Begin development. We are on Phase N.") → `docs/PLAN.md`, the active spec in `features/`, and `coordination/active-streams.md`.
- Touching the rules or the engine → `docs/engine.md` + the matching `engine/src/` module.
- Touching Convex schema, frontend, deploy, hosting, integrations → `docs/engineering.md`.
- Asking why something exists → `docs/CHANGELOG.md`, then `archive/`.
- Starting or planning a feature → all four canonical specs + `features/<name>.md`.

## Currently building

_none_

When no feature is active, this line reads "_none_". It resets to `_none_` on feature close-out, when the last stream of a feature merges (`docs/development.md` §3 step 8).

## Working folders

- `data/`: human-edited dish library, ingredient catalog, dish photos, structural changelog, slow-loop dry-run fixtures, and the pre-app menu record kept as provenance. The slow loop's target.
- `engine/`: TypeScript engine module. Pure functions; imported by Convex functions and tests.
- `app/convex/`: Convex schema and server functions. The backend lives here.
- `app/web/`: Vite + React + TS PWA. Frontend.
- `features/`: the active feature's documents (spec, development plan, and whatever reviews and reports the phase carries). Empty (.gitkeep) between features.
- `archive/`: history. **Do not read for current truth.** Old plans, handoffs, retired docs.
- `.claude/skills/`: repo-scoped Claude Code skills (`/maintain`). `.claude/commands/`: repo-scoped slash commands (`/evolve-engine`, `/new-stream`).

## Working in this repo

Code-touching sessions work in their own git worktree. The main directory at `/Users/rajatmugdal/Downloads/AI Products/Plantry` is the EM's coordinate-and-review space; a pre-commit hook in `.git/hooks/` rejects commits from it. Engineers commit from their worktree.

The EM (this session by default) spawns engineers via `/new-stream <branch> <stream>`. Rajat invokes a maintenance sitting via `/maintain`, defined under `.claude/skills/`, and an engine evolution via `/evolve-engine`, defined with `/new-stream` under `.claude/commands/`.

Because several worktree sessions run at once, the EM keeps a live-session registry at `coordination/active-streams.md` (local, gitignored): every in-flight stream and the file lanes it owns. Read it before spawning any stream or starting code work so two sessions never collide on the same files; if lanes overlap, sequence the streams and record the merge order. The later-merging session always owns the rebase. Full protocol: `docs/development.md` §11.

Full ground rules (session model, branch naming, commit style, definition of done, ship workflow, escalation, anti-patterns) live in `docs/development.md`.

## Operational docs

- `MAINTENANCE.md`: spec for `/maintain`, the maintenance sitting: the boundary against engine evolution, the five passes (signals, health, docs, retro, hygiene), the evolution-request ledger, the state file, and the mark-applied action. Read before running `/maintain`.
- `EVOLVING-THE-ENGINE.md`: spec for re-deriving the meal-planning engine from what the household actually ate (the seven steps, the clean-room roles, the measurement rules, the run folder and its resume protocol). Read before running `/evolve-engine`.
- `ADDING-DISHES.md`: content-batch playbook for adding a new dish (schema, ingredients, photo prompt-refining, cuisine, the active/inactive review gate, the test snapshots that move). Read before authoring any new dish.
- `DECISIONS.md`: append-only log of decisions the EM has taken on Rajat's behalf, with reasoning. Scannable.
- `RETRO.md`: append-only ledger of the EM's own process and system friction. The EM appends at session close; the `/maintain` retro pass (`MAINTENANCE.md` §4.4) triages it into fixes.
- `claude-design.md`: the standing contract for Claude Design when it authors a design handoff.
- `docs/development.md`: ground rules for making changes in this repo.

## Project-specific style

- No em dashes or long dashes anywhere in newly produced text: user-facing content (PWA UI strings, generated menu images, grocery lists, share images) and internal docs alike (specs, CHANGELOG, DECISIONS, briefs, PR descriptions, code comments, commit messages). Use commas, parentheses, semicolons, or sentence breaks. Existing em dashes in append-only ledger history stay as written (those entries are never rewritten); reconciliation passes strip them from spec sections as they touch them.
- Canonical docs in `docs/` read as present-tense steady-state specs. No "added in", no "previously", no historical seams. The CHANGELOG holds the chronology.
- Explain non-obvious software, infra, data, finance, or business-strategy concepts inline; Rajat prefers more information, never less, on terms an experienced PM would not already know. Skip explanations for PM-craft and Indian quick-commerce knowledge.
