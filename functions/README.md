# Cloud Functions

`lib/index.js` is generated: the MCP server (`mcp/src/function.ts` and everything it imports) bundled by
`cd mcp && npm run build:function`. Deploy with `cd web && npx firebase deploy --only functions:mcp` (codebase
`mcp`, so the project's other functions are never touched), then hosting for the `/mcp` rewrite.
