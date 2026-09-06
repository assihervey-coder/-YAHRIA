# ═══════════════════════════════════════════════════════════════
# YAHRIA KERNEL (Python port) — Global Invariants (INV-001 → INV-211)
# Doc ID: YAHRIA-KRN-002-PY | Source: GLOBAL_INVARIANTS.md V1.0.0 FROZEN
# Port of: src/lib/yahria/invariants.ts (YAHRIA-KRN-002)
# ═══════════════════════════════════════════════════════════════

from dataclasses import dataclass
from typing import List


@dataclass(frozen=True)
class Invariant:
    id: str
    family: str
    title: str
    rule: str

    def to_dict(self) -> dict:
        return {"id": self.id, "family": self.family, "title": self.title, "rule": self.rule}


INVARIANTS: List[Invariant] = [
    Invariant("INV-001", "CORE", "Architectural Integrity", "Every component MUST belong to a declared architectural domain. No undefined ownership."),
    Invariant("INV-002", "CORE", "Single Responsibility Ownership", "Every critical responsibility MUST have one canonical owner."),
    Invariant("INV-003", "CORE", "Explicit Dependencies", "Dependencies MUST be explicit. No hidden imports or implicit coupling."),
    Invariant("INV-004", "CORE", "No Circular Dependencies", "The domain dependency graph MUST remain acyclic."),
    Invariant("INV-010", "IDENTITY", "Explicit Identity", "Every security-relevant action MUST have an attributable identity."),
    Invariant("INV-011", "IDENTITY", "Authentication Before Trust", "IDENTITY ≠ PERMISSION. Every privileged action requires explicit authorization."),
    Invariant("INV-012", "IDENTITY", "Least Privilege", "Every actor receives only minimum required permissions."),
    Invariant("INV-020", "TENANCY", "Tenant Isolation", "A tenant MUST NOT access another tenant data without authorized, auditable access."),
    Invariant("INV-021", "TENANCY", "Explicit Tenant Context", "Tenant-scoped operations MUST have explicit tenant context."),
    Invariant("INV-022", "TENANCY", "Organization Ownership", "Resource → Project → Organization → Tenant lineage MUST remain traceable."),
    Invariant("INV-030", "DATA", "Data Integrity", "Persistent data MUST preserve identity, consistency, referential integrity, ownership."),
    Invariant("INV-031", "DATA", "Explicit Persistence Contracts", "PK / FK / UNIQUE / CHECK / INDEX / RELATIONSHIP / LIFECYCLE must be declared."),
    Invariant("INV-032", "DATA", "No Silent Schema Mutation", "Every structural change requires SPEC → MODEL → MIGRATION → TEST → VALIDATION."),
    Invariant("INV-033", "DATA", "Immutable Evidence", "Sealed evidence MUST NOT be modified; corrections create new versions."),
    Invariant("INV-034", "DATA", "Data Lineage", "SOURCE → TRANSFORMATION → DECISION → OUTPUT must remain traceable."),
    Invariant("INV-040", "EXECUTION", "Explicit Execution Context", "Every execution MUST have execution_id, task_id, actor, tenant, policy_context."),
    Invariant("INV-041", "EXECUTION", "No Uncontrolled Execution", "Untrusted or generated code MUST NOT execute outside approved runtime boundaries."),
    Invariant("INV-042", "EXECUTION", "Resource Bounding", "Executions MUST be bounded by CPU, MEMORY, DISK, PID, TIMEOUT."),
    Invariant("INV-043", "EXECUTION", "Cancellation and Termination", "Long executions MUST support controlled termination preserving evidence."),
    Invariant("INV-044", "EXECUTION", "Failure Is Explicit", "UNKNOWN ≠ SUCCESS. Never convert unknown state into success."),
    Invariant("INV-050", "SANDBOX", "Host Protection", "Host MUST remain protected from unauthorized FS, process, network, secret access."),
    Invariant("INV-051", "SANDBOX", "Explicit Isolation", "FILESYSTEM / NETWORK / PROCESS / RESOURCE / IDENTITY boundaries MUST be explicit."),
    Invariant("INV-052", "SANDBOX", "Default Deny", "Sandbox privileges: DENY BY DEFAULT, explicitly granted only."),
    Invariant("INV-053", "SANDBOX", "No Secret Leakage", "Sandboxed execution MUST NOT receive credentials or production secrets."),
    Invariant("INV-060", "TOOL", "Tool Identity", "Every registered tool MUST have tool_id, name, version, capabilities, contract."),
    Invariant("INV-061", "TOOL", "Contract Validation", "Tool input/output MUST be validated against declared contracts."),
    Invariant("INV-062", "TOOL", "Tool Authorization", "REGISTERED ≠ AUTHORIZED. Capability + policy evaluation before execution."),
    Invariant("INV-063", "TOOL", "Tool Version Traceability", "Reproducibility MUST NOT depend on unspecified \"latest\"."),
    Invariant("INV-070", "AGENT", "Agent Identity", "Every autonomous agent MUST have explicit identity."),
    Invariant("INV-071", "AGENT", "Capability Boundaries", "INTENT → CAPABILITY CHECK → POLICY CHECK → EXECUTION."),
    Invariant("INV-072", "AGENT", "Agent Accountability", "Significant actions attributable to responsible agent identity."),
    Invariant("INV-073", "AGENT", "Autonomy Is Governed", "AUTONOMY < POLICY. Autonomy never overrides governance."),
    Invariant("INV-080", "COGNITIVE", "Model Output Is Not Fact", "MODEL OUTPUT → VERIFICATION → EVIDENCE → TRUST LEVEL."),
    Invariant("INV-081", "COGNITIVE", "Uncertainty Must Be Representable", "VERIFIED / PROBABLE / UNCERTAIN / UNKNOWN / FALSE — unknown never becomes certain."),
    Invariant("INV-082", "COGNITIVE", "Decisions Require Context", "Significant cognitive decisions preserve decision context."),
    Invariant("INV-090", "TASK", "Explicit Task State", "Tasks MUST have explicit lifecycle states with controlled transitions."),
    Invariant("INV-091", "TASK", "Task Dependency Integrity", "Task MUST NOT execute before mandatory dependencies are satisfied."),
    Invariant("INV-092", "TASK", "Retry Is Governed", "Retries MUST have policy, max attempts, backoff, termination rule."),
    Invariant("INV-100", "OBSERVABILITY", "Observability By Design", "Critical execution paths MUST emit EVENTS, TRACES, METRICS, LOGS."),
    Invariant("INV-101", "OBSERVABILITY", "Correlation", "Related operations correlatable via trace_id, execution_id, task_id, agent_id."),
    Invariant("INV-102", "OBSERVABILITY", "Evidence Before Assertion", "Assertion without evidence has lower trust than assertion + verifiable evidence."),
    Invariant("INV-110", "EVIDENCE", "Evidence Integrity", "Evidence lifecycle: capture, identity, storage, integrity, lineage, retention."),
    Invariant("INV-111", "EVIDENCE", "Evidence Traceability", "Critical evidence linked to the action that produced it."),
    Invariant("INV-112", "EVIDENCE", "Replay Where Possible", "Critical executions SHOULD preserve replay information."),
    Invariant("INV-120", "POLICY", "Policy Precedence", "POLICY DENY > MODEL > AGENT > TOOL > LOCAL IMPLEMENTATION."),
    Invariant("INV-121", "POLICY", "Policy Is Explicit", "Security policy MUST be explicit, versioned, auditable."),
    Invariant("INV-122", "POLICY", "Policy Version Traceability", "Critical actions record the applicable policy version."),
    Invariant("INV-123", "POLICY", "Policy Explainability", "Decisions explainable through rule, condition, context, decision."),
    Invariant("INV-130", "SECURITY", "Zero Trust", "No internal component is automatically trusted."),
    Invariant("INV-131", "SECURITY", "Defense In Depth", "Critical protection MUST NOT depend on a single control."),
    Invariant("INV-132", "SECURITY", "Secret Minimization", "Logs, traces, errors avoid secret disclosure."),
    Invariant("INV-133", "SECURITY", "Security Failure Is Not Success", "UNKNOWN authorization → DENY."),
    Invariant("INV-140", "MEMORY", "Memory Is Not Automatic Truth", "Memory carries source, confidence, timestamp, scope, validation state."),
    Invariant("INV-141", "MEMORY", "Memory Has Governance", "Memory creation, consolidation, retrieval, deletion follow governance."),
    Invariant("INV-142", "MEMORY", "Memory Lineage", "Important memory preserves its origin."),
    Invariant("INV-150", "LEARNING", "Learning Requires Evidence", "Improvement NOT promoted because a model claims it is better."),
    Invariant("INV-151", "LEARNING", "Learning Is Reversible", "Promoted improvements support rollback."),
    Invariant("INV-152", "LEARNING", "Failure Is Learning Input", "Validated failures preserved as structured learning signals."),
    Invariant("INV-160", "EVOLUTION", "No Unverified Self-Modification", "No autonomous promotion of critical self-modifications without verification."),
    Invariant("INV-161", "EVOLUTION", "Separation Of Proposal And Approval", "The proposer MUST NOT be the sole approval authority."),
    Invariant("INV-162", "EVOLUTION", "Experiment Before Promotion", "PROPOSAL → EXPERIMENT → BENCHMARK → VERIFY → POLICY → APPROVE → CANARY → PROMOTE."),
    Invariant("INV-163", "EVOLUTION", "Rollback Capability", "Critical promoted changes MUST have rollback strategy."),
    Invariant("INV-170", "QUALITY", "Testable Architecture", "Critical logic MUST NOT hide behind untestable global state."),
    Invariant("INV-171", "QUALITY", "Compilation Is Not Validation", "Compilation success proves neither correctness nor security."),
    Invariant("INV-172", "QUALITY", "Regression Protection", "Validated capability MUST NOT silently regress."),
    Invariant("INV-180", "CHANGE", "No Silent Architectural Change", "Architectural changes MUST be explicit and versioned."),
    Invariant("INV-181", "CHANGE", "Impact Analysis", "Critical changes consider dependencies, security, policy, data, rollback."),
    Invariant("INV-182", "CHANGE", "Backward Compatibility", "Breaking changes MUST be explicit with migration paths."),
    Invariant("INV-190", "REPRODUCIBILITY", "Versioned Execution", "Critical executions identify software, config, tool, policy, environment versions."),
    Invariant("INV-191", "REPRODUCIBILITY", "Deterministic Control", "Non-determinism MUST be explicitly recognized."),
    Invariant("INV-200", "OVERSIGHT", "Human Override", "Humans retain pause / cancel / approve / reject / rollback authority."),
    Invariant("INV-201", "OVERSIGHT", "Explicit Override", "Human overrides attributable and auditable."),
    Invariant("INV-210", "FAILURE", "Fail Safely", "DO NOT GUESS. DO NOT ESCALATE PRIVILEGE. DO NOT ASSUME SUCCESS."),
    Invariant("INV-211", "FAILURE", "Failure Preserves Evidence", "Failure MUST NOT automatically erase evidence."),
]


def _unique_families(invariants: List[Invariant]) -> List[str]:
    seen: List[str] = []
    for inv in invariants:
        if inv.family not in seen:
            seen.append(inv.family)
    return seen


# Mirror of TS: Array.from(new Set(INVARIANTS.map((i) => i.family)))
INVARIANT_FAMILIES: List[str] = _unique_families(INVARIANTS)


def invariant_by_id(invariant_id: str) -> Invariant:
    for inv in INVARIANTS:
        if inv.id == invariant_id:
            return inv
    raise KeyError(f"Unknown invariant: {invariant_id}")
