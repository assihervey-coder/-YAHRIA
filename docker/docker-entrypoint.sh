#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# YAHRIA — point d'entrée conteneur (R11.3)
# 1. Basculer le provider Prisma (YAHRIA_DB_PROVIDER, défaut postgresql)
# 2. Régénérer le client + pousser le schéma (idempotent)
# 3. Démarrer le serveur custom (next + WebSocket realtime)
# ═══════════════════════════════════════════════════════════════
set -euo pipefail
cd /app

PROVIDER="${YAHRIA_DB_PROVIDER:-postgresql}"
echo "[yahria-entrypoint] provider Prisma : ${PROVIDER}"
node scripts/db-provider.mjs "${PROVIDER}"
npx prisma generate
npx prisma db push --skip-generate

echo "[yahria-entrypoint] démarrage YAHRIA CODE OS sur :${PORT:-3000}"
exec node server.mjs
