# YAHRIA — Your Autonomous Hybrid Reasoning Intelligence Assistant for Code

> **Système d'intelligence logicielle autonome, sécurisé, gouverné et piloté par preuves.**
>
> Implémentation exécutable de la constitution YAHRIA : un Agent OS à raisonnement
> hybride (S1 déterministe / S2 LLM / cascade), gouverné par 47 invariants globaux,
> des machines à états gardées, une politique *deny-by-default* et un moteur de
> preuves inviolable par chaînage SHA-256.

---

## Vue d'ensemble

YAHRIA n'est pas un simple chatbot de code : c'est un **système d'exploitation pour
agents de développement autonomes**, dont chaque décision doit être *gouvernée,
traçable et prouvée*. Ce dépôt contient :

1. **Le noyau constitutionnel** (`src/lib/yahria/`) — la traduction TypeScript
   exécutable des règles canoniques : invariants, machines à états, graphe de
   domaines, moteur de politique, moteur de preuves, raisonnement hybride, boucle
   cognitive, Agent OS, fabric d'exécution.
2. **YAHRIA Mission Control** — une application Next.js 16 complète (API + UI)
   qui expose le noyau : boucle cognitive, agents, exécutions, preuves,
   politiques et blueprint constitutionnel.
3. **YAHRIA Studio autonome** — le générateur de code de bout en bout : une
   arborescence (ou un simple brief) est soumise, l'architecte S2 planifie,
   l'agent coder génère chaque fichier, la vérification indépendante contrôle,
   et la mission est **scellée par des preuves** puis livrée en ZIP + éditeur IA
   de régénération fichier par fichier.
   - **Langage au choix** : sélecteur de stack (Next.js, Node.js, Python,
     HTML/CSS/JS statique, Go, Rust, Java, **C, C++, C#, Fortran**) — le choix humain gouverne sur la
     détection S1 (INV-081) ; parsing hiérarchique des glyphes `tree`
     (`src/app/` + `├── page.tsx` → `src/app/page.tsx`).
   - **Résilience S2** : backoff anti rate-limit (429), pacing inter-fichiers,
     retries correctifs ; le vérificateur INV-080 distingue placeholders réels
     et balises markup légitimes (`<body>`).
   - **Prouvé en réel** : site Next.js généré (14 fichiers) compilé en build de
     production (routes `/`, `/destinations`, `/contact` en 200) ; API FastAPI
     générée exécutée avec uvicorn (`/health`, `/forecast` 7 jours, `/docs`
     OpenAPI) ; site statique livré avec lightbox et formulaire fonctionnels.
4. **Le corpus constitutionnel original** (`docs/corpus/`) — les 11 documents
   fondateurs, y compris les 2 fichiers racine manquants désormais restaurés
   (`CANONICAL_INDEX.md`, `DEPENDENCY_GRAPH.md`).
5. **Les 2 livrables manquants** — la spécification *Hybrid Reasoning*
   (`public/docs/HYBRID_REASONING_SPECIFICATION.md`) et la carte d'architecture
   visuelle (`public/docs/YAHRIA_CARTE_ARCHITECTURE.png`).

## Architecture constitutionnelle

```
CONSTITUTION (LEVEL 0)
   ↓
ROOT CONTRACT (LEVEL 1)
   ↓
GLOBAL INVARIANTS — 47 invariants, INV-001 → INV-211 (LEVEL 2)
   ↓
ARCHITECTURE DECISIONS (LEVEL 3)
   ↓
CANONICAL INDEX — 24 domaines (LEVEL 4)
   ↓
DEPENDENCY GRAPH — ordre d'implémentation autoritaire (LEVEL 5)
   ↓
DOMAIN SPECS (LEVEL 6)
   ↓
IMPLEMENTATION SPECS (LEVEL 7)
   ↓
CODE (LEVEL 8) — ne peut jamais contredire les niveaux supérieurs
```

Règles structurelles clés :

- **`UNKNOWN ≠ SUCCESS`** — une réponse non vérifiée n'est jamais un succès.
- **`AUTONOMY < POLICY`** — l'autonomie s'arrête là où la politique l'interdit.
- **`MEMORY ≠ POLICY`** — la mémoire informe, elle ne gouverne pas.
- **D.8 (auto-évolution) ne contrôle pas D.6 (gouvernance) ; D.6 gouverne D.8.**
- **Preuves :** `CLAIM + PROVENANCE + INTEGRITY + CONTEXT + TIME + LINEAGE = EVIDENCE VÉRIFIABLE`

## Le noyau `src/lib/yahria/`

| Module | Rôle constitutionnel |
|---|---|
| `types.ts` | Types canoniques partagés (états, verdicts, preuves, politiques) |
| `state-machines.ts` | Machines à états gardées — toute transition non déclarée est rejetée (422) |
| `invariants.ts` | Les 47 invariants globaux + moteur de vérification |
| `domains.ts` | Les 24 domaines canoniques + graphe de dépendances + dépendances interdites |
| `policy-engine.ts` | Contrôle de politique *deny-by-default* (POL-001…), précédence INV-120 |
| `evidence-engine.ts` | Calcul d'intégrité SHA-256, chaînage `LINEAGE`, verdicts |
| `evidence-store.ts` | Persistance des preuves, compteur UID, cycle `DECLARED → VERIFIED → SEALED` |
| `hybrid-reasoning.ts` | **Routeur hybride S1/S2/CASCADE** — formules normatives, fallback LLM explicite |
| `agent-os.ts` | 9 agents + portes de capacités gouvernées |
| `execution-fabric.ts` | Sandbox 3 profils, OverlayFS, taxonomie d'échecs F001–F025 |
| `perception.ts` | World State — perception de l'environnement d'exécution |
| `cognitive-loop.ts` | Boucle cognitive complète, gouvernée de bout en bout |
| `studio.ts` | **Studio S1/S2** — parsing d'arborescence (INV-120), détection de stack, blueprint planifié, génération + vérification par fichier |
| `studio-pipeline.ts` | **Studio orchestrateur** — machine à états gardée `SUBMITTED→SEALED`, garde politique D.6, preuves par fichier, workspace + ZIP, éditeur IA |
| `bootstrap.ts` | Amorçage idempotent (seed constitutionnel) |
| `canonical.ts` | **R8** — substrat canonique (JSON trié, SHA-256/HMAC) — parité TS⇄Python |
| `proof-carrying.ts` | **R8** — certificats de preuve embarqués, prédicats ré-exécutables, vérificateur indépendant |
| `merkle-evidence.ts` | **R8** — scellement Merkle des preuves, preuves d'inclusion O(log n), audit avec localisation de falsification |
| `blast-radius.ts` | **R8** — rayon d'impact sémantique, détection de cycles, auto-DENY constitutionnel (D.6 gouverne) |
| `debate-arbiter.ts` | **R8** — débat adversarial PROPOSER/CHALLENGER/SECURITY/JUDGE, dissensus archivé |
| `time-travel.ts` | **R8** — chronologies hash-chaînées, rejeu bit-à-bit, localisation de dérive, bissect forensique |
| `fuzz-constitution.ts` | **R8** — fuzzing de propriétés constitutionnelles (PRNG semé xorshift32, 6 propriétés) |
| `self-heal.ts` | **R8** — auto-réparation bornée, réparations déterministes, re-scellement par certificat |
| `attestation.ts` | **R8** — attestation workspace signée (type SLSA/in-toto), vérification + diff anti-régression |
| `llm-fabric.ts` | **R10** — **fabric LLM multi-fournisseurs** (YAHRIA-KRN-023) : route unique INV-212, repli ordonné, circuit breaker, télémétrie masquée INV-213 |
| `sandbox-executor.ts` | **R11/R11.2** — **exécuteur sandbox** (YAHRIA-KRN-024) : recettes par stack (install/syntaxe/build/lancement/sondes HTTP **ou build+run CLI avec marqueur**), env scrubé, ports bornés, toolchains INV-190, **backend conteneur Docker durci** (INV-215 : `--network none --read-only --cap-drop ALL`) |
| `live-proof.ts` | **R11** — boucle gouvernée self-heal : POL-009, budget borné, diagnostic fautif, réparation IA, verdicts PROVED/PARTIAL/UNPROVED |

## API `/api/yahria/*`

| Endpoint | Description |
|---|---|
| `GET system` | État du système, bootstrap, santé constitutionnelle |
| `POST / GET cognitive` | Exécuter la boucle cognitive / lire les traces |
| `GET agents` | Registre des 9 agents + capacités + état |
| `GET executions` | Fabric d'exécution, sandbox, échecs F001–F025 |
| `POST evidence` | Cycle de preuve : `capture → verify → seal` (SHA-256 chaîné) |
| `POST policy` | Évaluer une décision contre le contrôle de politique |
| `GET / POST tasks` | Graphe de tâches + transitions gardées par machine à états |
| `POST studio/parse` | Validation S1 d'une arborescence (chemins dangereux refusés, stack, rôles) |
| `GET / POST studio/runs` | Lister les missions / soumettre une mission de génération autonome |
| `GET studio/runs/[id]` | Détail d'un run : machine à états, blueprint, fichiers + contenus |
| `POST studio/runs/[id]/edit` | **Éditeur IA** — régénère un fichier sur instruction, re-scelle le ZIP |
| `GET studio/runs/[id]/download` | Télécharge la livraison ZIP (état SEALED requis) |
| `GET / POST supremacy` | **R8** — catalogue + 12 capacités de souveraineté : preuves embarquées, Merkle, blast radius, débat, time-travel, fuzzing, self-heal, attestations |
| `GET / POST llm` | **R10** — fabric LLM : statut fournisseurs (GET), sonde de connectivité + réordonnancement runtime (POST) |
| `POST studio/runs/[id]/execute` | **R11/R11.2** — **preuve live** : install → syntaxe → build → lancement sandbox + sondes HTTP (stacks serveur) **ou compilation + exécution CLI avec capture du marqueur `YAHRIA-LINK-OK`** (C, C++, C#, Fortran) → self-heal borné → `SEALED → LIVE_PROVED` |
| `WS /ws/yahria` | **Flux temps réel** (WebSocket, domaine 11) — handshake `hello → snapshot → events` |

## YAHRIA Mission Control (UI)

12 panneaux : **Studio autonome · Souveraineté R8 · Connecteurs IA · Centre de commande · Raisonnement hybride ·
Agent OS · Graphe de tâches · Exécutions · Preuves · Politiques · Blueprint ·
Temps réel**. Le Studio autonome couvre le cycle complet : soumission
d'arborescence (ou brief seul, l'architecte S2 concevant alors les fichiers),
validation S1 en direct, progression de la machine à états alimentée par le
journal WebSocket, navigateur de fichiers générés, éditeur IA par instruction,
**exécution sandbox en un clic avec preuve live** (bouton « Exécuter en
sandbox » : install, syntaxe, build, lancement réel, sondes HTTP **ou
compilation + exécution binaire** pour C/C++/C#/Fortran, auto-réparation
bornée — verdict PROVED/PARTIAL/UNPROVED affiché avec le rapport complet),
et téléchargement du ZIP scellé. Le panneau **Souveraineté R8** auto-démontre
en un clic les huit capacités de calibre expert (preuves embarquées, Merkle,
blast radius, débat adversarial, time-travel, fuzzing, self-heal, attestation)
avec scénarios réels et preuves affichées. Le panneau **Connecteurs IA**
montre le registre des fournisseurs LLM (configurés, breaker, latence),
permet de sonder chaque connecteur en un clic et de réordonner la chaîne
de repli — brancher DeepSeek, Claude, OpenAI ou Ollama revient à remplir
`.env.example` (voir `public/docs/LLM_CONNECTORS_SPECIFICATION.md`).
Le panneau temps réel diffuse
les événements constitutionnels via WebSocket avec reconnexion automatique.

## Démarrage rapide

```bash
# Prérequis : Node 20+ (ou Bun), SQLite/PostgreSQL via Prisma
bun install            # ou npm install
bun run db:push        # crée le schéma Prisma (17 modèles)
bun run db:generate    # client Prisma
bun run dev            # http://localhost:3000 — serveur personnalisé (Next + WS)
```

Le serveur personnalisé `server.mjs` héberge Next.js **et** le WebSocket
temps réel dans le même processus Node (bus d'événements partagé via
`globalThis`). Test de bout en bout : `node scripts/ws-test.mjs`.

Le seed constitutionnel est **idempotent** : au premier appel système, le
bootstrap installe agents, domaines, politiques et invariants.

> Les décisions S2 (LLM) passent par la **fabric multi-fournisseurs** (`llm-fabric.ts`) ; sans
> backend LLM disponible, le routeur hybride dégrade en **fallback explicite**
> (jamais de succès non prouvé — `UNKNOWN ≠ SUCCESS`).

## Bases de données — R7.2 (SQLite ⇄ PostgreSQL)

Prisma est piloté par **un seul schéma, deux providers**. SQLite reste le
défaut de développement (zéro service à installer) ; PostgreSQL est la cible
production. La bascule est outillée et le schéma est identique (17 modèles) :

```bash
# Passer en PostgreSQL (l'URL doit pointer vers votre instance)
DATABASE_URL="postgresql://yahria@127.0.0.1:5433/yahria" npm run db:pg
# Revenir à SQLite
npm run db:sqlite
```

`scripts/db-provider.mjs` réécrit le provider de `prisma/schema.prisma`, puis
`prisma generate` + `db push` alignent client et base. **Preuves live R7.2** :
PostgreSQL 16.2 exécuté en espace utilisateur (binaires pgserver), schéma
poussé, round-trip `SystemEvent` vérifié (59 ms), et **application Next.js
complète démarrée sur PostgreSQL** (`GET /api/yahria/studio/runs` → `ok:true`)
avant restauration de SQLite. `docker-compose.yml` fournit la cible
production (`postgres:16-alpine` + volume persistant).

## Conteneurisation — R11.3

Trois artefacts Docker sont livrés (le démon Docker n'existe pas dans ce bac
à sable — les images sont **fournies et documentées**, leur build est à
valider sur un hôte Docker réel) :

- **`Dockerfile`** — image application multi-stage (`yahria-os`) : génération
  du client Prisma pour PostgreSQL, build Next, entrypoint idempotent
  (`docker/docker-entrypoint.sh` : bascule provider → `db push` → serveur) ;
- **`docker-compose.yml`** — stack complète `app + postgres:16-alpine`
  (healthcheck, volume `pgdata`, workspaces persistés) ;
- **`docker/sandbox.Dockerfile`** — **image sandbox durcie** `yahria-sandbox`
  (Ubuntu 24.04, non-root) embarquant **tous les toolchains** : gcc/g++,
  gfortran, Python 3, Node, dotnet 8, mono. Avec
  `YAHRIA_SANDBOX_BACKEND=docker`, chaque étape d'exécution sandbox tourne
  dans un conteneur sans réseau, rootfs read-only, capabilities droppées,
  CPU/RAM/PIDs bornés (INV-215) — l'isolation conteneur remplace le
  confinement process par défaut, plus faible, documenté honnêtement.

### Statut des domaines — activation fondée sur preuves

La conséquence directe de R11/R11.2/R11.3 : **D.08 (Execution Fabric)** et
**D.10 (Sandbox Engine)** sont officiellement passés de `NOT_STARTED` à
`IMPLEMENTING`. La bascule n'est pas un libellé manuel mais un **registre
d'activation fondé sur preuves** (`DOMAIN_ACTIVATIONS` dans `domains.ts`) :
chaque entrée liste les artefacts vérifiables (modules noyau, runs
`LIVE_PROVED`, spécification publiée) et le bootstrap applique la montée de
façon **monotone et idempotente** (`NOT_STARTED → IMPLEMENTING`, jamais
l'inverse — conformément à `UNKNOWN ≠ SUCCESS`). Le registre est exposé dans
`GET /api/yahria/system` (champ `domainActivations`) pour l'auditabilité.
État courant : **11/24 domaines actifs** ; les 13 restants restent honnêtement
`NOT_STARTED` tant qu'aucune preuve n'est archivée.

## Les 2 fichiers manquants — restaurés

L'audit du corpus original avait révélé que la spec **Hybrid Reasoning** (le nom
du produit !) n'existait nulle part, et que la **carte d'architecture** était
absente. Les deux sont désormais livrées :

- 🧠 [`public/docs/HYBRID_REASONING_SPECIFICATION.md`](public/docs/HYBRID_REASONING_SPECIFICATION.md)
  — spécification canonique V1.0.0 (16 sections, 10 critères d'acceptance,
  formules normatives S1/S2/cascade, intégration INV-081, matrice invariants)
- 🗺️ [`public/docs/YAHRIA_CARTE_ARCHITECTURE.png`](public/docs/YAHRIA_CARTE_ARCHITECTURE.png)
  — carte d'architecture bilatérale (8 branches / 34 feuilles)

Et dans `docs/corpus/` : `CANONICAL_INDEX.md` + `DEPENDENCY_GRAPH.md` extraits
du contrat 00 en fichiers racine autonomes.

## Structure du dépôt

```
.
├── src/
│   ├── app/                    # Next.js App Router (UI + API)
│   │   ├── api/yahria/         # 7 endpoints constitutionnels + studio (5 routes)
│   │   └── page.tsx            # Mission Control (12 panneaux)
│   ├── components/yahria/      # Panneaux Mission Control + Studio autonome
│   ├── hooks/                  # use-yahria-realtime (WS)
│   └── lib/yahria/             # ⭐ Noyau constitutionnel (15 modules + realtime)
├── server.mjs                  # Serveur personnalisé : Next + WebSocket /ws/yahria
├── prisma/schema.prisma        # 17 modèles (Tenant, Agent, Task, Evidence, GenerationRun…)
├── public/docs/                # 🧠 Spec Hybrid Reasoning + 🗺️ Carte architecture
├── YAHRIA_CANONICAL_BLUEPRINT/ # 📜 Racine canonique §5 : 6 docs d'autorité + 24 domaines
├── docs/corpus/                # Corpus constitutionnel (11 originaux + 2 restaurés)
├── docs/report/                # 📕 Rapport PDF d'analyse complet + sources
├── docs/R7_PORTAGE_POSTGRESQL_PYTHON.md  # 🐘 Roadmap portage PostgreSQL/Python (R7.1 ✅)
├── yahria-core/                # 🐍 Noyau constitutionnel Python (port R7.1, parité TS prouvée)
└── scripts/                    # Tests WS, générateurs (carte, blueprint, rapport, fixtures parité R7.1)
```

## Conformité constitutionnelle de cette implémentation

| Règle du corpus | Implémentation |
|---|---|
| Machines à états déclaratives | `state-machines.ts` — transitions non déclarées rejetées |
| Deny-by-default (INV-120) | `policy-engine.ts` — aucune capacité sans politique explicite |
| Preuves inviolables | `evidence-engine.ts` — SHA-256 + lineage chaîné, scellement |
| Ordre d'implémentation | `domains.ts` — graphe `00→01→16→02→…→23` + dépendances interdites |
| D.6 gouverne D.8 | `agent-os.ts` + `policy-engine.ts` — évolution soumise à gouvernance |
| Hybrid Reasoning | `hybrid-reasoning.ts` — S1/S2/CASCADE par `HYBRID_REASONING_SPECIFICATION.md` V1.0.0 |
| Studio gouverné | `studio-pipeline.ts` — garde politique avant écriture, preuves par fichier, transitions 422 |
| 47 invariants | `invariants.ts` — vérification à chaque décision |

## Portage Python du noyau (R7.1 — parité prouvée, étendue R8)

Le noyau constitutionnel existe désormais en **deux runtimes** : TypeScript (référence)
et **Python** (`yahria-core/kernel/` — stdlib pur, zéro dépendance, Python ≥ 3.10).
La parité est **prouvée, pas supposée** : les fixtures générées depuis le noyau TS sont
rejouées par pytest — 58/58 verts, zéro divergence (659 paires de transitions, 74
invariants, 24 domaines, politiques deny-by-default, chaîne de preuves SHA-256
byte-identique, routeur S1/S2/CASCADE avec rationale exacts). **R8 étend la parité
au Supremacy Pack** : racine Merkle, preuves d'inclusion et localisation d'audit
produites **octet-pour-octet** par `kernel/supremacy.py` (14 tests supplémentaires,
72/72 verts). Détails : `yahria-core/README.md` · roadmap :
`docs/R7_PORTAGE_POSTGRESQL_PYTHON.md` · pack R8 : `docs/R8_SUPREMACY_PACK.md`.

```bash
npx tsx scripts/r7-parity-fixtures.ts   # générer les fixtures noyau depuis le TS
npx tsx scripts/r8-supremacy-fixtures.ts # générer les fixtures R8 (Merkle) depuis le TS
cd yahria-core && python3 -m pytest     # rejouer la grille de parité (72 tests)
npx tsx scripts/r8-supremacy-tests.ts   # suite de preuves R8 côté TS (48 vérifications)
```

## Licence & attribution

Corpus constitutionnel et vision : **assihervey-coder**.
Implémentation de référence : générée et vérifiée avec l'assistance IA (2025-2026).
