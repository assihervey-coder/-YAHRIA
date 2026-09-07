# YAHRIA — TOOL REGISTRY SPECIFICATION (Domaine 09)

| | |
|---|---|
| **Doc ID** | YAHRIA-KRN-025 (noyau) / YAHRIA-KRN-026 (exécuteur borné) |
| **Version** | 1.0.0 |
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

## 4. Registre built-in (5 outils réels)

| toolId | Classe | Handler | Preuve |
|---|---|---|---|
| `system.domains.list` | READ_ONLY | 24 domaines + statuts d'activation | invocation réelle |
| `studio.runs.list` | READ_ONLY | dernières livraisons Studio (limit 1-20) | contrat testé (limit 500 → refusé) |
| `sandbox.toolchains.detect` | READ_ONLY | sonde INV-190 des toolchains hôte | gcc détecté en suite live |
| `evidence.recent.list` | READ_ONLY | chaîne de preuves hash-chaînée | invocation réelle |
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

## 8. Frontières honnêtes

- Les autorisations POL-AUTH-* vivent en DB (persistées) mais **aucune UI de gestion fine par rôle** (RBAC sur les outils) n'existe encore — D.12 approfondira.
- Le timeout outil est global (10 s) ; un budget CPU/mémoire par outil (cgroups) attend le backend conteneur D.10.
- Les outils déclaratifs n'ont pas de bridge plugin externe encore (SDK D.17).
