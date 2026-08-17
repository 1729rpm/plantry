# engine/proto-v4: THROWAWAY PROTOTYPE

This directory is **not production code**. It is a parallel, disposable implementation of the
`features/engine-v4.md` rules, built purely to run a 25-week forward simulation and judge whether
the v4 rules produce menus the household would keep.

Ground rules that make it safe to sit next to the real engine:

- Nothing here is imported by `engine/src/`, `app/convex/`, or `app/web/`. The dependency arrow
  points one way only: proto-v4 imports v3 modules, never the reverse.
- It is outside the engine's `tsconfig.json` include list and outside `vitest.config.ts`'s test
  glob, so `npm test` and `npm run typecheck` in `engine/` are exactly as green as before this
  directory existed. Proto-v4 carries its own `tsconfig.json` and `vitest.config.ts`.
- `pairsWith` is new dish data in the v4 spec. Rather than editing 266 files in `data/dishes/`,
  it lives here as a prototype-local overlay keyed by dish id (`src/pairsWith.ts`).

## Layout

| File                        | What it holds                                                    |
| --------------------------- | ---------------------------------------------------------------- |
| `src/types.ts`              | Roles, picks, week/day shapes, the incident record               |
| `src/pairsWith.ts`          | The `pairsWith` overlay (spec plate rule 7 initial data)         |
| `src/pool.ts`               | §3.1 pool, plus every position-pool predicate the templates read |
| `src/frequency.ts`          | §3.4 step 2 frequency window and eaten counts                    |
| `src/guard.ts`              | §3.4 step 3 seven-day repeat guard, and date arithmetic          |
| `src/rank.ts`               | The v4 ranker (pin, guard, within-week, frequency, tiebreaks)    |
| `src/favoritesV4.ts`        | §3.4 step 1 favorites pinning with the `timesPerWeek` dial       |
| `src/composeV4.ts`          | §3.2 templates and §3.3 plate rules                              |
| `src/generateWeekV4.ts`     | Per-week orchestration, cap assert, history rows                 |
| `src/simulate.ts`           | The sequential, self-feeding N-week simulation                   |
| `scripts/run-simulation.ts` | Writes the four output artefacts                                 |

## Running it

```
cd engine
npx tsc -b proto-v4                      # typecheck + build
node proto-v4/dist/proto-v4/scripts/run-simulation.js
npx vitest run --config proto-v4/vitest.config.ts
```

## Reading the results

`run-notes.md` in the simulation output directory is the engineering report: spec gaps, judgment
calls, what was found unimplementable, and the determinism check.
