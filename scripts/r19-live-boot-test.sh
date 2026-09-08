#!/usr/bin/env bash
# Test de boot réel de l'app corrigée RUN-000019 : mongod réel + node index.js + curl endpoint par endpoint
set -u
APP=/home/z/my-project/upload/RUN-000019-extract
MONGOD=/home/z/.yahria-mongod/mongod
DBPATH=/tmp/yahria-r19-mongod
PORT=3901
LOG=/tmp/r19-live
PASS=0; FAIL=0
mkdir -p "$DBPATH" "$LOG"

say()  { echo -e "$*"; }
check(){ local name="$1" expected="$2" actual="$3"; if [ "$expected" = "$actual" ]; then PASS=$((PASS+1)); say "  ✓ $name (HTTP $actual)"; else FAIL=$((FAIL+1)); say "  ✗ $name — attendu $expected, obtenu $actual"; fi }

say "== 1. Démarrage mongod 7.0.14 =="
"$MONGOD" --dbpath "$DBPATH" --port 3911 --bind_ip 127.0.0.1 --fork --logpath "$LOG/mongod.log" || { echo "mongod FAIL"; exit 1; }
sleep 1

say "== 2. Environnement + boot node index.js =="
cat > "$APP/.env" <<EOF
PORT=$PORT
MONGODB_URI=mongodb://127.0.0.1:3911/gestion_hotel
JWT_SECRET=secret-de-test-yahria-r19
JWT_EXPIRES_IN=1h
NODE_ENV=development
EOF
cd "$APP"
node index.js > "$LOG/app.log" 2>&1 &
APP_PID=$!
for i in $(seq 1 120); do curl -sf "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1 && break; sleep 1; done
say "-- boot log --"; head -3 "$LOG/app.log"

BASE="http://127.0.0.1:$PORT"
say "== 3. Health =="
check "GET /api/health" 200 "$(curl -s -o /dev/null -w '%{http_code}' $BASE/api/health)"

say "== 4. Auth =="
check "register 201" 201 "$(curl -s -o /tmp/r19-reg.json -w '%{http_code}' -X POST $BASE/api/auth/register -H 'Content-Type: application/json' -d '{"name":"Receptionniste Live","email":"live@yahria.local","password":"Password123!"}')"
check "register doublon 400" 400 "$(curl -s -o /dev/null -w '%{http_code}' -X POST $BASE/api/auth/register -H 'Content-Type: application/json' -d '{"name":"X","email":"live@yahria.local","password":"Password123!"}')"
check "login 200" 200 "$(curl -s -o /tmp/r19-login.json -w '%{http_code}' -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -d '{"email":"live@yahria.local","password":"Password123!"}')"
check "login mauvais mdp 401" 401 "$(curl -s -o /dev/null -w '%{http_code}' -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -d '{"email":"live@yahria.local","password":"MAUVAIS"}')"
TOKEN=$(python3 -c "import json;print(json.load(open('/tmp/r19-login.json'))['token'])")
check "GET /me 200" 200 "$(curl -s -o /dev/null -w '%{http_code}' $BASE/api/auth/me -H "Authorization: Bearer $TOKEN")"

say "== 5. Clients (protégé) =="
check "GET clients sans token 401" 401 "$(curl -s -o /dev/null -w '%{http_code}' $BASE/api/clients)"
check "POST client 201" 201 "$(curl -s -o /tmp/r19-c1.json -w '%{http_code}' -X POST $BASE/api/clients -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"prenom":"Jean","nom":"Dupont","email":"jean.dupont@example.com","telephone":"0123456789","adresse":"123 Rue de la Paix","ville":"Paris","codePostal":"75001","pays":"France"}')"
CID=$(python3 -c "import json;print(json.load(open('/tmp/r19-c1.json'))['data']['_id'])")
check "POST client email dupliqué 400" 400 "$(curl -s -o /dev/null -w '%{http_code}' -X POST $BASE/api/clients -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"prenom":"Jean","nom":"Duplicata","email":"jean.dupont@example.com","telephone":"0123456789","adresse":"1 Rue","ville":"Paris","codePostal":"75001"}')"
check "POST client invalide 400" 400 "$(curl -s -o /dev/null -w '%{http_code}' -X POST $BASE/api/clients -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"prenom":"Jean"}')"
check "GET clients 200" 200 "$(curl -s -o /dev/null -w '%{http_code}' $BASE/api/clients -H "Authorization: Bearer $TOKEN")"
check "GET /search 200" 200 "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/clients/search?query=Dupont" -H "Authorization: Bearer $TOKEN")"
check "GET client by id 200" 200 "$(curl -s -o /dev/null -w '%{http_code}' $BASE/api/clients/$CID -H "Authorization: Bearer $TOKEN")"
check "PUT téléphone seul 200" 200 "$(curl -s -o /dev/null -w '%{http_code}' -X PUT $BASE/api/clients/$CID -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"telephone":"0987654321"}')"
check "PUT email invalide 400" 400 "$(curl -s -o /dev/null -w '%{http_code}' -X PUT $BASE/api/clients/$CID -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"email":"pas-un-email"}')"
check "GET client 404" 404 "$(curl -s -o /dev/null -w '%{http_code}' $BASE/api/clients/507f1f77bcf86cd799439011 -H "Authorization: Bearer $TOKEN")"

say "== 6. Réservations =="
FUTURE=$(date -d "+7 days" +%Y-%m-%d 2>/dev/null || date -v+7d +%Y-%m-%d)
check "POST réservation 201" 201 "$(curl -s -o /tmp/r19-r1.json -w '%{http_code}' -X POST $BASE/api/reservations -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "{\"clientId\":\"$CID\",\"dateService\":\"$FUTURE\",\"statut\":\"confirmed\",\"nombrePersonnes\":2}")"
RID=$(python3 -c "import json;print(json.load(open('/tmp/r19-r1.json'))['data']['_id'])")
check "POST résa date passée 400" 400 "$(curl -s -o /dev/null -w '%{http_code}' -X POST $BASE/api/reservations -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "{\"clientId\":\"$CID\",\"dateService\":\"2020-01-01\",\"nombrePersonnes\":2}")"
check "GET résa public 200" 200 "$(curl -s -o /dev/null -w '%{http_code}' $BASE/api/reservations)"
check "PATCH statut 200" 200 "$(curl -s -o /dev/null -w '%{http_code}' -X PATCH $BASE/api/reservations/$RID -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"statut":"cancelled"}')"
check "PATCH statut inconnu 400" 400 "$(curl -s -o /dev/null -w '%{http_code}' -X PATCH $BASE/api/reservations/$RID -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"statut":"urgent"}')"
check "DELETE résa 200" 200 "$(curl -s -o /dev/null -w '%{http_code}' -X DELETE $BASE/api/reservations/$RID -H "Authorization: Bearer $TOKEN")"

say "== 7. Divers =="
check "route inconnue 404" 404 "$(curl -s -o /dev/null -w '%{http_code}' $BASE/api/inexistant)"
check "DELETE client 200" 200 "$(curl -s -o /dev/null -w '%{http_code}' -X DELETE $BASE/api/clients/$CID -H "Authorization: Bearer $TOKEN")"

say "== 8. Arrêt gracieux (SIGTERM) =="
kill -TERM $APP_PID; sleep 2
if kill -0 $APP_PID 2>/dev/null; then say "  ✗ process toujours vivant"; FAIL=$((FAIL+1)); else say "  ✓ arrêt propre"; PASS=$((PASS+1)); fi
tail -2 "$LOG/app.log"

"$MONGOD" --dbpath "$DBPATH" --shutdown >/dev/null 2>&1
say ""
say "===================================="
say "RÉSULTAT LIVE : $PASS verts / $FAIL échecs"
exit $([ $FAIL -eq 0 ] && echo 0 || echo 1)
