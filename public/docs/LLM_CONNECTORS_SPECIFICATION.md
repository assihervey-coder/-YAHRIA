# YAHRIA — LLM CONNECTORS SPECIFICATION (Fabric multi-fournisseurs)

| | |
|---|---|
| **Doc ID** | YAHRIA-KRN-023 |
| **Version** | 1.0.0 |
| **Domaine** | D.08 — Execution Fabric (couche cognitive externe) |
| **Module** | `src/lib/yahria/llm-fabric.ts` |
| **Endpoint** | `/api/yahria/llm` (GET statut · POST ping/order) |
| **Invariants** | INV-080, INV-212, INV-213, INV-210 |
| **Date** | 2026-09-07 |

---

## 1. Objet

Avant KRN-023, chaque appel LLM de YAHRIA (System-2 du raisonnement hybride, agents Studio, planificateur) importait directement `z-ai-web-dev-sdk`. Le fournisseur était donc un point de défaillance unique et invisible : aucune trace du modèle utilisé, aucun repli si le service tombe, aucun moyen de brancher DeepSeek ou Claude sans réécrire du code noyau.

La fabric LLM corrige cela : **tous** les appels LLM de YAHRIA passent désormais par une route unique qui déclare les fournisseurs, les essaie dans un ordre configurable, ouvre un circuit breaker quand un fournisseur déraille, et journalise la trace complète des tentatives. Brancher un nouveau fournisseur revient à renseigner des variables d'environnement — zéro ligne de noyau modifiée.

## 2. Fournisseurs supportés

| id | Type | Authentification | Modèle par défaut | Usage typique |
|---|---|---|---|---|
| `zai` | SDK intégré (`z-ai-web-dev-sdk`) | bundlé | `glm-4.6` | environnement hébergé Z.ai (défaut) |
| `deepseek` | OpenAI-compatible | `DEEPSEEK_API_KEY` | `deepseek-chat` | raisonnement coût/qualité |
| `claude` | API Anthropic native | `ANTHROPIC_API_KEY` | `claude-sonnet-4-5` | planification difficile |
| `openai` | OpenAI-compatible | `OPENAI_API_KEY` | `gpt-4o-mini` | standard industriel |
| `openrouter` | OpenAI-compatible | `OPENROUTER_API_KEY` | `openrouter/auto` | une clé → centaines de modèles |
| `ollama` | OpenAI-compatible | sans clé (local) | `llama3.1` | repli hors-ligne, confidentialité |
| `custom` | OpenAI-compatible | `YAHRIA_LLM_CUSTOM_API_KEY` + `BASE_URL` | via env | vLLM, LiteLLM, Groq, Mistral, proxy privé… |

Chaque fournisseur accepte une variable `_MODEL` et, sauf `zai`, une variable `_BASE_URL` pour pointer vers un proxy compatible.

## 3. Chaîne de repli (INV-210 : échec explicite, jamais silencieux)

`runLLMChat(req)` exécute :

1. **Sélection** : `req.preferred` (épingle un fournisseur) sinon ordre effectif = `YAHRIA_LLM_ORDER` (env) > réordonnancement runtime (POST `order`) > défaut `zai,deepseek,claude,openai,openrouter,ollama,custom`. Les fournisseurs **non configurés** sont sautés (mais apparaissent dans la trace).
2. **Essai séquentiel** : timeout par appel (`YAHRIA_LLM_TIMEOUT_MS`, défaut 90 s). Tout échec (HTTP ≠ 2xx, timeout, réponse vide, SDK indisponible) marque la tentative et passe au suivant.
3. **Succès** : renvoie `{ok: true, text, provider, model, ms, attempts}` — le consommateur sait **qui** a servi l'appel.
4. **Épuisement** : renvoie `{ok: false, attempts}` avec la trace complète. Le consommateur (S2, Studio) bascule alors sur son repli constitutionnel (plan heuristique étiqueté `HEURISTIC_FALLBACK`, incertitude relevée).

La trace `attempts` est conservée dans les résultats S2 (`modelUsed: "YAHRIA-S2-LLM via deepseek:deepseek-chat"`), les événements temps réel (`llm.fabric.probe.*`) et `SystemEvent`.

## 4. Circuit breaker (style machine à échecs F)

Par fournisseur : **3 échecs consécutifs → OPEN** pendant `YAHRIA_LLM_BREAKER_COOLDOWN_MS` (défaut 90 s), puis half-open (une sonde ; un nouvel échec referme le circuit immédiatement, un succès le réinitialise). Objectif : ne pas payer 90 s de timeout par requête quand un fournisseur est mort — le breaker le déclasse de la chaîne au lieu d'alourdir chaque appel.

## 5. Intégrations noyau

| Point d'appel | Avant | Après |
|---|---|---|
| `hybrid-reasoning.ts` — System-2 | import direct SDK Z.ai | `runLLMChat({thinking: true, messages})` ; échec → plan heuristique `HEURISTIC_FALLBACK` |
| `studio.ts` — `callLLM` (architecte/planner/coder) | import direct SDK Z.ai | `runLLMChat` ; échec → `Error("LLM fabric exhausted — trace")` (le backoff 429 existant reste au-dessus) |

Les autres consommateurs LLM futurs (débat adversarial, self-heal cognitif) DOIVENT passer par `runLLMChat` — c'est le sens d'INV-212.

## 6. API

**GET `/api/yahria/llm`** — statut hors-réseau (aucun appel sortant) :

```json
{
  "ok": true,
  "order": ["zai", "deepseek", "claude"],
  "providers": [{
    "id": "deepseek", "kind": "openai-compatible", "configured": true,
    "apiKeyMask": "sk-1a…f4", "model": "deepseek-chat",
    "breaker": "CLOSED", "okCount": 12, "failCount": 0, "avgMs": 1430,
    "lastAttempt": {"ok": true, "ms": 1390, "at": "…"}
  }],
  "summary": {"configured": 2, "total": 7, "openBreakers": []}
}
```

**POST `{"action":"ping","provider":"deepseek"}`** — sonde de connectivité réelle (prompt minimal `YAHRIA-LINK-OK`, 20 s). Sans `provider` : sonde toute la chaîne. Journalisé (`SystemEvent` source `08` + temps réel).

**POST `{"action":"order","order":["deepseek","zai"]}`** — réordonnancement runtime (en mémoire, jusqu'au redémarrage ; l'env reste l'autorité). 422 si vide/invalide.

## 7. Sécurité (INV-213)

- Les clés ne quittent **jamais** le serveur : lecture env côté noyau uniquement.
- Toute télémétrie (API, UI, événements) n'expose que `maskKey()` (4 premiers + 2 derniers caractères).
- L'UI affiche l'état, la latence et le modèle — jamais la clé.
- Ollama sans clé est un cas légitime (réseau local) ; `custom` exige une clé sauf si le réseau est censuré par un proxy.

## 8. Frontières honnêtes

- Le réordonnancement runtime n'est **pas persisté** (redémarrage → `YAHRIA_LLM_ORDER`). La persistance demanderait soit Prisma (table de config) soit un fichier — volontairement évité ici pour garder la fabric sans état.
- Le `thinking` (mode raisonnement) n'est transmis qu'au SDK Z.ai ; les adaptateurs REST l'ignorent (DeepSeek `deepseek-reasoner` et les extended thinking Anthropic demanderaient un mapping dédié — extension naturelle V1.1).
- Le circuit breaker et la télémétrie sont **en mémoire** : redémarrer le process les remet à zéro (cohérent avec le reste du noyau de supervision).
- Aucune sélection de modèle par tâche (coût vs qualité) : un seul ordre s'applique à tous les consommateurs. V1.1 envisageable : `preferred` par agent.
- Les clés restent dans `.env` ; un KMS/vault est hors périmètre (cf. INV-132, clé d'attestation dev assumée).
