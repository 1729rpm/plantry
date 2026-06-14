/* eslint-disable no-undef -- runs in Node (process/console/URL) and injects
   browser code via page.evaluate (window/document); both global sets are
   legitimate here and the flat eslint config does not scope app/web/e2e/. */

// Render smoke test for the Plantry PWA (local, network-dependent).
//
// WHY THIS EXISTS
// ---------------
// The CSS brace bug (fix/css-explore-share-guardrails) silently broke the
// Explore tab (one giant overflowing image) and the Share images (unstyled
// text) without failing any CI gate: `vite build` tolerates malformed CSS, and
// nothing actually rendered the app during CI. `npm run lint:css` (stylelint)
// now catches the *syntax* class of that bug deterministically. This script is
// the complementary *behavioural* guard: it loads the built app in a real
// browser, bypasses the passcode, walks every tab, and asserts there is no
// horizontal overflow and the Explore cards are phone-sized. It would have
// failed loudly on the broken CSS.
//
// WHY IT IS NOT A REQUIRED CI GATE
// --------------------------------
// There is no test Convex backend. The app needs a live `VITE_CONVEX_URL` at
// build time to hydrate the week, so this script is network-dependent and
// therefore kept as a documented LOCAL script (`npm run test:smoke` in
// app/web), not a `.github/workflows/ci.yml` step. It performs ONLY reads:
// it injects auth into localStorage and observes layout. It never calls a
// mutation or writes to any backend.
//
// USAGE
// -----
//   cd app/web
//   VITE_CONVEX_URL="https://<deployment>.convex.cloud" npm run build
//   VITE_CONVEX_URL="https://<deployment>.convex.cloud" npm run test:smoke
//
// Requires `npx playwright install chromium` once on the machine. If Chromium
// is not installed or no Convex URL is provided, the script exits 0 with a
// SKIP message so it never blocks anyone; pass STRICT=1 to make those cases
// hard failures instead.

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createServer } from "node:http";
import { existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(__dirname, "..");
const distDir = resolve(webRoot, "dist");

const STRICT = process.env.STRICT === "1";
const TABS = ["Menu", "Grocery", "Explore", "Changes"];

function skip(msg) {
  if (STRICT) {
    console.error(`SMOKE FAIL (STRICT): ${msg}`);
    process.exit(1);
  }
  console.log(`SMOKE SKIP: ${msg}`);
  process.exit(0);
}

if (!existsSync(distDir)) {
  skip(`no build at ${distDir}. Run \`npm run build\` first.`);
}
if (!process.env.VITE_CONVEX_URL) {
  skip("VITE_CONVEX_URL is not set; the app cannot hydrate a week. Point it at a real deployment.");
}

// Playwright is an optional dev dependency; load it lazily so a machine
// without it (or without the chromium binary) skips rather than crashes.
let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  skip("playwright is not installed. Run `npm i` then `npx playwright install chromium`.");
}

// Minimal static file server over dist/ so we do not depend on `vite preview`.
const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
  ".ico": "image/x-icon",
};

const { readFile } = await import("node:fs/promises");
const { extname, join, normalize } = await import("node:path");

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === "/") pathname = "/index.html";
    let filePath = normalize(join(distDir, pathname));
    if (!filePath.startsWith(distDir)) {
      res.statusCode = 403;
      return res.end("forbidden");
    }
    if (!existsSync(filePath)) filePath = join(distDir, "index.html"); // SPA fallback
    const body = await readFile(filePath);
    res.setHeader("Content-Type", MIME[extname(filePath)] ?? "application/octet-stream");
    res.end(body);
  } catch (err) {
    res.statusCode = 500;
    res.end(String(err));
  }
});

await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const base = `http://localhost:${port}`;

let browser;
let failures = [];
try {
  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();

  // Bypass the passcode + identity gate by injecting localStorage before the
  // app boots. Matches app/web/src/lib/storage.ts: auth is JSON {passedAt},
  // identity is the bare string "rajat".
  await page.addInitScript(() => {
    window.localStorage.setItem("plantry:auth", JSON.stringify({ passedAt: Date.now() }));
    window.localStorage.setItem("plantry:identity", "rajat");
  });

  await page.goto(base, { waitUntil: "networkidle" });

  for (const tab of TABS) {
    // Click the tab by its visible button text.
    const btn = page.locator(`.tab-bar__tab`, { hasText: tab });
    if ((await btn.count()) > 0) {
      await btn.first().click();
      await page.waitForTimeout(400);
    } else {
      failures.push(`tab "${tab}" button not found`);
      continue;
    }

    // (a) No element overflows the viewport horizontally.
    const overflow = await page.evaluate(
      (innerW) => {
        const bad = [];
        for (const el of Array.from(document.querySelectorAll("*"))) {
          if (el.scrollWidth > innerW + 2) {
            bad.push(`${el.className || el.tagName} scrollWidth=${el.scrollWidth}`);
            if (bad.length >= 5) break;
          }
        }
        return bad;
      },
      await page.evaluate(() => window.innerWidth),
    );
    if (overflow.length) {
      failures.push(`[${tab}] horizontal overflow: ${overflow.join("; ")}`);
    }

    // (b) On Explore, every dish card is phone-sized (< 400px wide).
    if (tab === "Explore") {
      const widths = await page.evaluate(() =>
        Array.from(document.querySelectorAll(".explore-card")).map(
          (el) => el.getBoundingClientRect().width,
        ),
      );
      if (widths.length === 0) {
        failures.push(`[Explore] no .explore-card rendered (feed empty or selector changed)`);
      }
      for (const w of widths) {
        if (w >= 400) failures.push(`[Explore] .explore-card width ${Math.round(w)}px >= 400px`);
      }
    }
  }
} catch (err) {
  failures.push(`runtime error: ${err.message ?? err}`);
} finally {
  if (browser) await browser.close();
  server.close();
}

if (failures.length) {
  console.error("SMOKE FAIL:\n  - " + failures.join("\n  - "));
  process.exit(1);
}
console.log("SMOKE PASS: all tabs render, no horizontal overflow, Explore cards phone-sized.");
process.exit(0);
