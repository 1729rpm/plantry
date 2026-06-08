import { describe, it, expect } from "vitest";
import { VERSION } from "../src/index.js";

describe("engine smoke", () => {
  it("exports a version constant", () => {
    expect(VERSION).toBe("0.0.0");
  });
});
