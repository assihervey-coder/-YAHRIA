# Domaine 06 — COGNITIVE CORE

Document ID: YAHRIA-DOMAIN-06
Status: DOMAIN SPEC (LEVEL 6)
Authority: CANONICAL_INDEX + DEPENDENCY_GRAPH
Version: 1.0.0

## But canonique

Raisonnement, planification, décision et sécurité cognitive.

## Sous-domaines

- 06.1 Intent Understanding
- 06.2 Goal Modeling
- 06.3 World State
- 06.4 Context Assembly
- 06.5 Reasoning Interface
- 06.6 Planning Engine
- 06.7 Strategy Selection
- 06.8 Uncertainty Engine
- 06.9 Verification Planning
- 06.10 Reflection
- 06.11 Cognitive Routing
- 06.12 Decision Engine
- 06.13 Cognitive Safety

## Dépendances (DEPENDENCY_GRAPH)

04, 05 → 06. Consomme savoir-code et capacités ; produit buts, plans, décisions, plans de vérification.

## Correspondances d'implémentation (ce dépôt)

- `src/lib/yahria/cognitive-loop.ts`
- `src/lib/yahria/hybrid-reasoning.ts`
- `src/lib/yahria/perception.ts`
- `public/docs/HYBRID_REASONING_SPECIFICATION.md`

---

> Ce SPEC est un document de niveau 6 (DOMAIN SPEC). Il ne peut pas contredire
> les niveaux supérieurs (constitution, invariants, ADR, index, graphe).
> Toute extension de domaine suit ADR-0001 : amendement versionné.
