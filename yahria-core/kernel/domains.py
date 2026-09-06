# ═══════════════════════════════════════════════════════════════
# YAHRIA KERNEL (Python port) — Canonical Domain Map & Dependency Graph
# Doc ID: YAHRIA-KRN-003-PY | Source: CANONICAL_INDEX.md + DEPENDENCY_GRAPH.md
# Port of: src/lib/yahria/domains.ts (YAHRIA-KRN-003)
# ═══════════════════════════════════════════════════════════════

from dataclasses import dataclass, field
from typing import Dict, List


@dataclass(frozen=True)
class DomainDef:
    code: str
    name: str
    purpose: str
    phase: int            # canonical implementation order (DEPENDENCY_GRAPH)
    isCore: bool          # cross-cutting authority
    subdomains: List[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "code": self.code,
            "name": self.name,
            "purpose": self.purpose,
            "phase": self.phase,
            "isCore": self.isCore,
            "subdomains": list(self.subdomains),
        }


DOMAINS: List[DomainDef] = [
    DomainDef("00", "Initialization & Constitution", "Identity and immutable architectural principles of YAHRIA", 0, True, ["Vision", "Mission", "Product Principles", "Constitution", "Global Invariants", "Architectural Principles", "Security Principles", "Definition of Done", "Canonical Vocabulary"]),
    DomainDef("01", "Foundation & Platform Core", "Common technical foundation for all other domains", 1, False, ["Monorepo", "Backend Foundation", "Frontend Foundation", "Database Foundation", "Configuration", "Dependencies", "Environments", "Feature Flags", "Shared Libraries"]),
    DomainDef("16", "Data & Persistence", "PostgreSQL architecture, schema strategy, RLS, tenant isolation", 2, True, ["PostgreSQL", "Schema Strategy", "SQLAlchemy", "Alembic", "RLS", "Tenant Isolation", "Index Strategy", "Partitioning", "JSONB", "Vector Storage", "Graph Storage", "Backup"]),
    DomainDef("02", "Identity & Organization", "Identities, authorization boundaries, organizational ownership", 3, False, ["Identity", "Authentication", "Authorization", "RBAC", "ABAC", "Organizations", "Tenants", "Teams", "Memberships", "Audit Identity"]),
    DomainDef("03", "Project & Workspace", "Projects, repositories, workspaces, source providers", 4, False, ["Projects", "Repositories", "Workspaces", "Branches", "Environments", "Source Providers", "Sync"]),
    DomainDef("04", "Code Genome & Knowledge Graph", "Code ingestion, symbols, graphs, embeddings, semantic retrieval", 5, False, ["Ingestion", "File Intelligence", "Symbols", "Dependency Graph", "Call Graph", "Type Graph", "Knowledge Graph", "Impact Analysis", "Embeddings", "Semantic Retrieval"]),
    DomainDef("05", "Agent Operating System", "Agent identity, registry, lifecycle, coordination, governance", 6, False, ["Identity", "Registry", "Capabilities", "Lifecycle", "Communication", "Context", "State", "Coordination", "Scheduling", "Routing", "Evaluation", "Governance"]),
    DomainDef("06", "Cognitive Core", "Intent, planning, reasoning, uncertainty, reflection, decisions", 7, False, ["Intent Understanding", "Goal Modeling", "World State", "Context Assembly", "Reasoning Interface", "Planning Engine", "Strategy Selection", "Uncertainty Engine", "Verification Planning", "Reflection", "Cognitive Routing", "Decision Engine", "Cognitive Safety"]),
    DomainDef("07", "Task Graph & Orchestration", "Goal decomposition, DAG engine, scheduling, compensation", 8, False, ["Task Model", "Goal Decomposition", "Task Graph", "DAG Engine", "Dependency Resolution", "Scheduling", "State Machine", "Retry", "Compensation", "Cancellation", "Governance"]),
    DomainDef("08", "Execution Fabric", "Execution lifecycle, context, persistence, workers, recovery", 9, False, ["Orchestrator", "State Machine", "Context", "Persistence", "Queue", "Worker", "Retry", "Timeout", "Cancellation", "Recovery"]),
    DomainDef("09", "Tool Registry Engine", "Tool definitions, contracts, capabilities, authorization", 10, False, ["Registry", "Definition", "Versioning", "Discovery", "Capability", "Contract", "Schema", "Validator", "Authorization", "Executor", "Governance"]),
    DomainDef("10", "Sandbox Engine", "Isolation: filesystem overlay, network, resources, process control", 11, False, ["Contract", "Security Profile", "Runtime Adapter", "Container", "Podman", "FS Overlay", "Workspace Isolation", "Network Isolation", "Egress Policy", "DNS Policy", "Resource Controller", "Limits", "Timeout"]),
    DomainDef("11", "Execution Observability", "Events, traces, metrics, evidence, replay, audit, forensics", 12, True, ["Events", "Traces", "Metrics", "Telemetry", "Logs", "Artifacts", "Evidence Engine", "Lineage Graph", "Replay", "Audit", "Forensics", "Retention"]),
    DomainDef("12", "Policy & Governance Control Plane", "Unified RBAC/ABAC, policy DSL, deterministic rules, enforcement", 13, True, ["RBAC", "ABAC", "Policy Model", "Policy DSL", "Rule Engine", "Simulator", "Policy-as-Code", "Versioning", "Signatures", "Propagation", "Decision", "Enforcement", "Cognitive Integration"]),
    DomainDef("13", "Memory System", "Working, episodic, semantic, procedural, architectural memory", 14, False, ["Architecture", "Working", "Episodic", "Semantic", "Procedural", "Architectural", "Candidates", "Validation", "Consolidation", "Graph", "Retrieval", "Governance", "Forgetting"]),
    DomainDef("14", "Learning Engine", "Reflection, pattern mining, failure/success intelligence", 15, False, ["Extraction", "Reflection", "Pattern Mining", "Failure Intelligence", "Success Intelligence", "Strategy Learning", "Validation", "Evidence"]),
    DomainDef("15", "Self-Evolution & Meta-Intelligence", "Controlled self-improvement under D.6.11 governance", 16, False, ["Meta-Intelligence", "Self-Assessment", "Strategy Optimization", "Agent Genome", "Workflow Evolution", "Prompt Evolution", "Model Routing Optimization", "Experimentation", "Benchmark", "Evolution Sandbox", "Governance", "Rollout", "Rollback"]),
    DomainDef("17", "API & Integration", "API gateway, REST, WebSocket, events, plugins, SDK", 17, False, ["Gateway", "REST", "WebSocket", "Internal API", "Event Bus", "Webhooks", "Plugins", "External Tools", "SDK"]),
    DomainDef("18", "Frontend & User Experience", "Web app, IDE interface, dashboards, consoles", 18, False, ["Web App", "IDE Interface", "Code Editor", "AI Chat", "Agent Dashboard", "Task Graph Visualization", "Execution Console", "Evidence Viewer", "Memory Explorer", "Policy Console", "Evolution Dashboard", "Administration"]),
    DomainDef("19", "Security", "Threat model, zero trust, secrets, supply chain, incidents", 19, True, ["Threat Model", "Zero Trust", "Secrets", "Encryption", "Key Management", "Supply Chain", "Sandbox Security", "Network Security", "Audit", "Incident Response"]),
    DomainDef("20", "Quality Engineering", "Test strategy, unit/integration/E2E, chaos, benchmarks", 20, True, ["Test Strategy", "Unit", "Integration", "Contract Tests", "E2E", "Security Tests", "Performance", "Chaos", "Regression", "Benchmarks", "Test Evidence"]),
    DomainDef("21", "DevOps & Delivery", "CI/CD, containers, artifacts, infrastructure, rollback", 21, False, ["Local Dev", "Docker", "Podman", "CI", "CD", "Build Pipeline", "Registry", "IaC", "Staging", "Production", "Rollback"]),
    DomainDef("22", "Operations", "Monitoring, alerting, incidents, SLO, capacity, DR", 22, False, ["Monitoring", "Alerting", "Incidents", "SLO/SLA", "Capacity", "Cost", "Backup Ops", "Disaster Recovery", "Runbooks"]),
    DomainDef("23", "Product Evolution & Roadmap", "MVP → Alpha → Beta → Enterprise progression", 23, False, ["MVP", "Alpha", "Beta", "Enterprise", "Scaling", "Plugin Ecosystem", "API Ecosystem", "Marketplace", "Long-Term Evolution"]),
]

# Dependency graph — FORBIDDEN dependencies (DEPENDENCY_GRAPH.md §28)
FORBIDDEN_DEPENDENCIES: List[dict] = [
    {"from": "Frontend", "to": "Database", "reason": "UI MUST NOT contain critical domain logic"},
    {"from": "Agent", "to": "Sandbox internals", "reason": "Agents consume sandbox contract only"},
    {"from": "Cognitive Core", "to": "specific LLM provider", "reason": "Model-agnostic reasoning interface"},
    {"from": "Memory", "to": "direct production mutation", "reason": "Memory is not automatic truth (INV-140)"},
    {"from": "Self-Evolution", "to": "direct production modification", "reason": "D.8 is governed by D.6.11"},
    {"from": "Tool", "to": "bypass Policy Engine", "reason": "REGISTERED ≠ AUTHORIZED (INV-062)"},
    {"from": "Sandbox", "to": "host trust", "reason": "Host protection (INV-050)"},
]

# Governance triptych
GOVERNANCE_PLANES: Dict[str, dict] = {
    "D6": {"name": "D.6 — Truth & Governance", "role": "Establishes what is TRUE: observability, evidence, policy enforcement. GOVERNS D.8."},
    "D7": {"name": "D.7 — Memory & Learning", "role": "Transforms verified experience into memory and learning. MEMORY ≠ POLICY."},
    "D8": {"name": "D.8 — Self-Evolution", "role": "Proposes how to improve. NEVER self-modifies without D.6.11 approval."},
}


def domain_by_code(code: str) -> DomainDef:
    for d in DOMAINS:
        if d.code == code:
            return d
    raise KeyError(f"Unknown domain code: {code}")


def canonical_phase_order() -> List[DomainDef]:
    """Domains in canonical implementation order (phase ascending)."""
    return sorted(DOMAINS, key=lambda d: d.phase)
