# ═══════════════════════════════════════════════════════════════
# R7.1 — Parity grid: policy engine (KRN-004)
# Seed rules, deny-by-default, wildcards, priority, disabled rules.
# ═══════════════════════════════════════════════════════════════

import pytest

from kernel.policy_engine import (
    DEFAULT_EFFECT,
    DEFAULT_REASON,
    SEED_POLICY_RULES,
    evaluate_policy,
)
from kernel.types import PolicyRequest

pytestmark = pytest.mark.parity


def test_seed_rules_full_parity(parity):
    ts_rules = parity["policy"]["seedRules"]
    assert len(SEED_POLICY_RULES) == len(ts_rules) == 10
    for r_py, r_ts in zip(SEED_POLICY_RULES, ts_rules):
        assert r_py.to_dict() == r_ts


def test_battery_zero_divergence(parity):
    for case in parity["policy"]["battery"]:
        req_ts = case["request"]
        request = PolicyRequest(
            actorType=req_ts["actorType"],
            actorId=req_ts["actorId"],
            action=req_ts["action"],
            resource=req_ts["resource"],
        )
        py = evaluate_policy(request, SEED_POLICY_RULES)
        ts = case["result"]
        assert py.effect == ts["effect"], f"effect divergence on {req_ts}"
        assert py.matchedRule == ts["matchedRule"], f"matchedRule divergence on {req_ts}"
        assert py.reason == ts["reason"], f"reason divergence on {req_ts}"
        assert py.precedence == ts["precedence"], f"precedence divergence on {req_ts}"


def test_custom_rules_wildcards_and_priority(parity):
    ts_rules = parity["policy"]["customRules"]
    from kernel.policy_engine import PolicyRuleDef

    rules = [
        PolicyRuleDef(
            ruleId=r["ruleId"], name=r["name"], effect=r["effect"], scope=r["scope"],
            action=r["action"], resource=r["resource"], priority=r["priority"],
            active=r.get("active"), reason=r["reason"], version=r["version"],
        )
        for r in ts_rules
    ]
    for case in parity["policy"]["customBattery"]:
        req_ts = case["request"]
        request = PolicyRequest(
            actorType=req_ts["actorType"],
            actorId=req_ts["actorId"],
            action=req_ts["action"],
            resource=req_ts["resource"],
        )
        py = evaluate_policy(request, rules)
        ts = case["result"]
        assert py.effect == ts["effect"]
        assert py.matchedRule == ts["matchedRule"]
        assert py.reason == ts["reason"]
        assert py.precedence == ts["precedence"]


def test_deny_by_default_is_the_final_fallback():
    """INV-052 / INV-133: unknown authorization → DENY, never success."""
    request = PolicyRequest(actorType="AGENT", actorId="x", action="nope", resource="nothing")
    ev = evaluate_policy(request, SEED_POLICY_RULES)
    assert ev.effect == "DENY"
    assert ev.matchedRule is None
    assert ev.reason == DEFAULT_REASON
    assert ev.precedence == "POLICY DENY (default) > MODEL > AGENT > TOOL > LOCAL"
    assert DEFAULT_EFFECT == "DENY"


def test_policy_overrides_model_agent_tool():
    """INV-120: POLICY DENY > MODEL > AGENT > TOOL > LOCAL IMPLEMENTATION."""
    request = PolicyRequest(actorType="MODEL", actorId="llm", action="evolution.promote", resource="production")
    ev = evaluate_policy(request, SEED_POLICY_RULES)
    assert ev.effect == "DENY" and ev.matchedRule == "POL-004"
