// Headless Chrome helper for checking the signed-in UI against the local emulators (CLAUDE.md, Local testing).
// Requires: tools/emulator.sh running, and `npm run dev:emulator` (http://localhost:5174).
// Refuses to work on any page without the emulator banner, so it can never click around in production.
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const BASE = process.env.UI_BASE ?? "http://localhost:5174";
export const OUT = fileURLToPath(new URL("./out/", import.meta.url));
const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

/** Opens the app as the stand-in owner. `width` 390 = iPhone. */
export async function openApp({ width = 390, height = 844, dark = false } = {}) {
  mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 2 });
  if (dark) await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
  page.on("pageerror", (e) => console.error("page error:", e.message));
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" }); // "/" is the static landing page
  await page.waitForSelector(".emulator-banner", { timeout: 15000 }).catch(() => {
    throw new Error(`${BASE} is not in emulator mode (no banner); refusing to continue.`);
  });
  // Wait until the app knows the login state (it shows Sign in or Sign out).
  await page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => ["Sign in", "Sign out"].includes(b.textContent ?? "")), { timeout: 15000 });
  if (!(await textExists(page, "button", "Sign out"))) {
    await clickText(page, "button", "Sign in");
    await page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => b.textContent === "Sign out"), { timeout: 15000 });
  }
  return { browser, page };
}

/** Client-side navigation (keeps the signed-in session and loaded data). */
export async function go(page, path) {
  await page.evaluate((p) => {
    history.pushState(null, "", p);
    window.dispatchEvent(new Event("app:navigate"));
  }, path);
  await new Promise((r) => setTimeout(r, 500));
}

export async function textExists(page, selector, text) {
  return page.evaluate((s, t) => [...document.querySelectorAll(s)].some((e) => e.textContent?.trim() === t), selector, text);
}

/** Clicks the first element matching `selector` whose text starts with `text` (ignoring a leading ✓ / ✕). */
export async function clickText(page, selector, text) {
  const ok = await page.evaluate((s, t) => {
    // A leading ✓ / ✕ (tag toggle states) is ignored.
    const el = [...document.querySelectorAll(s)].find((e) => e.textContent?.trim().replace(/^[✓✕]\s*/, "").startsWith(t));
    el?.click();
    return !!el;
  }, selector, text);
  if (!ok) throw new Error(`No ${selector} with text "${text}"`);
  await new Promise((r) => setTimeout(r, 300));
}

export async function waitForText(page, text, timeout = 15000) {
  await page.waitForFunction((t) => document.body.innerText.includes(t), { timeout }, text);
}

/** Screenshot of the viewport (or of `selector`) to e2e/out/<name>.png; returns the path. */
export async function shot(page, name, selector) {
  const path = `${OUT}${name}.png`;
  await new Promise((r) => setTimeout(r, 400));
  if (selector) await (await page.$(selector)).screenshot({ path });
  else await page.screenshot({ path });
  return path;
}
