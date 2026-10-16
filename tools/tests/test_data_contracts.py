"""The generated data contracts (web/public/def/contracts/*.odcs.yaml, from semantics/catalog.yaml) are valid
Open Data Contract Standard v3.0.2 documents (R-40 phase 3). Schema: tests/fixtures/odcs-json-schema-v3.0.2.json,
from github.com/bitol-io/open-data-contract-standard (Apache 2.0)."""
import json
from pathlib import Path

import jsonschema
import pytest
import yaml

ROOT = Path(__file__).resolve().parents[2]
SCHEMA = json.loads((Path(__file__).parent / "fixtures" / "odcs-json-schema-v3.0.2.json").read_text())
CONTRACTS = sorted((ROOT / "web" / "public" / "def" / "contracts").glob("*.odcs.yaml"))


def test_contracts_exist():
    assert len(CONTRACTS) >= 5


@pytest.mark.parametrize("path", CONTRACTS, ids=lambda p: p.name)
def test_contract_is_valid_odcs(path):
    errors = list(jsonschema.Draft201909Validator(SCHEMA).iter_errors(yaml.safe_load(path.read_text())))
    assert errors == [], [f"{'/'.join(map(str, e.path))}: {e.message}" for e in errors[:5]]
