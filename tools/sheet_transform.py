"""Pure transformation of the Wardrobe Diary Google Sheet into the Firestore data model.

Input is the raw grid as returned by the Sheets API with
value_render_option=UNFORMATTED_VALUE and date_time_render_option=SERIAL_NUMBER.
"""
from __future__ import annotations

import re
from dataclasses import asdict, dataclass, field
from datetime import date, timedelta
from typing import Any, Dict, List, Optional

SHEETS_EPOCH = date(1899, 12, 30)

COLUMNS = {
    "category": "Category",
    "item": "Item",
    "details": "Details",
    "photo": "Photo",
    "price": "Price",
    "purchased": "Date purchased",
    "divested": "Date divested",
    "times_used_init": "Times used init",
    "materials": "Materials",
    "weight": "Weight",
    "times_used": "Times used",
    "cost_per_wear": "Cost per wear",
}


@dataclass
class Garment:
    id: str
    category: str
    item: str
    details: str
    photo: str
    price: Optional[float]
    purchased: Optional[str]
    divested: Optional[str]
    timesUsedInit: int
    materials: str
    weightG: Optional[float]

    def to_firestore(self) -> Dict[str, Any]:
        d = asdict(self)
        d.pop("id")
        return d


@dataclass
class SheetData:
    garments: List[Garment] = field(default_factory=list)
    days: Dict[str, List[str]] = field(default_factory=dict)
    # Values of the Sheet's own derived columns, kept only for validation.
    sheet_times_used: Dict[str, Optional[float]] = field(default_factory=dict)
    warnings: List[str] = field(default_factory=list)


def serial_to_iso(value: Any) -> Optional[str]:
    if value in (None, ""):
        return None
    if isinstance(value, (int, float)):
        return (SHEETS_EPOCH + timedelta(days=int(value))).isoformat()
    # Fallback for text dates in Finnish format d.m.yyyy
    m = re.fullmatch(r"\s*(\d{1,2})\.(\d{1,2})\.(\d{4})\s*", str(value))
    if m:
        d, mo, y = map(int, m.groups())
        return date(y, mo, d).isoformat()
    raise ValueError(f"Unrecognised date: {value!r}")


def _num(value: Any) -> Optional[float]:
    if value in (None, ""):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    return float(str(value).replace(" ", "").replace(" ", "").replace(",", "."))


def _str(value: Any) -> str:
    return "" if value is None else str(value).strip()


def slugify(text: str) -> str:
    return re.sub(r"[^A-Za-z0-9]+", "_", text).strip("_")


def parse_sheet(rows: List[List[Any]]) -> SheetData:
    header_idx = next(
        (i for i, r in enumerate(rows) if r and _str(r[0]) == COLUMNS["category"]), None
    )
    if header_idx is None:
        raise ValueError("Header row with 'Category' in column A not found")
    header = rows[header_idx]
    names = [_str(h) for h in header]

    col: Dict[str, int] = {}
    for key, title in COLUMNS.items():
        if title not in names:
            raise ValueError(f"Column {title!r} not found in header")
        col[key] = names.index(title)

    # Day columns: every header cell after "Cost per wear" that is a date.
    day_cols: Dict[int, str] = {}
    for c in range(col["cost_per_wear"] + 1, len(header)):
        h = header[c]
        if h in (None, ""):
            continue
        try:
            iso = serial_to_iso(h)
        except ValueError:
            continue
        if iso:
            day_cols[c] = iso

    out = SheetData()
    out.days = {d: [] for d in day_cols.values()}
    seen: set = set()

    def cell(row: List[Any], c: int) -> Any:
        return row[c] if c < len(row) else None

    for r_i, row in enumerate(rows[header_idx + 1 :], start=header_idx + 2):
        item = _str(cell(row, col["item"]))
        if not item:
            continue
        category = _str(cell(row, col["category"]))
        photo = _str(cell(row, col["photo"]))
        gid = photo or f"{slugify(category)}-{slugify(item)}"
        if not photo:
            out.warnings.append(f"Row {r_i}: no Photo id, using {gid!r}")
        if gid in seen:
            base, n = gid, 2
            while f"{base}-{n}" in seen:
                n += 1
            gid = f"{base}-{n}"
            out.warnings.append(f"Row {r_i}: duplicate id, renamed to {gid!r}")
        seen.add(gid)

        out.garments.append(
            Garment(
                id=gid,
                category=category,
                item=item,
                details=_str(cell(row, col["details"])),
                photo=photo,
                price=_num(cell(row, col["price"])),
                purchased=serial_to_iso(cell(row, col["purchased"])),
                divested=serial_to_iso(cell(row, col["divested"])),
                timesUsedInit=int(_num(cell(row, col["times_used_init"])) or 0),
                materials=_str(cell(row, col["materials"])),
                weightG=_num(cell(row, col["weight"])),
            )
        )
        out.sheet_times_used[gid] = _num(cell(row, col["times_used"]))

        for c, iso in day_cols.items():
            if cell(row, c) is True:
                out.days[iso].append(gid)

    return out


def validate_times_used(data: SheetData) -> List[str]:
    """Check that timesUsedInit + checked days reproduces the Sheet's 'Times used' column."""
    counts: Dict[str, int] = {}
    for worn in data.days.values():
        for gid in worn:
            counts[gid] = counts.get(gid, 0) + 1
    problems = []
    for g in data.garments:
        expected = data.sheet_times_used.get(g.id)
        actual = g.timesUsedInit + counts.get(g.id, 0)
        if expected is not None and int(expected) != actual:
            problems.append(f"{g.id}: sheet says {int(expected)}, computed {actual}")
    return problems
