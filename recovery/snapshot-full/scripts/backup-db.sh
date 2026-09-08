#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# YAHRIA — sauvegarde PostgreSQL (à exécuter SUR le VPS)
#   ./scripts/backup-db.sh [répertoire]     (défaut: /var/backups/yahria)
#   Cron recommandé : 15 3 * * *  /opt/yahria/scripts/backup-db.sh
# Rétention : 14 jours. Chaque archive est un fait : taille listée.
# ═══════════════════════════════════════════════════════════════
set -euo pipefail
BACKUP_DIR="${1:-/var/backups/yahria}"
STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "[backup] pg_dump en cours…"
docker compose -f docker-compose.prod.yml exec -T db \
  pg_dump -U "${POSTGRES_USER:-yahria}" "${POSTGRES_DB:-yahria}" \
  | gzip > "$BACKUP_DIR/yahria-$STAMP.sql.gz"

# Vérification d'intégrité : l'archive doit être un gzip valide non vide
if ! gzip -t "$BACKUP_DIR/yahria-$STAMP.sql.gz" 2>/dev/null || [ ! -s "$BACKUP_DIR/yahria-$STAMP.sql.gz" ]; then
  echo "[backup] ÉCHEC — archive invalide ou vide, suppression" >&2
  rm -f "$BACKUP_DIR/yahria-$STAMP.sql.gz"
  exit 1
fi
echo "[backup] OK : $BACKUP_DIR/yahria-$STAMP.sql.gz ($(du -h "$BACKUP_DIR/yahria-$STAMP.sql.gz" | cut -f1))"

echo "[backup] rétention 14 jours…"
find "$BACKUP_DIR" -name 'yahria-*.sql.gz' -mtime +14 -delete
ls -1t "$BACKUP_DIR"/yahria-*.sql.gz 2>/dev/null | head -5
