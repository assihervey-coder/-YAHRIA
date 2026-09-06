figeons définitivement trois documents racines :
00_AUTONOMOUS_CODING_CONTRACT.md
CANONICAL_INDEX.md
DEPENDENCY_GRAPH.md
Oui. Nous allons maintenant les figer comme documents constitutionnels racines de YAHRIA.
Ces trois fichiers ne doivent pas être de simples fichiers d'information. Ils doivent former le contrat de lecture et d'exécution de tout système de codage automatique qui recevra ton ZIP.
Je recommande le principe suivant :
00_AUTONOMOUS_CODING_CONTRACT.md
            │
            ▼
      CANONICAL_INDEX.md
            │
            ▼
    DEPENDENCY_GRAPH.md
            │
            ▼
   DOMAIN SPECIFICATIONS
            │
            ▼
      IMPLEMENTATION
            │
            ▼
     TEST & EVIDENCE
Voici les versions canoniques à figer.

1. 00_AUTONOMOUS_CODING_CONTRACT.md
YAHRIA — AUTONOMOUS CODING CONTRACT
Document ID: YAHRIA-ROOT-000
Status: CANONICAL
Authority: CONSTITUTIONAL
Version: 1.0.0
Modification Policy: Explicit versioned amendment only

1. PURPOSE
This document defines the mandatory operating contract for every human, AI system, coding agent, automation engine, compiler-assisted workflow, or autonomous software development system participating in the implementation of YAHRIA.
This document MUST be read before any implementation, modification, code generation, schema creation, infrastructure change, or architectural decision.
No implementation instruction may override this contract unless the contract itself is explicitly amended.

2. MANDATORY READING ORDER
Before performing any work, the implementation system MUST read the following documents in this exact order:
1. 00_AUTONOMOUS_CODING_CONTRACT.md
2. CANONICAL_INDEX.md
3. DEPENDENCY_GRAPH.md
4. GLOBAL_INVARIANTS.md
5. ARCHITECTURE_DECISIONS.md
6. Relevant domain specification
7. Relevant subdomain specification
The system MUST NOT skip a document required by the dependency graph.

3. CANONICAL SOURCE OF TRUTH
The YAHRIA blueprint is the canonical source of architectural intent.
The implementation system MUST NOT:
    • invent undocumented architecture;
    • silently redefine a domain;
    • merge independent domains;
    • bypass declared dependencies;
    • create hidden architectural layers;
    • introduce incompatible abstractions;
    • replace an explicit design with an arbitrary alternative.
When ambiguity exists, the system MUST:
STOP
   ↓
IDENTIFY AMBIGUITY
   ↓
LOCATE RELEVANT SPECIFICATION
   ↓
CHECK DEPENDENCY GRAPH
   ↓
CHECK ARCHITECTURE DECISIONS
   ↓
REQUEST CLARIFICATION IF STILL UNRESOLVED
The system MUST NOT guess.

4. IMPLEMENTATION ORDER
Domains MUST be implemented according to the dependency order defined in:
DEPENDENCY_GRAPH.md
Numerical folder order is organizational.
Dependency order is authoritative.
A domain MUST NOT depend on an unfinished lower-level dependency.

5. DOMAIN BOUNDARIES
Each domain has an explicit responsibility.
An implementation system MUST:
    • preserve domain boundaries;
    • expose explicit interfaces;
    • avoid circular dependencies;
    • avoid hidden cross-domain database access;
    • avoid importing internal implementation details unnecessarily.
Cross-domain interaction MUST occur through approved contracts.
Examples include:
API contracts
domain events
application services
ports
repositories
published interfaces

6. DATABASE RULES
Every persistent model MUST explicitly define:
primary key
foreign keys
tenant boundary where applicable
organization boundary where applicable
constraints
indexes
timestamps
versioning where required
Database rules:
    1. No schema change without migration.
    2. No destructive migration without explicit policy.
    3. No production data mutation without auditability.
    4. No tenant data leakage.
    5. RLS MUST be enforced where required.
    6. Critical data MUST preserve lineage.
    7. Evidence MUST remain traceable to its source.
    8. Immutable records MUST NOT be silently updated.

7. MULTI-TENANCY
Unless explicitly declared otherwise, YAHRIA operates as a multi-tenant system.
Tenant boundaries are security boundaries.
The implementation MUST NOT:
query tenant data without tenant context
cache tenant data without tenant isolation
join tenant data across boundaries without authorization
execute tasks without execution ownership
Every multi-tenant operation MUST be attributable.

8. SECURITY
Security is not an optional post-development phase.
Security requirements apply during:
design
implementation
testing
execution
deployment
operations
evolution
The implementation system MUST NOT:
    • bypass authorization;
    • disable security controls;
    • expose secrets;
    • execute untrusted code on the host;
    • weaken sandbox boundaries;
    • disable audit mechanisms;
    • silently reduce evidence collection.

9. EXECUTION SAFETY
Untrusted or dynamically generated code MUST execute in an appropriate isolated environment.
Critical execution MUST support:
resource limits
timeout limits
process limits
filesystem isolation
network controls
policy enforcement
evidence capture
Production execution MUST NOT rely on implicit trust in generated code.

10. POLICY PRECEDENCE
The Policy & Governance Control Plane has authority over:
agent actions
tool usage
execution permissions
sandbox permissions
data access
evolution permissions
critical modifications
A policy denial MUST override an AI recommendation.
POLICY DENY > MODEL REQUEST

11. EVIDENCE REQUIREMENT
Critical system actions MUST produce verifiable evidence.
Evidence SHOULD include, where applicable:
input
execution identity
timestamp
policy context
tool context
execution result
artifacts
verification result
A model assertion alone is not evidence.

12. TESTING REQUIREMENT
Implementation MUST be validated.
Where applicable, validation MUST include:
unit tests
integration tests
contract tests
security tests
regression tests
end-to-end tests
A module MUST NOT be considered complete solely because code compiles.

13. DEFINITION OF DONE
A domain, feature, or component is complete only when:
SPECIFICATION
      +
IMPLEMENTATION
      +
TESTS
      +
VALIDATION
      +
DOCUMENTATION
      +
MIGRATION (if applicable)
      +
EVIDENCE
are complete.

14. ARCHITECTURAL CHANGE CONTROL
Architectural changes MUST be explicit.
Required process:
CHANGE PROPOSAL
       ↓
IMPACT ANALYSIS
       ↓
DEPENDENCY ANALYSIS
       ↓
SECURITY REVIEW
       ↓
ARCHITECTURAL DECISION
       ↓
VERSIONED IMPLEMENTATION
       ↓
TEST
       ↓
EVIDENCE
Silent architectural drift is prohibited.

15. NO FUTURE PHASE LEAKAGE
The implementation system MUST NOT prematurely implement unrelated future domains.
Example:
Implementing the Sandbox Engine
does not authorize implementing
Self-Evolution logic.
A domain may define extension interfaces for future domains but MUST NOT implement future business logic without authorization.

16. VERSIONING
All critical artifacts MUST be versionable.
This includes, where applicable:
schemas
policies
tools
agents
workflows
prompts
strategies
benchmarks
experiments
evolution candidates
A promoted version MUST remain reproducible.

17. REPRODUCIBILITY
Critical executions MUST be reproducible where technically possible.
The system SHOULD preserve:
input
configuration
versions
policy snapshot
tool versions
environment information
artifacts
evidence

18. EVOLUTION SAFETY
YAHRIA MAY propose improvements.
YAHRIA MUST NOT autonomously promote critical changes directly into production.
Evolution requires:
HYPOTHESIS
   ↓
EXPERIMENT
   ↓
BENCHMARK
   ↓
VERIFICATION
   ↓
EVIDENCE
   ↓
POLICY EVALUATION
   ↓
APPROVAL
   ↓
CANARY
   ↓
PROMOTION
The AI system MUST NOT approve its own critical evolution.

19. IMMUTABLE SYSTEM PRINCIPLES
The following principles MUST NOT be silently weakened:
tenant isolation
policy enforcement
auditability
evidence integrity
sandbox isolation
security boundaries
rollback capability
architectural versioning
Any modification requires explicit constitutional amendment.

20. FAILURE HANDLING
When uncertainty, inconsistency, missing dependency, or architectural conflict is detected:
DO NOT GUESS
DO NOT SILENTLY CONTINUE
DO NOT INVENT
The implementation system MUST:
STOP
REPORT
ISOLATE
ANALYZE
REQUEST DECISION

21. IMPLEMENTATION LOOP
Every implementation cycle SHOULD follow:
READ
  ↓
UNDERSTAND
  ↓
PLAN
  ↓
CHECK DEPENDENCIES
  ↓
IMPLEMENT
  ↓
TEST
  ↓
VERIFY
  ↓
DOCUMENT
  ↓
RECORD EVIDENCE
  ↓
COMPLETE

22. FINAL AUTHORITY RULE
When instructions conflict, authority is:
CONSTITUTION
        ↓
AUTONOMOUS CODING CONTRACT
        ↓
GLOBAL INVARIANTS
        ↓
ARCHITECTURE DECISIONS
        ↓
DEPENDENCY GRAPH
        ↓
CANONICAL DOMAIN SPECIFICATIONS
        ↓
IMPLEMENTATION TASKS
        ↓
LOCAL CODE
A lower-level instruction MUST NOT override a higher-level authority.

23. FINAL DIRECTIVE
The purpose of YAHRIA is not merely to generate code.
The purpose is to construct:
A VERIFIED
REPRODUCIBLE
SECURE
GOVERNED
EVIDENCE-DRIVEN
AUTONOMOUS SOFTWARE INTELLIGENCE SYSTEM
Every implementation decision MUST preserve this objective.

END OF CANONICAL CONTRACT

2. CANONICAL_INDEX.md
YAHRIA — CANONICAL INDEX
Document ID: YAHRIA-ROOT-001
Status: CANONICAL
Authority: ROOT INDEX
Version: 1.0.0

1. PURPOSE
This document defines the canonical domain structure of the YAHRIA system.
Every implementation, specification, database model, API, service, test, and deployment artifact MUST belong to one or more declared domains.
The index defines:
DOMAIN
RESPONSIBILITY
SUBDOMAINS
PRIMARY DEPENDENCIES
Detailed implementation order is defined by:
DEPENDENCY_GRAPH.md

2. ROOT DOCUMENTS
00_AUTONOMOUS_CODING_CONTRACT.md
CANONICAL_INDEX.md
DEPENDENCY_GRAPH.md
GLOBAL_INVARIANTS.md
ARCHITECTURE_DECISIONS.md
README.md

3. CANONICAL DOMAIN MAP
00 INITIALIZATION & CONSTITUTION

01 FOUNDATION & PLATFORM CORE

02 IDENTITY & ORGANIZATION

03 PROJECT & WORKSPACE DOMAIN

04 CODE GENOME & SOFTWARE KNOWLEDGE GRAPH

05 AGENT OPERATING SYSTEM

06 COGNITIVE CORE

07 TASK GRAPH & ORCHESTRATION

08 EXECUTION FABRIC

09 TOOL REGISTRY ENGINE

10 SANDBOX ENGINE

11 EXECUTION OBSERVABILITY

12 POLICY & GOVERNANCE CONTROL PLANE

13 MEMORY SYSTEM

14 LEARNING ENGINE

15 SELF-EVOLUTION & META-INTELLIGENCE

16 DATA & PERSISTENCE

17 API & INTEGRATION

18 FRONTEND & USER EXPERIENCE

19 SECURITY

20 QUALITY ENGINEERING

21 DEVOPS & DELIVERY

22 OPERATIONS

23 PRODUCT EVOLUTION & ROADMAP

4. DOMAIN 00 — INITIALIZATION & CONSTITUTION
Purpose:
Define the identity and immutable architectural principles of YAHRIA.
Subdomains:
00.1 Vision
00.2 Mission
00.3 Product Principles
00.4 Constitution
00.5 Global Invariants
00.6 Architectural Principles
00.7 Security Principles
00.8 Definition of Done
00.9 Canonical Vocabulary

5. DOMAIN 01 — FOUNDATION & PLATFORM CORE
Purpose:
Provide the common technical foundation required by all other domains.
Subdomains:
01.1 Monorepo
01.2 Backend Foundation
01.3 Frontend Foundation
01.4 Database Foundation
01.5 Configuration
01.6 Dependency Management
01.7 Environment Management
01.8 Feature Flags
01.9 Shared Libraries

6. DOMAIN 02 — IDENTITY & ORGANIZATION
Purpose:
Define identities, authorization boundaries and organizational ownership.
02.1 Identity
02.2 Authentication
02.3 Authorization
02.4 RBAC
02.5 ABAC
02.6 Organizations
02.7 Tenants
02.8 Teams
02.9 Memberships
02.10 Audit Identity

7. DOMAIN 03 — PROJECT & WORKSPACE
03.1 Projects
03.2 Repositories
03.3 Workspaces
03.4 Branches
03.5 Environments
03.6 Project Configuration
03.7 Source Providers
03.8 Repository Synchronization
03.9 Project Metadata

8. DOMAIN 04 — CODE GENOME
04.1 Code Ingestion
04.2 File Intelligence
04.3 Symbol Extraction
04.4 Dependency Graph
04.5 Call Graph
04.6 Type Graph
04.7 Repository Graph
04.8 Software Knowledge Graph
04.9 Change Impact Analysis
04.10 Code Embeddings
04.11 Semantic Retrieval
04.12 Code Memory
04.13 Code Genome Evolution

9. DOMAIN 05 — AGENT OPERATING SYSTEM
05.1 Agent Identity
05.2 Agent Registry
05.3 Agent Capability Model
05.4 Agent Lifecycle
05.5 Agent Communication
05.6 Agent Context
05.7 Agent Memory Interface
05.8 Agent State
05.9 Agent Coordination
05.10 Agent Scheduling
05.11 Agent Routing
05.12 Agent Evaluation
05.13 Agent Governance

10. DOMAIN 06 — COGNITIVE CORE
06.1 Intent Understanding
06.2 Goal Modeling
06.3 World State
06.4 Context Assembly
06.5 Reasoning Interface
06.6 Planning Engine
06.7 Strategy Selection
06.8 Uncertainty Engine
06.9 Verification Planning
06.10 Reflection
06.11 Cognitive Routing
06.12 Decision Engine
06.13 Cognitive Safety

11. DOMAIN 07 — TASK GRAPH & ORCHESTRATION
07.1 Task Model
07.2 Goal Decomposition
07.3 Task Graph
07.4 DAG Engine
07.5 Dependency Resolution
07.6 Scheduling
07.7 State Machine
07.8 Retry Strategy
07.9 Compensation
07.10 Cancellation
07.11 Task Verification
07.12 Human Intervention
07.13 Task Governance

12. DOMAIN 08 — EXECUTION FABRIC
08.0 Execution Domain
08.1 Execution Orchestrator
08.2 Execution State Machine
08.3 Execution Context
08.4 Execution Persistence
08.5 Execution Queue
08.6 Execution Worker
08.7 Execution Retry
08.8 Execution Timeout
08.9 Execution Cancellation
08.10 Execution Recovery

13. DOMAIN 09 — TOOL REGISTRY ENGINE
09.1 Tool Registry
09.2 Tool Definition
09.3 Tool Versioning
09.4 Tool Discovery
09.5 Tool Capability
09.6 Tool Contract
09.7 Tool Schema
09.8 Tool Validator
09.9 Capability Engine
09.10 Tool Authorization
09.11 Tool Executor
09.12 Tool Result
09.13 Tool Governance

14. DOMAIN 10 — SANDBOX ENGINE
10.1 Sandbox Contract
10.2 Security Profile
10.3 Runtime Adapter
10.4 Container Runtime
10.5 Podman Runtime
10.6 Filesystem Overlay
10.7 Workspace Isolation
10.8 Network Isolation
10.9 Egress Policy
10.10 DNS Policy
10.11 Resource Controller
10.12 CPU Limits
10.13 Memory Limits
10.14 Disk Limits
10.15 PID Limits
10.16 Process Control
10.17 Timeout Control

15. DOMAIN 11 — EXECUTION OBSERVABILITY
11.1 Structured Events
11.2 Distributed Traces
11.3 Metrics
11.4 Resource Telemetry
11.5 Execution Logs
11.6 Artifact Capture
11.7 Evidence Engine
11.8 Execution Lineage Graph
11.9 Replay Engine
11.10 Audit & Forensics
11.11 Retention Lifecycle
11.12 Compliance Integration

16. DOMAIN 12 — POLICY & GOVERNANCE
12.1 Unified RBAC
12.2 Unified ABAC
12.3 Policy Model
12.4 Policy DSL
12.5 Deterministic Rule Engine
12.6 Policy Simulator
12.7 Policy-as-Code
12.8 Policy Versioning
12.9 Policy Signatures
12.10 Policy Propagation
12.11 Policy Decision
12.12 Policy Enforcement
12.13 Cognitive Integration
12.14 Task Graph Integration

17. DOMAIN 13 — MEMORY SYSTEM
13.1 Memory Architecture
13.2 Working Memory
13.3 Episodic Memory
13.4 Semantic Memory
13.5 Procedural Memory
13.6 Architectural Memory
13.7 Memory Candidates
13.8 Memory Validation
13.9 Memory Consolidation
13.10 Memory Graph
13.11 Memory Retrieval
13.12 Memory Governance
13.13 Forgetting & Decay
13.14 Cognitive Integration

18. DOMAIN 14 — LEARNING ENGINE
14.1 Learning Extraction
14.2 Reflection Engine
14.3 Pattern Mining
14.4 Failure Intelligence
14.5 Success Intelligence
14.6 Strategy Learning
14.7 Agent Learning
14.8 Tool Learning
14.9 Model Learning
14.10 Knowledge Consolidation
14.11 Learning Validation
14.12 Learning Evidence

19. DOMAIN 15 — SELF-EVOLUTION
15.1 Meta-Intelligence Core
15.2 Self-Assessment
15.3 Capability Assessment
15.4 Strategy Intelligence
15.5 Strategy Optimization
15.6 Agent Evolution
15.7 Agent Genome
15.8 Workflow Evolution
15.9 Prompt Evolution
15.10 Model Routing Optimization
15.11 Tool Selection Optimization
15.12 Experimentation Engine
15.13 Comparative Testing
15.14 Benchmark Engine
15.15 Evolution Sandbox
15.16 Evolution Evaluation
15.17 Evolution Governance
15.18 Rollout
15.19 Rollback
15.20 Evolution Memory

20. DOMAIN 16 — DATA & PERSISTENCE
16.1 PostgreSQL Architecture
16.2 Schema Strategy
16.3 SQLAlchemy Models
16.4 Alembic
16.5 RLS
16.6 Tenant Isolation
16.7 Index Strategy
16.8 Partitioning
16.9 JSONB Strategy
16.10 Vector Storage
16.11 Graph Storage
16.12 Artifact Storage
16.13 Event Storage
16.14 Backup
16.15 Recovery

21. DOMAIN 17 — API & INTEGRATION
17.1 API Gateway
17.2 REST API
17.3 WebSocket
17.4 Internal API
17.5 Event Bus
17.6 Webhooks
17.7 Plugin Architecture
17.8 External Tools
17.9 Source Providers
17.10 SDK

22. DOMAIN 18 — FRONTEND
18.1 Web Application
18.2 IDE Interface
18.3 Code Editor
18.4 AI Chat
18.5 Agent Dashboard
18.6 Task Graph Visualization
18.7 Execution Console
18.8 Evidence Viewer
18.9 Memory Explorer
18.10 Policy Console
18.11 Evolution Dashboard
18.12 Administration

23. DOMAIN 19 — SECURITY
19.1 Threat Model
19.2 Zero Trust
19.3 Secrets Management
19.4 Encryption
19.5 Key Management
19.6 Supply Chain Security
19.7 Dependency Security
19.8 Code Security
19.9 Sandbox Security
19.10 Network Security
19.11 Audit Security
19.12 Incident Response

24. DOMAIN 20 — QUALITY ENGINEERING
20.1 Test Strategy
20.2 Unit Tests
20.3 Integration Tests
20.4 Contract Tests
20.5 End-to-End Tests
20.6 Security Tests
20.7 Performance Tests
20.8 Chaos Testing
20.9 Regression Tests
20.10 Benchmark Tests
20.11 Test Evidence

25. DOMAIN 21 — DEVOPS & DELIVERY
21.1 Local Development
21.2 Docker
21.3 Podman
21.4 CI
21.5 CD
21.6 Build Pipeline
21.7 Artifact Registry
21.8 Infrastructure as Code
21.9 Staging
21.10 Production
21.11 Rollback

26. DOMAIN 22 — OPERATIONS
22.1 Runtime Monitoring
22.2 Alerting
22.3 Incident Management
22.4 SLO / SLA
22.5 Capacity Management
22.6 Cost Management
22.7 Backup Operations
22.8 Disaster Recovery
22.9 Operational Runbooks

27. DOMAIN 23 — PRODUCT EVOLUTION
23.1 MVP
23.2 Alpha
23.3 Beta
23.4 Enterprise
23.5 Scaling
23.6 Plugin Ecosystem
23.7 API Ecosystem
23.8 Marketplace
23.9 Long-Term Evolution

28. INDEX AUTHORITY
The canonical index defines the valid architectural domains of YAHRIA.
New domains MUST NOT be silently introduced.
A new domain requires:
Proposal
   ↓
Dependency Analysis
   ↓
Architectural Decision
   ↓
Versioned Index Amendment

END OF CANONICAL INDEX

3. DEPENDENCY_GRAPH.md
YAHRIA — DEPENDENCY GRAPH
Document ID: YAHRIA-ROOT-002
Status: CANONICAL
Authority: IMPLEMENTATION ORDER
Version: 1.0.0

1. PURPOSE
This document defines the authoritative dependency order for implementing YAHRIA.
Numerical domain order is not necessarily implementation order.
The dependency graph is authoritative.
No domain may require an unfinished dependency unless explicitly declared as an interface-only dependency.

2. ROOT IMPLEMENTATION FLOW
00 INITIALIZATION
        ↓
01 FOUNDATION
        ↓
16 DATA FOUNDATION
        ↓
02 IDENTITY
        ↓
03 PROJECT & WORKSPACE
        ↓
04 CODE GENOME
        ↓
05 AGENT OS
        ↓
06 COGNITIVE CORE
        ↓
07 TASK GRAPH
        ↓
08 EXECUTION FABRIC
        ↓
09 TOOL REGISTRY
        ↓
10 SANDBOX ENGINE
        ↓
11 OBSERVABILITY
        ↓
12 POLICY CONTROL PLANE
        ↓
13 MEMORY
        ↓
14 LEARNING
        ↓
15 SELF-EVOLUTION
        ↓
17 API & INTEGRATION
        ↓
18 FRONTEND
        ↓
19 SECURITY HARDENING
        ↓
20 QUALITY ENGINEERING
        ↓
21 DEVOPS & DELIVERY
        ↓
22 OPERATIONS
        ↓
23 PRODUCT RELEASE EVOLUTION

3. PHASE 00 — INITIALIZATION
00
 ↓
GLOBAL INVARIANTS
 ↓
ARCHITECTURE DECISIONS
 ↓
CANONICAL VOCABULARY
All subsequent phases depend on Phase 00.

4. PHASE 01 — FOUNDATION
Dependencies:
00 → 01
Provides:
monorepo
shared libraries
configuration
environment model
dependency management
backend foundation
frontend foundation

5. PHASE 02 — DATA FOUNDATION
Implementation authority:
00
 ↓
01
 ↓
16
The data domain is implemented progressively.
Initial work includes:
database architecture
schema conventions
base models
SQLAlchemy conventions
Alembic conventions
RLS architecture
tenant boundaries
Domain-specific persistence is implemented with the relevant domain.

6. PHASE 03 — IDENTITY
00
 ↓
01
 ↓
16 foundation
 ↓
02
Provides:
identity
tenant context
organization context
authorization foundation

7. PHASE 04 — PROJECT & WORKSPACE
02
 ↓
03
Requires:
identity
tenant ownership
organization ownership
repository abstraction

8. PHASE 05 — CODE GENOME
03
 ↓
04
Requires:
project
repository
workspace
source synchronization
Provides knowledge to:
Cognitive Core
Agents
Task Graph
Memory
Learning

9. PHASE 06 — AGENT OS
02
03
04
 ↓
05
Requires:
identity
project context
code knowledge interfaces
Provides:
agents
agent lifecycle
agent coordination
agent capabilities

10. PHASE 07 — COGNITIVE CORE
04
05
 ↓
06
The Cognitive Core consumes:
code knowledge
agent capabilities
context
world state
It produces:
goals
plans
decisions
verification plans

11. PHASE 08 — TASK GRAPH
06
 ↓
07
Converts:
goal
 ↓
task decomposition
 ↓
dependency graph
 ↓
execution plan

12. PHASE 09 — EXECUTION FABRIC
07
 ↓
08
Provides:
execution lifecycle
execution context
execution persistence
workers
retries
timeouts
recovery

13. PHASE 10 — TOOL REGISTRY
05
07
08
 ↓
09
Provides:
tool discovery
tool contracts
capabilities
validation
authorization interfaces
execution

14. PHASE 11 — SANDBOX
08
09
 ↓
10
Provides safe execution boundaries.
Critical dependency:
execution
+
tool runtime
↓
sandbox

15. PHASE 12 — OBSERVABILITY
08
09
10
 ↓
11
Observes:
execution
tools
sandbox
artifacts
resources
Provides:
events
traces
metrics
logs
evidence
replay
audit

16. PHASE 13 — POLICY CONTROL PLANE
Policy must ultimately govern all layers.
However, its implementation becomes fully operational after:
identity
execution
tools
sandbox
observability
Dependency:
02
08
09
10
11
 ↓
12
After implementation, Policy Control Plane becomes a cross-cutting authority.

17. PHASE 14 — MEMORY
04
05
06
07
11
12
 ↓
13
Memory consumes:
code knowledge
agent activity
cognitive decisions
execution history
evidence
policy context

18. PHASE 15 — LEARNING
13
11
12
 ↓
14
Learning requires:
memory
evidence
verification
policy constraints

19. PHASE 16 — SELF-EVOLUTION
13
14
12
20
 ↓
15
Self-evolution requires:
memory
learning
policy governance
benchmark infrastructure
No evolution system may be promoted before its evaluation infrastructure exists.

20. PHASE 17 — API & INTEGRATION
CORE DOMAINS
 ↓
17
The API layer exposes stable domain contracts.
It MUST NOT become the place where business logic is duplicated.

21. PHASE 18 — FRONTEND
17
 ↓
18
Frontend depends on stable contracts.
The UI MUST NOT contain critical domain logic.

22. PHASE 19 — SECURITY HARDENING
Security is cross-cutting from the beginning.
The hardening phase depends on:
02
09
10
11
12
17
18
 ↓
19
Security tests must also run during all earlier phases.

23. PHASE 20 — QUALITY ENGINEERING
Quality is continuous.
The Quality domain becomes fully integrated after:
core domains
API
Frontend
Security
Dependency:
01 → 20
Tests are mandatory throughout implementation.

24. PHASE 21 — DEVOPS
01
16
17
19
20
 ↓
21
Provides:
CI
CD
artifact management
infrastructure
staging
production
rollback

25. PHASE 22 — OPERATIONS
11
19
21
 ↓
22
Provides production operational capability.

26. PHASE 23 — PRODUCT EVOLUTION
22
 ↓
23
Product evolution uses operational evidence and controlled roadmap progression.

27. CROSS-CUTTING DEPENDENCIES
The following domains are cross-cutting:
00 Constitution
16 Data
19 Security
20 Quality
12 Policy
11 Observability
They may be implemented progressively but remain authoritative across the architecture.

28. FORBIDDEN DEPENDENCIES
The following dependency patterns are prohibited unless explicitly approved:
Frontend → Database

Agent → Sandbox internals

Cognitive Core → specific LLM provider

Memory → direct production mutation

Self-Evolution → direct production modification

Tool → bypass Policy Engine

Sandbox → host trust

Lower domain → UI business logic

29. CYCLE PREVENTION
Circular dependencies are prohibited.
Before adding a dependency:
NEW DEPENDENCY
       ↓
CHECK GRAPH
       ↓
CYCLE DETECTED?
       │
   ┌───┴────┐
   ▼        ▼
  YES       NO
   │         │
REJECT     APPROVE

30. FINAL IMPLEMENTATION DIRECTIVE
The system MUST follow:
DEPENDENCIES FIRST
INTERFACES SECOND
IMPLEMENTATION THIRD
TESTS FOURTH
EVIDENCE FIFTH
PROMOTION LAST

31. FINAL PRINCIPLE
DO NOT IMPLEMENT WHAT DEPENDS
ON SOMETHING THAT DOES NOT EXIST YET.
The Dependency Graph is the authoritative source for implementation sequencing.

END OF DEPENDENCY GRAPH

Décision d'architecture à retenir
Ces trois documents constituent maintenant le noyau de pilotage de l'automatisation :
┌─────────────────────────────────────────┐
│  00_AUTONOMOUS_CODING_CONTRACT.md      │
│  QUELLES RÈGLES DOIVENT ÊTRE RESPECTÉES│
└───────────────────┬─────────────────────┘
                    ▼
┌─────────────────────────────────────────┐
│  CANONICAL_INDEX.md                     │
│  QUELS DOMAINES EXISTENT ?              │
└───────────────────┬─────────────────────┘
                    ▼
┌─────────────────────────────────────────┐
│  DEPENDENCY_GRAPH.md                    │
│  DANS QUEL ORDRE LES CONSTRUIRE ?       │
└───────────────────┬─────────────────────┘
                    ▼
             DOMAIN SPECS
                    ▼
              AUTO CODING

