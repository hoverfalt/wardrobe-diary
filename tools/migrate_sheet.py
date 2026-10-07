"""Sync the Wardrobe Diary Google Sheet into Firestore. Safe to re-run: the Sheet is the source
of truth, and docs no longer in it (deleted garments, fully unticked days) are removed.

Dry run by default: reads the Sheet, validates, prints a summary.
Pass --write to actually write to Firestore.

Auth: a Google service account JSON with access to both the Sheet (share the Sheet with the
service account's email) and the Firebase project. Point GOOGLE_APPLICATION_CREDENTIALS at it.

    python migrate_sheet.py --sheet-id <ID> --tab "Data" --uid <firebase-auth-uid>
    python migrate_sheet.py --sheet-id <ID> --tab "Data" --uid <uid> --write
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from sheet_transform import (
    parse_sheet,
    validate_day_columns,
    validate_times_used,
    wears_outside_ownership,
)

BATCH_SIZE = 400


def read_sheet(sheet_id: str, tab: str):
    import gspread
    from gspread.utils import DateTimeOption, ValueRenderOption

    gc = gspread.service_account(filename=os.environ["GOOGLE_APPLICATION_CREDENTIALS"])
    ws = gc.open_by_key(sheet_id).worksheet(tab)
    return ws.get(
        value_render_option=ValueRenderOption.unformatted,
        date_time_render_option=DateTimeOption.serial_number,
    )


def write_firestore(uid: str, data) -> None:
    import firebase_admin
    from firebase_admin import firestore

    firebase_admin.initialize_app()
    db = firestore.client()
    user = db.collection("users").document(uid)

    garments, days = user.collection("garments"), user.collection("days")
    writes = [(garments.document(g.id), g.to_firestore()) for g in data.garments]
    writes += [(days.document(day), {"worn": worn}) for day, worn in data.days.items() if worn]

    # Sync, not just insert: drop docs that no longer exist in the Sheet
    # (deleted garments, days whose checkboxes were all unticked).
    keep = {ref.path for ref, _ in writes}
    stale = [
        ref
        for col in (garments, days)
        for ref in col.list_documents()
        if ref.path not in keep
    ]
    ops = [(ref, doc) for ref, doc in writes] + [(ref, None) for ref in stale]
    print(f"  {len(writes)} docs to write, {len(stale)} stale docs to delete")

    for i in range(0, len(ops), BATCH_SIZE):
        batch = db.batch()
        for ref, doc in ops[i : i + BATCH_SIZE]:
            if doc is None:
                batch.delete(ref)
            else:
                batch.set(ref, doc)
        batch.commit()
        print(f"  committed {min(i + BATCH_SIZE, len(ops))}/{len(ops)}")


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--sheet-id", required=True)
    p.add_argument("--tab", required=True, help="worksheet (tab) name")
    p.add_argument("--uid", required=True, help="Firebase Auth uid that owns the data")
    p.add_argument("--write", action="store_true", help="write to Firestore (default: dry run)")
    p.add_argument("--dump", type=Path, help="also save the parsed data as JSON to this path")
    args = p.parse_args()

    rows = read_sheet(args.sheet_id, args.tab)
    data = parse_sheet(rows)

    logged_days = sum(1 for w in data.days.values() if w)
    wears = sum(len(w) for w in data.days.values())
    print(f"Garments: {len(data.garments)}")
    print(f"Day columns: {len(data.days)} ({min(data.days)} … {max(data.days)}), with wears: {logged_days}")
    print(f"Wear events: {wears}")
    for w in data.warnings:
        print(f"WARNING {w}")

    day_problems = validate_day_columns(data)
    if day_problems:
        print(f"\n{len(day_problems)} problems in the day column headers:")
        for line in day_problems:
            print(f"  {line}")

    outside = wears_outside_ownership(data)
    if outside:
        print(f"\n{len(outside)} garments have wears outside their ownership period (ignored by metrics):")
        for line in outside:
            print(f"  {line}")

    problems = validate_times_used(data)
    if problems:
        print(f"\n{len(problems)} garments where 'Times used' does not match:")
        for line in problems:
            print(f"  {line}")
    else:
        print("Validation OK: 'Times used' reproduced for all garments.")

    if args.dump:
        args.dump.write_text(
            json.dumps(
                {"garments": [g.__dict__ for g in data.garments], "days": data.days},
                ensure_ascii=False,
                indent=1,
            )
        )
        print(f"Wrote {args.dump}")

    if not args.write:
        print("\nDry run, nothing written. Re-run with --write to write to Firestore.")
        return 0
    if problems or day_problems:
        print("Refusing to write while validation fails.", file=sys.stderr)
        return 1
    write_firestore(args.uid, data)
    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
