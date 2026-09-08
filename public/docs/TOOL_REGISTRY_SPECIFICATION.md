# YAHRIA — TOOL REGISTRY SPECIFICATION (Domaine 09)

| | |
|---|---|
| **Doc ID** | YAHRIA-KRN-025 (noyau) / YAHRIA-KRN-026 (exécuteur borné) / YAHRIA-KRN-027 (passerelle agents, R13) |
| **Version** | 1.1.0 |
| **Domaine** | D.09 — Tool Registry Engine |
| **Modules** | `src/lib/yahria/tool-registry.ts` · `src/lib/yahria/tool-executor.ts` |
| **Endpoint** | `GET/POST /api/yahria/tools` |
| **UI** | Onglet « Registre des outils » (13e panneau) |
| **Invariants** | **INV-062** (REGISTERED ≠ AUTHORIZED), INV-042, INV-052/133 (deny-by-default), INV-080, INV-190, INV-210, INV-213 · POL-006/011/012 |
| **Preuves** | `scripts/r12-tool-registry-tests.ts` — 22/22 PASS |
| **Date** | 2026-09-07 |

---

## 1. Objet

Avant R12, les agents YAHRIA disposaient de capacités internes (raisonnement, génération, sandbox) mais d'**aucun mécanisme formel** pour déclarer, découvrir, autoriser et invoquer des *outils*. D.09 comble ce vide avec une discipline constitutionnelle stricte : un outil enregistré n'est pas un outil autorisé, et un outil autorisé ne s'exécute que dans des bornes explicites avec preuve à l'appui.

## 2. Les quatre portes (aucune ne peut être contournée)

| Porte | Règle | En cas d'échec |
|---|---|---|
| **1. Enregistrement** | toolId `domaine.capacité.verbe`, semver **monotone** (downgrade refusé, INV-190), contrat JSON requis | 422 |
| **2. Autorisation** | `evaluatePolicy` **re-évalué à CHAQUE invocation** (INV-062) | DENY / REQUIRE_APPROVAL — décision persistée |
| **3. Contrat (S1)** | validateur déterministe strict : types, enum, min/max, maxLength, **champs non déclarés rejetés** | VALIDATION_FAILED — zéro exécution |
| **4. Exécution bornée** | timeout 10 s (INV-042), env scrubé (INV-213), argv **whitelisté uniquement** | EXECUTION_FAILED honnête (INV-210) |

## 3. Grille d'autorisation (INV-062 vivante)

| Ressource | Règle | Effet | Signification |
|---|---|---|---|
| `readonly.<toolId>` | POL-011 (prio 10) | ALLOW | Outil READ_ONLY enregistré → invocation bornée + preuve |
| `sideeffect.<toolId>` | POL-012 (prio 5) | **DENY** | Effet de bord → refusé **malgré l'enregistrement** |
| `sideeffect.<toolId>` | POL-AUTH-<TOOL> (prio 4) | ALLOW | Autorisation gouvernée **explicite et révocable** |
| `unregistered.<toolId>` | POL-006 (prio 3) | REQUIRE_APPROVAL | Outil inconnu du registre |
| *aucune correspondance* | fallback | DENY | INV-052/133 : deny-by-default |

L'autorisation d'un outil SIDE_EFFECT est une **mutation gouvernée** : elle crée une règle `POL-AUTH-*` nommée, prioritaire sur POL-012, traçable (événement `tool.authorized`) et **révocable** en tout instant. La priorité 4 < 5 garantit que l'ALLOW explicite bat le DENY générique — et la révocation rétablit le refus constitutionnel.

## 4. Registre built-in (7 outils réels)

| toolId | Classe | Handler | Preuve |
|---|---|---|---|
| `system.domains.list` | READ_ONLY | 24 domaines + statuts d'activation | invocation réelle |
| `studio.runs.list` | READ_ONLY | dernières livraisons Studio (limit 1-20) | contrat testé (limit 500 → refusé) |
| `sandbox.toolchains.detect` | READ_ONLY | sonde INV-190 des toolchains hôte | gcc détecté en suite live |
| `evidence.recent.list` | READ_ONLY | chaîne de preuves hash-chaînée | invocation réelle |
| `constitution.invariants.list` (R13) | READ_ONLY | invariants INV-xxx filtrables par famille | INV-219/220 lus par le reviewer en suite R13 |
| `policy.decisions.recent` (R13) | READ_ONLY | dernières décisions ALLOW/DENY/REQUIRE_APPROVAL | auditées par l'agent security en suite R13 |
| `sandbox.cli.run` | **SIDE_EFFECT** | sondes whitelistées : `uname` / `uptime` / `disk` | DENY par défaut → autorisé → `Linux` capturé → révoqué |

Aucune argv libre ne traverse la porte : l'outil `sandbox.cli.run` n'accepte qu'un enum de sondes prédéfinies — l'injection de commande est structurellement impossible.

## 5. Outils déclaratifs (honnêteté INV-210)

`register` accepte des définitions **sans handler** (outils externes futurs, plugins). Leur invocation aboutit à `EXECUTION_FAILED : registration déclarative — aucun handler exécutable lié (INV-210 : pas de fausse réussite)`. Le registre ne ment jamais sur ce qu'il peut exécuter.

## 6. Observabilité (Domaine 11)

Chaque invocation produit :
- **ToolInvocation** (DB) : input, résultat/error tronqués, effet d'autorisation, règle appariée, latence, traceId ;
- **PolicyDecision** (DB) pour la porte 2 — y compris les refus ;
- **Evidence** (chaîne SHA-256, catégorie TOOL) pour toute exécution passée la porte 3 ;
- **Événements temps réel** : `tool.registered`, `tool.invoked`, `tool.denied`, `tool.authorized`.

## 7. Preuves R12 (suite live, 22/22)

`bun run scripts/r12-tool-registry-tests.ts` exécute 15 scénarios réels contre l'API : registre seedé, découverte, registration + immutabilité des versions + refus de downgrade, REQUIRE_APPROVAL outil fantôme, invocation READ_ONLY réelle avec preuve scellée, deux refus de contrat stricts, démonstration complète INV-062 (DENY → autorisation gouvernée → ALLOW + uname réel → révocation → re-DENY), handler déclaratif honnête, comptage exact du journal (7 : l'outil fantôme est refusé *avant* enregistrement d'invocation — seule la PolicyDecision trace).

## 8. Passerelle agents ↔ registre (R13, KRN-027)

`src/lib/yahria/agent-tools.ts` branché les agents canoniques (D.05) sur le registre : ils **invoquent de vrais outils**. Deux portes dans l'ordre strict (INV-216) :

1. **Porte capacité (INV-071)** — l'outil doit mapper une capacité déclarée de l'agent via `TOOL_CAPABILITY_MAP` ; la matrice de droits est **dérivée** de la constitution (`agentGrantsFor`), jamais listée à la main. Un refus de capacité n'atteint JAMAIS le plan politique (aucune invocation, aucune PolicyDecision).
2. **Porte politique (INV-062)** — `invokeTool` complet : autorisation vivante, contrat S1, exécution bornée, preuve scellée.

Grants dérivés (R13) : tester→`sandbox.cli.run` · architecte/coder/reviewer→`system.domains.list`+`sandbox.toolchains.detect` · explorer→+`studio.runs.list` · reviewer→+`constitution.invariants.list` · debugger/security→`evidence.recent.list` · security→+`policy.decisions.recent` · planner/vérifier→aucun (honnêteté : leurs capacités task.*/acceptance.* n'ont pas d'outil mappé).

Chaque **mission** (`runAgentMission`) tourne sous une trace unique propagée à chaque invocation, décision et preuve (INV-217), persiste un AgentRun (STARTED→COMPLETED/BLOCKED/FAILED) et rend un verdict honnête : COMPLETED / PARTIAL / BLOCKED (refus politique) / FAILED / REJECTED. Vérifié au navigateur : mission architecte 2/2 outils réels, preuves EV-TOOL scellées.

## 9. Frontières honnêtes

- ~~Les autorisations POL-AUTH-* vivent en DB (persistées) mais **aucune UI de gestion fine par rôle** (RBAC sur les outils) n'existe encore~~ → **livré en R13** : console de politiques avec portée acteur (voir POLICY_CONSOLE_SPECIFICATION.md, INV-219/220).
- Le timeout outil est global (10 s) ; un budget CPU/mémoire par outil (cgroups) attend le backend conteneur D.10.
- Les outils déclaratifs n'ont pas de bridge plugin externe encore (SDK D.17).
