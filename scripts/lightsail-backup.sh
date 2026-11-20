#!/usr/bin/env bash
#
# 每天给 Roselet 的 Postgres 留一份可恢复的备份。
#
#   ./lightsail-backup.sh                    # 备份 + 清理过期 + 校验 dump 完整性
#   VERIFY_RESTORE=1 ./lightsail-backup.sh   # 额外做一次「真的恢复到一个临时库」
#
# 为什么要自定义格式（-Fc）而不是纯 SQL：自带压缩、能 `pg_restore --list` 校验
# 目录是否完整，还能只恢复某张表。8MB 的库压完不到 1MB。
#
# 只在本机留档。没有对象存储凭证，所以「机器挂了备份一起没」这层风险仍在，
# 见 DEVLOG 三十一续的遗留说明。
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-$HOME/roselet-backups}"
CONTAINER="${CONTAINER:-roselet-db-1}"
DB_USER="${DB_USER:-roselet}"
DB_NAME="${DB_NAME:-roselet}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
VERIFY_RESTORE="${VERIFY_RESTORE:-0}"

stamp="$(date -u +%Y%m%d-%H%M%S)"
target="$BACKUP_DIR/roselet-$stamp.dump"
tmp="$target.part"
log="$BACKUP_DIR/backup.log"

log_line() {
  # 备份日志本身也要留在备份目录里，出问题能回溯。
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" | tee -a "$log"
}

fail() {
  log_line "FAILED: $*"
  # 失败时删掉半截文件：一个 0 字节的 .dump 比没有备份更危险，容易让人以为有。
  rm -f "$tmp"
  exit 1
}

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

# 1. 导出。先写 .part 再改名，避免「备份进行到一半被读到」。
docker exec "$CONTAINER" pg_dump -U "$DB_USER" -Fc "$DB_NAME" > "$tmp" \
  || fail "pg_dump 退出码非 0"
size=$(stat -c %s "$tmp" 2>/dev/null || echo 0)
[ "$size" -gt 1024 ] || fail "dump 只有 $size 字节，明显不对"
mv "$tmp" "$target"
chmod 600 "$target"
log_line "OK dump=$target size=$size"

# 2. 校验：能读出目录说明文件头和压缩流都是好的。
docker exec -i "$CONTAINER" pg_restore --list < "$target" > /dev/null \
  || fail "pg_restore --list 读不了这份 dump"
log_line "OK verified dump readable"

# 3. 过期清理。
removed=$(find "$BACKUP_DIR" -maxdepth 1 -name 'roselet-*.dump' -type f -mtime "+$RETENTION_DAYS" -print -delete | wc -l)
log_line "OK retention=${RETENTION_DAYS}d removed=$removed"

# 4. 可选的恢复演练：真的建一个临时库、灌进去、数一下花再删掉。
#    只校验 dump 能读，不等于能恢复；这一步才回答「真出事能不能用」。
if [ "$VERIFY_RESTORE" = "1" ]; then
  scratch="roselet_restore_check_${stamp//-/_}"
  docker exec "$CONTAINER" createdb -U "$DB_USER" "$scratch" || fail "建临时库失败"
  # shellcheck disable=SC2064  # 这里就是要立刻展开 $scratch
  trap "docker exec '$CONTAINER' dropdb -U '$DB_USER' --if-exists '$scratch' >/dev/null 2>&1 || true" EXIT
  docker exec -i "$CONTAINER" pg_restore -U "$DB_USER" -d "$scratch" --no-owner < "$target" \
    || fail "恢复到临时库失败"
  roses=$(docker exec "$CONTAINER" psql -U "$DB_USER" -d "$scratch" -tAc 'SELECT count(*) FROM roses')
  users=$(docker exec "$CONTAINER" psql -U "$DB_USER" -d "$scratch" -tAc 'SELECT count(*) FROM users')
  log_line "OK restore drill scratch=$scratch roses=$roses users=$users"
fi

log_line "DONE $target"
