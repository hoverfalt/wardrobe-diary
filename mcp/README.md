# Wardrobe Diary MCP server

Read-only [MCP](https://modelcontextprotocol.io) server for the public Wardrobe Diary data (ROADMAP R-29,
phase 1). It reads the world-readable `public/data` document (the same one the public web pages read; no
key needed), caches it for 5 minutes, and computes everything with the web app's own `web/src/lib/metrics.ts`
(bundled in), so answers match the Dashboard.

## Tools

| Tool | What it returns |
|---|---|
| `get_overview` | Data coverage (tracking start, last logged day, counts) and categories |
| `get_category_listing` | The Dashboard table for a date range |
| `list_garments` | Garments with price, dates, status, times worn, cost per wear, wears per month; filter, sort, limit |
| `get_garment` | One garment: details, lifetime stats, wears per year, recent wear dates, photo URL |
| `get_wears` | What was worn each day (≤ 92 days) |
| `get_daily_cost` | Daily cost per day (≤ 92 days) or as monthly averages |
| `get_inventory_over_time` | Active items or inventory value per category, at month ends |

Resource `wardrobe://definitions`: how every metric is calculated.

## Build and test

```bash
cd mcp && npm install && npm run build   # → dist/server.mjs (git-ignored)
npm test                                  # unit tests + an end-to-end test against the live data
```

Rebuild after changing `web/src/lib/` so the server uses the same metrics as the app.

## Use it

- **Claude Code** in this repo: the project's `.mcp.json` registers it; approve it when asked (or `/mcp`).
- **Claude Desktop**: Settings → Developer → Edit Config, and add to `claude_desktop_config.json`:

  ```json
  {
    "mcpServers": {
      "wardrobe-diary": {
        "command": "node",
        "args": ["/Users/olofhoverfalt/Dropbox (Personal)/VS Code/threddit2/mcp/dist/server.mjs"]
      }
    }
  }
  ```

  Then restart Claude Desktop. If it can't find `node`, use its full path (`which node`, e.g. `/usr/local/bin/node`).
