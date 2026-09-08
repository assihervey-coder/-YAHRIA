# ═══════════════════════════════════════════════════════════════
# R7.1 — shared fixtures loader
# ═══════════════════════════════════════════════════════════════

import json
from pathlib import Path

import pytest

FIXTURES_PATH = Path(__file__).parent / "fixtures" / "parity" / "fixtures.json"


@pytest.fixture(scope="session")
def parity() -> dict:
    with FIXTURES_PATH.open(encoding="utf-8") as f:
        return json.load(f)
