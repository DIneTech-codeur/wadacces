#!/bin/bash
# ============================================================================
# WadAcces - Script de restauration PostgreSQL
# ============================================================================
# Restaure une sauvegarde dans une base PostgreSQL.
#
# Usage:
#   ./scripts/restore.sh backups/wadacces_20260927_020000.sql.gz
#   BACKUP_FILE=backups/xxx.sql.gz ./scripts/restore.sh
#
# ATTENTION : cette opération écrase la base cible.
# ============================================================================

set -euo pipefail

BACKUP_FILE="${1:-${BACKUP_FILE:-}}"
TARGET_DB="${TARGET_DB:-$DATABASE_URL}"

if [ -z "$BACKUP_FILE" ]; then
  echo "❌ Aucun fichier de sauvegarde spécifié" >&2
  echo "   Usage: ./scripts/restore.sh <fichier.sql.gz>" >&2
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ Fichier introuvable : $BACKUP_FILE" >&2
  exit 1
fi

if [ -z "${TARGET_DB:-}" ]; then
  echo "❌ DATABASE_URL n'est pas défini" >&2
  exit 1
fi

echo "⚠️  ATTENTION : cette opération va écraser la base de données cible"
echo "   Fichier : $BACKUP_FILE"
echo "   Cible   : ${TARGET_DB%%@*}@*** (masqué)"
echo ""
read -p "   Confirmer la restauration ? (tapez 'OUI' pour continuer) : " CONFIRM

if [ "$CONFIRM" != "OUI" ]; then
  echo "❌ Opération annulée"
  exit 1
fi

echo "🔄 Décompression et restauration en cours..."
gunzip -c "$BACKUP_FILE" | psql "$TARGET_DB" --single-transaction --quiet

echo "✅ Restauration terminée"
echo ""
echo "📋 Vérification :"
psql "$TARGET_DB" -c "SELECT 'Produits: ' || count(*) FROM products WHERE deleted_at IS NULL;"
psql "$TARGET_DB" -c "SELECT 'Ventes: ' || count(*) FROM sales;"
psql "$TARGET_DB" -c "SELECT 'Clients: ' || count(*) FROM customers;"
