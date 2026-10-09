"""Back up the owner's Firestore data to JSON: garments (with their history), days, deleted garments and
settings. The public data document is left out (it is derived; restore.py rebuilds it).

Since 2026-10-09 Firestore is the only copy of the wear log. A GitHub Actions job runs this script nightly
in the private repo hoverfalt/wardrobe-diary-backups with a read-only service account (ROADMAP R-28); the
same file is copied there. Locally: tools/backup.sh writes backups/wardrobe-YYYY-MM-DD.json.

Output is pretty-printed with sorted keys, so day-to-day git diffs stay small.

    python backup.py --uid <uid> --out backups/wardrobe-2026-10-09.json
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path


def firestore_client():
    import firebase_admin
    from firebase_admin import firestore

    if not firebase_admin._apps:
        firebase_admin.initialize_app()
    return firestore.client()


def to_json(value):
    if isinstance(value, datetime):
        return value.isoformat()
    raise TypeError(type(value))


def backup(db, uid: str) -> dict:
    user = db.collection("users").document(uid)
    garments = {}
    for doc in user.collection("garments").stream():
        history = sorted(
            (h.to_dict() for h in doc.reference.collection("history").stream()),
            key=lambda h: str(h.get("savedAt")),
        )
        garments[doc.id] = {**doc.to_dict(), "_history": history}
    return {
        "format": 1,
        "uid": uid,
        "garments": garments,
        "days": {d.id: d.to_dict()["worn"] for d in user.collection("days").stream()},
        "deletedGarments": {d.id: d.to_dict() for d in user.collection("deletedGarments").stream()},
        "settings": {d.id: d.to_dict() for d in user.collection("settings").stream()},
    }


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--uid", required=True)
    p.add_argument("--out", type=Path, required=True, help="JSON file to write")
    args = p.parse_args()
    data = backup(firestore_client(), args.uid)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(data, ensure_ascii=False, default=to_json, indent=1, sort_keys=True) + "\n")
    wears = sum(len(w) for w in data["days"].values())
    stamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
    print(f"{stamp} backed up {len(data['garments'])} garments, {len(data['days'])} days ({wears} wears) to {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
