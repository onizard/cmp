#!/bin/sh
# Sauvegarde de la base, chaque nuit (programmée par installer.sh, à 3 h 15).
# Garde les 14 derniers jours dans /opt/cmp/sauvegardes. En plus de celle-ci,
# Hetzner garde une copie complète du serveur (option Backups).
#
# Restaurer (sur une base neuve) :
#   docker exec -i cmp-db pg_restore -h localhost -U supabase_admin -d postgres --clean --if-exists < fichier.dump

set -e
D="$(cd "$(dirname "$0")" && pwd)/sauvegardes"
mkdir -p "$D"
F="$D/cmp-$(date +%Y-%m-%d).dump"
docker exec cmp-db pg_dump -h localhost -U supabase_admin -d postgres -Fc > "$F.tmp"
mv "$F.tmp" "$F"
chmod 600 "$F"
find "$D" -name 'cmp-*.dump' -mtime +13 -delete
echo "$(date '+%F %T') sauvegarde $(basename "$F") ($(du -h "$F" | cut -f1))"
