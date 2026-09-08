# Validation: high-confidence dish audit fixes

Date: 8 September 2026. Base commit: `a8778b8`. Working checkout: `/tmp/plantry-dish-audit-fixes`, branch `fix/dish-audit-confidence`.

## Results

- Engine tests: **718 passed**, including the v6 generation gate, live-data round trips, catalog resolution, special-sourcing snapshots and six new dish/grocery regressions.
- Web tests: **116 passed** in the full suite, plus **one new passing rendered-component regression** for the disabled Healthy filter and its omission from fruit pickers. Total: **835 tests passed**.
- `npm run bake`: passes; 270 dishes, 103 catalog entries, 1,554 ingredient rows, 11 pack-size entries, 119 history seed rows.
- `npm run build`: passes for the engine and production PWA, including service-worker generation. Vite emits the existing non-blocking large-chunk warning.
- `npm run typecheck`: passes.
- `npm run lint` and `npm run lint:css`: pass.
- `npm run format:check`: passes after formatting the handoff.
- `git diff --check`: passes.
- `npm run reports`: passes and explicitly labels tracked-ingredient macro totals as partial. The report is included as `post-fix-reports-2026-09-08.txt`.
- Scope cross-check: the changed dish IDs equal exactly the 106 IDs named in H01-H50. All 270 IDs, active flags, HP tags, categories, meal times, preferred flags and satiety values are preserved.
- Handoff completeness: all 59 medium-confidence finding groups and all 270 post-fix dish snapshots are present, along with the full 103-entry catalog.

## Interpretation

All high-confidence finding groups are addressed. H51 uses the conservative alternative in the audit: partial inputs remain explicitly partial, `healthy` is unknown, and the app does not offer a positive health classification. This does not complete full-recipe nutrition modeling or verify the medium-confidence raw/cooked/product assumptions.

New ingredient amounts are documented two-person recipe defaults. They are not kitchen-tested household yields. The medium review includes overlaps and a refreshed protein comparison; the original comparison has 43 flags, while the current partial-input comparison has 40 across active and inactive dishes.

## Delivery and remaining review

The implementation and this validation record ship together in the fix PR. The original pre-commit delivery patch was verified against a clean copy of the base commit and remains a historical local delivery artifact. GitHub PR and deployment checks are authoritative for shipping status.

The changed filter is verified with a server-rendered component test; no live preview, full-flow browser crawl or real-iPhone check is claimed. Those pre-merge deployment checks remain with the eventual ship workflow. Point 4 remains deferred.
