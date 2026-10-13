// Smoke check of the signed-in pages against the emulators: Log (Filters popup, logging a wear), Manage,
// Comparison. Screenshots go to e2e/out/. Run: npm run ui-check (needs tools/emulator.sh + npm run dev:emulator).
import { clickText, go, openApp, shot, waitForText } from "./browser.mjs";

const { browser, page } = await openApp({ dark: true });
const results = [];
const check = (name, ok, detail = "") => results.push(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` – ${detail}` : ""}`);
try {
  await go(page, "/log");
  await waitForText(page, " worn");
  await shot(page, "log");
  const before = await page.$eval(".log-outfit strong", (e) => e.textContent);
  await page.click(".tile:not(.on)");
  await waitForText(page, "All changes saved");
  const after = await page.$eval(".log-outfit strong", (e) => e.textContent);
  check("logging a wear updates the count", before !== after, `${before} → ${after}`);

  await clickText(page, "button", "Filters");
  await clickText(page, ".tag-toggle", "Hanko"); // neutral → include
  await clickText(page, ".tag-toggle", "Hanko"); // include → exclude
  const hidden = await page.$eval(".filter-pop-foot .muted", (e) => e.textContent);
  check("excluding Hanko hides garments", /\d+ garments hidden/.test(hidden ?? ""), hidden ?? "");
  await shot(page, "log-filters");
  await clickText(page, ".filter-pop-foot button", "Clear");
  await clickText(page, ".filter-pop-foot button", "Done");

  await go(page, "/manage");
  await waitForText(page, "Manage garments");
  await shot(page, "manage");
  await go(page, "/manage/comparison");
  await waitForText(page, "Monthly cost");
  await shot(page, "comparison");
  check("comparison lists items", (await page.$$("tbody tr")).length > 0);
} catch (e) {
  check("run", false, e.message);
  await shot(page, "error").catch(() => {});
} finally {
  await browser.close();
}
console.log(results.join("\n"));
process.exitCode = results.some((r) => r.startsWith("FAIL")) ? 1 : 0;
