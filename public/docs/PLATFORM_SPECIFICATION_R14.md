# YAHRIA — SPÉCIFICATION PLATEFORME R14
## D.07 · D.13 · D.14 · D.15 · D.17 · D.18 · D.19 · D.20 · D.21 · D.22 · D.23

**Version** : 1.0.0 · **Statut** : IMPLÉMENTÉ (preuves archivées, ledger `DOMAIN_ACTIVATIONS`) · **Date** : 2026-09-07

> Principe directeur : `UNKNOWN ≠ SUCCESS`. Chaque comportement décrit ici est
> exécuté par un module noyau identifié (YAHRIA-KRN-0xx), gardé par des
> invariants numérotés (INV-xxx), scellé en preuves SHA-256 et vérifiable via
> l'API. Rien de ce document n'est une promesse : ce sont des faits mesurés.

---

## 1. D.07 — TASK GRAPH AVANCÉ (KRN-031, `mission-graph.ts`)

Orchestration multi-agents sous gouvernance constitutionnelle.

**Modèle** — `Mission` (missionUid `MIS-XXXXXX`, objectif, machine à états
`PLANNED → SCHEDULED → RUNNING → COMPLETED | FAILED | BLOCKED | CANCELLED`,
traceId de mission) ; `MissionTask` (seq, agent canonique, outil du registre,
`dependsOn` par ids, retries/maxRetries).

**Gates à la création** (ordre strict) :
1. *DAG integrity* (INV-223) — graphe acyclique, dépendances internes, ordre topologique ; violation → **422**.
2. *Actor identity* (INV-224) — l'agent doit exister dans `CANONICAL_AGENTS` ; l'outil dans `BUILT_IN_TOOLS` (INV-062) ; invention → **422**.

**Décomposition S1** — `strategy: 'DECOMPOSED'` applique des patrons
déterministes (DIAGNOSTIC / GOUVERNANCE / OBSERVATION) n'utilisant que des
agents et outils réels (INV-191) ; `MANUAL` conserve les tâches soumises.

**Exécution** — `tick` = une vague du DAG : les tâches dont les dépendances
sont `COMPLETED` passent `READY → RUNNING` puis exécutent via
`runAgentMission` (INV-216 capacité → INV-062 politique, INV-217 trace unique).
Retry gouverné (INV-092) : **uniquement** un échec `EXECUTION_FAILED`, dans la
limite `maxRetries` ; un refus de politique/capacité est **final** et jamais
retenté. Verdicts honnêtes par agrégation : `COMPLETED` (tout réussi),
`FAILED` (échecs terminaux), sinon `RUNNING` (reste à exécuter).

**Annulation** — autorité humaine (INV-200/201), raison ≥ 10 caractères,
tâches restantes `CANCELLED`, preuve scellée.

**API** — `GET /api/yahria/missions[?uid=]`, `POST {action: create|schedule|tick|cancel}`.

---

## 2. D.13 — MEMORY SYSTEM GOUVERNÉ (KRN-030, `memory.ts`)

La mémoire n'est jamais une vérité automatique (INV-140) : chaque
enregistrement porte `source`, `confidence`, `validation`
(`VERIFIED | PROBABLE | UNCERTAIN | UNKNOWN | FALSE`) et `kind`
(`WORKING | EPISODIC | SEMANTIC | ARCHITECTURAL`).

- **Écriture** (INV-221) : `source` obligatoire — une écriture sans provenance
  est refusée **422** ; upsert idempotent par `(kind, key)` ; preuve `MEMORY`
  scellée à chaque mutation.
- **Consolidation** : `WORKING/EPISODIC → SEMANTIC`, monotone, confiance +0.15
  plafonnée à 1.0, refusée pour une mémoire `FALSE` ; preuve adossée.
- **Oubli** (INV-222) : raison gouvernée ≥ 10 caractères, preuve scellée,
  `ARCHITECTURAL` **non supprimable** (supplantation uniquement) → **422** sinon.
- **Récupération S1** : filtres kind/validation/recherche, rangée confiance +
  récence ; la validation voyage avec le souvenir.

**API** — `GET|POST|PATCH|DELETE /api/yahria/memory`.

---

## 3. D.14 — LEARNING ENGINE (KRN-032, `learning.ts`)

Apprentissage fondé sur les **faits enregistrés uniquement** (INV-226) :
`ToolInvocation`, `AgentRun`, `FailureEvent`. Aucun auto-rapport de modèle.

- **Mining déterministe** : agrégations `TOOL_RELIABILITY` (taux de succès,
  latence moyenne), `AGENT_PERFORMANCE` (complétion), `FAILURE_PATTERN`
  (empreintes récurrentes ≥ 2 occurrences).
- **Seuil** (INV-225) : `OBSERVED` < 3 échantillons ≤ `VALIDATED` ; confiance
  dérivée `min(0.95, 0.3 + 0.1×échantillons)` (fonction pure testée par gate).
- **Upsert** : un insight `PROMOTED/RETIRED` (décision gouvernée) n'est plus
  muté par le mining.
- **Promotion** (INV-150/151) : insight `VALIDATED` → mémoire `SEMANTIC`
  (pont D.14→D.13), réversible, preuve `MODEL` scellée ; refus **422** sinon.

**API** — `GET /api/yahria/learning`, `POST {action: mine|promote}`.

---

## 4. D.15 — SELF-EVOLUTION GOUVERNÉE (KRN-033, `evolution.ts`)

L'évolution **propose**, elle ne modifie **jamais** la production (INV-228 ;
dépendance interdite « Self-Evolution ↛ production »).

**Pipeline** (INV-162, transitions illégales → **422**) :
`DRAFTED → SUBMITTED → UNDER_REVIEW → APPROVED | REJECTED → SCHEDULED →
PROMOTED → ROLLED_BACK`.

- **Séparation mécanisée** (INV-161/227) : le système refuse qu'une identité
  approuve/rejette une proposition qu'elle a elle-même proposée — y compris
  `HUMAN` vs `AGENT:key` (refus testé).
- **Rollback** (INV-163) : plan obligatoire (≥ 15 caractères) pour
  `HIGH/CRITICAL` avant `APPROVED`, et pour **toutes** avant `PROMOTED`.
- **Expérimentation** : résultats exigés avant `PROMOTED` (INV-162).
- **Lignée** : `sourceInsightUid` doit référencer une insight existante (INV-034).
- Chaque décision scelle une preuve `POLICY` avec identité et raison.

**API** — `GET /api/yahria/evolution`, `POST {action: create|submit|review|approve|reject|schedule|promote|rollback}`.

---

## 5. D.17 — API & INTEGRATION (KRN-034, `api-gateway.ts` + `/api/v1/*`)

Surface externe versionnée **v1.0.0** gouvernée par clé.

- **Clés** (INV-229) : `yah_live_<48 hex>` ; stockage **SHA-256 uniquement** ;
  plaintext retourné **une seule fois** à l'émission, jamais relisible ; le
  prefix (16 car.) sert de repère d'affichage.
- **Auth** (INV-230) : `Authorization: Bearer yah_live_…` ; clé absente ou
  inconnue → **401** ; révoquée → **401** ; hors scope → **403** ; rate limit →
  **429**. Scopes hiérarchiques `read < write < admin` ; rate limit par clé,
  fenêtre glissante 60 s, bornes 5..600/min.
- **Ressources GET** : `system`, `domains`, `missions`, `tools`, `memory`,
  `evidence`, `ops`, `health`, `roadmap` (lecture, scope `read`).
- **Écriture** : `POST /api/v1/missions` (scope `write`) — crée une mission
  passant par les mêmes gates DAG que la console.
- Chaque appel émet un événement `api.v1.call` (observabilité).

**Gestion** — `GET|POST|PUT /api/yahria/apikeys` (émission / liste masquée /
révocation gouvernée avec raison).

---

## 6. D.19 — SECURITY (KRN-035, `security.ts`)

Audit automatisé à **8 contrôles factuels**, scellé (INV-231) :

| # | Contrôle | Sévérité |
|---|----------|----------|
| 1 | Refus par défaut vivant (POL-012 active, effet DENY) | CRITICAL |
| 2 | Règles constitutionnelles POL-0xx présentes (≥ 12) | HIGH |
| 3 | Clés API hachées SHA-256, prefix borné | CRITICAL |
| 4 | Clés fournisseurs côté serveur (noms inspectés, valeurs jamais lues — INV-213) | INFO |
| 5 | Niveau d'isolation sandbox rapporté honnêtement (INV-215) | INFO |
| 6 | Registre d'invariants cohérent (unicité, ≥ 97) | HIGH |
| 7 | Couverture de hachage des preuves (100 derniers) | HIGH |
| 8 | Scan d'identifiants versionnés (ghp_/github_pat_/sk-ant-/AKIA/…) — emplacements sans valeurs | CRITICAL si hit |

Chaque exécution persiste un `OpsSnapshot SECURITY_AUDIT` et scelle une preuve
`SECURITY` — les constats ne sont jamais mutés après coup.

---

## 7. D.20 — QUALITY ENGINEERING (KRN-036, `quality.ts`)

Gates **mesurées** in-process + gates **externes déclarées honnêtement**
(INV-171 — jamais simulées) :

- **G1** invariants (unicité, ≥ 97) · **G2** contrats outils (validateur S1) ·
  **G3** parité registre DB ↔ noyau · **G4** machines à états MISSION/EVOLUTION
  · **G5** logique apprentissage (fonctions pures auto-testées) · **G6**
  chaîne de preuves (échantillon 50).
- **G7** `tsc --noEmit` · **G8** `eslint` · **G9** `pytest` parité Python —
  exécutés par CI (`.github/workflows/ci.yml`) et `scripts/quality-gates.mjs`.
- Règle (INV-232) : **aucune capacité ne peut être déclarée DONE avec un gate
  qui échoue**. Chaque run persiste `OpsSnapshot QUALITY_GATES` + preuve `TEST`.

---

## 8. D.21 — DEVOPS & DELIVERY

- `.github/workflows/ci.yml` — CI constitutionnelle : install verrouillé,
  tsc, eslint, pytest parité, scan d'identifiants, seuil invariants, build.
- `scripts/quality-gates.mjs` — gates externes locales, échec honnête.
- `scripts/release.mjs` — release gouvernée : semver monotone (INV-190),
  working tree propre exigé (INV-180), `CHANGELOG.md` journalisé, push
  laissé à l'autorité humaine (INV-200).
- Livraison conteneurisée : `Dockerfile` (app), `docker-compose.yml`
  (app + PostgreSQL), image sandbox durcie 12 toolchains (INV-215).

## 9. D.22 — OPERATIONS (KRN-037, `ops.ts`)

- **Santé mesurée, jamais supposée** (INV-233) : `liveness` (pid, uptime, RSS)
  ; `readiness` = sondes réelles (base lue `domain.count ≥ 24`, bus temps réel,
  sandbox backend déclaré, fabric LLM).
- **SLO 24 h** dérivé des faits : invocations (succès, p50/p95), runs
  d'agents, échecs ; `— (aucun échantillon)` quand vide — jamais de faux vert.
- Runbook : `public/docs/OPERATIONS_RUNBOOK.md`.
- Frontière honnête (INV-210) : pas d'alerting externe multi-hôte sur l'hôte
  de preuve — les métriques portent sur le système lui-même.

## 10. D.23 — PRODUCT EVOLUTION & ROADMAP (KRN-038, `roadmap.ts`)

- **Dérivée du ledger** (INV-234) : score déterministe
  `(24 − phase) × 10 + 50 (transverse) + bonus statut (30 NOT_STARTED non
  activé, 10 IMPLEMENTING, 0 VERIFIED)` — aucun statut éditable à la main.
- **Horizons** : MVP (phases 0–8) / ALPHA (9–13) / BETA (14–18) /
  ENTERPRISE (19–23).
- Top 8 priorités avec justification factuelle ; ledger d'activation exposé
  (dates + compteurs de preuves).

## 11. D.18 — FRONTEND & USER EXPERIENCE

Mission Control — **26 onglets** : Studio autonome, Souveraineté R8,
Connecteurs IA, **Orchestration missions**, Missions agents, **Mémoire**,
**Apprentissage**, **Auto-évolution**, Registre des outils, Console
politiques, Observabilité, **API & Intégration**, **Sécurité**, **Qualité**,
**DevOps**, **Opérations**, **Roadmap**, Centre de commande, Raisonnement
hybride, Agent OS, Graphe de tâches, Exécutions, Preuves, Politiques,
Blueprint, Temps réel.

Responsive (grilles md/lg, onglets wrap), thème industriel sombre cohérent,
temps réel WebSocket (fan-out du bus), verdicts honnêtes affichés partout,
badges d'état standardisés, footer collant, accessibilité sémantique.

---

## 12. INVARIANTS NOUVEAUX (INV-221 → INV-234)

INV-221 provenance mémoire obligatoire · INV-222 oubli gouverné · INV-223
intégrité DAG de mission · INV-224 une tâche/un acteur/une trace · INV-225
seuil d'insight (3 échantillons) · INV-226 apprentissage sans feedback libre ·
INV-227 séparation proposition/approbation mécanisée · INV-228 aucune mutation
de production par l'évolution · INV-229 clé hachée uniquement · INV-230
surface versionnée gouvernée · INV-231 constats d'audit scellés · INV-232
gates avant toute déclaration · INV-233 santé mesurée · INV-234 roadmap
dérivée du ledger. **Total registre : 97 invariants.**
