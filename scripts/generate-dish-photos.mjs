#!/usr/bin/env node
// AI dish-photo generation pipeline (design-revamp B2.2). Reads dish files under
// data/dishes/<slug>.md, fills the cuisine-aware prompt from data/dish-photos/STYLE.md
// per dish, calls the Google Gemini image-generation API, converts the result to a
// web-ready square JPEG via macOS `sips` (no npm image library, per STYLE.md), writes
// data/dish-photos/<slug>.jpg, and sets the dish file's `photo:` frontmatter so the
// image and its declared field always land together.
//
// The API key is read from the GEMINI_API_KEY env var. NEVER hardcode or commit it.
// Load it before running:
//   export GEMINI_API_KEY=$(grep '^GEMINI_API_KEY=' "/Users/rajatmugdal/Downloads/AI Products/ALL_KEYS.md" | cut -d= -f2-)
//
// Usage:
//   node scripts/generate-dish-photos.mjs <slug> [<slug> ...]   # generate named dishes
//   node scripts/generate-dish-photos.mjs --one <slug>          # single fail-fast probe
//   node scripts/generate-dish-photos.mjs --dry-run <slug>      # print the prompt only
//
// Output spec (STYLE.md): square 1:1, ~1024x1024, JPEG, under ~300 KB.

import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const dishesDir = resolve(repoRoot, "data", "dishes");
const photosDir = resolve(repoRoot, "data", "dish-photos");

// Gemini image model. gemini-2.5-flash-image (GA "Nano Banana") is on the AI
// Studio free tier and supports generateContent. The preview alias named in the
// brief (gemini-2.5-flash-image-preview) is not listed on this key; the GA name
// is the same model. Fallback kept for older keys/tiers.
const PRIMARY_MODEL = "gemini-2.5-flash-image";
const FALLBACK_MODEL = "gemini-2.0-flash-preview-image-generation";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const MAX_BYTES = 300 * 1024; // STYLE.md: "well under ~300 KB"
const TARGET_PX = 1024;

// --- Cuisine map: single source of truth is data/dish-photos/STYLE.md. This
// mirrors that table; STYLE.md owns it and any new tag is added there first.
const CUISINE_MAP = {
  italian: { adj: "Italian", article: "an" },
  chinese: { adj: "Chinese", article: "a" },
  mexican: { adj: "Mexican", article: "a" },
  greek: { adj: "Greek", article: "a" },
  spanish: { adj: "Spanish", article: "a" },
  korean: { adj: "Korean", article: "a" },
  japanese: { adj: "Japanese", article: "a" },
  continental: { adj: "Continental", article: "a" },
  vietnamese: { adj: "Vietnamese", article: "a" },
  lebanese: { adj: "Lebanese", article: "a" },
  mediterranean: { adj: "Mediterranean", article: "a" },
  oriental: { adj: "Thai", article: "a" },
};
const FUNCTIONAL_TAGS = new Set(["HP", "complete_meal", "complete_carb", "fruit"]);
// Slug-level override (STYLE.md): Singapore noodles is Singaporean/Chinese-Malay,
// not Thai, so it drops the cuisine adjective rather than be mislabelled.
const NEUTRAL_CUISINE_SLUGS = new Set(["singapore-noodles"]);

/** Build the cuisine phrase slot ("a Thai home-cooked dish" / "an Indian home-cooked dish"). */
function cuisinePhrase(slug, tags) {
  if (NEUTRAL_CUISINE_SLUGS.has(slug)) return "a home-cooked dish";
  for (const tag of tags) {
    if (FUNCTIONAL_TAGS.has(tag)) continue;
    const hit = CUISINE_MAP[tag];
    if (hit) return `${hit.article} ${hit.adj} home-cooked dish`;
  }
  // No cuisine tag -> Indian (the untagged originals).
  return "an Indian home-cooked dish";
}

/** Minimal dish-file read: frontmatter name + tags, and the first body paragraph. */
function readDish(slug) {
  const path = resolve(dishesDir, `${slug}.md`);
  if (!existsSync(path)) throw new Error(`dish file not found: ${path}`);
  const raw = readFileSync(path, "utf8");
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`dish "${slug}": no frontmatter block`);
  const [, fm, body] = m;

  const nameLine = fm.match(/^name:\s*(.+)$/m);
  if (!nameLine) throw new Error(`dish "${slug}": no name field`);
  const name = nameLine[1].trim();

  const tagsLine = fm.match(/^tags:\s*\[(.*)\]\s*$/m);
  const tags = tagsLine
    ? tagsLine[1]
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  const hasPhoto = /^photo:\s*.+$/m.test(fm);

  // First body paragraph = the one-line description (prose before `## Ingredients`).
  const firstPara = body
    .trim()
    .split(/\n\s*\n/)[0]
    .trim();
  if (!firstPara || firstPara.startsWith("##")) {
    throw new Error(`dish "${slug}": no description paragraph`);
  }
  // Trim to a phrase: drop a trailing period for clean nesting in the parens.
  const description = firstPara.replace(/\.$/, "");

  return { path, raw, name, tags, description, hasPhoto };
}

/** Fill the frozen STYLE.md prompt. Only the three slots vary. */
function buildPrompt(slug, name, tags, description) {
  const cuisine = cuisinePhrase(slug, tags);
  return (
    `A single appetizing serving of ${name}, ${cuisine} ` +
    `(${description}), photographed from directly overhead (flat lay, 90-degree ` +
    `top-down). The dish is plated in or on simple matte stoneware in a warm cream or ` +
    `soft terracotta tone, centered in the frame with even space on all sides. ` +
    `Set on a plain warm-cream linen or matte ceramic surface with no visible table ` +
    `edge, no other plates, no cutlery, no hands, no text, no garnish clutter; at most ` +
    `one small, quiet prop (a folded cream napkin corner or a single spice bowl) only ` +
    `if the frame would otherwise feel empty. Soft, diffuse natural daylight from the ` +
    `upper left, gentle shadows, no harsh highlights, no flash. Warm, inviting, ` +
    `slightly muted home-kitchen color, true to how the dish actually looks when ` +
    `cooked at home (not glossy restaurant styling, not oversaturated). The food fills ` +
    `roughly the central two-thirds of a square frame with comfortable headroom on ` +
    `every edge. Sharp focus on the food, shallow background blur. Realistic ` +
    `photographic style, natural food textures. Square 1:1 composition.`
  );
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Call Gemini generateContent; return base64 image data, or throw. Retries 429. */
async function generateImage(model, prompt, apiKey) {
  const url = `${API_BASE}/${model}:generateContent`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ["IMAGE"] },
  };
  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(body),
    });
    if (res.status === 429 || res.status === 503) {
      const backoff = Math.min(60000, 2000 * 2 ** (attempt - 1));
      console.warn(
        `  rate-limited (${res.status}), backoff ${backoff}ms (attempt ${attempt}/${maxAttempts})`,
      );
      await sleep(backoff);
      continue;
    }
    const json = await res.json();
    if (!res.ok) {
      throw new Error(`Gemini ${model} HTTP ${res.status}: ${JSON.stringify(json).slice(0, 400)}`);
    }
    const parts = json?.candidates?.[0]?.content?.parts ?? [];
    const imgPart = parts.find((p) => p.inlineData?.data);
    if (!imgPart) {
      throw new Error(
        `Gemini ${model}: no image in response: ${JSON.stringify(json).slice(0, 400)}`,
      );
    }
    return imgPart.inlineData.data;
  }
  throw new Error(`Gemini ${model}: exhausted retries (rate-limited)`);
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: "utf8" });
  if (r.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed: ${r.stderr || r.stdout}`);
  }
  return r.stdout;
}

/** Convert a raw model image (PNG/JPEG) to a square ~1024px JPEG under MAX_BYTES via sips. */
function toWebReadyJpeg(rawPath, outPath) {
  // Square center crop first (sips -c uses the smaller dimension when given the
  // square target), then resize the longest side to TARGET_PX, then format/quality.
  const dims = run("sips", ["-g", "pixelWidth", "-g", "pixelHeight", rawPath]);
  const w = Number(dims.match(/pixelWidth:\s*(\d+)/)?.[1]);
  const h = Number(dims.match(/pixelHeight:\s*(\d+)/)?.[1]);
  const side = Math.min(w, h);
  // Center-crop to square.
  run("sips", ["-c", String(side), String(side), rawPath, "--out", outPath]);
  // Resize to target and set JPEG with a starting quality; step down if over budget.
  for (const q of [80, 70, 60, 50, 40]) {
    run("sips", [
      "-s",
      "format",
      "jpeg",
      "-Z",
      String(TARGET_PX),
      "-s",
      "formatOptions",
      String(q),
      outPath,
      "--out",
      outPath,
    ]);
    if (statSync(outPath).size <= MAX_BYTES) return q;
  }
  return 40; // last attempt stands; size reported by caller
}

/** Set or insert the `photo:` frontmatter line, preserving all other bytes. */
function setPhotoField(slug, raw, photoFilename) {
  if (/^photo:\s*.+$/m.test(raw)) {
    return raw.replace(/^photo:\s*.+$/m, `photo: ${photoFilename}`);
  }
  // Insert in the serializer's fixed order: after prePrep if present, else after
  // buySpecially/equipment/skill/complexity, else just before the closing `---`.
  const fmMatch = raw.match(/^(---\n[\s\S]*?\n)(---\n)/);
  if (!fmMatch) throw new Error(`dish "${slug}": cannot locate frontmatter to insert photo`);
  const [, fmBlock, closeFence] = fmMatch;
  const rest = raw.slice(fmBlock.length + closeFence.length);
  // The photo line is last in the enrichment order, so append at the end of the
  // frontmatter block (just before the closing fence).
  const newFm = fmBlock + `photo: ${photoFilename}\n`;
  return newFm + closeFence + rest;
}

async function processDish(slug, apiKey, model) {
  const { path, raw, name, tags, description, hasPhoto } = readDish(slug);
  const prompt = buildPrompt(slug, name, tags, description);
  console.log(`\n[${slug}] ${name}`);
  console.log(`  cuisine slot: ${cuisinePhrase(slug, tags)}`);
  if (process.argv.includes("--dry-run")) {
    console.log(`  prompt: ${prompt}`);
    return;
  }
  if (!existsSync(photosDir)) mkdirSync(photosDir, { recursive: true });

  const b64 = await generateImage(model, prompt, apiKey);
  const rawPath = resolve(photosDir, `.${slug}.raw`);
  const outPath = resolve(photosDir, `${slug}.jpg`);
  writeFileSync(rawPath, Buffer.from(b64, "base64"));
  try {
    const q = toWebReadyJpeg(rawPath, outPath);
    const bytes = statSync(outPath).size;
    const dims = run("sips", ["-g", "pixelWidth", "-g", "pixelHeight", outPath]);
    const ow = dims.match(/pixelWidth:\s*(\d+)/)?.[1];
    const oh = dims.match(/pixelHeight:\s*(\d+)/)?.[1];
    console.log(`  wrote ${slug}.jpg: ${ow}x${oh}, ${(bytes / 1024).toFixed(0)} KB, q=${q}`);
    if (bytes > MAX_BYTES)
      console.warn(`  WARNING: ${slug}.jpg over ${MAX_BYTES} bytes (${bytes})`);
    if (ow !== oh) console.warn(`  WARNING: ${slug}.jpg not square (${ow}x${oh})`);
  } finally {
    rmSync(rawPath, { force: true });
  }

  // Set the photo: frontmatter (image + field land together).
  if (!hasPhoto) {
    writeFileSync(path, setPhotoField(slug, raw, `${slug}.jpg`));
    console.log(`  set photo: ${slug}.jpg in ${slug}.md`);
  } else {
    console.log(`  photo: field already present in ${slug}.md (left as-is)`);
  }
}

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (args.length === 0) {
    console.error(
      "usage: node scripts/generate-dish-photos.mjs [--one|--dry-run] <slug> [<slug> ...]",
    );
    process.exit(1);
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey && !process.argv.includes("--dry-run")) {
    console.error("GEMINI_API_KEY not set. See header comment for how to load it.");
    process.exit(1);
  }

  const slugs = process.argv.includes("--one") ? [args[0]] : args;
  let model = PRIMARY_MODEL;
  for (let i = 0; i < slugs.length; i += 1) {
    const slug = slugs[i];
    try {
      await processDish(slug, apiKey, model);
    } catch (err) {
      // On a first-dish model failure, try the fallback model once.
      if (model === PRIMARY_MODEL && /HTTP 40[04]|not found|no image/.test(String(err))) {
        console.warn(`  ${PRIMARY_MODEL} failed (${err.message}); trying ${FALLBACK_MODEL}`);
        model = FALLBACK_MODEL;
        await processDish(slug, apiKey, model);
      } else {
        throw err;
      }
    }
    // Pace requests (free-tier throttle).
    if (i < slugs.length - 1) await sleep(4000);
  }
  console.log(`\nDone. Model used: ${model}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
