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
#   bash scripts/enable-tls-domain.sh roselet.example.com --dry-run   # 演练，不动任何文件
#   sudo bash scripts/enable-tls-domain.sh roselet.example.com
#   sudo bash scripts/enable-tls-domain.sh roselet.example.com --expect-ip 1.2.3.4
#
# --dry-run 会走完除「写文件 + reload + 等证书」之外的全部步骤：照样拼出新的配置、
# 把它放进临时副本、真的调用一次 `caddy validate`。**换域名这件事只会在 DNS 生效那一刻
# 做一次，没有第二次机会试错**，所以这条命令必须能被演练。
set -euo pipefail

DOMAIN="${1:-}"
if [[ "$DOMAIN" == "-h" || "$DOMAIN" == "--help" ]]; then
  sed -n '2,23p' "$0" | sed 's/^# \{0,1\}//'
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

if [[ ! -r "$CADDY_TARGET" ]]; then
  echo "读不到 $CADDY_TARGET，先确认 caddy 装在这台机器上。" >&2
  exit 1
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

DNS_OK=true
echo "== 1/4 解析检查 =="
SEEN=()
for resolver in "${RESOLVERS[@]}"; do
  ip="$(resolved_ip "$resolver" || true)"
  echo "  @$resolver -> ${ip:-（无结果）}"
  SEEN+=("$ip")
done

if [[ -z "${SEEN[0]}" || -z "${SEEN[1]}" ]]; then
  DNS_OK=false
  echo "  解析不到：$DOMAIN 还没有 A 记录（或者还没生效）。" >&2
elif [[ "${SEEN[0]}" != "${SEEN[1]}" ]]; then
  DNS_OK=false
  echo "  两台国内 DNS 返回了不同 IP（${SEEN[0]} / ${SEEN[1]}），这是被污染或还没收敛。" >&2
else
  TARGET_IP="${EXPECT_IP:-$(curl -4 -fsS --max-time 10 https://api.ipify.org || true)}"
  if [[ -z "$TARGET_IP" ]]; then
    DNS_OK=false
    echo "  拿不到本机公网 IP，请加 --expect-ip <公网IP>。" >&2
  elif [[ "${SEEN[0]}" != "$TARGET_IP" ]]; then
    DNS_OK=false
    echo "  $DOMAIN 解析到 ${SEEN[0]}，但这台机器是 $TARGET_IP。" >&2
  else
    echo "  OK：两台 DNS 一致，且指向本机 $TARGET_IP"
  fi
fi

if [[ "$DNS_OK" == false ]]; then
  if [[ "$DRY_RUN" == false ]]; then
    echo "解析没过，先别签证书（失败重试会撞 Let's Encrypt 每小时 5 次的上限）。" >&2
    exit 1
  fi
  # 演练时不中断：DNS 没配好正是最需要演练的时刻，而演练不改任何东西。
  echo "  （dry-run：跳过解析这一步，继续演练配置生成与校验）"
fi

BLOCK="$DOMAIN {
	# 这条链路上不压缩等于打不开（DEVLOG 二十八）。
	encode zstd gzip
	import roselet_routes
}"

echo "== 2/4 生成配置 =="
# 必须按「整行、行首」匹配，不能用 `grep -F "$DOMAIN {"`：
# 子串匹配会把 `roselet.47.131.238.0.sslip.io {` 当成 `47.131.238.0.sslip.io {` 已存在，
# 于是**静默跳过写入**，最后在等证书那一步以「https 还没 200」收场，看起来像 DNS 的锅。
# （2026-11-21 在临时副本上实测踩到。）
DOMAIN_RE="${DOMAIN//./\\.}"
if grep -qE "^[[:space:]]*${DOMAIN_RE}[[:space:]]*\{" "$CADDY_TARGET"; then
  echo "  $CADDY_TARGET 里已经有 $DOMAIN，不重复添加。"
  ALREADY=true
else
  ALREADY=false
  echo "$BLOCK"
fi

# 关键顺序：**先校验候选文件，通过了才碰线上文件**。
# 校验失败时生产配置一个字节都没动过，也就不需要「回滚」这种容易出错的动作。
#
# 所有临时文件都走 mktemp：写死 /tmp/roselet-*.log 会踩一个很恶心的坑——
# 上一次用普通用户演练留下一个 644 的文件，这次用 sudo 就写不进去，
# 而重定向失败的表现是「命令失败」，于是报出来的是「配置校验失败」（2026-11-21 实测踩到）。
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT
CANDIDATE="$WORKDIR/Caddyfile.candidate"
VALIDATE_LOG="$WORKDIR/validate.log"
PAGE_FILE="$WORKDIR/page.html"
if [[ "$ALREADY" == true ]]; then
  cp -a "$CADDY_TARGET" "$CANDIDATE"
else
  cat "$CADDY_TARGET" >"$CANDIDATE"
  printf '\n%s\n' "$BLOCK" >>"$CANDIDATE"
fi

echo "== 3/4 校验候选配置 =="
if ! caddy validate --config "$CANDIDATE" --adapter caddyfile >"$VALIDATE_LOG" 2>&1; then
  echo "  候选配置校验失败（线上文件未被改动）：" >&2
  tail -8 "$VALIDATE_LOG" >&2
  exit 1
fi
echo "  OK：caddy validate 通过"

if [[ "$DRY_RUN" == true ]]; then
  echo "== dry-run：演练通过，没有改动任何文件，也没有 reload =="
  exit 0
fi

if [[ "$ALREADY" == false ]]; then
  BACKUP="$CADDY_TARGET.bak-$(date +%Y%m%d-%H%M%S)"
  cp -a "$CADDY_TARGET" "$BACKUP"
  cat "$CANDIDATE" >"$CADDY_TARGET"
  if ! systemctl reload caddy; then
    echo "caddy reload 失败，已回滚到 $BACKUP。" >&2
    cp -a "$BACKUP" "$CADDY_TARGET"
    systemctl reload caddy || true
    exit 1
  fi
  echo "  已写入并 reload（备份：$BACKUP）"
fi

echo "== 4/4 等证书并验收 =="
# 单个 200 不够：证书签下来了但上游指错（比如 handle 顺序被打乱），
# 页面照样 200，注册照样点不动。页面和 /health 都要对，才算换域名成功。
for _ in {1..30}; do
  page="$(curl -s -o "$PAGE_FILE" -w '%{http_code}' --max-time 8 "https://$DOMAIN/" || true)"
  health="$(curl -s --max-time 8 "https://$DOMAIN/health" || true)"
  title="$(grep -o '<title>[^<]*</title>' "$PAGE_FILE" 2>/dev/null | head -1 || true)"
  if [[ "$page" == "200" && "$health" == *'"status":"ok"'* && "$title" == *Roselet* ]]; then
    echo "  OK：https://$DOMAIN/ -> 200（$title）"
    echo "  OK：https://$DOMAIN/health -> $health"
    echo "证书签发成功。把入口改成 https://$DOMAIN，并同步 README / PROGRESS / DEPLOYMENT。"
    exit 0
  fi
  sleep 2
done

echo "https://$DOMAIN/ 还没通过验收（page=$page health=$health title=$title）" >&2
echo "看 'journalctl -u caddy -n 50' 里 ACME 的报错。" >&2
echo "常见原因：80 端口没放行（HTTP-01 挑战过不去），或域名解析还没生效。" >&2
exit 1
