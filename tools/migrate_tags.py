"""One-time migration (2026-10-11): "(SH)" at the end of a garment name → the "second-hand" tag, and the
name without it. In one transaction per run: each garment, a history entry, and its public data entry.
Dry run by default; --write takes a backup first (backups/before-tags-….json).

    tools/migrate_tags.sh            # dry run
    tools/migrate_tags.sh --write
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path

from backup import backup, firestore_client, to_json

SH = re.compile(r"^(.*?)\s*\(SH\)\s*$")


def plan(garments: dict) -> list:
    """(id, new name) for every garment whose name ends with "(SH)"."""
    out = []
    for gid, g in sorted(garments.items()):
        m = SH.match(g["item"])
        if m:
            out.append((gid, m.group(1)))
    return out


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--uid", required=True)
    p.add_argument("--write", action="store_true")
    args = p.parse_args()

    from firebase_admin import firestore

    db = firestore_client()
    user = db.collection("users").document(args.uid)
    garments = {d.id: d.to_dict() for d in user.collection("garments").stream()}
    changes = plan(garments)
    for gid, name in changes:
        print(f"  {gid}: {garments[gid]['item']!r} → {name!r} + tag second-hand")
    print(f"{len(changes)} garments")
    if not args.write or not changes:
        print("Dry run, nothing written." if not args.write else "Nothing to do.")
        return 0

    path = Path(__file__).resolve().parent.parent / "backups" / f"before-tags-{datetime.now():%Y-%m-%d-%H%M%S}.json"
    path.parent.mkdir(exist_ok=True)
    path.write_text(json.dumps(backup(db, args.uid), ensure_ascii=False, default=to_json, indent=1, sort_keys=True) + "\n")
    print(f"Backup: {path}")

    pub_ref = user.collection("public").document("data")

    @firestore.transactional
    def apply(tx):
        pub = pub_ref.get(transaction=tx).to_dict()
        refs = {gid: user.collection("garments").document(gid) for gid, _ in changes}
        current = {gid: ref.get(transaction=tx).to_dict() for gid, ref in refs.items()}
        index = {g["id"]: i for i, g in enumerate(pub["garments"])}
        for gid, name in changes:
            before = current[gid]
            after = {**before, "item": name, "tags": sorted(set(before.get("tags") or []) | {"second-hand"})}
            tx.set(refs[gid], after)
            tx.set(refs[gid].collection("history").document(), {
                "savedAt": firestore.SERVER_TIMESTAMP, "before": before, "after": after,
                "note": "Second-hand tag from “(SH)” in the name",
            })
            if gid in index:
                pub["garments"][index[gid]] = {"id": gid, **after}
        tx.update(pub_ref, {"garments": pub["garments"]})

    apply(db.transaction())
    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
