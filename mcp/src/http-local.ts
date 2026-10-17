// Local HTTP server for testing the public MCP endpoint: node dist/http-local.mjs [port] → http://localhost:8787/mcp
import { createServer } from "node:http";
import { handleMcpRequest } from "./http";

const port = Number(process.argv[2] ?? 8787);
createServer(async (req, res) => {
  if (!req.url?.startsWith("/mcp")) return void res.writeHead(404).end();
  let body: unknown;
  if (req.method === "POST") {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "null");
  }
  await handleMcpRequest(req, res, body);
}).listen(port, () => console.log(`MCP over HTTP on http://localhost:${port}/mcp`));
