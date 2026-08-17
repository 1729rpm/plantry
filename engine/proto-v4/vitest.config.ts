import { defineConfig } from "vitest/config";

/**
 * Proto-v4 keeps its own vitest config so the engine's `npm test` glob
 * (`test/**\/*.test.ts`, rooted at `engine/`) never picks these tests up. v3's suite is
 * exactly as green as it was before this directory existed.
 */
export default defineConfig({
  test: {
    globals: true,
    root: __dirname,
    include: ["test/**/*.test.ts"],
  },
});
