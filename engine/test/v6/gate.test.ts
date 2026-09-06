/**
 * The CI-sized §11 gate: the self-feeding run only, 60 weeks, thresholds 1, 2, 4,
 * 5 and 10, the ones that are cheap and decisive.
 *
 * The full harness (`npm run gate`) runs all three §11 runs plus the four
 * measurement variants and writes `features/engine-v6-gate-report.md`. That is
 * the artifact the phase's merge decision reads. This file exists so CI keeps
 * measuring the same numbers on every later change, in a couple of seconds
 * instead of half a minute.
 *
 * ## The engine does not pass its gate yet, and this file records exactly that
 *
 * Four of the five thresholds this test measures fail today. They are listed in
 * `KNOWN_GATE_FAILURES` with the number measured when this stream landed and the
 * reason as far as the harness can see it. This is not a suppression: the list is
 * asserted in both directions, so a threshold that starts passing fails this test
 * until its entry is deleted, and a listed threshold that collapses further fails
 * on its collapse guard. §11 makes passing the gate the condition for merging the
 * phase to `main`, and the EM owns that decision; the three entries below are the
 * findings that decision reads.
 *
 * The collapse guards are deliberately generous rather than exact ratchets: the
 * content batches (F1 to F4) change the library under this test, which moves every
 * number, and an exact ratchet would turn a content merge into a spurious CI
 * failure. They catch a collapse, not a wobble.
 */

import { beforeAll, describe, expect, it } from "vitest";
import { resolve } from "node:path";
import {
  DEFAULT_WEEKS,
  loadGateData,
  measureRun,
  simulate,
  type GateData,
  type RunReport,
} from "../../scripts/gate.js";
import { loadRecordFixture } from "./loadRecordFixture.js";
import type { RecordWeek } from "../../src/v6/types.js";

/** The five §11 thresholds CI measures on every change. */
const CI_THRESHOLDS = [1, 2, 4, 5, 10] as const;

/**
 * The §11 thresholds the engine fails as of this stream, with the number the
 * 60-week self-feeding run measured on `record-8weeks` and the collapse guard.
 *
 * Delete an entry when its threshold starts passing; this test fails until you do.
 *
 * The map shrank by one in this cycle. Threshold 1, distribution fidelity, went to
 * PASS on the self-feeding run with all eleven gated families inside the bar, once
 * §3.2's presence was metered by role on the engine side and by the same
 * classification on the record side, so that the §5.1 protein-floor append stopped
 * spending the companion slot's budget. Threshold 8, which CI does not measure,
 * went to PASS on the same change, and thresholds 2 and 3 pass on the frozen run.
 * Three entries remain.
 */
const KNOWN_GATE_FAILURES = new Map<
  number,
  { measured: number; collapseGuard: number; finding: string }
>([
  [
    2,
    {
      measured: 0.625,
      collapseGuard: 0.55,
      finding:
        "The worst rolling 8-week window is 62.5 percent distinct against a 65 percent floor: 15 repeats in 40 stars where 14 are allowed and about 12 are arithmetically forced by the record's own rates (the ceiling any rate-matching schedule can reach is 69.3 percent). The frozen run passes at 70.0 percent, so this is drift and not engine bias: one weekday-lunch ledger serves both the star position and the companion position, so a high-rate dry protein whose companion turns are metered by §3.2's presence ledger spends the rest of its deficit in the star slot.",
    },
  ],
  [
    4,
    {
      measured: 2,
      collapseGuard: 8,
      finding:
        "Roti holds Wednesday lunch in 21 of 41 weeks and Friday lunch in 23, both just over the half-horizon bar. Roti is placed about 2.4 times over five weekday lunches, so uniform spreading predicts 47 percent occupancy against a 50 percent bar, and a carb never places by its own occupation memory: §6 step 5 assigns a plate by its LEAD dish, and roti is nobody's lead. The three chutney category locks of the first run are gone, both because §11's counting amendment keys the lock per individual chutney dish and because the exploration slot now reserves its own weekday.",
    },
  ],
  [
    5,
    {
      measured: 20,
      collapseGuard: 34,
      finding:
        "A treat main repeats inside the rolling 8-Saturday window in 20 of 34 windows. The pool the window is sized against holds 12 dishes with Saturday rows, but only 9 of them ever lead a Saturday: mutton pepper fry (0.221 Saturday rate), grilled chicken breast (0.162) and fish tikka (0.147) collect their Saturday rows purely as the §5.4 special protein beside an everyday base, and the special-protein charge keeps their Saturday deficits below the lead ranking. Of the 9 that do lead, three (egg biryani 0.162, pav bhaji 0.147, khichdi 0.132) sit above one in eight, so they return inside an 8-Saturday window by arithmetic. The frozen run passes because there every leading treat's Saturday rate is 0.118 or less. Desserts are on 41 of 41 Saturdays.",
    },
  ],
]);

const repoRoot = resolve(import.meta.dirname, "../../..");

describe("§11 gate, self-feeding run", () => {
  let report: RunReport;
  let data: GateData;
  let seed: RecordWeek[];

  beforeAll(() => {
    data = loadGateData(resolve(repoRoot, "data"));
    seed = loadRecordFixture("record-8weeks", data.library);
    const simulated = simulate({ data, record: seed, weeks: DEFAULT_WEEKS });
    report = measureRun({ label: "self-feeding", data, seed, simulated });
  }, 120_000);

  it("simulates the full horizon", () => {
    expect(report.weeks).toBe(DEFAULT_WEEKS);
  });

  for (const id of CI_THRESHOLDS) {
    it(`threshold ${id}`, () => {
      const threshold = report.thresholds.find((entry) => entry.id === id);
      expect(threshold, `threshold ${id} was not measured`).toBeDefined();
      if (!threshold) return;
      const detail = [threshold.name, ...threshold.lines].join("\n  ");
      const known = KNOWN_GATE_FAILURES.get(id);

      if (!known) {
        expect(threshold.pass, detail).toBe(true);
        return;
      }

      // A listed threshold must still fail. When it starts passing, its entry is
      // stale and hiding a win, so this assertion is what forces the deletion.
      expect(
        threshold.pass,
        `threshold ${id} now passes: delete its KNOWN_GATE_FAILURES entry.\n  ${detail}`,
      ).toBe(false);

      const metric = threshold.metric;
      expect(metric, `threshold ${id} has no metric to guard`).toBeDefined();
      if (!metric) return;
      if (metric.worseWhen === "above") {
        expect(
          metric.value,
          `threshold ${id} collapsed past its guard (was ${known.measured}).\n  ${detail}`,
        ).toBeLessThanOrEqual(known.collapseGuard);
      } else {
        expect(
          metric.value,
          `threshold ${id} collapsed past its guard (was ${known.measured}).\n  ${detail}`,
        ).toBeGreaterThanOrEqual(known.collapseGuard);
      }
    });
  }

  it("keeps every generated week internally consistent", () => {
    // The whole horizon, not one week: §3.1's replay charges the picks a week's
    // generatedPlan carries, so a week whose plan disagreed with its plates would
    // desynchronise the ledger from the record on the very next generation.
    expect(report.thresholds.map((entry) => entry.id)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
    expect(report.reported.length).toBeGreaterThan(0);
  });
});
