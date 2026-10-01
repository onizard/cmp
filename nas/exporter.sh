#!/bin/sh
# Déménagement vers le serveur : export depuis le NAS.
#
# Usage :  sudo sh /volume1/docker/cmp/exporter.sh
#
# 1. Met l'appli au repos : tout s'arrête sauf la base, pour que plus rien ne
#    s'écrive pendant la copie (le tunnel aussi : le serveur prendra le
#    relais avec le même).
# 2. Sauvegarde les comptes (schéma auth) et les données (schéma public).
# 3. Range le tout avec le fichier .env (les mêmes clés serviront sur le
#    serveur : rien à changer sur les téléphones) dans une seule archive,
#    /volume1/docker/cmp/cmp-migration.tgz, lisible par toi seul.
#
# Rien n'est effacé sur le NAS. Pour revenir en arrière :
#   sudo docker start cmp-auth cmp-rest realtime-dev.cmp-realtime cmp-gateway cmp-push cmp-tunnel

set -e

DIR=/volume1/docker/cmp
OUT=$DIR/migration
ARCHIVE=$DIR/cmp-migration.tgz

if [ "$(id -u)" != 0 ]; then
  echo "ERREUR : lance-le avec sudo :  sudo sh $0"
  exit 1
fi
if [ ! -f "$DIR/.env" ]; then
  echo "ERREUR : $DIR/.env introuvable. RIEN n'a été modifié."
  exit 1
fi
if ! docker ps --format '{{.Names}}' | grep -qx cmp-db; then
  echo "ERREUR : la base (cmp-db) ne tourne pas. RIEN n'a été modifié."
  exit 1
fi

PSQL="docker exec cmp-db psql -h localhost -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -At"
DUMP="docker exec cmp-db pg_dump -h localhost -U supabase_admin -d postgres"

echo "1/3 Mise au repos de l'appli (la base reste allumée)…"
for c in cmp-tunnel cmp-gateway cmp-push cmp-auth cmp-rest realtime-dev.cmp-realtime; do
  docker stop "$c" >/dev/null 2>&1 || true
done

echo "2/3 Sauvegarde des comptes et des données…"
rm -rf "$OUT"
mkdir -p "$OUT"
chmod 700 "$OUT"
$DUMP --data-only --schema=auth --exclude-table=auth.schema_migrations --disable-triggers > "$OUT/auth.sql"
$DUMP --schema=public --no-publications --no-subscriptions > "$OUT/public.sql"
$PSQL -c "select format('alter publication supabase_realtime add table %I.%I;', schemaname, tablename)
            from pg_publication_tables where pubname = 'supabase_realtime'" > "$OUT/publication.sql"
$PSQL -c "select 'comptes', count(*) from auth.users
          union all select 'foyers', count(*) from public.households
          union all select 'membres', count(*) from public.members
          union all select 'taches', count(*) from public.tasks" > "$OUT/comptes.txt"
cp "$DIR/.env" "$OUT/env"

echo "3/3 Archive…"
tar -czf "$ARCHIVE" -C "$OUT" .
rm -rf "$OUT"
# Elle contient les clés de l'appli : lisible par toi seul, pour la copier.
chown "${SUDO_USER:-root}" "$ARCHIVE"
chmod 600 "$ARCHIVE"

echo
echo "Prêt : $ARCHIVE ($(du -h "$ARCHIVE" | cut -f1))"
tar -xzOf "$ARCHIVE" ./comptes.txt | sed 's/|/ : /; s/^/  /'
echo
echo "L'appli est au repos sur le NAS. Pour revenir en arrière :"
echo "  sudo docker start cmp-auth cmp-rest realtime-dev.cmp-realtime cmp-gateway cmp-push cmp-tunnel"
