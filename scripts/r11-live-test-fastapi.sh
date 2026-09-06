#!/bin/bash
# Test E2E R11 — preuve live sandbox sur une mission FastAPI réelle
set -e
BASE=http://localhost:3000/api/yahria

echo "══ 1. Soumission de la mission FastAPI (app/main.py) ══"
RUN=$(curl -s -X POST $BASE/studio/runs -H 'Content-Type: application/json' -d '{
  "name": "API météo FastAPI (test live R11)",
  "brief": "API REST FastAPI de prévisions météo : endpoint /health, endpoint /forecast retournant 7 jours de prévisions en JSON, validation Pydantic, documentation OpenAPI automatique. Prête à lancer avec uvicorn.",
  "requestedStack": "PYTHON",
  "treeSpec": "requirements.txt\napp/\n├── __init__.py\n├── main.py\n├── schemas.py\n└── routers/\n    └── weather.py\ntests/test_weather.py\nREADME.md",
  "aiDesignedTree": false
}')
echo "$RUN" | head -c 300; echo
RID=$(echo "$RUN" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('run',{}).get('id','') if d.get('ok') else '')" 2>/dev/null)
if [ -z "$RID" ]; then echo "Relance après recompilation…"; sleep 5; RUN=$(curl -s -X POST $BASE/studio/runs -H 'Content-Type: application/json' -d '{
  "name": "API météo FastAPI (test live R11)",
  "brief": "API REST FastAPI de prévisions météo : endpoint /health, endpoint /forecast retournant 7 jours de prévisions en JSON, validation Pydantic, documentation OpenAPI automatique. Prête à lancer avec uvicorn.",
  "requestedStack": "PYTHON",
  "treeSpec": "requirements.txt\napp/\n├── __init__.py\n├── main.py\n├── schemas.py\n└── routers/\n    └── weather.py\ntests/test_weather.py\nREADME.md",
  "aiDesignedTree": false
}'); RID=$(echo "$RUN" | python3 -c "import json,sys; print(json.load(sys.stdin)['run']['id'])"); fi
echo "RUN ID: $RID"

echo "══ 2. Attente de SEALED (poll) ══"
for i in $(seq 1 40); do
  sleep 5
  STATE=$(curl -s $BASE/studio/runs/$RID | python3 -c "import json,sys; print(json.load(sys.stdin)['run']['state'])")
  echo "  [$((i*5))s] état: $STATE"
  if [ "$STATE" = "SEALED" ] || [ "$STATE" = "FAILED" ]; then break; fi
done
if [ "$STATE" != "SEALED" ]; then echo "ÉCHEC: run non scellé ($STATE)"; exit 1; fi

echo "══ 3. PREUVE LIVE (POST execute) ══"
curl -s -X POST $BASE/studio/runs/$RID/execute | python3 -c "
import json,sys
d=json.load(sys.stdin)
print('verdict :', d.get('verdict'))
print('ok      :', d.get('ok'))
print('tentatives:', d.get('attempts'))
print('réparations:', d.get('repaired'))
print('raison  :', d.get('reason'))
print('port    :', d.get('port'))
print('état    :', d.get('state'))
"
echo "RID=$RID"
