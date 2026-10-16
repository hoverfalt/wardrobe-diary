// Nightly data quality check (ROADMAP R-40 phase 3): runs the quality rules from the semantic layer
// (src/lib/quality.ts, the same code the /data page runs) on the live public data, prints a report and exits
// with 1 if an error-severity rule fails, so the scheduled GitHub Action emails the owner.
//   node scripts/quality-check.mjs                         public data only
//   node scripts/quality-check.mjs --source backup.json    also compare the public copy with a backup
//   node scripts/quality-check.mjs --json report.json      also write the results as JSON
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};

// Bundle the TypeScript quality code on the fly (no build step, no extra dependency: esbuild comes with Vite).
const bundle = await build({
  stdin: {
    contents: `export { runQuality, publicMatchesSource } from "./src/lib/quality"; export { fetchPublicData } from "./src/lib/firestoreRest";`,
    resolveDir: WEB,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
});
const { runQuality, publicMatchesSource, fetchPublicData } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);

const semantics = JSON.parse(readFileSync(resolve(WEB, "src/generated/semantics.json"), "utf8"));
const severity = Object.fromEntries(semantics.qualityRules.map((r) => [r.id, r.severity ?? "error"]));
const data = await fetchPublicData();
const asOf = Object.keys(data.days).sort().pop();
const results = runQuality(data, semantics.qualityRules.map((r) => r.id), asOf);

const source = arg("--source");
if (source) {
  const i = results.findIndex((r) => r.id === "public-matches-source");
  results[i] = { id: "public-matches-source", ...publicMatchesSource(data, JSON.parse(readFileSync(source, "utf8"))) };
}

const icon = { pass: "✓", warn: "⚠", fail: "✕", info: "ⓘ", "not-checked": "–" };
console.log(`Data quality, semantic layer ${semantics.version}: ${data.garments.length} garments, ${Object.keys(data.days).length} logged days (last ${asOf})`);
for (const r of results) {
  console.log(`${icon[r.status]} ${r.id.padEnd(22)} ${r.summary}${r.examples.length ? `  e.g. ${r.examples.slice(0, 3).join("; ")}` : ""}`);
}
const json = arg("--json");
if (json) writeFileSync(json, JSON.stringify({ checkedAt: new Date().toISOString(), semanticVersion: semantics.version, asOf, results }, null, 1) + "\n");

const failed = results.filter((r) => r.status === "fail" && severity[r.id] === "error");
if (failed.length) {
  console.error(`\n${failed.length} rule(s) failed: ${failed.map((r) => r.id).join(", ")}`);
  process.exit(1);
}
