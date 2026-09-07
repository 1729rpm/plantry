import { describe, it, expect } from "vitest";
import { toLongDay } from "../src/historyRows.js";
import { ALL_DAYS } from "../src/eligibility.js";

/**
 * `toLongDay` is what survives of the v3 history-row derivation
 * (`features/engine-v6.md` §13 retires the rest). `engine/src/v6/generateWeekV6.ts`
 * builds its incident messages from it, so the mapping is total over the six
 * scheduled days and exact on each.
 */
describe("toLongDay", () => {
  it("maps every scheduled short day to its long form", () => {
    expect(toLongDay("Mon")).toBe("Monday");
    expect(toLongDay("Tue")).toBe("Tuesday");
    expect(toLongDay("Wed")).toBe("Wednesday");
    expect(toLongDay("Thu")).toBe("Thursday");
    expect(toLongDay("Fri")).toBe("Friday");
    expect(toLongDay("Sat")).toBe("Saturday");
  });

  it("is total over ALL_DAYS, so no scheduled day can yield undefined", () => {
    for (const day of ALL_DAYS) {
      expect(typeof toLongDay(day)).toBe("string");
      expect(toLongDay(day).startsWith(day)).toBe(true);
    }
  });
});
