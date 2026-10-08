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

## Where we left off (2026-10-08)

- Category listing is done and live on the signed-in Dashboard (wardrobediary.web.app); the live site is untouched.
- **Waiting for Olof:** D-1 (what public pages expose), D-2 (span semantics), Q-8 (Boss Modern black 15/16 divest date), plus new remarks.
- **Next for Claude:** triage the new remarks into this file; after any Sheet fixes run
  `tools/sync.sh --write --dump ../reference/sheet.json`; continue R-09 with "Active items by category
  (over time)", the first chart (load the dataviz skill first; Observable Plot is the suggested library).

## Inbox

_(empty)_

## Now

- **R-09 Public views: rebuild** from the Firestore data, each view checked against the live site's
  numbers. Checklist from the R-08 inventory of wardrobediary.io; suggested order is top to bottom.

  Portfolio page (`portfolio.html`):
  - [x] Category listing table: Category, Active items, Inventory value, Cost per wear, Days used
        (share of days), Yearly cost, Inventory turnover; plus a Total row. On the signed-in Dashboard
        with a from/to date range; matches the live site except where the live site is wrong (see R pipeline bugs)
  - [ ] Active items by category (over time)
  - [ ] Inventory value by category (over time)
  - [ ] Total inventory value (over time, stacked)
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
2. **R-11 Public data document.** Have the sync also write `users/{uid}/public/summary`, so public
   pages need one document read. Blocked by D-1.
3. **R-12 Resolve the remaining metric questions** (Q-1, Q-2, Q-4) against the Threddit R scripts.

## Later

- **R-13 Daily logging UI** (mobile-first, offline). A basic version exists in `web/src/pages/LogDay.tsx`;
  don't use it for real logging until cut-over, since the sync overwrites it.
- **R-14 Automatic sync** while the Sheet is the source of truth (e.g. scheduled GitHub Action or
  Cloud Function), instead of running `tools/sync.sh --write` by hand.
- **R-15 Cut-over:** stop entering in the Sheet, make Firestore the source of truth, scheduled Firestore
  export as backup.
- **R-16 Domain switch:** point wardrobediary.io at the new app once it covers the live site.
- **R-17 Multi-user:** sign-up, public profiles, `public/summary` via Cloud Function.
- **R-18 Housekeeping:** code-split the web bundle (> 500 kB warning); move `tools/.venv` to
  Python ≥ 3.10 (3.9 is end of life); review `storage.rules` against the live rules before it is ever
  deployed.

## Decisions needed

- **D-1 What do public pages expose?** Either (a) one public document with the full compact daily
  log, so all metrics are computed in the browser with the existing TypeScript code, or (b) aggregates
  only, which shows less detail but means duplicating some metric logic in Python. Recommendation: (a).
  User-chosen time spans (see Decisions made, 2026-10-08) practically require it: with (b), every span
  a visitor could pick would have to be precomputed.
- **D-2 What do metrics mean for a span that starts after 2018-01-01?** The R metrics are all
  "from the start of tracking up to a date". Current provisional rule: only wears inside the span count,
  "Times used init" counts only for spans starting 2018-01-01, and a garment's full price counts in
  every span it was owned in (so short spans show high cost per wear). Alternatives: spread the price
  over the ownership period, or show "cost so far" as of the end date. To decide when building the
  first view where it matters.

## Open questions

- **Q-1** Exact daily-cost formula in R (the "Daily cost" chart, `calculate_daily_cost`).
- **Q-2** Meaning of the row background colours in Sheet column B (pink / orange / blue).
- **Q-4** Data source of the external consumption benchmarks in the monthly comparison
  (R reads a "Comparison" tab from the Sheet).
- **Q-8** 15 garments have wears outside their purchase-to-divest period; the metrics ignore those wears
  (as R did), and `tools/sync.sh` lists them. Mostly single wears just after the divest date, but
  *Boss Modern black 15* and *16* have about 60 wears each after a divest date of 2023-05-05,
  one day after purchase. Is that divest date a typo?

### R pipeline bugs found while porting (the new code does not reproduce them)

- R matched garments by item name, so names used twice in the Sheet collide: *Urban Classics dark camo
  07–10* (Underwear boxers) are missing from the live site.
- The live Sportswear category row shows an inventory value 210 € above the sum of the live Sportswear
  item table.

## Decisions made

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
- **R-08** 2026-10-07 Inventory of the live site's views (checklist under R-09); live tables saved
  to `reference/live/`.
