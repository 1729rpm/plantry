/**
 * §6 the orchestrator, tested on the household's own eight served weeks.
 *
 * Every case here is an observation the composition would fail without the step
 * it guards, not a restatement of the implementation: §10's determinism under
 * both input orders, each of §6's six steps visible in one generated week, the
 * generated plan matching the placed picks exactly (which is what lets §3.1's
 * replay reproduce a generation), the §6 step 6 refund-and-charge rule, and §12's
 * derived cutover week.
 */

import { describe, expect, it } from "vitest";
import type { Dish } from "../../src/data/schemas.js";
import {
  applyRepairsToLedger,
  deriveCutoverWeek,
  generateWeekV6,
} from "../../src/v6/generateWeekV6.js";
import { charge, deficitIn, emptyLedger } from "../../src/v6/ledger.js";
import { proteinFamily } from "../../src/v6/compose.js";
import type { Repair } from "../../src/v6/place.js";
import type { GenerateWeekV6Args, RecordWeek } from "../../src/v6/types.js";
import { loadRecordFixture } from "./loadRecordFixture.js";
import { loadLiveData } from "../loadLive.js";

const live = loadLiveData();
const library: Dish[] = live.library;
const record = loadRecordFixture("record-8weeks", library);

/** The Monday after the last served week of the fixture. */
const WEEK_START = "2026-08-17";

function baseArgs(overrides: Partial<GenerateWeekV6Args> = {}): GenerateWeekV6Args {
  return {
    weekStart: WEEK_START,
    season: "Monsoon",
    library,
    record,
    favoriteDishIds: [],
    nutrition: { ingredients: live.ingredients, catalog: live.catalog },
    ...overrides,
  };
}

function dishById(id: number): Dish | undefined {
  return library.find((dish) => dish.id === id);
}

function idOf(name: string): number {
  const dish = library.find((candidate) => candidate.name.toLowerCase() === name.toLowerCase());
  if (!dish) throw new Error(`fixture dish not found: ${name}`);
  return dish.id;
}

/** A stable serialization of everything a generated week promises to be. */
function fingerprint(week: ReturnType<typeof generateWeekV6>): string {
  return JSON.stringify({
    weekStart: week.weekStart,
    days: week.days.map((day) => ({
      day: day.day,
      slots: day.slots.map((slot) => ({
        meal: slot.meal,
        dishes: slot.dishes.map((dish) => dish.id),
      })),
      fruit: day.fruit?.id ?? null,
    })),
    droppedDishIds: week.droppedDishIds,
    incidents: week.incidents,
    unplacedFavorites: week.unplacedFavorites,
    generatedPlan: week.generatedPlan,
    diagnostics: week.diagnostics,
  });
}

describe("generateWeekV6 determinism (§10)", () => {
  it("returns a byte-identical week for two calls with the same inputs", () => {
    expect(fingerprint(generateWeekV6(baseArgs()))).toBe(fingerprint(generateWeekV6(baseArgs())));
  });

  it("is unchanged when the library array is reversed", () => {
    const forward = fingerprint(generateWeekV6(baseArgs()));
    const reversed = fingerprint(generateWeekV6(baseArgs({ library: [...library].reverse() })));
    expect(reversed).toBe(forward);
  });

  it("is unchanged when the record array is reversed", () => {
    const forward = fingerprint(generateWeekV6(baseArgs()));
    const reversed = fingerprint(generateWeekV6(baseArgs({ record: [...record].reverse() })));
    expect(reversed).toBe(forward);
  });
});

describe("generateWeekV6 output shape (§6, §12)", () => {
  const week = generateWeekV6(baseArgs());

  it("schedules Monday to Saturday and never Sunday (§4)", () => {
    expect(week.days.map((day) => day.day)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
  });

  it("gives every weekday a breakfast and a lunch, and Saturday a lunch only", () => {
    for (const day of week.days) {
      const meals = day.slots.map((slot) => slot.meal).sort();
      expect(meals).toEqual(day.day === "Sat" ? ["Lunch"] : ["Breakfast", "Lunch"]);
    }
  });

  it("carries one fruit a day, six in the week (§9)", () => {
    expect(week.days.filter((day) => day.fruit !== undefined)).toHaveLength(6);
  });

  it("returns a generated plan equal to the picks it placed (§12)", () => {
    const placed = week.days
      .flatMap((day) => [
        ...day.slots.flatMap((slot) =>
          slot.dishes.map((dish) => ({
            day: day.day,
            meal: slot.meal === "Breakfast" ? "breakfast" : "lunch",
            dishId: dish.id,
          })),
        ),
        ...(day.fruit ? [{ day: day.day, meal: "fruit", dishId: day.fruit.id }] : []),
      ])
      .map((pick) => `${pick.day}:${pick.meal}:${pick.dishId}`)
      .sort();
    const planned = week.generatedPlan
      .map((pick) => `${pick.day}:${pick.meal}:${pick.dishId}`)
      .sort();
    expect(planned).toEqual(placed);
  });
});

describe("generateWeekV6 composes every §6 step", () => {
  it("step 2 pins a favorite into exactly one slot", () => {
    // Fish tikka is a weekday lunch star in the record (7 rows over 36 weekday
    // lunch occasions), so it has a pool to be pinned into and a rate low enough
    // that §3's charge keeps it from earning a second placement in the same week.
    const favorite = idOf("Fish tikka");
    const week = generateWeekV6(baseArgs({ favoriteDishIds: [favorite] }));
    const placements = week.generatedPlan.filter((pick) => pick.dishId === favorite);
    expect(week.unplacedFavorites).not.toContain(favorite);
    expect(placements).toHaveLength(1);
  });

  it("step 3 places exactly one exploration pick, at a weekday lunch (§7)", () => {
    const week = generateWeekV6(baseArgs());
    const exploration = week.diagnostics.exploration;
    expect(exploration).not.toBeNull();
    const placements = week.generatedPlan.filter(
      (pick) => pick.dishId === (exploration?.dishId ?? -1),
    );
    expect(placements).toHaveLength(1);
    expect(placements[0].meal).toBe("lunch");
    expect(placements[0].day).not.toBe("Sat");
  });

  it("step 4 builds a Saturday plate of treat plus dessert (§5.4)", () => {
    const week = generateWeekV6(baseArgs());
    const saturday = week.days.find((day) => day.day === "Sat");
    const lunch = saturday?.slots.find((slot) => slot.meal === "Lunch");
    expect(lunch).toBeDefined();
    expect(lunch?.dishes.length).toBeGreaterThanOrEqual(2);
    expect(lunch?.dishes.length).toBeLessThanOrEqual(3);
    expect(lunch?.dishes.some((dish) => dish.category === "Dessert")).toBe(true);
    // The treat leads the plate: §6 step 6's anchor repair guarantees it.
    expect(lunch?.dishes[0].category).not.toBe("Dessert");
  });

  it("step 4 anchors Thursday breakfast on eggs (§4 anchor 2)", () => {
    const week = generateWeekV6(baseArgs());
    const thursday = week.days.find((day) => day.day === "Thu");
    const breakfast = thursday?.slots.find((slot) => slot.meal === "Breakfast");
    expect(breakfast).toBeDefined();
    expect(breakfast?.dishes.some((dish) => proteinFamily(dish.primaryIngredient) === "Egg")).toBe(
      true,
    );
  });

  it("step 4 keeps weekday lunches inside the §5.3 international ceiling", () => {
    const week = generateWeekV6(baseArgs());
    const stars = week.days
      .filter((day) => day.day !== "Sat")
      .map((day) => day.slots.find((slot) => slot.meal === "Lunch")?.dishes[0])
      .filter((dish): dish is Dish => dish !== undefined);
    expect(stars.filter((dish) => dish.cuisine !== "Indian").length).toBeLessThanOrEqual(2);
    expect(week.diagnostics.weekdayInternationalStars).toBeLessThanOrEqual(2);
  });

  it("step 6 never leaves two gravies on one lunch (§5.1, hard rule)", () => {
    const week = generateWeekV6(baseArgs());
    for (const day of week.days) {
      const lunch = day.slots.find((slot) => slot.meal === "Lunch");
      if (!lunch) continue;
      const gravies = lunch.dishes.filter((dish) => dish.category === "Gravy dish");
      expect(gravies.length).toBeLessThanOrEqual(1);
    }
  });
});

describe("§6 step 6 repairs refund the replaced dish and charge the replacement", () => {
  it("refunds the removed dish and charges the one that took its place", () => {
    const replacedId = idOf("Fish tikka");
    const replacementId = idOf("Chicken tikka");
    // Both dishes start one serving into the red, so a repair that swaps one for
    // the other must leave the replaced dish at 0 and the replacement at -2.
    let ledger = charge(
      charge(emptyLedger(), replacedId, "weekdayLunch"),
      replacementId,
      "weekdayLunch",
    );
    expect(deficitIn(ledger, replacedId, "weekdayLunch")).toBe(-1);
    expect(deficitIn(ledger, replacementId, "weekdayLunch")).toBe(-1);

    const repairs: Repair[] = [
      {
        day: "Tue",
        meal: "lunch",
        replaced: {
          meal: "lunch",
          dishId: replacedId,
          role: "companion",
          scope: "weekdayLunch",
          origin: "deficit",
        },
        replacement: {
          meal: "lunch",
          dishId: replacementId,
          role: "companion",
          scope: "weekdayLunch",
          origin: "deficit",
        },
        reason: "prep-ceiling",
        swappedWithDay: null,
      },
    ];
    ledger = applyRepairsToLedger(ledger, repairs);
    expect(deficitIn(ledger, replacedId, "weekdayLunch")).toBe(0);
    expect(deficitIn(ledger, replacementId, "weekdayLunch")).toBe(-2);
  });

  it("leaves the ledger untouched for a whole-plate swap", () => {
    const dish = idOf("Fish tikka");
    const ledger = charge(emptyLedger(), dish, "weekdayLunch");
    const swap: Repair[] = [
      {
        day: "Mon",
        meal: "lunch",
        replaced: null,
        replacement: null,
        reason: "consecutive-rice",
        swappedWithDay: "Wed",
      },
    ];
    expect(deficitIn(applyRepairsToLedger(ledger, swap), dish, "weekdayLunch")).toBe(-1);
  });

  it("keeps a dish a repair removed out of the generated plan", () => {
    const week = generateWeekV6(baseArgs());
    for (const repair of week.diagnostics.repairs) {
      if (repair.removedDishId === null || repair.addedDishId === null) continue;
      const stillOnThatSlot = week.generatedPlan.some(
        (pick) =>
          pick.day === repair.day &&
          pick.meal === repair.meal &&
          pick.dishId === repair.removedDishId,
      );
      expect(stillOnThatSlot).toBe(false);
    }
  });
});

describe("§12 the cutover week is derived, never configured", () => {
  const plan = [{ day: "Mon" as const, meal: "lunch" as const, dishId: 1 }];

  it("is the generating week when no record week carries a generated plan", () => {
    expect(deriveCutoverWeek(record, WEEK_START)).toBe(WEEK_START);
  });

  it("is the earliest record week that carries a generated plan", () => {
    const withPlans: RecordWeek[] = record.map((week, index) => ({
      ...week,
      generatedPlan: index >= 5 ? plan : null,
    }));
    expect(deriveCutoverWeek(withPlans, WEEK_START)).toBe(withPlans[5].weekStart);
  });

  it("ignores record rows at or after the generating week", () => {
    const later: RecordWeek[] = [
      { weekStart: WEEK_START, picks: [], skippedDays: [], generatedPlan: plan },
    ];
    expect(deriveCutoverWeek(later, WEEK_START)).toBe(WEEK_START);
  });

  it("replays from the derived cutover, so a self-fed week is stable", () => {
    // The engine's own first week becomes the cutover for every week after it,
    // which is what stops the cold start from moving each time a week is written.
    const first = generateWeekV6(baseArgs());
    const withFirst: RecordWeek[] = [
      ...record,
      {
        weekStart: WEEK_START,
        picks: first.generatedPlan,
        skippedDays: [],
        generatedPlan: first.generatedPlan,
      },
    ];
    const second = generateWeekV6(baseArgs({ weekStart: "2026-08-24", record: withFirst }));
    expect(second.diagnostics.cutoverWeek).toBe(WEEK_START);
  });
});

describe("§9 the item cap is the safety net behind the ceilings", () => {
  it("never leaves a weekday over 5 items or a Saturday over 3", () => {
    const week = generateWeekV6(baseArgs());
    for (const day of week.days) {
      const items = day.slots.reduce((sum, slot) => sum + slot.dishes.length, 0);
      expect(items).toBeLessThanOrEqual(day.day === "Sat" ? 3 : 5);
    }
  });

  it("resolves every placed dish against the library", () => {
    const week = generateWeekV6(baseArgs());
    for (const pick of week.generatedPlan) {
      expect(dishById(pick.dishId), `dish ${pick.dishId} is not in the library`).toBeDefined();
    }
  });
});
