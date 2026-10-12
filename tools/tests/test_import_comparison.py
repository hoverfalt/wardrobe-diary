import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from import_comparison import photo_name, transform  # noqa: E402


def test_transform_reads_values_and_makes_ids():
    rows = [
        ["Category", "Type", "Item", "Details", "Photo", "Monthly cost", "Yearly cost", "Use frequency", "Cost per use"],
        ["Comparison", "Physical service", "HSL", "Monthly ticket", "Photos/Comparison-HSL.png", 59.7, 716.4, 6 / 7, 2.28],
        ["Comparison", "Content", "", "", "", "", "", "", ""],
        ["Comparison", "Content", "HSL", "", "", 5, 60, 0.5, 0.33],
    ]
    items = transform(rows)
    assert [c["id"] for c in items] == ["hsl", "hsl-2"]
    assert items[0]["photo"] == "Comparison-HSL" and items[0]["monthlyCost"] == 59.7
    assert "yearlyCost" not in items[0]


def test_photo_name():
    assert photo_name("Photos/Comparison-MacBook_Air.png") == "Comparison-MacBook_Air"
    assert photo_name("") == ""
