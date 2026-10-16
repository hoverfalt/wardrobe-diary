# Wardrobe Diary MCP server

Read-only [MCP](https://modelcontextprotocol.io) server for the public Wardrobe Diary data (ROADMAP R-29 phase 1,
R-40). It reads the world-readable `public/data` document (the same one the public web pages read; no
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
| `get_material_breakdown` | Fibre mass owned or worn (weight × composition), with coverage |
| `get_data_quality` | The semantic layer's quality rules run on the current data |
| `explain` | The authoritative definition of any term, metric, field (`garments.price`), dataset or decision (`D-2`) |

**Every answer carries `provenance`:** the semantic-layer version, the metric definitions the numbers come from
(with links to [wardrobediary.io/model](https://wardrobediary.io/model)), and the data's last logged day.

Resources, all generated from the [semantic layer](../semantics/): `wardrobe://definitions` (every term,
metric and decision as text), `wardrobe://glossary`, `wardrobe://semantic-model`, `wardrobe://catalog` (JSON).

## Build and test

```bash
cd mcp && npm install && npm run build   # → dist/server.mjs (git-ignored)
npm test                                  # unit tests + an end-to-end test against the live data
```

Rebuild after changing `web/src/lib/` so the server uses the same metrics as the app.

## Use it

- **Claude Code** in this repo: the project's `.mcp.json` registers it; approve it when asked (or `/mcp`).
- **Claude Desktop**: quit it first (it rewrites the file while running), then open
  `~/Library/Application Support/Claude/claude_desktop_config.json` (Settings → Developer → Edit Config).
  The file already holds Claude Desktop's own preferences: keep them and add `mcpServers` as one more
  top-level key, right after the opening `{`:

  ```json
    "mcpServers": {
      "wardrobe-diary": {
        "command": "/usr/local/bin/node",
        "args": ["/Users/olofhoverfalt/Dropbox (Personal)/VS Code/threddit2/mcp/dist/server.mjs"]
      }
    },
  ```

  Use the full path of `node` (`which node`): apps started from the Dock don't see `/usr/local/bin`.
  Then start Claude Desktop; Settings → Developer shows the server's status.
