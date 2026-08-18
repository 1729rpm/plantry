import { describe, it, expect } from "vitest";
import {
  validateCatalogGroups,
  validateDishFiles,
  validateIngredientNamesResolve,
  validatePairsWithResolve,
  validateMenuHistoryAgainstLibrary,
  validatePackSizesUsed,
} from "../../src/data/validators.js";
import { loadLiveData } from "../loadLive.js";
import { proteinFamily } from "../../src/priority.js";
import type {
  CatalogIngredient,
  Dish,
  DishFile,
  Ingredient,
  MenuHistoryRow,
  PackSizeHeader,
} from "../../src/data/schemas.js";

describe("validateMenuHistoryAgainstLibrary", () => {
  it("passes on live data with no drift between menu_history and dishes", () => {
    const { library, history } = loadLiveData();
    expect(() => validateMenuHistoryAgainstLibrary(history, library)).not.toThrow();
  });

  it("throws and names every missing dish id with referencing rows", () => {
    const dishes: Dish[] = [
      {
        id: 1,
        name: "Chicken masala gravy",
        category: "Gravy dish",
        time: "Lunch",
        tags: ["HP"],
        primaryIngredient: "Chicken",
        preferred: "Yes",
        active: "Yes",
        satiety: "High",
        prepMinutes: 30,
        seasons: "All",
        cuisine: "Indian",
      },
    ];
    const history: MenuHistoryRow[] = [
      {
        weekStart: "2026-06-08",
        day: "Monday",
        meal: "Lunch",
        dishName: "Chicken masala gravy",
        dishId: 1,
      },
      {
        weekStart: "2026-06-08",
        day: "Monday",
        meal: "Lunch",
        dishName: "Ghost dish",
        dishId: 999,
      },
      {
        weekStart: "2026-06-08",
        day: "Tuesday",
        meal: "Breakfast",
        dishName: "Other ghost",
        dishId: 777,
      },
    ];
    expect(() => validateMenuHistoryAgainstLibrary(history, dishes)).toThrow(
      /dish id 777.*dish id 999|dish id 999.*dish id 777/s,
    );
  });
});

describe("validatePackSizesUsed", () => {
  it("passes on live catalog-derived pack sizes", () => {
    const { packSizes, ingredients } = loadLiveData();
    expect(() => validatePackSizesUsed(packSizes, ingredients)).not.toThrow();
  });

  it("throws and names every unused tracked ingredient", () => {
    const packSizes: PackSizeHeader[] = [
      { ingredient: "Paneer", packSize: "200 g" },
      { ingredient: "Unicorn meat", packSize: "500 g" },
      { ingredient: "Phantom spice", packSize: "50 g" },
    ];
    const ingredients: Ingredient[] = [
      {
        dishId: 1,
        dishName: "Palak paneer",
        ingredient: "Paneer",
        quantity: 200,
        unit: "g",
      },
    ];
    expect(() => validatePackSizesUsed(packSizes, ingredients)).toThrow(
      /"Unicorn meat".*"Phantom spice"|"Phantom spice".*"Unicorn meat"/s,
    );
  });
});

describe("validateDishFiles", () => {
  it("passes on the live per-dish files", () => {
    const { dishFiles } = loadLiveData();
    expect(() => validateDishFiles(dishFiles)).not.toThrow();
  });

  it("the two Paneer bhurji dishes get distinct, canonical slugs", () => {
    const { dishFiles } = loadLiveData();
    const byId = new Map(dishFiles.map((f) => [f.dish.id, f.slug]));
    expect(byId.get(13)).toBe("paneer-bhurji");
    expect(byId.get(106)).toBe("paneer-bhurji-106");
  });

  it("throws when a slug does not match its name", () => {
    const file: DishFile = {
      slug: "wrong-slug",
      dish: {
        id: 1,
        name: "Chicken masala gravy",
        category: "Gravy dish",
        time: "Lunch",
        tags: ["HP"],
        primaryIngredient: "Chicken",
        preferred: "Yes",
        active: "Yes",
        satiety: "High",
        prepMinutes: 30,
        seasons: "All",
        cuisine: "Indian",
      },
      ingredients: [],
    };
    expect(() => validateDishFiles([file])).toThrow(/canonical slug is "chicken-masala-gravy"/);
  });

  it("throws on a duplicate dish id", () => {
    const base = {
      category: "Gravy dish" as const,
      time: "Lunch" as const,
      tags: [],
      primaryIngredient: "Chicken",
      preferred: "Yes" as const,
      active: "Yes" as const,
      satiety: "High" as const,
      prepMinutes: 30,
      seasons: "All" as const,
      cuisine: "Indian" as const,
    };
    const files: DishFile[] = [
      { slug: "a", dish: { id: 5, name: "A", ...base }, ingredients: [] },
      { slug: "b", dish: { id: 5, name: "B", ...base }, ingredients: [] },
    ];
    expect(() => validateDishFiles(files)).toThrow(/dish id 5 used by 2 files/);
  });
});

describe("validateCatalogGroups", () => {
  it("passes on the live catalog (every row has a valid group)", () => {
    const { catalog } = loadLiveData();
    expect(() => validateCatalogGroups(catalog)).not.toThrow();
  });

  it("throws on a duplicated catalog ingredient", () => {
    const catalog: CatalogIngredient[] = [
      { ingredient: "Paneer", group: "Proteins and Dairy", unit: "g", packSize: "200 g", special: false },
      { ingredient: "Paneer", group: "Proteins and Dairy", unit: "g", special: false },
    ];
    expect(() => validateCatalogGroups(catalog)).toThrow(/Paneer.*appears 2 times/);
  });
});

describe("validateIngredientNamesResolve", () => {
  it("passes on live data: every dish ingredient resolves to a catalog row", () => {
    const { dishFiles, catalog } = loadLiveData();
    expect(() => validateIngredientNamesResolve(dishFiles, catalog)).not.toThrow();
  });

  it("throws and names an ingredient row absent from the catalog", () => {
    const dishFiles: DishFile[] = [
      {
        slug: "ghost-dish",
        dish: {
          id: 1,
          name: "Ghost dish",
          category: "Gravy dish",
          time: "Lunch",
          tags: [],
          primaryIngredient: "Chicken",
          preferred: "Yes",
          active: "Yes",
          satiety: "High",
          prepMinutes: 30,
          seasons: "All",
          cuisine: "Indian",
        },
        ingredients: [{ ingredient: "Phantom Spice", quantity: 5, unit: "g" }],
      },
    ];
    const catalog: CatalogIngredient[] = [
      { ingredient: "Chicken", group: "Proteins and Dairy", unit: "g", special: false },
    ];
    expect(() => validateIngredientNamesResolve(dishFiles, catalog)).toThrow(
      /"Phantom Spice".*ghost-dish/,
    );
  });
});

describe("validatePairsWithResolve", () => {
  // A minimal, valid Indian lunch lead. Individual cases override the fields
  // they are about, so each test reads as one deviation from a placeable pair.
  const lead = (over: Partial<Dish> = {}): Dish => ({
    id: 1,
    name: "Lead dish",
    category: "Keto",
    time: "Lunch",
    tags: ["HP"],
    primaryIngredient: "Fish",
    preferred: "Yes",
    active: "Yes",
    satiety: "High",
    prepMinutes: 25,
    seasons: "All",
    cuisine: "Indian",
    ...over,
  });
  const partner = (over: Partial<Dish> = {}): Dish => ({
    id: 2,
    name: "Partner dish",
    category: "Gravy dish",
    time: "Lunch",
    tags: [],
    primaryIngredient: "Curd",
    preferred: "Yes",
    active: "Yes",
    satiety: "High",
    prepMinutes: 30,
    seasons: "All",
    cuisine: "Indian",
    ...over,
  });
  const files = (a: Dish, b: Dish): DishFile[] => [
    { slug: "a", dish: a, ingredients: [] },
    { slug: "b", dish: b, ingredients: [] },
  ];

  it("passes on the live dish files", () => {
    const { dishFiles } = loadLiveData();
    expect(() => validatePairsWithResolve(dishFiles)).not.toThrow();
  });

  it("the one shipped pair is fish tikka -> kadhi", () => {
    const { library } = loadLiveData();
    const paired = library
      .filter((d) => d.pairsWith !== undefined)
      .map((d) => [d.name, d.pairsWith] as const);
    expect(paired).toEqual([["Fish tikka", ["Kadhi"]]]);
  });

  it("accepts a lead naming a placeable partner", () => {
    expect(() =>
      validatePairsWithResolve(files(lead({ pairsWith: ["Partner dish"] }), partner())),
    ).not.toThrow();
  });

  it("rejects a name that does not resolve to a library dish", () => {
    // The `toor dal / moong dal + "a dry sabzi"` seed pair: a description, not a
    // dish name.
    expect(() =>
      validatePairsWithResolve(files(lead({ pairsWith: ["a dry sabzi"] }), partner())),
    ).toThrow(/"a dry sabzi" does not resolve to a library dish/);
  });

  // The gate the ingredient-name-style validator alone would NOT give us, and
  // the one whose absence let five unplaceable seed pairs ship: the partner
  // resolves to a real dish, but no companion position pool can hold its
  // category.
  it("rejects a partner whose category no companion position pool can hold", () => {
    // `mutton keema + pav`: Pav is Category=Bread, a real active Lunch dish, and
    // no Indian-plate position pool holds Bread.
    expect(() =>
      validatePairsWithResolve(
        files(
          lead({ category: "Dry dish", pairsWith: ["Partner dish"] }),
          partner({ category: "Bread" }),
        ),
      ),
    ).toThrow(/Category=Bread, which no companion position pool can hold/);

    // `palak paneer + missi roti`: a Chapati is the carb pool, which
    // `carbAffinity` picks, not the companion pool rule 7 claims.
    expect(() =>
      validatePairsWithResolve(
        files(
          lead({ category: "Gravy dish", pairsWith: ["Partner dish"] }),
          partner({ category: "Chapati" }),
        ),
      ),
    ).toThrow(/Category=Chapati, which no companion position pool can hold/);
  });

  it("rejects a second gravy against a gravy lead (plate rule 1)", () => {
    // `soya chunks masala + vegetable korma`: both Category=Gravy dish, so the
    // pair violates the one-gravy rule directly. It logged an error every week it
    // fired, 18 times in 25 weeks.
    expect(() =>
      validatePairsWithResolve(
        files(
          lead({ category: "Gravy dish", pairsWith: ["Partner dish"] }),
          partner({ category: "Gravy dish" }),
        ),
      ),
    ).toThrow(/second Gravy dish, which plate rule 1/);
  });

  it("rejects a lead that can never occupy a lead position", () => {
    // `chole + raita`: Chole is a non-HP Indian Gravy dish, so it is only ever a
    // companion itself and rule 7 could never fire from it.
    expect(() =>
      validatePairsWithResolve(
        files(
          lead({ category: "Gravy dish", tags: [], pairsWith: ["Partner dish"] }),
          partner({ category: "Accompaniment" }),
        ),
      ),
    ).toThrow(/can never occupy a lead position/);
  });

  it("rejects an inactive partner, a breakfast partner, and a self-reference", () => {
    expect(() =>
      validatePairsWithResolve(files(lead({ pairsWith: ["Partner dish"] }), partner({ active: "No" }))),
    ).toThrow(/is inactive/);
    expect(() =>
      validatePairsWithResolve(
        files(lead({ pairsWith: ["Partner dish"] }), partner({ time: "Breakfast" })),
      ),
    ).toThrow(/is a Breakfast dish/);
    expect(() =>
      validatePairsWithResolve(files(lead({ pairsWith: ["Lead dish"] }), partner())),
    ).toThrow(/names itself/);
  });

  it("rejects a partner whose seasons never overlap the lead's", () => {
    expect(() =>
      validatePairsWithResolve(
        files(
          lead({ seasons: ["Summer"], pairsWith: ["Partner dish"] }),
          partner({ seasons: ["Winter"] }),
        ),
      ),
    ).toThrow(/shares no season with the lead/);
  });

  it("rejects an ambiguous partner name and a duplicated entry", () => {
    const twin = partner({ id: 3, name: "Partner dish" });
    expect(() =>
      validatePairsWithResolve([
        ...files(lead({ pairsWith: ["Partner dish"] }), partner()),
        { slug: "c", dish: twin, ingredients: [] },
      ]),
    ).toThrow(/is ambiguous, it resolves to 2 dishes/);
    expect(() =>
      validatePairsWithResolve(
        files(lead({ pairsWith: ["Partner dish", "Partner dish"] }), partner()),
      ),
    ).toThrow(/names "Partner dish" more than once/);
  });
});

describe("cuisine_neutral protein-side pool (features/engine-v4.md §10.3 rule 2)", () => {
  it("spans at least six dishes across at least five protein families", () => {
    const { library } = loadLiveData();
    const pool = library.filter(
      (d) =>
        d.active === "Yes" &&
        d.time === "Lunch" &&
        d.tags.includes("cuisine_neutral") &&
        (d.tags.includes("HP") || d.category === "Keto"),
    );
    expect(pool.length).toBeGreaterThanOrEqual(6);
    // Breadth of protein FAMILY is the point, not raw count: the pool that
    // produced 69 placements of one dish in 150 days held six-dish-worth of
    // nothing, two chicken-breast dishes in one family. A third chicken dish
    // would grow the count and fix nothing.
    const families = new Set(pool.map((d) => proteinFamily(d)));
    expect(families.size).toBeGreaterThanOrEqual(5);
    // No single family may be more than half the pool.
    for (const family of families) {
      const share = pool.filter((d) => proteinFamily(d) === family).length;
      expect(share * 2).toBeLessThanOrEqual(pool.length);
    }
  });
});
