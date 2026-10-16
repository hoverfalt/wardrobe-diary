// The semantic layer in the MCP server (ROADMAP R-40 phase 2): definitions generated from semantics/*.yaml
// (via web/src/generated/semantics.json, bundled in), an `explain` lookup, and provenance attached to every
// tool answer, so an assistant can say exactly what a number means and where it comes from.
import semantics from "../../web/src/generated/semantics.json";
import type { Wardrobe } from "../../web/src/lib/publicData";
import { lastLoggedDay } from "./tools";

type Item = { id: string; label?: string; title?: string; alt_labels?: string[]; [k: string]: unknown };
const S = semantics as unknown as {
  version: string; base: string; definitionsMarkdown: string;
  terms: Item[]; metrics: Item[]; classes: Item[]; properties: Item[]; datasets: (Item & { fields: { name: string; [k: string]: unknown }[] })[];
  qualityRules: Item[]; decisions: Item[];
};

export const SEMANTIC_VERSION = S.version;
export const DEFINITIONS = S.definitionsMarkdown;
export const GLOSSARY = S.terms;
export const SEMANTIC_MODEL = { version: S.version, metrics: S.metrics, decisions: S.decisions, classes: S.classes, properties: S.properties };
export const CATALOG = { version: S.version, datasets: S.datasets, qualityRules: S.qualityRules };

const IRI: Record<string, (id: string) => string> = {
  term: (id) => `${S.base}/glossary#${id}`,
  metric: (id) => `${S.base}/model#metric-${id}`,
  class: (id) => `${S.base}/model#class-${id}`,
  prop: (id) => `${S.base}/model#prop-${id}`,
  dataset: (id) => `${S.base}/data#${id}`,
  field: (id) => `${S.base}/data#${id}`,
  decision: (id) => `${S.base}/model#decision-${id}`,
};

/** Where each tool's numbers come from: the metrics of the semantic model it computes. */
export const TOOL_METRICS: Record<string, string[]> = {
  get_overview: ["active-items"],
  get_category_listing: ["active-items", "inventory-value", "category-cost-per-wear", "days-used", "yearly-cost", "turnover", "second-hand-share"],
  list_garments: ["times-worn", "lifetime-wears", "garment-cost-per-wear", "wears-per-month"],
  get_garment: ["lifetime-wears", "garment-cost-per-wear", "wears-per-month"],
  get_wears: [],
  get_daily_cost: ["daily-cost"],
  get_inventory_over_time: ["active-items-over-time", "inventory-value-over-time"],
  get_material_breakdown: ["fibre-mass", "average-outfit-weight"],
  get_data_quality: [],
};

/** Provenance attached to a tool answer: which definitions it used, from which version, on which data. */
export function provenance(tool: string, w: Wardrobe | null) {
  return {
    semanticLayer: S.version,
    definitions: (TOOL_METRICS[tool] ?? []).map((id) => {
      const m = S.metrics.find((x) => x.id === id)!;
      return { metric: id, label: m.label, iri: IRI.metric(id) };
    }),
    data: { source: "public data document (Firestore users/{uid}/public/data)", iri: IRI.dataset("public-data"), ...(w ? { lastLoggedDay: lastLoggedDay(w), garments: w.garments.length } : {}) },
    explain: "Call the explain tool with any term or metric id for its full definition.",
  };
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const names = (x: Item) => [x.id, x.label, x.title, ...(x.alt_labels ?? [])].filter(Boolean).map((n) => norm(String(n)));

/** Full definition of a term, metric, class, dataset, field ("garments.price") or decision, by id or name. */
export function explain(query: string) {
  const q = norm(query.replace(/^(term|metric|class|prop|dataset|field|decision):/, ""));
  const out: Record<string, unknown>[] = [];
  const add = (kind: string, x: Item, extra: Record<string, unknown> = {}) => out.push({ kind, iri: IRI[kind](x.id), ...x, ...extra });
  for (const t of S.terms) if (names(t).includes(q)) add("term", t, { computedBy: t.metric ? S.metrics.find((m) => `metric:${m.id}` === t.metric) : undefined });
  for (const m of S.metrics) if (names(m).includes(q)) add("metric", m);
  for (const c of S.classes) if (names(c).includes(q)) add("class", c);
  for (const d of S.datasets) if (names(d).includes(q)) add("dataset", d, { qualityRules: S.qualityRules.filter((r) => r.dataset === `dataset:${d.id}`) });
  for (const d of S.datasets)
    for (const f of d.fields)
      if ([norm(`${d.id}.${f.name}`), norm(f.name)].includes(q)) out.push({ kind: "field", iri: IRI.field(`${d.id}.${f.name}`), dataset: d.id, ...f });
  for (const d of S.decisions) if (names(d).includes(q)) add("decision", d);
  if (out.length) return { query, semanticLayer: S.version, matches: out };
  // No exact match: suggest entries whose names contain the query words.
  const words = q.split(" ").filter((w) => w.length > 2);
  const suggestions = [...S.terms, ...S.metrics, ...S.classes, ...S.datasets, ...S.decisions]
    .filter((x) => words.length && words.every((w) => names(x).some((n) => n.includes(w))))
    .map((x) => x.id)
    .slice(0, 10);
  return { query, semanticLayer: S.version, matches: [], suggestions, hint: "Use an id or name from the glossary (wardrobe://glossary) or semantic model (wardrobe://semantic-model)." };
}
