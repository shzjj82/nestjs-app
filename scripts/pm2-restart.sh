#!/usr/bin/env bash
set -euo pipefail

# 用法：
#   ./scripts/pm2-restart.sh
#   MQTT_URL=mqtt://x.x.x.x:1883 ./scripts/pm2-restart.sh gateway

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SCOPE="${1:-all}"

if ! command -v pm2 >/dev/null 2>&1; then
  echo "未找到 pm2" >&2
  exit 1
fi

npx nest build gateway
if [[ "${SCOPE}" != "gateway" ]]; then
  npx nest build usercenter
  npx nest build order
fi

if pm2 describe gateway >/dev/null 2>&1; then
  case "${SCOPE}" in
    gateway) pm2 restart gateway ;;
    apps)
      pm2 restart /usercenter-/ || true
      pm2 restart order || true
      ;;
    *) pm2 restart all ;;
  esac
else
  exec "$ROOT/scripts/pm2-start.sh" "${SCOPE}"
fi

pm2 status
