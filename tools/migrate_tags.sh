#!/usr/bin/env bash
# One-time migration: "(SH)" in names → second-hand tag (see migrate_tags.py).
set -euo pipefail
cd "$(dirname "$0")"
key=$(ls ./*-firebase-adminsdk-*.json 2>/dev/null | head -1)
if [[ -z "$key" ]]; then
  echo "No *-firebase-adminsdk-*.json key in tools/" >&2
  exit 1
fi
GOOGLE_APPLICATION_CREDENTIALS="$key" exec .venv/bin/python -W ignore migrate_tags.py \
  --uid "${OWNER_UID:-0q0I90W7W3RAcgFN1c1JX6pZupG3}" "$@"
