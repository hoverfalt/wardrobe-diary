# Wardrobe Diary

Web app rebuild of [wardrobediary.io](https://wardrobediary.io): daily wardrobe logging, cost-per-wear
analytics and visualisations, backed by Firebase. See `CLAUDE.md` for architecture, data model and roadmap.

```
web/        TypeScript + React + Vite app (logging UI, dashboard, metrics)
tools/      Python: Google Sheet → Firestore migration (+ tests)
reference/  Golden CSV outputs from the old R pipeline, for validating the port
firebase.json, firestore.rules, storage.rules
```

## First-time setup

1. Install Node 20+ (e.g. `brew install node`) and Python 3.10+.
2. In Firebase console: enable **Authentication → Google**, create a **Firestore** database,
   register a **Web app** and copy its config into `web/.env.local` (see `web/.env.example`).
3. Put your project id in `.firebaserc`.
4. Run the app: `cd web && npm install && npm run dev`, sign in once, and note your uid
   (Firebase console → Authentication → Users).
5. Migrate data: create a service account key (Project settings → Service accounts), share the
   Google Sheet with the service account's email, then:

   ```
   cd tools
   python -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
   python migrate_sheet.py --sheet-id <SHEET_ID> --tab "<TAB>" --uid <UID>          # dry run
   python migrate_sheet.py --sheet-id <SHEET_ID> --tab "<TAB>" --uid <UID> --write
   ```
6. Deploy rules: `firebase deploy --only firestore:rules,storage`.
