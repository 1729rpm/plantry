# Plantry design handoff

Complete design for the Plantry PWA and its shareable output family, level with the live app. This folder is a wholesale replacement of the previous handoff.

## Start here

- **`FEATURES.md`** — the feature brief: what each surface does and why, at the product level. Read it first.
- **`DESIGN.md`** — the build spec: tokens, components, screen-by-screen and overlay-by-overlay detail, the data shapes the design assumes, and a "context for the engineer (Claude Code)" section. It links the tokens and the live references.

## What is in this handoff

- `Plantry Hi-Fi.html` — the interactive prototype; the behavioural source of truth. Full flows across all four tabs, the day editor, the pickers, the dish sheets, and the share preview.
- `Plantry Screens Canvas.html` — every screen and overlay side by side, including the states (skipped day, busy week, filter panel, pickers, share preview) and the shareable image family.
- `hifi-tokens.jsx` design tokens (verbatim port target for `app/web/src/index.css`). `hifi-primitives.jsx` shared components. `hifi-screens.jsx` composed screens. `hifi-overlays.jsx` sheets and dialogs. `hifi-share-image.jsx` the shareable images. `hifi-data.js` the sample library, fruit set, week, grocery, and activity, with the shape each record needs. `hifi-app.jsx` prototype state and flow wiring.
- `assets/dishes/` photographs for the sample dishes.
- `design-canvas.jsx` is a presentation aid for the canvas page, not a port target.

## What changed since the last handoff

The previous handoff had drifted roughly two dozen shipped features behind the live app; this resyncs the design surface and adds the brand-led Menu header and the past-day collapse. The full grouped delta is in `DESIGN.md` and `FEATURES.md`. The user-facing decisions that imply a rule or data change (and so route through the slow loop) are called out in `FEATURES.md` under "Decisions that need the product spec or the slow loop".

## Open question

The collapsed past-day action is labelled **View**; alternatives are Open, Review, or See day. Pick one and it propagates.
