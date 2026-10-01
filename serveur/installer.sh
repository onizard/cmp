#!/bin/sh
# Déménagement vers le serveur : première installation, avec les données du
# NAS (l'archive faite par nas/exporter.sh).
#
# Usage :  sh /opt/cmp/installer.sh /root/cmp-migration.tgz
#
# 1. Démarre une base neuve, puis le service d'authentification une fois,
#    pour qu'il pose ses tables.
# 2. Y verse les comptes, puis les données, puis la liste du temps réel.
# 3. Repasse les derniers scripts (idempotents), qui remettent aussi la
#    garde posée sur les mots de passe.
# 4. Compare les comptes avec ceux du NAS, démarre l'appli, la teste, et
#    n'allume le tunnel — l'adresse publique — que si tout est bon.
# 5. Programme la sauvegarde de chaque nuit.
#
# Il refuse de tourner deux fois : si la base existe déjà, rien n'est touché.

set -e
cd "$(dirname "$0")"
ICI=$(pwd)
MIG="$1"

if [ -z "$MIG" ] || [ ! -f "$MIG" ]; then
  echo "ERREUR : archive de migration introuvable : « $MIG »."
  echo "         Usage : sh $ICI/installer.sh /root/cmp-migration.tgz"
  exit 1
fi
if [ -d pgdata ]; then
  echo "ERREUR : la base existe déjà ($ICI/pgdata) : l'installation a déjà été faite."
  echo "         RIEN n'a été modifié."
  exit 1
fi

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
tar -xzf "$MIG" -C "$TMP"
for f in env auth.sql public.sql publication.sql comptes.txt; do
  if [ ! -f "$TMP/$f" ]; then
    echo "ERREUR : archive incomplète ($f manquant). RIEN n'a été modifié."
    exit 1
  fi
done
install -m 600 "$TMP/env" .env
# Realtime chiffre en AES-128 : il lui faut une clé d'exactement 16
# caractères. L'ancienne (19) le faisait planter au démarrage sur le NAS.
# Ses données sont recréées ici : on peut la remplacer sans rien perdre.
cle=$(sed -n 's/^REALTIME_DB_ENC_KEY=//p' .env)
if [ "${#cle}" != 16 ]; then
  neuve=$(head -c 8 /dev/urandom | od -An -tx1 | tr -d ' \n')
  if grep -q '^REALTIME_DB_ENC_KEY=' .env; then
    sed -i "s/^REALTIME_DB_ENC_KEY=.*/REALTIME_DB_ENC_KEY=$neuve/" .env
  else
    echo "REALTIME_DB_ENC_KEY=$neuve" >> .env
  fi
fi
mkdir -p sauvegardes
# Hetzner bloque l'envoi de mail sur les ports 25 et 465 des nouveaux
# serveurs (contre le spam) : le 587 (STARTTLS) passe, et Resend l'accepte.
if grep -q '^SMTP_PORT=465$' .env; then
  sed -i 's/^SMTP_PORT=465$/SMTP_PORT=587/' .env
fi

PSQL="docker exec -i -e PGOPTIONS=--client-min-messages=warning cmp-db psql -h localhost -U supabase_admin -d postgres"
attendre() { # attendre <secondes> <commande…>
  n=$1; shift
  while ! "$@" >/dev/null 2>&1; do
    n=$((n - 3))
    [ "$n" -le 0 ] && return 1
    sleep 3
  done
}
sain() { [ "$(docker inspect -f '{{.State.Health.Status}}' cmp-db)" = healthy ]; }
auth_pret() { docker logs cmp-auth 2>&1 | grep -q 'API started'; }

echo "1/6 Démarrage d'une base neuve…"
docker compose up -d db
if ! attendre 180 sain; then
  echo "ERREUR : la base ne démarre pas :"; docker logs --tail 30 cmp-db; exit 1
fi

echo "2/6 Préparation des comptes…"
docker compose up -d auth
if ! attendre 180 auth_pret; then
  echo "ERREUR : l'authentification ne démarre pas :"; docker logs --tail 30 cmp-auth; exit 1
fi
docker compose stop auth >/dev/null

echo "3/6 Import des comptes…"
$PSQL -v ON_ERROR_STOP=1 -q <<'SQL'
do $$
declare r record;
begin
  for r in select tablename from pg_tables
            where schemaname = 'auth' and tablename <> 'schema_migrations' loop
    execute format('truncate auth.%I cascade', r.tablename);
  end loop;
end $$;
SQL
$PSQL -v ON_ERROR_STOP=1 -q < "$TMP/auth.sql" > "$TMP/auth.log" 2>&1 || {
  echo "ERREUR pendant l'import des comptes :"; grep -m 5 ERROR "$TMP/auth.log"; exit 1; }

echo "4/6 Import des données…"
# Le schéma public existe déjà dans une base neuve.
sed '/^CREATE SCHEMA public;$/d' "$TMP/public.sql" | $PSQL -q > "$TMP/public.log" 2>&1 || true
if grep -q ERROR "$TMP/public.log"; then
  echo "ERREUR pendant l'import des données :"; grep -m 10 ERROR "$TMP/public.log"
  echo "Le tunnel n'est PAS allumé : le NAS peut reprendre la main (voir plus bas)."
  exit 1
fi
$PSQL -q < "$TMP/publication.sql" > /dev/null 2>&1 || true
# Les derniers scripts, s'ils ont leur place (mode entreprise installé).
if [ "$($PSQL -At -c "select to_regproc('public.entreprise_responsable') is not null")" = t ]; then
  for s in acces mot-de-passe; do
    $PSQL -v ON_ERROR_STOP=1 -q < "db/$s.sql" > /dev/null
  done
else
  echo "ATTENTION : le mode entreprise (v6.15) n'était pas installé sur le NAS."
  echo "            L'appli tourne, mais dis-le à Claude avant d'aller plus loin."
fi

echo "5/6 Vérification…"
$PSQL -At -c "select 'comptes', count(*) from auth.users
              union all select 'foyers', count(*) from public.households
              union all select 'membres', count(*) from public.members
              union all select 'taches', count(*) from public.tasks" > "$TMP/ici.txt"
if ! cmp -s "$TMP/comptes.txt" "$TMP/ici.txt"; then
  echo "ERREUR : les nombres ne correspondent pas (NAS / serveur) :"
  paste -d'  ' "$TMP/comptes.txt" "$TMP/ici.txt" | sed 's/|/ : /g; s/^/  /'
  echo "Le tunnel n'est PAS allumé : le NAS peut reprendre la main (voir plus bas)."
  exit 1
fi
sed 's/|/ : /; s/^/  /' "$TMP/ici.txt"

echo "6/6 Démarrage de l'appli…"
docker compose up -d db auth rest realtime gateway push
code=000
for i in $(seq 1 20); do
  code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8000/auth/v1/health || true)
  [ "$code" = 200 ] && break
  sleep 3
done
page=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8000/ || true)
if [ "$code" != 200 ] || [ "$page" != 200 ]; then
  echo "ERREUR : l'appli ne répond pas comme prévu (auth $code, page $page)."
  echo "Le tunnel n'est PAS allumé : le NAS peut reprendre la main (voir plus bas)."
  exit 1
fi
docker compose up -d cloudflared

# La sauvegarde de chaque nuit, à 3 h 15.
cat > /etc/cron.d/cmp-sauvegarde <<EOF
15 3 * * * root sh $ICI/sauvegarde.sh >> /var/log/cmp-sauvegarde.log 2>&1
EOF
sh "$ICI/sauvegarde.sh"

echo
echo "C'est fait : l'appli tourne sur le serveur, le tunnel est allumé."
echo "Version : $(grep -o 'content="v[0-9][0-9.]*"' app/index.html | head -1 | cut -d'"' -f2)"
docker compose ps --format '  {{.Name}} : {{.Status}}'
echo
echo "En cas de problème, pour rendre la main au NAS :"
echo "  ici :     cd $ICI && docker compose stop cloudflared"
echo "  sur le NAS : sudo docker start cmp-auth cmp-rest realtime-dev.cmp-realtime cmp-gateway cmp-push cmp-tunnel"
