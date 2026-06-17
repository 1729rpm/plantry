import { afterEach, describe, expect, it, vi } from "vitest";
import { dayStatus } from "../src/lib/days.js";

// dayStatus compares a day's resolved local calendar date against the device's
// current local date. We pin the device clock with fake timers so the
// classification is deterministic across CI machines and timezones. The week
// starting Mon 2026-06-15 runs Mon..Sat = Jun 15..20.
describe("dayStatus", () => {
  const weekStart = "2026-06-15";

  afterEach(() => {
    vi.useRealTimers();
  });

  function pinLocalDate(year: number, monthIndex: number, day: number) {
    vi.useFakeTimers();
    // Local midday on the pinned date, so the time-of-day never bleeds across a
    // calendar boundary regardless of the runner's timezone.
    vi.setSystemTime(new Date(year, monthIndex, day, 12, 0, 0));
  }

  it("marks days before the device date as past", () => {
    pinLocalDate(2026, 5, 17); // Wed Jun 17
    expect(dayStatus(weekStart, "Mon")).toBe("past");
    expect(dayStatus(weekStart, "Tue")).toBe("past");
  });

  it("marks the device's own date as today", () => {
    pinLocalDate(2026, 5, 17); // Wed Jun 17
    expect(dayStatus(weekStart, "Wed")).toBe("today");
  });

  it("marks days after the device date as upcoming", () => {
    pinLocalDate(2026, 5, 17); // Wed Jun 17
    expect(dayStatus(weekStart, "Thu")).toBe("upcoming");
    expect(dayStatus(weekStart, "Fri")).toBe("upcoming");
    expect(dayStatus(weekStart, "Sat")).toBe("upcoming");
  });

  it("treats the first day of the week as today on Monday", () => {
    pinLocalDate(2026, 5, 15); // Mon Jun 15
    expect(dayStatus(weekStart, "Mon")).toBe("today");
    expect(dayStatus(weekStart, "Tue")).toBe("upcoming");
  });

  it("collapses the whole week once the device date is past Saturday", () => {
    pinLocalDate(2026, 5, 22); // Mon of the following week
    for (const day of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const) {
      expect(dayStatus(weekStart, day)).toBe("past");
    }
  });

  it("keeps the whole week upcoming when the device date is before it", () => {
    pinLocalDate(2026, 5, 10); // earlier week
    for (const day of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const) {
      expect(dayStatus(weekStart, day)).toBe("upcoming");
    }
  });
});
