# Wardrobe Diary semantic layer

What the Wardrobe Diary data means, where it comes from and how every figure is computed, in one
machine-readable place. It is the reference for people, for the app and for AI assistants using the data
through the MCP server. Licence: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

| File | What | Published as (phase 2) |
|---|---|---|
| [model.yaml](model.yaml) | Version, licence, steward, standards used, changelog | DCAT catalog record |
| [ontology.yaml](ontology.yaml) | Conceptual model: classes, properties, relations | JSON-LD (schema.org, PROV-O), diagram |
| [glossary.yaml](glossary.yaml) | Business terms and definitions | SKOS concept scheme, `/glossary` |
| [metrics.yaml](metrics.yaml) | Semantic model: every metric's formula, grain, unit, range rule, code and tests | `/model`, MCP `explain` |
| [catalog.yaml](catalog.yaml) | Datasets, fields, classification, lineage, quality rules | DCAT, `/data` |
| [decisions.yaml](decisions.yaml) | The decisions definitions refer to | linked from all of the above |

## How it stays true

The files are written by hand (YAML) and checked automatically against the code
(`web/src/semantics.test.ts`, part of `npm test`). The checks fail when:

- an id is duplicated or a reference (`term:`, `metric:`, `dataset:`, `field:`, `decision:` …) doesn't resolve;
- a metric points at a function or a test that doesn't exist;
- the Garment data type and the catalogued garment fields differ;
- the app writes a Firestore collection the catalog doesn't describe;
- the category or tag vocabularies differ from the code.

Changing a definition means changing it here, bumping `version` in model.yaml and adding a changelog line.

## Status

Version 0.1.0, draft (2026-10-16): written from the app's code, tests and decision log; to be reviewed by the
data owner. Roadmap: generated formats, pages and MCP resources (phase 2), nightly data contracts and quality
figures (phase 3), an AI evaluation set (phase 4).
