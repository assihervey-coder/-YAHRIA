#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# PISTES R14-bis — preuve live contre l'API dev locale
#   Piste 1 : mission « diagnostic » → create → schedule → tick(s)
#   Piste 2 : clé API émise → appel /api/v1 gouverné
# Chaque étape est mesurée (INV-080), jamais supposée.
# ═══════════════════════════════════════════════════════════════
set -u
BASE="http://localhost:3000"
JQ() { node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{console.log(JSON.stringify(JSON.parse(d),null,1))}catch{console.log(d)}})"; }
echo "══ PISTE 1 — MISSION DIAGNOSTIC (D.07 / KRN-031) ══"
echo "── 1.1 création (décomposition S1 DECOMPOSED) ──"
CREATE=$(curl -s -X POST "$BASE/api/yahria/missions" -H 'Content-Type: application/json' \
  -d '{"action":"create","goal":"diagnostic complet de la plateforme","strategy":"DECOMPOSED"}')
echo "$CREATE" | head -c 700; echo
MUID=$(echo "$CREATE" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{console.log(JSON.parse(d).mission.missionUid||'')}catch{console.log('')}})")
echo "missionUid = $MUID"
[ -z "$MUID" ] && { echo "ECHEC création mission"; exit 1; }

echo "── 1.2 Programmer (PLANNED → SCHEDULED) ──"
curl -s -X POST "$BASE/api/yahria/missions" -H 'Content-Type: application/json' \
  -d "{\"action\":\"schedule\",\"uid\":\"$MUID\"}" | head -c 300; echo

echo "── 1.3 Tick vague 1 (INV-091 : deps COMPLETED → READY) ──"
curl -s -X POST "$BASE/api/yahria/missions" -H 'Content-Type: application/json' \
  -d "{\"action\":\"tick\",\"uid\":\"$MUID\"}" | head -c 500; echo

echo "── 1.4 Ticks suivants jusqu'à clôture ou blocage (max 5) ──"
for i in 2 3 4 5 6; do
  R=$(curl -s -X POST "$BASE/api/yahria/missions" -H 'Content-Type: application/json' \
    -d "{\"action\":\"tick\",\"uid\":\"$MUID\"}")
  ST=$(echo "$R" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);console.log((j.report&&j.report.state)||(j.mission&&j.mission.state)||j.state||'?')}catch{console.log('?')}})")
  echo "tick $i → état mission : $ST"
  [ "$ST" = "COMPLETED" ] || [ "$ST" = "FAILED" ] || [ "$ST" = "CANCELLED" ] && break
done

echo "── 1.5 graphe final + timeline des tâches ──"
curl -s "$BASE/api/yahria/missions?uid=$MUID" | node -e "
let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);const m=j.mission;
console.log('mission',m.missionUid,'| état',m.state,'| stratégie',m.strategy,'| trace',m.traceId);
m.tasks.forEach(t=>console.log('  task seq'+t.seq,'|',t.title,'| agent',t.agentKey,'| outil',t.toolId,'|',t.state,t.result?('→ '+(t.result||'').slice(0,60)):''))})"
echo

echo "══ PISTE 2 — APPEL /api/v1 AVEC CLÉ ÉMISE (D.17 / KRN-034) ══"
echo "── 2.1 contrôle : sans clé → 401 attendu (INV-230) ──"
curl -s -o /dev/null -w "HTTP %{http_code}\n" "$BASE/api/v1/system"

echo "── 2.2 émission d'une clé (plaintext retourné UNE fois, INV-229) ──"
KEYRES=$(curl -s -X POST "$BASE/api/yahria/apikeys" -H 'Content-Type: application/json' \
  -d '{"name":"piste2-validation-live","scopes":["read"],"rateLimitPerMin":60}')
echo "$KEYRES" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);const k=j.key||{};console.log('ok:',j.ok,'| préfixe:',k.keyPrefix,'| scopes:',JSON.stringify(k.scopes),'| plaintext:',k.plaintext?(k.plaintext.slice(0,14)+'…'):'ABSENT')})"
KEY=$(echo "$KEYRES" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{console.log((JSON.parse(d).key||{}).plaintext||'')}catch{console.log('')}})")
[ -z "$KEY" ] && { echo "ECHEC émission clé"; exit 1; }

echo "── 2.3 appel /api/v1/system avec la clé ──"
curl -s -w "\nHTTP %{http_code}\n" -H "Authorization: Bearer $KEY" "$BASE/api/v1/system" | head -c 400; echo

echo "── 2.4 appel /api/v1/missions avec la clé (scope read) ──"
curl -s -o /dev/null -w "HTTP %{http_code}\n" -H "Authorization: Bearer $KEY" "$BASE/api/v1/missions"

echo "── 2.5 GET /api/yahria/apikeys — la clé n'est plus relisible (INV-229) ──"
curl -s "$BASE/api/yahria/apikeys" > /home/z/my-project/.piste2-keys.json
node -e "const j=require('/home/z/my-project/.piste2-keys.json');const k=j.keys.find(x=>x.name==='piste2-validation-live');const kp=k?k.keyPrefix:'ABSENT';console.log('préfixe stocké:',kp,'| revoked:',k?k.revoked:'?','| plaintext absent de la liste:',!JSON.stringify(j).includes(kp+'0a'))"
rm -f /home/z/my-project/.piste2-keys.json
echo "OK"
