#!/bin/sh
# ═══════════════════════════════════════════════════════════════════
# YAHRIA — MESURE PTA-002 IT.10 (budget par porte + pydantic v2 EVO-000030)
# 3 slots séquentiels (chaque slot = processus bun frais — chunks
# robustes, leçon processus long-lived) puis finalize agrégé + scellé.
# Lancement : (setsid sh scripts/run-it10-measure.sh >> scripts/repair-measure-it10.log 2>&1 < /dev/null &)
# ═══════════════════════════════════════════════════════════════════
cd /home/z/my-project || exit 1

for i in 1 2 3; do
  echo "═══ SLOT $i — $(date -u +%FT%TZ) ═══"
  bun scripts/pta-repair-measure-it10.ts slot "$i"
  echo "── slot $i exit=$? — $(date -u +%FT%TZ)"
done

echo "═══ FINALIZE — $(date -u +%FT%TZ) ═══"
bun scripts/pta-repair-measure-it10.ts finalize
echo "═══ finalize exit=$? — $(date -u +%FT%TZ) ═══"
