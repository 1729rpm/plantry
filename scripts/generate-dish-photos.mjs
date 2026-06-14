#!/usr/bin/env node
// AI dish-photo generation pipeline (design-revamp B2.2). Reads dish files under
// data/dishes/<slug>.md, fills the cuisine-aware prompt from data/dish-photos/STYLE.md
// per dish, calls a text-to-image API, converts the result to a web-ready square
// JPEG via macOS `sips` (no npm image library, per STYLE.md), writes
// data/dish-photos/<slug>.jpg, and sets the dish file's `photo:` frontmatter so the
// image and its declared field always land together.
//
// Provider seam: the active provider is FLUX.1-dev via NVIDIA NIM (a JSON endpoint
// that returns the image as base64). The Hugging Face FLUX.1-schnell path is kept
// as a dormant fallback. The two providers share the prompt builder, the sips
// normalization, the write, and the `photo:` frontmatter step; only the network
// call differs. The active provider is selected by PROVIDER (default "nvidia").
//
// The API key is read from an env var. NEVER hardcode or commit it.
//   - nvidia (active): reads NVIDIA_API_KEY. Load it before running, e.g.:
//       export NVIDIA_API_KEY=$(grep -E '^[[:space:]]*(export[[:space:]]+)?NVIDIA_API_KEY=' \
//         "$HOME/.secrets/.env" | head -1 | sed -E 's/^[^=]*=//' | sed 's/#.*//' | tr -d '"' )
//   - hf (dormant fallback): reads HF_TOKEN.
//
// Usage:
//   node scripts/generate-dish-photos.mjs <slug> [<slug> ...]   # generate named dishes
//   node scripts/generate-dish-photos.mjs --all                 # force-regen EVERY active dish
//   node scripts/generate-dish-photos.mjs --one <slug>          # single fail-fast probe
//   node scripts/generate-dish-photos.mjs --dry-run <slug>      # print the prompt only
//   PROVIDER=hf node scripts/generate-dish-photos.mjs <slug>    # use the dormant HF path
//
// --all (alias --force) regenerates every active dish, OVERWRITING existing
// photos: the pipeline never skips a dish for already having a photo:.
//
// Generation runs a bounded concurrency pool (PHOTO_CONCURRENCY, default 6) gated
// by a client-side rate limiter (PHOTO_MAX_RPM, default 35, under NVIDIA's ~40/min
// free-tier cap), with exponential backoff + jitter on HTTP 429/500/503.
//
// Each dish gets its own base seed derived from its slug, so vessels, backgrounds,
// and angles vary across the library (variety is desired, not uniformity) while a
// re-run reproduces the same set. Set IMAGE_SEED to pin every dish to one seed
// (used to A/B a prompt change against a fixed composition).
//
// Output spec (STYLE.md): square 1:1, ~1024x1024, JPEG, under ~300 KB. The prompt
// aims for a real, candid food photo (cfg_scale 3.5, steps 40), not styled CGI:
// a natural angle, a real everyday vessel, an out-of-focus home context, and food
// that looks genuinely cooked and a little imperfect with correct per-type texture.

import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  statSync,
  rmSync,
  readdirSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { inflateSync as zlibInflateSync } from "node:zlib";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const dishesDir = resolve(repoRoot, "data", "dishes");
const photosDir = resolve(repoRoot, "data", "dish-photos");

// Active provider: FLUX.1-dev via NVIDIA NIM. A higher-fidelity (full, not
// distilled) FLUX model served on NVIDIA's hosted endpoint. The endpoint is a
// JSON POST that returns the image as base64 (NVIDIA NIM standard is
// `artifacts[].base64`; the parser below probes a few field shapes defensively).
const NVIDIA_URL = "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-dev";

// Dormant fallback: black-forest-labs/FLUX.1-schnell on Hugging Face (a distilled
// few-step model that returns raw image bytes). Selected with PROVIDER=hf.
const HF_MODEL = "black-forest-labs/FLUX.1-schnell";
const HF_ROUTER_URL = `https://router.huggingface.co/hf-inference/models/${HF_MODEL}`;
const HF_LEGACY_URL = `https://api-inference.huggingface.co/models/${HF_MODEL}`;

const PROVIDER = (process.env.PROVIDER || "nvidia").toLowerCase();
const MODEL = PROVIDER === "hf" ? HF_MODEL : "black-forest-labs/FLUX.1-dev (NVIDIA NIM)";

const MAX_BYTES = 295 * 1024; // STYLE.md: "well under ~300 KB" (strict, leaves headroom under 300 KB)
const TARGET_PX = 1024;
// Fixed default seed keeps runs reproducible; override per-dish re-rolls with IMAGE_SEED.
const DEFAULT_SEED = 7;
const SEED = process.env.IMAGE_SEED ? Number(process.env.IMAGE_SEED) : DEFAULT_SEED;

/** Per-dish base seed. Variety across the library is now desired (different
 * vessels, backgrounds, and angles per dish), so each dish gets its own seed
 * derived deterministically from its slug rather than the one fixed library seed.
 * Deterministic so a re-run reproduces the same library, varied so two adjacent
 * dishes do not share a composition. IMAGE_SEED, if set, pins every dish to that
 * one seed (used to A/B a prompt change against a fixed composition). */
function dishSeed(slug) {
  if (process.env.IMAGE_SEED) return SEED;
  let h = 2166136261; // FNV-1a 32-bit
  for (let i = 0; i < slug.length; i += 1) {
    h ^= slug.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 1000000;
}

// --- Cuisine map: single source of truth is data/dish-photos/STYLE.md. This
// mirrors that table; STYLE.md owns it and any new tag is added there first. The
// prompt template reads "a dish of {cuisine} home cooking", so the slot is the
// bare cuisine ADJECTIVE only (no article, no "home-cooked dish" wrapping).
const CUISINE_MAP = {
  italian: "Italian",
  chinese: "Chinese",
  mexican: "Mexican",
  greek: "Greek",
  spanish: "Spanish",
  korean: "Korean",
  japanese: "Japanese",
  continental: "Continental",
  vietnamese: "Vietnamese",
  lebanese: "Lebanese",
  mediterranean: "Mediterranean",
  oriental: "Thai",
};
const FUNCTIONAL_TAGS = new Set(["HP", "complete_meal", "complete_carb", "fruit"]);
// Slug-level cuisine overrides (STYLE.md): a dish whose first cuisine tag would
// mislabel it gets its adjective pinned here by slug. Singapore noodles is tagged
// `oriental` (which defaults to Thai) but is Chinese-Malay, so Rajat pinned it to
// "Chinese".
const CUISINE_SLUG_OVERRIDES = {
  "singapore-noodles": "Chinese",
};

/** Build the cuisine adjective slot ("Thai", "Indian", "Chinese", ...). */
function cuisinePhrase(slug, tags) {
  if (CUISINE_SLUG_OVERRIDES[slug]) return CUISINE_SLUG_OVERRIDES[slug];
  for (const tag of tags) {
    if (FUNCTIONAL_TAGS.has(tag)) continue;
    const hit = CUISINE_MAP[tag];
    if (hit) return hit;
  }
  // No cuisine tag -> Indian (the untagged originals).
  return "Indian";
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

// NVIDIA's FLUX.1-dev content filter false-positives on a few benign culinary
// tokens, deterministically returning finishReason CONTENT_FILTERED / a black
// frame (seed-independent). The literal "fried" is one ("fry" is fine); the
// hyphenated/adjacent "sweet-salty" is another (bisected live: dropping it makes
// the identical prompt succeed). This rewrites those tokens out of the prompt
// string ONLY (never the canonical dish file on disk) to a visually-equivalent
// synonym, so the rendered image still matches the dish. Applied as a general
// token transform to every prompt, ordered most-specific phrase first so the
// synonym preserves the dish's look. Each rule is case-insensitive and keeps the
// matched word's leading-capital casing.
const FILTER_SAFE_SUBSTITUTIONS = [
  // "fried" family. Whole phrases first (most specific), so e.g. "fried rice"
  // keeps the stir-fry look rather than collapsing to the bare fallback.
  [/\bstir-fried\b/gi, "wok-tossed"],
  [/\bdeep-fried\b/gi, "pan-crisped"],
  [/\bshallow fried\b/gi, "pan-crisped"],
  [/\bfried rice\b/gi, "stir-fry rice"],
  [/\bfried onions\b/gi, "golden browned onions"],
  [/\bfried onion\b/gi, "golden browned onion"],
  [/\bfried patties\b/gi, "golden patties"],
  [/\bfried crisp\b/gi, "crisp-cooked"],
  // Bare fallback: any remaining standalone "fried".
  [/\bfried\b/gi, "pan-cooked"],
  // "sweet-salty" / "sweet salty" -> "sweet and savoury" (same flavour profile).
  [/\bsweet[-\s]salty\b/gi, "sweet and savoury"],
];

/** Preserve the matched word's leading-capital casing on the replacement (e.g.
 * "Fried rice" -> "Stir-fry rice") so a sentence-initial term stays capitalized. */
function matchCase(match, replacement) {
  return /^[A-Z]/.test(match) ? replacement[0].toUpperCase() + replacement.slice(1) : replacement;
}

/** Rewrite the filter-blocked tokens ("fried", "sweet-salty") out of an assembled
 * prompt string so the provider's content filter does not false-positive on it. */
function sanitizeFilterTokens(prompt) {
  let out = prompt;
  for (const [re, repl] of FILTER_SAFE_SUBSTITUTIONS) {
    out = out.replace(re, (m) => matchCase(m, repl));
  }
  return out;
}

/** Fill the frozen STYLE.md prompt. Only the three slots vary. */
function buildPrompt(slug, name, tags, description) {
  const cuisine = cuisinePhrase(slug, tags);
  const prompt =
    `A real, candid food photograph of ${name} (${description}), a home-style ` +
    `${cuisine} dish, shot the way a person would actually photograph their own ` +
    `meal: from a natural angle, often low or three-quarter rather than flat ` +
    `overhead, with shallow depth of field and a real, slightly cluttered home or ` +
    `restaurant background softly out of focus. It is served in a real everyday ` +
    `vessel that genuinely suits the dish (a steel katori or thali, a karahi or ` +
    `kadai, a cast-iron pan, or a plain home plate), filling the vessel like a real ` +
    `portion, not a small centred mound. Ordinary warm indoor light or soft daylight ` +
    `with gentle natural shadows, and honest true-to-life colour that is not bright ` +
    `or oversaturated. Most important, the food looks genuinely cooked and a little ` +
    `imperfect: real browning and char where it has been cooked; the correct real ` +
    `texture and consistency for this dish (a dry dish stays dry, a gravy is thick ` +
    `opaque and oil-flecked with pieces half-submerged, rice is loose separate ` +
    `grains, a pudding is loose and soft); irregular hand-made shapes rather than ` +
    `identical pieces; oil sheen, uneven edges, stray crumbs and a little mess; and ` +
    `any garnish scattered naturally as it really would be, never a single sprig ` +
    `placed in the centre. Shot on a phone, realistic and unstyled, square 1:1.`;
  // Sanitize the assembled string only; the dish file on disk is untouched.
  return sanitizeFilterTokens(prompt);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- Concurrency + rate limiting --------------------------------------------
// NVIDIA's free tier allows roughly 40 requests/minute. We run a bounded pool of
// workers (default 6 in flight) so generation parallelizes, and gate every
// outbound request through a client-side rate limiter capped well under the cap
// (35/min) so the pool never trips a 429. Both are env-tunable.
const CONCURRENCY = Number(process.env.PHOTO_CONCURRENCY) || 6;
const MAX_RPM = Number(process.env.PHOTO_MAX_RPM) || 35;

/** Sliding-window rate limiter: at most MAX_RPM acquires per rolling 60s. Each
 * caller awaits acquire() before its request; if the window is full it sleeps
 * until the oldest timestamp ages out. Single-threaded JS, so no lock needed
 * beyond serializing the async waiters through a tail promise. */
function makeRateLimiter(maxPerMinute) {
  const windowMs = 60000;
  const stamps = []; // request timestamps in the current rolling window
  let count429 = 0;
  let tail = Promise.resolve();
  async function acquire() {
    // Serialize waiters so two callers cannot both read a stale window and
    // over-admit; each waits for the prior acquire to settle, then runs.
    const mine = tail.then(async () => {
      for (;;) {
        const now = Date.now();
        while (stamps.length && now - stamps[0] >= windowMs) stamps.shift();
        if (stamps.length < maxPerMinute) {
          stamps.push(now);
          return;
        }
        const waitMs = windowMs - (now - stamps[0]) + 5;
        await sleep(waitMs);
      }
    });
    // Keep the chain alive even if a waiter throws (it should not).
    tail = mine.catch(() => {});
    return mine;
  }
  return {
    acquire,
    note429: () => {
      count429 += 1;
    },
    get count429() {
      return count429;
    },
  };
}
const rateLimiter = makeRateLimiter(MAX_RPM);

/** Run tasks over `items` with at most `limit` in flight. Returns when all
 * settle; each task's own try/catch records success/skip/failure, so this never
 * rejects (a thrown task is surfaced via the shared result arrays by the caller). */
async function runPool(items, limit, worker) {
  let next = 0;
  async function drain() {
    while (next < items.length) {
      const i = next;
      next += 1;
      await worker(items[i], i);
    }
  }
  const runners = [];
  for (let k = 0; k < Math.min(limit, items.length); k += 1) runners.push(drain());
  await Promise.all(runners);
}

// --- Active provider: NVIDIA NIM FLUX.1-dev ---------------------------------

/** Pull a base64 image string out of a NVIDIA NIM JSON response, probing the
 * documented and a few likely-adjacent field shapes so a minor schema variation
 * does not silently break the run. Returns the base64 string or null. */
function extractBase64(json) {
  if (!json || typeof json !== "object") return null;
  // NVIDIA NIM / Stability-style: artifacts: [{ base64: "..." }].
  if (Array.isArray(json.artifacts) && json.artifacts[0]) {
    const a = json.artifacts[0];
    if (typeof a.base64 === "string") return a.base64;
    if (typeof a.b64_json === "string") return a.b64_json;
    if (typeof a === "string") return a;
  }
  // OpenAI-image-style: data: [{ b64_json: "..." }].
  if (Array.isArray(json.data) && json.data[0]) {
    const d = json.data[0];
    if (typeof d.b64_json === "string") return d.b64_json;
    if (typeof d.base64 === "string") return d.base64;
  }
  // Flat shapes some NIMs use.
  if (typeof json.image === "string") return json.image;
  if (typeof json.b64_json === "string") return json.b64_json;
  return null;
}

/** Strip a `data:...;base64,` prefix if the model returned a data URL. */
function stripDataUrl(b64) {
  const m = b64.match(/^data:[^;]+;base64,(.*)$/s);
  return m ? m[1] : b64;
}

/** Generate one image via NVIDIA NIM FLUX.1-dev. Returns { buf, usage }, where
 * usage is any observable credit/usage signal (headers or response fields, else
 * null), or throws. Retries 429/503 with backoff; surfaces auth/quota at once. */
async function generateImageNvidia(prompt, key, seed = SEED) {
  const maxAttempts = 5;
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      // Gate every outbound request through the client-side rate limiter (incl.
      // retries: a retry is another request that counts against the cap).
      await rateLimiter.acquire();
      const res = await fetch(NVIDIA_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          prompt,
          mode: "base",
          // Candid-realism params (STYLE.md): lower guidance + more steps render
          // looser, more natural food rather than over-tight, plasticky CGI.
          cfg_scale: 3.5,
          width: TARGET_PX,
          height: TARGET_PX,
          seed,
          steps: 40,
          samples: 1,
        }),
      });
      if (res.status === 429 || res.status === 500 || res.status === 503) {
        // Exponential backoff with jitter on the transient statuses (429 rate
        // limit, 500/503 transient server error). Jitter avoids a thundering herd
        // when several pooled workers back off in lockstep.
        const base = Math.min(60000, 2000 * 2 ** (attempt - 1));
        const backoff = base + Math.floor(Math.random() * 1000);
        const note = await res.text().catch(() => "");
        if (res.status === 429) rateLimiter.note429();
        console.warn(
          `  ${res.status} (${note.slice(0, 120)}), backoff ${backoff}ms (attempt ${attempt}/${maxAttempts})`,
        );
        await sleep(backoff);
        continue; // retryable
      }
      if (!res.ok) {
        const note = await res.text().catch(() => "");
        const err = new Error(`NVIDIA HTTP ${res.status}: ${note.slice(0, 400)}`);
        err.httpStatus = res.status;
        throw err;
      }
      // Observable usage signal: NVIDIA may expose credits via headers. Capture any.
      const usage = {};
      for (const [k, v] of res.headers.entries()) {
        if (/credit|usage|quota|remaining|cost|ratelimit|rate-limit/i.test(k)) usage[k] = v;
      }
      const json = await res.json();
      // Or via a usage/cost field on the body.
      for (const f of ["usage", "credits", "cost", "billing"]) {
        if (json && json[f] != null) usage[f] = json[f];
      }
      // NVIDIA signals a safety-filtered generation with finishReason
      // CONTENT_FILTERED and returns a black frame. Surface it so the caller can
      // skip the dish rather than write a black image (re-rolling does not help:
      // the filter is deterministic on the prompt).
      const finishReason = Array.isArray(json.artifacts) ? json.artifacts[0]?.finishReason : null;
      let b64 = extractBase64(json);
      if (!b64) {
        const keys = json && typeof json === "object" ? Object.keys(json).join(", ") : typeof json;
        throw new Error(`NVIDIA: no base64 image field found. Top-level keys: [${keys}]`);
      }
      b64 = stripDataUrl(b64);
      return {
        buf: Buffer.from(b64, "base64"),
        usage: Object.keys(usage).length ? usage : null,
        finishReason,
      };
    } catch (err) {
      lastErr = err;
      // Auth/quota are not worth retrying; surface at once.
      if (err.httpStatus === 401 || err.httpStatus === 402 || err.httpStatus === 403) throw err;
      // A parse/schema error is not retryable either.
      if (!err.httpStatus) throw err;
      // Other hard HTTP errors: stop retrying.
      break;
    }
  }
  throw lastErr ?? new Error("NVIDIA: exhausted retries");
}

// --- Dormant fallback: Hugging Face FLUX.1-schnell --------------------------

/** POST the prompt to one HF endpoint; resolve to a Buffer of image bytes, throw on
 * a hard error, or return null to signal a retryable condition (429/503/model load). */
async function callHfEndpoint(url, prompt, token, attempt, maxAttempts, seed) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "image/png",
    },
    body: JSON.stringify({
      inputs: prompt,
      // FLUX.1-schnell is a distilled few-step model; 4 steps is its sweet spot.
      parameters: {
        width: TARGET_PX,
        height: TARGET_PX,
        num_inference_steps: 4,
        seed,
      },
      // Wait for a cold model rather than erroring immediately on first call.
      options: { wait_for_model: true },
    }),
  });
  if (res.status === 429 || res.status === 503) {
    const backoff = Math.min(60000, 2000 * 2 ** (attempt - 1));
    const note = await res.text().catch(() => "");
    console.warn(
      `  ${res.status} (${note.slice(0, 120)}), backoff ${backoff}ms (attempt ${attempt}/${maxAttempts})`,
    );
    await sleep(backoff);
    return null; // retryable
  }
  const ct = res.headers.get("content-type") || "";
  if (!res.ok) {
    const note = await res.text().catch(() => "");
    const err = new Error(`HF HTTP ${res.status} (${url}): ${note.slice(0, 400)}`);
    err.httpStatus = res.status;
    throw err;
  }
  if (!ct.startsWith("image/")) {
    // Some error states come back 200 with a JSON body.
    const note = await res.text().catch(() => "");
    throw new Error(`HF non-image response (${ct}) from ${url}: ${note.slice(0, 400)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

/** Generate one image via Hugging Face FLUX.1-schnell (dormant fallback); return
 * { buf, usage: null }, or throw. Tries the router endpoint first, falls back to
 * the legacy serverless endpoint, and retries 429/503 with backoff. */
async function generateImageHf(prompt, token, seed = SEED) {
  const maxAttempts = 5;
  let lastErr;
  for (const url of [HF_ROUTER_URL, HF_LEGACY_URL]) {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const buf = await callHfEndpoint(url, prompt, token, attempt, maxAttempts, seed);
        if (buf) return { buf, usage: null, finishReason: null };
      } catch (err) {
        lastErr = err;
        // A 404 on the router means the model is not on that path; fall through.
        if (err.httpStatus === 404) break;
        // Auth/quota are not worth retrying or falling back on; surface at once.
        if (err.httpStatus === 401 || err.httpStatus === 402 || err.httpStatus === 403) throw err;
        // Other hard errors: stop retrying this endpoint, try the next.
        break;
      }
    }
  }
  throw lastErr ?? new Error("HF: exhausted retries on both endpoints");
}

/** Provider dispatch. Returns { buf, usage }. An explicit seed overrides the default. */
async function generateImage(prompt, key, seed = SEED) {
  return PROVIDER === "hf"
    ? generateImageHf(prompt, key, seed)
    : generateImageNvidia(prompt, key, seed);
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: "utf8" });
  if (r.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed: ${r.stderr || r.stdout}`);
  }
  return r.stdout;
}

// FLUX.1-dev on NVIDIA occasionally returns an all-black frame (a failed/filtered
// render) that still decodes to a valid-sized JPEG and so would otherwise pass.
// Guard against it by averaging the whole image down to a single pixel with sips
// and reading that pixel's luminance: a real food photo reads ~120-180, a black
// frame reads ~0. Below BLACK_LUM_THRESHOLD the image is rejected so it can be
// re-rolled with a varied seed. Uses only sips + node built-ins (no image lib).
const BLACK_LUM_THRESHOLD = 25;

/** Mean luminance (0-255) of an image, via a 1x1 sips downscale and a minimal PNG parse. */
function meanLuminance(imgPath) {
  // Unique temp name per call so concurrent pool workers do not clobber a shared
  // file mid-check.
  const tmp = resolve(photosDir, `.lumcheck.${process.pid}.${Math.random().toString(36).slice(2)}.png`);
  try {
    run("sips", ["-z", "1", "1", "-s", "format", "png", imgPath, "--out", tmp]);
    const buf = readFileSync(tmp);
    let off = 8;
    let idat = Buffer.alloc(0);
    while (off < buf.length) {
      const len = buf.readUInt32BE(off);
      const type = buf.toString("ascii", off + 4, off + 8);
      const data = buf.subarray(off + 8, off + 8 + len);
      if (type === "IDAT") idat = Buffer.concat([idat, data]);
      if (type === "IEND") break;
      off += 12 + len;
    }
    const raw = zlibInflateSync(idat);
    // PNG row = 1 filter byte + pixel bytes. For a 1x1 image the pixel follows.
    const px = raw.subarray(1);
    const r = px[0] ?? 0;
    const g = px[1] ?? r;
    const b = px[2] ?? r;
    return 0.299 * r + 0.587 * g + 0.114 * b;
  } finally {
    rmSync(tmp, { force: true });
  }
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
  // The ladder runs to a low floor so even busy, high-detail dishes (which compress
  // poorly) land under MAX_BYTES; FLUX output is sharp enough that q=25 still reads
  // cleanly at the small thumbnail and the wide Explore strip.
  for (const q of [80, 70, 60, 50, 40, 30, 25, 20, 15]) {
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
  return 15; // last attempt stands; size reported by caller
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

async function processDish(slug, token) {
  const { path, raw, name, tags, description, hasPhoto } = readDish(slug);
  const prompt = buildPrompt(slug, name, tags, description);
  console.log(`\n[${slug}] ${name}`);
  console.log(`  cuisine slot: ${cuisinePhrase(slug, tags)}`);
  if (process.argv.includes("--dry-run")) {
    console.log(`  prompt: ${prompt}`);
    return;
  }
  if (!existsSync(photosDir)) mkdirSync(photosDir, { recursive: true });

  const rawPath = resolve(photosDir, `.${slug}.raw`);
  const outPath = resolve(photosDir, `${slug}.jpg`);

  // Generate, normalize, and validate. Two failure modes are handled:
  //   - CONTENT_FILTERED: NVIDIA's safety filter rejected the prompt and returned
  //     a black frame. This is deterministic on the prompt, so a re-roll does not
  //     help; skip the dish (no jpg, no photo: field). The placeholder covers it.
  //   - A black frame without that signal (a transient render failure): re-roll
  //     once or twice with a varied seed.
  const baseSeed = dishSeed(slug);
  let attempt = 0;
  let skipped = false;
  for (;;) {
    attempt += 1;
    // Per-dish base seed on the first attempt (variety across the library);
    // re-rolls (black frame) bump deterministically from there.
    const seedOverride = baseSeed + (attempt - 1) * 1000;
    const { buf: imgBuf, usage, finishReason } = await generateImage(prompt, token, seedOverride);
    if (usage) console.log(`  usage: ${JSON.stringify(usage)}`);
    if (finishReason === "CONTENT_FILTERED") {
      console.warn(`  CONTENT_FILTERED by the provider safety filter; skipping (placeholder covers it)`);
      skipped = true;
      break;
    }
    writeFileSync(rawPath, imgBuf);
    try {
      const q = toWebReadyJpeg(rawPath, outPath);
      const bytes = statSync(outPath).size;
      const dims = run("sips", ["-g", "pixelWidth", "-g", "pixelHeight", outPath]);
      const ow = dims.match(/pixelWidth:\s*(\d+)/)?.[1];
      const oh = dims.match(/pixelHeight:\s*(\d+)/)?.[1];
      const lum = meanLuminance(outPath);
      if (lum < BLACK_LUM_THRESHOLD && attempt < 3) {
        console.warn(`  black frame (lum ${lum.toFixed(0)}), re-rolling with varied seed`);
        continue;
      }
      if (lum < BLACK_LUM_THRESHOLD) {
        console.warn(`  still black after re-rolls; skipping (placeholder covers it)`);
        rmSync(outPath, { force: true });
        skipped = true;
        break;
      }
      console.log(
        `  wrote ${slug}.jpg: ${ow}x${oh}, ${(bytes / 1024).toFixed(0)} KB, q=${q}, lum=${lum.toFixed(0)}`,
      );
      if (bytes > MAX_BYTES)
        console.warn(`  WARNING: ${slug}.jpg over ${MAX_BYTES} bytes (${bytes})`);
      if (ow !== oh) console.warn(`  WARNING: ${slug}.jpg not square (${ow}x${oh})`);
      break;
    } finally {
      rmSync(rawPath, { force: true });
    }
  }

  if (skipped) {
    const err = new Error(`skipped: provider returned no usable image for ${slug}`);
    err.skipped = true;
    throw err;
  }

  // Set the photo: frontmatter (image + field land together). setPhotoField is
  // idempotent: it replaces an existing photo: line or inserts one, so a forced
  // regenerate of an already-photographed dish leaves the field correct.
  if (!hasPhoto) {
    writeFileSync(path, setPhotoField(slug, raw, `${slug}.jpg`));
    console.log(`  set photo: ${slug}.jpg in ${slug}.md`);
  } else {
    console.log(`  photo: field already present in ${slug}.md (image overwritten)`);
  }
}

/** Enumerate every active dish slug (frontmatter `active: Yes`), alphabetically.
 * Used by --all to force-regenerate the whole library. */
function allActiveSlugs() {
  const files = readdirSync(dishesDir).filter((f) => f.endsWith(".md"));
  const slugs = [];
  for (const f of files) {
    const raw = readFileSync(resolve(dishesDir, f), "utf8");
    if (/^active:\s*Yes\s*$/m.test(raw)) slugs.push(f.replace(/\.md$/, ""));
  }
  return slugs.sort();
}

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const all = process.argv.includes("--all") || process.argv.includes("--force");
  if (args.length === 0 && !all) {
    console.error(
      "usage: node scripts/generate-dish-photos.mjs [--one|--dry-run|--all] <slug> [<slug> ...]",
    );
    process.exit(1);
  }
  const keyVar = PROVIDER === "hf" ? "HF_TOKEN" : "NVIDIA_API_KEY";
  const token = process.env[keyVar];
  if (!token && !process.argv.includes("--dry-run")) {
    console.error(`${keyVar} not set. See header comment for how to load it.`);
    process.exit(1);
  }
  console.log(`provider: ${PROVIDER} | model: ${MODEL} | seed: ${SEED}`);

  // --all/--force force-regenerates EVERY active dish, overwriting existing
  // photos (this run replaces the whole library with the new realistic look).
  // The pipeline never skips a dish for already having a photo:; it overwrites
  // the jpg and re-asserts the photo: field. Otherwise generate only the named
  // slugs (or just the first with --one).
  let slugs;
  if (all) slugs = allActiveSlugs();
  else if (process.argv.includes("--one")) slugs = [args[0]];
  else slugs = args;

  console.log(
    `concurrency: ${CONCURRENCY} in flight | rate cap: ${MAX_RPM}/min | dishes: ${slugs.length}`,
  );

  const landed = [];
  const failed = [];
  const skipped = [];
  let fatal = false;
  const t0 = Date.now();

  await runPool(slugs, CONCURRENCY, async (slug) => {
    if (fatal) return; // auth/quota tripped: drain remaining workers without firing
    try {
      await processDish(slug, token);
      landed.push(slug);
    } catch (err) {
      // A skipped dish (filtered / unrecoverable black frame) is not a failure to
      // retry; record it separately and move on. The placeholder covers it.
      if (err.skipped) {
        skipped.push(slug);
      } else {
        failed.push(slug);
        // Auth/quota are fatal: stop the run and report so we do not burn the
        // remaining slugs against a dry/exhausted key (brief: fail fast on quota/auth).
        if (err.httpStatus === 401 || err.httpStatus === 402 || err.httpStatus === 403) {
          console.error(`\n[${slug}] FATAL auth/quota error, stopping run: ${err.message}`);
          fatal = true;
          return;
        }
        // Other per-dish failures: log and keep going so a partial run still lands.
        console.error(`\n[${slug}] failed (continuing): ${err.message}`);
      }
    }
  });

  const wallSec = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\nDone. Model: ${MODEL}. Landed ${landed.length}/${slugs.length}.`);
  console.log(`Wall-clock: ${wallSec}s. HTTP 429s observed: ${rateLimiter.count429}.`);
  if (skipped.length) console.log(`Skipped (no usable image): ${skipped.join(", ")}`);
  if (failed.length) console.log(`Failed: ${failed.join(", ")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
