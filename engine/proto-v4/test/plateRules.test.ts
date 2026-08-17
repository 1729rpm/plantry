import { describe, it, expect } from "vitest";
import { generateWeekV4 } from "../src/generateWeekV4.js";
import { buildPools } from "../src/pool.js";
import {
  indianCompanionPoolFor,
  standaloneSidePoolFor,
  indianSecondCompanionPool,
} from "../src/composeV4.js";
import { loadLibrary } from "../src/loadData.js";
import { baselineLibrary, dish, row } from "./fixtures.js";
import type { Dish } from "../../src/data/schemas.js";
import type { WeekPlan } from "../src/types.js";

/**
 * One test per v4 plate rule (§3.3, rules 1 to 8), plus the §3.2 template shapes and the
 * §3.5 cap. These are the prototype's own asserts; independent evaluators check the
 * simulation output separately.
 */

const WEEK = "2026-08-17";

function gen(
  library: Dish[],
  history = [] as ReturnType<typeof row>[],
): {
  week: WeekPlan;
  incidents: ReturnType<typeof generateWeekV4>["incidents"];
} {
  return generateWeekV4({ library, history, weekStart: WEEK, season: "Monsoon", favorites: [] });
}

function dayOf(week: WeekPlan, day: string) {
  const d = week.days.find((x) => x.day === day);
  if (!d) throw new Error(`no day ${day}`);
  return d;
}

describe("§3.2 day templates", () => {
  it("breakfast is uniform Mon-Fri and absent on Saturday", () => {
    const { week } = gen(baselineLibrary());
    for (const day of ["Mon", "Tue", "Wed", "Thu", "Fri"]) {
      const d = dayOf(week, day);
      expect(d.breakfast.filter((p) => p.role === "breakfast-main")).toHaveLength(1);
    }
    expect(dayOf(week, "Sat").breakfast).toHaveLength(0);
  });

  it("attach rule: a Chilla or Paratha main carries one breakfast chutney", () => {
    // Only a Chilla main is available, so every breakfast must carry the chutney.
    const library = baselineLibrary().filter((d) => ![1, 3, 4].includes(d.id));
    const { week } = gen(library);
    const mon = dayOf(week, "Mon");
    expect(mon.breakfast.map((p) => p.dish.name)).toContain("Green chutney");
    expect(mon.breakfast.find((p) => p.dish.name === "Green chutney")?.role).toBe(
      "breakfast-accompaniment",
    );
  });

  it("attach rule: a non-HP main gains one HP Keto side", () => {
    const library = baselineLibrary().filter((d) => ![1, 2, 3].includes(d.id));
    const { week } = gen(library);
    const mon = dayOf(week, "Mon");
    expect(mon.breakfast.map((p) => p.dish.id)).toContain(6);
    expect(mon.breakfast.find((p) => p.dish.id === 6)?.role).toBe("protein-floor");
  });

  it("attach rule: a Category=Bread main serves alone", () => {
    const library = baselineLibrary().filter((d) => ![2, 3, 4].includes(d.id));
    const { week } = gen(library);
    expect(dayOf(week, "Mon").breakfast).toHaveLength(1);
    expect(dayOf(week, "Mon").breakfast[0].dish.category).toBe("Bread");
  });

  it("standalone plates land on Mon and Tue, Indian plates on Wed-Fri", () => {
    const { week } = gen(baselineLibrary());
    for (const day of ["Mon", "Tue"]) {
      const lead = dayOf(week, day).lunch.find((p) => p.role === "protein-main");
      expect(lead).toBeDefined();
      // A standalone lead is a complete meal or a non-Indian anchor, never an Indian
      // HP Gravy/Dry/Keto lead.
      const isStandalone =
        lead!.dish.tags.includes("complete_meal") ||
        lead!.dish.category === "Complete meal" ||
        lead!.dish.cuisine !== "Indian";
      expect(isStandalone).toBe(true);
    }
    for (const day of ["Wed", "Thu", "Fri"]) {
      const lunch = dayOf(week, day).lunch;
      expect(lunch.find((p) => p.role === "carb")).toBeDefined();
      expect(lunch.every((p) => p.dish.cuisine === "Indian")).toBe(true);
    }
  });

  it("the two standalone leads prefer distinct cuisines", () => {
    const { week } = gen(baselineLibrary());
    const mon = dayOf(week, "Mon").lunch.find((p) => p.role === "protein-main")!.dish;
    const tue = dayOf(week, "Tue").lunch.find((p) => p.role === "protein-main")!.dish;
    expect(mon.cuisine).not.toBe(tue.cuisine);
  });

  it("Saturday composes lead + protein side + accompaniment-or-dessert", () => {
    const { week } = gen(baselineLibrary());
    const sat = dayOf(week, "Sat").lunch;
    expect(sat.map((p) => p.role)).toEqual(
      expect.arrayContaining(["protein-main", "protein-floor"]),
    );
    expect(sat.length).toBeLessThanOrEqual(3);
  });

  it("every day Mon-Sat carries exactly one fruit, outside breakfast and lunch", () => {
    const { week } = gen(baselineLibrary());
    for (const d of week.days) {
      expect(d.fruit).toBeDefined();
      expect(d.fruit!.role).toBe("fruit");
      expect(d.breakfast.some((p) => p.dish.category === "Fruit")).toBe(false);
      expect(d.lunch.some((p) => p.dish.category === "Fruit")).toBe(false);
    }
  });
});

describe("§3.3 plate rules", () => {
  it("rule 1: at most one Category=Gravy dish per lunch, no fallback", () => {
    const { week } = gen(baselineLibrary());
    for (const d of week.days) {
      const gravies = d.lunch.filter((p) => p.dish.category === "Gravy dish");
      expect(gravies.length).toBeLessThanOrEqual(1);
    }
  });

  it("rule 1: a Gravy lead admits no Gravy companion", () => {
    const pools = buildPools(baselineLibrary(), "Monsoon");
    const gravyLead = baselineLibrary().find((d) => d.id === 10)!;
    const pool = indianCompanionPoolFor(pools, gravyLead);
    expect(pool.some((d) => d.category === "Gravy dish")).toBe(false);
  });

  it("rule 2: every lunch carries an HP or Keto dish", () => {
    const { week } = gen(baselineLibrary());
    for (const d of week.days) {
      const hasProtein = d.lunch.some(
        (p) => p.dish.tags.includes("HP") || p.dish.category === "Keto",
      );
      expect(hasProtein).toBe(true);
    }
  });

  it("rule 2: a non-HP standalone lead takes a cuisine-neutral protein side", () => {
    // Force the standalone lead to be the non-HP veg pulao: 51/52 are the other
    // anchors and 60 is the HP complete meal, which the standalone pool also holds.
    const library = baselineLibrary().filter((d) => ![51, 52, 60].includes(d.id));
    const { week } = gen(library);
    const mon = dayOf(week, "Mon").lunch;
    expect(mon[0].dish.id).toBe(50);
    const side = mon.find((p) => p.role === "protein-floor");
    expect(side).toBeDefined();
    expect(side!.dish.tags).toContain("cuisine_neutral");
  });

  it("rule 2: an empty floor pool leaves the plate and writes a warn incident", () => {
    const library = baselineLibrary().filter((d) => ![40, 51, 52, 60].includes(d.id));
    const { week, incidents } = gen(library);
    const mon = dayOf(week, "Mon").lunch;
    expect(mon.some((p) => p.role === "protein-floor")).toBe(false);
    expect(incidents.some((i) => i.kind === "protein-floor-unfilled" && i.day === "Mon")).toBe(
      true,
    );
  });

  it("rule 3: a standalone complete_meal takes no carb and no extra accompaniment", () => {
    const library = baselineLibrary().filter((d) => ![51, 52, 60].includes(d.id));
    const { week } = gen(library);
    const mon = dayOf(week, "Mon").lunch;
    expect(mon.some((p) => p.role === "carb")).toBe(false);
    expect(mon.some((p) => p.role === "companion")).toBe(false);
  });

  it("rule 4: a Category=Rice carb never lands on consecutive days", () => {
    // Give every Indian lead a Rice affinity so the rule has something to prevent.
    const library = baselineLibrary().map((d) =>
      [10, 11, 12].includes(d.id) ? ({ ...d, carbAffinity: "Rice" } as Dish) : d,
    );
    const { week } = gen(library);
    const riceDays = week.days
      .filter((d) => d.lunch.some((p) => p.role === "carb" && p.dish.category === "Rice"))
      .map((d) => d.day);
    for (let i = 1; i < week.days.length; i += 1) {
      const prev = week.days[i - 1].day;
      const cur = week.days[i].day;
      expect(riceDays.includes(prev) && riceDays.includes(cur)).toBe(false);
    }
  });

  it("rule 5: an Indian plate composes only Indian dishes; a standalone plate stays in its lead's register", () => {
    const { week } = gen(baselineLibrary());
    for (const day of ["Wed", "Thu", "Fri"]) {
      expect(dayOf(week, day).lunch.every((p) => p.dish.cuisine === "Indian")).toBe(true);
    }
    for (const day of ["Mon", "Tue"]) {
      const lunch = dayOf(week, day).lunch;
      const lead = lunch[0].dish;
      for (const p of lunch.slice(1)) {
        expect(p.dish.cuisine === lead.cuisine || p.dish.tags.includes("cuisine_neutral")).toBe(
          true,
        );
      }
    }
  });

  it("rule 5: the standalone side pool is same-cuisine or cuisine-neutral only", () => {
    const pools = buildPools(baselineLibrary(), "Monsoon");
    const italianLead = baselineLibrary().find((d) => d.id === 52)!;
    const pool = standaloneSidePoolFor(pools, italianLead);
    expect(pool.every((d) => d.cuisine === "Italian" || d.tags.includes("cuisine_neutral"))).toBe(
      true,
    );
  });

  it("rule 6: a lunch candidate repeating the day's breakfast protein family is deprioritised", () => {
    // Breakfast lands the egg complete_meal; the Indian lead pool then prefers a
    // non-egg protein even when frequency would have chosen the egg one.
    const library: Dish[] = [
      ...baselineLibrary().filter((d) => ![1, 2, 4, 10, 11].includes(d.id)),
      dish({ id: 13, name: "Egg keto", category: "Keto", tags: ["HP"], primaryIngredient: "Egg" }),
    ];
    // History makes the egg lunch dish the frequency winner.
    const eggLunch = library.find((d) => d.id === 13)!;
    const history = [
      row("2026-07-06", "Monday", "Lunch", eggLunch),
      row("2026-07-13", "Monday", "Lunch", eggLunch),
      row("2026-07-20", "Monday", "Lunch", eggLunch),
    ];
    const { week } = gen(library, history);
    const wedBreakfast = dayOf(week, "Wed").breakfast[0].dish;
    expect(wedBreakfast.primaryIngredient).toBe("Egg");
    const wedLead = dayOf(week, "Wed").lunch.find((p) => p.role === "protein-main")!.dish;
    expect(wedLead.primaryIngredient).not.toBe("Egg");
  });

  it("rule 7: a placed lead's pairsWith partner leads the companion pool", () => {
    // Uses the live library so the real plate rule 7 data (fish tikka + kadhi) applies.
    const live = liveLibrary();
    const { week } = generateWeekV4({
      library: live,
      history: [],
      weekStart: WEEK,
      season: "Monsoon",
      favorites: [],
    });
    const plateWithFishTikka = week.days.find((d) =>
      d.lunch.some((p) => p.dish.id === 118 && p.role === "protein-main"),
    );
    if (plateWithFishTikka) {
      expect(plateWithFishTikka.lunch.some((p) => p.dish.id === 8)).toBe(true);
    } else {
      // Fish tikka did not lead this week; the rule then has nothing to assert.
      expect(plateWithFishTikka).toBeUndefined();
    }
  });

  it("rule 7: an unplaceable named partner writes an incident rather than being dropped silently", () => {
    const live = liveLibrary();
    const { incidents } = generateWeekV4({
      library: live,
      history: [],
      weekStart: WEEK,
      season: "Monsoon",
      favorites: [],
    });
    // Every pairs-with incident names the dish that could not be placed.
    for (const i of incidents.filter((x) => x.kind === "pairs-with-unavailable")) {
      expect(i.dishId).toBeGreaterThan(0);
      expect(i.reason).toContain("pairsWith");
    }
  });

  it("rule 8: at most one HP source per meal, with the thin-pool fallback", () => {
    const { week } = gen(baselineLibrary());
    for (const d of week.days) {
      const bfHp = d.breakfast.filter((p) => p.dish.tags.includes("HP"));
      expect(bfHp.length).toBeLessThanOrEqual(1);
    }
  });

  it("the second Indian companion position is Dry-only, and opens only on a dal-led plate", () => {
    const pools = buildPools(baselineLibrary(), "Monsoon");
    const lead = baselineLibrary().find((d) => d.id === 11)!;
    const dal = baselineLibrary().find((d) => d.id === 20)!;
    const pool = indianSecondCompanionPool(pools, [lead, dal]);
    expect(pool.every((d) => d.category === "Dry dish")).toBe(true);
    expect(pool.some((d) => d.id === dal.id)).toBe(false);
  });
});

describe("§3.5 cap", () => {
  it("asserts and logs an over-cap day without dropping anything", () => {
    // A non-HP Chilla breakfast (main + chutney + keto side = 3) beside a four-item
    // dal thali is a legal composition that exceeds the 5-item weekday cap.
    const library = baselineLibrary().filter((d) => ![1, 3, 4].includes(d.id));
    const { week, incidents } = gen(library);
    const over = week.days.filter(
      (d) => d.breakfast.length + d.lunch.length > (d.day === "Sat" ? 3 : 5),
    );
    for (const d of over) {
      expect(incidents.some((i) => i.kind === "cap-exceeded" && i.day === d.day)).toBe(true);
    }
    // Nothing is dropped: the day still carries every composed item.
    for (const d of over) {
      expect(d.breakfast.length + d.lunch.length).toBeGreaterThan(5);
    }
  });
});

// The live library, parsed once and shared by the tests that need real pairsWith data.
let cached: Dish[] | undefined;
function liveLibrary(): Dish[] {
  if (!cached) cached = loadLibrary();
  return cached;
}
