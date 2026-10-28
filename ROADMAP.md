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

## Where we left off (2026-10-19)

- **Done 2026-10-18 … 19:** "Describe an item" on the Log page, with category-first browsing by photo (R-44 step 1;
  step 2 waits for a couple of weeks of `voiceLog` data); "Worn together" on the Dashboard (R-45); landing page
  media logos readable in dark mode and two higher-resolution images.
- **wardrobediary.io serves the new app** (R-16, 2026-10-17; Olof added the auth domain, submitted the sitemap and
  checked GA4), and **the public MCP server is live at https://wardrobediary.io/mcp** (R-29 phase 2). A budget
  alert in Google Cloud Billing is set (Olof, 2026-10-17). The old
  2021 image-resize extension (Node 10 function) was removed 2026-10-17; its 443 `thumbs/` files are kept.
- **Done 2026-10-13 … 16:** local emulator testing of the signed-in UI (R-39); code splitting and Python 3.12
  (R-18); the new site's landing page, redirects and sitemap, ready for the switch (R-16 steps 1–2); the repo
  made public with a cleaned history, MIT + CC BY 4.0 licences, security scanning, and Dependabot fixes (R-42);
  category cost per wear pooled over lifetime wears (D-2 amended); the semantic layer and data governance
  showcase, phases 1–4 (R-40): `/glossary`, `/model`, `/data`, `/evals`, JSON-LD, ODCS contracts, live and
  nightly quality checks, MCP `explain` and provenance, and the first AI evaluation (raw data 7/30, MCP tools
  29/30, tools + semantic layer 30/30).
- **Possibly still open for Olof:** tag the Winter and Summer garments on Manage (bulk "Add tag").
- **Earlier (to 2026-10-12):** every live-site chart rebuilt; garment management, logging in the app, backups,
  materials, tags, comparison (see Done).

## Inbox

_(empty)_

## Now

_(nothing in progress)_

## Next

1. **R-44 step 2: measure, then several items per dictation.** After a couple of weeks of use, measure from
   `voiceLog` how often the top proposal was chosen (rank 0) and where it failed; tune the matcher or compare an
   AI matcher on the same records; then allow several items in one dictation ("…, … and …").

2. **R-40 follow-ups (optional):** evaluation repeats (`--repeat 3`), a higher answer limit for the raw-data
   condition, more interpretation-heavy questions; a comparison tool in the MCP server (comparison questions
   were left out of the evaluation for lack of one).

## Later

- **R-41 Finnish and Swedish** for the whole site (landing page, app, glossary and other semantic pages); the
  semantic layer is English-only until then (Olof, 2026-10-16).

- **R-32 User-defined tags** (for the multi-user version, R-17): today's tags are a fixed vocabulary
  (`web/src/lib/tags.ts`); let users create their own tags with a badge text, filter by them everywhere.
- **R-33 Garment location** (refined with Olof 2026-10-11, parked for now): garments are kept either at the
  main home in Helsinki or at the summer home in Hanko, where they are worn only during stays there, so the two
  sets have very different statistics, and Olof keeps them separate. Goal:
  **filter the Dashboard (and category pages) and the Log page by location.** "ex Hanko" in a name = moved to
  Helsinki. Likely design: a location filter next to the date range, built on the Hanko tag. Since R-37 the "hanko" tag marks the Hanko
  garments, and since R-38 the Log page's tag toggles can hide or show them, which covers the logging half;
  what remains is a location filter for the Dashboard and category pages. Open points: whether to record move
  dates (for "ex Hanko" garments), and whether wear statistics for Hanko garments should consider only the
  time spent there.
- **R-16 Domain switch:** point wardrobediary.io at the new app, keeping every old link working.
  Findings (2026-10-13): wardrobediary.io is GitHub Pages (repo `hoverfalt/hoverfalt.github.io`, DNS at
  Bluehost), not Firebase; hoverfalt.github.io 301s to it. 16 real pages: `index.html` (project, media
  coverage, contacts; og/Twitter preview tags; GA4 G-HYJZNEMFV0), `portfolio.html`, 13 category pages
  (`jackets`, `blazers`, `knits`, `shirts`, `t-shirts`, `pants`, `shorts`, `belts`, `socks`, `shoes`, `uw_shirts`,
  `uw_boxers`, `sportswear`.html), `track_your_wardrobe.html`, `data.html`, `development.html` (an old Shoes
  draft); no robots.txt or sitemap. Chart images live on `threddit-297417.web.app` (may be embedded by
  articles: keep that site as is). Plan: (1) landing page as pre-rendered static HTML at `/` (crawlable, with
  preview tags), app Dashboard moved to `/dashboard`, `track_your_wardrobe` ported; (2) 301 redirects in
  `firebase.json` for every old `.html` path (incl. `index.html`, fragments → `/`), tested by a script;
  (3) add wardrobediary.io (+ www) as a custom domain of Hosting site `wardrobediary`, switch the Bluehost
  A records (lower the TTL a day before); (4) keep the GitHub Pages repo and its CNAME so hoverfalt.github.io
  keeps redirecting; (5) Search Console: verify, submit a sitemap, watch for 404s.
  **Status 2026-10-13:** steps (1) and (2) done and live on wardrobediary.web.app: landing page at `/`
  (ported content, preview tags, GA4 only on the real domain), Dashboard at `/dashboard`, 23 redirects incl.
  `track_your_wardrobe.html` → `/#track-your-own-wardrobe`, a "Page not found" page, robots.txt and sitemap;
  `redirect-check.mjs` all OK. Search Console's sampled links (18 sites) all point to `/` or `/index.html`.
  Remaining (Olof, with Claude's checklist): (3) custom domain + Bluehost DNS, (4) keep the GitHub Pages repo,
  (5) Search Console sitemap; then rerun `redirect-check.mjs https://wardrobediary.io` and update the landing
  page text.
- **R-17 Multi-user:** sign-up, public profiles, `public/data` written by a Cloud Function.

## Decisions needed

_(none open)_

## Open questions

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

- **2026-10-17 R-10 closed (Olof):** no further golden data exported from the R pipeline. The live site's tables
  (snapshot 2026-09-03) already validate the port in `metrics.reference.test.ts`, and the deliberate differences
  (e.g. D-2) are documented there and in the semantic layer.

- **2026-10-12 Q-2** Sheet row colours in column B: light blue = kept in Hanko (not consistently applied, so
  combined with "(Hanko)" in names), grey-blue = bicycle gear, pink = motorcycle gear. Now tags (R-37).

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
  span lower it: the concept must be treated consistently. A category's cost per wear for a span was the
  use-weighted average of the cost per wear of its garments worn at least once in the span.
  **Amended 2026-10-16 (Olof):** a category's cost per wear is Σ price / Σ lifetime wears over its garments
  owned at any point in the span, unworn garments included (÷ 1 if none was ever worn), so unused purchases
  count. Changes Yearly cost, Turnover and the monthly cost comparison too (semantic layer 0.2.0).
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

- **R-46** 2026-10-28 Rotation series on the Log page (Olof's idea): identical garments kept as one heap and worn in
  turn (e.g. SOC U 4P Black 01 … 08 (39-42)) can be marked on a garment's edit page ("Rotate as a series", stored in
  `settings/app.rotationSeries`). A marked series shows on `/log` as one tile that logs the next in line, i.e. the
  fewest lifetime wears, then the lowest number; the day's chip shows the actual garment, and tapping the tile again
  removes it. A search matching only some of the series (e.g. "Black 05") lists those one by one. "Describe an item"
  proposes the same garment for marked series (matcher v1.2); unmarked identical garments keep "worn longest ago".
  Also a Clear button next to the Log search box (2026-10-25). Semantic layer 0.4.1: term and setting "rotation series".
- **Landing page** 2026-10-19: in dark mode the media logos (dark text on transparent PNGs) and contact icons sit on
  white tiles; "Making data-supported consumption choices" and the Reaktor blog post use Olof's 1,700 px uploads
  (`Making_data-supported_consumption_choices-large.jpg`, `Reaktor_blog_post.png`).
- **R-45** 2026-10-19 "Worn together" on the Dashboard (above the monthly cost comparison): a ring of every garment
  worn in the date range, grouped into category arcs (most worn first). Sportswear left out (as in the other Dashboard charts over time). Pick a category: one line per companion
  garment, as strong as the days worn with the category, ending at the category's garment it is most often worn
  with (drawing every pair, ~4,700 lines, filled the circle). Hover a garment for only its lines; tap or click it
  (or a list entry) to choose it. A list under the ring shows the top 12 companions with photos, days together and
  share of their wears. `lib/combinations.ts` (`wornTogether`, `companions`, tested); semantic layer 0.4.0
  adds the metric and term "worn together".
- **R-44 (step 1)** 2026-10-18 "Describe an item" on the Log page: type or dictate (iPhone keyboard microphone)
  e.g. "black Diesel boxers" or "Jockey white number four"; the best match among the day's loggable garments
  (active, not yet logged, within the Filters) is shown with up to three alternatives and logged only on a tap.
  Matcher `lib/voiceMatch.ts` (no AI, offline): normalised words (diacritics, plurals, brand spellings such as
  H&M / G-Star / Jack & Jones, synonyms such as tee, trainers), rare words weigh more, fuzzy matching only for
  words not in the wardrobe (so "black" never matches "blank"), spoken garment types filter by category
  ("boxers" never proposes a belt), a spoken number picks that garment ("4" = "04"), otherwise identical garments
  are represented by the one worn longest ago (Olof's rotation rule; the recent-wear nudge never overrides it).
  Each description, the proposals and the choice are recorded in `voiceLog` (owner-only, in the catalog and the
  nightly backup) to measure accuracy. Decisions by Olof: English, one item at a time first.
  Then (same day, Olof's idea): saying the category first works as a filter ("Jacket, Barbour"), and a category
  said alone ("Jacket") or with words that fit nothing of it shows that category's garments as photos, most worn
  in the last 60 days first (identical items as one, shown by the one worn longest ago); "one" counts as a number
  only as "number one" / "zero one". Materials left out of matching (Olof: not how he describes garments).

- **R-29 phase 2 / R-40 phase 5** 2026-10-17 Public MCP server at `https://wardrobediary.io/mcp`: the same server
  definition over MCP Streamable HTTP (stateless, read-only, public data, semantic layer and provenance on), as a
  2nd-gen Cloud Function in europe-north1 (≤ 2 instances, 256 MiB, 60 s) behind a Hosting rewrite; own codebase
  `mcp` so the old v1 image-resize extension function is untouched; image cleanup policy 1 day. Tested: HTTP
  end-to-end test with a real client (CI), the Functions emulator, then live (10 tools, figures match the
  Dashboard, provenance, `explain`). Listed in `/llms.txt`, on the landing page and in `mcp/README.md#connect`;
  the catalog's public-data distribution updated (semantic layer 0.2.2).

- **R-16** 2026-10-17 Domain switch (follow-ups done by Olof: auth domain, sitemap, GA4): wardrobediary.io now served by Firebase Hosting (site `wardrobediary`), with a
  certificate issued before the switch (Advanced setup: ownership TXT, `_acme-challenge` TXT, then the A record
  `199.36.158.100`), so visitors never saw a certificate warning. `www` redirects to the apex with its own
  certificate. Verified live: all 23 old-page redirects incl. `?trk=` links, all pages, old hoverfalt.github.io
  links (two hops to the right page), http → https. Bluehost took about an hour or more to publish each `@` change.

- **R-43** 2026-10-16 The semantic layer made findable: an "Open data, explained" section on the landing page
  (with the evaluation result as a first experiment, linked to its caveats) and a "Data & definitions" menu item;
  "How it's calculated" / "Definitions" links under every chart and table on the Dashboard, category, garment and
  materials pages (checked by a test); `/llms.txt` for AI assistants and crawlers (generated); the DCAT catalog
  linked from every page head. Then: each definition link shows its definition in a popup where the reader is
  (hover on a computer, first tap on a phone; "More" opens the full entry), and every app page has a footer with
  Glossary, Model, Data catalog, AI evaluation and Source. Goes live on wardrobediary.io with the domain switch.

- **R-40** 2026-10-16 Semantic layer and data governance showcase, phases 1–4 (decisions by Olof: in this repo,
  made public, and on the website; English only; public MCP server after the domain switch). `semantics/` 0.2.1
  (reviewed by Olof): ontology, glossary (42 terms), semantic model (22 metrics, each linked to code and tests),
  catalog (10 datasets, lineage, classification, 9 quality rules), decision register. Generated and committed:
  `/glossary`, `/model` (Mermaid diagram), `/data` (live quality checks), `/evals`; JSON-LD (SKOS, DCAT, RDFS/OWL,
  PROV-O; parsed as RDF in tests); 7 ODCS v3 contracts (validated against the schema). Quality checks in one place
  (`lib/quality.ts`) for the page, the MCP and the nightly `Data quality` workflow; public copy = source verified
  with a backup. MCP: `explain`, `get_data_quality`, semantic resources, provenance in every answer. GitHub
  Actions: `Tests` on every push, `Data quality` nightly. AI evaluation (`mcp/evals/`, 30 questions, answers
  computed by the app, graded in code): first run 2026-10-16 with Claude Sonnet 5.5 ($7.51): raw data 7/30, MCP
  tools 29/30, tools + semantic layer 30/30; the one difference was the D-2 lifetime cost-per-wear trap.
  Found on the way: four definitions cut short by YAML commas (now prevented by a test); a JSON-LD named-graph
  mistake (caught by the RDF test); MCP text inaccuracies (Days used, now generated).

- **R-42** 2026-10-16 Repo made public (history rewritten first to drop a home-usage detail; safety mirror in
  `backups/`), README for visitors, MIT licence for code + CC BY 4.0 (LICENSE-CONTENT.md) for semantics, content
  and data; secret scanning, push protection, Dependabot and malware alerts on. Dependabot's first scan: 9 alerts
  (2 critical), all in dev tools or Node-only paths, none in the browser bundle. Fixed: vitest 3 → 5,
  puppeteer-core 24 → 25, firebase-tools 15.34, npm overrides for `@grpc/grpc-js` 1.14.6, `uuid` 11.1.1,
  `@opentelemetry/core` 2.12 (verified: tests, build, emulators + signed-in checks, deploy, live checks).
  **Accepted:** `braces` ≤ 3.0.3 (stack-exhaustion DoS on crafted glob patterns) via firebase-tools' file watcher -
  no fixed version exists yet; dev-only, no untrusted input. Revisit when a fix ships.

- **R-18b** 2026-10-13 Python 3.12 for `tools/` (3.9 is end of life): standalone CPython 3.12.15 installed
  user-locally (`~/.local/share/python-3.12.15`, checksum verified), `tools/.venv` rebuilt (firebase-admin 7.7,
  google-cloud-firestore 2.34). Verified: 16 tests, backup (identical to the nightly one apart from today's
  wears), restore dry run (0 differences), Sheet sync and tag migration dry runs, emulator seeding. The nightly
  job already ran 3.12, so nothing changed there. R-18 is complete.

- **R-18a** 2026-10-13 Code splitting: the single 1.25 MB bundle (390 kB gzipped) is now lazy-loaded pages plus
  library chunks (react, firebase, plot; firebase-storage only for uploads). A first public visit needs ~306 kB
  of JavaScript; the owner-only pages and upload code no longer go to visitors; after a deploy, returning
  visitors re-download only the changed app code (assets cached a year, pages always revalidated). A stale
  chunk after a deploy reloads the page once. Verified: live public pages (`web/e2e/public-check.mjs`) and the
  signed-in pages on the split build in the emulators, including a photo upload.

- **R-39** 2026-10-13 Local testing of the signed-in UI: Firebase emulators (auth, Firestore, Storage) seeded from
  a backup (`tools/emulator.sh`, `seed_emulator.py`, local hosts only), the app in emulator mode
  (`npm run dev:emulator`: banner, stand-in owner sign-in) and a puppeteer smoke check (`npm run ui-check`:
  logging a wear, Filters popup, Manage, Comparison; all pass). Java 21 (Temurin) installed user-locally.
  Chosen over a test account (owner-only pages and rules would reject it) and over signing in to production
  with a custom token (tests would change live data). Possible next step: Firestore rules tests in the emulator.

- **R-38** 2026-10-12 Season tags Winter (WIN) and Summer (SUM), and tag toggles at the top of the Log page for
  every tag: tap to cycle neutral → green (show only garments with a green tag) → red (hide garments with that
  tag; red wins) → neutral. Kept between sessions in the browser (per device); garments already worn that day
  stay listed; "N hidden · Clear". E.g. Hanko and Summer red when logging in Helsinki off-season. The season
  tags start empty: set them on Manage (bulk "Add tag"). The toggles sit in a "Filters" popup next to "All
  changes saved" (highlighted, with the number of active toggles, while filtering).

- **R-37** 2026-10-12 Tags Hanko (HKO), Bicycle gear (BIKE) and Motorcycle gear (MC), managed like Second hand;
  the Log and Manage searches match tags ("motorcycle", "bike"). Migrated from the Sheet's row colours (Q-2,
  answered by Olof: blue = Hanko, grey-blue = bicycle, pink = motorcycle) with `tools/migrate_colour_tags.sh`:
  Hanko = "(Hanko)" in the name or a blue row, except "ex Hanko" (87; "(Hanko)" removed from names), bicycle 5,
  motorcycle 10 (incl. Warmpeace trekking shorts, Olof's call). Backup taken, history kept. Chart legends list
  the tags present; photo badges became rounded pills that fit longer badges.

- **R-36** 2026-10-12 Comparison photos: Olof uploaded the 19 `Comparison-*.png` (228 × 228) next to the garment
  photos; they show in the chart (grey rings) and at `/manage/comparison` (thumbnails, replace), like garment photos.

- **R-26** 2026-10-12 Monthly cost compared with other spending (the last live-site chart), at the bottom of the
  Dashboard: categories' yearly cost / 12 against Days used, with 19 other spending items in grey (labels; photos
  once uploaded). The Sheet's "Comparison" tab was imported once as values (`tools/import_comparison.sh`) into
  `settings/comparison` + the public data; managed at `/manage/comparison` (linked from Manage, not in the
  nav), where monthly cost and use frequency (% or a fraction like 6/7) are entered and yearly cost and cost
  per use calculated. Storage rules allow owner uploads of `Comparison-<Name>.png`. Q-4 resolved. Unlike R
  (y-axis capped at 65 €), all items are shown, including Audible (150 €) and Charities (77 €).

- **R-35** 2026-10-11 Sortable tables (Dashboard category listing and category item listings): click a header
  to sort largest first, again for smallest first; Category / Status restore the default order.

- **R-34** 2026-10-11 "Second hand" column on the Dashboard category listing (share of active items bought
  second hand, fixed 100 % bar scale; also in the MCP category listing), to promote buying second hand.
  Column titles shortened: Items, Value, Turnover.

- **R-31** 2026-10-11 Garment tags, starting with "Second hand": tags field with a fixed vocabulary; the
  23 "(SH)" garments migrated (tag set, "(SH)" removed from names, history kept, backup taken); "SH" badges
  next to names (category tables, Manage, garment page) and on photos in the item charts, tooltips and
  legends; tag checkboxes in the forms, bulk add/remove and a tag filter on Manage; second-hand counts on
  category pages and the owned-mass share on Materials; MCP tags and filter. No calculation changes.

- **R-30** 2026-10-11 Garment details, materials and weight: materials parser (all 108 real texts read; NA
  texts count as unknown) and fibre mass metrics (`web/src/lib/materials.ts`); MCP materials/composition/
  weight, filters and `get_material_breakdown`; a "Review" filter on the Manage page (materials unreadable /
  estimated / missing, weight missing); public garment pages `/garment/<id>`; a public `/materials` page
  (fibre mass owned and worn, fibre mix per category, monthly outfit weight and synthetic share) with
  fibre-type colours validated for colour-blind safety.

- **R-29 phase 1** 2026-10-11 Local read-only MCP server (`mcp/`): 7 tools (8 with R-30's material breakdown) + a
  definitions resource over the public data, computed with the web app's own metrics (bundled); `.mcp.json` for Claude Code, Claude
  Desktop setup in `mcp/README.md`; unit tests and a live end-to-end test. Connected in Olof's Claude
  Desktop and working (2026-10-11).

- **R-27** 2026-10-10 Garment management in the app (owner-only `/manage`), all tested on iPhone:
  (a) edit and divest, history with restore; (b) add with PNG photo upload (next free Photo id);
  (c) replace photo (photo version in the URL so caches show the new one), delete never-worn garments
  (recorded in `deletedGarments`; their history is kept), bulk changes (divest on a date, mark active,
  set category). Garment details live in Firestore (D-4). Storage rules locked down (owner-only uploads).

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
