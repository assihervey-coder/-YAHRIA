#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# PTA-001 — PHASES 4-6 : TEST DÉCISIF RUN-000022
# Génère un run Studio SOUS la porte de boot armée (EVO-000016 PROMOTED),
# mesure le premier boot, vérifie indépendamment le ZIP, produit le verdict.
#
# Usage :
#   ./pta-run22.sh           → exécute le test décisif complet (10 min max)
#   ./pta-run22.sh check     → état seulement (porte + registre)
#
# Verdict (critères du protocole, mesurés — jamais déclarés) :
#   L-PROVEN     = run SEALED au 1er passage + porte interne PASS + porte
#                  indépendante PASS sur le ZIP (0 correction humaine)
#   L-NOT-PROVEN = tout autre issue — l'échec est mesuré, scellé, honest (INV-210)
# ═══════════════════════════════════════════════════════════════════
set -u
cd "$(dirname "$0")/.."
BASE="http://localhost:3000"
EV="scripts/pta-evidence"; mkdir -p "$EV"

J() { node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);console.log(eval('j'+(process.argv[1]||'')))}catch(e){console.log('')}})" "$1"; }

# ── 0. Armement : la porte DOIT être active (sinon le test est invalide) ──
ARMED=$(curl -s -m 10 "$BASE/api/yahria/evolution" | python3 -c "
import json,sys
d=json.load(sys.stdin)
p=[x for x in d['proposals'] if x['proposalUid']=='EVO-000016']
print('ARMED' if p and p[0]['state']=='PROMOTED' else 'NOT_ARMED')")
if [ "${1:-}" = "check" ]; then echo "porte EVO-000016 : $ARMED"; exit 0; fi
if [ "$ARMED" != "ARMED" ]; then
  echo "✗ TEST INVALIDE : EVO-000016 n'est pas PROMOTED ($ARMED)."
  echo "  La porte n'est pas armée — exécutez d'abord : ./pta-evo16-approve.sh go (décision HUMAN:reviewer, INV-227)."
  exit 1
fi
echo "✓ Porte de boot ARMÉE (EVO-000016 PROMOTED) — la décision humaine est l'interrupteur."

# ── 1. Création RUN-000022 (Studio, PYTHON imposé, brief porteur des leçons) ──
read -r -d '' TREE <<'EOF' || true
main.py
config.py
models.py
schemas.py
security.py
gateways/__init__.py
gateways/base.py
gateways/notchpay.py
gateways/pesapal.py
webhooks.py
tests/__init__.py
tests/test_api.py
requirements.txt
README.md
EOF

read -r -d '' BRIEF <<'EOF' || true
API Hub de paiement Mobile Money (FastAPI) unifiant deux passerelles : NotchPay et PesaPal.
- main.py : instance FastAPI nommée exactement « app » (app = FastAPI(title="Mobile Money Hub")) ; AUCUN serveur embarqué au niveau module (pas d'appel uvicorn.run hors d'un bloc if __name__ == "__main__").
- Endpoints minimum : GET /health (200), GET /gateways (liste des passerelles configurées), POST /payments/initiate (choisit la passerelle via une factory selon l'opérateur), POST /webhooks/{gateway} (vérifie la signature HMAC-SHA256 avec hmac.compare_digest — comparaison à temps constant).
- Gateways : gateways/base.py définit une classe abstraite PaymentGateway ; gateways/notchpay.py et gateways/pesapal.py l'implémentent en mode SANDBOX déterministe (aucun appel réseau réel) ; une factory simple choisit la passerelle.
- Stockage en mémoire (dict) — AUCUNE base de données, AUCUN ORM.
- config.py : lecture d'options par variables d'environnement avec VALEURS PAR DÉFAUT pour tout (aucune variable obligatoire, l'app doit démarrer sans .env).
- security.py : création/vérification de token signé HMAC (stdlib hashlib/hmac uniquement).
- tests/test_api.py : pytest avec fastapi.testclient.TestClient — au moins 5 tests (health, gateways, initiate, webhook signature valide acceptée, signature invalide rejetée 401/400).
- requirements.txt : fastapi, uvicorn, pydantic, pytest, httpx (versions souples).
- README.md : démarrage (python -m uvicorn main:app --reload), endpoints, variables d'environnement optionnelles.
- Contraintes de structure : tous les dossiers sont des identifiants Python valides (gateways, tests), tous les fichiers Python portent l'extension .py, aucun fichier de code sans extension.
EOF

echo "── 1/4 Création du run Studio (PYTHON imposé, arborescence explicite) ──"
TREE="$TREE" BRIEF="$BRIEF" python3 - > "$EV/run22-payload.json" <<'PYPAYLOAD'
import json, os
print(json.dumps({
    "name": "PTA-001 — Hub Mobile Money — test d'apprentissage boot premier coup",
    "brief": os.environ["BRIEF"],
    "treeSpec": os.environ["TREE"],
    "requestedStack": "PYTHON",
    "aiDesignedTree": False,
}, ensure_ascii=False))
PYPAYLOAD

CREATE=$(curl -s -m 30 -X POST "$BASE/api/yahria/studio/runs" -H 'Content-Type: application/json' \
  --data-binary @"$EV/run22-payload.json")
RUN_ID=$(echo "$CREATE" | J ".run.id")
RUN_UID=$(echo "$CREATE" | J ".run.runUid")
echo "runUid = $RUN_UID | id = $RUN_ID | état initial = $(echo "$CREATE" | J '.run.state')"
[ -z "$RUN_ID" ] && { echo "✗ ÉCHEC création run : $(echo "$CREATE" | head -c 400)"; exit 1; }

# ── 2. Poll jusqu'à SEALED / FAILED (max 12 min) ─────────────────────────
echo "── 2/4 Pipeline YAHRIA (S1 → S2 → génération → vérification → porte → scellement) ──"
STATE=""; ERR=""
for i in $(seq 1 72); do
  sleep 10
  R=$(curl -s -m 15 "$BASE/api/yahria/studio/runs/$RUN_ID")
  STATE=$(echo "$R" | J ".run.state")
  ERR=$(echo "$R" | J ".run.error")
  echo "  t+$((i*10))s → $STATE"
  [ "$STATE" = "SEALED" ] || [ "$STATE" = "FAILED" ] || [ "$STATE" = "CANCELLED" ] && break
done

# ── 3. Mesure ─────────────────────────────────────────────────────────────
echo "── 3/4 Mesure du verdict ──"
BG=$(curl -s -m 15 "$BASE/api/yahria/studio/runs/$RUN_ID" | J ".run.stats" | python3 -c "
import json,sys
try:
    s=json.loads(json.loads(sys.stdin.read()) or '{}')
    print(json.dumps(s.get('bootGate') or {}))
except Exception: print('{}')")
echo "porte interne (pipeline) : $BG"

INDEP="N/A"
if [ "$STATE" = "SEALED" ]; then
  curl -s -m 30 "$BASE/api/yahria/studio/runs/$RUN_ID/download" -o "$EV/$RUN_UID.zip"
  echo "ZIP scellé téléchargé : $EV/$RUN_UID.zip"
  python3 scripts/pta-boot-gate.py "$EV/$RUN_UID.zip" --label "$RUN_UID (ZIP scellé, vérification indépendante)" \
    --json "$EV/run22-independent-gate.json" && INDEP="PASS" || INDEP="FAIL"
fi

# ── 4. Verdict PTA-001 ────────────────────────────────────────────────────
echo "── 4/4 VERDICT ──"
python3 - "$STATE" "$BG" "$INDEP" "$RUN_UID" <<'PYEOF'
import json, sys
state, bg_raw, indep, run_uid = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
try: bg = json.loads(bg_raw)
except Exception: bg = {}
internal = bool(bg.get("passed"))
print(f"run          : {run_uid} — état final {state}")
print(f"porte interne: {'PASS' if internal else ('FAIL' if bg else 'NON EXÉCUTÉE (run échoué avant la porte)')}")
print(f"porte indep. : {indep}")
if state == "SEALED" and internal and indep == "PASS":
    verdict = "L-PROVEN"
    print()
    print(f"VERDICT : {verdict} — l'apprentissage est PROUVÉ, pas déclaré.")
    print("  Le run a démarré au PREMIER coup sous porte armée, sans correction humaine.")
else:
    verdict = "L-NOT-PROVEN"
    print()
    print(f"VERDICT : {verdict} — l'apprentissage n'est PAS encore prouvé (mesuré, pas caché).")
    print("  L'échec est scellé comme preuve : nouvelle itération du cycle d'évolution (D.15).")
open("scripts/pta-evidence/run22-verdict.json", "w").write(json.dumps({
    "protocol": "PTA-001", "runUid": run_uid, "finalState": state,
    "internalGate": bg, "independentGate": indep, "verdict": verdict,
}, ensure_ascii=False, indent=2))
print("preuve : scripts/pta-evidence/run22-verdict.json")
PYEOF

# ── Trace gouvernée : mission MIS (boucle autonome D.07) ──────────────────
GOAL="PTA-001 test d'apprentissage : RUN-000022 Hub Mobile Money généré sous porte de boot EVO-000016 armée, prévalidation avant SEALED, vérification indépendante du ZIP, verdict L-PROVEN ou L-NOT-PROVEN archivé dans scripts/pta-evidence/"
MCREATE=$(curl -s -m 30 -X POST "$BASE/api/yahria/missions" -H 'Content-Type: application/json' \
  -d "{\"action\":\"create\",\"goal\":\"$GOAL\",\"strategy\":\"DECOMPOSED\"}")
MUID=$(echo "$MCREATE" | J ".mission.missionUid")
if [ -n "$MUID" ]; then
  curl -s -m 30 -X POST "$BASE/api/yahria/missions" -H 'Content-Type: application/json' -d "{\"action\":\"schedule\",\"uid\":\"$MUID\"}" > /dev/null
  for i in 1 2 3 4; do
    ST=$(curl -s -m 60 -X POST "$BASE/api/yahria/missions" -H 'Content-Type: application/json' -d "{\"action\":\"tick\",\"uid\":\"$MUID\"}" | J ".report.state")
    [ "$ST" = "COMPLETED" ] || [ "$ST" = "FAILED" ] && break
  done
  echo "trace gouvernée : mission $MUID → $ST"
fi
