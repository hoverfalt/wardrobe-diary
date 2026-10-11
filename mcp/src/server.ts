// Wardrobe Diary MCP server (ROADMAP R-29, phase 1): read-only access to the public wardrobe data over
// stdio, for Claude Desktop / Claude Code. Reads only the world-readable public data document.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadWardrobe } from "./publicData";
import {
  categoryTable,
  DEFINITIONS,
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

const server = new McpServer({ name: "wardrobe-diary", version: "0.1.0" });

const from = z.string().optional().describe("Start date YYYY-MM-DD (default 2018-01-01, when tracking began)");
const to = z.string().optional().describe("End date YYYY-MM-DD (default: the last logged day)");
const category = z.string().optional().describe('Category name, e.g. "Shirts" (see get_overview)');
const readOnly = { readOnlyHint: true, openWorldHint: false } as const;

/** Runs a tool and returns its result as JSON text, or the error message as a tool error. */
async function run(fn: () => Promise<unknown> | unknown) {
  try {
    return { content: [{ type: "text" as const, text: JSON.stringify(await fn(), null, 1) }] };
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
  () => run(async () => overview(await loadWardrobe())),
);

server.registerTool(
  "get_category_listing",
  {
    title: "Category listing",
    description:
      "Per category for a date range: active items and inventory value at the end, cost per wear, share of days used, yearly cost and inventory turnover (the Dashboard table). Includes a Total row.",
    inputSchema: { from, to },
    annotations: readOnly,
  },
  ({ from, to }) => run(async () => { const w = await loadWardrobe(); return categoryTable(w, resolveRange(w, from, to)); }),
);

server.registerTool(
  "list_garments",
  {
    title: "List garments",
    description:
      "Garments with details, materials (as written and as a parsed fibre composition), weight, price, dates, status, times worn in the range, lifetime wears, cost per wear and wears per month. Filter by category, status, search text, fibre or weight; sort and limit.",
    inputSchema: {
      from,
      to,
      category,
      status: z.enum(["active", "divested", "all"]).optional().describe("Default: all"),
      search: z.string().optional().describe("Text to find in the name, details or materials"),
      fibre: z.string().optional().describe('Only garments whose main fabric contains this fibre, e.g. "wool", "polyester", "elastane"'),
      minWeightG: z.number().optional().describe("Minimum weight in grams"),
      maxWeightG: z.number().optional().describe("Maximum weight in grams"),
      sort: z.enum(["times_worn", "cost_per_wear", "wears_per_month", "price", "purchased", "name", "weight"]).optional().describe("Default: times_worn (most first)"),
      limit: z.number().int().min(1).max(700).optional().describe("Default 50"),
    },
    annotations: readOnly,
  },
  ({ from, to, ...opts }) => run(async () => { const w = await loadWardrobe(); return listGarments(w, { range: resolveRange(w, from, to), ...opts }); }),
);

server.registerTool(
  "get_garment",
  {
    title: "Garment details",
    description: "One garment by id (e.g. Jackets_and_hoodies-006) or exact name: details, materials, lifetime stats, first/last logged wear, wears per year, recent wear dates and photo URL.",
    inputSchema: { id: z.string().describe("Garment id or exact name") },
    annotations: readOnly,
  },
  ({ id }) => run(async () => getGarment(await loadWardrobe(), id)),
);

server.registerTool(
  "get_wears",
  {
    title: "Wears by day",
    description: `What was worn on each day of a range (at most ${MAX_DAILY_DAYS} days).`,
    inputSchema: { from: z.string().describe("Start date YYYY-MM-DD"), to: z.string().describe("End date YYYY-MM-DD") },
    annotations: readOnly,
  },
  ({ from, to }) => run(async () => { const w = await loadWardrobe(); return getWears(w, resolveRange(w, from, to)); }),
);

server.registerTool(
  "get_daily_cost",
  {
    title: "Daily cost",
    description: `Daily cost (sum of the cost per wear of the garments worn that day) for a range: per day for ranges up to ${MAX_DAILY_DAYS} days, otherwise monthly averages. Without a category, Sportswear is left out (as on the Dashboard).`,
    inputSchema: { from, to, category },
    annotations: readOnly,
  },
  ({ from, to, category }) => run(async () => { const w = await loadWardrobe(); return getDailyCost(w, resolveRange(w, from, to), category); }),
);

server.registerTool(
  "get_inventory_over_time",
  {
    title: "Inventory over time",
    description: "Active items or inventory value (sum of purchase prices) per category, sampled at each month end of the range.",
    inputSchema: { from, to, measure: z.enum(["items", "value"]).describe("items = number of active garments; value = sum of their purchase prices"), category },
    annotations: readOnly,
  },
  ({ from, to, measure, category }) => run(async () => { const w = await loadWardrobe(); return inventoryOverTime(w, resolveRange(w, from, to), measure, category); }),
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
  ({ from, to, basis, category }) => run(async () => { const w = await loadWardrobe(); return materialTable(w, resolveRange(w, from, to), basis, category); }),
);

server.registerResource(
  "definitions",
  "wardrobe://definitions",
  { title: "Metric definitions", description: "How every Wardrobe Diary metric is calculated", mimeType: "text/markdown" },
  (uri) => ({ contents: [{ uri: uri.href, mimeType: "text/markdown", text: DEFINITIONS }] }),
);

await server.connect(new StdioServerTransport());
