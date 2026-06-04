#!/usr/bin/env bash
# 从环境变量 TARO_APP_ID 生成 project.config.json
# 用法: TARO_APP_ID=wx4408068e26478673 bash scripts/init-miniprogram.sh

set -euo pipefail

APP_ID="${TARO_APP_ID:-}"
TEMPLATE="apps/miniprogram/project.config.template.json"
OUTPUT="apps/miniprogram/project.config.json"

if [ -z "$APP_ID" ]; then
  echo "错误: 请设置 TARO_APP_ID 环境变量"
  echo "用法: TARO_APP_ID=wxAppID bash scripts/init-miniprogram.sh"
  exit 1
fi

sed "s/YOUR_APPID_HERE/${APP_ID}/" "$TEMPLATE" > "$OUTPUT"
echo "project.config.json 已生成 (AppID: ${APP_ID})"
