import { describe, it, expect } from "vitest";
import { DishSchema } from "../../src/data/schemas.js";

// A minimal dish that conforms to the documented closed sets (docs/engine.md
// §12). Each test clones this and perturbs only the field under test.
const validDish = {
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
} as const;

describe("DishSchema closed-set enforcement (docs/engine.md §12)", () => {
  it("parses a valid dish with documented tags and cuisine", () => {
    expect(() => DishSchema.parse(validDish)).not.toThrow();
  });

  it("parses every documented tag", () => {
    const tags = ["HP", "complete_meal", "complete_carb", "fruit"];
    expect(() => DishSchema.parse({ ...validDish, tags })).not.toThrow();
  });

  it("rejects an unknown tag (a mistyped rule input must fail the build)", () => {
    expect(() => DishSchema.parse({ ...validDish, tags: ["HoP"] })).toThrow();
  });

  it("rejects an unknown cuisine (a typo must fail the build)", () => {
    expect(() => DishSchema.parse({ ...validDish, cuisine: "Itallian" })).toThrow();
  });
});
