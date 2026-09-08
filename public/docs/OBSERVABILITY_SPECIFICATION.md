# YAHRIA — EXECUTION OBSERVABILITY SPECIFICATION (Domaine 11)

| | |
|---|---|
| **Doc ID** | YAHRIA-KRN-028 |
| **Version** | 1.0.0 |
| **Domaine** | D.11 — Execution Observability |
| **Module** | `src/lib/yahria/observability.ts` |
| **Endpoint** | `GET /api/yahria/observability[?traceId=TR-…]` · `POST {action: replay \| drift}` |
| **UI** | Onglet « Observabilité » (panneau R13) |
| **Invariants** | **INV-218** (replay lecture seule), **INV-217** (continuité de trace), INV-110 (intégrité), INV-112 (replay), INV-190 (exécution versionnée) |
| **Preuves** | `scripts/r13-agent-observability-policy-tests.ts` — 46/46 PASS (sections C) |
| **Date** | 2026-09-07 |

---

## 1. Objet

Le socle événementiel existait déjà (bus realtime avec fan-out WebSocket, journal `SystemEvent`, chaîne de preuves hash-chaînée, `ToolInvocation`, `AgentRun`, `Execution`, `PolicyDecision`). Ce qui manquait : transformer ces enregistrements dispersés en **traces rejouables** et en **forensics** vérifiables. KRN-028 assemble, ordonne et re-vérifie — il ne ré-exécute jamais rien.

## 2. Les quatre capacités

| Capacité | Ce qu'elle fait | Garde constitutionnelle |
|---|---|---|
| **Index des traces** | Union des `traceId` across Evidence / ToolInvocation / AgentRun / Execution / PolicyDecision (le champ `trace` est propagé dans le JSON `request` des décisions) | Aucune fabrication : une trace n'existe que si des enregistrements la portent |
| **Timeline assemblée** | Une trace → entrées ordonnées chronologiquement, typées (`EVIDENCE`, `TOOL_INVOCATION`, `AGENT_RUN`, `EXECUTION`, `POLICY_DECISION`, `SYSTEM_EVENT`), avec acteur, résumé, sévérité et détail | Lecture seule |
| **Replay** | Reconstruction des faits + deux re-vérifications déterministes S1 : recomputation des empreintes SHA-256 des preuves de la trace (INV-110) et re-validation des inputs d'invocations enregistrés contre les contrats **ACTUELS** du registre (détection de drift, INV-190) | **INV-218 : zéro ré-exécution d'effet de bord, zéro mutation — mesuré (comptage invocations inchangé)** |
| **Rapport de drift** | Par outil : invocations `ok=true` historiques qui ne passeraient plus le contrat actuel | Les refus de contrat historiques (VALIDATION_FAILED) ne comptent PAS comme drift — ils prouvent que la porte a fonctionné |

## 3. Forensics

- **Intégrité par trace** : chaque preuve est re-hachée depuis ses champs stockés (`category`, `claim`, `actor`, `payload`, `prevHash`) — toute divergence est signalée comme `EMPREINTE MODIFIÉE` (INV-110). La suite R13 vérifie 0 altération sur les traces de missions.
- **Synthèse forensics** : total par type, refus de politique, échecs, fenêtre temporelle — une trace mission expose immédiatement ses DENY et ses échecs.
- **Drift registre ↔ historique** : si un contrat évolue en rompant ses appelants passés, le rapport le montre outil par outil avec échantillons d'erreurs.

## 4. Sémantique de drift (choix constitutionnel)

`drift = invocation auth:ALLOW + ok:true (donc réellement exécutée) qui violerait le contrat actuel.`

Une invocation historique refusée à la porte contrat (`ok=false`, `VALIDATION_FAILED`) n'est **pas** un drift : elle n'a jamais été exécutée et son enregistrement est la preuve du refus. Ce choix évite les fausses alertes et aligne le rapport sur la réalité d'exécution (INV-210 : pas de faux succès, pas de faux échec).

## 5. Frontières honnêtes

- Le replay reconstruit des **faits enregistrés** ; il ne re-exécute ni les outils, ni les boucles cognitives (une boucle S2 ré-exécutée ne serait plus déterministe — INV-191).
- L'index scanne les 400 enregistrements les plus récents par table : les traces très anciennes restent accessibles directement par `traceId`, mais peuvent ne plus apparaître dans l'index.
- Les décisions de politique antérieures à R13 ne portent pas le champ `trace` dans leur JSON de requête : elles sont rejouables via les autres sources de la trace.

## 6. Preuves

Section C de la suite R13 (46/46 PASS) : traces de missions trouvées multi-sources, timeline ordonnée contenant la sortie `uname` réelle, intégrité 0 altération, replay avec comptage d'invocations inchangé (INV-218 mesuré), re-contrat valide, 0 drift sur les contrats actuels.
