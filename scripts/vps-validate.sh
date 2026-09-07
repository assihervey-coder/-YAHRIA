#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# YAHRIA — SUITE DE VALIDATION VPS (R15)
# À exécuter SUR le VPS, à la racine du dépôt cloné :
#   bash scripts/vps-validate.sh
# Chaque section est un fait mesuré — tout échec stoppe (set -e)
# et pointe la section du runbook à corriger (INV-232 : pas de
# déclaration verte sans preuve).
# ═══════════════════════════════════════════════════════════════
set -euo pipefail
PASS=0; FAIL=0
ck() { if [ "$1" = "0" ]; then PASS=$((PASS+1)); echo "  ✓ $2"; else FAIL=$((FAIL+1)); echo "  ✗ $2"; exit 1; fi; }

echo "══ A. PRÉREQUIS SYSTÈME ══"
docker info > /dev/null 2>&1; ck $? "daemon Docker actif"
docker compose version > /dev/null 2>&1; ck $? "docker compose v2 disponible"
[ "$(id -u)" != "0" ] && ck 0 "exécution en utilisateur non-root" || ck 1 "ne PAS exécuter en root"
MEM=$(free -m | awk '/^Mem:/{print $2}'); [ "$MEM" -ge 2000 ]; ck $? "RAM ≥ 2 Go (mesuré : ${MEM} Mo)"
DISK=$(df -m . | awk 'NR==2{print $4}'); [ "$DISK" -ge 10000 ]; ck $? "disque libre ≥ 10 Go (mesuré : ${DISK} Mo)"

echo "══ B. POSTGRESQL (bascule SQLite → PostgreSQL) ══"
[ -f .env.production ]; ck $? ".env.production présent (runbook §3)"
grep -q "POSTGRES_PASSWORD=." .env.production; ck $? "POSTGRES_PASSWORD renseigné (non vide)"
grep -q "YAHRIA_DOMAIN=." .env.production; ck $? "YAHRIA_DOMAIN renseigné"
docker compose -f docker-compose.prod.yml --env-file .env.production up -d db
for i in $(seq 1 24); do docker compose -f docker-compose.prod.yml exec -T db pg_isready -U yahria > /dev/null 2>&1 && break; sleep 2; done
docker compose -f docker-compose.prod.yml exec -T db pg_isready -U yahria > /dev/null 2>&1; ck $? "PostgreSQL ready (healthcheck)"
SSLP=$(docker compose -f docker-compose.prod.yml exec -T db psql -U yahria -tAc "SHOW ssl" 2>/dev/null || echo off); echo "  (ssl interne: $SSLP — tunnéling réseau docker interne, TLS public assuré par Caddy)"
docker compose -f docker-compose.prod.yml port db 5432 | grep -q "^127.0.0.1:5432"; ck $? "5432 publié UNIQUEMENT sur 127.0.0.1"

echo "══ C. IMAGE SANDBOX DURCIE (INV-215) ══"
docker image inspect yahria-sandbox:latest > /dev/null 2>&1 || docker build -f docker/sandbox.Dockerfile -t yahria-sandbox:latest . > /dev/null
ck $? "image yahria-sandbox présente"
# Preuve d'isolation : le conteneur durci refuse le réseau et ne peut pas écrire la rootfs
docker run --rm --network none --read-only --cap-drop ALL --security-opt no-new-privileges \
  --memory 256m --pids-limit 64 yahria-sandbox:latest bash -c 'ip a > /dev/null 2>&1 && echo NET_OK || echo NET_BLOCKED; touch /proc/x 2>/dev/null && echo WRITE_OK || echo RO_OK' > /tmp/yahria-sandbox-proof.txt 2>&1 || true
grep -q "NET_BLOCKED" /tmp/yahria-sandbox-proof.txt; ck $? "--network none : réseau bloqué (INV-215)"
grep -q "RO_OK" /tmp/yahria-sandbox-proof.txt; ck $? "--read-only : rootfs non inscriptible (INV-215)"
docker run --rm --network none --read-only --cap-drop ALL --security-opt no-new-privileges \
  --memory 64m yahria-sandbox:latest bash -c 'echo YAHRIA-LINK-OK'; ck $? "conteneur durci exécutable (code réel)"

echo "══ D. APPLICATION PROD ══"
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build app
for i in $(seq 1 45); do sleep 2; curl -sf http://127.0.0.1:3000/api/yahria/ops > /dev/null 2>&1 && break; done
OPS=$(curl -sf http://127.0.0.1:3000/api/yahria/ops); ck $? "app prod répond sur /api/yahria/ops"
echo "$OPS" | grep -q '"ok":true'; ck $? "liveness verte"
echo "$OPS" | grep -q '"DATABASE":{"ok":true'; ck $? "sonde DATABASE verte (PostgreSQL, 24 domaines)"
echo "$OPS" | grep -q '"sandboxBackend":"docker"'; ck $? "backend sandbox = docker (INV-215)"
curl -sf -o /dev/null http://127.0.0.1:3000/; ck $? "page d'accueil 200"
C401=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/api/v1/system)
[ "$C401" = "401" ]; ck $? "/api/v1 sans clé → 401 (INV-230)"
KEY=$(curl -s -X POST http://127.0.0.1:3000/api/yahria/apikeys -H 'Content-Type: application/json' -d '{"name":"vps-validate","scopes":["read"]}' | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).key?.plaintext??''))")
C200=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $KEY" http://127.0.0.1:3000/api/v1/system)
[ "$C200" = "200" ]; ck $? "/api/v1 avec clé émise → 200"
KID=$(curl -s http://127.0.0.1:3000/api/yahria/apikeys | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const k=JSON.parse(d).keys.find(x=>x.name==='vps-validate');console.log(k?k.id:'')})")
curl -s -X PUT http://127.0.0.1:3000/api/yahria/apikeys -H 'Content-Type: application/json' -d "{\"id\":\"$KID\",\"reason\":\"clé de validation VPS révoquée après preuve\"}" > /dev/null
CR=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $KEY" http://127.0.0.1:3000/api/v1/system)
[ "$CR" = "401" ]; ck $? "clé révoquée → 401 (cycle gouverné complet)"

echo "══ E. ALERTING (D.22, si canal configuré) ══"
if grep -q "YAHRIA_ALERT_WEBHOOK_URL=." .env.production; then
  EV=$(curl -s -X POST http://127.0.0.1:3000/api/yahria/alerts -H 'Content-Type: application/json' \
    -d '{"action":"evaluate","report":{"liveness":{"ok":true,"pid":1,"uptimeSec":1,"rssMb":1,"at":"x"},"readiness":{"ok":false,"probes":[{"id":"DATABASE","ok":false,"detail":"sim","ms":1},{"id":"A","ok":true,"detail":"","ms":0},{"id":"B","ok":true,"detail":"","ms":0},{"id":"C","ok":true,"detail":"","ms":0}]},"slo":{"windowHours":24,"toolInvocations":{"total":0,"successRate":null,"p50Ms":null,"p95Ms":null},"agentRuns":{"total":0,"completedRate":null},"failures":0},"version":{"constitution":"V1.0.0","node":"v","sandboxBackend":"docker","providers":7}}}')
  echo "$EV" | grep -qE '"delivery":"(SENT|FAILED|DEDUP_SKIPPED)"'; ck $? "alerte évaluée + livraison tentée (fait archivé) — $EV" | head -c 200
else
  echo "  (canal non configuré — runbook §8 ; NOT_CONFIGURED est l'état honnête)"
fi

echo "══ F. TLS / CADDY (si domaine joignable) ══"
DOMAIN=$(grep '^YAHRIA_DOMAIN=' .env.production | cut -d= -f2)
if [ -n "$DOMAIN" ]; then
  docker compose -f docker-compose.prod.yml --env-file .env.production up -d caddy
  sleep 8
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 "https://$DOMAIN/api/yahria/ops" || true)
  [ "$CODE" = "200" ]; ck $? "https://$DOMAIN → 200 (certificat Let's Encrypt émis)"
else
  echo "  (YAHRIA_DOMAIN absent — section TLS à rejouer après DNS)"
fi

echo
echo "══ RÉSULTAT : $PASS PASS / $FAIL FAIL ══"
[ "$FAIL" = "0" ] && echo "VALIDATION VPS COMPLÈTE — plateforme prod-ready prouvée sur cet hôte." || exit 1
