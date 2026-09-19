#!/usr/bin/env bash
# 本机执行:deploy/mangrove/deploy.sh v0.1.0
# 前提:该 tag 的镜像已由 GitHub Actions 发布到 GHCR;服务器已 docker login ghcr.io(私有包)
set -euo pipefail
VERSION=${1:?用法: deploy.sh <vX.Y.Z>}
HOST=${HOST:-ubuntu@<server>}
KEY=${KEY:-~/.ssh/mangrove}
COMPOSE_DIR=/opt/1panel/docker/compose/remote-config
REPO=$(cd "$(dirname "$0")/../.." && pwd)

scp -i "$KEY" "$REPO/deploy/mangrove/docker-compose.yml" "$HOST:/tmp/remote-config-compose.yml"
ssh -i "$KEY" "$HOST" "sudo bash -s" <<REMOTE
set -e
mkdir -p $COMPOSE_DIR && mv /tmp/remote-config-compose.yml $COMPOSE_DIR/docker-compose.yml
cd $COMPOSE_DIR
printf 'REMOTE_CONFIG_VERSION=%s\n' '$VERSION' > .env
docker compose pull api web
docker compose up -d api web
docker compose ps
REMOTE
