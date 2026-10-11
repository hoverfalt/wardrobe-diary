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
      expect(tools).toEqual(["get_category_listing", "get_daily_cost", "get_garment", "get_inventory_over_time", "get_overview", "get_wears", "list_garments"]);
      const text = (r: Awaited<ReturnType<typeof client.callTool>>) => JSON.parse((r.content as { text: string }[])[0].text);

      const overview = text(await client.callTool({ name: "get_overview", arguments: {} }));
      expect(overview.garments.total).toBeGreaterThan(600);
      const listing = text(await client.callTool({ name: "get_category_listing", arguments: { from: "2018-01-01" } }));
      expect(listing.rows[0].category).toBe("Total");
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
