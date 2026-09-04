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
 * Three of the five thresholds this test measures fail today. They are listed in
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
 */
const KNOWN_GATE_FAILURES = new Map<
  number,
  { measured: number; collapseGuard: number; finding: string }
>([
  [
    1,
    {
      measured: 1,
      collapseGuard: 4,
      finding:
        "mutton runs at +86 percent (0.047 served against 0.025 in the record). Mutton has two record rows, one of them a Saturday special protein, so its rate is measured on a base too thin for a 25 percent bar; §11 threshold 12 already flags the two-row families as provisional.",
    },
  ],
  [
    4,
    {
      measured: 3,
      collapseGuard: 8,
      finding:
        "Roti holds Friday lunch in 21 of 41 weeks and a breakfast chutney holds Monday in 22 and Friday in 21. Both sit just over the bar because both run at close to half the week's slots already: Roti is placed about 2.4 times over 5 weekday lunches and chutney mornings about 2.4 times over 5 breakfasts, so uniform spreading predicts 47 percent occupancy against a 50 percent bar. Threshold 4's arithmetic exemption is written at exactly that crossing point, which is a spec question (§11's order of work), not obviously an engine one.",
    },
  ],
  [
    5,
    {
      measured: 20,
      collapseGuard: 34,
      finding:
        "A treat main repeats inside the rolling 8-Saturday window in 20 of 34 windows, with a 12-dish treat pool. §5.4 assumed a pool of eleven or twelve clears rolling-8 distinctness by size alone, but selection is deficit-driven rather than round robin, so any treat whose Saturday rate is above one in eight returns inside the window by construction. Desserts are on 41 of 41 Saturdays.",
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
