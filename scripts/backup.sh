#!/bin/bash
# ============================================================================
# WadAcces - Script de sauvegarde PostgreSQL
# ============================================================================
# Crée une sauvegarde complète de la base de données avec horodatage.
# Conserve les 7 dernières sauvegardes automatiquement.
#
# Usage:
#   ./scripts/backup.sh                  # sauvegarde dans backups/
#   BACKUP_DIR=/custom/path ./scripts/backup.sh
#
# Cron (sauvegarde quotidienne à 2h du matin):
#   0 2 * * * cd /path/to/wadacces && ./scripts/backup.sh >> backups/cron.log 2>&1
# ============================================================================

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="wadacces_${TIMESTAMP}.sql.gz"
RETENTION_DAYS=7

mkdir -p "$BACKUP_DIR"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ DATABASE_URL n'est pas défini" >&2
  echo "   Exportez-le avant d'exécuter le script :" >&2
  echo "   export DATABASE_URL=postgresql://..." >&2
  exit 1
fi

echo "📦 Début de la sauvegarde : $FILENAME"
pg_dump "$DATABASE_URL" \
  --no-owner \
  --no-privileges \
  --format=plain \
  --schema=public \
  | gzip > "$BACKUP_DIR/$FILENAME"

SIZE=$(du -h "$BACKUP_DIR/$FILENAME" | cut -f1)
echo "✅ Sauvegarde terminée : $BACKUP_DIR/$FILENAME ($SIZE)"

# Nettoyage automatique : supprime les sauvegardes de plus de RETENTION_DAYS jours
echo "🧹 Nettoyage des sauvegardes de plus de $RETENTION_DAYS jours..."
find "$BACKUP_DIR" -name "wadacces_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete
REMAINING=$(find "$BACKUP_DIR" -name "wadacces_*.sql.gz" -type f | wc -l)
echo "📚 $REMAINING sauvegarde(s) conservée(s) dans $BACKUP_DIR"
