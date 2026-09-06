# Domaine 19 — SECURITY

Document ID: YAHRIA-DOMAIN-19
Status: DOMAIN SPEC (LEVEL 6)
Authority: CANONICAL_INDEX + DEPENDENCY_GRAPH
Version: 1.0.0

## But canonique

Sécurité transversale : zero trust, secrets, supply chain, sandbox, incidents.

## Sous-domaines

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

## Dépendances (DEPENDENCY_GRAPH)

Transversal ; durcissement après 02, 09, 10, 11, 12, 17, 18 → 19.

## Correspondances d'implémentation (ce dépôt)

- `src/lib/yahria/policy-engine.ts (deny-by-default)`
- `src/lib/yahria/execution-fabric.ts (profils sandbox)`

---

> Ce SPEC est un document de niveau 6 (DOMAIN SPEC). Il ne peut pas contredire
> les niveaux supérieurs (constitution, invariants, ADR, index, graphe).
> Toute extension de domaine suit ADR-0001 : amendement versionné.
