#!/usr/bin/env bash
# Sync the Google Sheet into Firestore (validates first; refuses to write if checks fail).
#   tools/sync.sh            dry run
#   tools/sync.sh --write    write to Firestore
# Override defaults with SHEET_ID, SHEET_TAB, OWNER_UID.
set -euo pipefail
cd "$(dirname "$0")"

key=$(ls ./*-firebase-adminsdk-*.json 2>/dev/null | head -1)
if [[ -z "$key" ]]; then
  echo "No *-firebase-adminsdk-*.json key in tools/" >&2
  exit 1
fi

GOOGLE_APPLICATION_CREDENTIALS="$key" exec .venv/bin/python -W ignore migrate_sheet.py \
  --sheet-id "${SHEET_ID:-1IQgCth6qPDHv_mqh8wSg9MaphLPR5dlTv0pi2QgAJLM}" \
  --tab "${SHEET_TAB:-Threddit}" \
  --uid "${OWNER_UID:-0q0I90W7W3RAcgFN1c1JX6pZupG3}" \
  "$@"
