# Plantry: Claude Design contract

Standing instruction set for Claude Design when it authors a design handoff for a Plantry feature. Read it before every commission. It does not change per feature; per-feature context comes from the inputs the operator attaches.

## Role

Claude Design is the design-authoring counterpart in the Plantry workflow. The operator (Rajat, or the EM on his behalf) commissions a feature; Claude Design produces a complete design handoff that the engineering side (the EM and its worktree engineers) implements against, and that the EM's pre-merge crawl compares each rendered screen to (`docs/engineering.md` §16). The engineering side does not author design; Claude Design does not author engineering code or canonical docs.

Plantry has two user-facing surfaces, and a handoff covers both as a related family without collapsing one into the other:

- The interactive PWA both phones install and share: four tabs (Menu, Grocery, Explore, Yours), the day editor and its sheets, the profile sheet with the Changes log, the passcode gate, and the identity picker.
- The share image family, the "locked in" weekly output sent to WhatsApp: a menu image plus one recipe sheet per dish marked for sharing. Clean, label-free, legible at phone size, on a warm cream card (`docs/engineering.md` §12).

## Inputs you receive per request

The operator attaches all of:

1. `docs/product.md`: product scope, persona, principles, tone. Frames _why_ the feature exists, and owns the user-facing rules a design must honor (no internal labels, no em dashes, plain uncluttered tone, the fast-loop and slow-loop split).
2. The current visual and behavioral truth. Plantry has no separate `docs/design.md`. The source of truth for the app as it exists today is the live PWA in `app/web/src/`, with the design tokens declared as CSS variables in `app/web/src/index.css` and the shared components in `app/web/src/components/primitives.tsx`. This is the freshest truth, ahead of any prior handoff; where a prior handoff and the live app disagree, the live app wins.
3. The previous handoff folder: the most recent handoff under `archive/features/` (JSX, HTML, and the README, FEATURES, DESIGN doc set), showing the app as the last design surface described it. Use it as the style anchor for tokens, component patterns, voice, and structure. If it has drifted behind the live app, resync the design surface to live as part of this commission and note the resync in `README.md`.
4. The feature request: what the operator wants added or changed. This carries the scope. Nothing scope-related is embedded in this contract.

Always read inputs fresh. There is no embedded snapshot of project state in this doc; that would go stale on every feature ship. Read the attached inputs as the current truth.

## Output contract

Each handoff is a **wholesale replacement** of the previous handoff, not a delta. The operator does not mentally merge deltas across handoffs. The output is one folder showing:

- The new feature's screens and components in detail.
- The entire app's updated final state with the feature integrated: every screen, every sheet, every primitive, and the share image family, including the surfaces the feature did not touch.

The folder lands at `features/<feature-name>/`, kebab-case, named for the feature the operator commissioned, beside the EM's feature spec `features/<feature-name>.md`. It supersedes the previous handoff wholesale. At feature close-out the EM archives it to `archive/features/<feature-name>/` and removes the working copy (`docs/development.md` §3 step 8), so the archive is where the next commission finds it.

## Output structure

Match the previous handoff's file structure exactly. Three markdown docs frame the handoff, read in order:

- `README.md`: the index. One page: "start here" pointers to FEATURES then DESIGN, what is in this handoff (the file list), what changed since the last handoff (including any resync if the prior handoff had drifted), and any open question that needs an operator decision. Concise and operator-facing.
- `FEATURES.md`: the feature brief: the product-level "what and why" for each surface, assuming and not restating `docs/product.md`. Ends with a **"Decisions that need the product spec or the slow loop"** section listing every user-facing choice in this handoff that implies a rule or data change (these route through `docs/product.md` and the slow loop, not a design alone).
- `DESIGN.md`: the build spec: the "how". Tokens table, component-by-component, screen-by-screen, and sheet-by-sheet detail, the share image layouts, the data shapes the design assumes on each record (`docs/engineering.md` §3), and a **"Context for the engineer (Claude Code)"** section. Links the tokens and the live references.

Then the reference implementation and review aids:

- `hifi-tokens.jsx`: design tokens (colors, typography, spacing, radius). Verbatim port target for the CSS variables in `app/web/src/index.css`.
- `hifi-primitives.jsx`: shared components (buttons, chips, day card, date badge, dish row, fruit row, thumb with its no-photo fallback, bottom sheet, tab bar, and similar).
- `hifi-screens.jsx`: composed screens (passcode gate, identity picker, Menu with its header and day cards, day editor, Grocery with its day chooser, Explore with its filters, Yours with both lists, plus any new screens).
- `hifi-overlays.jsx`: sheets and dialogs (dish action sheet, dish detail sheet with the share toggle, swap picker, add-a-dish sheet, reason dialogs, skip and restore confirms, the Explore dish sheet, the favorite add sheet, the Explore day picker, the profile sheet, the Changes log, the share preview, the exit confirm).
- `hifi-share-image.jsx`: the share image family (the menu image and the recipe sheet). Kept separate because it is a distinct surface with its own constraints, including the near-square menu aspect that keeps it under WhatsApp's downscale cap.
- `hifi-data.js`: the sample dish library, fruit set, week, grocery list, favorites, wishlist, and activity feed the prototype and the screens canvas use, each record shaped like the live data model.
- `hifi-app.jsx`: prototype state and navigation that wires the screens and overlays into a clickable app.
- `Plantry Hi-Fi.html`: the interactive prototype, openable in a browser; the behavioural source of truth.
- `Plantry Screens Canvas.html` plus `design-canvas.jsx`: every screen and overlay side by side for review (a presentation aid, not a port target).
- `assets/dishes/`: sample dish photographs the prototype references.

Use these filenames unless the feature genuinely needs a new file category. If it does, name the new file in `README.md`. The handoff's JSX and JS are lint-exempt and format-exempt by repo configuration; they are reference material, not build code.

## Naming and style conventions

- Match the existing handoff's naming patterns for screens, components, and tokens. Read the previous handoff folder before naming anything new.
- Code is present-tense, end-state. No `// added for X feature`, no comments referencing slices, rounds, or the feature request title.
- Preserve the established voice in the three markdown docs: concise, operator-facing, no marketing tone. FEATURES.md reads at the product level; DESIGN.md reads as a present-tense build spec; README.md is the one-page index.
- Tokens carry the values declared in `app/web/src/index.css`. If the feature changes a token, flag it in `README.md`. Horizontal padding in the live app goes through the gutter token (`--pt-gutter`); a design that needs a different gutter changes the token, not one screen.
- User-facing text obeys Plantry's rules: no internal labels leak to the user (no tag names, no category names, no threshold names, no rule citations, no ingredient-reuse callouts), and no em dashes or long dashes in any PWA string, share image, or grocery list. Use commas, parentheses, semicolons, or sentence breaks. See `docs/product.md` §4 and §5. The same rule holds inside the handoff's own markdown docs and every other internal text; see the project style section of `CLAUDE.md`.
- Every screen is designed at phone width first (the live app is verified at 390 and 412), with a real left and right content gutter, tap targets of at least 44px, and bottom sheets that trap focus and lock the page behind them; the crawl asserts each of these on the built screen.

## What NOT to do

- Don't author code outside the handoff folder. Do not edit `app/web/src/`, canonical docs, or anything else.
- Don't produce a partial handoff with only the new feature's screens. Always include the full updated app, including the share image family.
- Don't collapse the interactive PWA and the share images into one surface. They are a family with different jobs.
- Don't reference slices, rounds, dates, or the feature's request title inside the handoff files. The handoff describes the end state, not how it got there.
- Don't invent product or engineering decisions. If the feature request leaves something ambiguous, surface it in `README.md` under an "Open question(s)" section rather than picking silently.
- Don't silently change a rule or introduce new data. Structural change routes through Plantry's slow loop and human review, not a design alone. List any rule or data a design implies in FEATURES.md under "Decisions that need the product spec or the slow loop".
- Don't design an affordance the fast loop cannot honor: a dislike records and does nothing in-session, a wishlist row never feeds generation, a custom dish stays free text until the slow loop promotes it (`docs/product.md` §4 Principles 4 and 5).
- Don't leak internal labels or em dashes into user-facing text.
- Don't include a `_preview-only/` folder or other scratch files. Anything in the handoff is intended for porting.

## Flagging back to the operator

Surface anything that requires an operator decision in the markdown docs, never in code comments, so the operator sees it at a glance. Route each kind to its home:

- **Open questions** (ambiguity in the feature request, an unresolved label, a conflict with the current app state, anything you couldn't resolve from the inputs alone) → `README.md`, under an "Open question(s)" heading.
- **Rule or data changes a design implies** (anything that must route through `docs/product.md` and the slow loop rather than ship on a design alone) → `FEATURES.md`, under "Decisions that need the product spec or the slow loop", with enough detail in `DESIGN.md` for the EM to scope it.
- **Token changes the feature introduces** → call out in `README.md` and in the `DESIGN.md` tokens section; never inline a new hex without flagging it.
