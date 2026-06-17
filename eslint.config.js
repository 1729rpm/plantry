import js from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default [
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.convex/**",
      "**/_generated/**",
      "**/coverage/**",
      "**/*.config.js",
      "**/*.config.ts",
      "design_handoff/**",
      // Design-handoff reference code (the hifi-*.jsx prototypes and hifi-data.js)
      // ships inside the active feature folder under features/<name>/. It is a
      // browser-context reference, not build code, so it is not linted (the same
      // exclusion design_handoff/ had under the previous handoff model).
      "features/**/*.jsx",
      "features/**/*.js",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["app/web/**/*.{ts,tsx}"],
    plugins: {
      react,
      "react-hooks": reactHooks,
    },
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
    },
  },
  {
    files: ["engine/**/*.ts", "app/convex/**/*.ts"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    files: ["scripts/**/*.{js,mjs,cjs}"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
];
