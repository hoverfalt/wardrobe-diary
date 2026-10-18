"""Seed the local Firebase emulators (tools/emulator.sh) from a backup, for testing the signed-in UI.

Wipes the emulators' Firestore and Auth, then writes the backup's garments (with history), days, deleted
garments and settings, rebuilds the public data document (as restore.py does), and creates the stand-in owner
account (owner@emulator.test / emulator-only) with the real owner's uid, so the app treats it as the owner.

Refuses to run unless FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST point at this machine: it can
never write to production. Default backup: the newest backups/wardrobe-*.json, else the nightly backup clone.

    tools/emulator.sh                        # starts the emulators and runs this automatically
    .venv/bin/python seed_emulator.py [backup.json]
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.request
from datetime import datetime
from pathlib import Path

from restore import comparable, public_from

PROJECT = "threddit-297417"
OWNER_UID = "0q0I90W7W3RAcgFN1c1JX6pZupG3"
OWNER = {"email": "owner@emulator.test", "password": "emulator-only"}
ROOT = Path(__file__).resolve().parent.parent
BATCH_SIZE = 400


def local_host(var: str) -> str:
    host = os.environ.get(var, "")
    if not host.split(":")[0] in ("127.0.0.1", "localhost"):
        sys.exit(f"{var} must point at a local emulator (got {host!r}); refusing to run.")
    return host


def default_backup() -> Path:
    local = sorted((ROOT / "backups").glob("wardrobe-*.json"))
    if local:
        return local[-1]
    nightly = ROOT.parent / "wardrobe-diary-backups" / "wardrobe.json"
    if nightly.exists():
        return nightly
    sys.exit("No backup found: run tools/backup.sh or pass a backup file.")


def request(method: str, url: str, body: dict | None = None) -> dict:
    req = urllib.request.Request(url, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Authorization": "Bearer owner", "Content-Type": "application/json"})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read() or b"{}")


def parse_time(value):
    """Backups store timestamps as ISO strings; write them back as timestamps (e.g. history savedAt)."""
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            return value
    return value


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("backup", type=Path, nargs="?")
    args = p.parse_args()
    fs_host = local_host("FIRESTORE_EMULATOR_HOST")
    auth_host = local_host("FIREBASE_AUTH_EMULATOR_HOST")
    path = args.backup or default_backup()
    snapshot = json.loads(path.read_text())
    uid = snapshot.get("uid", OWNER_UID)

    from google.cloud import firestore

    request("DELETE", f"http://{fs_host}/emulator/v1/projects/{PROJECT}/databases/(default)/documents")
    request("DELETE", f"http://{auth_host}/emulator/v1/projects/{PROJECT}/accounts")

    db = firestore.Client(project=PROJECT)  # the emulator host variable routes this to the emulator
    user = db.collection("users").document(uid)
    ops = []
    for gid, g in snapshot["garments"].items():
        ref = user.collection("garments").document(gid)
        ops.append((ref, {k: v for k, v in g.items() if k != "_history"}))
        for h in g.get("_history", []):
            ops.append((ref.collection("history").document(), {**h, "savedAt": parse_time(h.get("savedAt"))}))
    target = comparable(snapshot)
    for name in ("days", "deletedGarments", "settings", "voiceLog"):
        for doc_id, value in target[name].items():
            if name == "deletedGarments":
                value = {**value, "deletedAt": parse_time(value.get("deletedAt"))}
            ops.append((user.collection(name).document(doc_id), {"worn": value} if name == "days" else value))
    ops.append((user.collection("public").document("data"), public_from(snapshot)))
    for i in range(0, len(ops), BATCH_SIZE):
        batch = db.batch()
        for ref, doc in ops[i : i + BATCH_SIZE]:
            batch.set(ref, doc)
        batch.commit()

    request("POST", f"http://{auth_host}/identitytoolkit.googleapis.com/v1/projects/{PROJECT}/accounts",
            {"localId": uid, **OWNER, "displayName": "Emulator owner"})
    wears = sum(len(w) for w in snapshot["days"].values())
    print(f"Seeded the emulators from {path.name}: {len(snapshot['garments'])} garments, {len(snapshot['days'])} days "
          f"({wears} wears), {len(ops)} documents; sign in as {OWNER['email']}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
