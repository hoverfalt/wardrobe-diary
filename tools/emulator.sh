#!/usr/bin/env bash
# Start the local Firebase emulators (auth, Firestore, Storage; UI at http://127.0.0.1:4000) and seed them
# from the newest backup (seed_emulator.py), for testing the signed-in UI without touching production.
# Then, in another terminal: cd web && npm run dev:emulator  → http://localhost:5174 (Sign in = stand-in owner).
#   tools/emulator.sh [backup.json]
# Stop with Ctrl-C; nothing is kept (every start is a fresh copy of the backup).
set -euo pipefail
cd "$(dirname "$0")"

# The Firestore emulator needs Java; use the user-local JDK if none is installed system-wide.
if ! /usr/libexec/java_home >/dev/null 2>&1; then
  jdk=$(ls -d "$HOME"/.local/share/jdk-*/Contents/Home 2>/dev/null | tail -1)
  if [[ -z "$jdk" ]]; then
    echo "No Java found. Install a JDK (e.g. Temurin 21) into ~/.local/share/ (see CLAUDE.md, Local testing)." >&2
    exit 1
  fi
  export JAVA_HOME="$jdk" PATH="$jdk/bin:$PATH"
fi

export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199
backup="${1:-}"

# Seed once both emulators answer.
(
  for _ in $(seq 1 120); do
    if curl -s -o /dev/null http://127.0.0.1:8080 && curl -s -o /dev/null http://127.0.0.1:9099; then
      .venv/bin/python -W ignore seed_emulator.py ${backup:+"$backup"}
      exit 0
    fi
    sleep 1
  done
  echo "Emulators did not start; not seeded." >&2
) &

cd ../web
exec npx firebase emulators:start --project threddit-297417 --only auth,firestore,storage
