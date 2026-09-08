# Corpus constitutionnel YAHRIA

Ce répertoire contient les **11 documents constitutionnels originaux** du corpus
YAHRIA (upload utilisateur, retranscription intégrale de la conception), plus les
**2 fichiers racine manquants** désormais extraits en autonomie.

## Origine

- Source : `YAHRIA CODE OS — Your Autonomous Hybrid Reasoning Intelligence Assistant for Code` (ZIP + 11 fichiers markdown, 68 314 lignes / 131 881 mots)
- Contenu : retranscription des conversations de conception (français) + spécifications canoniques (anglais)
- Versions couvertes : V1.0 → V2.2.2-G
- Vérification : le contenu du ZIP est bit-à-bit identique aux fichiers en vrac (comparé par `cmp`)

## Inventaire

| Fichier | Rôle | Statut |
|---|---|---|
| `00_AUTONOMOUS_CODING_CONTRACT.md` | Constitution — contrat racine autonome (1 262 lignes) | Original |
| `YAHRIA — ROOT ZIP AUTONOMOUS CODING CONTRACT.md` | Contrat d'entrée du ZIP — bootstrap 00→13, structure racine requise | Original |
| `GLOBAL_INVARIANTS.md` | 47 invariants globaux (INV-001 → INV-211) + matrice invariant→control→test→evidence (§26) | Original |
| `STATE_TRANSITION_MANIFEST.md` | 13+ machines à états (task, agent, execution, tool, sandbox, artifact, evidence, test, acceptance, policy, release, deployment, incident, change) | Original |
| `ARCHITECTURE_DECISIONS.md` | ⚠️ Voir anomalies — doublon binaire de STATE_TRANSITION_MANIFEST.md. **Les vraies ADR sont désormais rédigées** : [`YAHRIA_CANONICAL_BLUEPRINT/ARCHITECTURE_DECISIONS.md`](../../YAHRIA_CANONICAL_BLUEPRINT/ARCHITECTURE_DECISIONS.md) (ADR-0001 → ADR-0012) | Original (défectueux) → **ADR réelles rédigées** |
| `IMPLEMENTATION_MANIFEST.md` | Unités IU-xx-xxx, 10 états, gate de pré-checks en 10 points *(nom d'origine : `IMPLEMENTATION_MANIFEST..md`, double point corrigé ici)* | Original (renommé) |
| `FILE_GENERATION_MANIFEST.md` | IDs de fichiers `F-01-FOUNDATION-001`, 9 états, 20 phases, arborescence monorepo `yahria/` | Original |
| `ACCEPTANCE_TEST_MANIFEST.md` | « A test exists to validate a claim » — 5 niveaux d'acceptance | Original |
| `EVIDENCE_MANIFEST.md` | 19 classes de preuves, cycle `DECLARED → … → SEALED → … → DISPOSED` | Original |
| `FAILURE_AND_RECOVERY_MANIFEST.md` | Taxonomie F001–F025, 6 sévérités, 10 stratégies de récupération | Original |
| `la TOTAL YAHRIA.md` | Transcription maîtresse (55 280 lignes) : dialogue de conception + spécifications + 685 classes Python + 33 tables SQL | Original |
| `CANONICAL_INDEX.md` | Index canonique des 24 domaines — **fichier manquant désormais extrait** du contrat 00 (§2) | **Restauré** |
| `DEPENDENCY_GRAPH.md` | Graphe de dépendances autoritaire (ordre d'implémentation) — **fichier manquant désormais extrait** du contrat 00 (§3) | **Restauré** |

## Anomalies connues du corpus (documentées lors de l'audit)

> **Mise à jour** : les anomalies 2, 3 et 4 sont désormais **corrigées** — voir
> [`YAHRIA_CANONICAL_BLUEPRINT/`](../../YAHRIA_CANONICAL_BLUEPRINT/README.md)
> (reconstruction conforme §5) et ADR-0008 (réconciliation D.x).

1. **`ARCHITECTURE_DECISIONS.md` est un doublon parfait** de `STATE_TRANSITION_MANIFEST.md`
   (vérifié par `cmp` : 0 octet de différence). Les vraies ADR ont été rédigées en
   repartant de la constitution, du contrat racine et de la transcription maîtresse :
   **ADR-0001 → ADR-0012** (autorité à 9 niveaux, 4 systèmes de vérité, preuves,
   deny-by-default, Hybrid Reasoning, sandbox OverlayFS, PostgreSQL, **réconciliation
   D.x**, Agent OS, constitution exécutable, WebSocket temps réel, bootstrap idempotent).
2. **`CANONICAL_INDEX.md`, `DEPENDENCY_GRAPH.md` et `README.md` étaient absents en tant
   que fichiers racine** : les deux premiers ont été extraits du contrat 00 et la
   structure racine complète (6 fichiers + 24 répertoires de domaines avec SPEC.md)
   a été **reconstruite** dans [`YAHRIA_CANONICAL_BLUEPRINT/`](../../YAHRIA_CANONICAL_BLUEPRINT/README.md).
3. **Numérotation D.x contradictoire** : réconciliée par **ADR-0008** — deux namespaces
   distincts : la série de livraison `V2.2.2-D.0 → D.17` (incréments Execution Fabric :
   D.0 contrats, D.1 modèle de données, D.2 Alembic, D.3 outils, D.4 sandbox, D.5 tests
   d'intégration, D.6 observabilité/preuves/gouvernance, D.7 mémoire/apprentissage,
   D.8 auto-évolution ; D.9–D.17 réservés) et les plans architecturaux nus
   D.6/D.7/D.8 (vérité/gouvernance → mémoire/apprentissage → évolution contrôlée),
   avec l'invariant « D.8 ne contrôle pas D.6 ; D.6.11 gouverne D.8 ». Règle de
   lecture canonique : D.x préfixé d'une version = livrable ; D.6/D.7/D.8 nus = plans.
4. **« Hybrid Reasoning », nom du produit, n'était défini nulle part** (0 occurrence dans le
   corpus) — la spécification manquante a été rédigée :
   [`public/docs/HYBRID_REASONING_SPECIFICATION.md`](../../public/docs/HYBRID_REASONING_SPECIFICATION.md).
5. Le ZIP violait sa propre **REQUIRED ROOT STRUCTURE** (§5 du ROOT ZIP CONTRACT) —
   structure reconstruite conformément au contrat.
6. Cosmétique : `IMPLEMENTATION_MANIFEST..md` (double point, corrigé ici), nom de ZIP
   contenant `%0A`.

## Autorité

Ces documents constituent la **constitution** du système. L'implémentation TypeScript de
ce dépôt (`src/lib/yahria/`) en est la traduction exécutable et vérifiable.

```
00_AUTONOMOUS_CODING_CONTRACT   → QUELLES RÈGLES DOIVENT ÊTRE RESPECTÉES
CANONICAL_INDEX                 → QUELS DOMAINES EXISTENT
DEPENDENCY_GRAPH                → DANS QUEL ORDRE LES CONSTRUIRE
GLOBAL_INVARIANTS               → CE QUI NE PEUT JAMAIS ÊTRE VIOLÉ
```
