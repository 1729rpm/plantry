#!/usr/bin/env node
// Seed the DEV Convex deployment with a household record (`features/engine-v6.md`
// §2.1) so anything that reads the record can be exercised off prod.
//
// WHY THIS EXISTS
// ---------------
// The v6 engine's primary signal is the record: every `currentWeek` row before the
// week being generated, as-eaten. The dev deployment (lovely-curlew-631) is empty,
// so `lib/record.ts` and (in stream E2) v6 generation read an empty record there and
// nothing about them can be verified. Its sibling `seed-dev-week.mjs` seeds ONE
// generated week by running the real generation; this seeds MANY past weeks from a
// JSON file, because a record is a history and generation only makes the present.
//
// WHAT IT DOES
// ------------
// Reads a record JSON (an array of RecordWeek-shaped objects) and calls the
// internal mutation `recordSeed:seedRecordWeeks` against DEV, in batches, so a long
// record does not go through as one oversized argument. The mutation upserts on
// `weekStart`, so re-running is idempotent.
//
// Each element of the array is:
//   {
//     "weekStart": "2026-06-15",                                  // ISO Monday
//     "picks":       [ { "day": "Mon", "meal": "lunch", "dishId": 63 }, ... ],
//     "skippedDays": [ "Wed" ],                                   // short day names
//     "generatedPlan": null | [ { "day", "meal", "dishId" }, ... ],
//     "customPicks": [ { "day", "meal", "customLabel" }, ... ]    // optional, dev only
//   }
//
// `customPicks` has no counterpart in a real RecordWeek (the loader has already
// dropped null-dishId picks by the time it returns one). It exists so the dev smoke
// can see the loader drop a custom pick, and so `promoteCustomPick` has something to
// re-point.
//
// PREREQUISITES
// -------------
//   1. `npm install && npm run bake` at the repo root.
//   2. A logged-in Convex session (~/.convex) or CONVEX_DEPLOY_KEY for dev.
//
// USAGE
// -----
//   node scripts/seed-dev-record.mjs                                 # the bundled sample
//   node scripts/seed-dev-record.mjs path/to/record.json             # a real export
//   node scripts/seed-dev-record.mjs path/to/record.json --batch 4   # smaller batches
//
// The `--push` flag is passed to `convex run` so dev has the current functions
// before the mutation runs. This NEVER targets prod: the deployment name is
// hard-pinned to the dev deployment below and is never read from a flag, an
// argument, or the environment.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Hard-pinned DEV deployment. This script must never reach prod
// (disciplined-chameleon-263); seeding is a dev-only operation.
const DEV_DEPLOYMENT = "lovely-curlew-631";
const PROD_DEPLOYMENT = "disciplined-chameleon-263";

const __dirname = dirname(fileURLToPath(import.meta.url));
const convexDir = resolve(__dirname, "..", "app", "convex");
const DEFAULT_RECORD = resolve(__dirname, "fixtures", "record-sample.json");
const DEFAULT_BATCH = 8;

// Refuse outright if anything in the environment is aimed at prod. The deployment
// is pinned below and passed explicitly, so this is belt and braces: a stray
// CONVEX_DEPLOYMENT in the shell should stop the run, not be silently overridden.
for (const name of ["CONVEX_DEPLOYMENT", "CONVEX_DEPLOY_KEY", "CONVEX_URL"]) {
  const value = process.env[name];
  if (value && value.includes(PROD_DEPLOYMENT)) {
    console.error(`seed-dev-record: ${name} names the prod deployment. Refusing to run.`);
    process.exit(1);
  }
}

const args = process.argv.slice(2);
let recordPath = DEFAULT_RECORD;
let batchSize = DEFAULT_BATCH;
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === "--batch") {
    batchSize = Number.parseInt(args[i + 1] ?? "", 10);
    i += 1;
    if (!Number.isInteger(batchSize) || batchSize < 1) {
      console.error("seed-dev-record: --batch takes a positive integer.");
      process.exit(1);
    }
  } else {
    recordPath = resolve(process.cwd(), args[i]);
  }
}

let weeks;
try {
  weeks = JSON.parse(readFileSync(recordPath, "utf8"));
} catch (error) {
  console.error(`seed-dev-record: could not read ${recordPath}: ${error.message}`);
  process.exit(1);
}

if (!Array.isArray(weeks) || weeks.length === 0) {
  console.error(`seed-dev-record: ${recordPath} must hold a non-empty array of record weeks.`);
  process.exit(1);
}
for (const week of weeks) {
  if (!week || !/^\d{4}-\d{2}-\d{2}$/.test(week.weekStart ?? "")) {
    console.error(
      `seed-dev-record: every week needs an ISO weekStart (YYYY-MM-DD); got ` +
        `${JSON.stringify(week?.weekStart)}.`,
    );
    process.exit(1);
  }
  if (!Array.isArray(week.picks) || !Array.isArray(week.skippedDays)) {
    console.error(`seed-dev-record: week ${week.weekStart} needs picks[] and skippedDays[].`);
    process.exit(1);
  }
}

console.log(
  `seed-dev-record: seeding ${weeks.length} record week(s) from ${recordPath} ` +
    `on DEV (${DEV_DEPLOYMENT}), ${batchSize} per call...`,
);

let seeded = 0;
for (let start = 0; start < weeks.length; start += batchSize) {
  const batch = weeks.slice(start, start + batchSize);
  const result = spawnSync(
    "npx",
    [
      "convex",
      "run",
      "--deployment",
      DEV_DEPLOYMENT,
      "--push",
      "recordSeed:seedRecordWeeks",
      JSON.stringify({ weeks: batch }),
    ],
    { cwd: convexDir, stdio: "inherit" },
  );
  if (result.status !== 0) {
    console.error(`seed-dev-record: convex run exited with status ${result.status}.`);
    process.exit(result.status ?? 1);
  }
  seeded += batch.length;
  console.log(`seed-dev-record: ${seeded}/${weeks.length} week(s) seeded.`);
}

console.log(
  `seed-dev-record: done. Read it back with ` +
    `\`npx convex run --deployment ${DEV_DEPLOYMENT} recordExport:exportRecord '{}'\`.`,
);
