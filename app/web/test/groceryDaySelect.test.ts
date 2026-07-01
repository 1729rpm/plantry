import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildChips,
  chipTag,
  defaultSelection,
  filterSeed,
  isDisabled,
  rangeLabel,
  selectableDays,
  type ChipStatus,
  type DayChip,
} from "../src/components/GroceryScreen.js";
import type { CurrentWeek, ShortDay, WeekSlot } from "../src/lib/types.js";

// The Grocery screen's day-selection logic is pulled into the pure functions
// exercised here so the time-aware default, the disabled rule, and the range
// formatting can be tested without a React tree. Most tests build chips by hand;
// the buildChips tests pin the device clock with fake timers so status
// resolution is deterministic across CI machines and timezones. The week
// starting Mon 2026-06-15 runs Mon..Sat = Jun 15..20.

function chip(day: ShortDay, dateNum: number, status: ChipStatus, skipped = false): DayChip {
  return { day, dateNum, status, skipped };
}

describe("chipTag", () => {
  it("labels today, tomorrow, and other days", () => {
    expect(chipTag(chip("Thu", 18, "today"))).toBe("Today");
    expect(chipTag(chip("Fri", 19, "tomorrow"))).toBe("Tom");
    expect(chipTag(chip("Sat", 20, "upcoming"))).toBe("Sat");
    expect(chipTag(chip("Mon", 15, "past"))).toBe("Mon");
  });
});

describe("isDisabled / selectableDays", () => {
  it("disables past and skipped days only", () => {
    expect(isDisabled(chip("Mon", 15, "past"))).toBe(true);
    expect(isDisabled(chip("Thu", 18, "today", true))).toBe(true); // skipped today
    expect(isDisabled(chip("Thu", 18, "today"))).toBe(false);
    expect(isDisabled(chip("Fri", 19, "upcoming"))).toBe(false);
  });

  it("selectable excludes past and skipped, keeps today and later", () => {
    const chips = [
      chip("Mon", 15, "past"),
      chip("Tue", 16, "past"),
      chip("Wed", 17, "today"),
      chip("Thu", 18, "tomorrow", true), // skipped
      chip("Fri", 19, "upcoming"),
      chip("Sat", 20, "upcoming"),
    ];
    expect(selectableDays(chips).map((c) => c.day)).toEqual(["Wed", "Fri", "Sat"]);
  });
});

describe("defaultSelection", () => {
  // A full week where today is Thu 18: Mon..Wed past, Thu today, Fri/Sat ahead.
  const midWeek = [
    chip("Mon", 15, "past"),
    chip("Tue", 16, "past"),
    chip("Wed", 17, "past"),
    chip("Thu", 18, "today"),
    chip("Fri", 19, "tomorrow"),
    chip("Sat", 20, "upcoming"),
  ];

  it("before 11 AM picks today + tomorrow", () => {
    expect(defaultSelection(midWeek, 9)).toEqual(["Thu", "Fri"]);
  });

  it("from 11 AM on rolls forward: tomorrow + day after", () => {
    expect(defaultSelection(midWeek, 11)).toEqual(["Fri", "Sat"]);
    expect(defaultSelection(midWeek, 14)).toEqual(["Fri", "Sat"]);
  });

  it("near week end before 11 yields the one or two remaining days", () => {
    // Today is Sat 20, last day: before 11 only Sat is selectable.
    const lastDay = [chip("Mon", 15, "past"), chip("Fri", 19, "past"), chip("Sat", 20, "today")];
    expect(defaultSelection(lastDay, 9)).toEqual(["Sat"]);
    // From 11, today is excluded -> nothing left.
    expect(defaultSelection(lastDay, 14)).toEqual([]);
  });

  it("skips skipped days when building the default window", () => {
    const skippedTomorrow = [
      chip("Thu", 18, "today"),
      chip("Fri", 19, "tomorrow", true), // skipped
      chip("Sat", 20, "upcoming"),
    ];
    // Before 11: today + next selectable (Sat, since Fri is skipped).
    expect(defaultSelection(skippedTomorrow, 9)).toEqual(["Thu", "Sat"]);
    // From 11: exclude today, next selectable only -> Sat.
    expect(defaultSelection(skippedTomorrow, 14)).toEqual(["Sat"]);
  });
});

describe("rangeLabel", () => {
  it("formats one day, a span, and none", () => {
    expect(rangeLabel([])).toBe("");
    expect(rangeLabel([chip("Thu", 18, "today")])).toBe("Thu 18");
    expect(rangeLabel([chip("Thu", 18, "today"), chip("Fri", 19, "tomorrow")])).toBe(
      "Thu 18 to Fri 19",
    );
  });
});

describe("filterSeed", () => {
  // Today is Thu 18: Mon..Wed past, Thu today, Fri tomorrow, Sat upcoming, with
  // Fri skipped so it is disabled despite being in the future.
  const chips = [
    chip("Mon", 15, "past"),
    chip("Tue", 16, "past"),
    chip("Wed", 17, "past"),
    chip("Thu", 18, "today"),
    chip("Fri", 19, "tomorrow", true), // skipped -> disabled
    chip("Sat", 20, "upcoming"),
  ];

  it("keeps only days that still have a selectable chip", () => {
    expect(filterSeed(["Thu", "Sat"], chips)).toEqual(["Thu", "Sat"]);
  });

  it("drops a stored day that has since become past", () => {
    expect(filterSeed(["Wed", "Thu"], chips)).toEqual(["Thu"]);
  });

  it("drops a stored day that has since become skipped", () => {
    expect(filterSeed(["Fri", "Sat"], chips)).toEqual(["Sat"]);
  });

  it("preserves stored order and yields empty when nothing remains selectable", () => {
    expect(filterSeed(["Sat", "Thu"], chips)).toEqual(["Sat", "Thu"]);
    expect(filterSeed(["Mon", "Fri"], chips)).toEqual([]);
  });
});

describe("buildChips", () => {
  const weekStart = "2026-06-15"; // Mon..Sat = Jun 15..20

  afterEach(() => {
    vi.useRealTimers();
  });

  function pinLocalDate(year: number, monthIndex: number, day: number, hour = 12) {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(year, monthIndex, day, hour, 0, 0));
  }

  function fullWeek(skippedDay?: ShortDay): CurrentWeek {
    const days: ShortDay[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const slots: WeekSlot[] = days.map((day) => ({
      day,
      meal: "lunch",
      dishes: [],
    }));
    return {
      weekStart,
      status: "final",
      slots,
      version: 1,
      ...(skippedDay
        ? { skippedDays: [{ day: skippedDay, reason: "out", author: "rajat", skippedAt: 0 }] }
        : {}),
    };
  }

  it("classifies past / today / tomorrow / upcoming against the device date", () => {
    pinLocalDate(2026, 5, 18); // Thu Jun 18
    const chips = buildChips(fullWeek(), new Date());
    const byDay = Object.fromEntries(chips.map((c) => [c.day, c.status]));
    expect(byDay).toEqual({
      Mon: "past",
      Tue: "past",
      Wed: "past",
      Thu: "today",
      Fri: "tomorrow",
      Sat: "upcoming",
    });
  });

  it("carries the skipped flag and the date number", () => {
    pinLocalDate(2026, 5, 18);
    const chips = buildChips(fullWeek("Fri"), new Date());
    const fri = chips.find((c) => c.day === "Fri")!;
    expect(fri.dateNum).toBe(19);
    expect(fri.skipped).toBe(true);
  });

  it("only emits chips for days present in the week's slots", () => {
    pinLocalDate(2026, 5, 18);
    const week = fullWeek();
    week.slots = week.slots.filter((s) => s.day !== "Sat");
    const chips = buildChips(week, new Date());
    expect(chips.map((c) => c.day)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri"]);
  });
});
