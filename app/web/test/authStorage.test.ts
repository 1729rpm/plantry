import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isAuthValid, markAuthPassed } from "../src/lib/storage.js";

// storage.ts reads/writes window.localStorage through try/catch wrappers. The
// vitest config runs in node (no DOM), so we install a minimal in-memory
// localStorage on globalThis.window for these tests and tear it down after.

const AUTH_KEY = "plantry:auth";

function installStore(store: Record<string, string>) {
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
    },
  };
}

describe("passcode gate auth storage", () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    installStore(store);
  });

  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it("is not authed when no record is stored", () => {
    expect(isAuthValid()).toBe(false);
  });

  it("is authed after the passcode passes, with the { passedAt } shape", () => {
    markAuthPassed();
    expect(isAuthValid()).toBe(true);
    const parsed = JSON.parse(store[AUTH_KEY]) as { passedAt: unknown };
    expect(Object.keys(parsed)).toEqual(["passedAt"]);
    expect(typeof parsed.passedAt).toBe("number");
  });

  it("stays authed for a record passed long ago (the remember never expires)", () => {
    const oneYearMs = 365 * 24 * 60 * 60 * 1000;
    store[AUTH_KEY] = JSON.stringify({ passedAt: Date.now() - oneYearMs });
    expect(isAuthValid()).toBe(true);
    store[AUTH_KEY] = JSON.stringify({ passedAt: 0 });
    expect(isAuthValid()).toBe(true);
  });

  it("is not authed on malformed JSON", () => {
    store[AUTH_KEY] = "{not json";
    expect(isAuthValid()).toBe(false);
  });

  it("is not authed when passedAt is missing or not a number", () => {
    store[AUTH_KEY] = JSON.stringify({});
    expect(isAuthValid()).toBe(false);
    store[AUTH_KEY] = JSON.stringify({ passedAt: "yesterday" });
    expect(isAuthValid()).toBe(false);
    store[AUTH_KEY] = "null";
    expect(isAuthValid()).toBe(false);
  });

  it("is not authed when localStorage throws (private mode)", () => {
    (globalThis as { window?: unknown }).window = {
      localStorage: {
        getItem: () => {
          throw new Error("private mode");
        },
      },
    };
    expect(isAuthValid()).toBe(false);
  });
});
