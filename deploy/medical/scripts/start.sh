#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# medical 最小部署：一条命令拉起「中医诊所」所需的全部服务并完成开通。
#
#   ./deploy/medical/scripts/start.sh
#   ./deploy/medical/scripts/start.sh --force     # 即使环境已一致也重建
#
# 与根目录 scripts/pm2/start.sh 的区别 —— 只跑 4 个服务：
#   gateway / usercenter / upload / medical
# 不跑 order、docs、wechat、agents、recycle。
#
# 流程：加载环境变量 → 检查基础设施 → 按 env 里的库名确保 database 存在（没有就建）
#       → 若运行中进程已 online 且环境一致则跳过编译/拉起，但仍跑开通脚本
#       → 否则：装依赖 → 编译 → pm2 拉起 → 开通 → 健康检查
#
# 环境变量见 deploy/medical/.env.example（默认读取场景根目录 .env）
# 可选：
#   SKIP_INFRA=1          基础设施已就绪，跳过连通性检查
#   SKIP_BOOTSTRAP=1      只起服务，不跑开通脚本
#   SKIP_BUILD=1          dist 已是最新，跳过编译
#   FORCE=1 / --force     忽略「环境已一致」检测，强制重建
# ============================================================================

# shellcheck source=_common.sh
. "$(cd "$(dirname "$0")" && pwd)/_common.sh"

FORCE="${FORCE:-0}"
for arg in "$@"; do
  case "$arg" in
    --force|-f) FORCE=1 ;;
    -h|--help) sed -n '2,28p' "$0"; exit 0 ;;
    -*) echo "未知参数: $arg" >&2; exit 1 ;;
  esac
done

if [[ -f "$ENV_FILE" ]]; then
  echo "加载环境变量: $ENV_FILE"
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
else
  echo "未找到 $ENV_FILE，将使用环境变量与默认值" >&2
  echo "  提示: cp deploy/medical/.env.example deploy/medical/.env" >&2
fi

MQTT_URL="${MQTT_URL:-mqtt://127.0.0.1:1883}"
USERCENTER_DATABASE_URL="${USERCENTER_DATABASE_URL:-${DATABASE_URL:-postgres://nestjs:nestjs@127.0.0.1:5432/nestjs}}"
DATABASE_URL="$USERCENTER_DATABASE_URL"
REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6379}"
PORT="${PORT:-3000}"

if [[ -z "${MEDICAL_DATABASE_URL:-}" ]]; then
  echo "缺少 MEDICAL_DATABASE_URL，请在 $ENV_FILE 里写全两个库" >&2
  exit 1
fi

db_name() {
  node -e 'console.log(decodeURIComponent(new URL(process.argv[1]).pathname.replace(/^\//,"")))' "$1"
}
USERCENTER_DB="$(db_name "$USERCENTER_DATABASE_URL")"
MEDICAL_DB="$(db_name "$MEDICAL_DATABASE_URL")"

export MQTT_URL DATABASE_URL USERCENTER_DATABASE_URL REDIS_URL PORT
export MEDICAL_DATABASE_URL

SERVICES=(gateway usercenter upload medical)
PM2_APPS=("${SERVICES[@]}")

if [[ "${SKIP_INFRA:-0}" != "1" ]]; then
  echo
  echo "=== 检查基础设施 ==="
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
    echo "基础设施未就绪。参考 deploy/medical/docker-compose.yml 启动 postgres / redis / mosquitto，" >&2
    echo "确认后加 SKIP_INFRA=1 跳过本检查。" >&2
    exit 1
  fi
fi

echo
echo "=== 准备数据库（按环境变量，缺则新建）==="
echo "  usercenter -> $USERCENTER_DB"
echo "  medical    -> $MEDICAL_DB"
node "$DB_TOOL" ensure --admin "$USERCENTER_DATABASE_URL" --dbs "$USERCENTER_DB,$MEDICAL_DB"

if ! command -v node >/dev/null 2>&1; then
  echo "未找到 node，请先安装 Node.js 18+" >&2
  exit 1
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "未找到 pm2，正在全局安装..."
  npm install -g pm2
fi

SKIP_LAUNCH=0
if [[ "$FORCE" != "1" ]]; then
  echo
  echo "=== 检测运行中的环境 ==="
  if pm2 jlist 2>/dev/null | node -e '
    const wanted = process.argv.slice(2);
    const expected = {
      MQTT_URL: process.env.MQTT_URL || "",
      DATABASE_URL: process.env.DATABASE_URL || "",
      REDIS_URL: process.env.REDIS_URL || "",
      PORT: process.env.PORT || "",
      MEDICAL_DATABASE_URL: process.env.MEDICAL_DATABASE_URL || "",
      AUTH_SECRET: process.env.AUTH_SECRET || "tcm-dev-auth-secret-change-me",
      UPLOAD_API_KEY: process.env.UPLOAD_API_KEY || "dev-upload-key",
    };
    let apps;
    try {
      apps = JSON.parse(require("fs").readFileSync(0, "utf8") || "[]");
    } catch {
      process.exit(1);
    }
    if (!Array.isArray(apps) || !apps.length) process.exit(1);
    const byName = new Map(apps.map((a) => [a.name, a]));
    const diffs = [];
    for (const name of wanted) {
      const app = byName.get(name);
      if (!app) {
        diffs.push("缺进程 " + name);
        continue;
      }
      const status = app.pm2_env && app.pm2_env.status;
      if (status !== "online") {
        diffs.push(name + " 状态 " + status);
        continue;
      }
      const env = (app.pm2_env && app.pm2_env.env) || {};
      for (const [key, want] of Object.entries(expected)) {
        if (env[key] === undefined) continue;
        if (String(env[key]) !== String(want)) {
          diffs.push(name + "." + key + " 与 " + key + " 不一致");
        }
      }
    }
    if (diffs.length) {
      for (const line of diffs) console.log("  " + line);
      process.exit(1);
    }
  ' "${PM2_APPS[@]}"; then
    echo "  进程已 online，环境与 $ENV_FILE 一致，跳过编译与拉起"
    SKIP_LAUNCH=1
  else
    echo "  需要启动（进程缺失、未 online，或环境与 $ENV_FILE 不一致）"
  fi
fi

if [[ "$SKIP_LAUNCH" != "1" ]]; then
echo
echo "=== 依赖 ==="
if [[ ! -d node_modules ]]; then
  npm ci
elif [[ "${SKIP_INSTALL:-0}" != "1" ]]; then
  npm install
fi

if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
  echo
  echo "=== 编译 ${#SERVICES[@]} 个服务（最小集）==="
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
for service in "${PM2_APPS[@]}"; do
  pm2 delete "$service" >/dev/null 2>&1 || true
done
pm2 delete /usercenter-/ >/dev/null 2>&1 || true
pm2 start "$ECOSYSTEM"
pm2 save

echo
echo "等待服务接入 MQTT ..."
sleep 12
fi

if [[ "${SKIP_BOOTSTRAP:-0}" != "1" ]]; then
  echo
  echo "=== 开通中医业务（登记业务 / 角色 / Web 接入端）==="
  if ! npx ts-node -T -r tsconfig-paths/register "$BOOTSTRAP"; then
    echo
    echo "开通失败。确认 MQTT 与 usercenter 已起来后重跑：" >&2
    echo "  npm run medical:bootstrap" >&2
    exit 1
  fi
fi

echo
echo "=== 健康检查 ==="
node -e '
const http = require("http");
const port = Number(process.argv[1]);
const paths = ["/medical/health", "/upload/health"];
const get = (p) => new Promise((res) => {
  const req = http.get({ host: "127.0.0.1", port, path: p, timeout: 8000 }, (r) => {
    let d = ""; r.on("data", (c) => (d += c)); r.on("end", () => res(r.statusCode));
  });
  req.on("error", () => res("ERR"));
  req.on("timeout", () => { req.destroy(); res("TIMEOUT"); });
});
(async () => {
  for (const p of paths) console.log("  " + p.padEnd(18) + "-> HTTP " + (await get(p)));
})();
' "$PORT"

echo
pm2 status
echo
echo "MQTT_URL=${MQTT_URL}"
echo "网关: http://127.0.0.1:${PORT}"
echo "诊所登录: POST /medical/auth/login  （Header X-Biz-Code: medical）"
echo "查看日志: pm2 logs"
echo "重新开通: npm run medical:bootstrap"
