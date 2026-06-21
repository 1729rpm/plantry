import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getGroceryDays, setGroceryDays } from "../src/lib/storage.js";
import type { ShortDay } from "../src/lib/types.js";

// storage.ts reads/writes window.localStorage through try/catch wrappers. The
// vitest config runs in node (no DOM), so we install a minimal in-memory
// localStorage on globalThis.window for these tests and tear it down after. The
// throwing-store cases below cover the private-mode path the wrappers guard.

const GROCERY_DAYS_KEY = "plantry:groceryDays";

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

function installThrowingStore() {
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: () => {
        throw new Error("private mode");
      },
      setItem: () => {
        throw new Error("private mode");
      },
      removeItem: () => {
        throw new Error("private mode");
      },
    },
  };
}

describe("grocery day-selection storage", () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    installStore(store);
  });

  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it("round-trips an explicit selection for the same weekStart", () => {
    const days: ShortDay[] = ["Thu", "Fri"];
    setGroceryDays("2026-06-15", days);
    expect(getGroceryDays("2026-06-15")).toEqual(["Thu", "Fri"]);
  });

  it("round-trips an empty selection (an explicit clear, not absence)", () => {
    setGroceryDays("2026-06-15", []);
    expect(getGroceryDays("2026-06-15")).toEqual([]);
  });

  it("returns null when nothing is stored", () => {
    expect(getGroceryDays("2026-06-15")).toBeNull();
  });

  it("ignores a stored entry for a different weekStart", () => {
    setGroceryDays("2026-06-08", ["Mon", "Tue"]);
    expect(getGroceryDays("2026-06-15")).toBeNull();
  });

  it("reuses a single key across weeks (no per-week accumulation)", () => {
    setGroceryDays("2026-06-08", ["Mon"]);
    setGroceryDays("2026-06-15", ["Wed"]);
    expect(Object.keys(store)).toEqual([GROCERY_DAYS_KEY]);
    expect(getGroceryDays("2026-06-15")).toEqual(["Wed"]);
    expect(getGroceryDays("2026-06-08")).toBeNull();
  });

  it("returns null on malformed JSON", () => {
    store[GROCERY_DAYS_KEY] = "{not json";
    expect(getGroceryDays("2026-06-15")).toBeNull();
  });

  it("returns null when the stored payload shape is wrong", () => {
    store[GROCERY_DAYS_KEY] = JSON.stringify({ weekStart: "2026-06-15", days: "Thu" });
    expect(getGroceryDays("2026-06-15")).toBeNull();
  });

  it("drops non-ShortDay entries and de-duplicates", () => {
    store[GROCERY_DAYS_KEY] = JSON.stringify({
      weekStart: "2026-06-15",
      days: ["Thu", "Sun", "Thu", 7, "Fri"],
    });
    expect(getGroceryDays("2026-06-15")).toEqual(["Thu", "Fri"]);
  });

  it("is safe when localStorage throws (private mode)", () => {
    installThrowingStore();
    expect(() => setGroceryDays("2026-06-15", ["Thu"])).not.toThrow();
    expect(getGroceryDays("2026-06-15")).toBeNull();
  });
});
