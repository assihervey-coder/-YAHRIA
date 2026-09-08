# Domaine 10 — SANDBOX ENGINE

Document ID: YAHRIA-DOMAIN-10
Status: DOMAIN SPEC (LEVEL 6)
Authority: CANONICAL_INDEX + DEPENDENCY_GRAPH
Version: 1.0.0

## But canonique

Frontières d'exécution sûres : overlay, isolation, ressources, timeouts.

## Sous-domaines

- 10.1 Sandbox Contract
- 10.2 Security Profile
- 10.3 Runtime Adapter
- 10.4 Container Runtime
- 10.5 Podman Runtime
- 10.6 Filesystem Overlay
- 10.7 Workspace Isolation
- 10.8 Network Isolation
- 10.9 Egress Policy
- 10.10 DNS Policy
- 10.11 Resource Controller
- 10.12 CPU Limits
- 10.13 Memory Limits
- 10.14 Disk Limits
- 10.15 PID Limits
- 10.16 Process Control
- 10.17 Timeout Control

## Dépendances (DEPENDENCY_GRAPH)

08, 09 → 10. Chaîne : SNAPSHOT → LOWER-RO → OVERLAYFS → UPPER-RW → CONTAINER → DIFF → PATCH VALIDATOR → REJECT/APPLY (ADR-0006).

## Correspondances d'implémentation (ce dépôt)

- `src/lib/yahria/execution-fabric.ts (SANDBOX_PROFILES, OverlayFS)`

---

> Ce SPEC est un document de niveau 6 (DOMAIN SPEC). Il ne peut pas contredire
> les niveaux supérieurs (constitution, invariants, ADR, index, graphe).
> Toute extension de domaine suit ADR-0001 : amendement versionné.
