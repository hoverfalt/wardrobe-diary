// /data page script: runs the data quality rules on the live public data, in the browser, with the same code as
// the nightly check (lib/quality.ts), and fills in the Result column.
import semantics from "./generated/semantics.json";
import { fetchPublicData } from "./lib/firestoreRest";
import { runQuality, type QualityResult } from "./lib/quality";

const LABEL: Record<QualityResult["status"], string> = { pass: "✓", warn: "⚠", fail: "✕", info: "ⓘ", "not-checked": "–" };

async function main() {
  const summary = document.getElementById("quality-summary")!;
  try {
    const data = await fetchPublicData();
    const asOf = Object.keys(data.days).sort().pop() ?? new Date().toISOString().slice(0, 10);
    const results = runQuality(data, semantics.qualityRules.map((r: { id: string }) => r.id), asOf);
    for (const r of results) {
      const cell = document.querySelector<HTMLTableCellElement>(`tr[data-rule="${r.id}"] .result`);
      if (!cell) continue;
      cell.className = `result ${r.status === "info" ? "" : r.status}`;
      cell.textContent = `${LABEL[r.status]} ${r.summary}`;
      if (r.examples.length) cell.title = `e.g. ${r.examples.join("; ")}`;
    }
    const failed = results.filter((r) => r.status === "fail").length;
    const warned = results.filter((r) => r.status === "warn").length;
    summary.textContent = `Checked just now against the public data (${data.garments.length} garments, ${Object.keys(data.days).length} logged days, last logged ${asOf}): ${failed ? `${failed} failing` : "no failures"}${warned ? `, ${warned} with warnings` : ""}.`;
  } catch (e) {
    summary.textContent = `The checks could not run: ${e instanceof Error ? e.message : String(e)}`;
  }
}
main();
