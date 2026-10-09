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

- **Scope "rebuild the live site's views" (R-09) is complete:** the public app at
  https://wardrobediary.web.app has the portfolio page (category listing + 7 charts) and all 13 category
  pages (item listing + 6 charts each), with an app-wide date range, all checked against the live site.
- Two pieces of the live site remain: the monthly cost comparison (R-26, waiting for Olof's data, Q-4) and
  the static front / "Track your own wardrobe" pages (part of R-16).
- **Next:** Olof picks the next scope. Natural candidates, in rough order: R-14 automatic sync, R-16 domain
  switch (incl. the static pages), R-13 logging UI and R-15 cut-over, or R-18 housekeeping.

## Inbox

_(empty)_

## Now

_(nothing in progress; waiting for the next scope)_

## Next

1. **R-26 Monthly cost and comparison to other consumption** (the last live-site chart). **Blocked:** waiting
   for Olof to enter the comparison data in the Google Sheet (Q-4). Then import that tab in the sync, add it
   to `public/data`, port R's monthly cost (`yearly_cost / 12` per category, `Threddit.R`) and build the chart.
2. **R-12 Remaining open questions** (Q-2; Q-4 is covered by R-26).
3. **R-10 Golden data from R** (optional now): the live-site tables in `reference/live/` already validate
   the port; exporting more R outputs only matters if a metric is disputed.

## Later

- **R-27 Garment management in the app** (add, edit, divest), starting with the existing portfolio incl.
  divested items. Fields = Sheet columns A–K: Category, Item, Details, Photo, Price, Purchased, Divested,
  Times used init, Materials, Weight. Design proposal (2026-10-09), pending D-4:
  - **Data ownership (D-4):** garment fields move to Firestore as the source of truth; the Sheet keeps only
    the daily wear log until cut-over (R-15). The sync stops writing garment fields and matches Sheet rows
    to garments by Photo id (warns about rows without a garment and vice versa).
  - **Where:** owner-only `/manage` (shown when signed in as the owner): searchable list with filters
    (category, active/divested), and an edit page per garment. Category pages get an "Edit" link per item
    when signed in.
  - **Edit form:** category (standard list), name, details, price (€, cents), purchased / divested dates
    (divested ≥ purchased), times used init, materials, weight (g); quick "Divest today" / "Undo divest".
    Every save keeps the previous version in `garments/{id}/history` (undo, audit).
  - **Add garment:** same form plus PNG upload with a preview in the circle used on the site; Photo id
    generated as `<Category_with_underscores>-NNN` (next free number); stored as `<id>.png` in the Storage
    bucket like the existing photos. Then add a Sheet row with that Photo id to log wears until R-15.
  - **Public data:** after each save the app rebuilds `public/data` from the owner's garments and days, so
    public pages update immediately (no Cloud Function needed).
  - **Prerequisites:** Storage rules allowing the owner to upload photos (needs the live rules reviewed
    first, see R-18); Firestore rules already allow owner writes.
  - **Phases:** (a) edit and divest existing garments + sync switch; (b) add garments with photo upload;
    (c) later: delete (only garments without wears), bulk edits.

- **R-13 Daily logging UI** (mobile-first, offline). A basic version exists in `web/src/pages/LogDay.tsx`;
  don't use it for real logging until cut-over, since the sync overwrites it.
- **R-14 Automatic sync** while the Sheet is the source of truth (e.g. scheduled GitHub Action or
  Cloud Function), instead of running `tools/sync.sh --write` by hand.
- **R-15 Cut-over:** stop entering in the Sheet, make Firestore the source of truth, scheduled Firestore
  export as backup.
- **R-16 Domain switch:** point wardrobediary.io at the new app; port the static front page (`index.html`:
  text, press links, images) and `track_your_wardrobe.html` first.
- **R-17 Multi-user:** sign-up, public profiles, `public/data` written by a Cloud Function.
- **R-18 Housekeeping:** code-split the web bundle (> 500 kB warning); move `tools/.venv` to
  Python ≥ 3.10 (3.9 is end of life); review `storage.rules` against the live rules before it is ever
  deployed.

## Decisions needed

- **D-4 Where do garment details live once they can be edited in the app (R-27)?**
  (a) Firestore becomes the source of truth for garment details now; the Sheet keeps only the wear log
  until cut-over. Simple, but columns A–K in the Sheet go stale, and a new garment still needs a Sheet row
  (Photo id only) for logging. (b) The app writes changes back to the Sheet through a Cloud Function using
  the service account (Sheet stays the single source; needs Editor access, the Blaze plan, and careful
  row matching around formulas and manual edits). (c) Wait and launch garment management together with
  in-app logging at cut-over (R-13/R-15). **Recommendation: (a).**

## Open questions

- **Q-2** Meaning of the row background colours in Sheet column B (pink / orange / blue).
- **Q-4** Comparison data for the monthly cost chart (external consumption benchmarks). **Waiting for
  Olof** to enter it in the Google Sheet (R read it from a "Comparison" tab). Blocks R-26.
- **Q-9** 13 garments still have 1–3 wears outside their purchase-to-divest period (listed by
  `tools/sync.sh`; ignored by the metrics, as in R). Mostly a single wear just after the divest date.
  Fix the dates in the Sheet if they are wrong; otherwise nothing to do.
- **Q-10** *G Star Raw black short jacket* (Jackets and hoodies) has no photo in Storage, so its image is
  blank (also on the live site).

Reference values: the live site's tables are saved in `reference/live/*.csv` (git-ignored, snapshot
2026-09-03: the "Days used" shares fit exactly 3,168 days); compare against that date, not today.

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

- **R-25** 2026-10-09 Category pages, all 13, generic (`/category/<slug>`, linked from the Dashboard): item
  listing with photos and data bars; Times worn (one row per item, divested percentile bands); cost per
  wear vs times worn (trails + price guides) and vs frequency of use (divested averages); both animated
  "as of" a date; category daily cost. Reviewed on Jackets and hoodies.
- **R-09** 2026-10-09 Portfolio page rebuilt on the public Dashboard: category listing (images, data bars,
  date range), active items and inventory value by category (small multiples, D-3), total inventory value,
  cost per wear and yearly cost vs frequency of use (category scatters), daily cost and its "as of"
  animation. Only the monthly cost comparison remains (R-26).
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
