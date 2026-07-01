/* eslint-disable no-undef -- runs in Node (process/console/URL) and injects
   browser code via page.evaluate (window/document); both global sets are
   legitimate here and the flat eslint config does not scope app/web/e2e/. */

// Render smoke test for the Plantry PWA (local or remote, network-dependent).
//
// WHY THIS EXISTS
// ---------------
// The CSS brace bug (fix/css-explore-share-guardrails) silently broke the
// Explore tab (one giant overflowing image) and the Share images (unstyled
// text) without failing any CI gate: `vite build` tolerates malformed CSS, and
// nothing actually rendered the app during CI. `npm run lint:css` (stylelint)
// now catches the *syntax* class of that bug deterministically. This script is
// the complementary *behavioural* guard: it loads the built app in a real
// browser, bypasses the passcode, walks every tab AND opens the bottom sheets,
// and asserts there is no horizontal overflow, the Explore cards are
// phone-sized, and every screen / sheet keeps a real left+right content gutter
// (it would have caught a gutter collapsing to ~0).
//
// WHAT THIS CRAWL CAN AND CANNOT CATCH
// ------------------------------------
// It runs DESKTOP browser engines: Chromium (Blink) and WebKit (the engine
// behind Safari). Running WebKit catches a broad class of Safari-only layout
// problems on the desktop build. It CANNOT reproduce a real-iOS-DEVICE-only
// rendering bug: an actual iPhone running a given iOS Safari version can render
// CSS differently from desktop WebKit (for example an older iOS mishandling
// env() inside a padding shorthand, which the gutter-token fix defuses, was
// NOT reproducible in desktop WebKit at all). So a green run here proves the
// broad "container under-padded / gutter omitted" class is clear; it is NOT
// proof that an iOS-device-specific CSS bug is fixed. iOS-affecting CSS still
// needs real-device sign-off before merge (see docs/development.md DoD and
// docs/engineering.md section 16).
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
// Local (build + serve dist/, the default):
//   cd app/web
//   VITE_CONVEX_URL="https://<deployment>.convex.cloud" npm run build
//   VITE_CONVEX_URL="https://<deployment>.convex.cloud" npm run test:smoke
//
// Remote preview (crawl a deployed, protection-bypassed Vercel preview):
//   CRAWL_URL="https://plantry-<hash>-mudgal1729s-projects.vercel.app" \
//   VERCEL_AUTOMATION_BYPASS_SECRET="$(grep '^VERCEL_AUTOMATION_BYPASS_SECRET=' ~/.secrets/.env | cut -d= -f2-)" \
//   npm run test:smoke
// In remote mode no local build is needed; the script crawls CRAWL_URL and uses
// the bypass token to pass Vercel deployment protection (docs/engineering.md §16).
//
// Requires `npx playwright install chromium webkit` once on the machine. If a
// browser engine is not installed it is SKIPPED with a message (the run does
// not hard-fail on a missing engine); if (local mode) no build / no Convex URL
// is provided, the script exits 0 with a SKIP message so it never blocks
// anyone. Pass STRICT=1 to make the no-build / no-URL cases hard failures.

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createServer } from "node:http";
import { existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(__dirname, "..");
const distDir = resolve(webRoot, "dist");

const STRICT = process.env.STRICT === "1";
const TABS = ["Menu", "Grocery", "Explore", "Changes"];
// Per-tab readiness signal: an element that only exists once that tab's content
// has actually hydrated over the Convex websocket. `networkidle` plus a fixed
// delay fires before the live data arrives, so a tab can read as "not found"
// while it is merely still hydrating; waiting on a real post-hydration selector
// removes that race. Each is best-effort (a genuinely empty tab never renders
// it), so the wait is bounded and non-fatal; the gutter check already tolerates
// a loading/empty state.
const TAB_READY = {
  Menu: ".day-card",
  Grocery: ".grocery-list",
  Explore: ".explore-card",
  Changes: ".screen__list",
};
const TAB_READY_TIMEOUT = 8000;
// Two phone widths: 390 (iPhone 12/13/14 class) and 412 (common Android /
// larger iPhone). The reported gutter bug showed at both.
const WIDTHS = [390, 412];
// A meaningful content element must sit at least this far from each viewport
// edge. The gutter token is 20px; we assert a floor a little below it so the
// check catches a gutter collapsing toward 0 without being brittle to
// sub-pixel rounding or an intentional full-bleed element.
const MIN_GUTTER = 16;

// Remote-preview mode. When CRAWL_URL is set, crawl that deployed URL instead of
// building and serving dist/ locally. A Vercel preview is behind deployment
// protection (HTTP 401), so pass VERCEL_AUTOMATION_BYPASS_SECRET (the Protection
// Bypass for Automation token); the crawl then sends the bypass header and sets
// the bypass cookie so the SPA boots. See docs/engineering.md §16.
const CRAWL_URL = process.env.CRAWL_URL;
const BYPASS = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

function skip(msg) {
  if (STRICT) {
    console.error(`SMOKE FAIL (STRICT): ${msg}`);
    process.exit(1);
  }
  console.log(`SMOKE SKIP: ${msg}`);
  process.exit(0);
}

if (!CRAWL_URL) {
  if (!existsSync(distDir)) {
    skip(`no build at ${distDir}. Run \`npm run build\` first.`);
  }
  if (!process.env.VITE_CONVEX_URL) {
    skip(
      "VITE_CONVEX_URL is not set; the app cannot hydrate a week. Point it at a real deployment.",
    );
  }
}

// Playwright is an optional dev dependency; load it lazily so a machine
// without it skips rather than crashes. We pull both engines and probe each
// one's binary at launch time, skipping (not failing) any engine that is not
// installed.
let chromium, webkit;
try {
  ({ chromium, webkit } = await import("playwright"));
} catch {
  skip("playwright is not installed. Run `npm i` then `npx playwright install chromium webkit`.");
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

let server = null;
let base;
if (CRAWL_URL) {
  // Remote mode: crawl the deployed preview directly.
  base = CRAWL_URL.replace(/\/$/, "");
} else {
  // Local mode: serve dist/ over a throwaway static server.
  server = createServer(async (req, res) => {
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
  base = `http://localhost:${server.address().port}`;
}

// First-navigation entry URL: in remote mode with a bypass token, the first
// navigation also sets the bypass cookie so subsequent asset requests are let
// through without the header.
const entryUrl = CRAWL_URL && BYPASS ? `${base}/?x-vercel-set-bypass-cookie=true` : base;

// Browser-side gutter probe. The gutter lives on the screen/sheet's
// content container as horizontal padding (the --pt-gutter token, longhand
// padding-left / padding-right). Rather than chase geometry of arbitrary
// descendants (fragile across hydration and full-bleed children), this reads
// the RESOLVED padding-left / padding-right of every present gutter-bearing
// container and reports the smallest. A returned value at or near 0 means the
// token failed to resolve or the container lost its inset. Returns
// { left, right, perContainer } or null when no candidate container is present.
//
// For sheets, the effective gutter is the panel's own floor PLUS the scroll
// box's inset (they are split so they do not double-pad). The probe sums the
// `.sheet__panel` horizontal padding and the `.sheet__scroll` horizontal
// padding when both are present, so it measures the true content gutter.
const GUTTER_PROBE = ({ candidates }) => {
  const px = (v) => parseFloat(v) || 0;
  const found = {};
  let panelLeft = null;
  let panelRight = null;
  let scrollLeft = null;
  let scrollRight = null;
  for (const sel of candidates) {
    const el = document.querySelector(sel);
    if (!el) continue;
    const s = window.getComputedStyle(el);
    const left = px(s.paddingLeft);
    const right = px(s.paddingRight);
    found[sel] = { left, right };
    if (sel === ".sheet__panel") {
      panelLeft = left;
      panelRight = right;
    } else if (sel === ".sheet__scroll") {
      scrollLeft = left;
      scrollRight = right;
    }
  }
  if (Object.keys(found).length === 0) return null;
  // Combine the split sheet padding into one effective gutter.
  let effLeft = Infinity;
  let effRight = Infinity;
  const perContainer = [];
  if (panelLeft !== null) {
    const l = panelLeft + (scrollLeft ?? 0);
    const r = panelRight + (scrollRight ?? 0);
    perContainer.push(`sheet(panel+scroll)=${Math.round(l)}/${Math.round(r)}`);
    effLeft = Math.min(effLeft, l);
    effRight = Math.min(effRight, r);
  }
  for (const [sel, v] of Object.entries(found)) {
    if (sel === ".sheet__panel" || sel === ".sheet__scroll") continue;
    perContainer.push(`${sel}=${Math.round(v.left)}/${Math.round(v.right)}`);
    effLeft = Math.min(effLeft, v.left);
    effRight = Math.min(effRight, v.right);
  }
  return {
    left: Math.round(effLeft),
    right: Math.round(effRight),
    perContainer,
  };
};

// Per-context candidate gutter-bearing containers. Whichever are present on the
// screen / sheet are measured; the smallest effective gutter must clear the
// floor.
const SCREEN_GUTTER_CANDIDATES = [
  ".screen__list",
  ".day-screen__body",
  ".explore__grid",
  ".grocery-chooser",
  ".grocery-list",
];
const SHEET_GUTTER_CANDIDATES = [".sheet__panel", ".sheet__scroll"];

async function checkOverflow(page, label, failures) {
  const innerW = await page.evaluate(() => window.innerWidth);
  const overflow = await page.evaluate((w) => {
    const bad = [];
    for (const el of Array.from(document.querySelectorAll("*"))) {
      // An element with overflow-x auto/scroll is DESIGNED to scroll sideways
      // (e.g. the Explore filter row, the share rail), so its scrollWidth
      // legitimately exceeds its box; it is not a layout overflow bug.
      const ox = window.getComputedStyle(el).overflowX;
      if (ox === "auto" || ox === "scroll") continue;
      if (el.scrollWidth > w + 2) {
        bad.push(`${el.className || el.tagName} scrollWidth=${el.scrollWidth}`);
        if (bad.length >= 5) break;
      }
    }
    return bad;
  }, innerW);
  if (overflow.length) {
    failures.push(`[${label}] horizontal overflow: ${overflow.join("; ")}`);
  }
}

async function checkGutter(page, label, candidates, failures) {
  // Wait up to a few seconds for a gutter-bearing container to appear: on the
  // cold first load the screen can briefly show a "Loading..." empty state
  // (no list) while Convex hydrates over the websocket.
  await page
    .waitForFunction((sels) => sels.some((s) => document.querySelector(s)), candidates, {
      timeout: 4000,
    })
    .catch(() => {});
  const insets = await page.evaluate(GUTTER_PROBE, { candidates });
  if (insets === null) {
    // No content container: if the screen is in a genuine loading / empty
    // state, skip rather than fail (there is no content to gutter yet). If it
    // is not even an empty state, that is a real "where did the content go".
    const isEmptyState = await page.evaluate(() => !!document.querySelector(".empty-state"));
    if (isEmptyState) {
      console.log(`[${label}] gutter check skipped: screen is in a loading/empty state`);
    } else {
      failures.push(`[${label}] gutter check: none of ${candidates.join(", ")} present`);
    }
    return;
  }
  if (insets.left < MIN_GUTTER || insets.right < MIN_GUTTER) {
    failures.push(
      `[${label}] gutter ${insets.left}px/${insets.right}px (L/R) < ${MIN_GUTTER}px ` +
        `[${insets.perContainer.join(", ")}] (content hugs an edge)`,
    );
  }
}

async function runEngine(engineName, launcher, width, failures, coverage) {
  let browser;
  try {
    browser = await launcher.launch();
  } catch (err) {
    // A missing or unlaunchable engine binary is a SKIP, not a failure.
    console.log(
      `SMOKE SKIP: ${engineName} did not launch (${err.message ?? err}). ` +
        `Run \`npx playwright install ${engineName}\`.`,
    );
    return;
  }
  const tag = `${engineName}@${width}`;
  try {
    const ctx = await browser.newContext({
      viewport: { width, height: 844 },
      // On a protected Vercel preview, send the bypass token on every request so
      // the edge lets the SPA through instead of serving the 401 login wall.
      ...(BYPASS ? { extraHTTPHeaders: { "x-vercel-protection-bypass": BYPASS } } : {}),
    });
    const page = await ctx.newPage();

    // Bypass the passcode + identity gate by injecting localStorage before the
    // app boots. Matches app/web/src/lib/storage.ts: auth is JSON {passedAt},
    // identity is the bare string "rajat". Read-only: no mutation is called.
    await page.addInitScript(() => {
      window.localStorage.setItem("plantry:auth", JSON.stringify({ passedAt: Date.now() }));
      window.localStorage.setItem("plantry:identity", "rajat");
    });

    await page.goto(entryUrl, { waitUntil: "networkidle" });

    // ---- Tabs ----
    for (const tab of TABS) {
      const btn = page.locator(`.tab-bar__tab`, { hasText: tab });
      if ((await btn.count()) === 0) {
        failures.push(`[${tag}] tab "${tab}" button not found`);
        continue;
      }
      await btn.first().click();
      // Wait for a real post-hydration signal for this tab rather than a fixed
      // delay, so the asserts below do not fire while live Convex data is still
      // arriving over the websocket. Best-effort: a genuinely empty tab never
      // renders the signal, so the bounded wait simply falls through.
      const readySel = TAB_READY[tab];
      if (readySel) {
        await page.waitForSelector(readySel, { timeout: TAB_READY_TIMEOUT }).catch(() => {});
      }

      await checkOverflow(page, `${tag} ${tab}`, failures);

      // Minimum content gutter on the tab's edge-bearing container(s).
      await checkGutter(page, `${tag} ${tab}`, SCREEN_GUTTER_CANDIDATES, failures);

      if (tab === "Explore") {
        const widths = await page.evaluate(() =>
          Array.from(document.querySelectorAll(".explore-card")).map(
            (el) => el.getBoundingClientRect().width,
          ),
        );
        if (widths.length === 0) {
          failures.push(`[${tag}] no .explore-card rendered (feed empty or selector changed)`);
        }
        for (const w of widths) {
          if (w >= 400) failures.push(`[${tag}] .explore-card width ${Math.round(w)}px >= 400px`);
        }
      }
    }

    // ---- Sheet 1: dish-detail via an Explore card ----
    let detailReached = false;
    try {
      const exploreTab = page.locator(`.tab-bar__tab`, { hasText: "Explore" });
      await exploreTab.first().click();
      // Wait for the explore feed to hydrate its cards before clicking one.
      await page.waitForSelector(".explore-card", { timeout: 8000 }).catch(() => {});
      const card = page.locator(".explore-card").first();
      if ((await card.count()) > 0) {
        await card.click({ timeout: 5000 });
        await page.waitForSelector(".sheet__panel", { timeout: 3000 });
        await page.waitForTimeout(300);
        detailReached = true;
        coverage.detail.add(tag);
        await checkOverflow(page, `${tag} dish-detail`, failures);
        await checkGutter(page, `${tag} dish-detail`, SHEET_GUTTER_CANDIDATES, failures);
      }
    } catch (err) {
      failures.push(`[${tag}] dish-detail sheet flow errored: ${err.message ?? err}`);
    }
    if (!detailReached) coverage.detailMissed.add(tag);

    // ---- Sheet 2: swap picker via Menu -> day Edit -> dish ... -> Replace ----
    // Reload to a guaranteed-clean state (no sheet left open from the previous
    // flow). The initScript re-injects auth, so this stays read-only. Short
    // per-click timeouts (CLICK_T) keep a blocked step from hanging 30s; a
    // failure here marks the picker "not reached" rather than killing the run.
    let pickerReached = false;
    const CLICK_T = 5000;
    try {
      await page.goto(entryUrl, { waitUntil: "networkidle" });
      const menuTab = page.locator(`.tab-bar__tab`, { hasText: "Menu" });
      await menuTab.first().click({ timeout: CLICK_T });
      // Wait for the menu to hydrate (the Edit pill appears once the week loads).
      await page.waitForSelector(".day-card__edit", { timeout: 8000 }).catch(() => {});
      const editPill = page.locator(".day-card__edit").first();
      if ((await editPill.count()) > 0) {
        await editPill.click({ timeout: CLICK_T });
        await page.waitForSelector(".day-screen__body, .dish-row__actions", { timeout: 3000 });
        await page.waitForTimeout(300);
        const actions = page.locator(".dish-row__actions").first();
        if ((await actions.count()) > 0) {
          await actions.click({ timeout: CLICK_T });
          await page.waitForSelector(".action-sheet__row", { timeout: 3000 });
          await page.waitForTimeout(200);
          const replace = page.locator(".action-sheet__row", { hasText: "Replace" }).first();
          if ((await replace.count()) > 0) {
            await replace.click({ timeout: CLICK_T });
            await page.waitForSelector(".sheet__panel--picker", { timeout: 3000 });
            await page.waitForTimeout(300);
            pickerReached = true;
            coverage.picker.add(tag);
            await checkOverflow(page, `${tag} swap-picker`, failures);
            await checkGutter(page, `${tag} swap-picker`, SHEET_GUTTER_CANDIDATES, failures);
          }
        }
      }
    } catch (err) {
      // A blocked picker flow is reported as not-reached coverage, not a hard
      // failure: the dish-detail sheet (shared Sheet primitive) already proves
      // the sheet gutter, and the picker path depends on a library dish being
      // present in the live week, which is data-dependent.
      console.log(`[${tag}] swap-picker not reached: ${err.message ?? err}`);
    }
    if (!pickerReached) coverage.pickerMissed.add(tag);
  } catch (err) {
    failures.push(`[${tag}] runtime error: ${err.message ?? err}`);
  } finally {
    if (browser) await browser.close();
  }
}

const failures = [];
const coverage = {
  detail: new Set(),
  detailMissed: new Set(),
  picker: new Set(),
  pickerMissed: new Set(),
};

try {
  for (const width of WIDTHS) {
    await runEngine("chromium", chromium, width, failures, coverage);
    await runEngine("webkit", webkit, width, failures, coverage);
  }
} finally {
  if (server) server.close();
}

// Report sheet coverage explicitly: which engine@width combos reached each
// sheet and which did not (so a silently-unreachable sheet is visible, not
// swallowed).
console.log("SHEET COVERAGE:");
console.log(`  dish-detail reached: ${[...coverage.detail].join(", ") || "(none)"}`);
if (coverage.detailMissed.size) {
  console.log(`  dish-detail NOT reached: ${[...coverage.detailMissed].join(", ")}`);
}
console.log(`  swap-picker reached: ${[...coverage.picker].join(", ") || "(none)"}`);
if (coverage.pickerMissed.size) {
  console.log(`  swap-picker NOT reached: ${[...coverage.pickerMissed].join(", ")}`);
}

if (failures.length) {
  console.error("SMOKE FAIL:\n  - " + failures.join("\n  - "));
  process.exit(1);
}
console.log(
  "SMOKE PASS: tabs + sheets render across the available engines/widths, no horizontal overflow, Explore cards phone-sized, content gutter held.",
);
process.exit(0);
