# ═══════════════════════════════════════════════════════════════
# R7.1 — Parity grid: invariants (KRN-002) + domains (KRN-003)
# ═══════════════════════════════════════════════════════════════

import pytest

from kernel.domains import DOMAINS, FORBIDDEN_DEPENDENCIES, GOVERNANCE_PLANES, canonical_phase_order
from kernel.invariants import INVARIANTS, INVARIANT_FAMILIES, invariant_by_id

pytestmark = pytest.mark.parity


def test_invariants_full_parity(parity):
    ts = parity["invariants"]
    assert ts["count"] == len(INVARIANTS) == 74
    for inv_py, inv_ts in zip(INVARIANTS, ts["invariants"]):
        assert inv_py.to_dict() == inv_ts


def test_invariant_ids_ordered(parity):
    ids = [i.id for i in INVARIANTS]
    assert ids == sorted(ids)
    assert ids[0] == "INV-001" and ids[-1] == "INV-211"


def test_invariant_families_parity(parity):
    assert INVARIANT_FAMILIES == parity["invariants"]["families"]
    # insertion order (first appearance), not alphabetical
    first_seen = []
    for i in INVARIANTS:
        if i.family not in first_seen:
            first_seen.append(i.family)
    assert INVARIANT_FAMILIES == first_seen


def test_invariant_by_id_lookup():
    assert invariant_by_id("INV-044").rule.startswith("UNKNOWN ≠ SUCCESS")
    with pytest.raises(KeyError):
        invariant_by_id("INV-999")


def test_domains_full_parity(parity):
    ts = parity["domains"]
    assert ts["count"] == len(DOMAINS) == 24
    for d_py, d_ts in zip(DOMAINS, ts["domains"]):
        assert d_py.to_dict() == d_ts


def test_forbidden_dependencies_parity(parity):
    assert FORBIDDEN_DEPENDENCIES == parity["domains"]["forbiddenDependencies"]


def test_governance_planes_parity(parity):
    ts = parity["domains"]["governancePlanes"]
    assert set(ts.keys()) == {"D6", "D7", "D8"}
    for key in ("D6", "D7", "D8"):
        assert GOVERNANCE_PLANES[key] == ts[key]
    # D.6 governs D.8 — constitutional rule "D.6 gouverne D.8"
    assert "GOVERNS D.8" in GOVERNANCE_PLANES["D6"]["role"]


def test_canonical_phase_order_is_bijective():
    order = canonical_phase_order()
    phases = [d.phase for d in order]
    assert phases == list(range(24))
    codes = {d.code for d in DOMAINS}
    assert len(codes) == 24
    assert "00" in codes and "23" in codes and "16" in codes


def test_core_domains_are_cross_cutting(parity):
    core_ts = {d["code"] for d in parity["domains"]["domains"] if d["isCore"]}
    core_py = {d.code for d in DOMAINS if d.isCore}
    assert core_py == core_ts == {"00", "16", "11", "12", "19", "20"}
