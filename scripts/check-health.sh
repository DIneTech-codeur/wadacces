#!/bin/bash
# ============================================================================
# WadAcces - Vérification de santé de l'application
# ============================================================================
# À utiliser après un déploiement ou un redémarrage pour vérifier que
# l'application répond correctement.
#
# Usage:
#   ./scripts/check-health.sh https://wadacces.com
#   URL=https://wadacces.com ./scripts/check-health.sh
# ============================================================================

set -euo pipefail

URL="${1:-${URL:-}}"

if [ -z "$URL" ]; then
  echo "❌ URL non spécifiée" >&2
  echo "   Usage: ./scripts/check-health.sh <url>" >&2
  exit 1
fi

URL="${URL%/}"
ERRORS=0

check() {
  local name="$1"
  local endpoint="$2"
  local expected="$3"

  printf "  %-30s " "$name"
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "$URL$endpoint" || echo "000")
  if [ "$CODE" = "$expected" ]; then
    echo "✅ $CODE"
  else
    echo "❌ $CODE (attendu: $expected)"
    ERRORS=$((ERRORS + 1))
  fi
}

echo "🔍 Vérification de santé : $URL"
echo ""

check "Page d'accueil" "/login" "200"
check "Caisse vendeur" "/vendor" "200"
check "Bureau admin" "/admin" "200"
check "API health" "/api/health" "200"
check "API auth/vendors" "/api/auth/vendors?role=vendor" "200"
check "Manifest PWA" "/manifest.json" "200"
check "Service Worker" "/sw.js" "200"

# Vérification du contenu de /api/health
echo ""
printf "  %-30s " "Base de données"
HEALTH=$(curl -s "$URL/api/health" || echo "{}")
if echo "$HEALTH" | grep -q '"database":"connected"'; then
  echo "✅ connectée"
else
  echo "❌ déconnectée"
  ERRORS=$((ERRORS + 1))
fi

echo ""
if [ $ERRORS -eq 0 ]; then
  echo "✅ Tous les contrôles sont passés"
  exit 0
else
  echo "❌ $ERRORS erreur(s) détectée(s)"
  exit 1
fi
