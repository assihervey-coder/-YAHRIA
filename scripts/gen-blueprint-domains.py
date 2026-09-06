#!/usr/bin/env python3
"""Génère les 24 répertoires de domaines canoniques du YAHRIA_CANONICAL_BLUEPRINT.

Chaque répertoire <NN>_<NAME>/ reçoit un SPEC.md : but canonique, sous-domaines,
dépendances (DEPENDENCY_GRAPH), et correspondances d'implémentation dans le dépôt.
"""
import os

ROOT = '/home/z/my-project/YAHRIA_CANONICAL_BLUEPRINT'

DOMAINS = [
    ("00", "INITIALIZATION", "INITIALIZATION & CONSTITUTION",
     "Définir l'identité et les principes architecturaux immuables de YAHRIA.",
     ["Vision", "Mission", "Product Principles", "Constitution", "Global Invariants",
      "Architectural Principles", "Security Principles", "Definition of Done", "Canonical Vocabulary"],
     "Phase 0 — aucune dépendance (tout dépend de 00).",
     ["README.md (racine)", "docs/corpus/00_AUTONOMOUS_CODING_CONTRACT.md"]),
    ("01", "FOUNDATION", "FOUNDATION & PLATFORM CORE",
     "Fournir la fondation technique commune à tous les autres domaines.",
     ["Monorepo", "Backend Foundation", "Frontend Foundation", "Database Foundation",
      "Configuration", "Dependency Management", "Environment Management", "Feature Flags", "Shared Libraries"],
     "00 → 01.",
     ["package.json", "next.config.ts", "prisma/schema.prisma", "server.mjs"]),
    ("02", "IDENTITY", "IDENTITY & ORGANIZATION",
     "Définir identités, frontières d'autorisation et propriété organisationnelle.",
     ["Identity", "Authentication", "Authorization", "RBAC", "ABAC", "Organizations",
      "Tenants", "Teams", "Memberships", "Audit Identity"],
     "01 → 16 fondation → 02.",
     ["prisma/schema.prisma (Tenant, Org, Project)", "src/lib/yahria/types.ts"]),
    ("03", "PROJECT_WORKSPACE", "PROJECT & WORKSPACE",
     "Projets, dépôts, workspaces, branches, environnements et fournisseurs de sources.",
     ["Projects", "Repositories", "Workspaces", "Branches", "Environments",
      "Project Configuration", "Source Providers", "Repository Synchronization", "Project Metadata"],
     "02 → 03.",
     ["prisma/schema.prisma (Project)", "src/lib/yahria/perception.ts"]),
    ("04", "CODE_GENOME", "CODE GENOME & SOFTWARE KNOWLEDGE GRAPH",
     "Connaissance structurelle et sémantique du code : symboles, graphes, embeddings.",
     ["Code Ingestion", "File Intelligence", "Symbol Extraction", "Dependency Graph", "Call Graph",
      "Type Graph", "Repository Graph", "Software Knowledge Graph", "Change Impact Analysis",
      "Code Embeddings", "Semantic Retrieval", "Code Memory", "Code Genome Evolution"],
     "03 → 04. Fournit du savoir à : Cognitive Core, Agents, Task Graph, Memory, Learning.",
     ["src/lib/yahria/perception.ts (WorldState)"]),
    ("05", "AGENT_OS", "AGENT OPERATING SYSTEM",
     "Identité, cycle de vie, coordination et gouvernance des agents.",
     ["Agent Identity", "Agent Registry", "Agent Capability Model", "Agent Lifecycle", "Agent Communication",
      "Agent Context", "Agent Memory Interface", "Agent State", "Agent Coordination", "Agent Scheduling",
      "Agent Routing", "Agent Evaluation", "Agent Governance"],
     "02, 03, 04 → 05.",
     ["src/lib/yahria/agent-os.ts (9 agents + portes de capacités)"]),
    ("06", "COGNITIVE_CORE", "COGNITIVE CORE",
     "Raisonnement, planification, décision et sécurité cognitive.",
     ["Intent Understanding", "Goal Modeling", "World State", "Context Assembly", "Reasoning Interface",
      "Planning Engine", "Strategy Selection", "Uncertainty Engine", "Verification Planning", "Reflection",
      "Cognitive Routing", "Decision Engine", "Cognitive Safety"],
     "04, 05 → 06. Consomme savoir-code et capacités ; produit buts, plans, décisions, plans de vérification.",
     ["src/lib/yahria/cognitive-loop.ts", "src/lib/yahria/hybrid-reasoning.ts",
      "src/lib/yahria/perception.ts", "public/docs/HYBRID_REASONING_SPECIFICATION.md"]),
    ("07", "TASK_GRAPH", "TASK GRAPH & ORCHESTRATION",
     "Décomposition des buts en graphe de tâches exécutable (DAG) gouverné.",
     ["Task Model", "Goal Decomposition", "Task Graph", "DAG Engine", "Dependency Resolution",
      "Scheduling", "State Machine", "Retry Strategy", "Compensation", "Cancellation",
      "Task Verification", "Human Intervention", "Task Governance"],
     "06 → 07. Convertit but → décomposition → graphe → plan d'exécution.",
     ["src/lib/yahria/state-machines.ts (TASK_MACHINE)", "src/app/api/yahria/tasks/route.ts (INV-091)"]),
    ("08", "EXECUTION_FABRIC", "EXECUTION FABRIC",
     "Cycle de vie d'exécution : orchestration, persistance, workers, retries, recovery.",
     ["Execution Orchestrator", "Execution State Machine", "Execution Context", "Execution Persistence",
      "Execution Queue", "Execution Worker", "Execution Retry", "Execution Timeout",
      "Execution Cancellation", "Execution Recovery"],
     "07 → 08.",
     ["src/lib/yahria/execution-fabric.ts", "src/app/api/yahria/executions/route.ts"]),
    ("09", "TOOL_REGISTRY", "TOOL REGISTRY ENGINE",
     "Outils : découverte, contrats, capacités, validation, autorisation, exécution.",
     ["Tool Registry", "Tool Definition", "Tool Versioning", "Tool Discovery", "Tool Capability",
      "Tool Contract", "Tool Schema", "Tool Validator", "Capability Engine", "Tool Authorization",
      "Tool Executor", "Tool Result", "Tool Governance"],
     "05, 07, 08 → 09.",
     ["src/lib/yahria/agent-os.ts (capacités)", "src/lib/yahria/policy-engine.ts (POL tool.*)"]),
    ("10", "SANDBOX", "SANDBOX ENGINE",
     "Frontières d'exécution sûres : overlay, isolation, ressources, timeouts.",
     ["Sandbox Contract", "Security Profile", "Runtime Adapter", "Container Runtime", "Podman Runtime",
      "Filesystem Overlay", "Workspace Isolation", "Network Isolation", "Egress Policy", "DNS Policy",
      "Resource Controller", "CPU Limits", "Memory Limits", "Disk Limits", "PID Limits",
      "Process Control", "Timeout Control"],
     "08, 09 → 10. Chaîne : SNAPSHOT → LOWER-RO → OVERLAYFS → UPPER-RW → CONTAINER → DIFF → PATCH VALIDATOR → REJECT/APPLY (ADR-0006).",
     ["src/lib/yahria/execution-fabric.ts (SANDBOX_PROFILES, OverlayFS)"]),
    ("11", "OBSERVABILITY", "EXECUTION OBSERVABILITY",
     "Events structurés, traces, metrics, logs, preuves, replay, audit.",
     ["Structured Events", "Distributed Traces", "Metrics", "Resource Telemetry", "Execution Logs",
      "Artifact Capture", "Evidence Engine", "Execution Lineage Graph", "Replay Engine",
      "Audit & Forensics", "Retention Lifecycle", "Compliance Integration"],
     "08, 09, 10 → 11. Transversal.",
     ["src/lib/yahria/evidence-engine.ts", "src/lib/yahria/evidence-store.ts",
      "src/lib/yahria/realtime.ts (WebSocket)", "server.mjs (/ws/yahria)",
      "src/hooks/use-yahria-realtime.ts", "src/components/yahria/realtime-panel.tsx"]),
    ("12", "POLICY_CONTROL_PLANE", "POLICY & GOVERNANCE CONTROL PLANE",
     "Gouvernance transversale deny-by-default : RBAC/ABAC unifiés, règles, décisions.",
     ["Unified RBAC", "Unified ABAC", "Policy Model", "Policy DSL", "Deterministic Rule Engine",
      "Policy Simulator", "Policy-as-Code", "Policy Versioning", "Policy Signatures", "Policy Propagation",
      "Policy Decision", "Policy Enforcement", "Cognitive Integration", "Task Graph Integration"],
     "02, 08, 09, 10, 11 → 12. Devient autorité transversale après implémentation (ADR-0004).",
     ["src/lib/yahria/policy-engine.ts (POL-001 → POL-010, DENY par défaut)",
      "src/app/api/yahria/policy/route.ts"]),
    ("13", "MEMORY", "MEMORY SYSTEM",
     "Mémoire de travail, épisodique, sémantique, procédurale, architecturale.",
     ["Memory Architecture", "Working Memory", "Episodic Memory", "Semantic Memory", "Procedural Memory",
      "Architectural Memory", "Memory Candidates", "Memory Validation", "Memory Consolidation",
      "Memory Graph", "Memory Retrieval", "Memory Governance", "Forgetting & Decay", "Cognitive Integration"],
     "04, 05, 06, 07, 11, 12 → 13. MEMORY ≠ POLICY.",
     ["prisma/schema.prisma (MemoryRecord)", "src/lib/yahria/agent-os.ts (interface mémoire)"]),
    ("14", "LEARNING", "LEARNING ENGINE",
     "Apprentissage à partir des exécutions, preuves, échecs et succès.",
     ["Learning Extraction", "Reflection Engine", "Pattern Mining", "Failure Intelligence",
      "Success Intelligence", "Strategy Learning", "Agent Learning", "Tool Learning", "Model Learning",
      "Knowledge Consolidation", "Learning Validation", "Learning Evidence"],
     "13, 11, 12 → 14.",
     ["src/lib/yahria/cognitive-loop.ts (étape REFLECTION)"]),
    ("15", "SELF_EVOLUTION", "SELF-EVOLUTION & META-INTELLIGENCE",
     "Auto-amélioration gouvernée : stratégies, agents, prompts, workflows, benchmarks.",
     ["Meta-Intelligence Core", "Self-Assessment", "Capability Assessment", "Strategy Intelligence",
      "Strategy Optimization", "Agent Evolution", "Agent Genome", "Workflow Evolution", "Prompt Evolution",
      "Model Routing Optimization", "Tool Selection Optimization", "Experimentation Engine",
      "Comparative Testing", "Benchmark Engine", "Evolution Sandbox", "Evolution Evaluation",
      "Evolution Governance", "Rollout", "Rollback", "Evolution Memory"],
     "13, 14, 12, 20 → 15. Aucune évolution promotée sans infrastructure d'évaluation (D.6.11 gouverne D.8).",
     ["src/lib/yahria/agent-os.ts (agent Evolution, sorties soumises à gouvernance)"]),
    ("16", "DATA", "DATA & PERSISTENCE",
     "Architecture de données : schémas, migrations, RLS, JSONB, vecteurs, artefacts.",
     ["PostgreSQL Architecture", "Schema Strategy", "SQLAlchemy Models", "Alembic", "RLS",
      "Tenant Isolation", "Index Strategy", "Partitioning", "JSONB Strategy", "Vector Storage",
      "Graph Storage", "Artifact Storage", "Event Storage", "Backup", "Recovery"],
     "01 → 16 (implémentation précoce, transversale).",
     ["prisma/schema.prisma (15 modèles)", "db/ (SQLite sandbox — cible PostgreSQL, ADR-0007/0010)"]),
    ("17", "API_INTEGRATION", "API & INTEGRATION",
     "Contrats stables exposés : REST, WebSocket, webhooks, plugins, SDK.",
     ["API Gateway", "REST API", "WebSocket", "Internal API", "Event Bus", "Webhooks",
      "Plugin Architecture", "External Tools", "Source Providers", "SDK"],
     "Domaines cœur → 17. L'API ne duplique jamais la logique métier.",
     ["src/app/api/yahria/* (7 endpoints)", "server.mjs + /ws/yahria (WebSocket temps réel, ADR-0011)"]),
    ("18", "FRONTEND", "FRONTEND & USER EXPERIENCE",
     "UI gouvernée : dashboard agents, graphe de tâches, console d'exécution, preuves.",
     ["Web Application", "IDE Interface", "Code Editor", "AI Chat", "Agent Dashboard",
      "Task Graph Visualization", "Execution Console", "Evidence Viewer", "Memory Explorer",
      "Policy Console", "Evolution Dashboard", "Administration"],
     "17 → 18. L'UI ne contient aucune logique métier critique.",
     ["src/app/page.tsx (Mission Control, 9 panneaux)", "src/components/yahria/*"]),
    ("19", "SECURITY", "SECURITY",
     "Sécurité transversale : zero trust, secrets, supply chain, sandbox, incidents.",
     ["Threat Model", "Zero Trust", "Secrets Management", "Encryption", "Key Management",
      "Supply Chain Security", "Dependency Security", "Code Security", "Sandbox Security",
      "Network Security", "Audit Security", "Incident Response"],
     "Transversal ; durcissement après 02, 09, 10, 11, 12, 17, 18 → 19.",
     ["src/lib/yahria/policy-engine.ts (deny-by-default)", "src/lib/yahria/execution-fabric.ts (profils sandbox)"]),
    ("20", "QUALITY", "QUALITY ENGINEERING",
     "Stratégie de test continue : unitaires, intégration, E2E, chaos, régression.",
     ["Test Strategy", "Unit Tests", "Integration Tests", "Contract Tests", "End-to-End Tests",
      "Security Tests", "Performance Tests", "Chaos Testing", "Regression Tests",
      "Benchmark Tests", "Test Evidence"],
     "01 → 20 (continue). « A test exists to validate a claim. »",
     ["scripts/ws-test.mjs (E2E WebSocket)", "scripts/render_mindmap.py (génération vérifiée)"]),
    ("21", "DEVOPS", "DEVOPS & DELIVERY",
     "CI/CD, artefacts, infrastructure, staging, production, rollback.",
     ["Local Development", "Docker", "Podman", "CI", "CD", "Build Pipeline", "Artifact Registry",
      "Infrastructure as Code", "Staging", "Production", "Rollback"],
     "01, 16, 17, 19, 20 → 21.",
     ["package.json (scripts dev/build/start)", "server.mjs (serveur unifié dev+prod)"]),
    ("22", "OPERATIONS", "OPERATIONS",
     "Monitoring runtime, alerting, incidents, SLO, capacité, coûts, runbooks.",
     ["Runtime Monitoring", "Alerting", "Incident Management", "SLO / SLA", "Capacity Management",
      "Cost Management", "Backup Operations", "Disaster Recovery", "Operational Runbooks"],
     "11, 19, 21 → 22.",
     ["src/components/yahria/realtime-panel.tsx (flux LIVE)", "docs/corpus/FAILURE_AND_RECOVERY_MANIFEST.md (F001–F025)"]),
    ("23", "PRODUCT_EVOLUTION", "PRODUCT EVOLUTION & ROADMAP",
     "Évolution produit pilotée par preuves opérationnelles : MVP → Beta → Enterprise.",
     ["MVP", "Alpha", "Beta", "Enterprise", "Scaling", "Plugin Ecosystem", "API Ecosystem",
      "Marketplace", "Long-Term Evolution"],
     "22 → 23.",
     ["public/docs/HYBRID_REASONING_SPECIFICATION.md (critères d'acceptance V1.0.0)"]),
]

TEMPLATE = """# Domaine {code} — {title}

Document ID: YAHRIA-DOMAIN-{code}
Status: DOMAIN SPEC (LEVEL 6)
Authority: CANONICAL_INDEX + DEPENDENCY_GRAPH
Version: 1.0.0

## But canonique

{purpose}

## Sous-domaines

{subdomains}

## Dépendances (DEPENDENCY_GRAPH)

{deps}

## Correspondances d'implémentation (ce dépôt)

{impl}

---

> Ce SPEC est un document de niveau 6 (DOMAIN SPEC). Il ne peut pas contredire
> les niveaux supérieurs (constitution, invariants, ADR, index, graphe).
> Toute extension de domaine suit ADR-0001 : amendement versionné.
"""

for code, dirname, title, purpose, subs, deps, impl_files in DOMAINS:
    d = os.path.join(ROOT, f"{code}_{dirname}")
    os.makedirs(d, exist_ok=True)
    sub_lines = "\n".join(f"- {code}.{i+1} {s}" for i, s in enumerate(subs))
    impl_lines = "\n".join(f"- `{f}`" for f in impl_files)
    content = TEMPLATE.format(code=code, title=title, purpose=purpose,
                              subdomains=sub_lines, deps=deps, impl=impl_lines)
    with open(os.path.join(d, "SPEC.md"), "w", encoding="utf-8") as f:
        f.write(content)
    print(f"OK {code}_{dirname}/SPEC.md")

print(f"\n{len(DOMAINS)} domaines générés dans {ROOT}")
