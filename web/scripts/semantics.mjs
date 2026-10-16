// Generates every published form of the semantic layer (ROADMAP R-40 phase 2) from semantics/*.yaml:
//   web/src/generated/semantics.json   combined model for the app, the pages' scripts and the MCP server
//   web/public/def/*.jsonld            JSON-LD: ontology (RDFS/OWL + schema.org, PROV-O), glossary (SKOS),
//                                      metrics, catalog (DCAT + PROV-O); plus the source YAML for download
//   web/glossary.html, model.html, data.html   static, crawlable pages (served at /glossary, /model, /data)
// Run: npm run semantics (in web/). The output is committed; web/src/semantics.generated.test.ts fails when it
// is out of date, so the published forms can never drift from the YAML.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse, stringify } from "yaml";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SITE = "https://wardrobediary.io";
const REPO = "https://github.com/hoverfalt/wardrobe-diary/blob/main";
const NAMES = ["model", "ontology", "glossary", "metrics", "catalog", "decisions"];

// ---------- load ----------
export function load() {
  const src = Object.fromEntries(NAMES.map((n) => [n, parse(readFileSync(resolve(ROOT, `semantics/${n}.yaml`), "utf8"))]));
  return {
    model: src.model,
    classes: src.ontology.classes,
    properties: src.ontology.properties,
    datatypes: src.ontology.datatypes,
    terms: src.glossary.terms,
    metrics: src.metrics.metrics,
    catalog: src.catalog.catalog,
    datasets: src.catalog.datasets,
    qualityRules: src.catalog.quality_rules,
    decisions: src.decisions.decisions,
  };
}

// ---------- IRIs and links ----------
const iri = {
  class: (id) => `${SITE}/model#class-${id}`,
  prop: (id) => `${SITE}/model#prop-${id}`,
  term: (id) => `${SITE}/glossary#${id}`,
  metric: (id) => `${SITE}/model#metric-${id}`,
  dataset: (id) => `${SITE}/data#${id}`,
  field: (id) => `${SITE}/data#${id}`,
  decision: (id) => `${SITE}/model#decision-${id}`,
  rule: (id) => `${SITE}/data#rule-${id}`,
};
/** "term:cost-per-wear" → IRI; anything else unchanged. */
const ref = (s) => {
  const m = typeof s === "string" && s.match(/^(class|prop|term|metric|dataset|field|decision):(.+)$/);
  return m ? iri[m[1]](m[2]) : s;
};
const refs = (list) => (list ?? []).map(ref);
const asList = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
const PREFIXES = { schema: "https://schema.org/", prov: "http://www.w3.org/ns/prov#", qudt: "http://qudt.org/schema/qudt/" };
const expand = (curie) => {
  const m = typeof curie === "string" && curie.match(/^(\w+):(.+)$/);
  return m && PREFIXES[m[1]] ? PREFIXES[m[1]] + m[2] : curie;
};
const codeUrl = (impl) => `${REPO}/${impl.split("#")[0]}`;

// ---------- combined JSON (for the app and the MCP server) ----------
export function combined(s) {
  return {
    version: s.model.version,
    modified: s.model.modified,
    license: s.model.license,
    base: SITE,
    terms: s.terms,
    metrics: s.metrics,
    classes: s.classes,
    properties: s.properties,
    datasets: s.datasets,
    qualityRules: s.qualityRules,
    decisions: s.decisions,
    definitionsMarkdown: definitionsMarkdown(s),
  };
}

/** Plain-text definitions for AI assistants (the MCP server's wardrobe://definitions resource). */
export function definitionsMarkdown(s) {
  const lines = [
    `# Wardrobe Diary: definitions (semantic layer ${s.model.version})`,
    "",
    "Generated from the semantic layer (semantics/*.yaml); full detail: https://wardrobediary.io/glossary, /model, /data.",
    "Data: one person's daily wardrobe log since 2018-01-01; every garment with purchase price, dates, materials and weight.",
    "All metrics take a date range (from, to); by default from 2018-01-01 to the last logged day.",
    "",
    "## Terms",
    ...s.terms.map((t) => `- **${t.label}**${t.alt_labels ? ` (also: ${t.alt_labels.join(", ")})` : ""}: ${t.definition}${t.note ? ` ${t.note}` : ""}`),
    "",
    "## Metrics",
    ...s.metrics.map((m) => `- **${m.label}** [${m.id}] (${m.grain}; ${m.unit}; range: ${m.range_rule}): ${m.definition} Formula: ${m.formula}`),
    "",
    "## Decisions",
    ...s.decisions.map((d) => `- **${d.id}** (${d.date}) ${d.title}: ${d.decision}${d.amended ? ` Amended: ${d.amended}` : ""}`),
    "",
  ];
  return lines.join("\n");
}

// ---------- JSON-LD ----------
/** One default graph: the document's own node (ontology, scheme…) next to its items. A node with both its own
 *  properties and "@graph" would make the items a separate named graph, which most RDF tools don't read. */
const doc = ({ "@graph": items = [], ...head }) => ({ "@context": CONTEXT, "@graph": [Object.fromEntries(Object.entries(head).filter(([k]) => k !== "@context")), ...items] });
const CONTEXT = {
  "@vocab": `${SITE}/def/vocab#`,
  rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  owl: "http://www.w3.org/2002/07/owl#",
  skos: "http://www.w3.org/2004/02/skos/core#",
  dcat: "http://www.w3.org/ns/dcat#",
  dct: "http://purl.org/dc/terms/",
  prov: "http://www.w3.org/ns/prov#",
  schema: "https://schema.org/",
  xsd: "http://www.w3.org/2001/XMLSchema#",
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  foaf: "http://xmlns.com/foaf/0.1/",
  adms: "http://www.w3.org/ns/adms#",
};
const publisher = (s) => ({ "@type": "schema:Person", "schema:name": s.model.publisher, "schema:url": s.model.contact });

export function ontologyLd(s) {
  return doc({
    "@context": CONTEXT,
    "@id": `${SITE}/def/ontology`,
    "@type": "owl:Ontology",
    "rdfs:label": "Wardrobe Diary ontology",
    "owl:versionInfo": s.model.version,
    "dct:license": { "@id": s.model.license },
    "dct:publisher": publisher(s),
    "@graph": [
      ...s.classes.map((c) => ({
        "@id": iri.class(c.id),
        "@type": "owl:Class",
        "rdfs:label": c.label,
        "rdfs:comment": c.definition,
        ...(c.maps_to ? { "rdfs:subClassOf": { "@id": expand(c.maps_to) } } : {}),
        ...(c.see ? { "rdfs:seeAlso": refs(c.see).map((id) => ({ "@id": id })) } : {}),
        ...(c.derived ? { derived: true } : {}),
      })),
      ...s.properties.map((p) => ({
        "@id": iri.prop(p.id),
        "@type": "rdf:Property",
        "rdfs:label": p.label,
        "rdfs:comment": p.definition,
        "rdfs:domain": { "@id": iri.class(p.domain) },
        "rdfs:range": s.classes.some((c) => c.id === p.range) ? { "@id": iri.class(p.range) } : { "@id": `${SITE}/def/vocab#${p.range}` },
        ...(p.maps_to ? { "rdfs:subPropertyOf": { "@id": expand(p.maps_to) } } : {}),
        ...(p.stored_as ? { storedAs: { "@id": ref(p.stored_as) } } : {}),
      })),
    ],
  });
}

export function glossaryLd(s) {
  const scheme = `${SITE}/glossary`;
  return doc({
    "@context": CONTEXT,
    "@id": scheme,
    "@type": "skos:ConceptScheme",
    "skos:prefLabel": { "@value": "Wardrobe Diary glossary", "@language": "en" },
    "owl:versionInfo": s.model.version,
    "dct:license": { "@id": s.model.license },
    "dct:publisher": publisher(s),
    "skos:hasTopConcept": s.terms.map((t) => ({ "@id": iri.term(t.id) })),
    "@graph": s.terms.map((t) => ({
      "@id": iri.term(t.id),
      "@type": "skos:Concept",
      "skos:inScheme": { "@id": scheme },
      "skos:prefLabel": { "@value": t.label, "@language": "en" },
      ...(t.alt_labels ? { "skos:altLabel": t.alt_labels.map((a) => ({ "@value": a, "@language": "en" })) } : {}),
      "skos:definition": { "@value": t.definition, "@language": "en" },
      ...(t.note ? { "skos:scopeNote": { "@value": t.note, "@language": "en" } } : {}),
      ...(t.related ? { "skos:related": refs(t.related).map((id) => ({ "@id": id })) } : {}),
      ...(t.metric ? { "rdfs:seeAlso": { "@id": ref(t.metric) } } : {}),
      ...(t.decision ? { "dct:references": { "@id": ref(t.decision) } } : {}),
    })),
  });
}

export function metricsLd(s) {
  return doc({
    "@context": CONTEXT,
    "@id": `${SITE}/def/metrics`,
    "rdfs:label": "Wardrobe Diary semantic model (metrics)",
    "owl:versionInfo": s.model.version,
    "dct:license": { "@id": s.model.license },
    "@graph": s.metrics.map((m) => ({
      "@id": iri.metric(m.id),
      "@type": "Metric",
      "rdfs:label": m.label,
      "skos:definition": m.definition,
      formula: m.formula,
      grain: m.grain,
      unit: m.unit,
      rangeRule: m.range_rule,
      ...(m.null_when ? { nullWhen: m.null_when } : {}),
      ...(m.term ? { "dct:subject": { "@id": ref(m.term) } } : {}),
      ...(m.inputs ? { "prov:used": refs(m.inputs).map((id) => ({ "@id": id })) } : {}),
      ...(m.depends_on ? { dependsOn: refs(m.depends_on).map((id) => ({ "@id": id })) } : {}),
      ...(m.decisions ? { "dct:references": refs(m.decisions).map((id) => ({ "@id": id })) } : {}),
      implementation: { "@id": codeUrl(m.implementation) },
      ...(m.tests ? { test: m.tests } : {}),
    })),
  });
}

export function catalogLd(s) {
  const access = { public: "PUBLIC", "owner-only": "RESTRICTED", private: "NON_PUBLIC" };
  return {
    "@context": CONTEXT,
    "@id": `${SITE}/data`,
    "@type": "dcat:Catalog",
    "dct:title": s.catalog.title,
    "dct:license": { "@id": s.catalog.license },
    "dct:publisher": publisher(s),
    "foaf:homepage": { "@id": s.catalog.homepage },
    "dct:temporal": { "@type": "dct:PeriodOfTime", "dcat:startDate": s.catalog.temporal_coverage.from },
    "owl:versionInfo": s.model.version,
    "dcat:dataset": s.datasets.map((d) => ({
      "@id": iri.dataset(d.id),
      "@type": "dcat:Dataset",
      "dct:title": d.title,
      "dct:description": d.description.trim(),
      "dct:accessRights": { "@id": `http://publications.europa.eu/resource/authority/access-right/${access[d.classification]}` },
      classification: d.classification,
      location: d.location,
      ...(d.status ? { "adms:status": d.status } : {}),
      ...(d.represents ? { "dct:subject": { "@id": ref(d.represents) } } : {}),
      ...(d.distribution ? { "dcat:distribution": d.distribution.map((x) => ({ "@type": "dcat:Distribution", "dct:format": x.format, "dcat:accessURL": x.url })) } : {}),
      ...(d.lineage
        ? {
            "prov:wasDerivedFrom": d.lineage.flatMap((l) => asList(l.from).filter((f) => String(f).startsWith("dataset:")).map((f) => ({ "@id": ref(f) }))),
            "prov:qualifiedDerivation": d.lineage.map((l) => ({
              "@type": "prov:Derivation",
              "prov:entity": asList(l.from).map((f) => (String(f).startsWith("dataset:") ? { "@id": ref(f) } : f)),
              "prov:hadActivity": l.activity,
              ...(l.since ? { since: String(l.since) } : {}),
              ...(l.until ? { until: String(l.until) } : {}),
              ...(l.decision ? { "dct:references": { "@id": ref(l.decision) } } : {}),
            })),
          }
        : {}),
      "schema:variableMeasured": d.fields.map((f) => ({
        "@id": iri.field(`${d.id}.${f.name}`),
        "@type": "schema:PropertyValue",
        "schema:name": f.name,
        "schema:description": f.definition,
        "schema:valueReference": f.type,
        required: Boolean(f.required),
        ...(f.constraints ? { constraints: f.constraints } : {}),
        ...(f.term ? { "dct:subject": { "@id": ref(f.term) } } : {}),
      })),
    })),
    qualityRule: s.qualityRules.map((r) => ({ "@id": iri.rule(r.id), "dct:description": r.rule, "dct:subject": { "@id": ref(r.dataset) }, severity: r.severity ?? "error" })),
  };
}

// ---------- Data contracts (Open Data Contract Standard v3) ----------
const LOGICAL = { text: "string", date: "date", timestamp: "date", integer: "integer", boolean: "boolean", "money-eur": "number", "mass-g": "number", share: "number" };
const logicalType = (t) => LOGICAL[t] ?? (String(t).startsWith("list") ? "array" : "object");

/** One ODCS v3 contract per dataset with fields: schema, constraints and the catalogued quality rules. */
export function contract(s, d) {
  const rules = s.qualityRules.filter((r) => r.dataset === `dataset:${d.id}`);
  return {
    apiVersion: "v3.0.2",
    kind: "DataContract",
    id: `wardrobe-diary-${d.id}`,
    name: d.title,
    version: s.model.version,
    status: d.status === "retired" ? "retired" : "active",
    domain: "wardrobe-diary",
    dataProduct: "The Wardrobe Diary Project",
    description: {
      purpose: d.description.trim(),
      usage: d.classification === "public" ? "Public: free to use under CC BY 4.0 with attribution." : `Not public (${d.classification}); described for transparency.`,
    },
    team: [{ username: "hoverfalt", name: s.model.steward, role: "owner" }],
    servers: [{ server: d.id, type: "custom", description: d.location }],
    schema: [
      {
        name: d.id,
        physicalName: d.location,
        logicalType: "object",
        description: d.description.trim(),
        properties: d.fields.map((f) => ({
          name: f.name,
          logicalType: logicalType(f.type),
          physicalType: String(f.type),
          required: Boolean(f.required),
          ...(d.key === f.name ? { primaryKey: true, unique: true } : {}),
          description: f.definition,
          ...(f.constraints ? { quality: [{ type: "text", description: f.constraints }] } : {}),
          ...(f.term ? { authoritativeDefinitions: [{ type: "businessDefinition", url: ref(f.term) }] } : {}),
        })),
        ...(rules.length ? { quality: rules.map((r) => ({ name: r.id, type: "text", description: r.rule, severity: r.severity ?? "error", authoritativeDefinitions: [{ type: "implementation", url: `${REPO}/web/src/lib/quality.ts` }] })) } : {}),
      },
    ],
    slaProperties: [{ property: "frequency", value: d.update_frequency ?? s.catalog.update_frequency }],
    authoritativeDefinitions: [{ type: "catalog", url: iri.dataset(d.id) }],
  };
}

// ---------- HTML pages ----------
const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** Text with "term:x" / "metric:x" … references turned into links. */
const linkRef = (s, r) => {
  const m = r.match(/^(class|prop|term|metric|dataset|field|decision):(.+)$/);
  if (!m) return esc(r);
  const label =
    m[1] === "term" ? s.terms.find((t) => t.id === m[2])?.label :
    m[1] === "metric" ? s.metrics.find((x) => x.id === m[2])?.label :
    m[1] === "class" ? s.classes.find((x) => x.id === m[2])?.label :
    m[1] === "dataset" ? s.datasets.find((x) => x.id === m[2])?.title :
    m[1] === "decision" ? m[2] : m[2];
  const href = iri[m[1]](m[2]).replace(SITE, "");
  return `<a href="${href}">${esc(label ?? m[2])}</a>`;
};
const linkList = (s, list) => asList(list).map((r) => linkRef(s, String(r))).join(", ");

function page(s, { path, title, description, intro, body, jsonld, script }) {
  return `<!doctype html>
<!-- Generated by web/scripts/semantics.mjs from semantics/*.yaml (semantic layer ${s.model.version}). Do not edit. -->
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(title)} – The Wardrobe Diary Project</title>
    <meta name="description" content="${esc(description)}" />
    <link rel="canonical" href="${SITE}${path}" />
    <meta property="og:title" content="${esc(title)} – The Wardrobe Diary Project" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:url" content="${SITE}${path}" />
    <link rel="alternate" type="application/ld+json" href="${jsonld.href}" />
    <script type="application/ld+json">${JSON.stringify(jsonld.data).replace(/</g, "\\u003c")}</script>
    <script>
      if (location.hostname === "wardrobediary.io") {
        var ga = document.createElement("script"); ga.async = true; ga.src = "https://www.googletagmanager.com/gtag/js?id=G-HYJZNEMFV0";
        document.head.appendChild(ga); window.dataLayer = window.dataLayer || [];
        window.gtag = function () { dataLayer.push(arguments); }; gtag("js", new Date()); gtag("config", "G-HYJZNEMFV0");
      }
    </script>
    <link rel="stylesheet" href="/src/semantic-pages.css" />
  </head>
  <body>
    <main class="landing semantic">
      <nav class="landing-nav">
        <a href="/">The project</a>
        <a href="/dashboard">My wardrobe data</a>
        <a href="/glossary"${path === "/glossary" ? ' aria-current="page"' : ""}>Glossary</a>
        <a href="/model"${path === "/model" ? ' aria-current="page"' : ""}>Model</a>
        <a href="/data"${path === "/data" ? ' aria-current="page"' : ""}>Data</a>
        <a href="/evals"${path === "/evals" ? ' aria-current="page"' : ""}>AI evaluation</a>
      </nav>
      <h1>${esc(title)}</h1>
      ${intro}
      <p class="meta">Semantic layer version ${esc(s.model.version)} (${esc(s.model.modified)}) · <a href="${jsonld.href}">JSON-LD</a> ·
        <a href="https://github.com/hoverfalt/wardrobe-diary/tree/main/semantics">source (YAML)</a> ·
        <a href="${esc(s.model.license)}">CC BY 4.0</a></p>
${body}
      <footer>Generated from the <a href="https://github.com/hoverfalt/wardrobe-diary/tree/main/semantics">semantic layer</a>,
        which tests keep in line with the app's code. © ${esc(s.model.publisher)}, CC BY 4.0.</footer>
    </main>${script ? `\n    <script type="module" src="${script}"></script>` : ""}
  </body>
</html>
`;
}

export function glossaryHtml(s) {
  const body = `      <dl class="glossary">
${s.terms
  .map(
    (t) => `        <div id="${esc(t.id)}" class="entry">
          <dt>${esc(t.label)}${t.alt_labels ? ` <span class="alt">also: ${t.alt_labels.map(esc).join(", ")}</span>` : ""}</dt>
          <dd>
            <p>${esc(t.definition)}</p>
            ${t.note ? `<p class="note">${esc(t.note)}</p>` : ""}
            ${t.metric || t.decision || t.related ? `<p class="links">${[t.metric && `Computed by: ${linkRef(s, t.metric)}`, t.decision && `Decision: ${linkRef(s, t.decision)}`, t.related && `Related: ${linkList(s, t.related)}`].filter(Boolean).join(" · ")}</p>` : ""}
          </dd>
        </div>`,
  )
  .join("\n")}
      </dl>`;
  return page(s, {
    path: "/glossary",
    title: "Glossary",
    description: "Definitions of every term used in the Wardrobe Diary data: cost per wear, days used, ownership, wears and more.",
    intro: `<p class="lead">What every term in the Wardrobe Diary means. These definitions are what the app computes and what AI assistants get through the MCP server; each links to the metric that computes it.</p>`,
    body,
    jsonld: { href: "/def/glossary.jsonld", data: glossaryLd(s) },
  });
}

export function mermaidModel(s) {
  const lines = ["classDiagram"];
  for (const c of s.classes) {
    const props = s.properties.filter((p) => p.domain === c.id && !s.classes.some((k) => k.id === p.range));
    lines.push(`  class ${c.id} {`, ...props.map((p) => `    ${p.range} ${p.id}`), "  }");
  }
  for (const p of s.properties.filter((p) => s.classes.some((k) => k.id === p.range))) lines.push(`  ${p.domain} --> ${p.range} : ${p.id}`);
  return lines.join("\n");
}

export function modelHtml(s) {
  const metricCards = s.metrics
    .map(
      (m) => `        <article id="metric-${esc(m.id)}" class="card">
          <h3>${esc(m.label)} <code>${esc(m.id)}</code></h3>
          <p>${esc(m.definition)}</p>
          <pre><code>${esc(m.formula)}</code></pre>
          <dl class="facts">
            <dt>Grain</dt><dd>${esc(m.grain)}</dd>
            <dt>Unit</dt><dd>${esc(m.unit)}</dd>
            <dt>Date range</dt><dd>${esc(m.range_rule)}</dd>
            ${m.null_when ? `<dt>Empty when</dt><dd>${esc(m.null_when)}</dd>` : ""}
            ${m.term ? `<dt>Term</dt><dd>${linkRef(s, m.term)}</dd>` : ""}
            ${m.inputs ? `<dt>Inputs</dt><dd>${linkList(s, m.inputs)}</dd>` : ""}
            ${m.depends_on ? `<dt>Uses</dt><dd>${linkList(s, m.depends_on)}</dd>` : ""}
            ${m.decisions ? `<dt>Decisions</dt><dd>${linkList(s, m.decisions)}</dd>` : ""}
            <dt>Code</dt><dd><a href="${esc(codeUrl(m.implementation))}"><code>${esc(m.implementation)}</code></a></dd>
            ${m.tests ? `<dt>Tests</dt><dd>${m.tests.map((t) => esc(t.split(" › ")[1])).join("<br />")}</dd>` : ""}
          </dl>
          ${m.note ? `<p class="note">${esc(m.note)}</p>` : ""}
        </article>`,
    )
    .join("\n");
  const classRows = s.classes
    .map((c) => `          <tr id="class-${esc(c.id)}"><td><strong>${esc(c.label)}</strong>${c.derived ? ' <span class="alt">derived</span>' : ""}</td><td>${esc(c.definition)}</td><td>${c.maps_to ? `<code>${esc(c.maps_to)}</code>` : ""}</td><td>${c.stored_as ? linkRef(s, c.stored_as) : ""}</td></tr>`)
    .join("\n");
  const propRows = s.properties
    .map((p) => `          <tr id="prop-${esc(p.id)}"><td><code>${esc(p.id)}</code></td><td>${esc(p.domain)} → ${esc(p.range)}</td><td>${esc(p.definition)}</td><td>${p.maps_to ? `<code>${esc(p.maps_to)}</code>` : ""}</td></tr>`)
    .join("\n");
  const decisionList = s.decisions
    .map((d) => `        <article id="decision-${esc(d.id)}" class="card"><h3>${esc(d.id)}: ${esc(d.title)} <span class="alt">${esc(d.date)}</span></h3><p>${esc(d.decision)}</p>${d.rationale ? `<p class="note">Why: ${esc(d.rationale)}</p>` : ""}${d.amended ? `<p class="note">Amended: ${esc(d.amended)}</p>` : ""}${d.affects?.length ? `<p class="links">Affects: ${linkList(s, d.affects)}</p>` : ""}</article>`)
    .join("\n");
  const body = `      <h2 id="conceptual-model">Conceptual model</h2>
      <p>The things the data is about and how they relate. Arrows are relations; the attributes are stored fields or derived values.</p>
      <pre class="mermaid">${esc(mermaidModel(s))}</pre>
      <div class="table-wrap"><table>
        <thead><tr><th>Class</th><th>Definition</th><th>Aligned with</th><th>Stored as</th></tr></thead>
        <tbody>
${classRows}
        </tbody>
      </table></div>
      <h3>Properties</h3>
      <div class="table-wrap"><table>
        <thead><tr><th>Property</th><th>From → to</th><th>Definition</th><th>Aligned with</th></tr></thead>
        <tbody>
${propRows}
        </tbody>
      </table></div>

      <h2 id="metrics">Metrics (semantic model)</h2>
      <p>Every figure the app and the MCP server compute: its definition, formula, grain, unit, how the chosen date range applies, the decisions behind it, and the code and tests that implement it. Shared rules: wears outside a garment's ownership period never count; dates are inclusive; one month is 30.5 days.</p>
${metricCards}

      <h2 id="decisions">Decisions</h2>
${decisionList}`;
  return page(s, {
    path: "/model",
    title: "Model",
    description: "The Wardrobe Diary conceptual model and semantic model: classes, relations and every metric with its formula, code and tests.",
    intro: `<p class="lead">How the Wardrobe Diary data is structured and how every figure is calculated, traceable down to the code and tests.</p>`,
    body,
    jsonld: { href: "/def/metrics.jsonld", data: metricsLd(s) },
    script: "/src/model-page.ts",
  });
}

export function dataHtml(s) {
  const badge = (c) => `<span class="class-badge ${esc(c)}">${esc(c)}</span>`;
  const datasets = s.datasets
    .map(
      (d) => `        <article id="${esc(d.id)}" class="card">
          <h3>${esc(d.title)} ${badge(d.classification)}${d.status ? ` <span class="alt">${esc(d.status)}</span>` : ""}</h3>
          <p>${esc(d.description)}</p>
          <dl class="facts">
            <dt>Where</dt><dd><code>${esc(d.location)}</code></dd>
            ${d.fields.length ? `<dt>Contract</dt><dd><a href="/def/contracts/${esc(d.id)}.odcs.yaml">ODCS data contract</a></dd>` : ""}
            ${d.represents ? `<dt>Represents</dt><dd>${linkRef(s, d.represents)}</dd>` : ""}
            ${d.published_via ? `<dt>Published via</dt><dd>${linkList(s, d.published_via)}</dd>` : ""}
            ${d.update_frequency ? `<dt>Updated</dt><dd>${esc(d.update_frequency)}</dd>` : ""}
            ${d.distribution ? `<dt>Access</dt><dd>${d.distribution.map((x) => `${esc(x.format)}: ${String(x.url).startsWith("http") ? `<a href="${esc(x.url)}">${esc(x.url.replace(/^https?:\/\//, "").slice(0, 60))}${x.url.length > 68 ? "…" : ""}</a>` : esc(x.url)}`).join("<br />")}</dd>` : ""}
            ${d.lineage ? `<dt>Lineage</dt><dd>${d.lineage.map((l) => `from ${linkList(s, l.from)}: ${esc(l.activity)}${l.since ? ` (since ${esc(l.since)})` : ""}${l.until ? ` (until ${esc(l.until)})` : ""}${l.decision ? ` – ${linkRef(s, l.decision)}` : ""}`).join("<br />")}</dd>` : ""}
          </dl>
          ${d.fields.length ? `<div class="table-wrap"><table>
            <thead><tr><th>Field</th><th>Type</th><th>Required</th><th>Definition</th><th>Constraints</th></tr></thead>
            <tbody>
${d.fields.map((f) => `              <tr id="${esc(d.id)}.${esc(f.name)}"><td><code>${esc(f.name)}</code></td><td>${esc(f.type)}</td><td>${f.required ? "yes" : ""}</td><td>${esc(f.definition)}${f.term ? ` (${linkRef(s, f.term)})` : ""}</td><td>${esc(f.constraints ?? "")}</td></tr>`).join("\n")}
            </tbody>
          </table></div>` : ""}
        </article>`,
    )
    .join("\n");
  const rules = s.qualityRules
    .map((r) => `          <tr id="rule-${esc(r.id)}" data-rule="${esc(r.id)}"><td><code>${esc(r.id)}</code></td><td>${linkRef(s, r.dataset)}</td><td>${esc(r.rule)}${r.note ? ` <span class="alt">${esc(r.note)}</span>` : ""}</td><td>${esc(r.severity ?? "error")}</td><td class="result">–</td></tr>`)
    .join("\n");
  const body = `      <h2 id="quality">Data quality</h2>
      <p>The rules the data must meet. The results below are computed in your browser from the public data when the page loads, with the same code that checks the data every night.</p>
      <p id="quality-summary" class="note">Checking…</p>
      <div class="table-wrap"><table class="quality">
        <thead><tr><th>Rule</th><th>Dataset</th><th>Requirement</th><th>Severity</th><th>Result</th></tr></thead>
        <tbody>
${rules}
        </tbody>
      </table></div>

      <h2 id="datasets">Datasets</h2>
      <p>Classification: ${badge("public")} readable by anyone (published by choice) · ${badge("owner-only")} only the signed-in owner · ${badge("private")} not exposed by the app. All data describes one identifiable person, who publishes the public parts by choice.</p>
${datasets}`;
  return page(s, {
    path: "/data",
    title: "Data catalog",
    description: "The Wardrobe Diary data catalog: datasets, fields, access, lineage and live data quality results.",
    intro: `<p class="lead">Every dataset behind the Wardrobe Diary: what it holds, who can read it, where it comes from and how good it is. Licence: ${esc(s.catalog.license.includes("by/4.0") ? "CC BY 4.0" : s.catalog.license)}.</p>`,
    body,
    jsonld: { href: "/def/catalog.jsonld", data: catalogLd(s) },
    script: "/src/data-page.ts",
  });
}

// ---------- AI evaluation page (R-40 phase 4; inputs from mcp/evals/) ----------
const readJson = (file) => {
  try {
    return JSON.parse(readFileSync(resolve(ROOT, file), "utf8"));
  } catch {
    return null;
  }
};
const fmtExpected = (e) =>
  e.type === "number" ? `${Math.round(e.value * 1000) / 1000} ${e.unit === "count" ? "" : e.unit} (± ${e.tolerance})`.replace("  ", " ") : e.type === "name" ? e.oneOf.join(" / ") : e.value.join("; ");
/** Minimal Markdown (## headings, - bullets, **bold**, `code`, paragraphs) for the evaluation findings. */
const markdown = (md) => {
  const inline = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/`(.+?)`/g, "<code>$1</code>");
  const out = [];
  let list = false;
  for (const line of md.split("\n")) {
    if (line.startsWith("- ")) {
      if (!list) out.push("<ul>");
      list = true;
      out.push(`<li>${inline(line.slice(2))}</li>`);
      continue;
    }
    if (list) out.push("</ul>");
    list = false;
    if (line.startsWith("## ")) out.push(`<h3>${inline(line.slice(3))}</h3>`);
    else if (line.trim()) out.push(`<p>${inline(line)}</p>`);
  }
  if (list) out.push("</ul>");
  return out.map((l) => `      ${l}`).join("\n");
};
const readText = (file) => {
  try {
    return readFileSync(resolve(ROOT, file), "utf8");
  } catch {
    return "";
  }
};

const CONDITION_LABEL = { raw: "Raw data in the prompt", tools: "MCP tools", semantic: "MCP tools + semantic layer" };

export function evalsHtml(s) {
  const expected = readJson("mcp/evals/expected.json");
  const summary = readJson("mcp/evals/results/summary.json");
  const results = summary?.summary ?? [];
  const models = [...new Set(results.map((r) => r.model))];
  const kinds = ["all", "lookup", "metric", "definition"];
  const resultsTable = results.length
    ? models
        .map(
          (m) => `      <h3>${esc(m)}</h3>
      <div class="table-wrap"><table>
        <thead><tr><th>Condition</th>${kinds.map((k) => `<th class="num">${k === "all" ? "All questions" : esc(k)}</th>`).join("")}<th class="num">Avg tokens</th><th class="num">Avg tool calls</th></tr></thead>
        <tbody>
${["raw", "tools", "semantic"]
  .map((c) => {
    const cell = (k) => results.find((r) => r.model === m && r.condition === c && r.kind === k);
    const all = cell("all");
    if (!all) return "";
    return `          <tr><td>${esc(CONDITION_LABEL[c])}</td>${kinds.map((k) => (cell(k) ? `<td class="num"><strong>${Math.round(cell(k).accuracy * 100)} %</strong> <span class="alt">${cell(k).correct}/${cell(k).total}</span></td>` : '<td class="num">–</td>')).join("")}<td class="num">${all.avgTokens.toLocaleString("en-GB")}</td><td class="num">${all.avgToolCalls.toFixed(1)}</td></tr>`;
  })
  .join("\n")}
        </tbody>
      </table></div>`,
        )
        .join("\n")
    : `      <p class="note">Not run yet: the question set and the correct answers are ready (below); results appear here after the first run.</p>`;
  const questions = expected
    ? `      <div class="table-wrap"><table>
        <thead><tr><th>Question</th><th>Kind</th><th>Correct answer</th><th>Metrics</th></tr></thead>
        <tbody>
${expected.questions.map((q) => `          <tr id="q-${esc(q.id)}"><td>${esc(q.question)}</td><td>${esc(q.kind)}</td><td>${esc(fmtExpected(q.expected))}</td><td>${linkList(s, q.metrics.map((m) => `metric:${m}`))}</td></tr>`).join("\n")}
        </tbody>
      </table></div>`
    : "";
  const body = `      <h2 id="question">The question</h2>
      <p>Does a governed semantic layer make an AI assistant's answers about this data more reliable? The same ${expected ? expected.questions.length : ""} questions are put to the same model under three conditions, and every answer is graded in code against the correct value, computed with the app's own metrics from a frozen snapshot of the data${expected ? ` (taken ${esc(expected.snapshot.takenAt)}, last logged day ${esc(expected.snapshot.lastLoggedDay)})` : ""}. No AI judges the answers.</p>
      <dl class="facts">
        <dt>Raw data</dt><dd>The public data document pasted into the prompt, with a short note on its format. No tools.</dd>
        <dt>MCP tools</dt><dd>The <a href="https://github.com/hoverfalt/wardrobe-diary/tree/main/mcp">MCP server</a>'s tools on the snapshot, with the semantic layer switched off: no definitions, no <code>explain</code> tool, no provenance.</dd>
        <dt>Tools + semantic layer</dt><dd>The same server with the semantic layer: every definition in the prompt, the <code>explain</code> tool, and provenance (which definitions a number comes from) in every answer.</dd>
      </dl>
      <p>Questions come in three kinds: <strong>lookup</strong> (a stored fact), <strong>metric</strong> (a defined figure where a plain reading usually works) and <strong>definition</strong> (where the precise definition matters: lifetime cost per wear, unworn garments, ownership periods, Sportswear left out of daily cost…).</p>

      <h2 id="results">Results</h2>
${resultsTable}
${markdown(readText("mcp/evals/findings.md"))}

      <h2 id="questions">Questions and correct answers</h2>
${questions}
      <p class="note">Code: <a href="https://github.com/hoverfalt/wardrobe-diary/tree/main/mcp/evals">mcp/evals</a> (questions, runner, grading). Run it yourself with an Anthropic API key: <code>cd mcp && npm run evals -- run</code>.</p>`;
  return page(s, {
    path: "/evals",
    title: "AI evaluation",
    description: "Does a governed semantic layer make AI answers about data more reliable? The same questions under three conditions, graded against computed answers.",
    intro: `<p class="lead">An experiment: how often does an AI assistant answer questions about this data correctly with raw data, with tools, and with tools plus the semantic layer?</p>`,
    body,
    jsonld: { href: "/def/metrics.jsonld", data: { "@context": CONTEXT, "@id": `${SITE}/evals`, "@type": "schema:Dataset", "schema:name": "Wardrobe Diary AI evaluation", "schema:license": s.model.license } },
  });
}

// ---------- write ----------
export function outputs(s) {
  const json = (v) => JSON.stringify(v, null, 1) + "\n";
  const out = {
    "web/src/generated/semantics.json": json(combined(s)),
    "web/public/def/ontology.jsonld": json(ontologyLd(s)),
    "web/public/def/glossary.jsonld": json(glossaryLd(s)),
    "web/public/def/metrics.jsonld": json(metricsLd(s)),
    "web/public/def/catalog.jsonld": json(catalogLd(s)),
    "web/glossary.html": glossaryHtml(s),
    "web/model.html": modelHtml(s),
    "web/data.html": dataHtml(s),
    "web/evals.html": evalsHtml(s),
  };
  for (const d of s.datasets.filter((x) => x.fields.length)) {
    out[`web/public/def/contracts/${d.id}.odcs.yaml`] = `# Generated by web/scripts/semantics.mjs from semantics/catalog.yaml. Do not edit.\n${stringify(contract(s, d), { lineWidth: 0 })}`;
  }
  for (const n of NAMES) out[`web/public/def/${n}.yaml`] = readFileSync(resolve(ROOT, `semantics/${n}.yaml`), "utf8");
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const files = outputs(load());
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(dirname(resolve(ROOT, file)), { recursive: true });
    writeFileSync(resolve(ROOT, file), content);
  }
  console.log(`Generated ${Object.keys(files).length} files from semantics/ (version ${load().model.version}).`);
}
