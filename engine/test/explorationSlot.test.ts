import { describe, it, expect } from "vitest";
import {
  chooseExplorationPosition,
  rankExploration,
  type ExplorationPosition,
} from "../src/explore.js";
import type { Dish, MenuHistoryRow } from "../src/data/schemas.js";

/**
 * The weekly exploration slot (`features/engine-v4.md` §10.5). Separate file from
 * `explore.test.ts`, which covers the Explore TAB ranking: the two share a module
 * but answer different questions (what to show a browsing user, versus which one
 * position of a generated week is spent on novelty).
 *
 * Both rules under test exist because of a measured failure. Fixing the slot to
 * Friday meant only Friday's companion ever saw a new dish, so 19 of 20 explored
 * dishes were served exactly once in 25 weeks. Ranking it by anything other than
 * pure longest-unused means the proven repertoire wins it and there is no
 * discovery at all.
 */

let nextId = 1;
function makeDish(overrides: Partial<Dish> = {}): Dish {
  const id = nextId++;
  return {
    id,
    name: `Dish ${id}`,
    category: "Dry dish",
    time: "Lunch",
    tags: [],
    primaryIngredient: "Paneer",
    preferred: "No",
    active: "Yes",
    satiety: "Medium",
    prepMinutes: 30,
    seasons: "All",
    cuisine: "Indian",
    ...overrides,
  };
}

function historyRow(dishId: number, weekStart: string): MenuHistoryRow {
  return { weekStart, day: "Monday", meal: "Lunch", dishName: `Dish ${dishId}`, dishId };
}

const POSITIONS: ExplorationPosition[] = [
  { day: "Wed", meal: "Lunch", index: 2 },
  { day: "Thu", meal: "Lunch", index: 2 },
  { day: "Fri", meal: "Lunch", index: 2 },
];

/** Consecutive Mondays, for walking the rotation forward. */
function mondays(start: string, count: number): string[] {
  const base = new Date(`${start}T00:00:00Z`);
  return Array.from({ length: count }, (_, i) =>
    new Date(base.getTime() + i * 7 * 86400000).toISOString().slice(0, 10),
  );
}

describe("§10.5 exploration slot: which position carries it", () => {
  it("advances one position per week instead of sitting on one day", () => {
    const chosen = mondays("2026-08-17", 6).map(
      (weekStart) => chooseExplorationPosition({ weekStart, positions: POSITIONS })?.day,
    );
    // Six consecutive weeks must not all land on the same day: that is exactly
    // the defect (rule "fixed to Friday") this replaces.
    expect(new Set(chosen).size).toBe(POSITIONS.length);
  });

  it("visits every position over a full rotation", () => {
    const chosen = mondays("2026-08-17", POSITIONS.length).map(
      (weekStart) => chooseExplorationPosition({ weekStart, positions: POSITIONS })?.day,
    );
    expect(new Set(chosen)).toEqual(new Set(POSITIONS.map((p) => p.day)));
  });

  it("is deterministic: regenerating a week picks the same position", () => {
    const a = chooseExplorationPosition({ weekStart: "2026-09-07", positions: POSITIONS });
    const b = chooseExplorationPosition({ weekStart: "2026-09-07", positions: POSITIONS });
    expect(a).toEqual(b);
  });

  it("returns undefined when the week composed no companion positions", () => {
    expect(chooseExplorationPosition({ weekStart: "2026-08-17", positions: [] })).toBeUndefined();
  });

  it("handles a single position without dividing by zero", () => {
    const only = [POSITIONS[0]];
    expect(chooseExplorationPosition({ weekStart: "2026-08-17", positions: only })).toEqual(
      only[0],
    );
  });
});

describe("§10.5 exploration slot: how it ranks", () => {
  it("puts never-cooked dishes ahead of everything cooked", () => {
    nextId = 100;
    const cooked = makeDish();
    const fresh = makeDish();
    const history = [historyRow(cooked.id, "2020-01-06")];
    expect(rankExploration([cooked, fresh], history).map((d) => d.id)).toEqual([
      fresh.id,
      cooked.id,
    ]);
  });

  it("ignores frequency, so the proven repertoire cannot win the slot", () => {
    nextId = 200;
    const fresh = makeDish();
    const proven = makeDish();
    // Ten appearances: this dish leads every ordinary §4 pool in the library.
    const history = mondays("2026-01-05", 10).map((w) => historyRow(proven.id, w));
    expect(rankExploration([proven, fresh], history)[0].id).toBe(fresh.id);
  });

  it("orders cooked dishes oldest first", () => {
    nextId = 300;
    const recent = makeDish();
    const old = makeDish();
    const history = [historyRow(recent.id, "2026-05-11"), historyRow(old.id, "2026-01-05")];
    expect(rankExploration([recent, old], history).map((d) => d.id)).toEqual([old.id, recent.id]);
  });

  it("breaks ties by id, so the ranking is input-order independent", () => {
    nextId = 400;
    const a = makeDish();
    const b = makeDish();
    expect(rankExploration([b, a], []).map((d) => d.id)).toEqual([a.id, b.id]);
    expect(rankExploration([a, b], []).map((d) => d.id)).toEqual([a.id, b.id]);
  });

  it("does not mutate the pool it is given", () => {
    nextId = 500;
    const a = makeDish();
    const b = makeDish();
    const pool = [b, a];
    rankExploration(pool, []);
    expect(pool.map((d) => d.id)).toEqual([b.id, a.id]);
  });
});
