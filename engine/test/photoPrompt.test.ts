import { describe, it, expect } from "vitest";

// The photo generator is a root-level ESM script (scripts/generate-dish-photos.mjs).
// Its pure prompt-building helpers are exported for assertion; importing the module
// does not fire the CLI (it guards main() on the script-entrypoint check). buildPrompt
// uses the per-dish detail line from details.md when the slug is known, else the
// description argument; we pass slugs that are not in details.md so the description
// argument is the effective detail line under test.
// @ts-expect-error -- plain .mjs script, no type declarations
import { buildPrompt, detailOptsOutOfGarnish } from "../../scripts/generate-dish-photos.mjs";

describe("photo prompt garnish clause", () => {
  it("omits the coriander clause when the detail line opts out of garnish", () => {
    // A bare dish (e.g. plain bread): the detail line says "no garnish". FLUX renders
    // the named "coriander" token even under a negation, so the clause must be omitted
    // entirely, not merely negated.
    const prompt = buildPrompt(
      "test-bare-bread",
      "Test Bread",
      "Indian",
      "golden pull-apart rolls with smooth buttered tops, no garnish, plain plate",
    );
    expect(prompt.toLowerCase()).not.toContain("coriander");
    expect(prompt.toLowerCase()).not.toContain("cilantro");
    // The bare surface is stated positively (FLUX honours named nouns, not negations).
    expect(prompt).toContain("no garnish, no herbs, and no green leaves");
  });

  it("keeps the coriander clause verbatim for a normal (savoury) detail line", () => {
    const prompt = buildPrompt(
      "test-gravy",
      "Test Gravy",
      "Indian",
      "thick opaque gravy with pieces half-submerged, scattered fresh herbs on top",
    );
    expect(prompt.toLowerCase()).toContain("coriander");
    expect(prompt.toLowerCase()).toContain("cilantro");
    // Savoury dishes are unaffected: the standing cue survives (the "flat-leaf" token
    // is rewritten to "flat leaf" by the filter-safe sanitizer, but coriander stays).
    expect(prompt).toContain("any garnish is fresh green coriander (cilantro) leaves");
  });

  it("detects the opt-out phrase case-insensitively", () => {
    expect(detailOptsOutOfGarnish("plain rolls, NO GARNISH")).toBe(true);
    expect(detailOptsOutOfGarnish("plain rolls, no garnish at all")).toBe(true);
    expect(detailOptsOutOfGarnish("thick gravy, scattered coriander")).toBe(false);
  });
});
