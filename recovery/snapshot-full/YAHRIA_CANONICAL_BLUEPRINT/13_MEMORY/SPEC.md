# Domaine 13 — MEMORY SYSTEM

Document ID: YAHRIA-DOMAIN-13
Status: DOMAIN SPEC (LEVEL 6)
Authority: CANONICAL_INDEX + DEPENDENCY_GRAPH
Version: 1.0.0

## But canonique

Mémoire de travail, épisodique, sémantique, procédurale, architecturale.

## Sous-domaines

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

## Dépendances (DEPENDENCY_GRAPH)

04, 05, 06, 07, 11, 12 → 13. MEMORY ≠ POLICY.

## Correspondances d'implémentation (ce dépôt)

- `prisma/schema.prisma (MemoryRecord)`
- `src/lib/yahria/agent-os.ts (interface mémoire)`

---

> Ce SPEC est un document de niveau 6 (DOMAIN SPEC). Il ne peut pas contredire
> les niveaux supérieurs (constitution, invariants, ADR, index, graphe).
> Toute extension de domaine suit ADR-0001 : amendement versionné.
