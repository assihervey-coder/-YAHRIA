# Domaine 01 — FOUNDATION & PLATFORM CORE

Document ID: YAHRIA-DOMAIN-01
Status: DOMAIN SPEC (LEVEL 6)
Authority: CANONICAL_INDEX + DEPENDENCY_GRAPH
Version: 1.0.0

## But canonique

Fournir la fondation technique commune à tous les autres domaines.

## Sous-domaines

- 01.1 Monorepo
- 01.2 Backend Foundation
- 01.3 Frontend Foundation
- 01.4 Database Foundation
- 01.5 Configuration
- 01.6 Dependency Management
- 01.7 Environment Management
- 01.8 Feature Flags
- 01.9 Shared Libraries

## Dépendances (DEPENDENCY_GRAPH)

00 → 01.

## Correspondances d'implémentation (ce dépôt)

- `package.json`
- `next.config.ts`
- `prisma/schema.prisma`
- `server.mjs`

---

> Ce SPEC est un document de niveau 6 (DOMAIN SPEC). Il ne peut pas contredire
> les niveaux supérieurs (constitution, invariants, ADR, index, graphe).
> Toute extension de domaine suit ADR-0001 : amendement versionné.
