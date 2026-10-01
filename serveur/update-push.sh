#!/bin/sh
# Installe un nouveau push.cjs (service des notifications) et le redémarre.
# Usage :  sh /opt/cmp/update-push.sh [/root/push.cjs]

set -e
ICI="$(cd "$(dirname "$0")" && pwd)"
SRC=${1:-/root/push.cjs}
if [ ! -f "$SRC" ]; then
  echo "ERREUR : introuvable : $SRC. Copie d'abord push.cjs dans /root."
  exit 1
fi
cp "$SRC" "$ICI/push/push.cjs"
chmod a+r "$ICI/push/push.cjs"
docker restart cmp-push > /dev/null
sleep 5
docker logs --tail 6 cmp-push
