// One-shot migration (Stream E, item 5): add a first-class `cuisine` field to
// every per-dish file and remove the now-redundant cuisine tokens from `tags`.
//
// Source of truth choice (a): the cuisine field becomes authoritative; the
// cuisine tokens are removed from `tags` so there is no dual source. Functional
// tags (HP, complete_meal, complete_carb, fruit) stay.
//
// Mapping from the existing cuisine token to the display cuisine name:
//   - chinese -> Chinese, italian -> Italian, mexican -> Mexican,
//     spanish -> Spanish, korean -> Korean, japanese -> Japanese,
//     vietnamese -> Vietnamese, lebanese -> Lebanese, continental -> Continental
//   - oriental -> Thai (every `oriental` dish is Thai; matches the photo tool's
//     existing oriental -> Thai map)
//   - greek, mediterranean (dual tag) -> Greek (greek is the more specific
//     cuisine; all dual-tagged dishes are Greek dishes)
//   - mediterranean (alone) -> Mediterranean
//   - no cuisine token -> Indian (the untagged originals, incl. the fruit bowls)
// Slug override: singapore-noodles is tagged `oriental` but is Chinese-Malay, so
// it is pinned to Chinese (matches the photo tool's existing slug override).
//
// Run once from the repo root: node scripts/migrate-cuisine-field.mjs
// Idempotent-ish: a file that already has a `cuisine:` line is left untouched.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const dishesDir = resolve(here, "../data/dishes");

// Cuisine tokens that currently live in `tags`, mapped to the display cuisine.
const TOKEN_TO_CUISINE = {
  chinese: "Chinese",
  italian: "Italian",
  mexican: "Mexican",
  spanish: "Spanish",
  korean: "Korean",
  japanese: "Japanese",
  vietnamese: "Vietnamese",
  lebanese: "Lebanese",
  continental: "Continental",
  greek: "Greek",
  mediterranean: "Mediterranean",
  oriental: "Thai",
};
const CUISINE_TOKENS = new Set(Object.keys(TOKEN_TO_CUISINE));
// `fruit` is a functional tag (Fruit-of-the-day candidate, engine.md §3.3), not
// a cuisine; it stays in tags and never sets the cuisine.
const SLUG_OVERRIDES = {
  "singapore-noodles": "Chinese",
};

/** Resolve a single cuisine from the set of cuisine tokens on a dish. */
function resolveCuisine(slug, cuisineTokens) {
  if (SLUG_OVERRIDES[slug]) return SLUG_OVERRIDES[slug];
  if (cuisineTokens.length === 0) return "Indian";
  // Dual-tag resolution: when both greek and mediterranean are present, greek
  // wins (more specific). In general, prefer the most-specific named cuisine
  // over the generic "mediterranean" bucket.
  if (cuisineTokens.includes("greek")) return "Greek";
  const specific = cuisineTokens.find((t) => t !== "mediterranean");
  return TOKEN_TO_CUISINE[specific ?? cuisineTokens[0]];
}

const files = readdirSync(dishesDir).filter((f) => f.endsWith(".md"));
const summary = new Map();
let changed = 0;

for (const file of files) {
  const slug = file.replace(/\.md$/, "");
  const path = resolve(dishesDir, file);
  let raw = readFileSync(path, "utf8");

  if (/^cuisine:\s*/m.test(raw)) {
    // Already migrated; just tally for the report.
    const m = raw.match(/^cuisine:\s*(.+)$/m);
    if (m) summary.set(m[1].trim(), (summary.get(m[1].trim()) ?? 0) + 1);
    continue;
  }

  const tagsMatch = raw.match(/^tags:\s*\[(.*)\]\s*$/m);
  if (!tagsMatch) throw new Error(`${slug}: no tags line found`);
  const tags = tagsMatch[1]
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const cuisineTokens = tags.filter((t) => CUISINE_TOKENS.has(t));
  const keptTags = tags.filter((t) => !CUISINE_TOKENS.has(t));
  const cuisine = resolveCuisine(slug, cuisineTokens);

  // Rewrite the tags line (drop cuisine tokens) and insert the cuisine line
  // right after the seasons line. Both match the serializer's emitted format.
  raw = raw.replace(/^tags:\s*\[.*\]\s*$/m, `tags: [${keptTags.join(", ")}]`);
  raw = raw.replace(/^(seasons:\s*.+)$/m, `$1\ncuisine: ${cuisine}`);

  writeFileSync(path, raw);
  changed += 1;
  summary.set(cuisine, (summary.get(cuisine) ?? 0) + 1);
}

const rows = [...summary.entries()].sort((a, b) => b[1] - a[1]);
console.log(`migrate-cuisine-field: updated ${changed} of ${files.length} dish files`);
for (const [cuisine, count] of rows) console.log(`  ${cuisine}: ${count}`);
