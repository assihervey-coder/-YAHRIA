# ═══════════════════════════════════════════════════════════════
# R7.1 — Kernel-native behavioral tests (beyond the TS grid)
# Constitutional properties asserted directly on the Python port.
# ═══════════════════════════════════════════════════════════════

import pytest

from kernel.canonical_json import js_fixed, js_stringify
from kernel.evidence_engine import (
    EvidenceCapture,
    EvidenceRecord,
    capture_evidence,
    hash_payload,
    reset_chain,
    verify_evidence,
)
from kernel.hybrid_reasoning import (
    extract_signals,
    route,
    score_complexity,
    score_uncertainty,
    system1,
    system2,
    uncertainty_level,
)
from kernel.policy_engine import SEED_POLICY_RULES, evaluate_policy
from kernel.state_machines import (
    ACCEPTANCE_MACHINE,
    AGENT_MACHINE,
    EVIDENCE_MACHINE,
    EXECUTION_MACHINE,
    FAILURE_MACHINE,
    TASK_MACHINE,
    IllegalTransitionError,
    assert_transition,
)
from kernel.types import PolicyRequest, ReasoningSignals, WorldState, RepositoryState

pytestmark = pytest.mark.native


# ── 422 semantics on every machine ─────────────────────────────────

@pytest.mark.parametrize("machine", [TASK_MACHINE, AGENT_MACHINE, EXECUTION_MACHINE, EVIDENCE_MACHINE, FAILURE_MACHINE, ACCEPTANCE_MACHINE])
def test_illegal_transition_is_422(machine):
    with pytest.raises(IllegalTransitionError) as e:
        assert_transition(machine, "PENDING", "COMPLETED")
    assert e.value.status_code == 422
    assert "Silent transitions are prohibited" in e.value.reason


def test_evidence_machine_skipping_link_is_illegal():
    """INV-033/110: no shortcut from HASHED straight to SEALED."""
    with pytest.raises(IllegalTransitionError):
        assert_transition(EVIDENCE_MACHINE, "HASHED", "SEALED")


def test_execution_success_requires_verification():
    """INV-044: UNKNOWN ≠ SUCCESS — no direct RUNNING → SUCCEEDED."""
    with pytest.raises(IllegalTransitionError):
        assert_transition(EXECUTION_MACHINE, "RUNNING", "SUCCEEDED")


# ── Policy: security failure is not success ────────────────────────

def test_unknown_authorization_denies():
    """INV-133: UNKNOWN authorization → DENY."""
    ev = evaluate_policy(
        PolicyRequest(actorType="TOOL", actorId="mystery", action="anything", resource="anywhere"),
        SEED_POLICY_RULES,
    )
    assert ev.effect == "DENY"


def test_disabled_rule_is_skipped():
    from kernel.policy_engine import PolicyRuleDef

    disabled = PolicyRuleDef(
        ruleId="OFF-1", name="off", effect="ALLOW", scope="FILESYSTEM",
        action="filesystem.read", resource="workspace.snapshot", priority=1,
        active=False, reason="off", version="0.0.1",
    )
    allowed = PolicyRuleDef(
        ruleId="ON-1", name="on", effect="ALLOW", scope="FILESYSTEM",
        action="filesystem.read", resource="workspace.snapshot", priority=2,
        active=True, reason="on", version="0.0.1",
    )
    ev = evaluate_policy(
        PolicyRequest(actorType="AGENT", actorId="a", action="filesystem.read", resource="workspace.snapshot"),
        [disabled, allowed],
    )
    assert ev.matchedRule == "ON-1"


# ── Evidence: immutability & chain integrity ───────────────────────

def test_chain_is_tamper_evident():
    reset_chain()
    rec = capture_evidence(
        EvidenceCapture(category="CODE", criticality="LOW", actorType="AGENT", actorId="a", claim="original"),
        now="2026-01-01T00:00:00.000Z",
    )
    sealed = EvidenceRecord(**{**rec.to_dict(), "state": "SEALED"})
    assert verify_evidence(sealed)["ok"] is True

    forged = EvidenceRecord(**{**rec.to_dict(), "state": "SEALED", "claim": "forged"})
    res = verify_evidence(forged)
    assert res["ok"] is False
    assert "INTEGRITY FAILURE" in res["reason"]


def test_chain_links_each_capture_to_previous():
    reset_chain()
    a = capture_evidence(EvidenceCapture(category="CODE", criticality="LOW", actorType="AGENT", actorId="a", claim="1"), now="2026-01-01T00:00:00.000Z")
    b = capture_evidence(EvidenceCapture(category="CODE", criticality="LOW", actorType="AGENT", actorId="a", claim="2"), now="2026-01-01T00:00:01.000Z")
    c = capture_evidence(EvidenceCapture(category="CODE", criticality="LOW", actorType="AGENT", actorId="a", claim="3"), now="2026-01-01T00:00:02.000Z")
    assert a.prevHash is None
    assert b.prevHash == a.contentHash
    assert c.prevHash == b.contentHash


def test_js_stringify_matches_js_semantics():
    assert js_stringify({"b": 2, "a": 1}) == '{"b":2,"a":1}'
    assert js_stringify("é — œ") == '"é — œ"'
    assert js_stringify(1.0) == "1"
    assert js_stringify([1, None, True, False]) == "[1,null,true,false]"
    assert js_stringify('q"ote \\ back\nnew') == '"q\\"ote \\\\ back\\nnew"'


def test_js_fixed_emulates_tofixed_tie_break():
    assert js_fixed(0.125, 2) == "0.13"       # exact tie → larger n (ECMA-262)
    assert js_fixed(0.1, 2) == "0.10"
    assert js_fixed(1.005, 2) == "1.00"       # binary value of 1.005 is below the tie
    assert js_fixed(0.455, 2) == "0.46"       # binary value of 0.455 is above the tie
    assert js_fixed(-0.375, 2) == "-0.37"     # tie → larger n = -37


# ── Reasoning: fail-safe behavior ──────────────────────────────────

def test_empty_request_routes_to_system1_or_cascade():
    d = route("")
    assert d.path in ("SYSTEM_1", "CASCADE")
    assert d.signals.length == 0


def test_short_ambiguous_underspecified_request_high_uncertainty():
    s = extract_signals("maybe?")
    assert s.hasAmbiguity is True
    assert score_uncertainty(s) >= 0.6


def test_system2_without_llm_falls_back_explicitly():
    ws = WorldState(
        goal="build something",
        repository=RepositoryState(languages=["ts"], files=10, dirty=False),
        symbols=100, activeErrors=[], testResults={"passed": 0, "failed": 0},
        dependencies=[], timestamp="2026-01-01T00:00:00.000Z",
    )
    r = system2("build something", ws)
    assert r.modelUsed == "HEURISTIC_FALLBACK"
    assert "[S2:FALLBACK]" in r.answer
    assert len(r.plan) == 6
    assert any(p.owner == "verifier" for p in r.plan)  # INV-080: verification step present


def test_uncertainty_levels_never_return_false():
    for u in [x / 100 for x in range(0, 101)]:
        assert uncertainty_level(u) in ("VERIFIED", "PROBABLE", "UNCERTAIN", "UNKNOWN")


def test_signals_are_clamped_zero_one():
    s = ReasoningSignals(length=10 ** 6, hasMultiStep=True, hasAmbiguity=True, hasCreationVerb=True, hasQueryVerb=True, hasRiskTerms=True, keywordMatches=["a"] * 99)
    assert 0.0 <= score_complexity(s) <= 1.0
    assert 0.0 <= score_uncertainty(s) <= 1.0
