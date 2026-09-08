import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExploreFilters } from "../src/components/ExploreFilters.js";
import { HEALTHY_FILTER_AVAILABLE } from "../src/lib/healthy.js";
import { PICKER_FILTERS } from "../src/lib/dishFilters.js";

describe("incomplete recipe nutrition in filters", () => {
  it("explains and disables the unavailable Explore filter and omits it in fruit pickers", () => {
    expect(HEALTHY_FILTER_AVAILABLE).toBe(false);
    expect(PICKER_FILTERS).not.toContain("Healthy");
    const html = renderToStaticMarkup(
      createElement(ExploreFilters, {
        state: { easy: false, healthy: false, cuisines: [], mealTimes: [] },
        onChange: () => {},
        pool: [],
      }),
    );
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Healthy \(under review\)<\/button>/);
    expect(html).toContain("Recipe nutrition is under review");
  });
});
