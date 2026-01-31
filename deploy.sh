#!/usr/bin/env bash
set -euo pipefail

REGISTRY="iulspop"
VPS="${DEPLOY_HOST:-nodejs@157.245.7.127}"
REMOTE_DIR="${DEPLOY_DIR:-/home/nodejs/learn-chinese}"
WEBHOOK_URL="https://polyanova.com/hooks/learn-chinese"

SEED=false
if [[ "${1:-}" == "--seed" ]]; then
  SEED=true
fi

echo "Building node image..."
docker build --platform linux/amd64 -t "$REGISTRY/learn-chinese-node:latest" .

echo "Building python image..."
docker build --platform linux/amd64 -t "$REGISTRY/learn-chinese-python:latest" python-server/

echo "Pushing images..."
docker push "$REGISTRY/learn-chinese-node:latest"
docker push "$REGISTRY/learn-chinese-python:latest"

if $SEED; then
  echo "Seeding data/ to VPS..."
  rsync -avz data/ "$VPS:$REMOTE_DIR/data/"
fi

echo "Syncing config files to VPS..."
rsync -avz docker-compose.yml "$VPS:$REMOTE_DIR/docker-compose.yml"
rsync -avz .env.production "$VPS:$REMOTE_DIR/.env.production"
rsync -avz scripts/generate-cards/gcp-key.json "$VPS:$REMOTE_DIR/gcp-key.json"

echo "Triggering deploy webhook..."
curl -X POST "$WEBHOOK_URL"

echo "Done!"
