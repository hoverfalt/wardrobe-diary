#!/usr/bin/env bash
# Back up the Firestore data to backups/wardrobe-YYYY-MM-DD.json (see backup.py). The nightly backup
# runs on GitHub (hoverfalt/wardrobe-diary-backups); this is for extra manual backups.
set -euo pipefail
cd "$(dirname "$0")"
key=$(ls ./*-firebase-adminsdk-*.json 2>/dev/null | head -1)
if [[ -z "$key" ]]; then
  echo "No *-firebase-adminsdk-*.json key in tools/" >&2
  exit 1
fi
GOOGLE_APPLICATION_CREDENTIALS="$key" exec .venv/bin/python -W ignore backup.py \
  --uid "${OWNER_UID:-0q0I90W7W3RAcgFN1c1JX6pZupG3}" --out "../backups/wardrobe-$(date +%F).json" "$@"
