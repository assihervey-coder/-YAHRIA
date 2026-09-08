module.exports = [
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[project]/src/lib/db.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "db",
    ()=>db
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$prisma$2f$client$29$__ = __turbopack_context__.i("[externals]/@prisma/client [external] (@prisma/client, cjs, [project]/node_modules/@prisma/client)");
;
const globalForPrisma = globalThis;
const db = globalForPrisma.prisma ?? new __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$prisma$2f$client$29$__["PrismaClient"]({
    log: [
        'query'
    ]
});
if ("TURBOPACK compile-time truthy", 1) globalForPrisma.prisma = db;
}),
"[project]/src/lib/yahria/domains.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// ═══════════════════════════════════════════════════════════════
// YAHRIA KERNEL — Canonical Domain Map & Dependency Graph
// Doc ID: YAHRIA-KRN-003 | Source: CANONICAL_INDEX.md + DEPENDENCY_GRAPH.md
// ═══════════════════════════════════════════════════════════════
__turbopack_context__.s([
    "DOMAINS",
    ()=>DOMAINS,
    "FORBIDDEN_DEPENDENCIES",
    ()=>FORBIDDEN_DEPENDENCIES,
    "GOVERNANCE_PLANES",
    ()=>GOVERNANCE_PLANES
]);
const DOMAINS = [
    {
        code: '00',
        name: 'Initialization & Constitution',
        purpose: 'Identity and immutable architectural principles of YAHRIA',
        phase: 0,
        isCore: true,
        subdomains: [
            'Vision',
            'Mission',
            'Product Principles',
            'Constitution',
            'Global Invariants',
            'Architectural Principles',
            'Security Principles',
            'Definition of Done',
            'Canonical Vocabulary'
        ]
    },
    {
        code: '01',
        name: 'Foundation & Platform Core',
        purpose: 'Common technical foundation for all other domains',
        phase: 1,
        isCore: false,
        subdomains: [
            'Monorepo',
            'Backend Foundation',
            'Frontend Foundation',
            'Database Foundation',
            'Configuration',
            'Dependencies',
            'Environments',
            'Feature Flags',
            'Shared Libraries'
        ]
    },
    {
        code: '16',
        name: 'Data & Persistence',
        purpose: 'PostgreSQL architecture, schema strategy, RLS, tenant isolation',
        phase: 2,
        isCore: true,
        subdomains: [
            'PostgreSQL',
            'Schema Strategy',
            'SQLAlchemy',
            'Alembic',
            'RLS',
            'Tenant Isolation',
            'Index Strategy',
            'Partitioning',
            'JSONB',
            'Vector Storage',
            'Graph Storage',
            'Backup'
        ]
    },
    {
        code: '02',
        name: 'Identity & Organization',
        purpose: 'Identities, authorization boundaries, organizational ownership',
        phase: 3,
        isCore: false,
        subdomains: [
            'Identity',
            'Authentication',
            'Authorization',
            'RBAC',
            'ABAC',
            'Organizations',
            'Tenants',
            'Teams',
            'Memberships',
            'Audit Identity'
        ]
    },
    {
        code: '03',
        name: 'Project & Workspace',
        purpose: 'Projects, repositories, workspaces, source providers',
        phase: 4,
        isCore: false,
        subdomains: [
            'Projects',
            'Repositories',
            'Workspaces',
            'Branches',
            'Environments',
            'Source Providers',
            'Sync'
        ]
    },
    {
        code: '04',
        name: 'Code Genome & Knowledge Graph',
        purpose: 'Code ingestion, symbols, graphs, embeddings, semantic retrieval',
        phase: 5,
        isCore: false,
        subdomains: [
            'Ingestion',
            'File Intelligence',
            'Symbols',
            'Dependency Graph',
            'Call Graph',
            'Type Graph',
            'Knowledge Graph',
            'Impact Analysis',
            'Embeddings',
            'Semantic Retrieval'
        ]
    },
    {
        code: '05',
        name: 'Agent Operating System',
        purpose: 'Agent identity, registry, lifecycle, coordination, governance',
        phase: 6,
        isCore: false,
        subdomains: [
            'Identity',
            'Registry',
            'Capabilities',
            'Lifecycle',
            'Communication',
            'Context',
            'State',
            'Coordination',
            'Scheduling',
            'Routing',
            'Evaluation',
            'Governance'
        ]
    },
    {
        code: '06',
        name: 'Cognitive Core',
        purpose: 'Intent, planning, reasoning, uncertainty, reflection, decisions',
        phase: 7,
        isCore: false,
        subdomains: [
            'Intent Understanding',
            'Goal Modeling',
            'World State',
            'Context Assembly',
            'Reasoning Interface',
            'Planning Engine',
            'Strategy Selection',
            'Uncertainty Engine',
            'Verification Planning',
            'Reflection',
            'Cognitive Routing',
            'Decision Engine',
            'Cognitive Safety'
        ]
    },
    {
        code: '07',
        name: 'Task Graph & Orchestration',
        purpose: 'Goal decomposition, DAG engine, scheduling, compensation',
        phase: 8,
        isCore: false,
        subdomains: [
            'Task Model',
            'Goal Decomposition',
            'Task Graph',
            'DAG Engine',
            'Dependency Resolution',
            'Scheduling',
            'State Machine',
            'Retry',
            'Compensation',
            'Cancellation',
            'Governance'
        ]
    },
    {
        code: '08',
        name: 'Execution Fabric',
        purpose: 'Execution lifecycle, context, persistence, workers, recovery',
        phase: 9,
        isCore: false,
        subdomains: [
            'Orchestrator',
            'State Machine',
            'Context',
            'Persistence',
            'Queue',
            'Worker',
            'Retry',
            'Timeout',
            'Cancellation',
            'Recovery'
        ]
    },
    {
        code: '09',
        name: 'Tool Registry Engine',
        purpose: 'Tool definitions, contracts, capabilities, authorization',
        phase: 10,
        isCore: false,
        subdomains: [
            'Registry',
            'Definition',
            'Versioning',
            'Discovery',
            'Capability',
            'Contract',
            'Schema',
            'Validator',
            'Authorization',
            'Executor',
            'Governance'
        ]
    },
    {
        code: '10',
        name: 'Sandbox Engine',
        purpose: 'Isolation: filesystem overlay, network, resources, process control',
        phase: 11,
        isCore: false,
        subdomains: [
            'Contract',
            'Security Profile',
            'Runtime Adapter',
            'Container',
            'Podman',
            'FS Overlay',
            'Workspace Isolation',
            'Network Isolation',
            'Egress Policy',
            'DNS Policy',
            'Resource Controller',
            'Limits',
            'Timeout'
        ]
    },
    {
        code: '11',
        name: 'Execution Observability',
        purpose: 'Events, traces, metrics, evidence, replay, audit, forensics',
        phase: 12,
        isCore: true,
        subdomains: [
            'Events',
            'Traces',
            'Metrics',
            'Telemetry',
            'Logs',
            'Artifacts',
            'Evidence Engine',
            'Lineage Graph',
            'Replay',
            'Audit',
            'Forensics',
            'Retention'
        ]
    },
    {
        code: '12',
        name: 'Policy & Governance Control Plane',
        purpose: 'Unified RBAC/ABAC, policy DSL, deterministic rules, enforcement',
        phase: 13,
        isCore: true,
        subdomains: [
            'RBAC',
            'ABAC',
            'Policy Model',
            'Policy DSL',
            'Rule Engine',
            'Simulator',
            'Policy-as-Code',
            'Versioning',
            'Signatures',
            'Propagation',
            'Decision',
            'Enforcement',
            'Cognitive Integration'
        ]
    },
    {
        code: '13',
        name: 'Memory System',
        purpose: 'Working, episodic, semantic, procedural, architectural memory',
        phase: 14,
        isCore: false,
        subdomains: [
            'Architecture',
            'Working',
            'Episodic',
            'Semantic',
            'Procedural',
            'Architectural',
            'Candidates',
            'Validation',
            'Consolidation',
            'Graph',
            'Retrieval',
            'Governance',
            'Forgetting'
        ]
    },
    {
        code: '14',
        name: 'Learning Engine',
        purpose: 'Reflection, pattern mining, failure/success intelligence',
        phase: 15,
        isCore: false,
        subdomains: [
            'Extraction',
            'Reflection',
            'Pattern Mining',
            'Failure Intelligence',
            'Success Intelligence',
            'Strategy Learning',
            'Validation',
            'Evidence'
        ]
    },
    {
        code: '15',
        name: 'Self-Evolution & Meta-Intelligence',
        purpose: 'Controlled self-improvement under D.6.11 governance',
        phase: 16,
        isCore: false,
        subdomains: [
            'Meta-Intelligence',
            'Self-Assessment',
            'Strategy Optimization',
            'Agent Genome',
            'Workflow Evolution',
            'Prompt Evolution',
            'Model Routing Optimization',
            'Experimentation',
            'Benchmark',
            'Evolution Sandbox',
            'Governance',
            'Rollout',
            'Rollback'
        ]
    },
    {
        code: '17',
        name: 'API & Integration',
        purpose: 'API gateway, REST, WebSocket, events, plugins, SDK',
        phase: 17,
        isCore: false,
        subdomains: [
            'Gateway',
            'REST',
            'WebSocket',
            'Internal API',
            'Event Bus',
            'Webhooks',
            'Plugins',
            'External Tools',
            'SDK'
        ]
    },
    {
        code: '18',
        name: 'Frontend & User Experience',
        purpose: 'Web app, IDE interface, dashboards, consoles',
        phase: 18,
        isCore: false,
        subdomains: [
            'Web App',
            'IDE Interface',
            'Code Editor',
            'AI Chat',
            'Agent Dashboard',
            'Task Graph Visualization',
            'Execution Console',
            'Evidence Viewer',
            'Memory Explorer',
            'Policy Console',
            'Evolution Dashboard',
            'Administration'
        ]
    },
    {
        code: '19',
        name: 'Security',
        purpose: 'Threat model, zero trust, secrets, supply chain, incidents',
        phase: 19,
        isCore: true,
        subdomains: [
            'Threat Model',
            'Zero Trust',
            'Secrets',
            'Encryption',
            'Key Management',
            'Supply Chain',
            'Sandbox Security',
            'Network Security',
            'Audit',
            'Incident Response'
        ]
    },
    {
        code: '20',
        name: 'Quality Engineering',
        purpose: 'Test strategy, unit/integration/E2E, chaos, benchmarks',
        phase: 20,
        isCore: true,
        subdomains: [
            'Test Strategy',
            'Unit',
            'Integration',
            'Contract Tests',
            'E2E',
            'Security Tests',
            'Performance',
            'Chaos',
            'Regression',
            'Benchmarks',
            'Test Evidence'
        ]
    },
    {
        code: '21',
        name: 'DevOps & Delivery',
        purpose: 'CI/CD, containers, artifacts, infrastructure, rollback',
        phase: 21,
        isCore: false,
        subdomains: [
            'Local Dev',
            'Docker',
            'Podman',
            'CI',
            'CD',
            'Build Pipeline',
            'Registry',
            'IaC',
            'Staging',
            'Production',
            'Rollback'
        ]
    },
    {
        code: '22',
        name: 'Operations',
        purpose: 'Monitoring, alerting, incidents, SLO, capacity, DR',
        phase: 22,
        isCore: false,
        subdomains: [
            'Monitoring',
            'Alerting',
            'Incidents',
            'SLO/SLA',
            'Capacity',
            'Cost',
            'Backup Ops',
            'Disaster Recovery',
            'Runbooks'
        ]
    },
    {
        code: '23',
        name: 'Product Evolution & Roadmap',
        purpose: 'MVP → Alpha → Beta → Enterprise progression',
        phase: 23,
        isCore: false,
        subdomains: [
            'MVP',
            'Alpha',
            'Beta',
            'Enterprise',
            'Scaling',
            'Plugin Ecosystem',
            'API Ecosystem',
            'Marketplace',
            'Long-Term Evolution'
        ]
    }
];
const FORBIDDEN_DEPENDENCIES = [
    {
        from: 'Frontend',
        to: 'Database',
        reason: 'UI MUST NOT contain critical domain logic'
    },
    {
        from: 'Agent',
        to: 'Sandbox internals',
        reason: 'Agents consume sandbox contract only'
    },
    {
        from: 'Cognitive Core',
        to: 'specific LLM provider',
        reason: 'Model-agnostic reasoning interface'
    },
    {
        from: 'Memory',
        to: 'direct production mutation',
        reason: 'Memory is not automatic truth (INV-140)'
    },
    {
        from: 'Self-Evolution',
        to: 'direct production modification',
        reason: 'D.8 is governed by D.6.11'
    },
    {
        from: 'Tool',
        to: 'bypass Policy Engine',
        reason: 'REGISTERED ≠ AUTHORIZED (INV-062)'
    },
    {
        from: 'Sandbox',
        to: 'host trust',
        reason: 'Host protection (INV-050)'
    }
];
const GOVERNANCE_PLANES = {
    D6: {
        name: 'D.6 — Truth & Governance',
        role: 'Establishes what is TRUE: observability, evidence, policy enforcement. GOVERNS D.8.'
    },
    D7: {
        name: 'D.7 — Memory & Learning',
        role: 'Transforms verified experience into memory and learning. MEMORY ≠ POLICY.'
    },
    D8: {
        name: 'D.8 — Self-Evolution',
        role: 'Proposes how to improve. NEVER self-modifies without D.6.11 approval.'
    }
};
}),
"[project]/src/lib/yahria/agent-os.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// ═══════════════════════════════════════════════════════════════
// YAHRIA KERNEL — Agent Operating System (Domain 05)
// Doc ID: YAHRIA-KRN-007 | Invariants: INV-070..073, INV-011, INV-012
// Agent flow: INTENT → CAPABILITY CHECK → POLICY CHECK → EXECUTION
// ═══════════════════════════════════════════════════════════════
__turbopack_context__.s([
    "BOOTSTRAP_SEQUENCE",
    ()=>BOOTSTRAP_SEQUENCE,
    "CANONICAL_AGENTS",
    ()=>CANONICAL_AGENTS,
    "IMPLEMENTATION_LOOP",
    ()=>IMPLEMENTATION_LOOP,
    "checkCapability",
    ()=>checkCapability,
    "getAgent",
    ()=>getAgent
]);
const CANONICAL_AGENTS = [
    {
        key: 'explorer',
        name: 'Explorer',
        role: 'Perception engine — assembles WorldState from repository, symbols, errors, tests',
        capabilities: [
            'repo.read',
            'genome.query',
            'graph.traverse'
        ],
        autonomy: 'GOVERNED',
        domain: '05/06'
    },
    {
        key: 'architect',
        name: 'Architect',
        role: 'Designs solutions respecting domain boundaries and invariants',
        capabilities: [
            'genome.query',
            'adr.read',
            'design.propose'
        ],
        autonomy: 'GOVERNED',
        domain: '06'
    },
    {
        key: 'planner',
        name: 'Planner',
        role: 'Decomposes goals into task graphs with dependency resolution',
        capabilities: [
            'task.create',
            'task.decompose',
            'graph.read'
        ],
        autonomy: 'GOVERNED',
        domain: '07'
    },
    {
        key: 'coder',
        name: 'Coder',
        role: 'Implements changes inside sandbox overlay only',
        capabilities: [
            'fs.overlay.write',
            'tool.execute',
            'genome.query'
        ],
        autonomy: 'GOVERNED',
        domain: '08'
    },
    {
        key: 'debugger',
        name: 'Debugger',
        role: 'Root-cause analysis on failure events, proposes smallest safe correction',
        capabilities: [
            'evidence.query',
            'execution.replay',
            'fs.overlay.write'
        ],
        autonomy: 'GOVERNED',
        domain: '08/22'
    },
    {
        key: 'tester',
        name: 'Tester',
        role: 'Runs verification suites, produces test evidence',
        capabilities: [
            'execution.run',
            'evidence.capture'
        ],
        autonomy: 'GOVERNED',
        domain: '20'
    },
    {
        key: 'reviewer',
        name: 'Reviewer',
        role: 'Independent code review against invariants and ADRs',
        capabilities: [
            'fs.read',
            'genome.query',
            'invariant.check'
        ],
        autonomy: 'SUPERVISED',
        domain: '20'
    },
    {
        key: 'security',
        name: 'Security',
        role: 'Zero-trust review: secrets, boundaries, policy compliance',
        capabilities: [
            'policy.evaluate',
            'fs.read',
            'evidence.query'
        ],
        autonomy: 'RESTRICTED',
        domain: '19/12'
    },
    {
        key: 'verifier',
        name: 'Verifier',
        role: 'Independent verdict — generator ≠ verifier separation',
        capabilities: [
            'evidence.capture',
            'evidence.verify',
            'acceptance.evaluate'
        ],
        autonomy: 'RESTRICTED',
        domain: '11/20'
    }
];
function getAgent(key) {
    return CANONICAL_AGENTS.find((a)=>a.key === key);
}
function checkCapability(agent, requiredCapability) {
    const exact = agent.capabilities.includes(requiredCapability);
    const wildcard = agent.capabilities.some((c)=>c.endsWith('.*') && requiredCapability.startsWith(c.slice(0, -1)));
    if (exact || wildcard) return {
        ok: true,
        reason: `Capability '${requiredCapability}' authorized for ${agent.key} (INV-071)`
    };
    return {
        ok: false,
        reason: `Capability boundary violation: ${agent.key} lacks '${requiredCapability}' (INV-071). BLOCKED — not guessed.`
    };
}
const IMPLEMENTATION_LOOP = [
    'READ',
    'UNDERSTAND',
    'MAP OWNERSHIP',
    'RESOLVE DEPENDENCIES',
    'PLAN',
    'IMPLEMENT',
    'TEST',
    'VERIFY',
    'REVIEW',
    'CAPTURE EVIDENCE',
    'UPDATE STATUS',
    'COMPLETE OR STOP'
];
const BOOTSTRAP_SEQUENCE = [
    {
        step: '00',
        doc: '00_AUTONOMOUS_CODING_CONTRACT.md'
    },
    {
        step: '01',
        doc: 'CANONICAL_INDEX.md'
    },
    {
        step: '02',
        doc: 'DEPENDENCY_GRAPH.md'
    },
    {
        step: '03',
        doc: 'GLOBAL_INVARIANTS.md'
    },
    {
        step: '04',
        doc: 'ARCHITECTURE_DECISIONS.md'
    },
    {
        step: '05',
        action: 'IDENTIFY current implementation phase'
    },
    {
        step: '06',
        action: 'RESOLVE required dependencies'
    },
    {
        step: '07',
        doc: 'RELEVANT DOMAIN SPECIFICATIONS'
    },
    {
        step: '08',
        action: 'GENERATE implementation plan'
    },
    {
        step: '09',
        action: 'IMPLEMENT'
    },
    {
        step: '10',
        action: 'TEST'
    },
    {
        step: '11',
        action: 'VERIFY'
    },
    {
        step: '12',
        action: 'CAPTURE EVIDENCE'
    },
    {
        step: '13',
        action: 'PROMOTE OR STOP'
    }
];
}),
"[project]/src/lib/yahria/policy-engine.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// ═══════════════════════════════════════════════════════════════
// YAHRIA KERNEL — Policy Control Plane (Domain 12)
// Doc ID: YAHRIA-KRN-004 | Invariants: INV-120, INV-121, INV-122, INV-123, INV-133
// Precedence: POLICY DENY > MODEL > AGENT > TOOL > LOCAL CONVENIENCE
// ═══════════════════════════════════════════════════════════════
__turbopack_context__.s([
    "DEFAULT_EFFECT",
    ()=>DEFAULT_EFFECT,
    "DEFAULT_REASON",
    ()=>DEFAULT_REASON,
    "SEED_POLICY_RULES",
    ()=>SEED_POLICY_RULES,
    "evaluatePolicy",
    ()=>evaluatePolicy
]);
const SEED_POLICY_RULES = [
    {
        ruleId: 'POL-001',
        name: 'Host secrets are never readable',
        effect: 'DENY',
        scope: 'FILESYSTEM',
        action: 'filesystem.read',
        resource: 'host.secrets',
        priority: 1,
        reason: 'INV-053: sandboxed execution MUST NOT access credentials or production secrets',
        version: '1.0.0'
    },
    {
        ruleId: 'POL-002',
        name: 'Host workspace never mounted RW',
        effect: 'DENY',
        scope: 'FILESYSTEM',
        action: 'filesystem.write',
        resource: 'host.workspace',
        priority: 1,
        reason: 'FS-001: host workspace never mounted RW into agent container',
        version: '1.0.0'
    },
    {
        ruleId: 'POL-003',
        name: 'No direct network egress from sandbox',
        effect: 'DENY',
        scope: 'NETWORK',
        action: 'network.egress',
        resource: '*',
        priority: 2,
        reason: 'INV-051: network isolation explicit; egress requires explicit policy',
        version: '1.0.0'
    },
    {
        ruleId: 'POL-004',
        name: 'Self-evolution cannot promote directly',
        effect: 'DENY',
        scope: 'EVOLUTION',
        action: 'evolution.promote',
        resource: 'production',
        priority: 1,
        reason: 'INV-160/161/162: D.8 governed by D.6.11 — experiment, benchmark, approve first',
        version: '1.0.0'
    },
    {
        ruleId: 'POL-005',
        name: 'Constitutional amendment is human-only',
        effect: 'DENY',
        scope: 'EVOLUTION',
        action: 'constitution.amend',
        resource: '*',
        priority: 1,
        reason: 'Global invariants evolve only through constitutional amendment',
        version: '1.0.0'
    },
    {
        ruleId: 'POL-006',
        name: 'Tool execution requires registration + authorization',
        effect: 'REQUIRE_APPROVAL',
        scope: 'TOOL',
        action: 'tool.execute',
        resource: 'unregistered.*',
        priority: 3,
        reason: 'INV-062: REGISTERED ≠ AUTHORIZED',
        version: '1.0.0'
    },
    {
        ruleId: 'POL-007',
        name: 'Sandboxed file writes allowed in overlay only',
        effect: 'ALLOW',
        scope: 'FILESYSTEM',
        action: 'filesystem.write',
        resource: 'workspace.overlay',
        priority: 10,
        reason: 'OverlayFS upper layer is the isolated RW surface',
        version: '1.0.0'
    },
    {
        ruleId: 'POL-008',
        name: 'Read-only inspection of workspace allowed',
        effect: 'ALLOW',
        scope: 'FILESYSTEM',
        action: 'filesystem.read',
        resource: 'workspace.snapshot',
        priority: 10,
        reason: 'Lower layer is read-only (FS-002)',
        version: '1.0.0'
    },
    {
        ruleId: 'POL-009',
        name: 'Bounded executions allowed in sandbox',
        effect: 'ALLOW',
        scope: 'EXECUTION',
        action: 'execution.run',
        resource: 'sandbox.*',
        priority: 10,
        reason: 'INV-042: resource bounded executions inside approved boundaries',
        version: '1.0.0'
    },
    {
        ruleId: 'POL-010',
        name: 'Model inference allowed with logging',
        effect: 'ALLOW',
        scope: 'MODEL',
        action: 'model.inference',
        resource: 'router.*',
        priority: 10,
        reason: 'INV-080: output is not fact; verdict requires verification',
        version: '1.0.0'
    }
];
const DEFAULT_EFFECT = 'DENY';
const DEFAULT_REASON = 'INV-052/INV-133: no explicit policy matched → DEFAULT DENY. Security failure is not success.';
function evaluatePolicy(request, rules) {
    const sorted = [
        ...rules
    ].filter((r)=>r.active !== false).sort((a, b)=>a.priority - b.priority);
    for (const rule of sorted){
        const actionMatch = rule.action.endsWith('*') ? request.action.startsWith(rule.action.slice(0, -1)) : rule.action === request.action;
        const resourceMatch = rule.resource === '*' || rule.resource === request.resource || rule.resource.endsWith('.*') && request.resource.startsWith(rule.resource.slice(0, -1));
        if (actionMatch && resourceMatch) {
            return {
                effect: rule.effect,
                matchedRule: rule.ruleId,
                reason: rule.reason,
                precedence: `POLICY ${rule.effect} > MODEL > AGENT > TOOL > LOCAL (rule ${rule.ruleId} v${rule.version}, priority ${rule.priority})`
            };
        }
    }
    return {
        effect: DEFAULT_EFFECT,
        matchedRule: null,
        reason: DEFAULT_REASON,
        precedence: 'POLICY DENY (default) > MODEL > AGENT > TOOL > LOCAL'
    };
}
}),
"[project]/src/lib/yahria/bootstrap.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "bootstrap",
    ()=>bootstrap,
    "ensureBootstrapped",
    ()=>ensureBootstrapped
]);
// ═══════════════════════════════════════════════════════════════
// YAHRIA KERNEL — Bootstrap & Seed (Domain 00)
// Doc ID: YAHRIA-KRN-009 | Source: ROOT ZIP CONTRACT §3 BOOTSTRAP SEQUENCE
// ═══════════════════════════════════════════════════════════════
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$yahria$2f$domains$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/yahria/domains.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$yahria$2f$agent$2d$os$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/yahria/agent-os.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$yahria$2f$policy$2d$engine$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/yahria/policy-engine.ts [app-route] (ecmascript)");
;
;
;
;
async function bootstrap() {
    // Idempotent bootstrap — safe to call on every load
    const domainCount = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].domain.count();
    const agentCount = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].agent.count();
    const policyCount = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].policyRule.count();
    if (domainCount === 0) {
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].domain.createMany({
            data: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$yahria$2f$domains$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["DOMAINS"].map((d)=>({
                    code: d.code,
                    name: d.name,
                    purpose: d.purpose,
                    phase: d.phase,
                    isCore: d.isCore,
                    status: d.phase <= 8 ? 'IMPLEMENTING' : 'NOT_STARTED'
                }))
        });
    }
    if (agentCount === 0) {
        for (const a of __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$yahria$2f$agent$2d$os$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["CANONICAL_AGENTS"]){
            await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].agent.create({
                data: {
                    key: a.key,
                    name: a.name,
                    role: a.role,
                    capabilities: JSON.stringify(a.capabilities),
                    autonomy: a.autonomy,
                    status: 'IDLE'
                }
            });
        }
    }
    if (policyCount === 0) {
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].policyRule.createMany({
            data: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$yahria$2f$policy$2d$engine$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["SEED_POLICY_RULES"].map((r)=>({
                    ruleId: r.ruleId,
                    name: r.name,
                    effect: r.effect,
                    scope: r.scope,
                    condition: JSON.stringify({
                        action: r.action,
                        resource: r.resource
                    }),
                    priority: r.priority,
                    version: r.version,
                    active: true
                }))
        });
    }
    // Default tenant/organization/project hierarchy (INV-020/021/022)
    const tenantCount = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].tenant.count();
    if (tenantCount === 0) {
        const tenant = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].tenant.create({
            data: {
                key: 'root',
                name: 'YAHRIA Root Tenant'
            }
        });
        const org = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].organization.create({
            data: {
                tenantId: tenant.id,
                name: 'YAHRIA Core Organization',
                slug: 'yahria-core'
            }
        });
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].project.create({
            data: {
                organizationId: org.id,
                name: 'YAHRIA Self-Implementation',
                slug: 'yahria-self',
                description: 'The canonical project through which YAHRIA implements itself under governance.'
            }
        });
    }
    const [d, a, p, t] = await Promise.all([
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].domain.count(),
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].agent.count(),
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].policyRule.count(),
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].tenant.count()
    ]);
    return {
        seeded: true,
        counts: {
            domains: d,
            agents: a,
            policies: p,
            tenants: t
        }
    };
}
async function ensureBootstrapped() {
    const c = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].domain.count();
    if (c === 0) await bootstrap();
}
}),
"[project]/src/lib/yahria/state-machines.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// ═══════════════════════════════════════════════════════════════
// YAHRIA KERNEL — Universal State Transition Contract
// Doc ID: YAHRIA-KRN-001 | Source: STATE_TRANSITION_MANIFEST.md
// Every transition is guarded, explicit, and audited.
// ═══════════════════════════════════════════════════════════════
__turbopack_context__.s([
    "ACCEPTANCE_MACHINE",
    ()=>ACCEPTANCE_MACHINE,
    "AGENT_MACHINE",
    ()=>AGENT_MACHINE,
    "ALL_MACHINES",
    ()=>ALL_MACHINES,
    "EVIDENCE_MACHINE",
    ()=>EVIDENCE_MACHINE,
    "EXECUTION_MACHINE",
    ()=>EXECUTION_MACHINE,
    "FAILURE_MACHINE",
    ()=>FAILURE_MACHINE,
    "TASK_MACHINE",
    ()=>TASK_MACHINE,
    "assertTransition",
    ()=>assertTransition,
    "canTransition",
    ()=>canTransition
]);
const TASK_MACHINE = {
    name: 'TASK',
    domain: '07',
    initial: 'PENDING',
    terminal: [
        'COMPLETED',
        'CANCELLED'
    ],
    states: [
        'PENDING',
        'READY',
        'RUNNING',
        'BLOCKED',
        'FAILED',
        'CANCELLED',
        'COMPLETED'
    ],
    transitions: [
        {
            from: 'PENDING',
            to: 'READY',
            guard: 'all mandatory dependencies PROMOTED or VERIFIED',
            authority: 'SYSTEM'
        },
        {
            from: 'PENDING',
            to: 'BLOCKED',
            guard: 'missing specification or unresolved dependency',
            authority: 'SYSTEM'
        },
        {
            from: 'READY',
            to: 'RUNNING',
            guard: 'agent assigned AND policy evaluation != DENY',
            authority: 'AGENT'
        },
        {
            from: 'RUNNING',
            to: 'COMPLETED',
            guard: 'tests pass AND evidence sealed',
            authority: 'SYSTEM'
        },
        {
            from: 'RUNNING',
            to: 'FAILED',
            guard: 'test failure or execution failure (F012/F013)',
            authority: 'SYSTEM'
        },
        {
            from: 'RUNNING',
            to: 'BLOCKED',
            guard: 'ambiguity detected → STOP protocol (never guess)',
            authority: 'AGENT'
        },
        {
            from: 'BLOCKED',
            to: 'READY',
            guard: 'blocking condition resolved with evidence',
            authority: 'HUMAN'
        },
        {
            from: 'FAILED',
            to: 'READY',
            guard: 'recovery strategy applied AND verified',
            authority: 'SYSTEM'
        },
        {
            from: 'PENDING',
            to: 'CANCELLED',
            guard: 'human override (INV-200)',
            authority: 'HUMAN'
        },
        {
            from: 'READY',
            to: 'CANCELLED',
            guard: 'human override (INV-200)',
            authority: 'HUMAN'
        },
        {
            from: 'BLOCKED',
            to: 'CANCELLED',
            guard: 'human override (INV-200)',
            authority: 'HUMAN'
        }
    ]
};
const AGENT_MACHINE = {
    name: 'AGENT',
    domain: '05',
    initial: 'IDLE',
    terminal: [
        'COMPLETED',
        'TERMINATED'
    ],
    states: [
        'IDLE',
        'STARTED',
        'PERCEIVING',
        'REASONING',
        'ACTING',
        'VERIFYING',
        'COMPLETED',
        'FAILED',
        'BLOCKED',
        'TERMINATED'
    ],
    transitions: [
        {
            from: 'IDLE',
            to: 'STARTED',
            guard: 'run created with attributable identity (INV-070)',
            authority: 'SYSTEM'
        },
        {
            from: 'STARTED',
            to: 'PERCEIVING',
            guard: 'world state assembly',
            authority: 'SYSTEM'
        },
        {
            from: 'PERCEIVING',
            to: 'REASONING',
            guard: 'world state captured as evidence',
            authority: 'SYSTEM'
        },
        {
            from: 'REASONING',
            to: 'ACTING',
            guard: 'plan produced AND capability check passed (INV-071)',
            authority: 'AGENT'
        },
        {
            from: 'REASONING',
            to: 'BLOCKED',
            guard: 'policy DENY or capability boundary',
            authority: 'POLICY'
        },
        {
            from: 'ACTING',
            to: 'VERIFYING',
            guard: 'action produced artifact',
            authority: 'SYSTEM'
        },
        {
            from: 'VERIFYING',
            to: 'COMPLETED',
            guard: 'verifier verdict PASS (independent from generator)',
            authority: 'AGENT'
        },
        {
            from: 'VERIFYING',
            to: 'FAILED',
            guard: 'verifier verdict FAIL → reflection required',
            authority: 'AGENT'
        },
        {
            from: 'BLOCKED',
            to: 'IDLE',
            guard: 'reported to authority, awaiting decision',
            authority: 'HUMAN'
        }
    ]
};
const EXECUTION_MACHINE = {
    name: 'EXECUTION',
    domain: '08',
    initial: 'QUEUED',
    terminal: [
        'SUCCEEDED',
        'FAILED',
        'CANCELLED',
        'TIMED_OUT'
    ],
    states: [
        'QUEUED',
        'POLICY_CHECK',
        'PROVISIONING',
        'RUNNING',
        'VERIFYING',
        'SUCCEEDED',
        'FAILED',
        'CANCELLED',
        'TIMED_OUT'
    ],
    transitions: [
        {
            from: 'QUEUED',
            to: 'POLICY_CHECK',
            guard: 'execution context explicit (INV-040)',
            authority: 'SYSTEM'
        },
        {
            from: 'POLICY_CHECK',
            to: 'PROVISIONING',
            guard: 'policy ALLOW or REQUIRE_APPROVAL approved',
            authority: 'POLICY'
        },
        {
            from: 'POLICY_CHECK',
            to: 'FAILED',
            guard: 'policy DENY (INV-120: policy overrides all)',
            authority: 'POLICY'
        },
        {
            from: 'PROVISIONING',
            to: 'RUNNING',
            guard: 'sandbox provisioned with resource bounds (INV-042)',
            authority: 'SYSTEM'
        },
        {
            from: 'RUNNING',
            to: 'VERIFYING',
            guard: 'exit captured; exit code alone is NOT success (INV-044)',
            authority: 'SYSTEM'
        },
        {
            from: 'RUNNING',
            to: 'TIMED_OUT',
            guard: 'timeout exceeded → controlled termination (INV-043)',
            authority: 'SYSTEM'
        },
        {
            from: 'VERIFYING',
            to: 'SUCCEEDED',
            guard: 'verification evidence sealed',
            authority: 'SYSTEM'
        },
        {
            from: 'VERIFYING',
            to: 'FAILED',
            guard: 'verification failed → failure event emitted',
            authority: 'SYSTEM'
        }
    ]
};
const EVIDENCE_MACHINE = {
    name: 'EVIDENCE',
    domain: '11',
    initial: 'DECLARED',
    terminal: [
        'SEALED',
        'DISPOSED'
    ],
    states: [
        'DECLARED',
        'CAPTURED',
        'NORMALIZED',
        'HASHED',
        'LINKED',
        'VERIFIED',
        'SEALED',
        'RETAINED',
        'ARCHIVED',
        'EXPIRED',
        'DISPOSED',
        'INVALID',
        'CORRUPTED'
    ],
    transitions: [
        {
            from: 'DECLARED',
            to: 'CAPTURED',
            guard: 'payload captured with actor + timestamp',
            authority: 'SYSTEM'
        },
        {
            from: 'CAPTURED',
            to: 'NORMALIZED',
            guard: 'schema-conformant normalization',
            authority: 'SYSTEM'
        },
        {
            from: 'NORMALIZED',
            to: 'HASHED',
            guard: 'SHA-256 content addressing applied',
            authority: 'SYSTEM'
        },
        {
            from: 'HASHED',
            to: 'LINKED',
            guard: 'lineage linked to execution/task (INV-111)',
            authority: 'SYSTEM'
        },
        {
            from: 'LINKED',
            to: 'VERIFIED',
            guard: 'integrity check recomputed and equal',
            authority: 'SYSTEM'
        },
        {
            from: 'VERIFIED',
            to: 'SEALED',
            guard: 'immutability commitment (INV-033)',
            authority: 'POLICY'
        }
    ]
};
const FAILURE_MACHINE = {
    name: 'FAILURE',
    domain: '08/22',
    initial: 'DETECTED',
    terminal: [
        'RECOVERED',
        'UNRECOVERABLE',
        'ABORTED',
        'QUARANTINED'
    ],
    states: [
        'DETECTED',
        'CLASSIFYING',
        'CLASSIFIED',
        'CONTAINING',
        'CONTAINED',
        'ANALYZING',
        'RECOVERY_SELECTED',
        'RECOVERING',
        'VERIFYING',
        'RECOVERED',
        'UNRECOVERABLE',
        'ESCALATED',
        'ABORTED',
        'QUARANTINED'
    ],
    transitions: [
        {
            from: 'DETECTED',
            to: 'CLASSIFYING',
            guard: 'failure event structured (taxonomy F001-F025)',
            authority: 'SYSTEM'
        },
        {
            from: 'CLASSIFYING',
            to: 'CLASSIFIED',
            guard: 'type + severity + impact assigned',
            authority: 'SYSTEM'
        },
        {
            from: 'CLASSIFIED',
            to: 'CONTAINING',
            guard: 'containment-first principle',
            authority: 'SYSTEM'
        },
        {
            from: 'CONTAINING',
            to: 'CONTAINED',
            guard: 'blast radius bounded',
            authority: 'SYSTEM'
        },
        {
            from: 'CONTAINING',
            to: 'ESCALATED',
            guard: 'containment failed → human authority',
            authority: 'HUMAN'
        },
        {
            from: 'CONTAINED',
            to: 'ANALYZING',
            guard: 'root cause analysis started',
            authority: 'SYSTEM'
        },
        {
            from: 'ANALYZING',
            to: 'RECOVERY_SELECTED',
            guard: 'strategy selected (retry/rollback/compensation/replan/switch)',
            authority: 'SYSTEM'
        },
        {
            from: 'RECOVERY_SELECTED',
            to: 'RECOVERING',
            guard: 'idempotency verified before retry',
            authority: 'SYSTEM'
        },
        {
            from: 'RECOVERING',
            to: 'VERIFYING',
            guard: 'recovery action executed',
            authority: 'SYSTEM'
        },
        {
            from: 'VERIFYING',
            to: 'RECOVERED',
            guard: 'state consistent AND evidence preserved (INV-211)',
            authority: 'SYSTEM'
        },
        {
            from: 'VERIFYING',
            to: 'UNRECOVERABLE',
            guard: 'recovery failed after max attempts',
            authority: 'SYSTEM'
        }
    ]
};
const ACCEPTANCE_MACHINE = {
    name: 'ACCEPTANCE',
    domain: '20',
    initial: 'DRAFT',
    terminal: [
        'ACCEPTED',
        'REJECTED'
    ],
    states: [
        'DRAFT',
        'PENDING',
        'RUNNING',
        'PASSED',
        'FAILED',
        'WAIVED',
        'ACCEPTED',
        'REJECTED'
    ],
    transitions: [
        {
            from: 'DRAFT',
            to: 'PENDING',
            guard: 'acceptance criteria explicit',
            authority: 'SYSTEM'
        },
        {
            from: 'PENDING',
            to: 'RUNNING',
            guard: 'test environment ready',
            authority: 'SYSTEM'
        },
        {
            from: 'RUNNING',
            to: 'PASSED',
            guard: 'all critical assertions verified with evidence',
            authority: 'SYSTEM'
        },
        {
            from: 'RUNNING',
            to: 'FAILED',
            guard: 'any critical assertion failed',
            authority: 'SYSTEM'
        },
        {
            from: 'PASSED',
            to: 'ACCEPTED',
            guard: 'evidence bundle complete (INV-102)',
            authority: 'POLICY'
        },
        {
            from: 'FAILED',
            to: 'REJECTED',
            guard: 'claim without evidence cannot be accepted',
            authority: 'POLICY'
        }
    ]
};
const ALL_MACHINES = [
    TASK_MACHINE,
    AGENT_MACHINE,
    EXECUTION_MACHINE,
    EVIDENCE_MACHINE,
    FAILURE_MACHINE,
    ACCEPTANCE_MACHINE
];
function canTransition(machine, from, to) {
    const rule = machine.transitions.find((t)=>t.from === from && t.to === to);
    if (!rule) {
        return {
            ok: false,
            reason: `Transition ${from} → ${to} is not declared in ${machine.name} machine. Silent transitions are prohibited.`
        };
    }
    return {
        ok: true,
        rule
    };
}
function assertTransition(machine, from, to) {
    const res = canTransition(machine, from, to);
    if (!res.ok || !res.rule) throw new Error(res.reason);
    return res.rule;
}
}),
"[project]/src/app/api/yahria/system/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GET",
    ()=>GET
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$yahria$2f$bootstrap$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/yahria/bootstrap.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$yahria$2f$state$2d$machines$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/yahria/state-machines.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$yahria$2f$domains$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/yahria/domains.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$yahria$2f$agent$2d$os$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/yahria/agent-os.ts [app-route] (ecmascript)");
;
;
;
;
;
;
async function GET() {
    try {
        const boot = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$yahria$2f$bootstrap$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["bootstrap"])();
        const [agents, tasks, executions, evidence, failures, traces, memories, policyDecisions] = await Promise.all([
            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].agent.findMany({
                include: {
                    runs: {
                        orderBy: {
                            startedAt: 'desc'
                        },
                        take: 3
                    }
                }
            }),
            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].task.findMany({
                orderBy: {
                    createdAt: 'desc'
                },
                take: 50
            }),
            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].execution.findMany({
                orderBy: {
                    createdAt: 'desc'
                },
                take: 30
            }),
            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].evidence.findMany({
                orderBy: {
                    createdAt: 'desc'
                },
                take: 30
            }),
            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].failureEvent.findMany({
                orderBy: {
                    createdAt: 'desc'
                },
                take: 20
            }),
            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].cognitiveTrace.findMany({
                orderBy: {
                    createdAt: 'desc'
                },
                take: 20
            }),
            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].memoryRecord.findMany({
                orderBy: {
                    createdAt: 'desc'
                },
                take: 20
            }),
            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].policyDecision.findMany({
                orderBy: {
                    createdAt: 'desc'
                },
                take: 20
            })
        ]);
        const domains = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].domain.findMany({
            orderBy: {
                phase: 'asc'
            }
        });
        const policies = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].policyRule.findMany({
            orderBy: {
                priority: 'asc'
            }
        });
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            ok: true,
            boot,
            machines: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$yahria$2f$state$2d$machines$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ALL_MACHINES"],
            domains: domains.length ? domains : __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$yahria$2f$domains$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["DOMAINS"],
            governance: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$yahria$2f$domains$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["GOVERNANCE_PLANES"],
            bootstrapSequence: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$yahria$2f$agent$2d$os$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["BOOTSTRAP_SEQUENCE"],
            agents,
            tasks,
            executions,
            evidence,
            failures,
            traces,
            memories,
            policyDecisions,
            policies
        });
    } catch (e) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            ok: false,
            error: String(e)
        }, {
            status: 500
        });
    }
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__6ef2aa83._.js.map