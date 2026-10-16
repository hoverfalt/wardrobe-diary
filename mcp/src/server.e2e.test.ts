// End to end: starts the built server (dist/server.mjs) over stdio and calls its tools against the live
// public data. Run `npm run build` first; skipped without network or build.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { describe, expect, it } from "vitest";

const SERVER = fileURLToPath(new URL("../dist/server.mjs", import.meta.url));

describe.skipIf(!existsSync(SERVER) || process.env.OFFLINE)("MCP server (live data)", () => {
  it("lists its tools and answers", async () => {
    const client = new Client({ name: "e2e", version: "0" });
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [SERVER] }));
    try {
      const tools = (await client.listTools()).tools.map((t) => t.name).sort();
      expect(tools).toEqual(["explain", "get_category_listing", "get_daily_cost", "get_data_quality", "get_garment", "get_inventory_over_time", "get_material_breakdown", "get_overview", "get_wears", "list_garments"]);
      const text = (r: Awaited<ReturnType<typeof client.callTool>>) => JSON.parse((r.content as { text: string }[])[0].text);

      const overview = text(await client.callTool({ name: "get_overview", arguments: {} }));
      expect(overview.garments.total).toBeGreaterThan(600);
      const listing = text(await client.callTool({ name: "get_category_listing", arguments: { from: "2018-01-01" } }));
      expect(listing.rows[0].category).toBe("Total");
      // Provenance: which definitions, which version, which data
      expect(listing.provenance.semanticLayer).toMatch(/^\d+\.\d+\.\d+$/);
      expect(listing.provenance.definitions.map((d: { metric: string }) => d.metric)).toContain("category-cost-per-wear");
      expect(listing.provenance.data.lastLoggedDay).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const cpw = text(await client.callTool({ name: "explain", arguments: { query: "cost per wear" } }));
      expect(cpw.matches[0].kind).toBe("term");
      expect(cpw.matches[0].definition).toContain("lifetime wears");
      const field = text(await client.callTool({ name: "explain", arguments: { query: "garments.price" } }));
      expect(field.matches[0].kind).toBe("field");
      const quality = text(await client.callTool({ name: "get_data_quality", arguments: {} }));
      expect(quality.results.find((r: { id: string }) => r.id === "unique-ids").status).toBe("pass");
      const vest = text(await client.callTool({ name: "get_garment", arguments: { id: "Jackets_and_hoodies-006" } }));
      expect(vest.name).toBe("North Bend black vest");
      const bad = await client.callTool({ name: "get_wears", arguments: { from: "2018-01-01", to: "2019-01-01" } });
      expect(bad.isError).toBe(true);
      const defs = await client.readResource({ uri: "wardrobe://definitions" });
      expect((defs.contents[0] as { text: string }).text).toContain("Cost per wear");
    } finally {
      await client.close();
    }
  }, 30_000);
});
