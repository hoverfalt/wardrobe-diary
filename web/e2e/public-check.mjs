// Loads the public pages of the live site in headless Chrome and reports page errors and the JavaScript each
// first visit downloads (R-18 code splitting). Read-only: public pages only, no sign-in.
import puppeteer from "puppeteer-core";

const BASE = process.env.UI_BASE ?? "https://wardrobediary.web.app";
const PAGES = [["/", "Category listing"], ["/category/shirts", "Shirts"], ["/garment/Shirts-031", "cost per wear"], ["/materials", "Materials"]];
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
let failed = false;
for (const [path, text] of PAGES) {
  const page = await browser.newPage(); // a fresh tab, but the browser cache is shared: later pages reuse libraries
  const errors = [];
  const js = new Map();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", async (r) => {
    if (r.url().endsWith(".js")) js.set(r.url().split("/").pop(), Number(r.headers()["content-length"] ?? 0));
  });
  await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
  const ok = await page.waitForFunction((t) => document.body.innerText.includes(t), { timeout: 20000 }, text).then(() => true, () => false);
  await new Promise((r) => setTimeout(r, 1000));
  const kb = [...js.values()].reduce((a, b) => a + b, 0) / 1024;
  console.log(`${ok && !errors.length ? "ok  " : "FAIL"} ${path}: ${js.size} JS files, ${kb.toFixed(0)} kB transferred${errors.length ? ` – ${errors.join("; ")}` : ""}`);
  console.log(`     ${[...js.keys()].map((f) => f.replace(/-[\w-]{8}\.js$/, "")).join(", ")}`);
  failed ||= !ok || errors.length > 0;
  await page.close();
}
await browser.close();
process.exitCode = failed ? 1 : 0;
