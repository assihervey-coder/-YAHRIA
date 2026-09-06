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
| `WS /ws/yahria` | **Flux temps réel** (WebSocket, domaine 11) — handshake `hello → snapshot → events` |

## YAHRIA Mission Control (UI)

10 panneaux : **Studio autonome · Centre de commande · Raisonnement hybride ·
Agent OS · Graphe de tâches · Exécutions · Preuves · Politiques · Blueprint ·
Temps réel**. Le Studio autonome couvre le cycle complet : soumission
d'arborescence (ou brief seul, l'architecte S2 concevant alors les fichiers),
validation S1 en direct, progression de la machine à états alimentée par le
journal WebSocket, navigateur de fichiers générés, éditeur IA par instruction,
et téléchargement du ZIP scellé. Le panneau temps réel diffuse
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

> Les décisions S2 (LLM) passent par le SDK local `z-ai-web-dev-sdk` ; sans
> backend LLM disponible, le routeur hybride dégrade en **fallback explicite**
> (jamais de succès non prouvé — `UNKNOWN ≠ SUCCESS`).

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
│   │   └── page.tsx            # Mission Control (10 panneaux)
│   ├── components/yahria/      # Panneaux Mission Control + Studio autonome
│   ├── hooks/                  # use-yahria-realtime (WS)
│   └── lib/yahria/             # ⭐ Noyau constitutionnel (15 modules + realtime)
├── server.mjs                  # Serveur personnalisé : Next + WebSocket /ws/yahria
├── prisma/schema.prisma        # 17 modèles (Tenant, Agent, Task, Evidence, GenerationRun…)
├── public/docs/                # 🧠 Spec Hybrid Reasoning + 🗺️ Carte architecture
├── YAHRIA_CANONICAL_BLUEPRINT/ # 📜 Racine canonique §5 : 6 docs d'autorité + 24 domaines
├── docs/corpus/                # Corpus constitutionnel (11 originaux + 2 restaurés)
├── docs/report/                # 📕 Rapport PDF d'analyse complet + sources
├── docs/R7_PORTAGE_POSTGRESQL_PYTHON.md  # 🐘 Roadmap portage PostgreSQL/Python (R7)
└── scripts/                    # Tests WS, générateurs (carte, blueprint, rapport)
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

## Licence & attribution

Corpus constitutionnel et vision : **assihervey-coder**.
Implémentation de référence : générée et vérifiée avec l'assistance IA (2025-2026).
