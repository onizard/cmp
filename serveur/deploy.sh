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

# Les clés publiques de l'appli : l'archive peut arriver avec des repères à
# leur place (__CMP_…__) ; on les remplit ici, depuis le .env du serveur.
# Une clé introuvable : on s'arrête, RIEN n'est modifié.
ICI="$(cd "$(dirname "$0")" && pwd)"
lire() { sed -n "s/^$1=//p" "$ICI/.env" 2>/dev/null | tail -1 | tr -d '"'"'"'\r'; }
if grep -rqs '__CMP_' "$TMP"; then
  ANON=$(lire ANON_KEY)
  # Repli : la clé anon de l'appli déjà en place.
  [ -z "$ANON" ] && ANON=$(grep -rhoE 'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+' "$ICI/app/assets" 2>/dev/null | head -1)
  VAPID=$(lire VAPID_PUBLIC)
  CONTACT=$(lire VITE_CONTACT_EMAIL)
  [ -z "$CONTACT" ] && CONTACT=contact@break-pharma.fr
  if [ -z "$ANON" ] || [ -z "$VAPID" ]; then
    echo "ERREUR : ANON_KEY ou VAPID_PUBLIC introuvable dans $ICI/.env."
    echo "         RIEN n'a été modifié."
    rm -rf "$TMP"; exit 1
  fi
  grep -rlZ '__CMP_' "$TMP" | xargs -0 sed -i \
    -e "s|__CMP_ANON_KEY__|$ANON|g" \
    -e "s|__CMP_VAPID_PUBLIC__|$VAPID|g" \
    -e "s|__CMP_CONTACT_EMAIL__|$CONTACT|g"
  if grep -rqs '__CMP_' "$TMP"; then
    echo "ERREUR : des clés n'ont pas pu être posées. RIEN n'a été modifié."
    rm -rf "$TMP"; exit 1
  fi
  echo "Clés     : posées depuis $ICI/.env"
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
