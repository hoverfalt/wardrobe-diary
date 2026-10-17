// Wardrobe Diary MCP server over stdio, for Claude Desktop / Claude Code (see README.md). The public HTTP server
// at https://wardrobediary.io/mcp serves the same definition (src/http.ts).
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./createServer";

await createServer().connect(new StdioServerTransport());
