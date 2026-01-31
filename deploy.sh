#!/usr/bin/env bash
set -euo pipefail

REGISTRY="iulspop"
VPS="${DEPLOY_HOST:-nodejs@157.245.7.127}"
REMOTE_DIR="${DEPLOY_DIR:-/home/nodejs/learn-chinese}"
WEBHOOK_URL="https://polyanova.com/hooks/learn-chinese"

echo "Building node image..."
docker build --platform linux/amd64 -t "$REGISTRY/learn-chinese-node:latest" .

echo "Building python image..."
docker build --platform linux/amd64 -t "$REGISTRY/learn-chinese-python:latest" python-server/

echo "Pushing images..."
docker push "$REGISTRY/learn-chinese-node:latest"
docker push "$REGISTRY/learn-chinese-python:latest"

echo "Syncing data/ to VPS..."
rsync -avz --delete data/ "$VPS:$REMOTE_DIR/data/"

echo "Syncing docker-compose.yml to VPS..."
rsync -avz docker-compose.yml "$VPS:$REMOTE_DIR/docker-compose.yml"

echo "Triggering deploy webhook..."
curl -X POST "$WEBHOOK_URL"

echo "Done!"