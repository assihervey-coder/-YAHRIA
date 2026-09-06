# YAHRIA — DEPENDENCY GRAPH

> **Extraction autonome** : ce fichier était précédemment *embarqué* dans
> `00_AUTONOMOUS_CODING_CONTRACT.md` (§3). Il est ici promu en fichier racine
> autonome, conformément à la ROOT REQUIRED STRUCTURE du contrat.
> Contenu extrait fidèlement, version 1.0.0.

Document ID: YAHRIA-ROOT-002
Status: CANONICAL
Authority: IMPLEMENTATION ORDER
Version: 1.0.0

---

## 1. PURPOSE

This document defines the authoritative dependency order for implementing YAHRIA.

- Numerical domain order is **not necessarily** implementation order.
- **The dependency graph is authoritative.**
- No domain may require an unfinished dependency unless explicitly declared as an interface-only dependency.

## 2. ROOT IMPLEMENTATION FLOW

```
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
```

## 3. PHASE 00 — INITIALIZATION

```
00
 ↓
GLOBAL INVARIANTS
 ↓
ARCHITECTURE DECISIONS
 ↓
CANONICAL VOCABULARY
```

All subsequent phases depend on Phase 00.

## 4. PHASE 01 — FOUNDATION

Dependencies: `00 → 01`

Provides:
- monorepo
- shared libraries
- configuration
- environment model
- dependency management
- backend foundation
- frontend foundation

## 5. PHASE 02 — DATA FOUNDATION

Implementation authority: `00 → 01 → 16`

The data domain is implemented progressively. Initial work includes:
- database architecture
- schema conventions
- base models
- SQLAlchemy conventions
- Alembic conventions
- RLS architecture
- tenant boundaries

Domain-specific persistence is implemented with the relevant domain.

## 6. PHASE 03 — IDENTITY

```
00 → 01 → 16 foundation → 02
```

Provides:
- identity
- tenant context
- organization context
- authorization foundation

## 7. PHASE 04 — PROJECT & WORKSPACE

Dependencies: `02 → 03`

Requires:
- identity
- tenant ownership
- organization ownership
- repository abstraction

## 8. PHASE 05 — CODE GENOME

Dependencies: `03 → 04`

Requires:
- project
- repository
- workspace
- source synchronization

Provides knowledge to:
- Cognitive Core
- Agents
- Task Graph
- Memory
- Learning

## 9. PHASE 06 — AGENT OS

Dependencies: `02, 03, 04 → 05`

Requires:
- identity
- project context
- code knowledge interfaces

Provides:
- agents
- agent lifecycle
- agent coordination
- agent capabilities

## 10. PHASE 07 — COGNITIVE CORE

Dependencies: `04, 05 → 06`

The Cognitive Core consumes:
- code knowledge
- agent capabilities
- context
- world state

It produces:
- goals
- plans
- decisions
- verification plans

## 11. PHASE 08 — TASK GRAPH

Dependencies: `06 → 07`

Converts:

```
goal
 ↓
task decomposition
 ↓
dependency graph
 ↓
execution plan
```

## 12. PHASE 09 — EXECUTION FABRIC

Dependencies: `07 → 08`

Provides:
- execution lifecycle
- execution context
- execution persistence
- workers
- retries
- timeouts
- recovery

## 13. PHASE 10 — TOOL REGISTRY

Dependencies: `05, 07, 08 → 09`

Provides:
- tool discovery
- tool contracts
- capabilities
- validation
- authorization interfaces
- execution

## 14. PHASE 11 — SANDBOX

Dependencies: `08, 09 → 10`

Provides safe execution boundaries.

Critical dependency:

```
execution + tool runtime
        ↓
      sandbox
```

## 15. PHASE 12 — OBSERVABILITY

Dependencies: `08, 09, 10 → 11`

Observes:
- execution
- tools
- sandbox
- artifacts
- resources

Provides:
- events
- traces
- metrics
- logs
- evidence
- replay
- audit

## 16. PHASE 13 — POLICY CONTROL PLANE

Policy must ultimately govern all layers.
However, its implementation becomes fully operational after:
- identity
- execution
- tools
- sandbox
- observability

Dependencies: `02, 08, 09, 10, 11 → 12`

After implementation, Policy Control Plane becomes a **cross-cutting authority**.

## 17. PHASE 14 — MEMORY

Dependencies: `04, 05, 06, 07, 11, 12 → 13`

Memory consumes:
- code knowledge
- agent activity
- cognitive decisions
- execution history
- evidence
- policy context

## 18. PHASE 15 — LEARNING

Dependencies: `13, 11, 12 → 14`

Learning requires:
- memory
- evidence
- verification
- policy constraints

## 19. PHASE 16 — SELF-EVOLUTION

Dependencies: `13, 14, 12, 20 → 15`

Self-evolution requires:
- memory
- learning
- policy governance
- benchmark infrastructure

> **No evolution system may be promoted before its evaluation infrastructure exists.**

## 20. PHASE 17 — API & INTEGRATION

Dependencies: `CORE DOMAINS → 17`

The API layer exposes stable domain contracts.
It MUST NOT become the place where business logic is duplicated.

## 21. PHASE 18 — FRONTEND

Dependencies: `17 → 18`

Frontend depends on stable contracts.
The UI MUST NOT contain critical domain logic.

## 22. PHASE 19 — SECURITY HARDENING

Security is cross-cutting from the beginning.
The hardening phase depends on:

Dependencies: `02, 09, 10, 11, 12, 17, 18 → 19`

Security tests must also run during all earlier phases.

## 23. PHASE 20 — QUALITY ENGINEERING

Quality is continuous.
The Quality domain becomes fully integrated after:
- core domains
- API
- Frontend
- Security

Dependencies: `01 → 20`

Tests are mandatory throughout implementation.

## 24. PHASE 21 — DEVOPS

Dependencies: `01, 16, 17, 19, 20 → 21`

Provides:
- CI
- CD
- artifact management
- infrastructure
- staging
- production
- rollback

## 25. PHASE 22 — OPERATIONS

Dependencies: `11, 19, 21 → 22`

Provides production operational capability.

## 26. PHASE 23 — PRODUCT EVOLUTION

Dependencies: `22 → 23`

Product evolution uses operational evidence and controlled roadmap progression.

## 27. CROSS-CUTTING DEPENDENCIES

The following domains are cross-cutting:

- 00 Constitution
- 16 Data
- 19 Security
- 20 Quality
- 12 Policy
- 11 Observability

They may be implemented progressively but remain authoritative across the architecture.

## 28. FORBIDDEN DEPENDENCIES

The following dependency patterns are prohibited unless explicitly approved:

- Frontend → Database
- Agent → Sandbox internals
- Cognitive Core → specific LLM provider
- Memory → direct production mutation
- Self-Evolution → direct production modification
- Tool → bypass Policy Engine
- Sandbox → host trust
- Lower domain → UI business logic

## 29. CYCLE PREVENTION

Circular dependencies are prohibited.

```
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
```

## 30. FINAL IMPLEMENTATION DIRECTIVE

The system MUST follow:

```
DEPENDENCIES FIRST
INTERFACES SECOND
IMPLEMENTATION THIRD
TESTS FOURTH
EVIDENCE FIFTH
PROMOTION LAST
```

## 31. FINAL PRINCIPLE

> **DO NOT IMPLEMENT WHAT DEPENDS ON SOMETHING THAT DOES NOT EXIST YET.**

The Dependency Graph is the authoritative source for implementation sequencing.

END OF DEPENDENCY GRAPH
