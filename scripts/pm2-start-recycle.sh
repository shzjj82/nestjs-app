#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# recycle 最小部署：一条命令拉起「回收业务」所需的全部服务并完成开通。
#
#   ./scripts/pm2-start-recycle.sh
#
# 与 scripts/pm2-start.sh 的区别 —— 只跑 5 个服务：
#   gateway / usercenter / upload / wechat / recycle
# 不跑 order（回收订单在 recycle 自己的库）、docs、agents。
# 因此编译时间约为全量的一半，内存占用也小得多。
#
# 流程：加载环境变量 → 检查基础设施 → 装依赖 → 只编译这 5 个服务
#       → pm2 拉起 → 执行开通脚本（登记业务/角色/小程序）→ 健康检查
#
# 环境变量见 .env.recycle.example（默认读取 .env.recycle）
# 可选：
#   SKIP_INFRA=1          基础设施已就绪，跳过连通性检查
#   SKIP_BOOTSTRAP=1      只起服务，不跑开通脚本
#   SKIP_BUILD=1          dist 已是最新，跳过编译
# ============================================================================

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${ENV_FILE:-.env.recycle}"

if [[ -f "$ENV_FILE" ]]; then
  echo "加载环境变量: $ENV_FILE"
  set -a
  # shellcheck disable=SC1090
  . "./$ENV_FILE"
  set +a
else
  echo "未找到 $ENV_FILE，将使用环境变量与默认值" >&2
  echo "  提示: cp .env.recycle.example .env.recycle" >&2
fi

MQTT_URL="${MQTT_URL:-mqtt://127.0.0.1:1883}"
DATABASE_URL="${DATABASE_URL:-postgres://nestjs:nestjs@127.0.0.1:5432/nestjs}"
REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6379}"
PORT="${PORT:-3000}"
USERCENTER_REPLICAS="${USERCENTER_REPLICAS:-1}"
export MQTT_URL DATABASE_URL REDIS_URL PORT USERCENTER_REPLICAS

# 最小部署需要的服务集合
SERVICES=(gateway usercenter upload wechat recycle)

if [[ "${SKIP_INFRA:-0}" != "1" ]]; then
  echo
  echo "=== 检查基础设施 ==="
  # 用 node 探端口而不是 bash 的 /dev/tcp —— 后者在 macOS 自带的 bash 3.2 上不可用，
  # 会让脚本没法在本地先验证一遍。
  if node -e '
    const net = require("net");
    const targets = [
      ["PostgreSQL", process.env.DATABASE_URL, 5432],
      ["Redis", process.env.REDIS_URL, 6379],
      ["Mosquitto", process.env.MQTT_URL, 1883],
    ];
    const probe = ([name, url, fallbackPort]) => {
      let host = "127.0.0.1";
      let port = fallbackPort;
      try {
        const parsed = new URL(url);
        host = parsed.hostname || host;
        port = Number(parsed.port) || fallbackPort;
      } catch {}
      return new Promise((resolve) => {
        const socket = new net.Socket();
        const done = (ok) => { socket.destroy(); resolve({ name, host, port, ok }); };
        socket.setTimeout(2500);
        socket.once("connect", () => done(true));
        socket.once("timeout", () => done(false));
        socket.once("error", () => done(false));
        socket.connect(port, host);
      });
    };
    Promise.all(targets.map(probe)).then((results) => {
      let failed = false;
      for (const item of results) {
        console.log(`  ${item.ok ? "OK  " : "MISS"} ${item.name} (${item.host}:${item.port})`);
        if (!item.ok) failed = true;
      }
      process.exit(failed ? 1 : 0);
    });
  '; then
    echo "  基础设施就绪"
  else
    echo
    echo "基础设施未就绪。参考 docker-compose.yml 启动 postgres / redis / mosquitto，" >&2
    echo "确认后加 SKIP_INFRA=1 跳过本检查。" >&2
    exit 1
  fi
fi

if ! command -v node >/dev/null 2>&1; then
  echo "未找到 node，请先安装 Node.js 18+" >&2
  exit 1
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "未找到 pm2，正在全局安装..."
  npm install -g pm2
fi

echo
echo "=== 依赖 ==="
if [[ ! -d node_modules ]]; then
  npm ci
elif [[ "${SKIP_INSTALL:-0}" != "1" ]]; then
  # 增量安装：不要在这里用 npm ci —— 它会清空 node_modules，
  # 正在跑的服务会因为找不到依赖而立刻崩掉。
  npm install
fi

if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
  echo
  echo "=== 编译 ${#SERVICES[@]} 个服务（最小集，非全量 8 个）==="
  for service in "${SERVICES[@]}"; do
    printf '  building %s ...' "$service"
    if npx nest build "$service" >/dev/null 2>&1; then
      echo ' done'
    else
      echo ' FAILED'
      npx nest build "$service"
      exit 1
    fi
  done
fi

for service in "${SERVICES[@]}"; do
  if [[ ! -f "dist/apps/$service/main.js" ]]; then
    echo "缺少产物 dist/apps/$service/main.js，请检查编译" >&2
    exit 1
  fi
done

echo
echo "=== 拉起服务 ==="
pm2 delete all >/dev/null 2>&1 || true
pm2 start ecosystem.recycle.cjs
pm2 save

echo
echo "等待服务接入 MQTT ..."
sleep 12

if [[ "${SKIP_BOOTSTRAP:-0}" != "1" ]]; then
  echo
  echo "=== 开通回收业务（登记业务 / 角色 / 小程序）==="
  npx ts-node -T -r tsconfig-paths/register scripts/recycle-bootstrap.ts || {
    echo
    echo "开通未完成（服务可能还没就绪）。稍后手动重跑：" >&2
    echo "  npx ts-node -T -r tsconfig-paths/register scripts/recycle-bootstrap.ts" >&2
  }
fi

echo
echo "=== 健康检查 ==="
health=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 "http://127.0.0.1:${PORT}/health" || echo "000")
echo "  GET /health -> HTTP $health"

echo
pm2 status
echo
echo "MQTT_URL=${MQTT_URL}"
echo "网关: http://127.0.0.1:${PORT}"
echo "查看日志: pm2 logs"
echo "重新开通: npx ts-node -T -r tsconfig-paths/register scripts/recycle-bootstrap.ts"
