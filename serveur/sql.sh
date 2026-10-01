#!/bin/sh
# Passe un script SQL sur la base, avec les droits nécessaires.
# Usage :  sh /opt/cmp/sql.sh /opt/cmp/db/acces.sql
# (s'arrête à la première erreur)

if [ ! -f "$1" ]; then
  echo "ERREUR : script introuvable : « $1 »."
  exit 1
fi
docker exec -i cmp-db psql -h localhost -U supabase_admin -d postgres -v ON_ERROR_STOP=1 < "$1"
