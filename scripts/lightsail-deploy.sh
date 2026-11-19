#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/roselet}"
ENV_FILE="${ENV_FILE:-.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-deploy/lightsail/docker-compose.backend.yml}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-roselet}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3001/health}"
WEB_HEALTH_URL="${WEB_HEALTH_URL:-http://127.0.0.1:3000/}"
CADDY_TARGET="${CADDY_TARGET:-/etc/caddy/Caddyfile}"

if [[ -z "${BACKEND_IMAGE:-}" && -z "${WEB_IMAGE:-}" ]]; then
  # 只改了 Caddyfile / 部署脚本时会有这种调用：没有镜像要更，只做配置同步。
  echo "No image to deploy; syncing configuration only."
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

# 没被要求更新的那个服务，必须继续用**上一次部署的那个镜像**。
# 空字符串会让 compose 校验整个 project 失败（2026-11-19 踩过），
# 而兜底成 `:latest` 会把生产悄悄换成 latest——同样是「修的东西和跑的东西不一致」。
# 所以：优先用这次传进来的，其次用记录下来的，最后才交给 compose 文件里的默认值。
resolve_image() {
  local requested="$1" record="$2"
  if [[ -n "$requested" ]]; then
    printf '%s' "$requested"
  elif [[ -s "$record" ]]; then
    cat "$record"
  fi
}

RESOLVED_BACKEND_IMAGE="$(resolve_image "${BACKEND_IMAGE:-}" .current_backend_image)"
RESOLVED_WEB_IMAGE="$(resolve_image "${WEB_IMAGE:-}" .current_web_image)"

compose() {
  sudo env BACKEND_IMAGE="$RESOLVED_BACKEND_IMAGE" WEB_IMAGE="$RESOLVED_WEB_IMAGE" \
    COMPOSE_PROJECT_NAME="$COMPOSE_PROJECT_NAME" \
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

# ---- 后端 ----
if [[ -n "${BACKEND_IMAGE:-}" ]]; then
  current_container="$(compose ps -q backend 2>/dev/null || true)"
  if [[ -n "$current_container" ]]; then
    sudo docker inspect --format '{{.Config.Image}}' "$current_container" > .previous_backend_image || true
  fi

  compose pull backend
  compose up -d db backend

  for _ in {1..30}; do
    if curl -fsS "$HEALTH_URL" >/tmp/roselet-health.json; then
      cat /tmp/roselet-health.json
      echo
      echo "$BACKEND_IMAGE" > .current_backend_image
      break
    fi
    sleep 2
  done

  if [[ ! -s /tmp/roselet-health.json ]]; then
    echo "Backend health check failed: $HEALTH_URL" >&2
    compose logs --tail=120 backend >&2
    exit 1
  fi
fi

# ---- 前端 ----
# 国内只有裸 IP 能到这台机器，所以页面必须自己发一份，不能继续只挂 Vercel。
if [[ -n "${WEB_IMAGE:-}" ]]; then
  current_web="$(compose ps -q web 2>/dev/null || true)"
  if [[ -n "$current_web" ]]; then
    sudo docker inspect --format '{{.Config.Image}}' "$current_web" > .previous_web_image || true
  fi

  compose pull web
  compose up -d web

  web_ok=false
  for _ in {1..30}; do
    if curl -fsS "$WEB_HEALTH_URL" | grep -q "<!DOCTYPE html"; then
      web_ok=true
      break
    fi
    sleep 2
  done

  if [[ "$web_ok" != "true" ]]; then
    echo "Web health check failed: $WEB_HEALTH_URL" >&2
    compose logs --tail=120 web >&2
    exit 1
  fi

  echo "$WEB_IMAGE" > .current_web_image
  echo "web healthy: $WEB_HEALTH_URL"
fi

# ---- Caddy ----
# 仓库是共享源，但服务器上这份是手动改的，所以只有内容不同时才动它。
# 先校验再换，避免把 80 端口写坏。
if [[ -f deploy/lightsail/Caddyfile ]] && ! sudo cmp -s deploy/lightsail/Caddyfile "$CADDY_TARGET"; then
  echo "Caddyfile differs from repo; swapping with a backup"
  backup="$CADDY_TARGET.bak-$(date +%Y%m%d%H%M%S)"
  sudo cp -a "$CADDY_TARGET" "$backup"
  sudo install -m 644 deploy/lightsail/Caddyfile "$CADDY_TARGET"
  # reload 遇到语法错误会保留旧配置继续服务，所以这里失败可以安全回滚。
  if ! sudo systemctl reload caddy; then
    echo "caddy reload failed; restoring $backup" >&2
    sudo cp -a "$backup" "$CADDY_TARGET"
    sudo systemctl reload caddy || true
    exit 1
  fi
  echo "caddy reloaded (backup: $backup)"
fi
