#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# R19 — VOIE 2 : mission de correction RUN-000019 soumise à YAHRIA OS
#   Preuve de la boucle autonome sur un cas réel :
#   create (DECOMPOSED) → schedule → ticks → COMPLETED + trace
# ═══════════════════════════════════════════════════════════════
set -u
BASE="http://localhost:3000"
J() { node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);console.log(eval('j'+(process.argv[1]||'')))}catch(e){console.log('')}})" "$1"; }

echo "── 0. santé serveur ──"
curl -s -o /dev/null -w "HTTP %{http_code}\n" "$BASE/api/health" || { echo "serveur absent"; exit 1; }

echo "── 1. création mission « Corrige RUN-000019 » (stratégie DECOMPOSED) ──"
GOAL="Corriger le livrable RUN-000019 (gestion hotel Express/MongoDB) : harmoniser les variables d'environnement (MONGO_URI vs MONGODB_URI), ajouter la route POST /api/auth/login manquante, remplacer le SQL PostgreSQL de middleware/auth.js par du Mongoose, corriger le double demarrage server.js/index.js, harmoniser le nommage des champs entre validateurs et modeles, declarer la dependance validator"
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
(m.tasks||[]).forEach(t=>console.log('  task seq'+t.seq,'|',t.title,'| agent',t.agentKey,'| outil',t.toolId,'|',t.state,t.result?('→ '+(t.result||'').slice(0,80)):''))})"
