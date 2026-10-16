import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFINITIONS, explain, SEMANTIC_MODEL, TOOL_METRICS } from "./semantics";

describe("semantic layer in the MCP server", () => {
  it("explains terms by name or synonym, metrics, fields and decisions", () => {
    expect(explain("cost per wear").matches[0]).toMatchObject({ kind: "term", id: "cost-per-wear" });
    expect(explain("frequency of use").matches[0]).toMatchObject({ kind: "term", id: "days-used" });
    expect(explain("metric:category-cost-per-wear").matches[0]).toMatchObject({ kind: "metric", grain: "category" });
    expect(explain("garments.price").matches[0]).toMatchObject({ kind: "field", dataset: "garments" });
    expect(explain("D-2").matches[0]).toMatchObject({ kind: "decision" });
  });

  it("suggests entries when nothing matches exactly", () => {
    const r = explain("wear cost");
    expect(r.matches).toEqual([]);
    expect(r.suggestions).toContain("cost-per-wear");
  });

  it("names only existing metrics in each tool's provenance, for every registered tool", () => {
    const ids = new Set(SEMANTIC_MODEL.metrics.map((m) => m.id));
    expect(Object.values(TOOL_METRICS).flat().filter((id) => !ids.has(id))).toEqual([]);
    const registered = [...readFileSync(new URL("./server.ts", import.meta.url), "utf8").matchAll(/registerTool\(\s*"([a-z_]+)"/g)].map((m) => m[1]);
    expect(registered.filter((t) => t !== "explain" && !(t in TOOL_METRICS))).toEqual([]);
  });

  it("serves generated definitions", () => {
    expect(DEFINITIONS).toContain(`semantic layer ${SEMANTIC_MODEL.version}`);
    expect(DEFINITIONS).toContain("Cost per wear");
  });
});
