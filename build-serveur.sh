#!/bin/sh
# Fabrique cmp-serveur.tgz : tout ce qu'il faut sur le serveur, rangé dans
# un dossier « cmp » à extraire dans /opt (tar -xzf cmp-serveur.tgz -C /opt).
# L'appli embarquée est la dernière archive cmp-app-v*.tar.gz construite.
set -e
cd "$(dirname "$0")"
APPTGZ=$(ls -t cmp-app-v*.tar.gz | head -1)
T=$(mktemp -d)
mkdir -p "$T/cmp/app" "$T/cmp/push" "$T/cmp/gateway" "$T/cmp/db"
cp serveur/docker-compose.yml serveur/*.sh "$T/cmp/"
cp nas/db/*.sql "$T/cmp/db/"
cp nas/gateway/nginx.conf "$T/cmp/gateway/"
cp nas/push/push.cjs "$T/cmp/push/"
tar -xzf "$APPTGZ" -C "$T/cmp/app"
chmod -R a+rX "$T/cmp"
rm -f cmp-serveur.tgz
tar -czf cmp-serveur.tgz -C "$T" cmp
rm -rf "$T"
echo "cmp-serveur.tgz ($(du -h cmp-serveur.tgz | cut -f1)) — appli $APPTGZ, notifications $(grep -o 'VERSION = "v[0-9.]*"' nas/push/push.cjs | head -1)"
