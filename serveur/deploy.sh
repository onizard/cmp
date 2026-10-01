#!/bin/sh
# Déploiement sûr de l'application sur le serveur.
# Usage : sh deploy.sh [chemin/vers/cmp-app.tar.gz]
# Sans argument, prend l'archive la plus récente sous /volume1/docker/cmp.
#
# Principe : on vérifie l'archive AVANT de supprimer quoi que ce soit.

APP="$(cd "$(dirname "$0")" && pwd)/app"

TGZ="$1"
if [ -z "$TGZ" ]; then
  # accepte aussi « cmp-app (1).tar.gz » etc., prend la plus récente
  TGZ=$(find /root /opt/cmp -maxdepth 2 -name 'cmp-app*.tar.gz' -printf '%T@ %p\n' 2>/dev/null \
        | sort -rn | head -1 | cut -d' ' -f2-)
fi

if [ -z "$TGZ" ] || [ ! -f "$TGZ" ]; then
  echo "ERREUR : aucune archive cmp-app.tar.gz trouvée."
  echo "         Copie-la dans /root puis relance."
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
ATTENDU=$(ver "$TMP")
echo "Version  : $ATTENDU"

# Droits d'écriture : on s'en assure AVANT de supprimer quoi que ce soit.
# Sans ce garde-fou, un lancement sans sudo effaçait à moitié puis annonçait
# une réussite en relisant l'ancienne version restée en place.
mkdir -p "$APP" 2>/dev/null
if ! { touch "$APP/.essai" 2>/dev/null && rm -f "$APP/.essai"; }; then
  echo "ERREUR : pas les droits d'écriture sur $APP."
  echo "         Relance avec :  sudo sh $0"
  echo "         RIEN n'a été modifié."
  rm -rf "$TMP"; exit 1
fi

# À partir d'ici seulement, on remplace.
if ! find "$APP" -mindepth 1 -delete; then
  echo "ERREUR : l'ancienne version n'a pas pu être retirée."
  rm -rf "$TMP"; exit 1
fi

if ! cp -a "$TMP"/. "$APP"/; then
  echo "ERREUR : la copie a échoué. L'application est peut-être incomplète —"
  echo "         relance ce script avec les droits suffisants."
  rm -rf "$TMP"; exit 1
fi

chmod -R a+rX "$APP" || true
rm -rf "$TMP"

OBTENU=$(ver "$APP")
if [ "$OBTENU" != "$ATTENDU" ]; then
  echo "ERREUR : version en place « $OBTENU », attendue « $ATTENDU »."
  echo "         Le déploiement n'a PAS abouti."
  exit 1
fi

echo "Déployé  : $OBTENU"
curl -s -o /dev/null -w "Test local : HTTP %{http_code}\n" http://localhost:8000/
