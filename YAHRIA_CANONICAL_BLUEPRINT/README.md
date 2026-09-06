# YAHRIA CANONICAL BLUEPRINT

> **Reconstruction conforme** de la `REQUIRED ROOT STRUCTURE` (§5 du
> `YAHRIA — ROOT ZIP AUTONOMOUS CODING CONTRACT`) que l'archive originale
> violait. Ce répertoire est la racine canonique du blueprint : les 6
> documents d'autorité + les 24 répertoires de domaines canoniques.

Document ID: YAHRIA-ROOT-000
Status: CANONICAL ENTRY POINT
Version: 1.0.0

---

## Structure

```
YAHRIA_CANONICAL_BLUEPRINT/
├── README.md                        ← ce fichier (entrée canonique)
├── 00_AUTONOMOUS_CODING_CONTRACT.md ← L1 — contrat racine autonome
├── CANONICAL_INDEX.md               ← L4 — index des 24 domaines (restauré)
├── DEPENDENCY_GRAPH.md              ← L5 — ordre d'implémentation (restauré)
├── GLOBAL_INVARIANTS.md             ← L2 — 47 invariants INV-001 → INV-211
├── ARCHITECTURE_DECISIONS.md        ← L3 — vraies ADR (reconstruites, ADR-0001 → ADR-0012)
│
├── 00_INITIALIZATION/ … 23_PRODUCT_EVOLUTION/
└── (24 répertoires de domaines, chacun avec son SPEC.md)
```

## Règle de lecture canonique (CANONICAL READING RULE)

Le système d'implémentation ne lit PAS l'archive arbitrairement. L'ordre
de lecture autoritaire est :

```
ROOT AUTHORITY (ce README)
   ↓
00_AUTONOMOUS_CODING_CONTRACT   → QUELLES RÈGLES DOIVENT ÊTRE RESPECTÉES
   ↓
GLOBAL_INVARIANTS               → CE QUI NE PEUT JAMAIS ÊTRE VIOLÉ
   ↓
ARCHITECTURE_DECISIONS          → QUELLES DÉCISIONS STRUCTURENT LE SYSTÈME
   ↓
CANONICAL_INDEX                 → QUELS DOMAINES EXISTENT
   ↓
DEPENDENCY_GRAPH                → DANS QUEL ORDRE LES CONSTRUIRE
   ↓
00_INITIALIZATION/…/23_PRODUCT_EVOLUTION/   → SPECS PAR DOMAINE
   ↓
AUTO CODING (implémentation gouvernée)
```

## Règle de désambiguïsation D.x

- `V2.2.2-D.x` (préfixé d'une version) = **livrable** de la série
  d'incréments Execution Fabric (D.0 → D.8 définis, D.9–D.17 réservés).
- `D.6 / D.7 / D.8` (nus) = **plans architecturaux**
  (vérité/gouvernance → mémoire/apprentissage → évolution contrôlée),
  avec l'invariant : **D.8 ne contrôle pas D.6 ; D.6.11 gouverne D.8**.
- Détail complet : ADR-0008.

## Relation avec le code

Ce blueprint est la **doctrine** ; l'implémentation exécutable vit à la
racine du dépôt (`src/lib/yahria/`, 13 modules noyau + Mission Control
Next.js). Chaque répertoire de domaine contient un `SPEC.md` qui :
rappelle le but canonique du domaine, liste ses sous-domaines, et pointe
vers les fichiers d'implémentation correspondants dans le dépôt.

## Provenance

- `00_AUTONOMOUS_CODING_CONTRACT.md`, `GLOBAL_INVARIANTS.md` : copies
  fidèles du corpus original (sources d'autorité, non modifiées).
- `CANONICAL_INDEX.md`, `DEPENDENCY_GRAPH.md` : **restaurés** depuis les
  sections embarquées du contrat 00 (§2/§3) — ils manquaient en tant que
  fichiers racine.
- `ARCHITECTURE_DECISIONS.md` : **reconstruit** — l'original était un
  doublon binaire défectueux de `STATE_TRANSITION_MANIFEST.md` ; les vraies
  ADR sont dérivées du corpus et des décisions de l'implémentation.
