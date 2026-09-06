# YAHRIA — SANDBOX EXECUTION SPECIFICATION (Preuve live des livraisons Studio)

| | |
|---|---|
| **Doc ID** | YAHRIA-KRN-024 / YAHRIA-STD-003 |
| **Version** | 1.0.0 |
| **Domaine** | D.08 — Execution Fabric |
| **Modules** | `src/lib/yahria/sandbox-executor.ts` (mécanique) · `src/lib/yahria/live-proof.ts` (boucle gouvernée) |
| **Endpoint** | `POST /api/yahria/studio/runs/[id]/execute` |
| **Invariants** | INV-042, INV-080, INV-190, INV-210, INV-211 · POL-009 · machine à états `SEALED → LIVE_PROVED` |
| **Date** | 2026-09-07 |

---

## 1. Objet

Avant R11, le Studio livrait un ZIP scellé dont la vérification restait **structurelle** (contrôle de forme par le registre PCC) : rien ne prouvait que l'application générée *démarrait réellement*. R11 ferme la boucle d'autonomie : la livraison scellée peut maintenant être **exécutée en sandbox** — installation des dépendances, vérification syntaxique, build, lancement réel, **sondes HTTP** — et, en cas d'échec, **auto-réparée** par l'éditeur IA dans un budget borné, jusqu'à preuve live ou échec honnête.

Le verdict est un **fait mesuré** (réponse HTTP de l'app réelle), jamais une supposition (INV-080) : c'est la différence entre « le code est bien formé » et « l'application tourne ».

## 2. Pipeline d'exécution (sandbox-executor, mécanique pure)

`executeLiveAttempt()` enchaîne des étapes bornées (INV-042) sur des **recettes fixes** — aucun shell fourni par l'utilisateur, aucune injection possible :

| Étape | TIMEOUT | PYTHON | NEXTJS | NODE | STATIC_WEB | GO | RUST | JAVA |
|---|---|---|---|---|---|---|---|---|
| install | 150 s | `pip3 install -r requirements.txt` (toléré) | `bun install` | `bun install` (toléré) | — | — | — | — |
| syntaxe | 20 s/fich. | `python3 -m py_compile` | — | `node --check` | — | — | — | — |
| build | 300 s | — | `bunx next build` | — | — | `go build` | `cargo build --release` | `javac` |
| lancement | — | `uvicorn <mod>:app` | `bunx next start -p P` | `node/bun <entry>` | `http.server` | `./app.bin` | binaire release | — |
| sonde HTTP | 45 s | `/health /docs /` | `/` | `/ /health /api` | `/` | `/ /health` | `/ /health` | — |

Décisions clés :
- **Module uvicorn en chemin pointé** : `app/main.py` → `app.main:app` (bug corrigé après le premier test).
- **Environnement enfant scrubé** (INV-213 adjacent) : PATH/HOME/LANG seulement + PORT — ni `DATABASE_URL`, ni clés API, ni variables YAHRIA.
- **Ports** : balayage borné 3910+ (2 par tentative) ; processus en **groupe détaché**, arrêté SIGTERM puis SIGKILL.
- **Sorties** : queues de 8 Ko max ; le diagnostic de lancement garde **la fin** de stderr (où Python écrit `ModuleNotFoundError`), pas le début.
- **Toolchains** détectés et **versions journalisées** dans chaque rapport (INV-190) : python3, pip3, bun, node, go, cargo, javac.

## 3. Verdicts honnêtes (INV-210)

| Verdict | Signification | Effet machine à états |
|---|---|---|
| `PROVED` | serveur réel démarré, au moins une sonde HTTP < 400 | `SEALED → LIVE_PROVED` (transition gardée, monotone) |
| `PARTIAL` | compile/installation OK mais pas de serveur HTTP à sonder (CLI, bibliothèque) | reste `SEALED`, `liveState=PARTIAL` |
| `UNPROVED` | échec identifié (toolchain absente, install, syntaxe, build, lancement/sonde) | reste `SEALED`, `liveState=UNPROVED` |

La livraison scellée **n'est jamais rétrogradée** : un échec live ne touche ni l'état ni le ZIP ; l'échec laisse des preuves (INV-211). Toolchain absente (ex. `go` non installé) → `UNPROVED` explicite « toolchain manquante », jamais une fausse réussite.

## 4. Boucle gouvernée avec self-heal (live-proof)

`runLiveProof(runId)` ajoute la gouvernance au-dessus de la mécanique :

1. **Gardes** : run `SEALED` requis (sinon 422/erreur) ; pas de double exécution (`liveState=RUNNING` interdit la relance) ; `LIVE_PROVED` est terminal (re-exécution refusée — la machine est monotone).
2. **D.6 gouverne** : `evaluatePolicy({action:'execution.run', resource:'sandbox.live'})` → POL-009 `ALLOW` requis avant tout lancement.
3. **Boucle** : `MAX_ATTEMPTS` (défaut 3, `YAHRIA_LIVE_MAX_ATTEMPTS`) dans un budget global (`YAHRIA_LIVE_BUDGET_MS`, défaut 15 min) :
   - `executeLiveAttempt()` → verdict ;
   - si `UNPROVED` → **diagnostic** : localisation du fichier fautif (chemin apparaissant dans la sortie d'erreur ; sinon heuristique « étape install → manifeste de dépendances » ; sinon fichier `entry`) ;
   - **réparation** via l'éditeur IA existant (`editGeneratedFile`) avec directive de correction incluant le **contenu actuel du fichier** (correctif R11 : l'éditeur régénérait à l'aveugle — une réparation sans voir le code est une devinette, INV-210) ;
   - re-scellement du ZIP par l'éditeur, nouvelle tentative.
4. **Traçabilité** : chaque tentative devient une ligne `LiveCheck` (rapport JSON complet), un événement temps réel (`studio.live.*`), et une preuve (`captureAndPersist`, CRITICAL si PROVED).

## 5. Schéma

`GenerationRun` : + `liveState` (`NOT_RUN|RUNNING|PROVED|PARTIAL|UNPROVED`), `livePort`, relation `liveChecks`.
`LiveCheck` : `runId`, `attempt`, `state` (`PROVED|PARTIAL|UNPROVED`), `report` (JSON `LiveReport` complet : toolchain, steps, probes, ms).

## 6. Preuve d'acceptation (test réel, 2026-09-07)

Cycle exécuté sur RUN-000009 (API FastAPI générée par S2, 7 fichiers) :
1. tentative 1 : `UNPROVED` (erreur Pydantic dans `app/schemas.py`) ;
2. self-heal : régénération de `app/schemas.py` avec contenu visible, ZIP re-scellé ;
3. tentative 2 : **`PROVED`** — syntaxe 4/4 ✓, `GET /docs → 200` (UI OpenAPI réelle), port 3914, `SEALED → LIVE_PROVED` ;
4. journal WS : « APP RÉELLEMENT EXÉCUTÉE — HTTP 200 sur port 3914 en 1.3s (auto-réparée : app/schemas.py) ».

Cas d'école supplémentaires observés pendant le calibrage : `requirements.txt` invalide (`python<4.0,>=3.9`) réparé automatiquement par la boucle ; budget 3 tentatives épuisé sur un bug Pydantic récalcitrant → `UNPROVED` honnête, livraison conservée.

## 7. Frontières honnêtes

- **Isolation = process-level** (cwd confiné, env scrubé, recettes fixes, timeouts, kill de groupe) — **pas un conteneur ni OverlayFS noyau** : un code généré malveillant pourrait écrire dans le workspace et lire le réseau hôte. L'élévation vers conteneur/firejail/namespaces reste un jalon futur (l'OverlayFS de la constitution reste, lui, conceptuel).
- `pip3 install` utilise le réseau hôte — POL-003 (interdiction d'egress) s'applique au sandbox *agent* de la constitution ; ici l'hôte exécute des recettes bornées. Écart documenté, assumé.
- Les sondes sont des GET publics (< 400) : elles prouvent que le serveur répond, pas la justesse métier des réponses (des tests fonctionnels générés sont l'étape suivante naturelle).
- Next.js : le build réel est exécuté (preuve forte) mais `next start` n'est sondé que sur `/` (les pages d'erreur React peuvent répondre 200 — acceptable pour la preuve de démarrage).
- Une seule exécution live à la fois par run ; les exécutions concurrentes de runs différents sont possibles (ports distincts par balayage).
