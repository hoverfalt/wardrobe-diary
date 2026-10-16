// Consistency checks between the semantic layer (semantics/*.yaml, ROADMAP R-40) and the code: the definitions
// may not drift from what the app actually does. Fails when an id is duplicated, a reference doesn't resolve,
// a metric points at code or tests that don't exist, or the data model and the catalog disagree.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { CATEGORY_ORDER } from "./lib/categories";
import { TAG_IDS } from "./lib/tags";

const ROOT = resolve(__dirname, "../..");
const read = (file: string) => readFileSync(resolve(ROOT, file), "utf8");
const load = (name: string) => parse(read(`semantics/${name}.yaml`));

const model = load("model");
const ontology = load("ontology");
const glossary = load("glossary");
const metrics = load("metrics");
const catalog = load("catalog");
const decisions = load("decisions");

type Item = { id: string; [k: string]: unknown };
const ids = (items: Item[]) => items.map((i) => i.id);

// Everything that can be referred to, by prefix.
const known: Record<string, Set<string>> = {
  class: new Set(ids(ontology.classes)),
  prop: new Set(ids(ontology.properties)),
  term: new Set(ids(glossary.terms)),
  metric: new Set(ids(metrics.metrics)),
  dataset: new Set(ids(catalog.datasets)),
  field: new Set(catalog.datasets.flatMap((d: Item & { fields: { name: string }[] }) => d.fields.map((f) => `${d.id}.${f.name}`))),
  decision: new Set(ids(decisions.decisions)),
};

/** Every string value anywhere in a parsed document. */
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

describe("semantic layer", () => {
  it("has model metadata with a semantic version", () => {
    expect(model.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(model.changelog.map((c: { version: string }) => c.version)).toContain(model.version);
  });

  it("has unique ids within each kind", () => {
    for (const items of [ontology.classes, ontology.properties, glossary.terms, metrics.metrics, catalog.datasets, decisions.decisions]) {
      const list = ids(items);
      expect(list.filter((id, i) => list.indexOf(id) !== i)).toEqual([]);
    }
  });

  it("resolves every prefixed reference", () => {
    const unresolved: string[] = [];
    for (const doc of [ontology, glossary, metrics, catalog, decisions]) {
      for (const s of strings(doc)) {
        const m = s.match(/^(class|prop|term|metric|dataset|field|decision):(.+)$/);
        if (m && !known[m[1]].has(m[2])) unresolved.push(s);
      }
    }
    expect(unresolved).toEqual([]);
  });

  it("points every metric at code that exists", () => {
    const missing: string[] = [];
    for (const m of metrics.metrics as { id: string; implementation: string }[]) {
      const [file, name] = m.implementation.split("#");
      const source = existsSync(resolve(ROOT, file)) ? read(file) : "";
      if (!new RegExp(`export (async )?(function|const|class) ${name}\\b`).test(source)) missing.push(`${m.id}: ${m.implementation}`);
    }
    expect(missing).toEqual([]);
  });

  it("points every metric at tests that exist", () => {
    const missing: string[] = [];
    for (const m of metrics.metrics as { id: string; tests?: string[] }[]) {
      for (const t of m.tests ?? []) {
        const [file, name] = t.split(" › ");
        const source = existsSync(resolve(ROOT, file)) ? read(file) : "";
        if (!source.includes(`it("${name}"`)) missing.push(`${m.id}: ${t}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("gives every metric a definition, formula, grain, unit and range rule", () => {
    for (const m of metrics.metrics) {
      for (const key of ["label", "definition", "formula", "grain", "unit", "range_rule"]) expect(m[key], `${m.id}.${key}`).toBeTruthy();
    }
  });

  it("catalogues exactly the fields of the Garment type", () => {
    const types = read("web/src/types.ts");
    const body = types.match(/export interface Garment \{([\s\S]*?)\n\}/)![1];
    const codeFields = [...body.matchAll(/^\s{2}(\w+)\??:/gm)].map((m) => m[1]).sort();
    const garments = catalog.datasets.find((d: Item) => d.id === "garments");
    expect(garments.fields.map((f: { name: string }) => f.name).sort()).toEqual(codeFields);
  });

  it("catalogues every Firestore collection the app writes", () => {
    const repo = read("web/src/data/repo.ts");
    const collections = new Set([...repo.matchAll(/"users", \w+, "(\w+)"/g)].map((m) => m[1]));
    const locations = catalog.datasets.map((d: { location: string }) => d.location).join(" ");
    expect([...collections].filter((c) => !locations.includes(`users/{uid}/${c}`))).toEqual([]);
  });

  it("matches the code's vocabularies (categories and tags)", () => {
    const category = glossary.terms.find((t: Item) => t.id === "category");
    for (const c of CATEGORY_ORDER) expect(category.definition, c).toContain(c);
    const tags = catalog.datasets.find((d: Item) => d.id === "garments").fields.find((f: { name: string }) => f.name === "tags");
    expect(tags.constraints).toBe(`each one of: ${TAG_IDS.join(", ")}`);
  });

  it("only cites decisions that are in the roadmap's decision log", () => {
    const roadmap = read("ROADMAP.md");
    for (const d of decisions.decisions as { id: string }[]) {
      if (/^(D|Q|R)-\d+$/.test(d.id)) expect(roadmap, d.id).toContain(d.id);
    }
  });
});
