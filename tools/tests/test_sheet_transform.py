import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sheet_transform import (  # noqa: E402
    Garment,
    merge_with_stored,
    firestore_size,
    public_document,
    parse_sheet,
    serial_to_iso,
    validate_day_columns,
    validate_times_used,
    wears_outside_ownership,
)

HEADER = [
    "Category", "Item", "Details", "Photo", "Photo placeholder", "Price", "Date purchased",
    "Date divested", "Times used init", "Materials", "Weight", "Times used", "Cost per wear",
    43101, 43102, 43103,  # 2018-01-01 … 2018-01-03 as Sheets serials
]


def make_rows():
    return [
        list(HEADER),
        [],  # separator row
        ["Jackets and hoodies", "North Bend black vest", "", "Jackets_and_hoodies-006", "",
         50.0, 42917, "", 2, "Shell: 100% polyamide", 305, 4, 12.5, True, False, True],
        ["Jackets and hoodies", "Suit Supply gray body warmer", "BW16503", "Jackets_and_hoodies-008", "",
         149.0, 43196, 45000, 0, "Fabric 100% linen", 578, 1, 149.0, False, True, False],
        ["Jackets and hoodies", "No photo jacket", "", "", "", "10,50", "16.11.2018", "", "", "", "", 0, ""],
    ]


def test_serial_to_iso():
    assert serial_to_iso(43101) == "2018-01-01"
    assert serial_to_iso("7.10.2026") == "2026-10-07"
    assert serial_to_iso("") is None


def test_parse_garments_and_days():
    data = parse_sheet(make_rows())
    assert [g.id for g in data.garments] == [
        "Jackets_and_hoodies-006",
        "Jackets_and_hoodies-008",
        "Jackets_and_hoodies-No_photo_jacket",
    ]
    vest = data.garments[0]
    assert vest.purchased == "2017-07-01"
    assert vest.divested is None
    assert vest.timesUsedInit == 2
    assert data.garments[2].price == 10.5
    assert data.garments[2].purchased == "2018-11-16"
    assert data.days == {
        "2018-01-01": ["Jackets_and_hoodies-006"],
        "2018-01-02": ["Jackets_and_hoodies-008"],
        "2018-01-03": ["Jackets_and_hoodies-006"],
    }
    assert any("no Photo id" in w for w in data.warnings)


def test_validate_times_used():
    data = parse_sheet(make_rows())
    assert validate_times_used(data) == []
    data.sheet_times_used["Jackets_and_hoodies-006"] = 99
    assert validate_times_used(data) == ["Jackets_and_hoodies-006: sheet says 99, computed 4"]


def test_validate_day_columns():
    data = parse_sheet(make_rows())
    assert validate_day_columns(data) == []
    rows = make_rows()
    rows[0][14] = -614335  # 0218-01-02: year typo for 2018-01-02
    problems = validate_day_columns(parse_sheet(rows))
    assert len(problems) == 2
    assert problems[0].startswith("day column 0218-01-02 follows 2018-01-01")


def test_skips_placeholders_and_rounds_prices():
    rows = make_rows()
    rows.append(["Shoes", "ADD NEXT", "", "Shoes-014", "", "", "", "", "", "", "", 0, ""])
    rows.append(["", "Uncategorised socks", "", "Socks-100", "", 2.5, "", "", 0, "", "", 1, "", True])
    rows[2][5] = 32.46835443037975
    data = parse_sheet(rows)
    assert "Shoes-014" not in [g.id for g in data.garments]
    assert "Socks-100" not in [g.id for g in data.garments]
    assert "Socks-100" not in data.days["2018-01-01"]
    assert data.garments[0].price == 32.47


def test_wears_outside_ownership():
    data = parse_sheet(make_rows())
    # Body warmer (purchased 2018-04-06) is worn on 2018-01-02, before its purchase date.
    [problem] = wears_outside_ownership(data)
    assert problem.startswith("Jackets_and_hoodies-008 (Suit Supply gray body warmer): 1 wears outside 2018-04-06")


def test_public_document():
    data = parse_sheet(make_rows())
    doc = public_document(data)
    assert [g["id"] for g in doc["garments"]] == [
        "Jackets_and_hoodies-006", "Jackets_and_hoodies-008", "Jackets_and_hoodies-No_photo_jacket",
    ]
    assert doc["days"] == {"2018-01-01": [0], "2018-01-02": [1], "2018-01-03": [0]}
    assert firestore_size({"ab": [1, 2], "c": "xy"}) == (3 + 16) + (2 + 3)


def test_merge_with_stored_keeps_app_edits():
    sheet = parse_sheet(make_rows())
    vest = sheet.garments[0]
    edited = Garment.from_firestore(vest.id, {**vest.to_firestore(), "item": "Renamed in app", "price": 55.0})
    app_only = Garment.from_firestore("Shoes-099", {**vest.to_firestore(), "item": "Not in Sheet", "unknown": 1})
    merged, new = merge_with_stored(sheet, {vest.id: edited, "Shoes-099": app_only})

    by_id = {g.id: g for g in merged.garments}
    assert by_id[vest.id].item == "Renamed in app" and by_id[vest.id].price == 55.0  # app wins
    assert [g.id for g in new] == ["Jackets_and_hoodies-008", "Jackets_and_hoodies-No_photo_jacket"]
    assert "Shoes-099" in by_id
    assert any("Shoes-099" in w and "no row in the Sheet" in w for w in merged.warnings)
    assert merged.days == sheet.days  # wears still come from the Sheet


def test_missing_header():
    with pytest.raises(ValueError):
        parse_sheet([["foo"]])
