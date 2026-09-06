# YAHRIA — R7 : Portage PostgreSQL / Python

**Document ID** : YAHRIA-R7-001 · **Statut** : ROADMAP APPROUVÉE (prête pour implémentation)
**Prérequis** : R6 — Studio Autonome fonctionnel (Next.js/SQLite, RUN scellés, preuves chaînées)
**Autorité** : dérive de `00_AUTONOMOUS_CODING_CONTRACT.md` §5 (REQUIRED ROOT STRUCTURE) et de `IMPLEMENTATION_MANIFEST.md` (roadmaps R1–R8)

---

## 1. Objet et périmètre

R7 est le portage du noyau YAHRIA de la paire **Next.js 16 / TypeScript / Prisma-SQLite** vers une paire **Python 3.12 / FastAPI / SQLAlchemy 2 + PostgreSQL 16**. L'objectif n'est pas une réécriture : c'est une **translation fidèle** de la constitution (invariants, machines à états, preuves, politiques) vers un runtime conçu pour la production longue durée : multi-tenant réel, concurrence native, WS durable, exécutions sandboxées parallèles et garde-fous ACID.

Le périmètre couvre :

1. **Moteur constitutionnel** — les 47 invariants, les machines à états gardées, le policy engine deny-by-default : portés 1:1 en modules Python purs, testés par une grille de parité.
2. **Persistance** — PostgreSQL remplace SQLite : schémas versionnés par Alembic, transactions sérialisables pour les transitions d'état, partitions sur les tables d'événements.
3. **Exécution** — workers séparés (Arq/Redis) pour la fabrique d'exécution et le pipeline Studio ; l'API ne génère plus dans le processus web.
4. **Temps réel** — WebSocket FastAPI native (`/ws/yahria`), fan-out via Redis pub/sub : le bus cesse d'être mono-processus.
5. **Studio autonome** — pipeline `SUBMITTED → SEALED` identique, mais chaque fichier devient une tâche worker reprise sur incident.

Hors périmètre R7 : l'interface Mission Control (reste servie par l'app Next.js existante qui consommera l'API FastAPI), la migration des données historiques SQLite (export d'archive JSON + preuves scellées, pas de réplication live).

---

## 2. Architecture cible

```text
┌────────────────────────────────────────────────────────────────────┐
│  Mission Control (Next.js existant, non régénéré)                  │
│  consomme l'API FastAPI + WS  ────────────────┐                    │
└───────────────────────────────────────────────│────────────────────┘
                                                ▼
┌────────────────────────────────────────────────────────────────────┐
│  yahria-api (FastAPI, ASGI uvicorn, N réplicas)                    │
│  ├─ routers/            system · cognitive · agents · tasks        │
│  │                      executions · evidence · policy · studio    │
│  ├─ kernel/             invariants · state_machines · policy       │
│  │                      evidence · hybrid_reasoning · domains      │
│  └─ schemas/            pydantic v2 (contrats = types.ts actuels)  │
└───────┬───────────────────────────────┬────────────────────────────┘
        │ SQLAlchemy 2.0 async          │ Redis pub/sub + files Arq
        ▼                               ▼
┌─────────────────┐          ┌──────────────────────────────────────┐
│ PostgreSQL 16   │          │  yahria-workers (Arq)                │
│ 20 tables       │          │  ├─ studio_pipeline (S2, coder, zip) │
│ Alembic HEAD    │          │  ├─ execution_fabric (sandbox 3 prof.)│
│ RLS multi-tenant│          │  └─ cognitive_loop (boucles longues) │
└─────────────────┘          └──────────────────────────────────────┘
```

**Choix structurants**

| Décision | Option retenue | Justification constitutionnelle |
|---|---|---|
| Framework ASGI | FastAPI + pydantic v2 | Contrats typés = miroir direct de `types.ts` ; OpenAPI pour D.17 |
| ORM | SQLAlchemy 2.0 async + Alembic | Migrations versionnées exigées par INV-142 (schéma prouvé) |
| Files/temps réel | Redis 7 (Arq + pub/sub) | Le bus mono-processus viole la haute disponibilité ; pub/sub restaure le fan-out multi-réplica |
| Workers | Arq (asyncio natif) | Évite le modèle de processus Celery ; cohérent avec l'async FastAPI |
| Isolation | `asyncpg` + RLS par tenant | INV-020 : cloisonnement locatif vérifiable en base, pas seulement en code |
| Sandboxes | non modifié (containers + OverlayFS) | D.10 inchangé — R7 ne touche pas au périmètre d'exécution |

---

## 3. Mapping du modèle de données (Prisma → SQLAlchemy)

Les 17 modèles actuels (15 + GenerationRun + GeneratedFile) sont repris avec la même sémantique d'états. Les tableaux JSON sérialisés en `String` sous SQLite deviennent des colonnes `JSONB` indexables.

| Modèle Prisma | Table PostgreSQL | Changements notables |
|---|---|---|
| Tenant / Organization / Project | `tenants`, `organizations`, `projects` | RLS `tenant_id` sur les trois ; index unique `(tenant_id, slug)` |
| Domain | `domains` | `phase` conservé (ordre canonique D.00→D.23) |
| Agent / AgentRun | `agents`, `agent_runs` | `capabilities JSONB` ; index `(agent_id, started_at DESC)` |
| CognitiveTrace | `cognitive_traces` | `world_state`, `plan` → JSONB ; rétention 90 j (job Arq) |
| Task | `tasks` | `depends_on UUID[]` + contrainte d'acyclicité par trigger |
| Execution | `executions` | partition par mois sur `created_at` |
| Evidence | `evidences` | chaîne `prev_hash` vérifiée par job quotidien ; table append-only (règle REVOKE UPDATE/DELETE) |
| SystemEvent | `system_events` | partition mensuelle, compression > 30 j |
| PolicyRule / PolicyDecision | `policy_rules`, `policy_decisions` | règles versionnées immuables (nouvelle ligne par version) |
| MemoryRecord | `memory_records` | `confidence NUMERIC(3,2)` + contrainte `CHECK (0..1)` (INV-081) |
| FailureEvent | `failure_events` | `fingerprint` unique partiel sur incidents ouverts |
| ReasoningRoute | `reasoning_routes` | télémétrie S1/S2, agrégats matérialisés |
| GenerationRun / GeneratedFile | `generation_runs`, `generated_files` | contenus en `BYTEA` au-delà de 32 Ko, sinon `TEXT` ; `sha256` indexé |

---

## 4. Phases d'implémentation

### R7.1 — Socle dépôt & constitution Python (1 semaine)
- Dépôt `yahria-core/` (paquet Python) : `kernel/` porté depuis `src/lib/yahria/` — `invariants.py`, `state_machines.py`, `policy_engine.py`, `evidence_engine.py`, `hybrid_reasoning.py`, `domains.py`, `types.py` (dataclasses/pydantic).
- Portage mécanique et ordonné : mêmes noms, mêmes constantes, mêmes messages d'erreur → la grille de tests TypeScript existante est transposée en pytest **avant** le portage (tests d'abord = parité prouvable).
- Livrable : `pytest` vert sur invariants + machines à états (422 sur transition illégale incluse).
- Critère d'acceptation : 100 % des cas de test TS transposés, zéro divergence de verdict.

### R7.2 — Persistance PostgreSQL (1,5 semaine)
- Schéma Alembic complet (§3), `docker-compose` PostgreSQL 16 + Redis 7, connection pool asyncpg.
- Couche dépôt (`repositories/`) : chaque accès Prisma actuel devient une fonction async typée — pas d'ORM dispersé dans les routers.
- Migrations : `alembic revision` pour chaque évolution future ; `alembic check` dans CI.
- Critère : la suite R7.1 passe contre la vraie base ; transitions concurrentes (10 tâches → même transition) produisent exactement 1 succès et 9 × 422.

### R7.3 — API FastAPI + parité contractuelle (1,5 semaine)
- Routers reprenant les chemins actuels (`/api/yahria/...`) pour que Mission Control bascule sans réécriture frontend.
- `ws://…/ws/yahria` : handshake, snapshot des 100 derniers événements, heartbeat — contrat identique à `server.mjs`.
- Harness de parité : pour chaque endpoint, requêtes jumelles TS/Python → diff JSON normalisé doit être vide (hors timestamps).
- Critère : Mission Control pointé sur FastAPI affiche les 9 panneaux sans modification.

### R7.4 — Workers & fabrique d'exécution (1,5 semaine)
- Jobs Arq : `studio_pipeline`, `cognitive_loop`, `evidence_seal`, `retention_sweep`.
- Le pipeline Studio devient résistant aux redémarrages : état courant en base, reprise à la dernière transition (le run ne repart jamais de SUBMITTED après PERCEIVED).
- Sandbox D.10 : orchestration des profils STANDARD/RESTRICTED/PARANOID depuis le worker (limits cgroup, timeout, collecte stdout preuve).
- Critère : kill -9 du worker pendant GENERATING → reprise propre, aucune double écriture workspace (verrou `pg_advisory_lock` par run).

### R7.5 — Studio sur worker + S2 LLM Python (1 semaine)
- Client LLM Python (SDK équivalent, fallback heuristique étiqueté INV-210 conservé).
- `propose_tree`, `plan_blueprint`, `generate_file_content` : prompts identiques au octet près, vérifications structurelles (équilibrage, placeholders, JSON) portées en `verification.py`.
- Packaging ZIP côté worker + écrite workspace avec garde `safejoin` équivalente.
- Critère : un run 5 fichiers scellé en ≤ 90 s, preuves chaînées vérifiées depuis l'API Python.

### R7.6 — Dual-run, charge & bascule (1 semaine)
- Shadow traffic : 1 semaine avec les deux backends alimentés en parallèle (écritures réelles seulement côté Python ; côté SQLite, mode lecture comparée).
- Charge : k6/Locust — 200 runs concurrents, 5 000 événements/s sur le bus, p95 < 250 ms sur les lectures.
- Bascule : variable d'env `YAHRIA_BACKEND=python|node` dans Mission Control ; retour arrière possible pendant 30 jours (l'API Node reste déployée mais figée).
- Critère : 7 jours sans écart de parité + charge verte → cutover officiel, tag `v2.0.0-python`.

---

## 5. Risques et mitigations

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Divergence sémantique invariants portés | Moyenne | Haut | Tests de parité générés depuis la suite TS avant portage ; revue croisée fichier par fichier |
| Perte de la continuité `prev_hash` à la migration | Faible | Critique | La chaîne est ré-ancrée : première preuve Python porte `prev_hash` = dernier hash SQLite exporté (continuité prouvable) |
| Comportements LLM non déterministes entre SDK TS/Python | Moyenne | Moyen | Prompts figés (fixtures), température 0 pour le blueprint, diff de parité sur les JSON planifiés (pas sur le code généré) |
| SQLite → PostgreSQL : subtilités de transactions | Moyenne | Moyen | R7.2 exige le test de concurrence (1 gagnant / 9 × 422) avant tout router |
| Double maintenance Node/Python pendant la bascule | Certaine | Moyen | Fenêtre bornée à 30 jours ; aucun feature flag permanent — la version Node est gelée |

---

## 6. Definition of Done — R7

1. `pytest` : ≥ 400 tests verts couvrant invariants, machines à états, politiques, preuves, reasoning, studio.
2. Parité contractuelle : diff vide sur l'ensemble des endpoints jumelés pendant 7 jours consécutifs.
3. Charge : 200 runs concurrents sans perte d'événement WS ni deadlock PostgreSQL.
4. Reprise sur incident : kill du worker à chaque état du pipeline → aucune run orpheline, aucune écriture hors workspace.
5. Mission Control basculé sur FastAPI, WS stable 24 h, tableau de bord Préuves alimenté par les preuves Python.
6. Documentation : `docs/R7_PORTAGE_POSTGRESQL_PYTHON.md` (ce document) + ADR-001..ADR-006 enregistrées pour chaque décision du §2.
