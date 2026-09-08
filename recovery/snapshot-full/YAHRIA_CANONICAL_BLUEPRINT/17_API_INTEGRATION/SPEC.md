# Domaine 17 — API & INTEGRATION

Document ID: YAHRIA-DOMAIN-17
Status: DOMAIN SPEC (LEVEL 6)
Authority: CANONICAL_INDEX + DEPENDENCY_GRAPH
Version: 1.0.0

## But canonique

Contrats stables exposés : REST, WebSocket, webhooks, plugins, SDK.

## Sous-domaines

- 17.1 API Gateway
- 17.2 REST API
- 17.3 WebSocket
- 17.4 Internal API
- 17.5 Event Bus
- 17.6 Webhooks
- 17.7 Plugin Architecture
- 17.8 External Tools
- 17.9 Source Providers
- 17.10 SDK

## Dépendances (DEPENDENCY_GRAPH)

Domaines cœur → 17. L'API ne duplique jamais la logique métier.

## Correspondances d'implémentation (ce dépôt)

- `src/app/api/yahria/* (7 endpoints)`
- `server.mjs + /ws/yahria (WebSocket temps réel, ADR-0011)`

---

> Ce SPEC est un document de niveau 6 (DOMAIN SPEC). Il ne peut pas contredire
> les niveaux supérieurs (constitution, invariants, ADR, index, graphe).
> Toute extension de domaine suit ADR-0001 : amendement versionné.
