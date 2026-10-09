#!/usr/bin/env bash
# Restore Firestore from a backup file (dry run unless --write); see restore.py.
set -euo pipefail
cd "$(dirname "$0")"
key=$(ls ./*-firebase-adminsdk-*.json 2>/dev/null | head -1)
[[ -n "$key" ]] || { echo "No *-firebase-adminsdk-*.json key in tools/" >&2; exit 1; }
file=$(cd "$OLDPWD" && realpath "$1"); shift
GOOGLE_APPLICATION_CREDENTIALS="$key" exec .venv/bin/python -W ignore restore.py "$file" \
  --uid "${OWNER_UID:-0q0I90W7W3RAcgFN1c1JX6pZupG3}" "$@"
