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

- **Cut-over done (R-13, R-15):** the app is the source of truth for wears too. Final Sheet sync through
  2026-10-09 (31,539 wears); the Sheet is retired and the sync refuses to write. Logging happens at `/log`
  (mobile-first, offline-capable). **Waiting for Olof to test logging** (needs the owner's sign-in).
- **R-27 phase (c)** (replace photo, delete, bulk changes) is also waiting for Olof's test.
- **Backups (R-28) run nightly** on GitHub (first run 2026-10-10, verified: restores to exactly the live data).
- Next candidates: R-28 automatic backup, R-16 domain switch, R-26 once the Q-4 data exists.

## Inbox

_(empty)_

## Now

- **R-27 Garment management**: all three phases built; (c) awaiting Olof's test.
- **R-13/R-15 Logging in the app**: done; awaiting Olof's test.

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
  Times used init, Materials, Weight. Design agreed 2026-10-09 (D-4 = option a):
  - **Data ownership (D-4):** garment fields live in Firestore as the source of truth; the Sheet keeps only
    the daily wear log until cut-over (R-15). The sync no longer writes garment fields and matches Sheet
    rows to garments by Photo id (new Sheet rows still create a garment once). ✅ done
  - **Where:** owner-only `/manage` (shown when signed in as the owner): searchable list with filters
    (category, active/divested), and an edit page per garment. Category pages get an "Edit" link per item
    when signed in. ✅ done
  - **Edit form:** category (standard list), name, details, price (€, cents), purchased / divested dates
    (divested ≥ purchased), times used init, materials, weight (g); quick "Divest today" / "Undo divest".
    Every save keeps the previous version in `garments/{id}/history` (undo, audit). ✅ done
  - **Add garment:** same form plus PNG upload with a preview in the circle used on the site; Photo id
    generated as `<Category_with_underscores>-NNN` (next free number); stored as `<id>.png` in the Storage
    bucket like the existing photos. Then add a Sheet row with that Photo id to log wears until R-15. ✅ done
  - **Public data:** each save also updates the garment's entry in `public/data` (same transaction), so
    public pages update immediately (no Cloud Function needed). ✅ done
  - **Prerequisites:** Storage rules allowing the owner to upload photos ✅ (live rules reviewed and
    replaced, 2026-10-09); Firestore rules already allow owner writes.
  - **Phases:** (a) edit and divest existing garments + sync switch ✅ 2026-10-09 (tested); (b) add garments
    with photo upload ✅ 2026-10-09 (tested); (c) replace a garment's photo, delete (only never-worn garments,
    recorded in `deletedGarments` so the sync won't re-create them), bulk changes (divest on a date, mark
    active, set category) ✅ built 2026-10-09.

- **R-16 Domain switch:** point wardrobediary.io at the new app; port the static front page (`index.html`:
  text, press links, images) and `track_your_wardrobe.html` first.
- **R-17 Multi-user:** sign-up, public profiles, `public/data` written by a Cloud Function.
- **R-18 Housekeeping:** code-split the web bundle (> 500 kB warning); move `tools/.venv` to
  Python ≥ 3.10 (3.9 is end of life). (Storage rules: done 2026-10-09.)

## Decisions needed

_(none open)_

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

- **2026-10-09 Cut-over (R-15):** the app is the source of truth for wears from 2026-10-10 on; the Sheet holds
  the log through 2026-10-09 and is retired (`settings/app.sheetRetired`, the sync refuses to write).
  R-14 (automatic Sheet sync) is dropped as obsolete.

- **2026-10-09 Storage rules** (security fix): both buckets stay publicly readable; uploads only by the owner,
  only `<Photo id>.png` (PNG, < 5 MB) in the photo bucket; `threddit-plots` read-only through the apps; no
  deletes. The 2021 rules allowed any signed-in user to write anything, which became exploitable when
  Google sign-in was enabled for the new app. Checked: no files changed between 2026-10-07 and the fix.

- **2026-10-09 D-4** Garment details (Sheet columns A–K) are edited in the app and stored in Firestore,
  which is their source of truth; the Sheet keeps only the daily wear ticks until cut-over (R-15). Chosen
  over writing changes back to the Sheet (needs a Cloud Function, Sheet edit access, fragile row matching)
  and over waiting for cut-over. Consequence: Sheet columns A–K go stale and should no longer be edited.

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

- **R-28** 2026-10-10 Nightly backups: GitHub Actions in the private repo `hoverfalt/wardrobe-diary-backups`
  (02:17 UTC, read-only service account "wardrobe-backup", secret `FIREBASE_BACKUP_KEY`), committing
  `wardrobe.json` + `last-backup.txt`; GitHub emails on failure. `tools/restore.sh` restores from any backup
  (dry run by default). First run verified against the live data: zero differences. Note: the stored GitHub
  token lacks the `workflow` scope, so the workflow file is edited in GitHub's web editor.

- **R-13 / R-15** 2026-10-09 Logging in the app as the source of truth: final Sheet sync (632 garments,
  3,194 days, 31,539 wears), Sheet retired with a write guard, mobile-first `/log` (day navigation, outfit
  chips, search, recent-first, offline status; each tap updates the day and the public data in one batch),
  `tools/backup.sh` with a first backup.

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
