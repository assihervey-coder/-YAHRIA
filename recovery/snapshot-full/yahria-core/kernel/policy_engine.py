# ═══════════════════════════════════════════════════════════════
# YAHRIA KERNEL (Python port) — Policy Control Plane (Domain 12)
# Doc ID: YAHRIA-KRN-004-PY | Invariants: INV-120, INV-121, INV-122, INV-123, INV-133
# Port of: src/lib/yahria/policy-engine.ts (YAHRIA-KRN-004)
# Precedence: POLICY DENY > MODEL > AGENT > TOOL > LOCAL CONVENIENCE
# ═══════════════════════════════════════════════════════════════

from dataclasses import dataclass
from typing import List, Optional

from kernel.types import PolicyEvaluation, PolicyRequest


@dataclass(frozen=True)
class PolicyRuleDef:
    ruleId: str
    name: str
    effect: str              # PolicyEffect value
    scope: str               # TOOL | EXECUTION | FILESYSTEM | NETWORK | EVOLUTION | MODEL
    action: str              # exact action or wildcard "fs.*"
    resource: str            # exact resource or wildcard "*"
    priority: int            # lower = evaluated first
    active: Optional[bool]   # optional enable switch (None = active)
    reason: str
    version: str

    def to_dict(self) -> dict:
        d = {
            "ruleId": self.ruleId, "name": self.name, "effect": self.effect,
            "scope": self.scope, "action": self.action, "resource": self.resource,
            "priority": self.priority, "reason": self.reason, "version": self.version,
        }
        if self.active is not None:
            d["active"] = self.active
        return d


# Seed canonical policy set — DENY BY DEFAULT (INV-052, INV-133)
SEED_POLICY_RULES: List[PolicyRuleDef] = [
    PolicyRuleDef("POL-001", "Host secrets are never readable", "DENY", "FILESYSTEM", "filesystem.read", "host.secrets", 1, None, "INV-053: sandboxed execution MUST NOT access credentials or production secrets", "1.0.0"),
    PolicyRuleDef("POL-002", "Host workspace never mounted RW", "DENY", "FILESYSTEM", "filesystem.write", "host.workspace", 1, None, "FS-001: host workspace never mounted RW into agent container", "1.0.0"),
    PolicyRuleDef("POL-003", "No direct network egress from sandbox", "DENY", "NETWORK", "network.egress", "*", 2, None, "INV-051: network isolation explicit; egress requires explicit policy", "1.0.0"),
    PolicyRuleDef("POL-004", "Self-evolution cannot promote directly", "DENY", "EVOLUTION", "evolution.promote", "production", 1, None, "INV-160/161/162: D.8 governed by D.6.11 — experiment, benchmark, approve first", "1.0.0"),
    PolicyRuleDef("POL-005", "Constitutional amendment is human-only", "DENY", "EVOLUTION", "constitution.amend", "*", 1, None, "Global invariants evolve only through constitutional amendment", "1.0.0"),
    PolicyRuleDef("POL-006", "Tool execution requires registration + authorization", "REQUIRE_APPROVAL", "TOOL", "tool.execute", "unregistered.*", 3, None, "INV-062: REGISTERED ≠ AUTHORIZED", "1.0.0"),
    PolicyRuleDef("POL-007", "Sandboxed file writes allowed in overlay only", "ALLOW", "FILESYSTEM", "filesystem.write", "workspace.overlay", 10, None, "OverlayFS upper layer is the isolated RW surface", "1.0.0"),
    PolicyRuleDef("POL-008", "Read-only inspection of workspace allowed", "ALLOW", "FILESYSTEM", "filesystem.read", "workspace.snapshot", 10, None, "Lower layer is read-only (FS-002)", "1.0.0"),
    PolicyRuleDef("POL-009", "Bounded executions allowed in sandbox", "ALLOW", "EXECUTION", "execution.run", "sandbox.*", 10, None, "INV-042: resource bounded executions inside approved boundaries", "1.0.0"),
    PolicyRuleDef("POL-010", "Model inference allowed with logging", "ALLOW", "MODEL", "model.inference", "router.*", 10, None, "INV-080: output is not fact; verdict requires verification", "1.0.0"),
]

# Final fallback — DENY BY DEFAULT
DEFAULT_EFFECT = "DENY"
DEFAULT_REASON = "INV-052/INV-133: no explicit policy matched → DEFAULT DENY. Security failure is not success."


def evaluate_policy(request: PolicyRequest, rules: List[PolicyRuleDef]) -> PolicyEvaluation:
    # Mirror of TS: filter active !== false, then stable sort by priority.
    active_rules = [r for r in rules if r.active is not False]
    sorted_rules = sorted(active_rules, key=lambda r: r.priority)

    for rule in sorted_rules:
        if rule.action.endswith("*"):
            action_match = request.action.startswith(rule.action[:-1])
        else:
            action_match = rule.action == request.action
        resource_match = (
            rule.resource == "*"
            or rule.resource == request.resource
            or (rule.resource.endswith(".*") and request.resource.startswith(rule.resource[:-1]))
        )
        if action_match and resource_match:
            return PolicyEvaluation(
                effect=rule.effect,
                matchedRule=rule.ruleId,
                reason=rule.reason,
                precedence=f"POLICY {rule.effect} > MODEL > AGENT > TOOL > LOCAL (rule {rule.ruleId} v{rule.version}, priority {rule.priority})",
            )

    return PolicyEvaluation(
        effect=DEFAULT_EFFECT,
        matchedRule=None,
        reason=DEFAULT_REASON,
        precedence="POLICY DENY (default) > MODEL > AGENT > TOOL > LOCAL",
    )
