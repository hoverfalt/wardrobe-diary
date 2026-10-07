# Wardrobe Diary

Web app rebuild of [wardrobediary.io](https://wardrobediary.io): daily wardrobe logging, cost-per-wear
analytics and visualisations, backed by Firebase. See `CLAUDE.md` for architecture, environment and data model, and `ROADMAP.md` for status and plans.

```
web/        TypeScript + React + Vite app (logging UI, dashboard, metrics)
tools/      Python: Google Sheet → Firestore migration (+ tests)
reference/  Golden CSV outputs from the old R pipeline, for validating the port
firebase.json, firestore.rules, storage.rules
```

## Day-to-day

```
tools/sync.sh --write        # copy the Google Sheet into Firestore (validates first)
cd web && npm run dev        # local dev server
cd web && npm run deploy     # deploy to https://wardrobediary.web.app (never the live site)
```

First-time setup on a new machine: Node ≥ 20.19, `cd web && npm install`, copy `web/.env.example` to
`web/.env.local` (values: `npx firebase apps:sdkconfig web`), create `tools/.venv` and
`pip install -r tools/requirements.txt`, and put the service-account key in `tools/`.
Do not deploy `storage.rules`: the Storage bucket is shared with the live site.
