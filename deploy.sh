#!/usr/bin/env bash
set -euo pipefail

REGISTRY="ghcr.io/iulspop"

echo "Building node image..."
docker build -t "$REGISTRY/learn-chinese-node:latest" .

echo "Building python image..."
docker build -f python-server/Dockerfile -t "$REGISTRY/learn-chinese-python:latest" .

echo "Pushing images..."
docker push "$REGISTRY/learn-chinese-node:latest"
docker push "$REGISTRY/learn-chinese-python:latest"

echo "Done."
