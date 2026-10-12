#!/usr/bin/env bash
# One-off import of the Sheet's "Comparison" tab into Firestore (R-26). Dry run unless --write.
set -euo pipefail
cd "$(dirname "$0")"

key=$(ls ./*-firebase-adminsdk-*.json 2>/dev/null | head -1)
if [[ -z "$key" ]]; then
  echo "No *-firebase-adminsdk-*.json key in tools/" >&2
  exit 1
fi

GOOGLE_APPLICATION_CREDENTIALS="$key" exec .venv/bin/python -W ignore import_comparison.py \
  --sheet-id "${SHEET_ID:-1IQgCth6qPDHv_mqh8wSg9MaphLPR5dlTv0pi2QgAJLM}" \
  --uid "${OWNER_UID:-0q0I90W7W3RAcgFN1c1JX6pZupG3}" \
  "$@"
