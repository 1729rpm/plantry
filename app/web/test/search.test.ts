import { describe, expect, it } from "vitest";
import { matchesQuery } from "../src/lib/search.js";

const DISH = "Thai green curry chicken";

describe("matchesQuery", () => {
  it("matches when the query tokens are non-contiguous in the name (the reported bug)", () => {
    // "thai curry" failed under the old contiguous-substring match because the
    // word "green" sits between the two query words. Token AND matching fixes it.
    expect(matchesQuery(DISH, "thai curry")).toBe(true);
  });

  it("still matches the exact contiguous phrase", () => {
    expect(matchesQuery(DISH, "thai green curry")).toBe(true);
  });

  it("is word-order independent", () => {
    expect(matchesQuery(DISH, "curry thai")).toBe(true);
  });

  it("does not match when any token is absent from the name", () => {
    expect(matchesQuery(DISH, "thai paneer")).toBe(false);
  });

  it("treats an empty query as matching everything", () => {
    expect(matchesQuery(DISH, "")).toBe(true);
  });

  it("treats a whitespace-only query as matching everything", () => {
    expect(matchesQuery(DISH, "   ")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(matchesQuery(DISH, "THAI CURRY")).toBe(true);
    expect(matchesQuery("PANEER BUTTER MASALA", "paneer masala")).toBe(true);
  });

  it("collapses extra internal whitespace between tokens", () => {
    expect(matchesQuery(DISH, "thai    curry")).toBe(true);
    expect(matchesQuery(DISH, "  thai   curry  ")).toBe(true);
  });

  it("matches a single token as a plain substring", () => {
    expect(matchesQuery(DISH, "curry")).toBe(true);
    expect(matchesQuery(DISH, "biryani")).toBe(false);
  });
});
