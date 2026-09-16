#!/bin/sh
# Déploiement sûr de l'application sur le NAS.
# Usage : sh deploy.sh [chemin/vers/cmp-app.tar.gz]
# Sans argument, prend l'archive la plus récente sous /volume1/docker/cmp.
#
# Principe : on vérifie l'archive AVANT de supprimer quoi que ce soit.

APP=/volume1/docker/cmp/app

TGZ="$1"
if [ -z "$TGZ" ]; then
  # accepte aussi « cmp-app (1).tar.gz » etc., prend la plus récente
  TGZ=$(find /volume1/docker/cmp -maxdepth 2 -name 'cmp-app*.tar.gz' -printf '%T@ %p\n' 2>/dev/null \
        | sort -rn | head -1 | cut -d' ' -f2-)
fi

if [ -z "$TGZ" ] || [ ! -f "$TGZ" ]; then
  echo "ERREUR : aucune archive cmp-app.tar.gz trouvée."
  echo "         Dépose-la dans /volume1/docker/cmp puis relance."
  echo "         RIEN n'a été modifié."
  exit 1
fi

echo "Archive  : $TGZ"

TMP=$(mktemp -d) || exit 1
if ! tar -xzf "$TGZ" -C "$TMP" 2>/dev/null; then
  echo "ERREUR : archive illisible. RIEN n'a été modifié."
  rm -rf "$TMP"; exit 1
fi

if [ ! -f "$TMP/index.html" ]; then
  echo "ERREUR : l'archive ne contient pas index.html. RIEN n'a été modifié."
  rm -rf "$TMP"; exit 1
fi

ver() { grep -o 'content="v[0-9][0-9.]*"' "$1/index.html" 2>/dev/null | head -1 | cut -d'"' -f2; }
echo "Version  : $(ver "$TMP")"

# À partir d'ici seulement, on remplace.
mkdir -p "$APP"
find "$APP" -mindepth 1 -delete
cp -a "$TMP"/. "$APP"/
chmod -R a+rX "$APP"
rm -rf "$TMP"

echo "Déployé  : $(ver "$APP")"
curl -s -o /dev/null -w "Test local : HTTP %{http_code}\n" http://localhost:8000/
