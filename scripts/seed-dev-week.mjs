#!/usr/bin/env node
// Seed the DEV Convex deployment with a real generated current week so the UI
// crawl (app/web/e2e/smoke.mjs) and the EM's in-depth crawl-and-compare can
// render the read-path screens (the Grocery list, the Menu week) and exercise
// write mutations against a live-shaped week, without ever touching prod.
//
// WHY THIS EXISTS
// ---------------
// The dev deployment (lovely-curlew-631) is empty, so getCurrentWeek returns
// null and the app never hydrates a week: the Grocery list shows only
// "Loading grocery list..." and write mutations have no week to mutate. That
// left two verification paths unclosed: visually verifying the Grocery list
// (a read-path CSS regression shipped unseen, RETRO 2026-06-18) and
// functionally testing a new write mutation off prod (RETRO 2026-06-18). This
// seed closes both by reusing the REAL generation path rather than a parallel
// mock that could drift from the live schema.
//
// WHAT IT DOES
// ------------
// Runs the same internalMutation prod uses to make the weekly menu,
// generateWeek:generateCurrentWeek, against the DEV deployment. That mutation
// reads the baked library and history (engine/src/data/*.ts, emitted by
// `npm run bake`) and writes one currentWeek row plus any engine incidents. It
// replaces any existing row for the same weekStart, so it is idempotent and
// safe to re-run. getCurrentWeek returns the row with the largest weekStart, so
// the seeded week renders regardless of today's date.
//
// PREREQUISITES
// -------------
//   1. `npm install && npm run bake` at the repo root (emits the baked library
//      and history the generation reads).
//   2. A logged-in Convex session (~/.convex) or CONVEX_DEPLOY_KEY for dev.
//
// USAGE
// -----
//   node scripts/seed-dev-week.mjs                 # seeds the current week's Monday
//   node scripts/seed-dev-week.mjs 2026-06-15      # seeds a specific Monday (YYYY-MM-DD)
//
// The `--push` flag is passed to `convex run` so dev gets the current functions
// before the mutation runs (a fresh dev deployment may lag main). This NEVER
// targets prod: the deployment name is hard-pinned to the dev deployment below
// and the script refuses any weekStart that is not an ISO date.

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Hard-pinned DEV deployment. This script must never reach prod
// (disciplined-chameleon-263); seeding is a dev-only operation.
const DEV_DEPLOYMENT = "lovely-curlew-631";

const __dirname = dirname(fileURLToPath(import.meta.url));
const convexDir = resolve(__dirname, "..", "app", "convex");

/** Monday (YYYY-MM-DD, UTC) of the week containing `date`. */
function mondayOf(date) {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0 = Sun
  const diff = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

const arg = process.argv[2];
const weekStart = arg ? arg : mondayOf(new Date());

if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
  console.error(`seed-dev-week: weekStart must be an ISO date (YYYY-MM-DD), got "${weekStart}".`);
  process.exit(1);
}

console.log(
  `seed-dev-week: generating a current week for ${weekStart} on DEV (${DEV_DEPLOYMENT})...`,
);

const result = spawnSync(
  "npx",
  [
    "convex",
    "run",
    "--deployment",
    DEV_DEPLOYMENT,
    "--push",
    "generateWeek:generateCurrentWeek",
    JSON.stringify({ weekStart }),
  ],
  { cwd: convexDir, stdio: "inherit" },
);

if (result.status !== 0) {
  console.error(`seed-dev-week: convex run exited with status ${result.status}.`);
  process.exit(result.status ?? 1);
}

console.log(
  `seed-dev-week: done. Point a build at https://${DEV_DEPLOYMENT}.convex.cloud ` +
    `(VITE_CONVEX_URL) and the Menu + Grocery screens will render the seeded week.`,
);
