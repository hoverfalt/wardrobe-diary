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
- **Next for Claude:** R-09 "Average cost per wear and category frequency of use".

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
  - [ ] Average cost per wear and category frequency of use
  - [ ] Average yearly cost and category frequency of use
  - [ ] Daily cost (cost of all items worn on a day; "all divested" = final)
  - [ ] Daily cost animated by date (GIF on the live site; could become an interactive date slider)
  - [ ] Monthly cost and comparison to other consumption (needs Q-4)

  One page per category (13: Jackets and hoodies, Blazers and vests, Knits, Shirts, T-shirts and tanks,
  Pants, Shorts, Belts, Socks, Shoes, Underwear shirts, Underwear boxers, Sportswear):
  - [ ] Item listing table: Item, Price, Times worn, Cost per wear, Wears per month, Status
  - [ ] Times worn per item
  - [ ] Cost per wear and times worn
  - [ ] Cost per wear and frequency of use
  - [ ] Times worn, animated by date
  - [ ] Cost per wear and frequency of use, animated by date
  - [ ] Daily cost for the category

  Other pages: front page (`index.html`, text, press links, images) and `track_your_wardrobe.html`
  (text). They are static content: port as-is when doing R-16.

  Reference values: the live site's tables are saved in `reference/live/*.csv` (git-ignored). The
  snapshot's "Days used" shares fit exactly 3,168 days, so the live data runs to about 2026-09-02;
  compare against that date, not today.

## Next

1. **R-10 Reference data from R.** Export golden CSVs from the Threddit R pipeline into `reference/`
   and add tests comparing the TypeScript metrics to them.
2. **R-12 Resolve the remaining metric questions** (Q-1, Q-2, Q-4) against the Threddit R scripts.

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

- **Q-1** Exact daily-cost formula in R (the "Daily cost" chart, `calculate_daily_cost`).
- **Q-2** Meaning of the row background colours in Sheet column B (pink / orange / blue).
- **Q-4** Data source of the external consumption benchmarks in the monthly comparison
  (R reads a "Comparison" tab from the Sheet).
- **Q-9** 13 garments still have 1–3 wears outside their purchase-to-divest period (listed by
  `tools/sync.sh`; ignored by the metrics, as in R). Mostly a single wear just after the divest date.
  Fix the dates in the Sheet if they are wrong; otherwise nothing to do.

### R pipeline bugs found while porting (the new code does not reproduce them)

- R matched garments by item name, so names used twice in the Sheet collide: *Urban Classics dark camo
  07–10* (Underwear boxers) are missing from the live site.
- The live Sportswear category row shows an inventory value 210 € above the sum of the live Sportswear
  item table.

## Decisions made

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
- **R-11** 2026-10-09 Public data document `public/data` (full log, one read) written by the sync;
  Dashboard reads it and no longer needs sign-in.
- **R-21** 2026-10-09 D-2 cost per wear implemented (lifetime garment cost per wear, use-weighted
  category average).
- **R-08** 2026-10-07 Inventory of the live site's views (checklist under R-09); live tables saved
  to `reference/live/`.
