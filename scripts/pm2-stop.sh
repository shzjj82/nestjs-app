#!/usr/bin/env bash
set -euo pipefail

# 用法：
#   ./scripts/pm2-stop.sh           # 停掉本仓库相关进程
#   ./scripts/pm2-stop.sh all       # 停掉当前用户全部 PM2 进程

SCOPE="${1:-repo}"

if ! command -v pm2 >/dev/null 2>&1; then
  echo "未找到 pm2" >&2
  exit 1
fi

if [[ "${SCOPE}" == "all" ]]; then
  pm2 delete all || true
else
  pm2 delete gateway order upload wechat docs agents || true
  pm2 delete /usercenter-/ || true
  pm2 delete /docs-/ || true
  pm2 delete /agents-/ || true
fi

pm2 save || true
pm2 status
