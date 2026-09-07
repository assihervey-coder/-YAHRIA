# YAHRIA — RUNBOOK OPÉRATIONS (D.22)
**Version** : 1.0.0 · **Statut** : opérationnel · **Date** : 2026-09-07

> INV-233 : la santé est MESURÉE, jamais supposée. Ce runbook décrit des
> procédures factuelles, exécutables par n'importe quel opérateur.

---

## 1. Points d'entrée

| Objet | Localisation |
|---|---|
| Health mesuré (liveness + readiness + SLO) | `GET /api/yahria/ops` |
| Audit sécurité (constats scellés) | `GET/POST /api/yahria/security` |
| Gates qualité (mesurées + externes) | `GET/POST /api/yahria/quality` |
| Roadmap dérivée du ledger | `GET /api/yahria/roadmap` |
| Bus temps réel | WebSocket `/` (events `EVT-*`) |
| Preuves (chaîne SHA-256) | `GET /api/yahria/evidence` |
| Observabilité (traces, replay, forensics) | `GET/POST /api/yahria/observability` |

## 2. Routine quotidienne (15 min)

1. **Sonde readiness** : `curl -s localhost:3000/api/yahria/ops | jq .report.readiness`
   — attendu `ok: true` avec 4 sondes vertes (`DATABASE`, `REALTIME_BUS`,
   `SANDBOX_BACKEND`, `LLM_FABRIC`). Une sonde rouge = procédure §4.
2. **SLO 24 h** : vérifier `toolInvocations.successRate ≥ 0.8` et
   `failures` anormalement haut. Un taux vide (`—`) signifie *aucun trafic*,
   PAS une bonne santé (INV-044).
3. **Audit sécurité hebdo** : `POST /api/yahria/security` — tout constat
   CRITICAL/HIGH non-OK déclenche la procédure §5.
4. **Gates qualité** : `POST /api/yahria/quality` — les gates IN PROCESS
   doivent passer ; les gates EXTERNES (tsc/eslint/pytest) sont vérifiées en CI
   (`gh run list`) ou localement via `bun scripts/quality-gates.mjs`.

## 3. Diagnostic — arbre de décision

```
readiness DATABASE rouge
├─ db/custom.db absent ou verrouillé → vérifier DATABASE_URL, redémarrer
├─ « domaines lisibles < 24 »        → bootstrap incomplet : recharger « / »
│                                       (ensureBootstrapped est idempotent)
└─ base corrompue                    → restaurer depuis la sauvegarde (§6)

readiness LLM_FABRIC dégradé
└─ les fournisseurs sont déclarés mais peuvent être injoignables :
   panneau « Connecteurs IA » → ping par fournisseur ; l'ordre de
   fallback est gouverné (INV-212), aucun appel direct hors fabric.

SLO successRate < 0.8
├─ panneau « Observabilité » → identifier les invocations refusées
│   (DENY = gouvernance normale, EXECUTION_FAILED = incident réel)
└─ panneau « Apprentissage » → mining : les insights FAILURE_PATTERN
    pointent les récurrences (INV-226).
```

## 4. Incidents — réponse standard

1. **Qualifier** : timeline de la trace (`GET /api/yahria/observability?traceId=…`)
   — la reconstruction est en LECTURE SEULE (INV-218).
2. **Intégrité** : forensics (`POST {action:'drift'}`) — recompute des
   empreintes SHA-256 ; toute altération est signalée (INV-110).
3. **Contenir** : annulation de mission par autorité humaine avec raison
   (`POST /api/yahria/missions {action:'cancel', reason}` — INV-200) ;
   désactivation de règle gouvernée via la Console politiques (INV-219 :
   les règles constitutionnelles restent intouchables).
4. **Préserver** : aucun échec n'efface les preuves (INV-211) — ne jamais
   supprimer la base avant extraction des preuves.
5. **Post-mortem** : insights d'échec via le mining (D.14), propositions
   d'évolution via D.15 (séparation proposition/approbation exigée, INV-227).

## 5. Procédure secret exposé

1. **Révoquer immédiatement** le secret chez le fournisseur (GitHub →
   Settings → Developer settings → Tokens → Delete).
2. Auditer : `POST /api/yahria/security` — le contrôle `REPO_SECRET_SCAN`
   signale les emplacements sans jamais journaliser les valeurs (INV-132).
3. Purger l'historique git si le secret est versionné (`git filter-repo`)
   puis forcer le push — coordonner avec tous les clones.
4. Ré-auditer jusqu'à `CONFORME` ; sceller l'incident (preuve SECURITY).

## 6. Sauvegarde & restauration

- **Sauvegarde** (sqlite) : `sqlite3 db/custom.db ".backup 'backups/custom-$(date +%F).db'"`
  ; conserver ≥ 7 jours glissants. PostgreSQL (compose) : `pg_dump`.
- **Restauration** : arrêter, remplacer le fichier, redémarrer — le bootstrap
  est idempotent et MONOTONE (les statuts de domaines ne régressent jamais).
- **Vérification post-restauration** : `GET /api/yahria/ops` (4 sondes) +
  `POST /api/yahria/quality` (gates) + comptage des preuves inchangé.

## 7. Livraison

- Release gouvernée : `bun scripts/release.mjs --version x.y.z --note "…"`
  (semver monotone, working tree propre exigé) puis `git push origin main`
  **manuellement** (INV-200 : l'humain garde l'autorité de livraison).
- CI : chaque push déclenche les gates constitutionnelles ; un rouge bloque
  toute déclaration de capacité DONE (INV-232).
- Conteneur : `docker compose up -d --build` (app + PostgreSQL) ; sandbox
  durcie via `YAHRIA_SANDBOX_BACKEND=docker` (INV-215) sur un hôte avec daemon.

## 8. Frontières honnêtes (INV-210)

- Pas d'alerting externe (PagerDuty/SMTP) ni de collecte multi-hôte sur
  l'hôte de preuve : les métriques couvrent CE système, mesurables et
  rejouables via l'API.
- Le backend sandbox `process` est une isolation documentée plus faible que
  `docker` ; l'audit sécurité rapporte le niveau réel en permanence.
