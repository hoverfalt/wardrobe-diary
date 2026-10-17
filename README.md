# The Wardrobe Diary Project

Every piece of clothing I have worn, every day since 1 January 2018, with what each one cost - and an app that
turns that log into the real cost and use of a wardrobe. Live at **[wardrobediary.io](https://wardrobediary.io)**.

This repository is also a working example of **data governance and context management for AI**: the meaning of
every figure is written down in a machine-readable semantic layer, checked against the code by tests, and
served to AI assistants through an MCP server, so answers about the data are explainable and consistent.

## What's here

| Folder | What |
|---|---|
| [`semantics/`](semantics/) | **Semantic layer:** ontology (conceptual model), glossary, metric definitions (semantic model), data catalog with lineage and quality rules, decision register. [Start here](semantics/README.md). Published at [/glossary](https://wardrobediary.io/glossary), [/model](https://wardrobediary.io/model), [/data](https://wardrobediary.io/data) (with live data quality) and as JSON-LD and ODCS data contracts under [/def/](https://wardrobediary.io/def/catalog.jsonld). |
| [`web/`](web/) | The app: TypeScript, React, Vite, Observable Plot, Firebase. Public pages compute every metric in the browser from one public data document. Metric logic is in [`web/src/lib/metrics.ts`](web/src/lib/metrics.ts), with tests. |
| [`mcp/`](mcp/) | A read-only [Model Context Protocol](https://modelcontextprotocol.io) server, so AI assistants can query the data with the app's own metrics; it serves the semantic layer (`explain`, provenance in every answer). **Public at `https://wardrobediary.io/mcp`** ([connect](mcp/README.md#connect)). [`mcp/evals/`](mcp/evals/) measures whether the semantic layer makes AI answers more reliable ([results](https://wardrobediary.io/evals)). |
| [`tools/`](tools/) | Python: backups, restore, migrations from the original Google Sheet, local test data. |
| [`ROADMAP.md`](ROADMAP.md) | Status, plans, open questions and the decision log. |
| [`CLAUDE.md`](CLAUDE.md) | The project context for the AI coding assistant that builds this app (architecture, data model, conventions). |

## How the definitions stay true

`web/src/semantics.test.ts` runs with the other tests and fails if a definition points at code or tests that
don't exist, if the data model and the catalog disagree, or if a reference doesn't resolve. A definition can't
quietly drift from what the app computes.

## Running it

Node ≥ 20.19. `cd web && npm install && npm test` runs the tests. The app reads a Firebase project
configured in `web/.env.local` (see `web/.env.example`); local testing with Firebase emulators is described
in [CLAUDE.md](CLAUDE.md).

## Licence

Code: [MIT](LICENSE). Semantic layer, site content and data: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
(see [LICENSE-CONTENT.md](LICENSE-CONTENT.md)). © Olof Hoverfält. Contact: [linkedin.com/in/hoverfalt](https://www.linkedin.com/in/hoverfalt/).
