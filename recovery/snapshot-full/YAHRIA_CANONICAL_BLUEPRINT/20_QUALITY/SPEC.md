# Domaine 20 — QUALITY ENGINEERING

Document ID: YAHRIA-DOMAIN-20
Status: DOMAIN SPEC (LEVEL 6)
Authority: CANONICAL_INDEX + DEPENDENCY_GRAPH
Version: 1.0.0

## But canonique

Stratégie de test continue : unitaires, intégration, E2E, chaos, régression.

## Sous-domaines

- 20.1 Test Strategy
- 20.2 Unit Tests
- 20.3 Integration Tests
- 20.4 Contract Tests
- 20.5 End-to-End Tests
- 20.6 Security Tests
- 20.7 Performance Tests
- 20.8 Chaos Testing
- 20.9 Regression Tests
- 20.10 Benchmark Tests
- 20.11 Test Evidence

## Dépendances (DEPENDENCY_GRAPH)

01 → 20 (continue). « A test exists to validate a claim. »

## Correspondances d'implémentation (ce dépôt)

- `scripts/ws-test.mjs (E2E WebSocket)`
- `scripts/render_mindmap.py (génération vérifiée)`

---

> Ce SPEC est un document de niveau 6 (DOMAIN SPEC). Il ne peut pas contredire
> les niveaux supérieurs (constitution, invariants, ADR, index, graphe).
> Toute extension de domaine suit ADR-0001 : amendement versionné.
