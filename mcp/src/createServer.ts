// The Wardrobe Diary MCP server definition (ROADMAP R-29): read-only access to the public wardrobe data. Reads only
// the world-readable public data document. Used over stdio (src/server.ts: Claude Desktop / Claude Code) and over
// HTTP (src/http.ts: the public server at https://wardrobediary.io/mcp).
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { loadPublic, loadWardrobe } from "./publicData";
import semanticsJson from "../../web/src/generated/semantics.json";
import { runQuality } from "../../web/src/lib/quality";
import { CATALOG, DEFINITIONS, explain, GLOSSARY, provenance, SEMANTIC_MODEL, SEMANTIC_VERSION } from "./semantics";
import { TAG_IDS, type Tag } from "../../web/src/lib/tags";
import {
  categoryTable,
  lastLoggedDay,
  getDailyCost,
  getGarment,
  getWears,
  inventoryOverTime,
  listGarments,
  materialTable,
  MAX_DAILY_DAYS,
  overview,
  resolveRange,
} from "./tools";

// WARDROBE_SEMANTICS=off: run without the semantic layer (no explain tool, semantic resources or provenance), as
// the "tools only" condition of the AI evaluation (mcp/evals/).
const SEMANTICS = process.env.WARDROBE_SEMANTICS !== "off";

/** A new server with every tool and resource registered (one per stdio session or per HTTP request). */
export function createServer({ semantics = SEMANTICS }: { semantics?: boolean } = {}): McpServer {
  const server = new McpServer({ name: "wardrobe-diary", version: "0.2.0" });

  const from = z.string().optional().describe("Start date YYYY-MM-DD (default 2018-01-01, when tracking began)");
  const to = z.string().optional().describe("End date YYYY-MM-DD (default: the last logged day)");
  const category = z.string().optional().describe('Category name, e.g. "Shirts" (see get_overview)');
  const readOnly = { readOnlyHint: true, openWorldHint: false } as const;

  /** Runs a tool and returns its result as JSON text (with provenance: which definitions, which data), or the
   *  error message as a tool error. */
  async function run(tool: string, fn: () => Promise<unknown> | unknown) {
    try {
      const result = await fn();
      const body = result && typeof result === "object" && !Array.isArray(result) ? result : { result };
      const wardrobe = await loadWardrobe().catch(() => null); // provenance without data details if it can't be read
      return { content: [{ type: "text" as const, text: JSON.stringify(semantics ? { ...body, provenance: provenance(tool, wardrobe) } : body, null, 1) }] };
    } catch (e) {
      return { content: [{ type: "text" as const, text: e instanceof Error ? e.message : String(e) }], isError: true };
    }
  }

  server.registerTool(
    "get_overview",
    {
      title: "Wardrobe overview",
      description: "Start here: what the data covers (tracking start, last logged day, counts) and the categories with their active item counts.",
      annotations: readOnly,
    },
    () => run("get_overview", async () => overview(await loadWardrobe())),
  );

  server.registerTool(
    "get_category_listing",
    {
      title: "Category listing",
      description:
        "Per category for a date range: active items and inventory value at the end, cost per wear, share of days used, yearly cost, inventory turnover and the share of active items bought second hand (the Dashboard table). Includes a Total row.",
      inputSchema: { from, to },
      annotations: readOnly,
    },
    ({ from, to }) => run("get_category_listing", async () => { const w = await loadWardrobe(); return categoryTable(w, resolveRange(w, from, to)); }),
  );

  server.registerTool(
    "list_garments",
    {
      title: "List garments",
      description:
        "Garments with tags (e.g. second hand), details, materials (as written and as a parsed fibre composition), weight, price, dates, status, times worn in the range, lifetime wears, cost per wear and wears per month. Filter by category, status, search text, fibre, tag or weight; sort and limit.",
      inputSchema: {
        from,
        to,
        category,
        status: z.enum(["active", "divested", "all"]).optional().describe("Default: all"),
        search: z.string().optional().describe("Text to find in the name, details or materials"),
        fibre: z.string().optional().describe('Only garments whose main fabric contains this fibre, e.g. "wool", "polyester", "elastane"'),
        tag: z.enum(TAG_IDS as [Tag, ...Tag[]]).optional().describe("Only garments with this tag: second-hand (bought used), hanko (kept at the summer home in Hanko), bicycle or motorcycle (gear)"),
        minWeightG: z.number().optional().describe("Minimum weight in grams"),
        maxWeightG: z.number().optional().describe("Maximum weight in grams"),
        sort: z.enum(["times_worn", "cost_per_wear", "wears_per_month", "price", "purchased", "name", "weight"]).optional().describe("Default: times_worn (most first)"),
        limit: z.number().int().min(1).max(700).optional().describe("Default 50"),
      },
      annotations: readOnly,
    },
    ({ from, to, ...opts }) => run("list_garments", async () => { const w = await loadWardrobe(); return listGarments(w, { range: resolveRange(w, from, to), ...opts }); }),
  );

  server.registerTool(
    "get_garment",
    {
      title: "Garment details",
      description: "One garment by id (e.g. Jackets_and_hoodies-006) or exact name: details, materials, lifetime stats, first/last logged wear, wears per year, recent wear dates and photo URL.",
      inputSchema: { id: z.string().describe("Garment id or exact name") },
      annotations: readOnly,
    },
    ({ id }) => run("get_garment", async () => getGarment(await loadWardrobe(), id)),
  );

  server.registerTool(
    "get_wears",
    {
      title: "Wears by day",
      description: `What was worn on each day of a range (at most ${MAX_DAILY_DAYS} days).`,
      inputSchema: { from: z.string().describe("Start date YYYY-MM-DD"), to: z.string().describe("End date YYYY-MM-DD") },
      annotations: readOnly,
    },
    ({ from, to }) => run("get_wears", async () => { const w = await loadWardrobe(); return getWears(w, resolveRange(w, from, to)); }),
  );

  server.registerTool(
    "get_daily_cost",
    {
      title: "Daily cost",
      description: `Daily cost (sum of the cost per wear of the garments worn that day) for a range: per day for ranges up to ${MAX_DAILY_DAYS} days, otherwise monthly averages. Without a category, Sportswear is left out (as on the Dashboard).`,
      inputSchema: { from, to, category },
      annotations: readOnly,
    },
    ({ from, to, category }) => run("get_daily_cost", async () => { const w = await loadWardrobe(); return getDailyCost(w, resolveRange(w, from, to), category); }),
  );

  server.registerTool(
    "get_inventory_over_time",
    {
      title: "Inventory over time",
      description: "Active items or inventory value (sum of purchase prices) per category, sampled at each month end of the range.",
      inputSchema: { from, to, measure: z.enum(["items", "value"]).describe("items = number of active garments; value = sum of their purchase prices"), category },
      annotations: readOnly,
    },
    ({ from, to, measure, category }) => run("get_inventory_over_time", async () => { const w = await loadWardrobe(); return inventoryOverTime(w, resolveRange(w, from, to), measure, category); }),
  );

  server.registerTool(
    "get_material_breakdown",
    {
      title: "Material breakdown",
      description:
        "Fibre mass (kg, share, recycled and organic kg) from weight × material composition: either owned (garments active at the end of the range) or worn (every wear counts the garment's weight; also the average outfit weight). Includes how much of the data had weights and readable materials.",
      inputSchema: { from, to, basis: z.enum(["owned", "worn"]).describe("owned = wardrobe at the end of the range; worn = what was worn in the range"), category },
      annotations: readOnly,
    },
    ({ from, to, basis, category }) => run("get_material_breakdown", async () => { const w = await loadWardrobe(); return materialTable(w, resolveRange(w, from, to), basis, category); }),
  );

  if (semantics) {
    server.registerTool(
      "explain",
      {
        title: "Explain a term, metric or field",
        description:
          "The full, authoritative definition of any term (e.g. \"cost per wear\", \"days used\"), metric id, field (e.g. \"garments.price\"), dataset or decision (e.g. \"D-2\") from the semantic layer: definition, formula, grain, unit, how the date range applies, inputs, decisions behind it, implementing code and tests. Use it before interpreting a number.",
        inputSchema: { query: z.string().describe("A term, metric id, field (dataset.field), dataset id or decision id") },
        annotations: readOnly,
      },
      ({ query }) => run("explain", () => explain(query)),
    );

    server.registerTool(
      "get_data_quality",
      {
        title: "Data quality",
        description: "Runs the semantic layer's data quality rules on the current public data (unique ids, valid dates and amounts, worn garments exist, wears within ownership, materials coverage) and reports the results.",
        annotations: readOnly,
      },
      () =>
        run("get_data_quality", async () => {
          const { raw, wardrobe } = await loadPublic();
          const ids = (semanticsJson as { qualityRules: { id: string }[] }).qualityRules.map((r) => r.id);
          return { asOf: lastLoggedDay(wardrobe), results: runQuality(raw, ids, lastLoggedDay(wardrobe)) };
        }),
    );

    for (const [name, uri, title, description, body] of [
      ["glossary", "wardrobe://glossary", "Glossary", "Every term with its definition (SKOS-style JSON)", GLOSSARY],
      ["semantic-model", "wardrobe://semantic-model", "Semantic model", "Every metric (formula, grain, unit, range rule, code, tests), decisions and the conceptual model", SEMANTIC_MODEL],
      ["catalog", "wardrobe://catalog", "Data catalog", "Datasets, fields, access, lineage and quality rules", CATALOG],
    ] as const) {
      server.registerResource(name, uri, { title, description: `${description} (semantic layer ${SEMANTIC_VERSION})`, mimeType: "application/json" }, (u) => ({
        contents: [{ uri: u.href, mimeType: "application/json", text: JSON.stringify(body, null, 1) }],
      }));
    }
  }

  if (semantics) {
    server.registerResource(
      "definitions",
      "wardrobe://definitions",
      { title: "Metric definitions", description: "How every Wardrobe Diary metric is calculated", mimeType: "text/markdown" },
      (uri) => ({ contents: [{ uri: uri.href, mimeType: "text/markdown", text: DEFINITIONS }] }),
    );
  }
  return server;
}
