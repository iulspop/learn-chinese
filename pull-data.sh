#!/usr/bin/env bash
set -euo pipefail

VPS="${DEPLOY_HOST:-nodejs@157.245.7.127}"
REMOTE_DIR="${DEPLOY_DIR:-/home/nodejs/learn-chinese}"

echo "Pulling data/ from VPS..."
rsync -avz "$VPS:$REMOTE_DIR/data/" data/

echo "Done!"
