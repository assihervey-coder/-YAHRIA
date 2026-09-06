# Domaine 12 — POLICY & GOVERNANCE CONTROL PLANE

Document ID: YAHRIA-DOMAIN-12
Status: DOMAIN SPEC (LEVEL 6)
Authority: CANONICAL_INDEX + DEPENDENCY_GRAPH
Version: 1.0.0

## But canonique

Gouvernance transversale deny-by-default : RBAC/ABAC unifiés, règles, décisions.

## Sous-domaines

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

## Dépendances (DEPENDENCY_GRAPH)

02, 08, 09, 10, 11 → 12. Devient autorité transversale après implémentation (ADR-0004).

## Correspondances d'implémentation (ce dépôt)

- `src/lib/yahria/policy-engine.ts (POL-001 → POL-010, DENY par défaut)`
- `src/app/api/yahria/policy/route.ts`

---

> Ce SPEC est un document de niveau 6 (DOMAIN SPEC). Il ne peut pas contredire
> les niveaux supérieurs (constitution, invariants, ADR, index, graphe).
> Toute extension de domaine suit ADR-0001 : amendement versionné.
