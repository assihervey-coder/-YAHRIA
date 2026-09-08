#!/usr/bin/env bash
# R11.2 — PREUVE POLYGLOTTE : mission Studio → génération LLM → SEALED → sandbox (compile+run CLI) → verdict
# Usage: r11-polyglot-prove.sh <STACK> <NAME> <TREE_SPEC> <BRIEF_FILE>
set -u
BASE=http://localhost:3000/api/yahria/studio/runs
STACK="$1"; NAME="$2"; TREE="$3"; BRIEF_FILE="$4"
BRIEF=$(cat "$BRIEF_FILE")

jget() { node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const o=JSON.parse(d);const v=eval('o'+process.argv[1]);console.log(v===undefined?'':v)}catch(e){console.log('')}})" "$1"; }

echo "=== [$STACK] création de la mission « $NAME » ==="
RUN=$(curl -s -X POST "$BASE" -H 'Content-Type: application/json' \
  -d "$(node -e 'const[n,t,b,s]=[process.argv[1],process.argv[2],process.argv[3],process.argv[4]];console.log(JSON.stringify({name:n,brief:b,treeSpec:t,requestedStack:s}))' "$NAME" "$TREE" "$BRIEF" "$STACK")")
echo "$RUN" | head -c 400; echo
RID=$(printf '%s' "$RUN" | jget .run.id)
[ -z "$RID" ] && { echo "ÉCHEC création"; exit 1; }
echo "RUN_ID=$RID"

echo "=== attente SEALED (pipeline génération LLM) ==="
STATE=""
for i in $(seq 1 90); do
  sleep 4
  R=$(curl -s "$BASE/$RID")
  STATE=$(printf '%s' "$R" | jget .run.state)
  LSTATE=$(printf '%s' "$R" | jget .run.liveState)
  echo "  [$((i*4))s] state=$STATE live=$LSTATE files=$(printf '%s' "$R" | jget .run.files.length)"
  [ "$STATE" = "SEALED" ] && break
  [ "$STATE" = "FAILED" ] && { echo "ÉCHEC PIPELINE"; printf '%s' "$R" | jget .run.error; exit 2; }
done
[ "$STATE" != "SEALED" ] && { echo "TIMEOUT pipeline"; exit 3; }

echo "=== preuve live sandbox (compile + run CLI) ==="
PROOF=$(curl -s --max-time 600 -X POST "$BASE/$RID/execute")
echo "$PROOF" | head -c 800; echo
FINAL=$(curl -s "$BASE/$RID" | jget .run.liveState)
echo "=== [$STACK] liveState final : $FINAL ==="
[ "$FINAL" = "PROVED" ]
