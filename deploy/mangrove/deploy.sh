#!/usr/bin/env bash
# 本机执行:同步源码到服务器 -> 服务器本地构建 -> 重启。首次部署前先在服务器放好 config.yaml 并跑一次 seed
set -euo pipefail
HOST=${HOST:-ubuntu@<server>}
KEY=${KEY:-~/.ssh/mangrove}
REPO=$(cd "$(dirname "$0")/../.." && pwd)
SRC=/opt/remote-config/src
COMPOSE_DIR=/opt/1panel/docker/compose/remote-config

ssh -i "$KEY" "$HOST" "sudo mkdir -p $SRC $COMPOSE_DIR && sudo chown -R \$(id -u):\$(id -g) $SRC"
rsync -az --delete -e "ssh -i $KEY" \
  --exclude node_modules --exclude .next --exclude dist --exclude .git \
  --exclude config.yaml --exclude 'docs/' --exclude 'tests/' \
  "$REPO/backend" "$REPO/frontend" "$HOST:$SRC/"
scp -i "$KEY" "$REPO/deploy/mangrove/docker-compose.yml" "$HOST:/tmp/remote-config-compose.yml"
ssh -i "$KEY" "$HOST" "sudo mv /tmp/remote-config-compose.yml $COMPOSE_DIR/docker-compose.yml \
  && cd $COMPOSE_DIR && sudo docker compose build api web && sudo docker compose up -d api web \
  && sudo docker compose ps"
