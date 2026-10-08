# Wardrobe Diary – web app rebuild

Rebuild of https://wardrobediary.io (R pipeline: github.com/hoverfalt/Threddit) as a dynamic web app.
Owner: Olof Hoverfält. Daily wardrobe log since 2018-01-01.
Repo: github.com/hoverfalt/wardrobe-diary (private).

**Roadmap, status and open decisions live in [ROADMAP.md](ROADMAP.md).** Read it at the start of a
session; update it when work is finished, started, or newly identified (see its header for the rules).

## Goal

Replace "Google Sheet → R scripts → static PNG/GIF on Firebase Hosting" with:
data entry, storage, tables and charts all live in one Firebase-backed web app.

**Current phase:** the Google Sheet stays the source of truth for data entry. `tools/sync.sh --write`
copies it into Firestore, and the new public views are built from that data, in parallel with the
live site, which must not be touched until cut-over.

## Environment

| Thing | Value |
|---|---|
| Firebase project | `threddit-297417` ("Threddit"), also hosts the live site |
| Live site (do not deploy to) | Hosting site `threddit-297417` → wardrobediary.io |
| New app | Hosting site `wardrobediary` → https://wardrobediary.web.app (deploy target `app`) |
| Firestore | `(default)` database, Native mode (switched from empty Datastore mode), location `eur3` |
| Storage bucket | `threddit-297417.appspot.com`: garment photos `<photoId>.png` (always use these originals, not the `thumbs/` copies), publicly readable. Shared with the live site; **never deploy `storage.rules`** without first matching the current live rules |
| Owner uid | `0q0I90W7W3RAcgFN1c1JX6pZupG3` |
| Sheet | id `1IQgCth6qPDHv_mqh8wSg9MaphLPR5dlTv0pi2QgAJLM`, tab `Threddit`, shared read-only with the Admin SDK service account |
| Service-account key | `tools/threddit-297417-firebase-adminsdk-*.json` (git-ignored) |
| Web config | `web/.env.local` (git-ignored), from the registered web app "Wardrobe Diary" |
| Toolchain | Node 24 (≥ 20.19 required); `firebase-tools` is a devDependency of `web/` (use `npx firebase`, not the stale global one); Python venv in `tools/.venv` |

## Architecture (decided)

| Layer | Choice |
|---|---|
| Frontend | TypeScript, Vite, React (`web/`) |
| Auth | Firebase Auth (Google sign-in; `wardrobediary.web.app` added to authorized domains) |
| Data | Cloud Firestore |
| Photos | Firebase Storage (existing photo assets, see above) |
| Hosting | Firebase Hosting, separate site per above |
| Python | `tools/`: Sheet → Firestore sync, validation against R outputs, later optional Cloud Functions for precomputed public summaries |

Analytics run **client-side in TypeScript**: data volume is small (~3,200 days, ~650 garments).
Python is not used for the core metrics.

## Firestore data model

```
users/{uid}/garments/{garmentId}
  category, item, details, photo, price, purchased (YYYY-MM-DD), divested (YYYY-MM-DD|null),
  timesUsedInit, materials, weightG
users/{uid}/days/{YYYY-MM-DD}
  worn: string[]            // garmentIds worn that day; days with nothing worn have no doc
users/{uid}/public/summary  // precomputed data for public pages, world-readable
```

- `garmentId` = the Sheet's Photo id (e.g. `Jackets_and_hoodies-006`); fallback slug if blank.
- One doc per day: logging a day = one write; full history ≈ 3,200 docs, cached offline by the SDK.
- **Public pages must read only `public/summary`**, never the raw days collection (Firestore bills per doc read).
  What goes into it (full compact log vs aggregates only) is an open decision in ROADMAP.md.
- Security rules: owner-only read/write under `users/{uid}`, world-readable `public/*`.

## Sheet → Firestore sync

`tools/sync.sh` (dry run) / `tools/sync.sh --write`. It wraps `migrate_sheet.py` + `sheet_transform.py`:
- Validates that day columns run consecutively (catches header typos like `0204-02-19`) and that
  `timesUsedInit + checked days` reproduces the Sheet's "Times used" for every garment. Refuses to write
  if either check fails.
- Is a **sync, not an insert**: garments and days not in the Sheet are deleted from Firestore.
- Skips "ADD NEXT" placeholder rows and rows with an empty Category (both as in R), rounds prices to
  whole cents, and warns about wears outside a garment's ownership period.
  ⚠️ While the Sheet is the source of truth, anything logged via the app's LogDay page is
  overwritten or removed by the next sync.

Last full sync: 2026-10-08 (632 garments, 3,194 days with wears, 31,527 wear events).

## Source Google Sheet layout

Header row has these columns (A–M), then **one column per day from N onward** (N = 2018-01-01),
continuing a few days into the future. Day cells are checkboxes (TRUE = garment worn that day).

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
| L | Times used | derived: `Times used init + count(checked days)` (verified by the sync) |
| M | Cost per wear | derived: `Price / Times used` |

Read the Sheet with `UNFORMATTED_VALUE` + `SERIAL_NUMBER` dates (serial epoch 1899-12-30) to avoid
Finnish locale formatting (`1.7.2017`, `50,00`).

## Metrics (ported from R: `03-Calculate_plot_data.R`)

Implemented in `web/src/lib/metrics.ts`. **Every metric takes a `DateRange {from, to}`**: users will be
able to choose time spans, so nothing may assume "since 2018-01-01", and the client needs the per-day
data rather than precomputed fixed-period totals. With `from = 2018-01-01` the results match R.

- Ownership: from `max(purchased, 2018-01-01)` to `divested` **inclusive** (the divest day counts).
  Wears outside ownership are ignored.
- Times worn = wears in range (+ `timesUsedInit` if the range starts 2018-01-01).
- Garment cost per wear = price / times worn; **an unworn garment costs its full price**.
- Wears per month = times worn / (days owned / 30.5); days owned count from purchase, frozen at divest.
- Category listing (the live site's portfolio table):
  - Active items, Inventory value: garments active on `to`, and the sum of their prices.
  - Cost per wear = Σ price of all garments owned during the range (incl. divested) / Σ their times worn.
  - Days used = share of days from the category's first ownership day to `to` with ≥ 1 wear in the category.
  - Yearly cost = cost per wear × 365 × days used.
  - Inventory turnover = yearly cost / inventory value. Total row: sums, turnover = Σ yearly / Σ value.
- Validation: `metrics.reference.test.ts` compares with the live site's tables in the git-ignored
  `reference/` folder (snapshot date 2026-09-03; refresh `reference/sheet.json` with
  `tools/sync.sh --dump ../reference/sheet.json`). Known live-site errors are listed in ROADMAP.md.

Still to port: daily cost, monthly cost and the benchmark comparison (questions in ROADMAP.md).

## Commands

```bash
cd web && npm install && npm run dev       # local dev server
cd web && npm test                         # vitest
cd tools && .venv/bin/pytest               # Python tests
tools/sync.sh                              # Sheet → Firestore dry run (validates)
tools/sync.sh --write                      # Sheet → Firestore sync
cd web && npm run deploy                   # build + deploy hosting:app (wardrobediary.web.app) + Firestore rules/indexes
```

Never run a bare `firebase deploy` or `--only hosting` without the `:app` target: the default site is the live one.

## Conventions

- Dates are ISO strings `YYYY-MM-DD` everywhere (no timezones).
- Metric logic lives in pure functions in `web/src/lib/metrics.ts`, with tests.
- Categories are always listed in the standard order in `web/src/lib/categories.ts` (`compareCategories`),
  never alphabetically: Jackets and hoodies, Blazers and vests, Knits, Shirts, T-shirts and tanks, Pants,
  Shorts, Belts, Socks, Shoes, Underwear shirts, Underwear boxers, Sportswear.
- Never commit `.env.local` or service-account JSON.
- Git: run `git add`, `git commit` and `git push` as separate commands (not chained with `&&`); the local
  permission rules in `.claude/settings.local.json` allow commit, push and `tools/sync.sh` only individually.
