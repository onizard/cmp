#!/bin/sh
# Compile l'application, puis fabrique l'archive à déposer sur le serveur.
#
# Les clés publiques (clé anon, clé VAPID, e-mail de contact) viennent de
# nas/.env s'il est là. Sinon, l'archive part avec des repères (__CMP_…__)
# que serveur/deploy.sh remplit au déploiement depuis le .env du serveur :
# on peut construire sans aucune clé sous la main.
set -e
cd "$(dirname "$0")"
if [ -f ./nas/.env ]; then
  . ./nas/.env
  export VITE_SUPABASE_ANON_KEY="$ANON_KEY"
  export VITE_VAPID_PUBLIC="$VAPID_PUBLIC"
  export VITE_CONTACT_EMAIL="${VITE_CONTACT_EMAIL:-}"
else
  echo "nas/.env absent : clés laissées en repères, posées par deploy.sh."
  export VITE_SUPABASE_ANON_KEY="__CMP_ANON_KEY__"
  export VITE_VAPID_PUBLIC="__CMP_VAPID_PUBLIC__"
  export VITE_CONTACT_EMAIL="__CMP_CONTACT_EMAIL__"
fi
npx vite build
VER=$(grep -o 'content="v[0-9][0-9.]*"' dist/index.html | head -1 | cut -d'"' -f2)
rm -f cmp-app-*.tar.gz
tar -czf "cmp-app-$VER.tar.gz" -C dist .
echo "Archive : cmp-app-$VER.tar.gz ($VER)"
