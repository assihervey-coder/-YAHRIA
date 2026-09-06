# Domaine 09 — TOOL REGISTRY ENGINE

Document ID: YAHRIA-DOMAIN-09
Status: DOMAIN SPEC (LEVEL 6)
Authority: CANONICAL_INDEX + DEPENDENCY_GRAPH
Version: 1.0.0

## But canonique

Outils : découverte, contrats, capacités, validation, autorisation, exécution.

## Sous-domaines

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

## Dépendances (DEPENDENCY_GRAPH)

05, 07, 08 → 09.

## Correspondances d'implémentation (ce dépôt)

- `src/lib/yahria/agent-os.ts (capacités)`
- `src/lib/yahria/policy-engine.ts (POL tool.*)`

---

> Ce SPEC est un document de niveau 6 (DOMAIN SPEC). Il ne peut pas contredire
> les niveaux supérieurs (constitution, invariants, ADR, index, graphe).
> Toute extension de domaine suit ADR-0001 : amendement versionné.
