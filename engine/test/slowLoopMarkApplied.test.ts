import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

/**
 * `scripts/slow-loop-mark-applied.mjs` is the post-merge action that closes the
 * slow-loop consume cycle (MAINTENANCE.md §3). It is plain node, not part of the
 * engine, but the engine's vitest run is the only test job CI runs over repo
 * scripts, so its parser lives under test here.
 *
 * The script is exercised through its `--dry-run` path, which parses the PR body
 * in `PR_BODY`, prints one JSON line with the collected ids, and exits before any
 * `npx convex run` call. That keeps the test hermetic (no Convex, no network) while
 * covering the two things a merge depends on: the parse, and the fact that the
 * dry run never reaches Convex.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(__dirname, "..", "..", "scripts", "slow-loop-mark-applied.mjs");

interface DryRunOutput {
  appliedManualChangeIds: string[];
  reviewedNoChangeManualChangeIds: string[];
  incidentIds: string[];
  dislikeIds: string[];
  prUrl: string;
}

interface RunResult {
  status: number | null;
  stdout: string;
  parsed: DryRunOutput | null;
}

function runDry(prBody: string, prUrl = "https://example.test/pr/1"): RunResult {
  const res = spawnSync("node", [SCRIPT, "--dry-run"], {
    encoding: "utf8",
    env: { ...process.env, PR_BODY: prBody, PR_URL: prUrl, CONVEX_DEPLOY_KEY: "" },
  });
  const stdout = res.stdout ?? "";
  // The dry-run path prints exactly one JSON object, on its own line, last.
  const jsonLine = stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("{"))
    .pop();
  return {
    status: res.status,
    stdout,
    parsed: jsonLine ? (JSON.parse(jsonLine) as DryRunOutput) : null,
  };
}

function clusterBody(...blocks: string[]): string {
  return [
    "## Consumed signals by cluster",
    "",
    ...blocks.map((b) => `\`\`\`cluster\n${b}\n\`\`\`\n`),
  ].join("\n");
}

describe("slow-loop-mark-applied: cluster parsing", () => {
  it("collects dislike ids from every cluster, whatever the outcome", () => {
    const { status, parsed } = runDry(
      clusterBody(
        "outcome: applied\nmanual_change_ids: mc1\nincident_ids: -\ndislike_ids: d1, d2",
        "outcome: reviewed_no_change\nmanual_change_ids: mc2\nincident_ids: i1\ndislike_ids: d3",
      ),
    );
    expect(status).toBe(0);
    expect(parsed).not.toBeNull();
    expect(parsed?.appliedManualChangeIds).toEqual(["mc1"]);
    expect(parsed?.reviewedNoChangeManualChangeIds).toEqual(["mc2"]);
    expect(parsed?.incidentIds).toEqual(["i1"]);
    // Outcome-independent: a consumed dislike resolves regardless of the
    // cluster's manual-change outcome (MAINTENANCE.md §3.1).
    expect(parsed?.dislikeIds).toEqual(["d1", "d2", "d3"]);
  });

  it("dedupes dislike ids listed in more than one cluster", () => {
    const { parsed } = runDry(
      clusterBody(
        "outcome: applied\nmanual_change_ids: -\nincident_ids: -\ndislike_ids: d1, d2",
        "outcome: applied\nmanual_change_ids: -\nincident_ids: -\ndislike_ids: d2, d1",
      ),
    );
    expect(parsed?.dislikeIds).toEqual(["d1", "d2"]);
  });

  it("reads a cluster with no dislike_ids key, and a `-` value, as no dislikes", () => {
    const { status, parsed } = runDry(
      clusterBody(
        "outcome: applied\nmanual_change_ids: mc1\nincident_ids: -",
        "outcome: applied\nmanual_change_ids: mc2\nincident_ids: -\ndislike_ids: -",
      ),
    );
    expect(status).toBe(0);
    expect(parsed?.dislikeIds).toEqual([]);
    expect(parsed?.appliedManualChangeIds).toEqual(["mc1", "mc2"]);
  });

  it("keeps the dislike ids of a cluster whose outcome is unrecognized", () => {
    const { parsed } = runDry(
      clusterBody("outcome: something_else\nmanual_change_ids: mc1\ndislike_ids: d9"),
    );
    // The unknown outcome drops only the manual-change ids.
    expect(parsed?.appliedManualChangeIds).toEqual([]);
    expect(parsed?.reviewedNoChangeManualChangeIds).toEqual([]);
    expect(parsed?.dislikeIds).toEqual(["d9"]);
  });
});

describe("slow-loop-mark-applied: flat fallback", () => {
  it("reads the flat Consumed dislike IDs line when no cluster block is present", () => {
    const { status, parsed } = runDry(
      [
        "Consumed manual-change IDs: mc1, mc2",
        "Consumed incident IDs: i1",
        "Consumed dislike IDs: d1, d2",
      ].join("\n"),
    );
    expect(status).toBe(0);
    expect(parsed?.appliedManualChangeIds).toEqual(["mc1", "mc2"]);
    expect(parsed?.incidentIds).toEqual(["i1"]);
    expect(parsed?.dislikeIds).toEqual(["d1", "d2"]);
  });

  it("falls back on dislikes alone, so a dislike-only PR body still parses", () => {
    const { status, parsed } = runDry("Consumed dislike IDs: d1");
    expect(status).toBe(0);
    expect(parsed?.dislikeIds).toEqual(["d1"]);
    expect(parsed?.appliedManualChangeIds).toEqual([]);
  });

  it("reads an older body with no dislike line as no dislikes", () => {
    const { parsed } = runDry("Consumed manual-change IDs: mc1\nConsumed incident IDs: -");
    expect(parsed?.dislikeIds).toEqual([]);
  });
});

describe("slow-loop-mark-applied: dry run never calls Convex", () => {
  it("names the dislike ids it would mark, and stops before the mutation", () => {
    const { status, stdout } = runDry(
      clusterBody("outcome: applied\nmanual_change_ids: -\nincident_ids: -\ndislike_ids: d1"),
    );
    expect(status).toBe(0);
    expect(stdout).toContain("[slow-loop-mark-applied] dislike ids to mark applied: d1");
    expect(stdout).toContain("[slow-loop-mark-applied] dry-run; not calling Convex.");
    expect(stdout).not.toContain("convex run");
  });

  it("carries the PR url through to the payload the mutation would receive", () => {
    const { parsed } = runDry(
      clusterBody("outcome: applied\nmanual_change_ids: -\nincident_ids: -\ndislike_ids: d1"),
      "https://example.test/pr/42",
    );
    expect(parsed?.prUrl).toBe("https://example.test/pr/42");
  });

  it("exits clean on an empty body and on a body with nothing to consume", () => {
    expect(runDry("").status).toBe(0);
    const nothing = runDry("A PR body with prose and no ids at all.");
    expect(nothing.status).toBe(0);
    expect(nothing.stdout).toContain("no cluster blocks and no flat ID lines");
  });
});
