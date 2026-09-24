#!/bin/sh
# Compile le service de notifications en un seul fichier, push.cjs, a deposer
# sur le NAS puis a installer avec nas/update-push.sh.
set -e
cd "$(dirname "$0")"
npx esbuild nas/push/index.js --bundle --platform=node --target=node18 \
  --format=cjs --external:pg-native --outfile=nas/push/push.cjs
grep -o "VERSION = \"v[0-9.]*\"" nas/push/push.cjs | head -1
