#!/bin/sh
# Compile l'application avec les clés publiques lues dans nas/.env,
# puis fabrique l'archive à déposer sur le NAS.
set -e
cd "$(dirname "$0")"
. ./nas/.env
export VITE_SUPABASE_ANON_KEY="$ANON_KEY"
export VITE_VAPID_PUBLIC="$VAPID_PUBLIC"
export VITE_CONTACT_EMAIL="${VITE_CONTACT_EMAIL:-}"
npx vite build
VER=$(grep -o 'content="v[0-9][0-9.]*"' dist/index.html | head -1 | cut -d'"' -f2)
rm -f cmp-app-*.tar.gz
tar -czf "cmp-app-$VER.tar.gz" -C dist .
echo "Archive : cmp-app-$VER.tar.gz ($VER)"
