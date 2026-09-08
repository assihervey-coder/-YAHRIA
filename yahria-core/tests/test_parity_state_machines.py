# ═══════════════════════════════════════════════════════════════
# R7.1 — Parity grid: state machines (YAHRIA-KRN-001)
# Exhaustive pair matrix from TS fixtures (659 pairs) + structures.
# ═══════════════════════════════════════════════════════════════

import pytest

from kernel.state_machines import (
    ALL_MACHINES,
    IllegalTransitionError,
    assert_transition,
    can_transition,
    machine_by_name,
)

pytestmark = pytest.mark.parity


def _machine(name):
    m = machine_by_name(name)
    assert m is not None, f"machine {name} missing in Python port"
    return m


def test_machines_structure_parity(parity):
    """Names, domains, states, initial, terminal, transitions — exact."""
    ts_structs = parity["state_machines"]["structures"]
    assert len(ALL_MACHINES) == len(ts_structs) == 6
    for ts in ts_structs:
        m = _machine(ts["name"])
        assert m.name == ts["name"]
        assert m.domain == ts["domain"]
        assert list(m.states) == ts["states"]
        assert m.initial == ts["initial"]
        assert list(m.terminal) == ts["terminal"]
        assert len(m.transitions) == len(ts["transitions"])
        for t_py, t_ts in zip(m.transitions, ts["transitions"]):
            assert t_py.to_dict() == t_ts


def test_pair_count_is_exhaustive(parity):
    ts_pairs = parity["state_machines"]["pairMatrix"]
    assert parity["state_machines"]["pairCount"] == 659
    total = 0
    for ts in parity["state_machines"]["structures"]:
        m = _machine(ts["name"])
        total += len(m.states) ** 2
    assert total == len(ts_pairs) == 659


def test_can_transition_zero_divergence(parity):
    """Every (machine, from, to) pair: verdict, rule and reason identical."""
    for case in parity["state_machines"]["pairMatrix"]:
        m = _machine(case["machine"])
        py = can_transition(m, case["from"], case["to"])
        ts = case["result"]
        # Normalize TS shape: {ok, rule?, reason?} -> comparable dict
        ts_norm = {"ok": ts["ok"]}
        if ts.get("rule") is not None:
            ts_norm["rule"] = ts["rule"]
        if ts.get("reason") is not None:
            ts_norm["reason"] = ts["reason"]
        assert py == ts_norm, (
            f"DIVERGENCE on {case['machine']}: {case['from']} → {case['to']}\n"
            f"  TS: {ts_norm}\n  PY: {py}"
        )


def test_assert_transition_returns_rule_on_legal(parity):
    m = _machine("TASK")
    rule = assert_transition(m, "PENDING", "READY")
    assert rule["from"] == "PENDING" and rule["to"] == "READY"
    assert rule["authority"] == "SYSTEM"


def test_assert_transition_raises_422_on_illegal(parity):
    """R7.1 acceptance: illegal transition → 422 semantics, exact message."""
    illegal_cases = [
        c for c in parity["state_machines"]["pairMatrix"] if not c["result"]["ok"]
    ]
    assert len(illegal_cases) > 500  # most pairs are illegal by design
    for case in illegal_cases:
        m = _machine(case["machine"])
        with pytest.raises(IllegalTransitionError) as exc_info:
            assert_transition(m, case["from"], case["to"])
        err = exc_info.value
        assert err.status_code == 422
        assert err.reason == case["result"]["reason"]
        assert str(err) == case["result"]["reason"]


def test_no_silent_transitions_message(parity):
    m = _machine("EXECUTION")
    res = can_transition(m, "QUEUED", "SUCCEEDED")
    assert res["ok"] is False
    assert res["reason"] == (
        "Transition QUEUED → SUCCEEDED is not declared in EXECUTION machine. "
        "Silent transitions are prohibited."
    )


def test_terminal_states_unreachable_from_nowhere_out(parity):
    """Structural constitutional property: every machine initial state is in states."""
    for ts in parity["state_machines"]["structures"]:
        m = _machine(ts["name"])
        assert m.initial in m.states
        for t in m.terminal:
            assert t in m.states
