#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# R21 — VOIE 2 : mission de correction RUN-000021 soumise à YAHRIA OS
#   create (DECOMPOSED) → schedule → ticks → COMPLETED + trace
# ═══════════════════════════════════════════════════════════════
set -u
BASE="http://localhost:3000"
J() { node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);console.log(eval('j'+(process.argv[1]||'')))}catch(e){console.log('')}})" "$1"; }

echo "── 0. santé serveur ──"
curl -s -o /dev/null -w "HTTP %{http_code}\n" "$BASE/api/health" || { echo "serveur absent"; exit 1; }

echo "── 1. création mission « Corrige RUN-000021 » (stratégie DECOMPOSED) ──"
GOAL="Corriger le livrable RUN-000021 (ERP hotelier 8 modules + Hub API 8.3 Mobile Money NotchPay/Pesapal) : 12 fichiers tronques (routes FastAPI et chaines coupees), symboles hallucines (CountryConfig, PaymentProviderConfig, MobileMoneyFactory, PaymentProviderFactory, validate_api_key, check_permission), imports illegaux from ... en package plat, nom reserve SQLAlchemy metadata, passlib incompatible bcrypt 4+, Pydantic v1 sur v2, absence totale de package, d entry point, de tests et du noeud 8.5 (sandbox, commutation cles, deploiement progressif). Livrable corrige : application FastAPI assemblee avec gateways/ + payment_processor/ + webhooks/, 56 routes, 36 tests pytest, 18 verifications curl live."
CREATE=$(curl -s -X POST "$BASE/api/yahria/missions" -H 'Content-Type: application/json' \
  -d "{\"action\":\"create\",\"goal\":\"$GOAL\",\"strategy\":\"DECOMPOSED\"}")
MUID=$(echo "$CREATE" | J ".mission.missionUid")
STATE=$(echo "$CREATE" | J ".mission.state")
echo "missionUid = $MUID | état initial = $STATE"
[ -z "$MUID" ] && { echo "ECHEC création mission"; echo "$CREATE" | head -c 500; exit 1; }

echo "── 2. Programmer (PLANNED → SCHEDULED) ──"
SCHED=$(curl -s -X POST "$BASE/api/yahria/missions" -H 'Content-Type: application/json' \
  -d "{\"action\":\"schedule\",\"uid\":\"$MUID\"}")
echo "$SCHED" | J ".mission.state" | sed 's/^/état après schedule = /'

echo "── 3. Ticks successifs jusqu'à clôture (max 6, INV-091) ──"
for i in 1 2 3 4 5 6; do
  R=$(curl -s -X POST "$BASE/api/yahria/missions" -H 'Content-Type: application/json' \
    -d "{\"action\":\"tick\",\"uid\":\"$MUID\"}")
  ST=$(echo "$R" | J ".report.state")
  echo "tick $i → état mission : $ST"
  [ "$ST" = "COMPLETED" ] || [ "$ST" = "FAILED" ] || [ "$ST" = "CANCELLED" ] && break
done

echo "── 4. Graphe final + timeline ──"
curl -s "$BASE/api/yahria/missions?uid=$MUID" | node -e "
let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);const m=j.mission;
console.log('mission',m.missionUid,'| état',m.state,'| stratégie',m.strategy,'| trace',m.traceId);
(j.tasks||[]).forEach(t=>console.log('  tâche',t.seq||t.position||'-',t.kind||t.title,'→',t.state));
(j.timeline||[]).slice(-6).forEach(ev=>console.log('  ·',ev.at||ev.createdAt,'|',ev.kind||ev.type,'|',String(ev.message||ev.detail||'').slice(0,90)));
});"
echo
echo "missionUid final : $MUID"
