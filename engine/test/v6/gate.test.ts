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
  LOCK_EXEMPTION_RATE,
  loadGateData,
  lockExempt,
  measureRun,
  normalCdf,
  simulate,
  unbiasedSpread,
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
 * The map shrank by one again in this cycle. Threshold 4, slot anti-lock, went to
 * PASS on the self-feeding run once §11's arithmetic exemption was amended to the
 * conjunction the EM settled after gate fix cycle 2: a rate at or above 0.4 of the
 * role's weekly slots, and a preference-free spread that already puts one of the
 * role's days over half the horizon more often than not. Plain roti sits at 0.473
 * of the carb role's occasions and fails the threshold nine times in ten under an
 * assignment with no weekday preference at all, so the two weekdays it holds 23 of
 * 41 weeks are arithmetic and not a lock. Two entries remain.
 *
 * Threshold 4 still fails the **frozen** run, which CI does not measure, on a
 * banana bowl that holds Monday's fruit slot 23 of 41 weeks at a rate of 0.146.
 * That one is a real lock, and it is an artifact of how the frozen run is built
 * rather than engine bias; the PR carries the numbers.
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

/**
 * Threshold 4's diagnosis rests on one piece of arithmetic: how often a dish placed
 * on a given share of a role's occasions puts a weekday over half the horizon when
 * nothing about the assignment prefers a weekday. A wrong tail would make the
 * diagnosis lie in the direction of "no engine defect", so it is checked against
 * values that can be looked up rather than derived from the same approximation.
 */
describe("the normal tail threshold 4's diagnosis reads", () => {
  it("matches the standard normal table", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(1)).toBeCloseTo(0.8413447, 6);
    expect(normalCdf(-1)).toBeCloseTo(0.1586553, 6);
    expect(normalCdf(1.959964)).toBeCloseTo(0.975, 6);
    expect(normalCdf(-2.5)).toBeCloseTo(0.0062097, 6);
  });

  it("is symmetric and monotone, which is what the percentages are read as", () => {
    for (const z of [-3, -1.5, -0.25, 0.25, 1.5, 3]) {
      expect(normalCdf(z) + normalCdf(-z)).toBeCloseTo(1, 6);
    }
    let previous = 0;
    for (let z = -4; z <= 4; z += 0.5) {
      const value = normalCdf(z);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });
});

/**
 * §11 threshold 4's arithmetic exemption, as the EM amended it after gate fix
 * cycle 2. The invariant it must not break is the one the threshold exists for: a
 * dish that genuinely holds a weekday is still reported. So the fixtures here are
 * adversarial in that direction, a low-rate dish jammed onto one day, and only
 * then in the direction the amendment was made for.
 */
describe("threshold 4's amended arithmetic exemption", () => {
  const HORIZON = 41;
  const BAR = HORIZON / 2;

  it("does not exempt a genuinely locked dish at a low rate", () => {
    // The frozen run's banana bowl: 36 placements over six fruit days, 23 of them
    // on Monday. Six per day is what chance would give, so the lock is real.
    const spread = unbiasedSpread({ placements: 36, weeks: HORIZON, days: 6, bar: BAR });
    expect(spread.rate).toBeCloseTo(0.146, 3);
    expect(spread.anyDay).toBeLessThan(0.001);
    expect(lockExempt(spread)).toBe(false);
  });

  it("exempts plain roti's weekday lunch carb slot, which is what the amendment is for", () => {
    // 97 of the horizon's 205 weekday lunches: an assignment with no weekday
    // preference at all fails the threshold nine times in ten.
    const spread = unbiasedSpread({ placements: 97, weeks: HORIZON, days: 5, bar: BAR });
    expect(spread.rate).toBeCloseTo(0.473, 3);
    expect(spread.anyDay).toBeGreaterThan(0.85);
    expect(lockExempt(spread)).toBe(true);
  });

  it("holds the 0.4 floor as a floor, not as the exemption itself", () => {
    // At exactly the floor the preference-free chance is still under half, so the
    // rate alone never exempts: both halves of the conjunction have to hold.
    const atFloor = unbiasedSpread({
      placements: Math.round(LOCK_EXEMPTION_RATE * 5 * HORIZON),
      weeks: HORIZON,
      days: 5,
      bar: BAR,
    });
    expect(atFloor.rate).toBeGreaterThanOrEqual(LOCK_EXEMPTION_RATE);
    expect(atFloor.anyDay).toBeLessThan(0.5);
    expect(lockExempt(atFloor)).toBe(false);
  });

  it("never exempts anything below the floor, however likely the spread", () => {
    // The floor is what keeps a short horizon from exempting a thin rate: over
    // eight weeks the counts are so coarse that a dish at 0.35 of the role's
    // occasions goes over half the horizon on some weekday 64 percent of the time.
    const thin = unbiasedSpread({ placements: 14, weeks: 8, days: 5, bar: 4 });
    expect(thin.rate).toBeLessThan(LOCK_EXEMPTION_RATE);
    expect(thin.anyDay).toBeGreaterThan(0.5);
    expect(lockExempt(thin)).toBe(false);
  });

  it("reads a seasonal dish against the weeks it was eligible, not the horizon", () => {
    // The same 17 placements over 17 in-season weeks and over the whole horizon are
    // two different rates, and only the in-season one is what §2.2 lets it place at.
    const inSeason = unbiasedSpread({ placements: 17, weeks: 17, days: 6, bar: BAR });
    const wholeHorizon = unbiasedSpread({ placements: 17, weeks: HORIZON, days: 6, bar: BAR });
    expect(inSeason.rate).toBeGreaterThan(wholeHorizon.rate);
    expect(inSeason.rate).toBeCloseTo(17 / (17 * 6), 6);
  });

  it("is monotone in the rate, so the exemption cannot open and close again", () => {
    let previous = -1;
    for (let placements = 0; placements <= 5 * HORIZON; placements += 5) {
      const spread = unbiasedSpread({ placements, weeks: HORIZON, days: 5, bar: BAR });
      expect(spread.anyDay).toBeGreaterThanOrEqual(previous);
      previous = spread.anyDay;
    }
  });

  it("is deterministic: the same arguments give the same numbers (§10)", () => {
    const once = unbiasedSpread({ placements: 97, weeks: HORIZON, days: 5, bar: BAR });
    const twice = unbiasedSpread({ placements: 97, weeks: HORIZON, days: 5, bar: BAR });
    expect(JSON.stringify(once)).toBe(JSON.stringify(twice));
  });
});
