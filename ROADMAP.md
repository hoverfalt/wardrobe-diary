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

## Inbox

_(empty)_

## Now

- **R-08 Public views: inventory.** Go through wardrobediary.io and list every chart and table with
  its metric, so they can be rebuilt one by one. Output: a checklist under R-09.

## Next

1. **R-09 Public views: rebuild charts** from the Firestore data, starting with the simplest (cost per
   wear per garment, active items by category), each checked against the live site's numbers.
2. **R-10 Reference data from R.** Export golden CSVs from the Threddit R pipeline into `reference/`
   and add tests comparing the TypeScript metrics to them.
3. **R-11 Public data document.** Have the sync also write `users/{uid}/public/summary`, so public
   pages need one document read. Blocked by D-1.
4. **R-12 Resolve the metric questions** (Q-1 to Q-4 below) against the Threddit `02-`/`03-` scripts.

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
  only, which shows less detail but means duplicating some metric logic in Python. Recommendation: (a),
  unless the day-by-day log should stay private.

## Open questions

- **Q-1** Exact daily-cost formula in R.
- **Q-2** Meaning of the row background colours in Sheet column B (pink / orange / blue).
- **Q-3** How cost per wear handles 0 uses (the TypeScript code currently returns null).
- **Q-4** Data source of the external consumption benchmarks in the monthly comparison.

## Decisions made

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
