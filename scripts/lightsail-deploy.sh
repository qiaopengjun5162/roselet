#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/roselet}"
ENV_FILE="${ENV_FILE:-.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-deploy/lightsail/docker-compose.backend.yml}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3001/health}"

if [[ -z "${BACKEND_IMAGE:-}" ]]; then
  echo "BACKEND_IMAGE is required" >&2
  exit 1
fi

cd "$APP_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $APP_DIR/$ENV_FILE" >&2
  exit 1
fi

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "Missing $APP_DIR/$COMPOSE_FILE" >&2
  exit 1
fi

current_container="$(
  sudo env BACKEND_IMAGE="$BACKEND_IMAGE" docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps -q backend 2>/dev/null || true
)"
if [[ -n "$current_container" ]]; then
  sudo docker inspect --format '{{.Config.Image}}' "$current_container" > .previous_backend_image || true
fi

sudo env BACKEND_IMAGE="$BACKEND_IMAGE" docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" pull backend
sudo env BACKEND_IMAGE="$BACKEND_IMAGE" docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d db backend

for _ in {1..30}; do
  if curl -fsS "$HEALTH_URL" >/tmp/roselet-health.json; then
    cat /tmp/roselet-health.json
    echo
    echo "$BACKEND_IMAGE" > .current_backend_image
    exit 0
  fi
  sleep 2
done

echo "Backend health check failed: $HEALTH_URL" >&2
sudo env BACKEND_IMAGE="$BACKEND_IMAGE" docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" logs --tail=120 backend >&2
exit 1
