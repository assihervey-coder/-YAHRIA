# YAHRIA — POLICY CONSOLE SPECIFICATION (Domaine 12)

| | |
|---|---|
| **Doc ID** | YAHRIA-KRN-029 |
| **Version** | 1.0.0 |
| **Domaine** | D.12 — Policy & Governance Control Plane |
| **Module** | `src/lib/yahria/policy-console.ts` (moteur : `policy-engine.ts`, KRN-004 étendu) |
| **Endpoint** | `GET /api/yahria/policy-console` · `POST {action: create \| toggle \| simulate \| impact}` |
| **UI** | Onglet « Console politiques » (panneau R13) |
| **Invariants** | **INV-219** (règles constitutionnelles verrouillées), **INV-220** (simulation sans effet de bord), INV-121 (politique explicite, versionnée, auditable), INV-123 (décisions expliquables), INV-052/133 (deny-by-default) |
| **Preuves** | `scripts/r13-agent-observability-policy-tests.ts` — 46/46 PASS (sections B) |
| **Date** | 2026-09-07 |

---

## 1. Objet

R13 transforme le plan de contrôle de politique en **console gouvernée** : gestion fine RBAC des outils (règles avec portée acteur), simulateur, analyse d'impact — trois murs constitutionnels empêchent la console de devenir un vecteur de privilège.

## 2. RBAC fin — portée acteur

`evaluatePolicy` (KRN-004) accepte désormais, par règle, une portée d'acteur **optionnelle** :

```json
{ "action": "tool.execute", "resource": "sideeffect.sandbox.cli.run",
  "actorType": "AGENT", "actorId": "tester" }
```

- Règle sans portée → correspond à tout appelant (rétrocompatible avec POL-001..012).
- Règle avec portée → ne correspond qu'à cet acteur exact.
- La précédence reste la priorité (1 = évaluée en premier). Une ALLOW par acteur à priorité 4 bat le DENY générique POL-012 (priorité 5) **pour cet acteur seul** ; tous les autres appelants tombent sur POL-012.

**Scénario prouvé (suite R13)** : règle `POL-C-004` ALLOW `sideeffect.sandbox.cli.run` pour `AGENT:tester` — l'humain reste DENY (POL-012), le tester exécute réellement (`uname` → sortie Linux), la désactivation fait retomber le tester sous POL-012.

⚠️ **Leçon de sécurité (R13)** : la première implémentation perdait la portée acteur lors du saut DB→moteur (`authorizeInvoke` ne relisait pas `actorType`/`actorId` du JSON de condition) — une règle « tester seul » autorisait tout le monde. La suite R13 a attrapé la fuite avant la livraison ; le mapping est corrigé et commenté dans le code. **Une portée perdue équivaut à une élévation de privilège.**

## 3. Les quatre actions gouvernées

| Action | Effet | Garde |
|---|---|---|
| `create` | Crée une règle `POL-C-<seq>` (jamais de suppression ; version 1.0.0) | Validation stricte 422 (effet, scope, action/resource format pointu, priorité 1..100, **raison obligatoire ≥ 10 caractères** — INV-121) ; preuve POLICY scellée + événement `policy.rule.created` |
| `toggle` | Active/désactive une règle gouvernée (`POL-C-*`, `POL-AUTH-*`) | **INV-219** : POL-001..012 refusées (testé) ; raison obligatoire ; preuve scellée |
| `simulate` | Évalue la base ACTIVE contre un appel simulé (acteur, action, resource) | **INV-220 : ne persiste aucune décision** (comptage avant/après vérifié dans la suite) ; événement `policy.simulated` INFO |
| `impact` | Simule une bascule outil par outil : `before → after` pour chaque outil enregistré | Le brouillon **n'est jamais créé** (vérifié) ; la matrice vivante du registre reste inchangée |

## 4. Composition D.12 × D.09

L'analyse d'impact évalue le brouillon contre la **ressource vivante de chaque outil** (`readonly.<toolId>` / `sideeffect.<toolId>`) : avant création, l'opérateur voit exactement quels outils basculent (`BASCULE`) et lesquels restent stables (`inchangé`). La création d'une règle affecte immédiatement la matrice d'autorisation du registre (re-évaluation INV-062 à chaque invocation).

## 5. Frontières honnêtes

- La console ne crée que des règles `POL-C-*` ; les règles `POL-AUTH-*` restent gérées par la porte d'autorisation du registre (D.09) — deux surfaces, même discipline.
- La simulation évalue l'état ACTIF au moment T ; elle ne simule pas la composition temporelle (deux toggles successifs ne sont pas une transaction).
- Le comptage `POL-C-<seq>` est basé sur le nombre de règles existantes : les désactivations ne libèrent pas leurs identifiants (l'historique reste expliquable, INV-123).

## 6. Preuves

Section B de la suite R13 (46/46 PASS) : création RBAC par acteur, humain DENY / tester ALLOW réel, cycle toggle off→re-DENY→on, verrou constitutionnel (INV-219 refus testé), validation 422 multi-erreurs, simulateur sans persistance (INV-220 mesuré), impact à 7 bascules simulées sans création du brouillon.
