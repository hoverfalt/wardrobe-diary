# Reference data for validating the metrics

Everything in this folder except this README is git-ignored, since it contains personal data.

- `sheet.json`: the parsed Sheet, written by `tools/sync.sh --dump ../reference/sheet.json`.
- `live/*.csv`: the tables published on wardrobediary.io by the old R pipeline (portfolio category
  listing and the 13 category item listings), snapshot date 2026-09-03.

`web/src/lib/metrics.reference.test.ts` compares the TypeScript metrics with these tables and is
skipped when the files are missing.
