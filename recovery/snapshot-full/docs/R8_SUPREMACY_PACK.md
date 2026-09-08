# R8 — Souveraineté Constitutionnelle (Supremacy Pack)

**Version** 1.0.0 · **Statut** implémenté, prouvé (48/48 TS + 72/72 Python) · **Doc ID** YAHRIA-R8-001

R8 dote YAHRIA de huit capacités de niveau expert qui transforment l'OS d'« exécuteur gouverné » en **système à souveraineté prouvée** : chaque artefact, chaque décision, chaque exécution porte ses propres preuves machine-vérifiables, et toute falsification — même d'un octet — est non seulement détectée mais **localisée**.

## Vue d'ensemble

| # | Capacité | Module | Invariants pivots |
|---|----------|--------|-------------------|
| 1 | Preuve embarquée (Proof-Carrying Code) | `proof-carrying.ts` | INV-080, INV-102, INV-161 |
| 2 | Scellement Merkle + localisation de falsification | `merkle-evidence.ts` | INV-033, INV-110 |
| 3 | Rayon d'impact sémantique + auto-DENY | `blast-radius.ts` | INV-181, INV-004, INV-180 |
| 4 | Débat adversarial multi-agents | `debate-arbiter.ts` | INV-081, INV-161 |
| 5 | Rejeu déterministe (time-travel) | `time-travel.ts` | INV-112, INV-172, INV-191 |
| 6 | Fuzzing constitutionnel de propriétés | `fuzz-constitution.ts` | INV-191, INV-052, INV-033 |
| 7 | Auto-réparation bornée | `self-heal.ts` | INV-210, INV-211, INV-092 |
| 8 | Attestation workspace signée | `attestation.ts` | INV-190, INV-172 |
| — | Substrat canonique partagé | `canonical.ts` | INV-191 |

Surface API unique : `POST /api/yahria/supremacy` (`action` ∈ 12 valeurs) · Catalogue : `GET /api/yahria/supremacy` · UI : onglet **Souveraineté R8** (auto-démonstration d'un clic).

## 1. Proof-Carrying Code — la preuve voyage avec le code

Chaque artefact généré reçoit un **certificat** (`PCC-xxxxxx`) embarquant des prédicats **ré-exécutables** : nom de checker + arguments sérialisés canoniquement, scellés par `proofHash` (SHA-256 sur JSON canonique trié).

Le point expert : le **vérificateur ne lit jamais le verdict enregistré** (`outcome`). Il (a) recalcule `proofHash` — toute retouche du certificat → `TAMPERED` ; (b) **ré-exécute** chaque prédicat via le registre `PROOF_CHECKERS` ; (c) exige un prédicat `hash_matches` qui lie le certificat à son sujet — un certificat non lié est **inprovable** (`INVALID`).

Registre de checkers purs : `no_placeholder` (INV-080), `balanced_delims` (INV-171, analyseur à pile avec suivi de chaînes), `authorized_imports` (INV-003), `no_secret_literals` (INV-053 — clés OpenAI/GitHub/AWS, blocs PKCS, affectations d'identifiants), `path_within_workspace` (INV-120), `hash_matches` (INV-102), `json_parses` (INV-031), `size_bounded` (INV-042).

## 2. Scellement Merkle — O(log n) et localisation exacte

La chaîne linéaire de preuves est doublée d'un **arbre de Merkle** (duplication du nœud impair, convention Bitcoin) :

- `sealEvidenceBundle` → racine unique + `sealHash` + **`leafHashes` par slot** (l'ancre de localisation) ;
- `merkleInclusionProof` → témoin d'inclusion O(log n) vérifiable sans posséder le faisceau ;
- `auditEvidenceBundle` → nomme la falsification : `HASH_MISMATCH` (slot + uid exact), `MISSING` (suppression), `EXTRA` (injection post-scellement), `SEAL_MISMATCH` (métadonnées retouchées).

Jumeau Python : `yahria-core/kernel/supremacy.py` produit **octet-pour-octet** la même racine, les mêmes chemins de preuve et le même rapport d'audit (fixtures TS → `tests/fixtures/supremacy/merkle.json`, 14 tests pytest).

## 3. Rayon d'impact — la géographie constitutionnelle d'un changement

Avant toute édition : fermeture transitive **inverse** (qui dépend, transitivement, du fichier ciblé), projection sur les 24 domaines, détection de cycles (DFS trois couleurs), croisement avec les arêtes interdites §28, puis **verdict constitutionnel** :

- `DENY` — arête interdite, cycle (INV-004), ou mutation du noyau de gouvernance (00/11/12/19) sans approbation : **D.6 gouverne D.8**, la politique prime sur l'intention (INV-120) ;
- `REQUIRE_APPROVAL` — `risk ≥ 0.50` ou noyau touché avec approbation ;
- `ALLOW` — rayon borné, dépendants testés.

Le score de risque est une **formule documentée et déterministe** (voir en-tête du module) : volume, profondeur, ratio de noyau, dépendants non testés, bonus binaires cycle/§28. Chaque verdict cite ses invariants avec motif (INV-181, INV-172…).

## 4. Débat adversarial — le dissensus est une donnée

Quand l'incertitude est haute, un plan unique ne suffit pas. Quatre rôles structurés :

- **PROPOSER** — esquisse (déterministe ou hook LLM) ;
- **CHALLENGER** — objections typées : `NO_VERIFIER`, `UNGATED_RISK` (étape à risque sans garde), `VAGUE_STEP`, `MISSING_SPEC`, `OVERCOMPLEX`, `POLICY_BYPASS`, `UNVERIFIABLE_CLAIM` ;
- **SECURITY** — rejoint automatiquement sur termes à risque ;
- **JUDGE** — rubrique publiée : vérification 0.30 · risques gardés 0.25 · clarté 0.20 · objections résolues 0.25 ; seuil d'acceptation 0.75.

Le PROPOSER applique des **révisions idempotentes** (ajout d'un vérificateur indépendant, garde `requiresApproval`, déclaration `REQUIRES_SPECIFICATION`, borne de complexité ≤ 8 étapes). Verdicts : `APPROVED_PLAN` / `REVISED_PLAN` / `DEFERRED` — et le **dissensus est archivé**, jamais effacé (INV-082). L'arbitre et le challenger restent déterministes : l'arbitre ne hallucine pas.

## 5. Time-travel — le débogueur temporel des agents

Chaque run peut être enregistré en **chronologie hash-chaînée** (`recordTimeline` : hash de sortie + hash de pas chaîné + ancre). `replayTimeline` rejoue bit-à-bit via un replayer déterministe et rapporte :

- `REPRODUCIBLE` — reproductibilité prouvée (INV-191) ;
- `CHAIN_BROKEN @ n` — **double verrou** : le hash de pas ET le hash du contenu stocké sont revérifiés ; réécrire une sortie sans toucher à la chaîne est quand même intercepté ;
- `DRIFTED @ n` — première divergence localisée + **champs dérivés nommés** (diff canonique par clé).

`bisectReplay` donne la borne exacte bon/mauvais — l'outil de forensique anti-régression (INV-172).

## 6. Fuzzing constitutionnel — prouver par l'attaque

`xorshift32` semé (seed enregistrée → échec toujours reproductible, INV-191) attaque la constitution sur **six propriétés** :

| Propriété | Énoncé |
|-----------|--------|
| P0 SCHEMA | machines bien formées, terminaux sans transition sortante |
| P1 SAFE_WALKS | aucune marche légale ne quitte l'ensemble d'états déclaré |
| P2 ABSORBING | aucun saut depuis un terminal n'est accepté (fuzz dynamique) |
| P3 ILLEGAL_REJECT | toute transition non déclarée est rejetée, message constitutionnel exact |
| P4 DENY_BY_DEFAULT | toute requête sans règle explicite → DENY, `matchedRule=null` |
| P5 TAMPER_EVIDENCE | altérer **un octet** d'une preuve casse la vérification ; l'original passe |

Référence mesurée : **6 506 exécutions, 0 violation, ~20 ms** (1 500 itérations/propriété, seed 20260907). La propriété P3 est aussi prouvée nativement côté Python sur les machines portées.

## 7. Auto-réparation bornée — guérir sans jamais deviner

Diagnostic par le **même registre de checkers** que les certificats (une seule loi), classification taxonomique, puis réparations **déterministes réelles** :

- `PLACEHOLDER` → TODO/`...` remplacés par `throw new Error("REQUIRES_SPECIFICATION (INV-210)…")` — honnêteté plutôt que fiction ;
- `UNBALANCED_DELIMS` → fermetures calculées par pile et ajoutées ;
- `FORBIDDEN_IMPORT` → import désactivé par bandeau constitutionnel (sans réécho du chemin — le checker scanne aussi les commentaires, l'écho créerait une boucle) ;
- `SECRET_LITERAL` → réduction `<REDACTED:INV-053>` ;
- `EMPTY_FILE` → scaffolding minimal par extension.

Boucle bornée (`maxAttempts ≤ 5`), discipline `FAILURE_MACHINE` (DETECTED → … → RECOVERED | UNRECOVERABLE), timeline préservée (INV-211), certificat **ré-émis** à la guérison. Défaut fatal (ex. dépassement de taille) → escalade immédiate, jamais de contournement.

## 8. Attestation workspace — la chaîne d'approvisionnement scellée

Manifeste type **SLSA/in-toto** adapté à la constitution : sujet par fichier (`path`, `sha256`, `bytes`), racine Merkle, provenance (générateur, run, mission), version du noyau, **signature HMAC-SHA256** sur le corps canonique.

- `verifyAttestation` — signature, racine et contenu recomputés indépendamment ; divergences nommées **par chemin** (`HASH`/`SIZE`/`MISSING`/`EXTRA`) ; signature retouchée → `TAMPERED_SIGNATURE`.
- `diffAttestations` — `added`/`removed`/`modified`/`unchanged` entre deux états scellés : la **garde anti-régression** (INV-172) — aucune capacité validée ne disparaît en silence.

> Clé de signature : constante de build assumée pour le développement. La production doit déléguer à un KMS/HSM (INV-132) — c'est documenté dans le module.

## Substrat canonique (parité TS ⇄ Python)

`canonical.ts` / `kernel/supremacy.py` : JSON canonique à clés triées récursivement, `undefined` supprimé, nombres sérialisés ECMA-262. Tout sceau R8 (certificats, racines Merkle, chronologies, attestations) passe par cette couche — c'est ce qui rend la parité croisée **byte-identique**.

## Preuves d'exécution (2026-09-07)

- `npx tsx scripts/r8-supremacy-tests.ts` → **48/48 vérifications passées** (scénarios réels : falsifications, dérives, défauts, cycles) ;
- `python3 -m pytest yahria-core/tests/` → **72/72** (dont 14 de parité R8 : racine, preuves d'inclusion, localisation d'audit identiques au slot près) ;
- API live vérifiée (catalogue, fuzz, self-heal `RECOVERED` en 1 tentative, débat convergent score 1.0) ;
- UI : les 8 cartes « Prouver » rendent leurs preuves, 0 erreur console.

## Utilisation programmatique

```ts
import { buildProofCertificate, verifyProofCertificate, standardPredicates } from '@/lib/yahria/proof-carrying';
import { sealEvidenceBundle, auditEvidenceBundle } from '@/lib/yahria/merkle-evidence';
import { analyzeBlastRadius } from '@/lib/yahria/blast-radius';
import { runDebate } from '@/lib/yahria/debate-arbiter';
import { recordTimeline, replayTimeline } from '@/lib/yahria/time-travel';
import { fuzzConstitution } from '@/lib/yahria/fuzz-constitution';
import { selfHeal } from '@/lib/yahria/self-heal';
import { buildAttestation, verifyAttestation, diffAttestations } from '@/lib/yahria/attestation';
```

```bash
# Exemples via l'API
curl -s localhost:3000/api/yahria/supremacy | jq .capabilities[].action
curl -s -X POST localhost:3000/api/yahria/supremacy -H 'Content-Type: application/json' \
  -d '{"action":"fuzz","iterations":2000,"seed":20260907}' | jq .report.allProved
```

## Frontières honnêtes

- La signature d'attestation est de niveau développement (KMS requis en production).
- `inferDomain` (blast radius) est heuristique et étiqueté INV-081 ; il complète, ne remplace pas, un Code Genome complet (D.04).
- Le débat est déterministe par défaut ; le hook `draftProposer` permet un proposeur LLM, mais l'arbitre reste rule-based.
- Le fuzzer prouve des propriétés par échantillonnage semi-brut (des milliers de cas) — ce n'est pas une preuve SMT formelle ; un solveur type Z3 est l'extension naturelle (R9).
