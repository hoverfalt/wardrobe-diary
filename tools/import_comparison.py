"""One-off import of the Sheet's "Comparison" tab (R-26) into Firestore: users/{uid}/settings/comparison
(`items`, backed up with the settings) and the `comparison` field of the public data document.

Reads values only (UNFORMATTED_VALUE), never the formulas: Monthly cost and Use frequency are stored as
entered numbers; Yearly cost and Cost per use are derived in the app. After the import the items are
edited in the app (/manage/comparison). Refuses to overwrite items already in Firestore unless --replace.

    tools/import_comparison.sh            # dry run: prints what would be written
    tools/import_comparison.sh --write    # take tools/backup.sh first
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import unicodedata
from typing import Any, Dict, List

COLUMNS = ("Type", "Item", "Details", "Photo", "Monthly cost", "Use frequency")


def slug(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", text).strip("-") or "item"


def photo_name(value: Any) -> str:
    """'Photos/Comparison-HSL.png' -> 'Comparison-HSL' (the Storage file name without .png)."""
    name = str(value or "").strip().rsplit("/", 1)[-1]
    return name[:-4] if name.lower().endswith(".png") else name


def transform(rows: List[List[Any]]) -> List[Dict[str, Any]]:
    header = [str(h).strip() for h in rows[0]]
    missing = [c for c in COLUMNS if c not in header]
    if missing:
        raise ValueError(f"Comparison tab lacks columns: {', '.join(missing)}")
    col = {c: header.index(c) for c in COLUMNS}
    items, taken = [], set()
    for n, row in enumerate(rows[1:], start=2):
        cell = lambda c: row[col[c]] if col[c] < len(row) else ""
        item = str(cell("Item")).strip()
        if not item:
            continue
        monthly, freq = cell("Monthly cost"), cell("Use frequency")
        if not isinstance(monthly, (int, float)) or not isinstance(freq, (int, float)) or not 0 <= freq <= 1:
            raise ValueError(f"Row {n} ({item}): Monthly cost {monthly!r} / Use frequency {freq!r} are not valid numbers")
        base = slug(item)
        item_id, i = base, 2
        while item_id in taken:
            item_id, i = f"{base}-{i}", i + 1
        taken.add(item_id)
        items.append({
            "id": item_id,
            "type": str(cell("Type")).strip(),
            "item": item,
            "details": str(cell("Details")).strip(),
            "photo": photo_name(cell("Photo")),
            "photoVersion": None,
            "monthlyCost": round(float(monthly), 4),
            "useFrequency": float(freq),
        })
    return items


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--sheet-id", required=True)
    p.add_argument("--tab", default="Comparison")
    p.add_argument("--uid", required=True)
    p.add_argument("--write", action="store_true")
    p.add_argument("--replace", action="store_true", help="overwrite items already in Firestore")
    args = p.parse_args()

    from migrate_sheet import firestore_client, read_sheet

    items = transform(read_sheet(args.sheet_id, args.tab))
    for c in items:
        freq = c["useFrequency"]
        print(f"{c['id']:16} {c['type']:17} {c['item']:15} {c['monthlyCost']:8.2f} €/month  {freq * 100:5.1f} %  photo {c['photo']}")
    print(f"{len(items)} items")

    db = firestore_client()
    user = db.collection("users").document(args.uid)
    ref = user.collection("settings").document("comparison")
    existing = ref.get()
    if existing.exists and existing.to_dict().get("items") and not args.replace:
        print("settings/comparison already has items (edited in the app?); use --replace to overwrite.", file=sys.stderr)
        return 1
    if not args.write:
        print("Dry run, nothing written. Re-run with --write (after tools/backup.sh).")
        return 0
    batch = db.batch()
    batch.set(ref, {"items": items})
    batch.update(user.collection("public").document("data"), {"comparison": items})
    batch.commit()
    print("Wrote settings/comparison and the public data's comparison.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
