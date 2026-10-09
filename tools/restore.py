"""Restore Firestore from a backup made by backup.py (local or from hoverfalt/wardrobe-diary-backups).

Dry run by default: shows what would change. With --write it first saves a safety backup of the current
state to backups/, then makes garments, days, deleted garments and settings match the backup exactly
(adding, overwriting and deleting documents) and rebuilds the public data document from them. Garment
history (garments/{id}/history) is not touched.

    tools/restore.sh backups/wardrobe-2026-10-09.json            # dry run
    tools/restore.sh backups/wardrobe-2026-10-09.json --write
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List

from backup import backup, firestore_client, to_json
from sheet_transform import Garment, SheetData, public_document

BATCH_SIZE = 400
COLLECTIONS = ("garments", "days", "deletedGarments", "settings")


def comparable(snapshot: dict) -> Dict[str, Dict[str, object]]:
    """The restorable part of a backup, per collection (garment history left out)."""
    out = {c: dict(snapshot.get(c, {})) for c in COLLECTIONS}
    out["garments"] = {gid: {k: v for k, v in g.items() if k != "_history"} for gid, g in out["garments"].items()}
    return out


def diff(current: dict, target: dict) -> Dict[str, Dict[str, List[str]]]:
    """Per collection: ids to add, change and remove to make `current` equal `target`."""
    a, b = comparable(current), comparable(target)
    result = {}
    for c in COLLECTIONS:
        cur, tgt = a[c], b[c]
        result[c] = {
            "add": sorted(set(tgt) - set(cur)),
            "change": sorted(k for k in set(tgt) & set(cur) if json.dumps(tgt[k], sort_keys=True, default=to_json) != json.dumps(cur[k], sort_keys=True, default=to_json)),
            "remove": sorted(set(cur) - set(tgt)),
        }
    return result


def public_from(target: dict) -> dict:
    garments = [Garment.from_firestore(gid, g) for gid, g in sorted(comparable(target)["garments"].items())]
    known = {g.id for g in garments}
    days = {d: [gid for gid in worn if gid in known] for d, worn in target["days"].items()}
    return public_document(SheetData(garments=garments, days=days))


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("file", type=Path)
    p.add_argument("--uid", required=True)
    p.add_argument("--write", action="store_true", help="apply the restore (default: dry run)")
    args = p.parse_args()

    target = json.loads(args.file.read_text())
    if target.get("uid") != args.uid:
        print(f"Backup is for uid {target.get('uid')}, not {args.uid}", file=sys.stderr)
        return 1
    db = firestore_client()
    current = backup(db, args.uid)
    changes = diff(current, target)
    for c, ch in changes.items():
        print(f"{c}: {len(ch['add'])} to add, {len(ch['change'])} to change, {len(ch['remove'])} to remove")
        for kind in ("add", "change", "remove"):
            if ch[kind]:
                print(f"  {kind}: {', '.join(ch[kind][:8])}{' …' if len(ch[kind]) > 8 else ''}")
    if not args.write:
        print("\nDry run, nothing written. Re-run with --write to restore.")
        return 0

    safety = Path(__file__).resolve().parent.parent / "backups" / f"before-restore-{datetime.now():%Y-%m-%d-%H%M%S}.json"
    safety.parent.mkdir(exist_ok=True)
    safety.write_text(json.dumps(current, ensure_ascii=False, default=to_json, indent=1, sort_keys=True) + "\n")
    print(f"\nSafety backup of the current state: {safety}")

    user = db.collection("users").document(args.uid)
    tgt = comparable(target)
    ops = []
    for c in COLLECTIONS:
        col = user.collection(c)
        for doc_id in changes[c]["add"] + changes[c]["change"]:
            value = tgt[c][doc_id]
            ops.append((col.document(doc_id), {"worn": value} if c == "days" else value))
        ops += [(col.document(doc_id), None) for doc_id in changes[c]["remove"]]
    ops.append((user.collection("public").document("data"), public_from(target)))
    for i in range(0, len(ops), BATCH_SIZE):
        batch = db.batch()
        for ref, doc in ops[i : i + BATCH_SIZE]:
            batch.delete(ref) if doc is None else batch.set(ref, doc)
        batch.commit()
    print(f"Restored {len(ops) - 1} documents and rebuilt the public data.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
