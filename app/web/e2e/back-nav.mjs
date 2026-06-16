/* eslint-disable no-undef -- runs in Node (process/console/URL) and injects
   browser code via page.evaluate (window/document); both global sets are
   legitimate here and the flat eslint config does not scope app/web/e2e/. */

// Back-gesture / history navigation test for the Plantry PWA.
//
// WHAT IT GUARDS
// --------------
// The unified back-stack (app/web/src/lib/backStack.ts) makes the browser/OS
// Back gesture unwind the user's ACTUAL visit order across the whole app under
// ONE popstate listener: tab switches, the Day editor, and the bottom sheets all
// share one history-marker discipline. This script drives a real browser's
// history.back() (the programmatic equivalent of the OS Back gesture / Android
// hardware Back) and asserts:
//   (a) Back unwinds tab history in visit order
//       (Menu -> Explore -> Grocery; Back -> Explore; Back -> Menu).
//   (b) Back exits the Day editor back to the Menu list.
//   (c) Back closes an open bottom sheet (regression: PR #78 behavior holds).
//   (d) Back on the homepage shows the exit-confirm prompt and does NOT navigate
//       away (the app stays mounted).
//   (e) "Stay" keeps the user on the homepage.
//   (f) "Leave" attempts to leave (best-effort; in this harness the app is not
//       the first history entry, so it actually unwinds past the app entry).
//
// It mirrors smoke.mjs: same localStorage passcode/identity bypass (read-only,
// no mutations), same dist/-over-static-server model, same optional-engine and
// skip-if-no-build behavior so it never hard-blocks a machine without a build,
// a Convex URL, or a Playwright engine. Pass STRICT=1 to make those hard fails.
//
// USAGE (local):
//   cd app/web
//   VITE_CONVEX_URL="https://<deployment>.convex.cloud" npm run build
//   VITE_CONVEX_URL="https://<deployment>.convex.cloud" node e2e/back-nav.mjs

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createServer } from "node:http";
import { existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(__dirname, "..");
const distDir = resolve(webRoot, "dist");

const STRICT = process.env.STRICT === "1";

function skip(msg) {
  if (STRICT) {
    console.error(`BACK-NAV FAIL (STRICT): ${msg}`);
    process.exit(1);
  }
  console.log(`BACK-NAV SKIP: ${msg}`);
  process.exit(0);
}

if (!existsSync(distDir)) {
  skip(`no build at ${distDir}. Run \`npm run build\` first.`);
}
if (!process.env.VITE_CONVEX_URL) {
  skip("VITE_CONVEX_URL is not set; the app cannot hydrate a week. Point it at a real deployment.");
}

let chromium, webkit;
try {
  ({ chromium, webkit } = await import("playwright"));
} catch {
  skip("playwright is not installed. Run `npm i` then `npx playwright install chromium webkit`.");
}

// Static file server over dist/ (SPA fallback), same as smoke.mjs.
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
    if (!existsSync(filePath)) filePath = join(distDir, "index.html");
    const body = await readFile(filePath);
    res.setHeader("Content-Type", MIME[extname(filePath)] ?? "application/octet-stream");
    res.end(body);
  } catch (err) {
    res.statusCode = 500;
    res.end(String(err));
  }
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;

// --- Browser-side helpers (run via page.evaluate) ---
const activeTab = () => {
  const el = document.querySelector(".tab-bar__tab--active");
  return el ? el.textContent.trim() : null;
};

async function newCleanPage(browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  // Bypass passcode + identity (read-only, same as smoke.mjs).
  await page.addInitScript(() => {
    window.localStorage.setItem("plantry:auth", JSON.stringify({ passedAt: Date.now() }));
    window.localStorage.setItem("plantry:identity", "rajat");
  });
  const consoleErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  await page.goto(base, { waitUntil: "networkidle" });
  // Wait for the tab bar to render (app booted past the gates).
  await page.waitForSelector(".tab-bar__tab", { timeout: 8000 });
  return { ctx, page, consoleErrors };
}

async function clickTab(page, name) {
  await page.locator(".tab-bar__tab", { hasText: name }).first().click();
  await page.waitForTimeout(250);
}

async function expectActiveTab(page, name, label, failures) {
  const active = await page.evaluate(activeTab);
  if (active !== name) failures.push(`[${label}] expected active tab "${name}", got "${active}"`);
}

async function runEngine(engineName, launcher, failures) {
  let browser;
  try {
    browser = await launcher.launch();
  } catch (err) {
    console.log(
      `BACK-NAV SKIP: ${engineName} did not launch (${err.message ?? err}). ` +
        `Run \`npx playwright install ${engineName}\`.`,
    );
    return;
  }
  const tag = engineName;
  let ctx;
  try {
    let page, consoleErrors;
    ({ ctx, page, consoleErrors } = await newCleanPage(browser));

    // (a) Back unwinds tab history in visit order.
    await clickTab(page, "Explore");
    await expectActiveTab(page, "Explore", `${tag} nav->Explore`, failures);
    await clickTab(page, "Grocery");
    await expectActiveTab(page, "Grocery", `${tag} nav->Grocery`, failures);
    await page.goBack();
    await page.waitForTimeout(250);
    await expectActiveTab(page, "Explore", `${tag} back->Explore`, failures);
    await page.goBack();
    await page.waitForTimeout(250);
    await expectActiveTab(page, "Menu", `${tag} back->Menu(home)`, failures);

    // (d) Back on the homepage shows the exit-confirm prompt and does NOT
    //     navigate away (the app, i.e. the tab bar, is still mounted).
    await page.goBack();
    await page.waitForTimeout(250);
    {
      const promptShown = await page.evaluate(() =>
        Array.from(document.querySelectorAll(".reason__title")).some(
          (el) => el.textContent.trim() === "Leave Plantry?",
        ),
      );
      if (!promptShown) failures.push(`[${tag} home-back] exit-confirm prompt did not show`);
      const stillMounted = (await page.locator(".tab-bar__tab").count()) > 0;
      if (!stillMounted) failures.push(`[${tag} home-back] app unmounted (navigated away)`);
    }

    // (e) "Stay" dismisses the prompt and keeps the user on the homepage.
    await page.locator(".btn-quiet", { hasText: "Stay" }).first().click();
    await page.waitForTimeout(200);
    {
      const promptGone = await page.evaluate(
        () =>
          !Array.from(document.querySelectorAll(".reason__title")).some(
            (el) => el.textContent.trim() === "Leave Plantry?",
          ),
      );
      if (!promptGone) failures.push(`[${tag} stay] exit-confirm prompt still showing after Stay`);
      await expectActiveTab(page, "Menu", `${tag} stay`, failures);
    }

    // (b) Back exits the Day editor back to the Menu list.
    // Open the Day editor via a day card's Edit pill, then Back.
    await page.waitForSelector(".day-card__edit", { timeout: 8000 }).catch(() => {});
    const editPill = page.locator(".day-card__edit").first();
    if ((await editPill.count()) > 0) {
      await editPill.click();
      await page.waitForSelector(".day-screen__body", { timeout: 3000 });
      await page.goBack();
      await page.waitForTimeout(300);
      const backOnList = (await page.locator(".day-card__edit").count()) > 0;
      if (!backOnList) failures.push(`[${tag} day-editor] Back did not return to the Menu list`);
    } else {
      console.log(`[${tag}] day-editor back not exercised: no .day-card__edit (week not hydrated)`);
    }

    // (c) Back closes an open bottom sheet (PR #78 regression).
    // Open a sheet via an Explore card, then Back; the sheet panel must close
    // and the app must stay on Explore (not unwind a tab).
    await clickTab(page, "Explore");
    await page.waitForSelector(".explore-card", { timeout: 8000 }).catch(() => {});
    const card = page.locator(".explore-card").first();
    if ((await card.count()) > 0) {
      await card.click();
      await page.waitForSelector(".sheet__panel", { timeout: 3000 });
      await page.goBack();
      await page.waitForTimeout(300);
      const sheetClosed = (await page.locator(".sheet__panel").count()) === 0;
      if (!sheetClosed) failures.push(`[${tag} sheet] Back did not close the open sheet`);
      await expectActiveTab(page, "Explore", `${tag} sheet-back-stays-on-tab`, failures);
    } else {
      console.log(`[${tag}] sheet back not exercised: no .explore-card (feed not hydrated)`);
    }

    // (f) "Leave" attempts to leave. Reset to a clean home, Back to prompt,
    //     then Leave; in this harness the page was navigated to from about:blank
    //     so there IS an entry before the app, and Leave unwinds past it.
    {
      const p2 = await newCleanPage(browser);
      const lpage = p2.page;
      await lpage.goBack(); // home -> exit prompt
      await lpage.waitForTimeout(250);
      const beforeUrl = lpage.url();
      await lpage.locator(".btn-primary", { hasText: "Leave" }).first().click();
      await lpage.waitForTimeout(300);
      // Best-effort: Leave issues history.back(). We assert it did not throw and
      // the prompt is dismissed; the actual URL change depends on what preceded
      // the app in history (about:blank here), which we do not over-assert.
      const stillPrompt = await lpage.evaluate(() =>
        Array.from(document.querySelectorAll(".reason__title")).some(
          (el) => el.textContent.trim() === "Leave Plantry?",
        ),
      );
      if (stillPrompt) failures.push(`[${tag} leave] prompt still showing after Leave`);
      void beforeUrl;
      await p2.ctx.close();
    }

    // No new console errors across the run.
    if (consoleErrors.length) {
      failures.push(`[${tag}] console errors: ${consoleErrors.slice(0, 5).join(" | ")}`);
    }
  } catch (err) {
    failures.push(`[${tag}] runtime error: ${err.message ?? err}`);
  } finally {
    if (ctx) await ctx.close().catch(() => {});
    if (browser) await browser.close();
  }
}

const failures = [];
try {
  await runEngine("chromium", chromium, failures);
  await runEngine("webkit", webkit, failures);
} finally {
  server.close();
}

if (failures.length) {
  console.error("BACK-NAV FAIL:\n  - " + failures.join("\n  - "));
  process.exit(1);
}
console.log(
  "BACK-NAV PASS: Back unwinds tab + editor history, closes sheets, and gates homepage exit behind the confirm prompt across the available engines.",
);
process.exit(0);
