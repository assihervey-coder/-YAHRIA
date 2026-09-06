# Domaine 08 — EXECUTION FABRIC

Document ID: YAHRIA-DOMAIN-08
Status: DOMAIN SPEC (LEVEL 6)
Authority: CANONICAL_INDEX + DEPENDENCY_GRAPH
Version: 1.0.0

## But canonique

Cycle de vie d'exécution : orchestration, persistance, workers, retries, recovery.

## Sous-domaines

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

## Dépendances (DEPENDENCY_GRAPH)

07 → 08.

## Correspondances d'implémentation (ce dépôt)

- `src/lib/yahria/execution-fabric.ts`
- `src/app/api/yahria/executions/route.ts`

---

> Ce SPEC est un document de niveau 6 (DOMAIN SPEC). Il ne peut pas contredire
> les niveaux supérieurs (constitution, invariants, ADR, index, graphe).
> Toute extension de domaine suit ADR-0001 : amendement versionné.
