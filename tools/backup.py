"""Back up the owner's Firestore data to a dated JSON file (garments with their history, days, deleted
garments, settings, public data). Since 2026-10-09 Firestore is the only copy of the wear log (the Sheet
is retired), so run this regularly; backups/ is git-ignored.

    tools/backup.sh                 # writes backups/wardrobe-YYYY-MM-DD.json
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import date, datetime
from pathlib import Path

from migrate_sheet import firestore_client


def to_json(value):
    if isinstance(value, datetime):
        return value.isoformat()
    raise TypeError(type(value))


def backup(db, uid: str) -> dict:
    user = db.collection("users").document(uid)
    garments = {}
    for doc in user.collection("garments").stream():
        history = [h.to_dict() for h in doc.reference.collection("history").stream()]
        garments[doc.id] = {**doc.to_dict(), "_history": history}
    return {
        "uid": uid,
        "exportedAt": datetime.now().isoformat(timespec="seconds"),
        "garments": garments,
        "days": {d.id: d.to_dict()["worn"] for d in user.collection("days").stream()},
        "deletedGarments": {d.id: d.to_dict() for d in user.collection("deletedGarments").stream()},
        "settings": {d.id: d.to_dict() for d in user.collection("settings").stream()},
        "public": {d.id: d.to_dict() for d in user.collection("public").stream()},
    }


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--uid", required=True)
    p.add_argument("--out", type=Path, default=Path(__file__).resolve().parent.parent / "backups")
    args = p.parse_args()
    data = backup(firestore_client(), args.uid)
    args.out.mkdir(exist_ok=True)
    path = args.out / f"wardrobe-{date.today().isoformat()}.json"
    path.write_text(json.dumps(data, ensure_ascii=False, default=to_json))
    wears = sum(len(w) for w in data["days"].values())
    print(f"Backed up {len(data['garments'])} garments, {len(data['days'])} days ({wears} wears) to {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
