# YAHRIA — CANONICAL INDEX

> **Extraction autonome** : ce fichier était précédemment *embarqué* dans
> `00_AUTONOMOUS_CODING_CONTRACT.md` (§2). Il est ici promu en fichier racine
> autonome, conformément à la ROOT REQUIRED STRUCTURE du contrat.
> Contenu extrait fidèlement, version 1.0.0.

Document ID: YAHRIA-ROOT-001
Status: CANONICAL
Authority: ROOT INDEX
Version: 1.0.0

---

## 1. PURPOSE

This document defines the canonical domain structure of the YAHRIA system.
Every implementation, specification, database model, API, service, test, and deployment artifact MUST belong to one or more declared domains.

The index defines:

- DOMAIN
- RESPONSIBILITY
- SUBDOMAINS
- PRIMARY DEPENDENCIES

Detailed implementation order is defined by: **DEPENDENCY_GRAPH.md**

## 2. ROOT DOCUMENTS

1. 00_AUTONOMOUS_CODING_CONTRACT.md
2. CANONICAL_INDEX.md *(ce fichier)*
3. DEPENDENCY_GRAPH.md
4. GLOBAL_INVARIANTS.md
5. ARCHITECTURE_DECISIONS.md
6. README.md

## 3. CANONICAL DOMAIN MAP

| # | Domain | Responsabilité |
|---|--------|----------------|
| 00 | INITIALIZATION & CONSTITUTION | Identité et principes architecturaux immuables |
| 01 | FOUNDATION & PLATFORM CORE | Fondation technique commune |
| 02 | IDENTITY & ORGANIZATION | Identités, frontières d'autorisation, propriété organisationnelle |
| 03 | PROJECT & WORKSPACE DOMAIN | Projets, dépôts, workspaces |
| 04 | CODE GENOME & SOFTWARE KNOWLEDGE GRAPH | Connaissance structurelle et sémantique du code |
| 05 | AGENT OPERATING SYSTEM | Agents : identité, cycle de vie, coordination |
| 06 | COGNITIVE CORE | Raisonnement, planification, décision |
| 07 | TASK GRAPH & ORCHESTRATION | Décomposition en tâches, DAG, exécution planifiée |
| 08 | EXECUTION FABRIC | Cycle de vie d'exécution, workers, recovery |
| 09 | TOOL REGISTRY ENGINE | Outils : contrats, capacités, validation |
| 10 | SANDBOX ENGINE | Frontières d'exécution sûres |
| 11 | EXECUTION OBSERVABILITY | Events, traces, metrics, evidence, replay |
| 12 | POLICY & GOVERNANCE CONTROL PLANE | Gouvernance transversale, deny-by-default |
| 13 | MEMORY SYSTEM | Mémoire de travail, épisodique, sémantique, procédurale |
| 14 | LEARNING ENGINE | Apprentissage à partir des exécutions et preuves |
| 15 | SELF-EVOLUTION & META-INTELLIGENCE | Auto-amélioration gouvernée |
| 16 | DATA & PERSISTENCE | PostgreSQL, schémas, RLS, artefacts, vecteurs |
| 17 | API & INTEGRATION | Contrats stables exposés aux clients |
| 18 | FRONTEND & USER EXPERIENCE | UI — aucune logique métier critique |
| 19 | SECURITY | Sécurité transversale, zero trust |
| 20 | QUALITY ENGINEERING | Stratégie de test continue |
| 21 | DEVOPS & DELIVERY | CI/CD, artefacts, staging, production |
| 22 | OPERATIONS | Monitoring, incidents, SLO, runbooks |
| 23 | PRODUCT EVOLUTION & ROADMAP | Évolution produit pilotée par preuves |

## 4. DOMAIN 00 — INITIALIZATION & CONSTITUTION

Purpose: Define the identity and immutable architectural principles of YAHRIA.

Subdomains:
- 00.1 Vision
- 00.2 Mission
- 00.3 Product Principles
- 00.4 Constitution
- 00.5 Global Invariants
- 00.6 Architectural Principles
- 00.7 Security Principles
- 00.8 Definition of Done
- 00.9 Canonical Vocabulary

## 5. DOMAIN 01 — FOUNDATION & PLATFORM CORE

Purpose: Provide the common technical foundation required by all other domains.

Subdomains:
- 01.1 Monorepo
- 01.2 Backend Foundation
- 01.3 Frontend Foundation
- 01.4 Database Foundation
- 01.5 Configuration
- 01.6 Dependency Management
- 01.7 Environment Management
- 01.8 Feature Flags
- 01.9 Shared Libraries

## 6. DOMAIN 02 — IDENTITY & ORGANIZATION

Purpose: Define identities, authorization boundaries and organizational ownership.

Subdomains:
- 02.1 Identity
- 02.2 Authentication
- 02.3 Authorization
- 02.4 RBAC
- 02.5 ABAC
- 02.6 Organizations
- 02.7 Tenants
- 02.8 Teams
- 02.9 Memberships
- 02.10 Audit Identity

## 7. DOMAIN 03 — PROJECT & WORKSPACE

Subdomains:
- 03.1 Projects
- 03.2 Repositories
- 03.3 Workspaces
- 03.4 Branches
- 03.5 Environments
- 03.6 Project Configuration
- 03.7 Source Providers
- 03.8 Repository Synchronization
- 03.9 Project Metadata

## 8. DOMAIN 04 — CODE GENOME

Subdomains:
- 04.1 Code Ingestion
- 04.2 File Intelligence
- 04.3 Symbol Extraction
- 04.4 Dependency Graph
- 04.5 Call Graph
- 04.6 Type Graph
- 04.7 Repository Graph
- 04.8 Software Knowledge Graph
- 04.9 Change Impact Analysis
- 04.10 Code Embeddings
- 04.11 Semantic Retrieval
- 04.12 Code Memory
- 04.13 Code Genome Evolution

## 9. DOMAIN 05 — AGENT OPERATING SYSTEM

Subdomains:
- 05.1 Agent Identity
- 05.2 Agent Registry
- 05.3 Agent Capability Model
- 05.4 Agent Lifecycle
- 05.5 Agent Communication
- 05.6 Agent Context
- 05.7 Agent Memory Interface
- 05.8 Agent State
- 05.9 Agent Coordination
- 05.10 Agent Scheduling
- 05.11 Agent Routing
- 05.12 Agent Evaluation
- 05.13 Agent Governance

## 10. DOMAIN 06 — COGNITIVE CORE

Subdomains:
- 06.1 Intent Understanding
- 06.2 Goal Modeling
- 06.3 World State
- 06.4 Context Assembly
- 06.5 Reasoning Interface
- 06.6 Planning Engine
- 06.7 Strategy Selection
- 06.8 Uncertainty Engine
- 06.9 Verification Planning
- 06.10 Reflection
- 06.11 Cognitive Routing
- 06.12 Decision Engine
- 06.13 Cognitive Safety

## 11. DOMAIN 07 — TASK GRAPH & ORCHESTRATION

Subdomains:
- 07.1 Task Model
- 07.2 Goal Decomposition
- 07.3 Task Graph
- 07.4 DAG Engine
- 07.5 Dependency Resolution
- 07.6 Scheduling
- 07.7 State Machine
- 07.8 Retry Strategy
- 07.9 Compensation
- 07.10 Cancellation
- 07.11 Task Verification
- 07.12 Human Intervention
- 07.13 Task Governance

## 12. DOMAIN 08 — EXECUTION FABRIC

Subdomains:
- 08.0 Execution Domain
- 08.1 Execution Orchestrator
- 08.2 Execution State Machine
- 08.3 Execution Context
- 08.4 Execution Persistence
- 08.5 Execution Queue
- 08.6 Execution Worker
- 08.7 Execution Retry
- 08.8 Execution Timeout
- 08.9 Execution Cancellation
- 08.10 Execution Recovery

## 13. DOMAIN 09 — TOOL REGISTRY ENGINE

Subdomains:
- 09.1 Tool Registry
- 09.2 Tool Definition
- 09.3 Tool Versioning
- 09.4 Tool Discovery
- 09.5 Tool Capability
- 09.6 Tool Contract
- 09.7 Tool Schema
- 09.8 Tool Validator
- 09.9 Capability Engine
- 09.10 Tool Authorization
- 09.11 Tool Executor
- 09.12 Tool Result
- 09.13 Tool Governance

## 14. DOMAIN 10 — SANDBOX ENGINE

Subdomains:
- 10.1 Sandbox Contract
- 10.2 Security Profile
- 10.3 Runtime Adapter
- 10.4 Container Runtime
- 10.5 Podman Runtime
- 10.6 Filesystem Overlay
- 10.7 Workspace Isolation
- 10.8 Network Isolation
- 10.9 Egress Policy
- 10.10 DNS Policy
- 10.11 Resource Controller
- 10.12 CPU Limits
- 10.13 Memory Limits
- 10.14 Disk Limits
- 10.15 PID Limits
- 10.16 Process Control
- 10.17 Timeout Control

## 15. DOMAIN 11 — EXECUTION OBSERVABILITY

Subdomains:
- 11.1 Structured Events
- 11.2 Distributed Traces
- 11.3 Metrics
- 11.4 Resource Telemetry
- 11.5 Execution Logs
- 11.6 Artifact Capture
- 11.7 Evidence Engine
- 11.8 Execution Lineage Graph
- 11.9 Replay Engine
- 11.10 Audit & Forensics
- 11.11 Retention Lifecycle
- 11.12 Compliance Integration

## 16. DOMAIN 12 — POLICY & GOVERNANCE

Subdomains:
- 12.1 Unified RBAC
- 12.2 Unified ABAC
- 12.3 Policy Model
- 12.4 Policy DSL
- 12.5 Deterministic Rule Engine
- 12.6 Policy Simulator
- 12.7 Policy-as-Code
- 12.8 Policy Versioning
- 12.9 Policy Signatures
- 12.10 Policy Propagation
- 12.11 Policy Decision
- 12.12 Policy Enforcement
- 12.13 Cognitive Integration
- 12.14 Task Graph Integration

## 17. DOMAIN 13 — MEMORY SYSTEM

Subdomains:
- 13.1 Memory Architecture
- 13.2 Working Memory
- 13.3 Episodic Memory
- 13.4 Semantic Memory
- 13.5 Procedural Memory
- 13.6 Architectural Memory
- 13.7 Memory Candidates
- 13.8 Memory Validation
- 13.9 Memory Consolidation
- 13.10 Memory Graph
- 13.11 Memory Retrieval
- 13.12 Memory Governance
- 13.13 Forgetting & Decay
- 13.14 Cognitive Integration

## 18. DOMAIN 14 — LEARNING ENGINE

Subdomains:
- 14.1 Learning Extraction
- 14.2 Reflection Engine
- 14.3 Pattern Mining
- 14.4 Failure Intelligence
- 14.5 Success Intelligence
- 14.6 Strategy Learning
- 14.7 Agent Learning
- 14.8 Tool Learning
- 14.9 Model Learning
- 14.10 Knowledge Consolidation
- 14.11 Learning Validation
- 14.12 Learning Evidence

## 19. DOMAIN 15 — SELF-EVOLUTION

Subdomains:
- 15.1 Meta-Intelligence Core
- 15.2 Self-Assessment
- 15.3 Capability Assessment
- 15.4 Strategy Intelligence
- 15.5 Strategy Optimization
- 15.6 Agent Evolution
- 15.7 Agent Genome
- 15.8 Workflow Evolution
- 15.9 Prompt Evolution
- 15.10 Model Routing Optimization
- 15.11 Tool Selection Optimization
- 15.12 Experimentation Engine
- 15.13 Comparative Testing
- 15.14 Benchmark Engine
- 15.15 Evolution Sandbox
- 15.16 Evolution Evaluation
- 15.17 Evolution Governance
- 15.18 Rollout
- 15.19 Rollback
- 15.20 Evolution Memory

## 20. DOMAIN 16 — DATA & PERSISTENCE

Subdomains:
- 16.1 PostgreSQL Architecture
- 16.2 Schema Strategy
- 16.3 SQLAlchemy Models
- 16.4 Alembic
- 16.5 RLS
- 16.6 Tenant Isolation
- 16.7 Index Strategy
- 16.8 Partitioning
- 16.9 JSONB Strategy
- 16.10 Vector Storage
- 16.11 Graph Storage
- 16.12 Artifact Storage
- 16.13 Event Storage
- 16.14 Backup
- 16.15 Recovery

## 21. DOMAIN 17 — API & INTEGRATION

Subdomains:
- 17.1 API Gateway
- 17.2 REST API
- 17.3 WebSocket
- 17.4 Internal API
- 17.5 Event Bus
- 17.6 Webhooks
- 17.7 Plugin Architecture
- 17.8 External Tools
- 17.9 Source Providers
- 17.10 SDK

## 22. DOMAIN 18 — FRONTEND

Subdomains:
- 18.1 Web Application
- 18.2 IDE Interface
- 18.3 Code Editor
- 18.4 AI Chat
- 18.5 Agent Dashboard
- 18.6 Task Graph Visualization
- 18.7 Execution Console
- 18.8 Evidence Viewer
- 18.9 Memory Explorer
- 18.10 Policy Console
- 18.11 Evolution Dashboard
- 18.12 Administration

## 23. DOMAIN 19 — SECURITY

Subdomains:
- 19.1 Threat Model
- 19.2 Zero Trust
- 19.3 Secrets Management
- 19.4 Encryption
- 19.5 Key Management
- 19.6 Supply Chain Security
- 19.7 Dependency Security
- 19.8 Code Security
- 19.9 Sandbox Security
- 19.10 Network Security
- 19.11 Audit Security
- 19.12 Incident Response

## 24. DOMAIN 20 — QUALITY ENGINEERING

Subdomains:
- 20.1 Test Strategy
- 20.2 Unit Tests
- 20.3 Integration Tests
- 20.4 Contract Tests
- 20.5 End-to-End Tests
- 20.6 Security Tests
- 20.7 Performance Tests
- 20.8 Chaos Testing
- 20.9 Regression Tests
- 20.10 Benchmark Tests
- 20.11 Test Evidence

## 25. DOMAIN 21 — DEVOPS & DELIVERY

Subdomains:
- 21.1 Local Development
- 21.2 Docker
- 21.3 Podman
- 21.4 CI
- 21.5 CD
- 21.6 Build Pipeline
- 21.7 Artifact Registry
- 21.8 Infrastructure as Code
- 21.9 Staging
- 21.10 Production
- 21.11 Rollback

## 26. DOMAIN 22 — OPERATIONS

Subdomains:
- 22.1 Runtime Monitoring
- 22.2 Alerting
- 22.3 Incident Management
- 22.4 SLO / SLA
- 22.5 Capacity Management
- 22.6 Cost Management
- 22.7 Backup Operations
- 22.8 Disaster Recovery
- 22.9 Operational Runbooks

## 27. DOMAIN 23 — PRODUCT EVOLUTION

Subdomains:
- 23.1 MVP
- 23.2 Alpha
- 23.3 Beta
- 23.4 Enterprise
- 23.5 Scaling
- 23.6 Plugin Ecosystem
- 23.7 API Ecosystem
- 23.8 Marketplace
- 23.9 Long-Term Evolution

## 28. INDEX AUTHORITY

The canonical index defines the valid architectural domains of YAHRIA.
**New domains MUST NOT be silently introduced.**

A new domain requires:

```
Proposal
   ↓
Dependency Analysis
   ↓
Architectural Decision
   ↓
Versioned Index Amendment
```

END OF CANONICAL INDEX
