# Domaine 16 — DATA & PERSISTENCE

Document ID: YAHRIA-DOMAIN-16
Status: DOMAIN SPEC (LEVEL 6)
Authority: CANONICAL_INDEX + DEPENDENCY_GRAPH
Version: 1.0.0

## But canonique

Architecture de données : schémas, migrations, RLS, JSONB, vecteurs, artefacts.

## Sous-domaines

- 16.1 PostgreSQL Architecture
- 16.2 Schema Strategy
- 16.3 SQLAlchemy Models
- 16.4 Alembic
- 16.5 RLS
- 16.6 Tenant Isolation
- 16.7 Index Strategy
- 16.8 Partitioning
- 16.9 JSONB Strategy
- 16.10 Vector Storage
- 16.11 Graph Storage
- 16.12 Artifact Storage
- 16.13 Event Storage
- 16.14 Backup
- 16.15 Recovery

## Dépendances (DEPENDENCY_GRAPH)

01 → 16 (implémentation précoce, transversale).

## Correspondances d'implémentation (ce dépôt)

- `prisma/schema.prisma (15 modèles)`
- `db/ (SQLite sandbox — cible PostgreSQL, ADR-0007/0010)`

---

> Ce SPEC est un document de niveau 6 (DOMAIN SPEC). Il ne peut pas contredire
> les niveaux supérieurs (constitution, invariants, ADR, index, graphe).
> Toute extension de domaine suit ADR-0001 : amendement versionné.
