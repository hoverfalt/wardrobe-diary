// Smoke check of the signed-in pages against the emulators: Log (Filters popup, logging a wear), Manage,
// Comparison (including a photo upload to the Storage emulator). Screenshots go to e2e/out/. Run: npm run ui-check (needs tools/emulator.sh + npm run dev:emulator).
import { writeFileSync } from "node:fs";
import { clickText, go, openApp, OUT, shot, waitForText } from "./browser.mjs";

// Any real 228 × 228 PNG will do; read from the public bucket (read-only).
const PUBLIC_PHOTO = "https://firebasestorage.googleapis.com/v0/b/threddit-297417.appspot.com/o/Comparison-HSL.png?alt=media";

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

  // Photo upload (the Storage SDK loads on demand): replace the first item's photo in the Storage emulator.
  const png = `${OUT}upload-test.png`;
  writeFileSync(png, Buffer.from(await (await fetch(PUBLIC_PHOTO)).arrayBuffer()));
  await clickText(page, "button", "Edit");
  const input = await page.$('.comparison-form input[type="file"]');
  await input.uploadFile(png);
  await new Promise((r) => setTimeout(r, 800));
  await clickText(page, ".comparison-form button", "Save");
  const saved = await page.waitForFunction(() => !document.querySelector(".comparison-form"), { timeout: 20000 }).then(() => true, () => false);
  const error = saved ? "" : await page.$eval(".comparison-form .error", (e) => e.textContent).catch(() => "form still open");
  check("uploading a photo saves (Storage emulator)", saved, error);
} catch (e) {
  check("run", false, e.message);
  await shot(page, "error").catch(() => {});
} finally {
  await browser.close();
}
console.log(results.join("\n"));
process.exitCode = results.some((r) => r.startsWith("FAIL")) ? 1 : 0;
