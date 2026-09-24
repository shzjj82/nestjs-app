#!/usr/bin/env bash
set -euo pipefail

# 默认先用 Docker 拉起 postgres / redis / mosquitto，再用 PM2 跑业务进程。
# 用法：
#   ./scripts/pm2-start.sh              # 启动全部（gateway + usercenter x3 + order + docs）
#   ./scripts/pm2-start.sh gateway      # 只启动网关
#   ./scripts/pm2-start.sh apps         # 只启动 usercenter + order + docs
#   SKIP_INFRA=1 ./scripts/pm2-start.sh # 跳过 Docker，使用本机已有数据库
# 环境变量：
#   MQTT_URL=mqtt://127.0.0.1:1883
#   DATABASE_URL=postgres://nestjs:nestjs@127.0.0.1:5432/nestjs
#   REDIS_URL=redis://127.0.0.1:6379
#   PORT=3000
#   USERCENTER_REPLICAS=3

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SCOPE="${1:-all}"
MQTT_URL="${MQTT_URL:-mqtt://127.0.0.1:1883}"
DATABASE_URL="${DATABASE_URL:-postgres://nestjs:nestjs@127.0.0.1:5432/nestjs}"
REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6379}"
PORT="${PORT:-3000}"
USERCENTER_REPLICAS="${USERCENTER_REPLICAS:-3}"
export MQTT_URL DATABASE_URL REDIS_URL PORT USERCENTER_REPLICAS

if [[ "${SKIP_INFRA:-0}" != "1" ]]; then
  if ! command -v docker >/dev/null 2>&1; then
    echo "未找到 docker。若数据库已在本机运行，使用 SKIP_INFRA=1 $0" >&2
    exit 1
  fi
  echo "启动 Docker 依赖：postgres / redis / mosquitto"
  docker compose up -d postgres redis mosquitto
  docker compose up --wait postgres redis mosquitto
fi

if ! command -v node >/dev/null 2>&1; then
  echo "未找到 node，请先安装 Node.js 18+" >&2
  exit 1
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "未找到 pm2，正在全局安装..."
  npm install -g pm2
fi

need_build=0
if [[ ! -f dist/apps/gateway/main.js ]]; then
  need_build=1
fi

if [[ ! -d node_modules ]]; then
  echo "安装依赖..."
  if [[ "${need_build}" -eq 1 ]]; then
    npm ci
  else
    npm ci --omit=dev
  fi
fi

if [[ "${need_build}" -eq 1 ]]; then
  echo "编译应用..."
  npx nest build gateway
  if [[ "${SCOPE}" != "gateway" ]]; then
    npx nest build usercenter
    npx nest build order
    npx nest build docs
  fi
fi

case "${SCOPE}" in
  all)
    pm2 start ecosystem.config.cjs
    ;;
  gateway)
    pm2 start ecosystem.config.cjs --only gateway
    ;;
  apps)
    only="$(node -e "
      const n = Number(process.env.USERCENTER_REPLICAS || 3);
      const list = Array.from({ length: n }, (_, i) => 'usercenter-' + (i + 1));
      list.push('order', 'docs');
      process.stdout.write(list.join(','));
    ")"
    pm2 start ecosystem.config.cjs --only "${only}"
    ;;
  *)
    echo "未知范围: ${SCOPE}（all | gateway | apps）" >&2
    exit 1
    ;;
esac

pm2 save
echo
pm2 status
echo
echo "MQTT_URL=${MQTT_URL}"
echo "DATABASE_URL=${DATABASE_URL}"
echo "REDIS_URL=${REDIS_URL}"
echo "网关: http://127.0.0.1:${PORT}"
echo "查看日志: npm run pm2:logs"
echo "开机自启: pm2 startup && pm2 save"
