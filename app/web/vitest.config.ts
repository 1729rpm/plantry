import { defineConfig } from "vitest/config";

// Unit tests for the frontend's pure view helpers (lib/). The PWA itself is
// exercised by the smoke and full-flow crawl harnesses; this config covers the
// small pure functions that turn library structure into display, which are
// cheap to test in isolation and easy to regress.
export default defineConfig({
  test: {
    globals: true,
    include: ["test/**/*.test.ts"],
  },
});
