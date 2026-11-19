#!/usr/bin/env bash
# 给这台机器挂一个真实域名，让 Caddy 自动签 HTTPS 证书。
#
# 什么时候用：域名已经解析到这台机器的公网 IP，想从 http://<裸 IP> 换成 https://<域名>。
#
# 为什么要有脚本：手改 /etc/caddy/Caddyfile 有三件事很容易漏——
#   1) 域名还没解析过来就 reload，Caddy 会一直去 ACME 申请证书，失败重试可能撞上
#      Let's Encrypt 的失败次数限制（同一个域名每小时 5 次）；
#   2) 改坏了没有备份，80 端口一起挂；
#   3) 忘了加 encode（这条链路上不压缩等于打不开，见 DEVLOG 二十八）。
#
# 用法：
#   sudo bash scripts/enable-tls-domain.sh roselet.example.com
#   sudo bash scripts/enable-tls-domain.sh roselet.example.com --expect-ip 1.2.3.4
#   bash scripts/enable-tls-domain.sh roselet.example.com --dry-run
set -euo pipefail

DOMAIN="${1:-}"
if [[ "$DOMAIN" == "-h" || "$DOMAIN" == "--help" ]]; then
  sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
fi
shift || true
EXPECT_IP=""
DRY_RUN=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --expect-ip) EXPECT_IP="${2:-}"; shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    *) echo "未知参数: $1" >&2; exit 2 ;;
  esac
done

CADDY_TARGET="${CADDY_TARGET:-/etc/caddy/Caddyfile}"
RESOLVERS=("223.5.5.5" "119.29.29.29")

if [[ -z "$DOMAIN" ]]; then
  echo "用法: sudo bash scripts/enable-tls-domain.sh <域名> [--expect-ip <公网IP>] [--dry-run]" >&2
  exit 2
fi

if [[ "$DRY_RUN" == false && $EUID -ne 0 ]]; then
  echo "需要 root（要改 $CADDY_TARGET 并 reload caddy），请用 sudo 重跑。" >&2
  exit 1
fi

if ! [[ "$DOMAIN" =~ ^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$ ]]; then
  echo "域名格式不对: $DOMAIN" >&2
  exit 2
fi

resolved_ip() {
  # 只认 A 记录；两台国内公共 DNS 都解析到同一个 IP 才算「国内可用」。
  local resolver="$1"
  if command -v dig >/dev/null 2>&1; then
    dig +short A "$DOMAIN" "@$resolver" 2>/dev/null | tail -1
  else
    # 没有 dig 时退化成 nslookup（Lightsail 的 Ubuntu 镜像默认没装 dnsutils）。
    nslookup -type=A "$DOMAIN" "$resolver" 2>/dev/null | awk '/^Address: /{print $2}' | tail -1
  fi
}

echo "== 1/4 解析检查 =="
SEEN=()
for resolver in "${RESOLVERS[@]}"; do
  ip="$(resolved_ip "$resolver" || true)"
  echo "  @$resolver -> ${ip:-（无结果）}"
  SEEN+=("$ip")
done

if [[ -z "${SEEN[0]}" || -z "${SEEN[1]}" ]]; then
  echo "解析不到。先把 $DOMAIN 的 A 记录指到这台机器，等 DNS 生效再跑一次。" >&2
  exit 1
fi
if [[ "${SEEN[0]}" != "${SEEN[1]}" ]]; then
  echo "两台国内 DNS 返回了不同 IP（${SEEN[0]} / ${SEEN[1]}），这是被污染或还没收敛，先别签证书。" >&2
  exit 1
fi

TARGET_IP="${EXPECT_IP:-$(curl -4 -fsS --max-time 10 https://api.ipify.org || true)}"
if [[ -z "$TARGET_IP" ]]; then
  echo "拿不到本机公网 IP，请加 --expect-ip <公网IP>。" >&2
  exit 1
fi
if [[ "${SEEN[0]}" != "$TARGET_IP" ]]; then
  echo "$DOMAIN 解析到 ${SEEN[0]}，但这台机器是 $TARGET_IP。证书签不下来，先改解析。" >&2
  exit 1
fi
echo "  OK：两台 DNS 一致，且指向本机 $TARGET_IP"

BLOCK="$DOMAIN {
	# 这条链路上不压缩等于打不开（DEVLOG 二十八）。
	encode zstd gzip
	import roselet_routes
}"

echo "== 2/4 生成配置 =="
echo "$BLOCK"

if [[ "$DRY_RUN" == true ]]; then
  echo "== dry-run：没有改动任何文件 =="
  exit 0
fi

if grep -qF "$DOMAIN {" "$CADDY_TARGET" 2>/dev/null; then
  echo "== $CADDY_TARGET 里已经有 $DOMAIN，不重复添加 =="
else
  echo "== 3/4 写入并校验 =="
  BACKUP="$CADDY_TARGET.bak-$(date +%Y%m%d-%H%M%S)"
  cp -a "$CADDY_TARGET" "$BACKUP"
  printf '\n%s\n' "$BLOCK" >> "$CADDY_TARGET"
  if ! caddy validate --config "$CADDY_TARGET" --adapter caddyfile >/tmp/roselet-caddy-validate.log 2>&1; then
    echo "配置校验失败，已回滚：" >&2
    tail -5 /tmp/roselet-caddy-validate.log >&2
    cp -a "$BACKUP" "$CADDY_TARGET"
    exit 1
  fi
  if ! systemctl reload caddy; then
    echo "caddy reload 失败，已回滚。" >&2
    cp -a "$BACKUP" "$CADDY_TARGET"
    systemctl reload caddy || true
    exit 1
  fi
  echo "  已 reload（备份：$BACKUP）"
fi

echo "== 4/4 等证书并验收 =="
for _ in {1..30}; do
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 "https://$DOMAIN/" || true)"
  if [[ "$code" == "200" ]]; then
    echo "  OK：https://$DOMAIN/ -> 200"
    echo "证书签发成功。别忘了把试用入口改成 https://$DOMAIN"
    exit 0
  fi
  sleep 2
done

echo "https://$DOMAIN/ 还没有返回 200。看 'journalctl -u caddy -n 50' 里 ACME 的报错，" >&2
echo "常见原因：80 端口没放行（HTTP-01 挑战过不去），或域名解析还没生效。" >&2
exit 1
