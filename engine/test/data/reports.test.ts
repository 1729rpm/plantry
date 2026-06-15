import { describe, it, expect } from "vitest";
import {
  coverageReport,
  poolCoverageReport,
  hpProteinConsistencyReport,
  specialSourcingReport,
  HP_PROTEIN_THRESHOLD_PER_PERSON,
} from "../../src/data/validators.js";
import { loadLiveData } from "../loadLive.js";
import type { CatalogIngredient, Dish, Ingredient } from "../../src/data/schemas.js";

const baseDish = {
  category: "Gravy dish" as const,
  time: "Lunch" as const,
  tags: [] as string[],
  primaryIngredient: "Chicken",
  preferred: "Yes" as const,
  active: "Yes" as const,
  satiety: "High" as const,
  prepMinutes: 30,
  seasons: "All" as const,
};

function dish(overrides: Partial<Dish> & { id: number; name: string }): Dish {
  return { ...baseDish, ...overrides };
}

describe("coverageReport", () => {
  it("counts enrichment fields over active dishes only", () => {
    const dishes: Dish[] = [
      dish({ id: 1, name: "A", description: "tasty", complexity: "Easy", recipe: ["step"] }),
      dish({ id: 2, name: "B", photo: "b.jpg" }),
      // Inactive dish: fully enriched but must not count.
      dish({ id: 3, name: "C", active: "No", description: "x", complexity: "Hard" }),
    ];
    const catalog: CatalogIngredient[] = [];
    const cov = coverageReport(dishes, catalog);
    expect(cov.activeDishCount).toBe(2);
    expect(cov.withDescription).toBe(1);
    expect(cov.withRecipe).toBe(1);
    expect(cov.withComplexity).toBe(1);
    expect(cov.withPhoto).toBe(1);
  });

  it("counts macro coverage only over macro-relevant catalog rows", () => {
    const catalog: CatalogIngredient[] = [
      // Macro-relevant (food groups):
      { ingredient: "Paneer", group: "Proteins and Dairy", unit: "g", proteinPer100g: 18, special: false },
      { ingredient: "Rice", group: "Pantry", unit: "g", special: false }, // relevant, no macros
      { ingredient: "Carrot", group: "Vegetables", unit: "g", special: false }, // relevant, no macros
      // Not macro-relevant (aromatics / other), excluded from the denominator:
      { ingredient: "Onion", group: "Aromatics and Herbs", unit: "g", special: false },
      { ingredient: "Fruit", group: "Other", unit: "g", special: false },
    ];
    const cov = coverageReport([], catalog);
    expect(cov.macroRelevantCount).toBe(3);
    expect(cov.macroRelevantWithMacros).toBe(1);
  });

  it("reads full macro and enrichment coverage on live data (enrichment complete)", () => {
    const { library, catalog } = loadLiveData();
    const cov = coverageReport(library, catalog);
    // Every macro-relevant catalog row carries macros (slice 2.2 onward).
    expect(cov.macroRelevantCount).toBeGreaterThan(0);
    expect(cov.macroRelevantWithMacros).toBe(cov.macroRelevantCount);
    // The B1 enrichment track is complete: every active dish carries a
    // description, recipe, and complexity. This now guards that the library
    // STAYS fully enriched — a new dish shipped without these (expansion dishes
    // are meant to ship complete) would drop a count below activeDishCount and
    // fail here.
    expect(cov.withDescription).toBe(cov.activeDishCount);
    expect(cov.withRecipe).toBe(cov.activeDishCount);
    expect(cov.withComplexity).toBe(cov.activeDishCount);
    // Photos are a separate (B2) track. The data/photos-5 run regenerated every
    // active dish from a rewritten candid-home-photo prompt (replacing the prior
    // styled/CGI look) and force-overwrote the whole library, so coverage is
    // complete: 250 of 250 active dishes carry a photo. This snapshot tracks live
    // data; it is a report assertion, not a rule.
    expect(cov.withPhoto).toBe(250);
  });
});

describe("poolCoverageReport", () => {
  it("emits one row per slot per season and never throws on live data", () => {
    const { library } = loadLiveData();
    const pools = poolCoverageReport(library);
    const seasons = new Set(pools.map((p) => p.season));
    expect(seasons).toEqual(new Set(["Summer", "Monsoon", "Winter"]));
    // 20 slot rows per season (see the report's slot table).
    expect(pools.filter((p) => p.season === "Summer").length).toBe(20);
    // Counts are non-negative integers.
    for (const p of pools) expect(p.count).toBeGreaterThanOrEqual(0);
  });

  it("surfaces the Fruit pool from live data", () => {
    // The expansion-0 batch deepened this slot from 1 to 3 candidates
    // (Seasonal fruit, Banana bowl, Papaya bowl). The report tracks live data;
    // the assertion is the post-expansion floor, not the old thin baseline.
    const { library } = loadLiveData();
    const pools = poolCoverageReport(library);
    const fruit = pools.find((p) => p.season === "Summer" && p.slot.includes("fruit"));
    expect(fruit).toBeDefined();
    expect(fruit!.count).toBe(3);
  });
});

describe("hpProteinConsistencyReport", () => {
  const catalogWithMacros: CatalogIngredient[] = [
    { ingredient: "Chicken", group: "Proteins and Dairy", unit: "g", proteinPer100g: 25, special: false },
    {
      ingredient: "Potato",
      group: "Vegetables",
      unit: "g",
      proteinPer100g: 2,
      carbsPer100g: 17,
      special: false,
    },
  ];

  function row(dishId: number, ingredient: string, quantity: number): Ingredient {
    return { dishId, dishName: "x", ingredient, quantity, unit: "g" };
  }

  it("surfaces drift on live data now that macros are populated (post-2.2)", () => {
    const { library, ingredients, catalog } = loadLiveData();
    // Slice 2.2 populated the catalog macros, so the report now speaks: it lists
    // dishes whose derived per-person protein disagrees with their HP tag. This is
    // information for the slow loop, not a blocking failure; the HP tag stays the
    // rule input. Every flagged dish carries a real (non-negative) derived protein.
    const drift = hpProteinConsistencyReport(library, ingredients, catalog);
    expect(drift.length).toBeGreaterThan(0);
    for (const d of drift) {
      expect(d.threshold).toBe(HP_PROTEIN_THRESHOLD_PER_PERSON);
      expect(d.proteinPerPerson).toBeGreaterThanOrEqual(0);
      // A flagged dish disagrees with its tag: HP-tagged below threshold, or
      // above threshold without the tag.
      expect(d.hasHpTag).toBe(d.proteinPerPerson < HP_PROTEIN_THRESHOLD_PER_PERSON);
    }
  });

  it("flags an HP-tagged dish whose derived protein is below the threshold", () => {
    // 100 g potato -> dish protein 2 g -> per person 1 g, far below threshold.
    const dishes: Dish[] = [dish({ id: 1, name: "Low protein", tags: ["HP"] })];
    const ingredients = [row(1, "Potato", 100)];
    const drift = hpProteinConsistencyReport(dishes, ingredients, catalogWithMacros);
    expect(drift).toHaveLength(1);
    expect(drift[0].hasHpTag).toBe(true);
    expect(drift[0].proteinPerPerson).toBeLessThan(HP_PROTEIN_THRESHOLD_PER_PERSON);
  });

  it("flags a high-protein dish that lacks the HP tag", () => {
    // 400 g chicken -> dish protein 100 g -> per person 50 g, well above threshold.
    const dishes: Dish[] = [dish({ id: 2, name: "High protein no tag", tags: [] })];
    const ingredients = [row(2, "Chicken", 400)];
    const drift = hpProteinConsistencyReport(dishes, ingredients, catalogWithMacros);
    expect(drift).toHaveLength(1);
    expect(drift[0].hasHpTag).toBe(false);
    expect(drift[0].proteinPerPerson).toBeGreaterThanOrEqual(HP_PROTEIN_THRESHOLD_PER_PERSON);
  });

  it("does not flag a consistent HP dish", () => {
    const dishes: Dish[] = [dish({ id: 3, name: "Consistent HP", tags: ["HP"] })];
    const ingredients = [row(3, "Chicken", 400)];
    const drift = hpProteinConsistencyReport(dishes, ingredients, catalogWithMacros);
    expect(drift).toEqual([]);
  });
});

describe("specialSourcingReport", () => {
  // Catalog mirrors the narrowed special set: only Tahini, Parsley and Bulgur
  // Wheat need a special trip. Olive Oil, Chickpea and Onion are regular.
  const catalog: CatalogIngredient[] = [
    { ingredient: "Tahini", group: "Pantry", unit: "g", special: true },
    { ingredient: "Bulgur Wheat", group: "Pantry", unit: "g", special: true },
    { ingredient: "Parsley", group: "Aromatics and Herbs", unit: "g", special: true },
    { ingredient: "Olive Oil", group: "Pantry", unit: "ml", special: false },
    { ingredient: "Chickpea", group: "Pantry", unit: "g", special: false },
    { ingredient: "Onion", group: "Aromatics and Herbs", unit: "g", special: false },
  ];

  function row(dishId: number, ingredient: string, quantity: number): Ingredient {
    return { dishId, dishName: "x", ingredient, quantity, unit: "g" };
  }

  it("lists, per active dish, the special-sourcing ingredients it uses (sorted)", () => {
    const dishes: Dish[] = [
      dish({ id: 1, name: "Hummus" }),
      dish({ id: 2, name: "Plain dal" }),
    ];
    const ingredients = [
      row(1, "Chickpea", 200),
      row(1, "Tahini", 30),
      // Olive Oil is now a regular ingredient, so it must NOT be flagged.
      row(1, "Olive Oil", 15),
      row(2, "Onion", 80),
    ];
    const report = specialSourcingReport(dishes, ingredients, catalog);
    // Only dish 1 uses a special ingredient (Tahini); dish 2 (all regular) is
    // omitted, and Olive Oil drops out of dish 1's set.
    expect(report).toEqual([
      { dishId: 1, dishName: "Hummus", ingredients: ["Tahini"] },
    ]);
  });

  it("omits inactive dishes even when they use a special ingredient", () => {
    const dishes: Dish[] = [dish({ id: 1, name: "Inactive", active: "No" })];
    const ingredients = [row(1, "Tahini", 30)];
    expect(specialSourcingReport(dishes, ingredients, catalog)).toEqual([]);
  });

  it("deduplicates a special ingredient repeated across rows", () => {
    const dishes: Dish[] = [dish({ id: 1, name: "Double tahini" })];
    const ingredients = [row(1, "Tahini", 30), row(1, "Tahini", 10)];
    const report = specialSourcingReport(dishes, ingredients, catalog);
    expect(report).toEqual([{ dishId: 1, dishName: "Double tahini", ingredients: ["Tahini"] }]);
  });

  it("flags exactly the special-ingredient dishes on live data (narrow special set)", () => {
    const { library, ingredients, catalog: liveCatalog } = loadLiveData();
    const report = specialSourcingReport(library, ingredients, liveCatalog);

    // The special set is kept deliberately narrow: only ingredients a regular
    // Bangalore sabziwala/kirana does not stock. Tahini, Parsley and Bulgur
    // Wheat carry over from the Lebanese batch; Gochujang and Pomegranate
    // Molasses are the world-cuisine batch's additions (Korean chilli paste and
    // a Levantine pomegranate syrup, both supermarket/specialty-store items);
    // Miso Paste is the expansion-3 addition (fermented Japanese soybean paste,
    // a supermarket/specialty-store item). Everything else (incl. Olive Oil,
    // Mozzarella, Tofu, Basil, Pasta, Spaghetti, Feta, Couscous, Tortilla, Soy
    // Sauce, Sesame Oil, Avocado, Honey, Lemongrass) is regular Bangalore
    // sourcing. This guards the catalog: if a row is silently re-marked Yes,
    // this set widens and fails.
    const specialNames = new Set(liveCatalog.filter((c) => c.special).map((c) => c.ingredient));
    expect(specialNames).toEqual(
      new Set([
        "Tahini",
        "Parsley",
        "Bulgur Wheat",
        "Gochujang",
        "Pomegranate Molasses",
        "Miso Paste",
      ]),
    );

    // Every flagged dish names a non-empty set that all resolve to special rows.
    for (const d of report) {
      expect(d.ingredients.length).toBeGreaterThan(0);
      for (const name of d.ingredients) expect(specialNames.has(name)).toBe(true);
    }

    // The active dishes needing a special trip, with their precise sets:
    //   Hummus -> Tahini; Tabbouleh -> Bulgur Wheat + Parsley (sorted);
    //   Muhammara -> Pomegranate Molasses; Tofu bibimbap + Korean chicken
    //   stir fry + Korean tofu soup -> Gochujang; Japanese miso soup ->
    //   Miso Paste; Vegetable daliya -> Bulgur Wheat; Lentil salad ->
    //   Parsley (the last two from the activated easy-to-cook expansion).
    expect(report).toEqual([
      { dishId: 174, dishName: "Hummus", ingredients: ["Tahini"] },
      { dishId: 176, dishName: "Tabbouleh", ingredients: ["Bulgur Wheat", "Parsley"] },
      { dishId: 184, dishName: "Muhammara", ingredients: ["Pomegranate Molasses"] },
      { dishId: 191, dishName: "Tofu bibimbap", ingredients: ["Gochujang"] },
      { dishId: 192, dishName: "Korean chicken stir fry", ingredients: ["Gochujang"] },
      { dishId: 208, dishName: "Korean tofu soup", ingredients: ["Gochujang"] },
      { dishId: 210, dishName: "Japanese miso soup", ingredients: ["Miso Paste"] },
      { dishId: 250, dishName: "Vegetable daliya", ingredients: ["Bulgur Wheat"] },
      { dishId: 267, dishName: "Lentil salad", ingredients: ["Parsley"] },
    ]);

    // Staple Indian dishes and the regular-sourcing international dishes (pasta,
    // caprese/mozzarella, tofu curry, basil, the new Mexican/Greek bowls) are
    // NOT flagged.
    const flaggedNames = new Set(report.map((d) => d.dishName));
    for (const name of [
      "Pesto pasta",
      "Caprese salad",
      "Thai red curry tofu",
      "Thai basil chicken",
      "Greek salad",
      "Black bean quesadilla",
    ]) {
      expect(flaggedNames.has(name)).toBe(false);
    }
  });
});
