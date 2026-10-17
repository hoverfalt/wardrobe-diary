// End-to-end test of the public HTTP endpoint's code: a real MCP client over Streamable HTTP against a local
// server using the same handler as the Cloud Function (reads the live public data, like server.e2e.test.ts).
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { handleMcpRequest } from "./http";

let http: Server;
let url: string;
beforeAll(async () => {
  http = createServer(async (req, res) => {
    let body: unknown;
    if (req.method === "POST") {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    }
    await handleMcpRequest(req, res, body);
  });
  await new Promise<void>((r) => http.listen(0, r));
  url = `http://localhost:${(http.address() as AddressInfo).port}/mcp`;
});
afterAll(() => void http.close());

describe("MCP over HTTP", () => {
  it("serves tools, resources and provenance to a real client", async () => {
    const client = new Client({ name: "http-test", version: "0" });
    await client.connect(new StreamableHTTPClientTransport(new URL(url)));
    const tools = (await client.listTools()).tools.map((t) => t.name);
    expect(tools).toContain("explain");
    expect(tools).toContain("get_category_listing");
    const res = await client.callTool({ name: "get_category_listing", arguments: { from: "2025-01-01", to: "2025-12-31" } });
    const listing = JSON.parse((res.content as { text: string }[])[0].text);
    expect(listing.rows[0].category).toBe("Total");
    expect(listing.provenance.definitions.length).toBeGreaterThan(0);
    const defs = await client.readResource({ uri: "wardrobe://definitions" });
    expect((defs.contents[0] as { text: string }).text).toContain("Cost per wear");
    await client.close();
  }, 60_000);

  it("describes itself on GET and answers CORS preflight", async () => {
    const get = await fetch(url);
    expect(get.status).toBe(405);
    expect(((await get.json()) as { transport: string }).transport).toContain("Streamable HTTP");
    const pre = await fetch(url, { method: "OPTIONS" });
    expect(pre.status).toBe(204);
    expect(pre.headers.get("access-control-allow-origin")).toBe("*");
  });
});
