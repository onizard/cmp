#!/bin/sh
# Installe un nouveau push.cjs et redémarre le service d'envoi.
#
# Usage : déposer push.cjs dans /volume1/docker/cmp/ (au même endroit que les
# archives de l'application), puis lancer :  sh /volume1/docker/cmp/update-push.sh
set -e

SRC=${1:-/volume1/docker/cmp/push.cjs}

if [ ! -f "$SRC" ]; then
  echo "Introuvable : $SRC"
  echo "Dépose d'abord push.cjs dans /volume1/docker/cmp/ puis relance."
  exit 1
fi

# Où le conteneur attend-il son fichier ? On lit ses points de montage.
DST=""
for pair in $(docker inspect cmp-push --format '{{range .Mounts}}{{.Source}}|{{.Destination}}{{"\n"}}{{end}}'); do
  s=$(echo "$pair" | cut -d'|' -f1)
  d=$(echo "$pair" | cut -d'|' -f2)
  case "$d" in
    *push.cjs)  DST="$s" ;;                       # le fichier lui-même est monté
    *)          [ -d "$s" ] && [ -z "$DST" ] && DST="$s/push.cjs" ;;
  esac
done

if [ -z "$DST" ]; then
  echo "Aucun point de montage trouvé pour cmp-push. Montages actuels :"
  docker inspect cmp-push --format '{{range .Mounts}}  {{.Source}} -> {{.Destination}}{{"\n"}}{{end}}'
  exit 1
fi

echo "Source      : $SRC"
echo "Destination : $DST"

# On garde l'ancien sous la main, au cas où.
[ -f "$DST" ] && cp "$DST" "$DST.bak" && echo "Sauvegarde  : $DST.bak"

cp "$SRC" "$DST"
chmod a+r "$DST"

docker restart cmp-push >/dev/null
echo "Redémarré. Journal :"
sleep 3
docker logs --tail 6 cmp-push
