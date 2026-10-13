# Wardrobe Diary – web app rebuild

Rebuild of https://wardrobediary.io (R pipeline: github.com/hoverfalt/Threddit) as a dynamic web app.
Owner: Olof Hoverfält. Daily wardrobe log since 2018-01-01.
Repo: github.com/hoverfalt/wardrobe-diary (private).

**Roadmap, status and open decisions live in [ROADMAP.md](ROADMAP.md).** Read it at the start of a
session; update it when work is finished, started, or newly identified (see its header for the rules).

## Goal

Replace "Google Sheet → R scripts → static PNG/GIF on Firebase Hosting" with:
data entry, storage, tables and charts all live in one Firebase-backed web app.

**Current phase:** the app is the single source of truth. Garment details have been edited in the app since
2026-10-09 (D-4), and **wears have been logged in the app (`/log`) since the cut-over on 2026-10-09** (the
Google Sheet is retired; logged through 2026-10-09). The public app at https://wardrobediary.web.app rebuilds
everything on the live site except the static text pages, and goes beyond it: garment pages, a materials page, tags (second hand, Hanko, bicycle, motorcycle,
winter, summer) with Log page filters, sortable tables, a managed spending comparison, nightly backups and a
read-only MCP server. The live site must not be touched until the domain switch (ROADMAP R-16).

## Environment

| Thing | Value |
|---|---|
| Firebase project | `threddit-297417` ("Threddit"), also hosts the live site |
| Live site (do not deploy to) | Hosting site `threddit-297417` → wardrobediary.io |
| New app | Hosting site `wardrobediary` → https://wardrobediary.web.app (deploy target `app`) |
| Firestore | `(default)` database, Native mode (switched from empty Datastore mode), location `eur3` |
| Storage buckets | `threddit-297417.appspot.com`: garment photos `<photoId>.png` (228 × 228 PNG; always use these originals, not the `thumbs/` copies) and category images, shared with the live site. `threddit-plots`: the live site's chart images. Rules are versioned here (`storage.rules`, `storage-plots.rules`, deploy targets `photos` / `plots`): everything publicly readable; only the owner may upload, and only `<Photo id>.png` or `Comparison-<Name>.png`; no deletes. Deploy deliberately with `cd web && npx firebase deploy --only storage` and re-check that the live site's images still load |
| Owner uid | `0q0I90W7W3RAcgFN1c1JX6pZupG3` |
| Sheet | id `1IQgCth6qPDHv_mqh8wSg9MaphLPR5dlTv0pi2QgAJLM`, tab `Threddit`, shared read-only with the Admin SDK service account |
| Service-account key | `tools/threddit-297417-firebase-adminsdk-*.json` (git-ignored) |
| Web config | `web/.env.local` (git-ignored), from the registered web app "Wardrobe Diary" |
| Toolchain | Node 24 (≥ 20.19 required); `firebase-tools` is a devDependency of `web/` (use `npx firebase`, not the stale global one); Python 3.12 venv in `tools/.venv`, built from the user-local standalone Python in `~/.local/share/python-3.12.*` (the system's 3.9 is end of life; recreate with `~/.local/share/python-3.12.15/bin/python3 -m venv tools/.venv && tools/.venv/bin/pip install -r tools/requirements.txt`); the nightly backup job also runs 3.12 |

## Architecture (decided)

| Layer | Choice |
|---|---|
| Frontend | TypeScript, Vite, React (`web/`) |
| Auth | Firebase Auth (Google sign-in; `wardrobediary.web.app` added to authorized domains) |
| Data | Cloud Firestore |
| Photos | Firebase Storage (existing photo assets, see above) |
| Hosting | Firebase Hosting, separate site per above |
| Python | `tools/`: backup, restore and one-off migrations (the Sheet → Firestore sync is retired) |
| MCP | `mcp/`: read-only Node MCP server over the public data (see below) |

Analytics run **client-side in TypeScript**: data volume is small (~3,200 days, ~650 garments).
Python is not used for the core metrics.

## Firestore data model

```
users/{uid}/garments/{garmentId}          // source of truth for garment details (D-4)
  category, item, details, photo, price, purchased (YYYY-MM-DD), divested (YYYY-MM-DD|null),
  timesUsedInit, materials, weightG, photoVersion? (set when the photo is replaced),
  detailsUnavailable? (divested only: missing details can't be filled in; left out of the review list),
  tags? (string[] from the fixed vocabulary in web/src/lib/tags.ts: "second-hand", "hanko", "bicycle", "motorcycle", "winter", "summer")
users/{uid}/garments/{garmentId}/history/{autoId}
  savedAt, before (null = created in the app), after, note?   // every save keeps the previous version
users/{uid}/deletedGarments/{garmentId}
  deletedAt, garment                      // deleted in the app (never-worn only); the sync won't re-create it
users/{uid}/days/{YYYY-MM-DD}
  worn: string[]            // garmentIds worn that day; days with nothing worn have no doc
users/{uid}/settings/app
  sheetRetired: "2026-10-09"   // cut-over date; the Sheet sync refuses to write while this is set
users/{uid}/settings/comparison  // other spending for the monthly cost comparison (R-26), edited at /manage/comparison
  items: [{ id, type, item, details, photo, photoVersion?, monthlyCost, useFrequency (0…1) }]
users/{uid}/public/data     // world-readable copy for public pages (D-1), kept in step by every app write:
  version: 1, garments: Garment[] (all fields), days: { "YYYY-MM-DD": number[] },  // indexes into garments
  comparison: the settings/comparison items (copied on every save)
```

- `garmentId` = the Sheet's Photo id (e.g. `Jackets_and_hoodies-006`); fallback slug if blank.
- One doc per day: logging a day = one write; full history ≈ 3,200 docs, cached offline by the SDK.
- **Public pages read only `public/data`** (one document read), never the raw garments/days collections
  (Firestore bills per doc read). It holds the full day-by-day log so any metric can be computed for any
  time span in the browser. ~435 kB in 2026 of the 1 MiB document limit (grows ~30 kB/year); check its
  size in the backups now and then (`tools/restore.sh` rebuilds it).
- `firestore.indexes.json` exempts `public.garments` and `public.days` from indexing: otherwise the log
  exceeds Firestore's 40,000 index entries per document.
- The app reads `VITE_OWNER_UID` (in `web/.env.local`) to know whose public data to show.
- Security rules: owner-only read/write under `users/{uid}`, world-readable `public/*`.

## Logging and backups (since the cut-over, 2026-10-09)

- Wears are logged at `/log` (owner only, `pages/LogDay.tsx`). Each tap is one batch (`setDayWorn`): it
  writes `days/{date}` and updates only that day in `public/data` (`days.<date>` as garment indexes, via a
  field path, no full read), so public pages update at once. Batches work offline and sync later.
- **Backups (R-28):** Firestore is now the only copy of the wear log. A nightly GitHub Actions job in the
  private repo `hoverfalt/wardrobe-diary-backups` (local clone next to this project) runs `backup.py` with a
  **read-only** service account (role Cloud Datastore Viewer, secret `FIREBASE_BACKUP_KEY`) and commits
  `wardrobe.json` + `last-backup.txt`; git history keeps every day. GitHub emails on failure. Keep its
  `backup.py` identical to `tools/backup.py`. Manual backups: `tools/backup.sh` → `backups/` (git-ignored,
  in Dropbox). The backup has garments + history, days, deleted garments and settings (pretty, sorted JSON;
  public data left out as it is derived).
- **Restore:** `tools/restore.sh <backup.json>` shows what would change; `--write` takes a safety backup to
  `backups/` and then makes Firestore match the backup exactly and rebuilds `public/data` (history untouched).

## Sheet → Firestore sync (retired 2026-10-09)

`tools/sync.sh` still runs as a dry run (useful to compare with the old Sheet), but **refuses to write** since
`settings/app.sheetRetired` is set: writing would overwrite wears logged in the app. History: it wrapped
`migrate_sheet.py` + `sheet_transform.py`; after D-4 it copied only wear ticks (rows matched by Photo id),
never updated or deleted garments, created a garment once for a new Sheet row unless deleted in the app,
dropped ticks for unknown garments, rebuilt `public/data`, and validated day columns and "Times used".
The final sync (2026-10-09): 632 garments, 3,194 days with wears, 31,539 wear events.

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
- Garment cost per wear (decision D-2) = price / **all** wears over the garment's whole ownership
  (incl. `timesUsedInit`), **independent of the chosen range**, even counting wears after the range ends.
  An unworn garment costs its full price.
- Wears per month = times worn / (days owned / 30.5); days owned count from purchase, frozen at divest.
- Category listing (the live site's portfolio table):
  - Active items, Inventory value: garments active on `to`, and the sum of their prices.
  - Cost per wear (D-2) = use-weighted average of garment cost per wear over the category's garments
    with ≥ 1 wear in the range, weighted by their wears in the range. (R instead used Σ price of all
    owned garments / Σ wears, so this column, Yearly cost and Turnover differ from the live site.)
  - Days used = share of days from the category's first ownership day to `to` with ≥ 1 wear in the category.
  - Yearly cost = cost per wear × 365 × days used.
  - Inventory turnover = yearly cost / inventory value. Total row: sums, turnover = Σ yearly / Σ value.
  - Second hand = share of the garments active on `to` tagged second hand (count). Dashboard column titles:
    Items, Value, Cost per wear, Days used, Yearly cost, Turnover, Second hand.
- Charts over time (`activeOverTime`): active items / inventory value per category as step series.
- Item listing (`itemListing`, category pages): times worn and wears per month in the range; `lifetimeWears`
  and cost per wear over the whole ownership (D-2). `divestedAverages` = R's avg_*_divested (divested items
  owned ≥ 30 days: Σ wears / Σ days × 30.5, and use-weighted cost per wear). Times worn bands use
  `quantile` (R type 7) at 5/95 % and 32/68 % of divested items.
- Validation: `metrics.reference.test.ts` compares with the live site's tables in the git-ignored
  `reference/` folder (snapshot date 2026-09-03; refresh `reference/sheet.json` with
  `tools/sync.sh --dump ../reference/sheet.json`). Known live-site errors and deliberate differences
  are listed in ROADMAP.md and in the test.

- Daily cost (`dailyCost`) = Σ lifetime cost per wear of the garments worn (and owned) that day; "final"
  when all of them are divested; `average` = 30-day rolling mean centred on the day (values i−14 … i+15).
- **Materials** (`lib/materials.ts`, R-30): `parseMaterials` reads the free-text Materials field into fibre
  compositions on read (the text is never changed): synonyms/typos normalised, labelled parts (shell, lining…)
  recognised, the **main part** used for metrics, percentages normalised to 100 % (equal split + `estimated`
  without percentages), organic/recycled flags, `unknown` words reported. `materialBreakdown` = fibre mass
  from weight × composition, owned (active at `to`) or worn (each wear counts the full weight), with coverage
  counts and the average outfit weight. A test checks every materials text in the latest backup parses.
- **Animations** ("… animated by date") use `asOf` (`dailyCost`, `itemListing`): everything as known on that
  date, i.e. only wears up to then. This is the one deliberate exception to D-2.

- **Comparison** (`lib/comparison.ts`, R-26, R's `Portfolio-Monthly_cost_and_Category_use`): categories' monthly
  cost = yearly cost / 12 against Days used, next to other spending in grey. For those items only Monthly cost and
  Use frequency are stored (imported once from the Sheet's "Comparison" tab as values, `tools/import_comparison.sh`);
  yearly cost = monthly × 12 and cost per use = monthly / (30,5 × use frequency) are derived. They don't follow the
  date range. Photos are `Comparison-<Name>.png` next to the garment photos, handled like garment photos
  (`comparisonPhotoUrl`; `photoVersion` in the URL; a new item gets a photo name only when a photo is uploaded).

## Code map (`web/src`)

| Path | What |
|---|---|
| `App.tsx` | Shell: routing, public data (`usePublicWardrobe`) and the shared date range (`useDateRange`); every page is lazy-loaded (`page(...)`, R-18) |
| `pages/Dashboard.tsx` | Portfolio page: category listing table + 7 charts |
| `pages/CategoryPage.tsx` | `/category/<slug>`: item listing table + 6 charts, generic for all categories |
| `pages/GarmentPage.tsx` | `/garment/<id>` (public): photo, all fields, composition bar, stats, wears per month; Edit for the owner |
| `pages/MaterialsPage.tsx`, `components/MaterialsCharts.tsx` | `/materials` (public): fibre mass owned/worn, fibre mix per category (small multiples), monthly outfit weight and synthetic share |
| `pages/LogDay.tsx`, `lib/logging.ts` | `/log` (owner only): daily logging, the source of truth for wears; day navigation, outfit chips, a "Filters" popup next to the save status (highlighted with the count when active) with tag toggles (neutral / green = only these / red = hide; kept in localStorage per device; garments worn that day always listed), search, recent-first order, offline status |
| `pages/ManagePage.tsx`, `pages/GarmentEditPage.tsx`, `pages/AddGarmentPage.tsx` | `/manage` (owner only): garment list with filters and bulk changes; `/manage/<id>` edit, divest, replace photo, delete (never worn), history; `/manage/new` add with photo upload |
| `components/GarmentFormFields.tsx`, `components/PhotoPicker.tsx` | The garment form fields (columns A–K) and the PNG picker, shared by edit and add |
| `lib/garmentForm.ts` | Garment form ↔ stored fields: validation, normalisation, next Photo id, photo checks (tested) |
| `data/repo.ts` | Firestore access. Every garment write is one transaction that also updates `public/data`: `updateGarments` (single and bulk edits, computed from the stored version), `createGarment`, `deleteGarment` (re-indexes the days via `withoutGarment`) |
| `lib/metrics.ts` | All metric logic (pure, tested); `lib/categories.ts` order, colours, slugs; `lib/dates.ts`, `lib/route.ts`, `lib/dataBars.ts`, `lib/publicData.ts` (`withGarments`, `withoutGarment`) |
| `lib/materials.ts` | Materials parser, fibre classes, `materialBreakdown`, `materialsByMonth` (tested) |
| `lib/tags.ts`, `components/TagBadges.tsx`, `components/photoBadges.ts` | Tag vocabulary and helpers (`hasTag`, "(SH)" in names), badges next to names and on chart photos |
| `pages/ComparisonPage.tsx`, `lib/comparison.ts` | `/manage/comparison` (owner only, linked from Manage): comparison items, add/edit/delete, photo upload; derived costs (tested) |
| `lib/sorting.ts`, `components/SortHeader.tsx` | Sortable table state and clickable headers (Dashboard and category pages) |
| `components/CategoryCharts.tsx` | Small multiples, total chart, category scatter (optionally with grey `others`, e.g. the comparison), number formats |
| `components/ItemCharts.tsx` | Item scatters with photos on a log scale (explicit tick labels: d3 thins log-axis labels) |
| `components/TimesWornChart.tsx`, `DailyCostCharts.tsx`, `CategoryAnimations.tsx` | Times worn, daily cost, animated charts |
| `components/DateRangeControl.tsx`, `AsOfControl.tsx`, `PlotFigure.tsx` | Date range (slider + boxes), "as of" player, Plot wrapper |

## MCP server (`mcp/`, R-29)

Read-only MCP server over stdio: reads the public `public/data` document via Firestore REST (no key), caches
it 5 minutes, and bundles `web/src/lib/*` so its metrics are the app's own. Tools: overview, category listing,
garments (list/one, incl. materials, composition and weight, fibre and weight filters), wears by day, daily
cost, inventory over time, material breakdown; resource `wardrobe://definitions`.
Registered for Claude Code by `.mcp.json`; Claude Desktop setup in `mcp/README.md`. **Rebuild it
(`cd mcp && npm run build`) after changing `web/src/lib/`.**

## Local testing of the signed-in UI (emulators, R-39)

The owner-only pages (Log, Manage, edit, Comparison) are tested against local Firebase emulators, never against
production: `tools/emulator.sh` starts auth, Firestore and Storage emulators (UI http://127.0.0.1:4000) and seeds
them from the newest `backups/wardrobe-*.json` (`tools/seed_emulator.py`, which refuses non-local hosts; take a
fresh `tools/backup.sh` first for current data). `cd web && npm run dev:emulator` serves the app on
http://localhost:5174 in emulator mode (`.env.emulator`, `EMULATORS` in `firebase.ts`): an orange "LOCAL
EMULATOR" banner, in-memory cache, and "Sign in" signs in as the stand-in owner (owner@emulator.test, the real
owner uid) without Google. `npm run ui-check` (`web/e2e/ui-check.mjs`) signs in, logs a wear, uses the Filters
popup and opens Manage and Comparison, with screenshots in `web/e2e/out/`; `web/e2e/browser.mjs` has helpers
(`openApp`, `go`, `clickText`, `shot`) for new checks and refuses pages without the banner. Every start is a
fresh copy, so tests may write freely. To test the split production build instead of the dev server:
`npx vite build --mode emulator --outDir dist-emulator && npx vite preview --outDir dist-emulator --port 5174`. Java: the Firestore emulator needs it; a Temurin 21 JDK is in
`~/.local/share/jdk-21*` (no system install), and `emulator.sh` uses it. Photos still load from the
production bucket (read-only); photos uploaded in emulator mode go to the Storage emulator and won't show.

## Commands

```bash
cd web && npm install && npm run dev       # local dev server
cd web && npm test                         # vitest
cd tools && .venv/bin/pytest               # Python tests
cd mcp && npm run build && npm test        # MCP server: bundle + unit and live end-to-end tests
tools/backup.sh                            # manual backup to backups/ (nightly backups run on GitHub)
tools/restore.sh <backup.json> [--write]   # restore from a backup (dry run by default)
tools/sync.sh                              # dry run against the retired Sheet (writing is refused)
tools/import_comparison.sh                 # one-off: Sheet "Comparison" tab → settings/comparison (done 2026-10-12)
tools/migrate_colour_tags.sh               # one-off: Sheet row colours → Hanko/bicycle/motorcycle tags (done 2026-10-12)
tools/emulator.sh                          # local emulators seeded from the newest backup (see Local testing)
cd web && npm run dev:emulator             # app on http://localhost:5174 against the emulators
cd web && npm run ui-check                 # signed-in UI smoke check + screenshots (emulators + dev:emulator running)
cd web && node e2e/public-check.mjs        # live public pages: load without errors, JS per first visit (read-only)
cd web && npm run deploy                   # build + deploy hosting:app (wardrobediary.web.app) + Firestore rules/indexes
```

Never run a bare `firebase deploy` or `--only hosting` without the `:app` target: the default site is the live one.

## Conventions

- Dates are ISO strings `YYYY-MM-DD` everywhere (no timezones).
- Metric logic lives in pure functions in `web/src/lib/metrics.ts`, with tests.
- Charts use Observable Plot via `web/src/components/PlotFigure.tsx`. **Per-category data is always shown as
  small multiples** (`CategorySmallMultiples` in `web/src/components/CategoryCharts.tsx`, decision D-3),
  never as many coloured lines or stacked areas in one chart; category colours come from
  `categoryColor()` in `web/src/lib/categories.ts` (the live site's R colours, lighter steps in dark mode).
- Pages: `/` Dashboard, `/category/<slug>`, `/garment/<id>`, `/materials`, `/log`, `/manage` (owner = `VITE_OWNER_UID`); routing in `web/src/lib/route.ts` (no library).
  The top nav (Dashboard, Log, Manage, Sign in/out) must fit a phone; sub-pages such as `/materials` are linked
  from the Dashboard instead, with Dashboard highlighted.
  The public data and the date range are loaded/held once in `App.tsx` and shared by all pages.
- One app-wide date range (kept when moving between pages). Its control (slider + date boxes) is rendered in
  several places (`{rangeControl}`), all bound to the same state; put a copy under each new chart section.
- Animated charts use `useAsOf(range)` (play/pause + slider) and keep their scales fixed while playing.
- **Sortable tables** (`lib/sorting.ts`, `components/SortHeader.tsx`): numbers largest first, then smallest;
  texts A–Z first; empty values last. A "default order" header (Category on the Dashboard, Status on category
  pages) restores the original order and shows no arrow; the Dashboard's Total row stays first.
- **Tags** (`lib/tags.ts`) are descriptive only and never change a calculation (second hand: price as paid,
  wears from the purchase; no estimated earlier use). Show them as badges: `TagBadges` next to names,
  `photoBadgeMarks` on chart photos and `TagLegendItems` in chart legends, but **only `CHART_TAGS`
  (second hand) in charts** (Olof: more badges clutter them); `tagLines` in tooltips lists all tags. Typing "(SH)" or "(Hanko)" in a name becomes the tag on save (`tagsFromName`).
  Search boxes (Log, Manage) also match tag labels and badges (`tagSearchText`), e.g. "motorcycle", "bike".
- Fibre types (natural / regenerated / synthetic / other) have fixed colours (`--fibre-*` in `styles.css`, from the
  validated reference palette: aqua, blue, orange, grey); always pair them with text labels.
- On category pages, item names link to the public `/garment/<id>`; the owner edits from there (Edit button).
- Item photos and category images come from Storage (`photoUrl(garment)`, `categoryImageUrl`). Always pass
  the garment to `photoUrl`: a replaced photo keeps its file name, and the `photoVersion` in the URL is what
  makes browsers (notably Safari) load the new one; divested items get a
  green ring (`#3CB371`, as on the live site).
- Numbers are formatted Finnish style (`1 000 €`, `0,25 €`); reuse the `Intl.NumberFormat` instances.
- Check signed-in pages (Log, Manage, edit, Comparison) in the emulators before calling them done (Local testing).
- Check charts in a real browser before calling them done: the site is public, so headless Chrome via
  `puppeteer-core` (`executablePath` = the installed Google Chrome) can load, hover and screenshot it.
  Full-page screenshots sometimes leave large SVGs unpainted; screenshot the element instead.
- Categories are always listed in the standard order in `web/src/lib/categories.ts` (`compareCategories`),
  never alphabetically: Jackets and hoodies, Blazers and vests, Knits, Shirts, T-shirts and tanks, Pants,
  Shorts, Belts, Socks, Shoes, Underwear shirts, Underwear boxers, Sportswear.
- Bundle (R-18): pages are lazy-loaded in `App.tsx` (add new pages with `page(...)`), libraries are split into
  `react` / `firebase` / `firebase-storage` (uploads only, imported on demand in `firebase.ts`) / `plot` chunks in
  `vite.config.ts`, and `firebase.json` caches `/assets/**` for a year (hashed names) and revalidates every page.
- Never commit `.env.local` or service-account JSON.
- Git: run `git add`, `git commit` and `git push` as separate commands (not chained with `&&`); the local
  permission rules in `.claude/settings.local.json` allow commit, push and `tools/sync.sh` only individually.
- Never write to Firestore in bulk from scripts without a fresh `tools/backup.sh` first.
