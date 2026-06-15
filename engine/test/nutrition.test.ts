import { describe, it, expect } from "vitest";
import {
  deriveDishMacros,
  proteinToCarbRatio,
  isHealthy,
  HOUSEHOLD_SERVINGS,
  ATWATER_PROTEIN_KCAL_PER_G,
  ATWATER_CARBS_KCAL_PER_G,
  ATWATER_FAT_KCAL_PER_G,
  HEALTHY_PROTEIN_CALORIE_FRACTION,
  HEALTHY_FIBER_PER_PERSON,
} from "../src/nutrition.js";
import type { CatalogIngredient, Ingredient } from "../src/data/schemas.js";

function ing(ingredient: string, quantity: number, unit: "g" | "ml" | "pcs"): Ingredient {
  return { dishId: 1, dishName: "Test dish", ingredient, quantity, unit };
}

describe("deriveDishMacros", () => {
  it("derives per-person protein and carbs as sum(grams x per100g / 100) / 2", () => {
    const catalog: CatalogIngredient[] = [
      {
        ingredient: "Paneer",
        group: "Proteins and Dairy",
        unit: "g",
        proteinPer100g: 18,
        carbsPer100g: 4,
        special: false,
      },
      {
        ingredient: "Rice",
        group: "Pantry",
        unit: "g",
        proteinPer100g: 7,
        carbsPer100g: 78,
        special: false,
      },
    ];
    const rows = [ing("Paneer", 200, "g"), ing("Rice", 100, "g")];
    const macros = deriveDishMacros(rows, catalog);

    // Dish total protein = 200*18/100 + 100*7/100 = 36 + 7 = 43; per person = 21.5.
    expect(macros.proteinPerPerson).toBeCloseTo(21.5, 10);
    // Dish total carbs = 200*4/100 + 100*78/100 = 8 + 78 = 86; per person = 43.
    expect(macros.carbsPerPerson).toBeCloseTo(43, 10);
    expect(macros.proteinToCarbRatio).toBeCloseTo(21.5 / 43, 10);
  });

  it("divides the dish total by the household serving count (two)", () => {
    expect(HOUSEHOLD_SERVINGS).toBe(2);
    const catalog: CatalogIngredient[] = [
      {
        ingredient: "Chicken",
        group: "Proteins and Dairy",
        unit: "g",
        proteinPer100g: 25,
        carbsPer100g: 0,
        special: false,
      },
    ];
    // 100 g chicken -> dish total 25 g protein -> per person 12.5 g.
    const macros = deriveDishMacros([ing("Chicken", 100, "g")], catalog);
    expect(macros.proteinPerPerson).toBeCloseTo(12.5, 10);
    expect(macros.carbsPerPerson).toBe(0);
    // Carbs zero -> ratio undefined -> null.
    expect(macros.proteinToCarbRatio).toBeNull();
  });

  it("converts pcs ingredients to grams via Grams per piece", () => {
    const catalog: CatalogIngredient[] = [
      {
        ingredient: "Egg",
        group: "Proteins and Dairy",
        unit: "pcs",
        gramsPerPiece: 50,
        proteinPer100g: 13,
        carbsPer100g: 1,
        special: false,
      },
    ];
    // 2 eggs -> 100 g -> protein 13, carbs 1 (dish total); per person 6.5 and 0.5.
    const macros = deriveDishMacros([ing("Egg", 2, "pcs")], catalog);
    expect(macros.proteinPerPerson).toBeCloseTo(6.5, 10);
    expect(macros.carbsPerPerson).toBeCloseTo(0.5, 10);
  });

  it("converts ml ingredients to grams 1:1 and composes with g and pcs rows", () => {
    const catalog: CatalogIngredient[] = [
      {
        ingredient: "Milk",
        group: "Proteins and Dairy",
        unit: "ml",
        proteinPer100g: 3.4,
        carbsPer100g: 5,
        special: false,
      },
      {
        ingredient: "Rice",
        group: "Pantry",
        unit: "g",
        proteinPer100g: 7,
        carbsPer100g: 78,
        special: false,
      },
      {
        ingredient: "Egg",
        group: "Proteins and Dairy",
        unit: "pcs",
        gramsPerPiece: 50,
        proteinPer100g: 13,
        carbsPer100g: 1,
        special: false,
      },
    ];
    // 200 ml milk -> 200 g (1:1) -> protein 6.8, carbs 10 (dish total).
    const milkOnly = deriveDishMacros([ing("Milk", 200, "ml")], catalog);
    expect(milkOnly.proteinPerPerson).toBeCloseTo((200 * 3.4) / 100 / 2, 10);
    expect(milkOnly.carbsPerPerson).toBeCloseTo((200 * 5) / 100 / 2, 10);

    // ml composes with g and pcs: milk 200 ml + rice 100 g + egg 2 pcs (100 g).
    const rows = [ing("Milk", 200, "ml"), ing("Rice", 100, "g"), ing("Egg", 2, "pcs")];
    const macros = deriveDishMacros(rows, catalog);
    // Dish total protein = 200*3.4/100 + 100*7/100 + 100*13/100 = 6.8 + 7 + 13 = 26.8.
    expect(macros.proteinPerPerson).toBeCloseTo(26.8 / 2, 10);
    // Dish total carbs = 200*5/100 + 100*78/100 + 100*1/100 = 10 + 78 + 1 = 89.
    expect(macros.carbsPerPerson).toBeCloseTo(89 / 2, 10);
  });

  it("treats a pcs ingredient with no Grams per piece as zero contribution", () => {
    const catalog: CatalogIngredient[] = [
      // Macros present but no gramsPerPiece: cannot weigh, contributes nothing.
      {
        ingredient: "Green Chilli",
        group: "Vegetables",
        unit: "pcs",
        proteinPer100g: 2,
        carbsPer100g: 9,
        special: false,
      },
    ];
    const macros = deriveDishMacros([ing("Green Chilli", 3, "pcs")], catalog);
    expect(macros.proteinPerPerson).toBe(0);
    expect(macros.carbsPerPerson).toBe(0);
    expect(macros.proteinToCarbRatio).toBeNull();
  });

  it("reads a blank (absent) macro as zero", () => {
    const catalog: CatalogIngredient[] = [
      // Onion has no macros in the catalog (blank cells): contributes zero.
      { ingredient: "Onion", group: "Aromatics and Herbs", unit: "g", special: false },
      {
        ingredient: "Paneer",
        group: "Proteins and Dairy",
        unit: "g",
        proteinPer100g: 18,
        special: false,
      },
    ];
    // Only Paneer contributes protein; Onion (blank) adds nothing; carbs all blank -> 0.
    const macros = deriveDishMacros([ing("Onion", 150, "g"), ing("Paneer", 200, "g")], catalog);
    expect(macros.proteinPerPerson).toBeCloseTo((200 * 18) / 100 / 2, 10);
    expect(macros.carbsPerPerson).toBe(0);
    expect(macros.proteinToCarbRatio).toBeNull();
  });

  it("treats an ingredient absent from the catalog as zero macros", () => {
    const macros = deriveDishMacros([ing("Mystery", 100, "g")], []);
    expect(macros.proteinPerPerson).toBe(0);
    expect(macros.carbsPerPerson).toBe(0);
  });

  it("returns zero macros for a dish with no ingredient rows", () => {
    const macros = deriveDishMacros([], []);
    expect(macros.proteinPerPerson).toBe(0);
    expect(macros.carbsPerPerson).toBe(0);
    expect(macros.proteinToCarbRatio).toBeNull();
  });

  it("an empty catalog derives zero macros and never throws", () => {
    // With no catalog rows, every ingredient resolves to zero macros. This guards
    // the blank-as-zero / absent-ingredient path on the derivation.
    // (Kept light: full live-data coverage numbers are the reports' job.)
    const catalog: CatalogIngredient[] = [];
    const macros = deriveDishMacros([ing("Anything", 500, "g")], catalog);
    expect(macros.proteinPerPerson).toBe(0);
  });
});

describe("deriveDishMacros: fat, fibre, calories", () => {
  it("derives per-person fat and fibre as sum(grams x per100g / 100) / 2", () => {
    const catalog: CatalogIngredient[] = [
      {
        ingredient: "Paneer",
        group: "Proteins and Dairy",
        unit: "g",
        proteinPer100g: 18,
        carbsPer100g: 4,
        fatPer100g: 20,
        fiberPer100g: 0,
        special: false,
      },
      {
        ingredient: "Chickpea",
        group: "Pantry",
        unit: "g",
        proteinPer100g: 19,
        carbsPer100g: 61,
        fatPer100g: 6,
        fiberPer100g: 17,
        special: false,
      },
    ];
    const rows = [ing("Paneer", 200, "g"), ing("Chickpea", 100, "g")];
    const macros = deriveDishMacros(rows, catalog);
    // Dish total fat = 200*20/100 + 100*6/100 = 40 + 6 = 46; per person = 23.
    expect(macros.fatPerPerson).toBeCloseTo(23, 10);
    // Dish total fibre = 200*0/100 + 100*17/100 = 17; per person = 8.5.
    expect(macros.fiberPerPerson).toBeCloseTo(8.5, 10);
  });

  it("derives calories via Atwater (4 protein, 4 carbs, 9 fat) per person", () => {
    const catalog: CatalogIngredient[] = [
      {
        ingredient: "Egg",
        group: "Proteins and Dairy",
        unit: "g",
        proteinPer100g: 13,
        carbsPer100g: 1,
        fatPer100g: 11,
        fiberPer100g: 0,
        special: false,
      },
    ];
    // 200 g egg -> dish protein 26, carbs 2, fat 22; per person 13, 1, 11.
    const macros = deriveDishMacros([ing("Egg", 200, "g")], catalog);
    const expected =
      ATWATER_PROTEIN_KCAL_PER_G * 13 + ATWATER_CARBS_KCAL_PER_G * 1 + ATWATER_FAT_KCAL_PER_G * 11;
    expect(macros.caloriesPerPerson).toBeCloseTo(expected, 10);
    // 4*13 + 4*1 + 9*11 = 52 + 4 + 99 = 155.
    expect(macros.caloriesPerPerson).toBeCloseTo(155, 10);
  });

  it("reads blank fat and fibre as zero (no calorie or fibre contribution)", () => {
    const catalog: CatalogIngredient[] = [
      // Only protein and carbs populated; fat and fibre blank -> zero.
      {
        ingredient: "Rice",
        group: "Pantry",
        unit: "g",
        proteinPer100g: 7,
        carbsPer100g: 78,
        special: false,
      },
    ];
    const macros = deriveDishMacros([ing("Rice", 100, "g")], catalog);
    expect(macros.fatPerPerson).toBe(0);
    expect(macros.fiberPerPerson).toBe(0);
    // calories = 4*3.5 + 4*39 + 9*0 = 14 + 156 = 170.
    expect(macros.caloriesPerPerson).toBeCloseTo(170, 10);
  });

  it("returns zero calories and not-healthy for a dish with no macro data", () => {
    const macros = deriveDishMacros([], []);
    expect(macros.fatPerPerson).toBe(0);
    expect(macros.fiberPerPerson).toBe(0);
    expect(macros.caloriesPerPerson).toBe(0);
    expect(macros.healthy).toBe(false);
  });
});

describe("deriveDishMacros: healthy flag", () => {
  it("flags a high-protein, high-fibre dish as healthy (both branches true)", () => {
    const catalog: CatalogIngredient[] = [
      {
        ingredient: "Soyabean Chunk",
        group: "Pantry",
        unit: "g",
        proteinPer100g: 52,
        carbsPer100g: 33,
        fatPer100g: 0.5,
        fiberPer100g: 13,
        special: false,
      },
    ];
    // 100 g soya -> per person P26, C16.5, fat 0.25, fibre 6.5.
    // calories = 4*26 + 4*16.5 + 9*0.25 = 104 + 66 + 2.25 = 172.25.
    // protein fraction = 104/172.25 ~ 0.60 >= 0.25; fibre 6.5 >= 3 -> healthy.
    const macros = deriveDishMacros([ing("Soyabean Chunk", 100, "g")], catalog);
    expect(macros.healthy).toBe(true);
  });

  it("is not healthy when protein fraction clears but fibre does not", () => {
    const catalog: CatalogIngredient[] = [
      // Lean protein, no fibre: protein fraction high, fibre zero.
      {
        ingredient: "Chicken Breast",
        group: "Proteins and Dairy",
        unit: "g",
        proteinPer100g: 31,
        carbsPer100g: 0,
        fatPer100g: 3.6,
        fiberPer100g: 0,
        special: false,
      },
    ];
    const macros = deriveDishMacros([ing("Chicken Breast", 200, "g")], catalog);
    // protein fraction is well above 0.25, but fibre is 0 < 3.
    const proteinFraction =
      (ATWATER_PROTEIN_KCAL_PER_G * macros.proteinPerPerson) / macros.caloriesPerPerson;
    expect(proteinFraction).toBeGreaterThanOrEqual(HEALTHY_PROTEIN_CALORIE_FRACTION);
    expect(macros.fiberPerPerson).toBeLessThan(HEALTHY_FIBER_PER_PERSON);
    expect(macros.healthy).toBe(false);
  });

  it("is not healthy when fibre clears but protein fraction does not", () => {
    const catalog: CatalogIngredient[] = [
      // High-fibre, carb-heavy: plenty of fibre, low protein share.
      {
        ingredient: "Oats",
        group: "Pantry",
        unit: "g",
        proteinPer100g: 13,
        carbsPer100g: 67,
        fatPer100g: 7,
        fiberPer100g: 10,
        special: false,
      },
    ];
    const macros = deriveDishMacros([ing("Oats", 100, "g")], catalog);
    const proteinFraction =
      (ATWATER_PROTEIN_KCAL_PER_G * macros.proteinPerPerson) / macros.caloriesPerPerson;
    expect(macros.fiberPerPerson).toBeGreaterThanOrEqual(HEALTHY_FIBER_PER_PERSON);
    expect(proteinFraction).toBeLessThan(HEALTHY_PROTEIN_CALORIE_FRACTION);
    expect(macros.healthy).toBe(false);
  });
});

describe("isHealthy", () => {
  it("requires both the protein-fraction and fibre thresholds", () => {
    // calories 200, protein fraction exactly at the threshold, fibre at threshold.
    const proteinAtThreshold =
      (HEALTHY_PROTEIN_CALORIE_FRACTION * 200) / ATWATER_PROTEIN_KCAL_PER_G;
    expect(isHealthy(proteinAtThreshold, 200, HEALTHY_FIBER_PER_PERSON)).toBe(true);
    // Just below either threshold -> not healthy.
    expect(isHealthy(proteinAtThreshold - 0.01, 200, HEALTHY_FIBER_PER_PERSON)).toBe(false);
    expect(isHealthy(proteinAtThreshold, 200, HEALTHY_FIBER_PER_PERSON - 0.01)).toBe(false);
  });

  it("is never healthy at zero calories (no false positives, division-safe)", () => {
    expect(isHealthy(0, 0, 0)).toBe(false);
    // Even with abundant fibre, zero calories means no macro data.
    expect(isHealthy(0, 0, 100)).toBe(false);
  });
});

describe("proteinToCarbRatio", () => {
  it("returns protein / carbs", () => {
    expect(proteinToCarbRatio(30, 60)).toBeCloseTo(0.5, 10);
  });

  it("is scale-invariant (per-person and dish-total give the same ratio)", () => {
    expect(proteinToCarbRatio(30, 60)).toBe(proteinToCarbRatio(15, 30));
  });

  it("returns null when carbs are zero", () => {
    expect(proteinToCarbRatio(30, 0)).toBeNull();
  });
});
