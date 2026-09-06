# Domaine 21 — DEVOPS & DELIVERY

Document ID: YAHRIA-DOMAIN-21
Status: DOMAIN SPEC (LEVEL 6)
Authority: CANONICAL_INDEX + DEPENDENCY_GRAPH
Version: 1.0.0

## But canonique

CI/CD, artefacts, infrastructure, staging, production, rollback.

## Sous-domaines

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

## Dépendances (DEPENDENCY_GRAPH)

01, 16, 17, 19, 20 → 21.

## Correspondances d'implémentation (ce dépôt)

- `package.json (scripts dev/build/start)`
- `server.mjs (serveur unifié dev+prod)`

---

> Ce SPEC est un document de niveau 6 (DOMAIN SPEC). Il ne peut pas contredire
> les niveaux supérieurs (constitution, invariants, ADR, index, graphe).
> Toute extension de domaine suit ADR-0001 : amendement versionné.
