"""One-time migration (2026-10-12, Q-2): the Sheet's row colours in column B → garment tags.

- Hanko: "(Hanko)" in the name or a light-blue row (#cfe2f3), except "ex Hanko" garments (moved to Helsinki);
  "(Hanko)" is removed from the name, as "(SH)" was.
- Bicycle gear: grey-blue rows (#d0e0e3).
- Motorcycle gear: pink rows (#ead1dc).

Reads the colours from the (retired, read-only) Sheet, matching rows by Photo id. In one transaction: each
garment, a history entry, and its public data entry. Dry run by default; --write takes a backup first
(backups/before-colour-tags-….json). Adding a tag twice is harmless, so re-running changes nothing.

    tools/migrate_colour_tags.sh            # dry run
    tools/migrate_colour_tags.sh --write
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple

from backup import backup, firestore_client, to_json

COLOUR_TAGS = {"#d0e0e3": "bicycle", "#ead1dc": "motorcycle"}
HANKO_COLOUR = "#cfe2f3"
HANKO_IN_NAME = re.compile(r"\s*\(Hanko\)", re.I)
EX_HANKO = re.compile(r"\bex Hanko\b", re.I)
TAG_ORDER = ["second-hand", "hanko", "bicycle", "motorcycle"]


def read_colours(sheet_id: str, tab: str) -> Dict[str, str]:
    """Photo id → background colour of the row's Item cell (column B), as #rrggbb."""
    import gspread

    gc = gspread.service_account(filename=os.environ["GOOGLE_APPLICATION_CREDENTIALS"])
    meta = gc.open_by_key(sheet_id).fetch_sheet_metadata(params={
        "ranges": f"{tab}!A1:D2000",
        "fields": "sheets.data.rowData.values(effectiveValue,effectiveFormat.backgroundColor)",
    })
    out = {}
    for row in meta["sheets"][0]["data"][0].get("rowData", []):
        v = row.get("values", [])
        if len(v) < 4:
            continue
        photo = (v[3].get("effectiveValue") or {}).get("stringValue", "").strip()
        bg = (v[1].get("effectiveFormat") or {}).get("backgroundColor")
        if photo and bg:
            out[photo] = "#%02x%02x%02x" % tuple(round(bg.get(k, 0) * 255) for k in ("red", "green", "blue"))
    return out


def plan(garments: Dict[str, dict], colours: Dict[str, str]) -> List[Tuple[str, str, List[str]]]:
    """(id, new name, new tags) for every garment that changes."""
    out = []
    for gid, g in sorted(garments.items()):
        add = set()
        colour = colours.get(gid)
        if colour in COLOUR_TAGS:
            add.add(COLOUR_TAGS[colour])
        if not EX_HANKO.search(g["item"]) and (HANKO_IN_NAME.search(g["item"]) or colour == HANKO_COLOUR):
            add.add("hanko")
        name = HANKO_IN_NAME.sub("", g["item"]).strip()
        before = set(g.get("tags") or [])
        tags = [t for t in TAG_ORDER if t in before | add] + sorted(before - set(TAG_ORDER))
        if name != g["item"] or set(tags) != before:
            out.append((gid, name, tags))
    return out


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--sheet-id", required=True)
    p.add_argument("--tab", default="Threddit")
    p.add_argument("--uid", required=True)
    p.add_argument("--write", action="store_true")
    args = p.parse_args()

    from firebase_admin import firestore

    db = firestore_client()
    user = db.collection("users").document(args.uid)
    garments = {d.id: d.to_dict() for d in user.collection("garments").stream()}
    changes = plan(garments, read_colours(args.sheet_id, args.tab))
    counts: Dict[str, int] = {}
    for gid, name, tags in changes:
        added = [t for t in tags if t not in (garments[gid].get("tags") or [])]
        for t in added:
            counts[t] = counts.get(t, 0) + 1
        rename = f" → {name!r}" if name != garments[gid]["item"] else ""
        print(f"  {gid}: {garments[gid]['item']!r}{rename} + {', '.join(added) or '–'}")
    print(f"{len(changes)} garments; tags added: {counts}")
    if len(changes) > 240:
        print("Too many for one transaction.", file=sys.stderr)
        return 1
    if not args.write or not changes:
        print("Dry run, nothing written." if not args.write else "Nothing to do.")
        return 0

    path = Path(__file__).resolve().parent.parent / "backups" / f"before-colour-tags-{datetime.now():%Y-%m-%d-%H%M%S}.json"
    path.parent.mkdir(exist_ok=True)
    path.write_text(json.dumps(backup(db, args.uid), ensure_ascii=False, default=to_json, indent=1, sort_keys=True) + "\n")
    print(f"Backup: {path}")

    pub_ref = user.collection("public").document("data")

    @firestore.transactional
    def apply(tx):
        pub = pub_ref.get(transaction=tx).to_dict()
        refs = {gid: user.collection("garments").document(gid) for gid, _, _ in changes}
        current = {gid: ref.get(transaction=tx).to_dict() for gid, ref in refs.items()}
        index = {g["id"]: i for i, g in enumerate(pub["garments"])}
        for gid, name, tags in changes:
            before = current[gid]
            after = {**before, "item": name, "tags": tags}
            tx.set(refs[gid], after)
            tx.set(refs[gid].collection("history").document(), {
                "savedAt": firestore.SERVER_TIMESTAMP, "before": before, "after": after,
                "note": "Tags from the Sheet's row colours (Hanko, bicycle, motorcycle)",
            })
            if gid in index:
                pub["garments"][index[gid]] = {"id": gid, **after}
        tx.update(pub_ref, {"garments": pub["garments"]})

    apply(db.transaction())
    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
