import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from restore import diff, public_from  # noqa: E402

G = {"category": "Shirts", "item": "A", "details": "", "photo": "Shirts-001", "price": 10.0, "purchased": "2020-01-01",
     "divested": None, "timesUsedInit": 0, "materials": "", "weightG": None}


def snapshot(**over):
    base = {"uid": "u", "garments": {"Shirts-001": {**G, "_history": []}}, "days": {"2020-01-02": ["Shirts-001"]},
            "deletedGarments": {}, "settings": {"app": {"sheetRetired": "2026-10-09"}}}
    return {**base, **over}


def test_diff_finds_added_changed_and_removed_docs():
    current = snapshot(days={"2020-01-02": ["Shirts-001"], "2020-01-03": ["Shirts-001"]})
    target = snapshot(garments={"Shirts-001": {**G, "price": 12.0, "_history": [{"x": 1}]}},
                      days={"2020-01-02": ["Shirts-001"], "2020-01-04": ["Shirts-001"]})
    d = diff(current, target)
    assert d["garments"] == {"add": [], "change": ["Shirts-001"], "remove": []}  # history ignored, price counts
    assert d["days"] == {"add": ["2020-01-04"], "change": [], "remove": ["2020-01-03"]}
    assert d["settings"] == {"add": [], "change": [], "remove": []}


def test_identical_snapshots_have_no_changes():
    assert all(not any(v.values()) for v in diff(snapshot(), snapshot()).values())


def test_public_data_rebuilt_from_backup():
    pub = public_from(snapshot(days={"2020-01-02": ["Shirts-001", "Gone-001"]}))
    assert [g["id"] for g in pub["garments"]] == ["Shirts-001"]
    assert pub["days"] == {"2020-01-02": [0]}  # unknown garment dropped
def test_public_from_includes_comparison():
    from restore import public_from

    items = [{"id": "hsl", "item": "HSL", "monthlyCost": 59.7, "useFrequency": 0.857}]
    target = {"garments": {}, "days": {}, "settings": {"comparison": {"items": items}}}
    assert public_from(target)["comparison"] == items
    assert "comparison" not in public_from({"garments": {}, "days": {}, "settings": {}})
