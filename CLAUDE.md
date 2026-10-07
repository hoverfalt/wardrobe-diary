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
| Storage bucket | `threddit-297417.appspot.com`: garment photos `<photoId>.png`, thumbnails `thumbs/<photoId>_112x112.png`, publicly readable. Shared with the live site; **never deploy `storage.rules`** without first matching the current live rules |
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
  ⚠️ So while the Sheet is the source of truth, anything logged via the app's LogDay page is
  overwritten or removed by the next sync.

First full sync: 2026-10-07 (649 garments, 3,192 days with wears, 31,514 wear events).

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

## Metrics (port from R; definitions to confirm against Threddit `02-`/`03-` scripts)

- Times used = timesUsedInit + days worn
- Cost per wear = price / times used
- Active on date d = purchased ≤ d and (divested empty or d < divested)
- Active items / inventory value by category (over time)
- Category frequency = share of days at least one item of the category was worn
- Average cost per wear and average yearly cost by category
- Daily cost, monthly cost and comparison to external consumption benchmarks

Open questions about these are tracked in ROADMAP.md.

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
- Never commit `.env.local` or service-account JSON.
- Git: run `git add`, `git commit` and `git push` as separate commands (not chained with `&&`); the local
  permission rules in `.claude/settings.local.json` allow commit, push and `tools/sync.sh` only individually.
