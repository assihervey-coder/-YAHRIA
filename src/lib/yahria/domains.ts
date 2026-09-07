// ═══════════════════════════════════════════════════════════════
// YAHRIA KERNEL — Canonical Domain Map & Dependency Graph
// Doc ID: YAHRIA-KRN-003 | Source: CANONICAL_INDEX.md + DEPENDENCY_GRAPH.md
// ═══════════════════════════════════════════════════════════════

export interface DomainDef {
  code: string;
  name: string;
  purpose: string;
  phase: number;          // canonical implementation order (DEPENDENCY_GRAPH)
  isCore: boolean;        // cross-cutting authority
  subdomains: string[];
}

export const DOMAINS: DomainDef[] = [
  { code: '00', name: 'Initialization & Constitution', purpose: 'Identity and immutable architectural principles of YAHRIA', phase: 0, isCore: true, subdomains: ['Vision', 'Mission', 'Product Principles', 'Constitution', 'Global Invariants', 'Architectural Principles', 'Security Principles', 'Definition of Done', 'Canonical Vocabulary'] },
  { code: '01', name: 'Foundation & Platform Core', purpose: 'Common technical foundation for all other domains', phase: 1, isCore: false, subdomains: ['Monorepo', 'Backend Foundation', 'Frontend Foundation', 'Database Foundation', 'Configuration', 'Dependencies', 'Environments', 'Feature Flags', 'Shared Libraries'] },
  { code: '16', name: 'Data & Persistence', purpose: 'PostgreSQL architecture, schema strategy, RLS, tenant isolation', phase: 2, isCore: true, subdomains: ['PostgreSQL', 'Schema Strategy', 'SQLAlchemy', 'Alembic', 'RLS', 'Tenant Isolation', 'Index Strategy', 'Partitioning', 'JSONB', 'Vector Storage', 'Graph Storage', 'Backup'] },
  { code: '02', name: 'Identity & Organization', purpose: 'Identities, authorization boundaries, organizational ownership', phase: 3, isCore: false, subdomains: ['Identity', 'Authentication', 'Authorization', 'RBAC', 'ABAC', 'Organizations', 'Tenants', 'Teams', 'Memberships', 'Audit Identity'] },
  { code: '03', name: 'Project & Workspace', purpose: 'Projects, repositories, workspaces, source providers', phase: 4, isCore: false, subdomains: ['Projects', 'Repositories', 'Workspaces', 'Branches', 'Environments', 'Source Providers', 'Sync'] },
  { code: '04', name: 'Code Genome & Knowledge Graph', purpose: 'Code ingestion, symbols, graphs, embeddings, semantic retrieval', phase: 5, isCore: false, subdomains: ['Ingestion', 'File Intelligence', 'Symbols', 'Dependency Graph', 'Call Graph', 'Type Graph', 'Knowledge Graph', 'Impact Analysis', 'Embeddings', 'Semantic Retrieval'] },
  { code: '05', name: 'Agent Operating System', purpose: 'Agent identity, registry, lifecycle, coordination, governance', phase: 6, isCore: false, subdomains: ['Identity', 'Registry', 'Capabilities', 'Lifecycle', 'Communication', 'Context', 'State', 'Coordination', 'Scheduling', 'Routing', 'Evaluation', 'Governance'] },
  { code: '06', name: 'Cognitive Core', purpose: 'Intent, planning, reasoning, uncertainty, reflection, decisions', phase: 7, isCore: false, subdomains: ['Intent Understanding', 'Goal Modeling', 'World State', 'Context Assembly', 'Reasoning Interface', 'Planning Engine', 'Strategy Selection', 'Uncertainty Engine', 'Verification Planning', 'Reflection', 'Cognitive Routing', 'Decision Engine', 'Cognitive Safety'] },
  { code: '07', name: 'Task Graph & Orchestration', purpose: 'Goal decomposition, DAG engine, scheduling, compensation', phase: 8, isCore: false, subdomains: ['Task Model', 'Goal Decomposition', 'Task Graph', 'DAG Engine', 'Dependency Resolution', 'Scheduling', 'State Machine', 'Retry', 'Compensation', 'Cancellation', 'Governance'] },
  { code: '08', name: 'Execution Fabric', purpose: 'Execution lifecycle, context, persistence, workers, recovery', phase: 9, isCore: false, subdomains: ['Orchestrator', 'State Machine', 'Context', 'Persistence', 'Queue', 'Worker', 'Retry', 'Timeout', 'Cancellation', 'Recovery'] },
  { code: '09', name: 'Tool Registry Engine', purpose: 'Tool definitions, contracts, capabilities, authorization', phase: 10, isCore: false, subdomains: ['Registry', 'Definition', 'Versioning', 'Discovery', 'Capability', 'Contract', 'Schema', 'Validator', 'Authorization', 'Executor', 'Governance'] },
  { code: '10', name: 'Sandbox Engine', purpose: 'Isolation: filesystem overlay, network, resources, process control', phase: 11, isCore: false, subdomains: ['Contract', 'Security Profile', 'Runtime Adapter', 'Container', 'Podman', 'FS Overlay', 'Workspace Isolation', 'Network Isolation', 'Egress Policy', 'DNS Policy', 'Resource Controller', 'Limits', 'Timeout'] },
  { code: '11', name: 'Execution Observability', purpose: 'Events, traces, metrics, evidence, replay, audit, forensics', phase: 12, isCore: true, subdomains: ['Events', 'Traces', 'Metrics', 'Telemetry', 'Logs', 'Artifacts', 'Evidence Engine', 'Lineage Graph', 'Replay', 'Audit', 'Forensics', 'Retention'] },
  { code: '12', name: 'Policy & Governance Control Plane', purpose: 'Unified RBAC/ABAC, policy DSL, deterministic rules, enforcement', phase: 13, isCore: true, subdomains: ['RBAC', 'ABAC', 'Policy Model', 'Policy DSL', 'Rule Engine', 'Simulator', 'Policy-as-Code', 'Versioning', 'Signatures', 'Propagation', 'Decision', 'Enforcement', 'Cognitive Integration'] },
  { code: '13', name: 'Memory System', purpose: 'Working, episodic, semantic, procedural, architectural memory', phase: 14, isCore: false, subdomains: ['Architecture', 'Working', 'Episodic', 'Semantic', 'Procedural', 'Architectural', 'Candidates', 'Validation', 'Consolidation', 'Graph', 'Retrieval', 'Governance', 'Forgetting'] },
  { code: '14', name: 'Learning Engine', purpose: 'Reflection, pattern mining, failure/success intelligence', phase: 15, isCore: false, subdomains: ['Extraction', 'Reflection', 'Pattern Mining', 'Failure Intelligence', 'Success Intelligence', 'Strategy Learning', 'Validation', 'Evidence'] },
  { code: '15', name: 'Self-Evolution & Meta-Intelligence', purpose: 'Controlled self-improvement under D.6.11 governance', phase: 16, isCore: false, subdomains: ['Meta-Intelligence', 'Self-Assessment', 'Strategy Optimization', 'Agent Genome', 'Workflow Evolution', 'Prompt Evolution', 'Model Routing Optimization', 'Experimentation', 'Benchmark', 'Evolution Sandbox', 'Governance', 'Rollout', 'Rollback'] },
  { code: '17', name: 'API & Integration', purpose: 'API gateway, REST, WebSocket, events, plugins, SDK', phase: 17, isCore: false, subdomains: ['Gateway', 'REST', 'WebSocket', 'Internal API', 'Event Bus', 'Webhooks', 'Plugins', 'External Tools', 'SDK'] },
  { code: '18', name: 'Frontend & User Experience', purpose: 'Web app, IDE interface, dashboards, consoles', phase: 18, isCore: false, subdomains: ['Web App', 'IDE Interface', 'Code Editor', 'AI Chat', 'Agent Dashboard', 'Task Graph Visualization', 'Execution Console', 'Evidence Viewer', 'Memory Explorer', 'Policy Console', 'Evolution Dashboard', 'Administration'] },
  { code: '19', name: 'Security', purpose: 'Threat model, zero trust, secrets, supply chain, incidents', phase: 19, isCore: true, subdomains: ['Threat Model', 'Zero Trust', 'Secrets', 'Encryption', 'Key Management', 'Supply Chain', 'Sandbox Security', 'Network Security', 'Audit', 'Incident Response'] },
  { code: '20', name: 'Quality Engineering', purpose: 'Test strategy, unit/integration/E2E, chaos, benchmarks', phase: 20, isCore: true, subdomains: ['Test Strategy', 'Unit', 'Integration', 'Contract Tests', 'E2E', 'Security Tests', 'Performance', 'Chaos', 'Regression', 'Benchmarks', 'Test Evidence'] },
  { code: '21', name: 'DevOps & Delivery', purpose: 'CI/CD, containers, artifacts, infrastructure, rollback', phase: 21, isCore: false, subdomains: ['Local Dev', 'Docker', 'Podman', 'CI', 'CD', 'Build Pipeline', 'Registry', 'IaC', 'Staging', 'Production', 'Rollback'] },
  { code: '22', name: 'Operations', purpose: 'Monitoring, alerting, incidents, SLO, capacity, DR', phase: 22, isCore: false, subdomains: ['Monitoring', 'Alerting', 'Incidents', 'SLO/SLA', 'Capacity', 'Cost', 'Backup Ops', 'Disaster Recovery', 'Runbooks'] },
  { code: '23', name: 'Product Evolution & Roadmap', purpose: 'MVP → Alpha → Beta → Enterprise progression', phase: 23, isCore: false, subdomains: ['MVP', 'Alpha', 'Beta', 'Enterprise', 'Scaling', 'Plugin Ecosystem', 'API Ecosystem', 'Marketplace', 'Long-Term Evolution'] },
];

// ── ACTIVATION LEDGER — statuts fondés sur PREUVES (UNKNOWN ≠ SUCCESS) ──
// Un domaine entre ici UNIQUEMENT lorsque son implémentation existe dans le
// noyau ET qu'une preuve vérifiable est archivée (tests, runs LIVE_PROVED,
// parité, spécification publiée). Le bootstrap applique l'activation de façon
// MONOTONE : NOT_STARTED → IMPLEMENTING, jamais l'inverse (rétrogradation ou
// clôture DONE exigent une décision gouvernée D.6 avec preuves).
export interface DomainActivation {
  code: string;
  since: string;      // date d'activation (preuve archivée)
  evidence: string[]; // artefacts de preuve : modules noyau, runs, specs
}

export const DOMAIN_ACTIVATIONS: DomainActivation[] = [
  {
    code: '08',
    since: '2026-09-07',
    evidence: [
      'sandbox-executor.ts (YAHRIA-KRN-024) — install → syntaxe → build → launch → sondes HTTP, recettes fixes 12 stacks (INV-042, INV-190)',
      'live-proof.ts — boucle gouvernée SEALED → LIVE_PROVED, budget 3 tentatives / 15 min, diagnostic du fichier fautif + self-heal borné (INV-210, INV-211)',
      'Preuves LIVE archivées : RUN-000009 FastAPI HTTP 200 réel ; RUN-000013 (C), RUN-000014 (C++), RUN-000015 (Fortran), RUN-000017 (C#) — LIVE_PROVED, marqueur YAHRIA-LINK-OK',
      'Spec publique : public/docs/SANDBOX_EXECUTION_SPECIFICATION.md v1.1.0',
    ],
  },
  {
    code: '09',
    since: '2026-09-07',
    evidence: [
      'tool-registry.ts (YAHRIA-KRN-025) — registre versionné (semver monotone, downgrades refusés INV-190), contrats JSON stricts validés S1 (champs non déclarés rejetés)',
      'Grille d\u2019autorisation vivante (INV-062) : POL-011 ALLOW readonly.*, POL-012 DENY sideeffect.*, POL-006 REQUIRE_APPROVAL unregistered.* ; autorisations gouvernées POL-AUTH-* révocables',
      'tool-executor.ts (YAHRIA-KRN-026) — exécuteur borné outils (INV-042 timeout, INV-213 env scrubé, argv whitelisté uniquement)',
      'Suite de preuves scripts/r12-tool-registry-tests.ts : 22/22 PASS — refus tracés (PolicyDecision), preuves TOOL scellées (chaîne SHA-256), pas de faux succès (INV-210)',
      'API /api/yahria/tools (register/discover/invoke/authorize) + panneau UI « Registre des outils » (13e onglet) avec démonstrateur INV-062',
    ],
  },
  {
    code: '10',
    since: '2026-09-07',
    evidence: [
      'Backend process : env enfant scrubé (INV-213), timeouts par étape (INV-042), ports bornés 3910+, kill de groupe SIGTERM→SIGKILL, cwd confinement workspace',
      'Backend conteneur durci (INV-215) : --network none, rootfs read-only, cap-drop ALL, no-new-privileges, cpu/mem/pids bornés — YAHRIA_SANDBOX_BACKEND=docker',
      'Assets conteneur : docker/sandbox.Dockerfile (Ubuntu 24.04 non-root, 12 toolchains : gcc/g++/gfortran/python3/node/bun/go/rust/java/dotnet/mono)',
      'Frontière honnête (INV-210) : démon Docker absent sur l hôte de preuve — backend conteneur branché et gardé, exécution conteneur non démontrée ici',
    ],
  },
];

// Dependency graph — FORBIDDEN dependencies (DEPENDENCY_GRAPH.md §28)
export const FORBIDDEN_DEPENDENCIES: { from: string; to: string; reason: string }[] = [
  { from: 'Frontend', to: 'Database', reason: 'UI MUST NOT contain critical domain logic' },
  { from: 'Agent', to: 'Sandbox internals', reason: 'Agents consume sandbox contract only' },
  { from: 'Cognitive Core', to: 'specific LLM provider', reason: 'Model-agnostic reasoning interface' },
  { from: 'Memory', to: 'direct production mutation', reason: 'Memory is not automatic truth (INV-140)' },
  { from: 'Self-Evolution', to: 'direct production modification', reason: 'D.8 is governed by D.6.11' },
  { from: 'Tool', to: 'bypass Policy Engine', reason: 'REGISTERED ≠ AUTHORIZED (INV-062)' },
  { from: 'Sandbox', to: 'host trust', reason: 'Host protection (INV-050)' },
];

// Governance triptych
export const GOVERNANCE_PLANES = {
  D6: { name: 'D.6 — Truth & Governance', role: 'Establishes what is TRUE: observability, evidence, policy enforcement. GOVERNS D.8.' },
  D7: { name: 'D.7 — Memory & Learning', role: 'Transforms verified experience into memory and learning. MEMORY ≠ POLICY.' },
  D8: { name: 'D.8 — Self-Evolution', role: 'Proposes how to improve. NEVER self-modifies without D.6.11 approval.' },
};
