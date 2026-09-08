# yahria-core — Noyau constitutionnel Python (R7.1)

**Port de :** `src/lib/yahria/` (TypeScript) · **Statut :** R7.1 TERMINÉ — parité prouvée
**Autorité :** dérive de `00_AUTONOMOUS_CODING_CONTRACT.md` §5 et de `docs/R7_PORTAGE_POSTGRESQL_PYTHON.md`

Ce paquet est la **translation fidèle** du noyau constitutionnel YAHRIA vers Python 3.10+.
Ce n'est pas une réécriture : mêmes noms, mêmes constantes, mêmes messages d'erreur,
mêmes verdicts — prouvé par une grille de parité générée depuis le noyau TypeScript.

## Contenu (mapping 1:1)

| Module TS (source de vérité) | Module Python | Contenu |
|---|---|---|
| `types.ts` (YAHRIA-KRN-000) | `kernel/types.py` | 9 enums (TaskState…AgentKey), PolicyRequest/Evaluation, WorldState, PlanStep, ReasoningSignals, RouterDecision |
| `state-machines.ts` (KRN-001) | `kernel/state_machines.py` | 6 machines gardées (TASK/AGENT/EXECUTION/EVIDENCE/FAILURE/ACCEPTANCE), `can_transition`, `assert_transition`, `IllegalTransitionError` (422) |
| `invariants.ts` (KRN-002) | `kernel/invariants.py` | 74 invariants INV-001→INV-211 (textes exacts), familles ordonnées |
| `domains.ts` (KRN-003) | `kernel/domains.py` | 24 domaines (phase canonique), dépendances interdites §28, triptyque D.6/D.7/D.8 |
| `policy-engine.ts` (KRN-004) | `kernel/policy_engine.py` | POL-001…POL-010, deny-by-default (INV-052/133), wildcards `*` / préfixe, priorités |
| `evidence-engine.ts` (KRN-005) | `kernel/evidence_engine.py` | capture → chaînage SHA-256 (`prevHash`), `verify`, contrat minimum |
| `hybrid-reasoning.ts` (KRN-006) | `kernel/hybrid_reasoning.py` | signaux, complexité/incertitude (INV-081), routeur S1/S2/CASCADE, S1 déterministe, accord dual-process |
| — | `kernel/canonical_json.py` | couche de parité : `JSON.stringify` et `toFixed` émulés bit à bit (INV-191) |

## Grille de parité (zéro divergence)

Les fixtures `tests/fixtures/parity/fixtures.json` sont **générées depuis le noyau TypeScript** :

```bash
# depuis la racine du dépôt
npx tsx scripts/r7-parity-fixtures.ts
# → yahria-core/tests/fixtures/parity/fixtures.json

# depuis yahria-core/
python3 -m pytest          # 58 tests, 100 % verts
python3 -m pytest -m parity   # grille de parité seule
```

Couverture de la grille :

| Section | Cas | Vérification |
|---|---|---|
| Machines à états | **659 paires** (exhaustif, 6 machines) | verdict + règle + message d'erreur identiques ; illégal → `status_code 422` |
| Invariants | 74 entrées + 13 familles | id/family/title/rule exacts |
| Domaines | 24 + 7 interdictions + triptyque | ordre de phase bijective 0…23 |
| Politiques | 10 règles + 20 requêtes + wildcards | effect/matchedRule/reason/precedence exacts |
| Preuves | 10 hashes + chaîne A→B→C + 5 vérifs + 5 contrats | SHA-256 **byte-identiques**, UIDs `EV-TEST-000042` |
| Raisonnement | 20 requêtes (EN/FR) + 7 S1 + 3 accords + 9 niveaux | path, scores IEEE754 exacts, rationale `toFixed` identiques |

## Décisions de portage (INV-191 — non-déterminisme reconnu)

1. **Noms** : les champs des dataclasses gardent le camelCase TS (`evidenceUid`, `prevHash`…)
   pour une comparaison JSON directe ; les fonctions passent en snake_case Python.
2. **`\b` des regex** : JavaScript `\b` est ASCII-only ; Python est Unicode-aware
   (`étape` matcherait là où JS ne matche pas). Toutes les frontières sont émulées par
   lookarounds `[A-Za-z0-9_]` — parité sémantique exacte.
3. **`toFixed`** : émulé via `Fraction` (valeur binaire exacte du double, tie → plus grand n,
   ECMA-262). `0.125 → "0.13"`, `1.005 → "1.00"`.
4. **JSON canonique** : `JSON.stringify` reproduit (insertion-order, échappements, flottants).
   Payloads interdits : NaN/Infinity, lone surrogates.
5. **Horloge** : `capture_evidence(..., now=ISO)` et `captureEvidence(..., { now })`
   (ajout rétrocompatible côté TS) rendent la chaîne de preuves déterministe en test.
6. **`ms`** : durées mesurées exclues de la comparaison (non-déterministes par nature).
7. **`system2`** : la branche fallback heuristique est portée et testée ; le client LLM
   arrive en R7.5 (workers Arq), prompts identiques à l'octet.

## Périmètre R7.2+ (non inclus ici)

`evidence-store` (pont Prisma) n'est volontairement pas porté : la persistance devient
SQLAlchemy 2 async + PostgreSQL 16 avec re-ancrage de la chaîne (`prev_hash` = dernier
hash exporté de SQLite) — voir `docs/R7_PORTAGE_POSTGRESQL_PYTHON.md` §R7.2.

## Structure

```
yahria-core/
├── pyproject.toml            # paquet « kernel », pytest configuré (pythonpath, markers)
├── kernel/
│   ├── __init__.py           # surface publique + __version__ = 2.3.0-r7.1
│   ├── types.py
│   ├── state_machines.py
│   ├── invariants.py
│   ├── domains.py
│   ├── policy_engine.py
│   ├── evidence_engine.py
│   ├── hybrid_reasoning.py
│   └── canonical_json.py     # couche de parité JS (INV-191)
├── tests/
│   ├── conftest.py
│   ├── fixtures/parity/fixtures.json   # généré par scripts/r7-parity-fixtures.ts
│   ├── test_parity_state_machines.py   # 659 paires + 422
│   ├── test_parity_invariants_domains.py
│   ├── test_parity_policy.py
│   ├── test_parity_evidence.py         # chaîne SHA-256 byte-identique
│   ├── test_parity_reasoning.py
│   └── test_kernel_native.py           # propriétés constitutionnelles natives
└── README.md
```
