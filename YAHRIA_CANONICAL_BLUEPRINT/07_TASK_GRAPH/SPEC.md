# Domaine 07 — TASK GRAPH & ORCHESTRATION

Document ID: YAHRIA-DOMAIN-07
Status: DOMAIN SPEC (LEVEL 6)
Authority: CANONICAL_INDEX + DEPENDENCY_GRAPH
Version: 1.0.0

## But canonique

Décomposition des buts en graphe de tâches exécutable (DAG) gouverné.

## Sous-domaines

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

## Dépendances (DEPENDENCY_GRAPH)

06 → 07. Convertit but → décomposition → graphe → plan d'exécution.

## Correspondances d'implémentation (ce dépôt)

- `src/lib/yahria/state-machines.ts (TASK_MACHINE)`
- `src/app/api/yahria/tasks/route.ts (INV-091)`

---

> Ce SPEC est un document de niveau 6 (DOMAIN SPEC). Il ne peut pas contredire
> les niveaux supérieurs (constitution, invariants, ADR, index, graphe).
> Toute extension de domaine suit ADR-0001 : amendement versionné.
