# Roadmap

How this file works:
- **Inbox:** drop any idea, bug or wish here as a one-liner, in any form. You can also just tell
  Claude "add to the roadmap: …".
- **Triage:** Claude moves inbox items into Now / Next / Later (or Decisions) with an ID, and asks
  when the priority isn't obvious.
- **Now** holds what is being worked on (keep it to 1–3 items). **Next** is the ordered queue.
  **Later** is unordered.
- When an item is finished it moves to **Done** with the date. Decisions record what was chosen and why.
- IDs (`R-12`) are never reused, so commits and conversations can refer to them.

## Where we left off (2026-10-09)

- D-1, D-2 and Q-8 decided/fixed and implemented. The Dashboard is now public (no sign-in) and reads
  the single `public/data` document.
- Active items, inventory value by category and total inventory value charts are done (small multiples, D-3).
- Portfolio page rebuilt except "Monthly cost and comparison", postponed until the comparison data is in
  the Sheet (Q-4, waiting for Olof).
- All 13 category pages are complete (table + 6 charts), generic, reviewed on Jackets and hoodies.
- Remaining from the live site: monthly cost comparison (Q-4, waiting for Olof) and the static front/info
  pages (with R-16).

## Inbox

_(empty)_

## Now

- **R-09 Public views: rebuild** from the Firestore data, each view checked against the live site's
  numbers. Checklist from the R-08 inventory of wardrobediary.io; suggested order is top to bottom.

  Portfolio page (`portfolio.html`):
  - [x] Category listing table: Category, Active items, Inventory value, Cost per wear, Days used
        (share of days), Yearly cost, Inventory turnover; plus a Total row. On the public Dashboard with
        a from/to date range, category images and data bars (same colours and max logic). Cost per wear,
        Yearly cost and Turnover follow D-2; the rest matches the live site except where it is wrong
  - [x] Active items by category (over time): small multiples (D-3). Sportswear left out, as on the live site
  - [x] Inventory value by category (over time): small multiples (D-3)
  - [x] Total inventory value (over time): one total line. The live site stacks the categories; with D-3
        the per-category split is shown by the small multiples above instead
  - [x] Average cost per wear and category frequency of use: scatter, one category image per point in
        its colour ring (as on the live site), Sportswear included; values from the category listing (D-2)
  - [x] Average yearly cost and category frequency of use: same scatter, y = yearly cost (D-2)
  - [x] Daily cost (cost of all items worn on a day; "all divested" = final): dots + 30-day centred average,
        summers shaded, fixed 0–40 € scale with a note on days above it; hollow/filled dots as well as colour
  - [x] Daily cost animated by date: interactive "as of" slider with play/pause instead of a GIF
  - [ ] Monthly cost and comparison to other consumption. **Postponed until Olof has entered the
        comparison data in the Google Sheet (Q-4)**; then import that tab in the sync and build the chart

  One page per category (13: Jackets and hoodies, Blazers and vests, Knits, Shirts, T-shirts and tanks,
  Pants, Shorts, Belts, Socks, Shoes, Underwear shirts, Underwear boxers, Sportswear), at
  `/category/<slug>`, linked from the Dashboard table. **Built generically, first reviewed on Jackets and
  hoodies;** every category page works the same way:
  - [x] Item listing table: Item, Price, Times worn, Cost per wear, Wears per month, Status (data bars,
        active first, then by times worn), item photos
  - [x] Times worn per item: one row per item (no overlapping photos), divested items' 5–95 % and
        32–68 % bands
  - [x] Cost per wear and times worn: photos, grey trails (price / n per item), blue price guides
  - [x] Cost per wear and frequency of use: divested items' averages as dotted lines (matches the live
        site: jackets 1.9 wears/month, 1.36 €/wear)
  - [x] Times worn, animated by date: "as of" player; rows keep their spacing
  - [x] Cost per wear and frequency of use, animated by date: fixed scales while playing
  - [x] Daily cost for the category: scale fitted to the category

  Other pages: front page (`index.html`, text, press links, images) and `track_your_wardrobe.html`
  (text). They are static content: port as-is when doing R-16.

  Reference values: the live site's tables are saved in `reference/live/*.csv` (git-ignored). The
  snapshot's "Days used" shares fit exactly 3,168 days, so the live data runs to about 2026-09-02;
  compare against that date, not today.

## Next

1. **R-10 Reference data from R.** Export golden CSVs from the Threddit R pipeline into `reference/`
   and add tests comparing the TypeScript metrics to them.
2. **R-12 Resolve the remaining metric questions** (Q-2, Q-4) against the Threddit R scripts.

## Later

- **R-13 Daily logging UI** (mobile-first, offline). A basic version exists in `web/src/pages/LogDay.tsx`;
  don't use it for real logging until cut-over, since the sync overwrites it.
- **R-14 Automatic sync** while the Sheet is the source of truth (e.g. scheduled GitHub Action or
  Cloud Function), instead of running `tools/sync.sh --write` by hand.
- **R-15 Cut-over:** stop entering in the Sheet, make Firestore the source of truth, scheduled Firestore
  export as backup.
- **R-16 Domain switch:** point wardrobediary.io at the new app once it covers the live site.
- **R-17 Multi-user:** sign-up, public profiles, `public/data` written by a Cloud Function.
- **R-18 Housekeeping:** code-split the web bundle (> 500 kB warning); move `tools/.venv` to
  Python ≥ 3.10 (3.9 is end of life); review `storage.rules` against the live rules before it is ever
  deployed.

## Decisions needed

_(none open)_

## Open questions

- **Q-2** Meaning of the row background colours in Sheet column B (pink / orange / blue).
- **Q-4** Comparison data for the monthly cost chart (external consumption benchmarks). **Waiting for
  Olof** to enter it in the Google Sheet (R read it from a "Comparison" tab).
- **Q-10** *G Star Raw black short jacket* (Jackets and hoodies) has no photo in Storage, so its image is
  blank (also on the live site).
- **Q-9** 13 garments still have 1–3 wears outside their purchase-to-divest period (listed by
  `tools/sync.sh`; ignored by the metrics, as in R). Mostly a single wear just after the divest date.
  Fix the dates in the Sheet if they are wrong; otherwise nothing to do.

### R pipeline bugs found while porting (the new code does not reproduce them)

- R matched garments by item name, so names used twice in the Sheet collide: *Urban Classics dark camo
  07–10* (Underwear boxers) are missing from the live site.
- The live Sportswear category row shows an inventory value 210 € above the sum of the live Sportswear
  item table.

## Decisions made

- **2026-10-09 Q-1** Daily cost (from R `calculate_daily_cost`) = Σ over garments worn that day (and owned
  then) of their lifetime cost per wear; "all divested" = every one of them is divested, so the value is
  final. Plus a 30-day rolling mean centred on the day. Matches D-2. The animation instead uses values
  "as of" each date (only wears up to then), which is what the live site's GIF shows.

- **2026-10-09 D-3** Charts that show several categories use small multiples: one small chart per
  category on a shared scale, with its category image and the value at the end date, instead of many
  coloured lines in one chart (the original 12-colour palette fails colour-blind and contrast checks).
  Applies to all current and future multi-category charts.

- **2026-10-09 D-1** Public pages get the full day-by-day log and compute the metrics from it. The sync
  writes it to the world-readable `users/{uid}/public/data` document; the Dashboard is public.
- **2026-10-09 D-2** A garment's cost per wear is always price / all its wears over its whole ownership
  (purchase to divest day inclusive), regardless of the chosen time span, even when wears after the
  span lower it: the concept must be treated consistently. A category's cost per wear for a span is the
  use-weighted average of the cost per wear of its garments worn at least once in the span.
- **2026-10-09 Q-8** The divest dates of *Boss Modern black 15* and *16* (2023-05-05) were typos; now
  blank in the Sheet.

- **2026-10-08** Sheet rows with an empty Category are skipped by the sync, like "ADD NEXT" rows and as
  in R (was Q-7: 13 Socks rows, `Socks-100`…`107` and `Socks-142`…`146`).

- **2026-10-08** Metrics must work for any user-chosen time span, not just "since 2018-01-01". All metric
  functions take a date range; the per-day data stays available to the client rather than being
  pre-aggregated for fixed periods. The current data model already supports this.
- **2026-10-08** Prices are rounded to whole cents in the sync (some Sheet prices are formulas,
  e.g. a pack price divided by six), so no value shows fractions of a cent (was Q-6).

- **2026-10-07** Use the existing Firebase project `threddit-297417` rather than a new one: photos and
  domain are already there. The live site is protected by a separate Hosting site plus the `app` deploy target.
- **2026-10-07** Keep the Google Sheet as the source of truth for now; sync it into Firestore and build
  the public views in parallel with the live site.
- **2026-10-07** Make the default Firestore database Native mode (it was an empty Datastore-mode database).

## Done

- **R-01** 2026-10-07 Skeleton: Vite/React app, Firestore rules, Sheet migration tools.
- **R-02** 2026-10-07 Git repo, pushed to github.com/hoverfalt/wardrobe-diary (private).
- **R-03** 2026-10-07 Sheet access via service account; dry run reproduces "Times used" for all 649 garments.
- **R-04** 2026-10-07 Day-column validation (found and fixed the `0204-02-19` header typo in the Sheet).
- **R-05** 2026-10-07 Firestore set up (Native mode, eur3); separate Hosting site wardrobediary.web.app;
  web app registered; Google sign-in working.
- **R-06** 2026-10-07 First full sync to Firestore (649 garments, 3,192 days, 31,514 wear events).
- **R-07** 2026-10-07 Re-runnable sync (`tools/sync.sh`) that removes stale docs.
- **R-19** 2026-10-08 Ported the category listing metrics from R (Q-3, Q-5 answered: see CLAUDE.md
  Metrics); tests compare every category and item with the live site.
- **R-20** 2026-10-08 Sync skips "ADD NEXT" placeholder rows, rounds prices to cents, warns about empty
  categories and wears outside ownership.
- **R-22** 2026-10-09 Faster recalculation: a date-range change went from ~730 ms to ~160 ms (median,
  excluding the 0.3 s typing pause). Chart tooltips are formatted only for the hovered day, and number
  formatters are created once. (The metric calculations themselves take ~10 ms.)
- **R-24** 2026-10-09 Date range control: content-wide two-handle slider + exact date boxes, repeated
  above the table and under each chart section; all copies share one state and drive the whole page.
- **R-23** 2026-10-09 Date range: half-typed years (0002, 0202 …) no longer hang the tab; the charts
  update only for valid dates, 0.3 s after typing stops, as a low-priority update.
- **R-11** 2026-10-09 Public data document `public/data` (full log, one read) written by the sync;
  Dashboard reads it and no longer needs sign-in.
- **R-21** 2026-10-09 D-2 cost per wear implemented (lifetime garment cost per wear, use-weighted
  category average).
- **R-08** 2026-10-07 Inventory of the live site's views (checklist under R-09); live tables saved
  to `reference/live/`.
