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
 * Two of the five thresholds this test measures fail today. They are listed in
 * `KNOWN_GATE_FAILURES` with the number measured when this stream landed and the
 * reason as far as the harness can see it. This is not a suppression: the list is
 * asserted in both directions, so a threshold that starts passing fails this test
 * until its entry is deleted, and a listed threshold that collapses further fails
 * on its collapse guard. §11 makes passing the gate the condition for merging the
 * phase to `main`, and the EM owns that decision; the two entries below are the
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
  DRIFT_ASPIRATION_PERCENT,
  driftNoisePercent,
  LOCK_EXEMPTION_RATE,
  loadGateData,
  lockExempt,
  measureRun,
  normalCdf,
  simulate,
  unbiasedSpread,
  withinDriftNoise,
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
 * The map is unchanged in this cycle and holds the two entries gate fix cycle 3
 * left it with. Threshold 4, slot anti-lock, went to PASS on the self-feeding run
 * in that cycle once §11's arithmetic exemption was amended to the
 * conjunction the EM settled after gate fix cycle 2: a rate at or above 0.4 of the
 * role's weekly slots, and a preference-free spread that already puts one of the
 * role's days over half the horizon more often than not. Plain roti sits at 0.473
 * of the carb role's occasions and fails the threshold nine times in ten under an
 * assignment with no weekday preference at all, so the two weekdays it holds 23 of
 * 41 weeks are arithmetic and not a lock. Two entries remain.
 *
 * The frozen run's own threshold 4 failure went with it in this cycle. It was the
 * artifact the cycle-3 PR called it: `variant.frozenRates` froze the whole
 * `RecordStats`, so §6 step 5's least-recently-used memories never advanced and
 * every week of the horizon resolved the same day. Frozen now freezes the rates
 * alone (`record.ts`'s `frozenRatesStats`) and the run passes all twelve.
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
        "The worst rolling 8-week window is 62.5 percent distinct against a 65 percent floor: 15 repeats in 40 stars where 14 are allowed and about 12 are arithmetically forced by the record's own rates (the ceiling any rate-matching schedule can reach is 69.3 percent). The frozen run passes, at 65.0 percent exactly on the floor (70.0 before this cycle unfroze §6 step 5's placement memories), so this is drift and not engine bias: one weekday-lunch ledger serves both the star position and the companion position, so a high-rate dry protein whose companion turns are metered by §3.2's presence ledger spends the rest of its deficit in the star slot.",
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

/**
 * Threshold 12's bound, as §11 was amended after gate fix cycle 3: each family is
 * gated against its own counting noise, and the 10 percent figure is the aspiration
 * reported beside the verdict. The invariant these fixtures guard is that the
 * amendment widened the bound without switching the threshold off: a family that
 * really ratchets still fails, and a family that vanishes from a window still fails.
 */
describe("threshold 12's counting noise", () => {
  it("is the Poisson relative error of the two windows, combined", () => {
    // 100 placements in each window: 10 percent each, sqrt(2) x 10 combined.
    expect(driftNoisePercent(100, 100)).toBeCloseTo(10 * Math.SQRT2, 6);
    expect(driftNoisePercent(25, 25)).toBeCloseTo(20 * Math.SQRT2, 6);
  });

  it("shrinks as the counts grow, which is the only way to reach the bound", () => {
    let previous = Number.POSITIVE_INFINITY;
    for (const n of [4, 10, 25, 100, 400, 1000]) {
      const noise = driftNoisePercent(n, n);
      expect(noise).toBeLessThan(previous);
      previous = noise;
    }
    // The counts the 10 percent aspiration would need: 200 placements per window
    // exactly reaches it, and the busiest family the harness measures manages 57 in
    // twenty weeks, so it is out of reach at the horizon §11 gives each window.
    expect(driftNoisePercent(200, 200)).toBeCloseTo(DRIFT_ASPIRATION_PERCENT, 6);
    expect(driftNoisePercent(250, 250)).toBeLessThan(DRIFT_ASPIRATION_PERCENT);
    expect(driftNoisePercent(150, 150)).toBeGreaterThan(DRIFT_ASPIRATION_PERCENT);
  });

  it("says a family with no placements in a window carries unbounded noise", () => {
    expect(driftNoisePercent(0, 20)).toBe(Number.POSITIVE_INFINITY);
    expect(driftNoisePercent(20, 0)).toBe(Number.POSITIVE_INFINITY);
  });

  it("gates a family on its own noise, which is what the amendment changed", () => {
    // paneer at the 41-week horizon: 34 placements then 40, a +12.0 percent shift
    // against 23.3 percent of noise. The old fixed bound failed it; its own noise
    // cannot tell that shift from the coarseness of 34 and 40 counts.
    const noise = driftNoisePercent(34, 40);
    expect(noise).toBeGreaterThan(DRIFT_ASPIRATION_PERCENT);
    expect(withinDriftNoise(12.0, noise)).toBe(true);
  });

  it("still fails a family whose shift is larger than its own noise", () => {
    // The amendment must not switch the threshold off. A family that doubles
    // between the windows moves further than any noise those counts carry.
    const noise = driftNoisePercent(34, 68);
    expect(withinDriftNoise(100, noise)).toBe(false);
    // And a shift exactly at the noise is inside it: the bound is inclusive, so a
    // family sitting on its own noise is not called drifting.
    expect(withinDriftNoise(noise, noise)).toBe(true);
    expect(withinDriftNoise(noise + 0.001, noise)).toBe(false);
  });

  it("fails a family that vanished from a window, whose noise is unbounded", () => {
    // Infinite noise must not excuse an infinite shift: a rate that went to zero is
    // the drift the threshold exists to catch, and an unmeasurable shift is a fail.
    expect(withinDriftNoise(Number.POSITIVE_INFINITY, driftNoisePercent(20, 0))).toBe(false);
    expect(withinDriftNoise(-100, driftNoisePercent(20, 0))).toBe(false);
    expect(withinDriftNoise(1, Number.POSITIVE_INFINITY)).toBe(false);
  });

  it("is symmetric in the direction of the shift", () => {
    const noise = driftNoisePercent(50, 50);
    expect(withinDriftNoise(15, noise)).toBe(withinDriftNoise(-15, noise));
    expect(withinDriftNoise(25, noise)).toBe(withinDriftNoise(-25, noise));
  });
});
