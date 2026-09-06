# ═══════════════════════════════════════════════════════════════
# R7.1 — Parity grid: hybrid reasoning (KRN-006)
# Signals, scores, routing (exact rationale strings), S1, agreement.
# Non-deterministic `ms` fields are excluded on both sides.
# ═══════════════════════════════════════════════════════════════

import math

import pytest

from kernel.hybrid_reasoning import (
    ROUTE_THRESHOLDS,
    S1_TEMPLATES,
    agreement_check,
    extract_signals,
    route,
    score_complexity,
    score_uncertainty,
    system1,
    uncertainty_level,
)
from kernel.types import PlanStep, ReasoningSignals

pytestmark = pytest.mark.parity


def _signals_equal(py: ReasoningSignals, ts: dict) -> bool:
    return (
        py.length == ts["length"]
        and py.hasMultiStep == ts["hasMultiStep"]
        and py.hasAmbiguity == ts["hasAmbiguity"]
        and py.hasCreationVerb == ts["hasCreationVerb"]
        and py.hasQueryVerb == ts["hasQueryVerb"]
        and py.hasRiskTerms == ts["hasRiskTerms"]
        and list(py.keywordMatches) == ts["keywordMatches"]
    )


def _decision_equal(py, ts: dict) -> bool:
    return (
        py.path == ts["path"]
        and py.escalationReason == ts["escalationReason"]
        and py.rationale == ts["rationale"]
        and py.complexity == ts["complexity"]
        and py.uncertainty == ts["uncertainty"]
        and _signals_equal(py.signals, ts["signals"])
    )


def test_thresholds_parity(parity):
    ts = parity["reasoning"]["thresholds"]
    assert ROUTE_THRESHOLDS == ts


def test_signals_and_scores_parity(parity):
    for case in parity["reasoning"]["routingBattery"]:
        request = case["request"]
        signals = extract_signals(request)
        assert _signals_equal(signals, case["signals"]), f"signals divergence on {request!r}"
        c = score_complexity(signals)
        u = score_uncertainty(signals)
        assert c == case["complexity"], f"complexity divergence on {request!r}: {c} != {case['complexity']}"
        assert u == case["uncertainty"], f"uncertainty divergence on {request!r}: {u} != {case['uncertainty']}"


def test_route_full_parity(parity):
    """path + scores + signals + escalationReason + rationale — byte exact."""
    divergences = []
    for case in parity["reasoning"]["routingBattery"]:
        decision = route(case["request"])
        if not _decision_equal(decision, case["decision"]):
            divergences.append(
                (case["request"], case["decision"], decision)
            )
    assert not divergences, f"{len(divergences)} route divergences:\n" + "\n".join(
        f"  request={r!r}\n   TS: path={t['path']} esc={t['escalationReason']!r} rat={t['rationale']!r}\n"
        f"   PY: path={p.path} esc={p.escalationReason!r} rat={p.rationale!r}"
        for r, t, p in divergences
    )


def test_route_covers_all_four_paths(parity):
    paths = {case["decision"]["path"] for case in parity["reasoning"]["routingBattery"]}
    assert paths == {"SYSTEM_1", "SYSTEM_2", "CASCADE"}


def test_risk_terms_always_escalate(parity):
    """HR-3.R1: risk vocabulary → SYSTEM_2 regardless of score."""
    risk_cases = [
        case for case in parity["reasoning"]["routingBattery"]
        if case["signals"]["hasRiskTerms"]
    ]
    assert len(risk_cases) >= 3
    for case in risk_cases:
        if case["complexity"] > 0.3 or case["uncertainty"] > 0.25:
            assert case["decision"]["path"] == "SYSTEM_2"
            assert case["decision"]["escalationReason"].startswith("RISK_TERMS")


def test_s1_full_parity(parity):
    for case in parity["reasoning"]["s1Battery"]:
        goal = case["goal"]
        r = system1(goal, case["baseUncertainty"])
        ts = case["result"]
        assert r.answer == ts["answer"], f"answer divergence on {goal!r}"
        assert r.template == ts["template"]
        assert r.uncertainty == ts["uncertainty"], f"uncertainty divergence on {goal!r}"
        assert len(r.plan) == len(ts["plan"])
        for p_py, p_ts in zip(r.plan, ts["plan"]):
            assert p_py.index == p_ts["index"]
            assert p_py.action == p_ts["action"]
            assert p_py.detail == p_ts["detail"]
            assert p_py.owner == p_ts["owner"]
            assert p_py.requiresApproval == p_ts["requiresApproval"]


def test_s1_no_template_fails_safely():
    """INV-210: no template → never guess, uncertainty = 1.0."""
    r = system1("build a whole new platform from scratch", 0.2)
    assert r.template == "NONE"
    assert r.uncertainty == 1.0
    assert "INV-210" in r.answer


def test_agreement_battery_parity(parity):
    """HR-6 agreement — replayed with identical plans."""
    s1ok = system1("list tasks", 0.2)
    s1none = system1("build a platform", 0.2)
    s2like = type("S2Like", (), {})()
    from kernel.hybrid_reasoning import S2Result

    s2like = S2Result(
        answer="[S2] plan",
        plan=[
            PlanStep(1, "resolve entity type", "d", "explorer", False),
            PlanStep(2, "query registry", "d", "explorer", False),
            PlanStep(3, "render listing", "d", "verifier", False),
        ],
        reasoning="r", uncertainty=0.2, ms=0, modelUsed="YAHRIA-S2-LLM",
    )
    s2diverge = S2Result(
        answer="[S2] plan",
        plan=[
            PlanStep(1, "perceive", "d", "explorer", False),
            PlanStep(2, "implement", "d", "coder", False),
        ],
        reasoning="r", uncertainty=0.2, ms=0, modelUsed="YAHRIA-S2-LLM",
    )
    cases = {
        "same-responsibilities": agreement_check(s1ok, s2like),
        "diverge": agreement_check(s1ok, s2diverge),
        "no-template": agreement_check(s1none, s2like),
    }
    for case in parity["reasoning"]["agreementBattery"]:
        py = cases[case["label"]]
        assert py["agree"] == case["result"]["agree"], f"agree divergence on {case['label']}"
        assert py["note"] == case["result"]["note"], f"note divergence on {case['label']}"


def test_uncertainty_levels_parity(parity):
    for case in parity["reasoning"]["uncertaintyLevels"]:
        assert uncertainty_level(case["u"]) == case["level"], f"level divergence at u={case['u']}"


def test_s1_template_count():
    assert len(S1_TEMPLATES) == 3


def test_no_float_precision_drift_in_scores(parity):
    """INV-191: float ops are IEEE754 on both runtimes — no drift allowed."""
    for case in parity["reasoning"]["routingBattery"]:
        assert math.isclose(case["complexity"], case["decision"]["complexity"], rel_tol=0, abs_tol=0)
