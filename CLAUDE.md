# Wardrobe Diary – web app rebuild

Rebuild of https://wardrobediary.io (R pipeline: github.com/hoverfalt/Threddit) as a dynamic web app.
Owner: Olof Hoverfält. Daily wardrobe log since 2018-01-01.

## Goal

Replace "Google Sheet → R scripts → static PNG/GIF on Firebase Hosting" with:
data entry, storage, tables and charts all live in one Firebase-backed web app.

## Architecture (decided)

| Layer | Choice |
|---|---|
| Frontend | TypeScript, Vite, React (`web/`) |
| Auth | Firebase Auth (Google sign-in) |
| Data | Cloud Firestore |
| Photos | Firebase Storage (existing photo assets) |
| Hosting | Firebase Hosting |
| Python | `tools/`: one-off Sheet → Firestore migration, validation against R outputs, later optional Cloud Functions for precomputed public summaries |

Analytics run **client-side in TypeScript**: data volume is small (~3,200 days, a few hundred garments).
Python is not used for the core metrics.

## Firestore data model

```
users/{uid}/garments/{garmentId}
  category, item, details, photo, price, purchased (YYYY-MM-DD), divested (YYYY-MM-DD|null),
  timesUsedInit, materials, weightG
users/{uid}/days/{YYYY-MM-DD}
  worn: string[]            // garmentIds worn that day
users/{uid}/public/summary  // precomputed aggregates, world-readable (for the public portfolio page)
```

- `garmentId` = the Sheet's Photo id (e.g. `Jackets_and_hoodies-006`); fallback slug if blank.
- One doc per day: logging a day = one write; full history ≈ 3,200 docs, cached offline by the SDK.
- **Public pages must read only `public/summary`**, never the raw days collection (Firestore bills per doc read).

## Source Google Sheet layout

Header row has these columns (A–M), then **one column per day from N onward** (N = 2018-01-01;
DSQ = 2026-10-07). Day cells are checkboxes (TRUE = garment worn that day).

| Col | Header | Notes |
|---|---|---|
| A | Category | e.g. "Jackets and hoodies" |
| B | Item | garment name; rows without Item are separators |
| C | Details | size, model code, etc. |
| D | Photo | photo asset id, e.g. `Jackets_and_hoodies-006` |
| E | Photo placeholder | image formula, not migrated |
| F | Price | EUR |
| G | Date purchased | |
| H | Date divested | blank = still active |
| I | Times used init | uses before tracking started |
| J | Materials | free text |
| K | Weight | grams |
| L | Times used | derived: `Times used init + count(checked days)` (to be verified by migration) |
| M | Cost per wear | derived: `Price / Times used` |

Read the Sheet with `UNFORMATTED_VALUE` + `SERIAL_NUMBER` dates (serial epoch 1899-12-30) to avoid
Finnish locale formatting (`1.7.2017`, `50,00`).

## Metrics (port from R; definitions to confirm against Threddit `02-`/`03-` scripts)

- Times used = timesUsedInit + days worn
- Cost per wear = price / times used
- Active on date d = purchased ≤ d and (divested empty or d < divested)
- Active items / inventory value by category (over time)
- Category frequency = share of days at least one item of the category was worn
- Average cost per wear and average yearly cost by category
- Daily cost, monthly cost and comparison to external consumption benchmarks

**Open questions:** exact daily-cost formula in R; meaning of row background colours in column B
(pink/orange/blue); how cost per wear handles 0 uses; benchmark data source for the monthly comparison.

## Roadmap

1. ✅ Skeleton (this repo)
2. Migrate: `tools/migrate_sheet.py` dry run → check it reproduces Sheet "Times used" → write to Firestore
3. Export golden CSVs from the R pipeline into `reference/`; add tests comparing TS metrics to them
4. Rebuild the portfolio charts (suggested: Observable Plot) on the Dashboard
5. Daily logging UI (mobile-first, offline) — basic version exists in `web/src/pages/LogDay.tsx`
6. Cut over: stop entering in the Sheet; scheduled Firestore export as backup
7. Multi-user sign-up, public profiles, `public/summary` via Cloud Function

## Commands

```bash
cd web && npm install && npm run dev      # Node 20+
cd web && npm test                         # vitest
cd tools && pip install -r requirements.txt && pytest
tools/sync.sh                              # Sheet → Firestore dry run (validates)
tools/sync.sh --write                      # Sheet → Firestore sync (Sheet is source of truth)
cd web && npm run deploy                     # hosting:app (wardrobediary.web.app, never the live site) + firestore rules
```

## Conventions

- Dates are ISO strings `YYYY-MM-DD` everywhere (no timezones).
- Metric logic lives in pure functions in `web/src/lib/metrics.ts`, with tests.
- Never commit `.env.local` or service-account JSON.
