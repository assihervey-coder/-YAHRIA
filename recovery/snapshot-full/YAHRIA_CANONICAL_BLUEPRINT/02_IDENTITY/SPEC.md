# Domaine 02 — IDENTITY & ORGANIZATION

Document ID: YAHRIA-DOMAIN-02
Status: DOMAIN SPEC (LEVEL 6)
Authority: CANONICAL_INDEX + DEPENDENCY_GRAPH
Version: 1.0.0

## But canonique

Définir identités, frontières d'autorisation et propriété organisationnelle.

## Sous-domaines

- 02.1 Identity
- 02.2 Authentication
- 02.3 Authorization
- 02.4 RBAC
- 02.5 ABAC
- 02.6 Organizations
- 02.7 Tenants
- 02.8 Teams
- 02.9 Memberships
- 02.10 Audit Identity

## Dépendances (DEPENDENCY_GRAPH)

01 → 16 fondation → 02.

## Correspondances d'implémentation (ce dépôt)

- `prisma/schema.prisma (Tenant, Org, Project)`
- `src/lib/yahria/types.ts`

---

> Ce SPEC est un document de niveau 6 (DOMAIN SPEC). Il ne peut pas contredire
> les niveaux supérieurs (constitution, invariants, ADR, index, graphe).
> Toute extension de domaine suit ADR-0001 : amendement versionné.
