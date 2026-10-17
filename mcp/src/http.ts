// The public MCP server over HTTP (ROADMAP R-29 phase 2): MCP "Streamable HTTP" in stateless mode, so every POST
// is answered by a fresh server and any instance can serve any request. Read-only, public data only, no sign-in.
// Used by the Cloud Function behind https://wardrobediary.io/mcp (functions/) and by src/http-local.ts for tests.
import type { IncomingMessage, ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "./createServer";

const INFO = {
  name: "Wardrobe Diary MCP server",
  description:
    "Read-only Model Context Protocol server for the Wardrobe Diary's public data: one person's daily wardrobe log since 2018 with the app's own metrics, the semantic layer (definitions, explain tool) and provenance in every answer.",
  transport: "Streamable HTTP (stateless): POST JSON-RPC to this URL",
  docs: "https://github.com/hoverfalt/wardrobe-diary/tree/main/mcp",
  definitions: "https://wardrobediary.io/glossary",
};

/** Handles one HTTP request. `body` is the parsed JSON body when a framework has already read it (Express). */
export async function handleMcpRequest(req: IncomingMessage, res: ServerResponse, body?: unknown): Promise<void> {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID");
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
  if (req.method === "OPTIONS") {
    res.writeHead(204, { "Access-Control-Allow-Methods": "POST, GET, OPTIONS" }).end();
    return;
  }
  if (req.method !== "POST") {
    // No server-to-client stream in stateless mode (the MCP spec's answer is 405); people get a short description.
    res.writeHead(405, { Allow: "POST", "Content-Type": "application/json" }).end(JSON.stringify(INFO, null, 1));
    return;
  }
  const server = createServer({ semantics: true });
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on("close", () => {
    void transport.close();
    void server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  } catch (e) {
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" }).end(
        JSON.stringify({ jsonrpc: "2.0", error: { code: -32603, message: e instanceof Error ? e.message : "Internal error" }, id: null }),
      );
    }
  }
}
