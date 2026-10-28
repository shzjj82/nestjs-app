#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# 重新加载环境变量并重启回收服务。
#
#   ./scripts/recycle/reload.sh            # 重载全部 5 个服务
#   ./scripts/recycle/reload.sh wechat     # 只重载 wechat
#
# 为什么不能只改文件就生效？
#   PM2 在「启动进程的那一刻」把当时的环境变量快照进进程，之后进程内的
#   process.env 就不再随外部文件变化。所以改完 .env.recycle 必须重建进程。
#
# 为什么用 delete + start 而不是 restart --update-env？
#   --update-env 依赖 PM2 daemon 自己的环境，而 daemon 往往是上一次
#   （可能是几小时前、甚至改配置之前）启动的，拿到的仍是旧值，
#   实践中经常出现"看起来重启了，变量还是旧的"。
#   delete + start 会重新从当前 shell 捕获环境变量，行为确定。
#
# 变量优先级（从高到低）：
#   1. 本脚本 export 的 .env.recycle          <- 改这个值这里
#   2. PM2 配置 ecosystem.recycle.config.cjs 里写死的 env
#   3. 应用启动时 dotenv 加载的项目根 .env    <- 注意它也存在，但不会覆盖上面两项
# ============================================================================

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

# pm2 进程清单放项目专用目录：一是避免和其它项目的进程混在一起，
# 二是 ~/.pm2 历史上被 sudo 跑过、属主变成 root 后当前用户写不进去。
# 想用回默认目录就自己 export PM2_HOME=~/.pm2
export PM2_HOME="${PM2_HOME:-$HOME/.pm2-nestjs}"

ENV_FILE="${ENV_FILE:-.env.recycle}"

if [[ -f "$ENV_FILE" ]]; then
  echo "加载环境变量: $ENV_FILE"
  set -a
  # shellcheck disable=SC1090
  . "./$ENV_FILE"
  set +a
else
  echo "未找到 $ENV_FILE，将只使用当前 shell 的环境变量" >&2
fi

# 文件里写 USERCENTER_DATABASE_URL；usercenter 进程读的仍是 DATABASE_URL
if [[ -n "${USERCENTER_DATABASE_URL:-}" ]]; then
  DATABASE_URL="$USERCENTER_DATABASE_URL"
fi
export DATABASE_URL="${DATABASE_URL:-}"
export USERCENTER_DATABASE_URL="${USERCENTER_DATABASE_URL:-$DATABASE_URL}"
export RECYCLE_DATABASE_URL="${RECYCLE_DATABASE_URL:-}"
export WECHAT_DATABASE_URL="${WECHAT_DATABASE_URL:-}"

if [[ $# -gt 0 ]]; then
  TARGETS=("$@")
else
  TARGETS=(gateway usercenter upload wechat recycle)
fi

echo "重载服务: ${TARGETS[*]}"

for service in "${TARGETS[@]}"; do
  pm2 delete "$service" >/dev/null 2>&1 || true
done
pm2 delete /usercenter-/ >/dev/null 2>&1 || true
# 等端口释放再起，否则 gateway 会撞 EADDRINUSE（旧进程还没完全退出）
sleep 3
pm2 start ecosystem.recycle.config.cjs --only "$(IFS=,; echo "${TARGETS[*]}")"
pm2 save

echo
echo "等待服务接入 MQTT ..."
sleep 12

echo
echo "=== 校验：进程内实际生效的值 ==="
pm2 jlist 2>/dev/null | node -e '
  const wanted = ["RECYCLE_INTERNAL_KEY", "RECYCLE_DATABASE_URL", "WECHAT_MP_CODE", "DATABASE_URL", "MQTT_URL"];
  let d = "";
  process.stdin.on("data", (c) => (d += c)).on("end", () => {
    const apps = JSON.parse(d).filter((a) => process.argv.slice(1).includes(a.name));
    const seen = new Map();
    for (const app of apps) {
      for (const key of wanted) {
        const value = app.pm2_env.env?.[key];
        if (value === undefined) continue;
        if (!seen.has(key)) seen.set(key, String(value));
      }
    }
    for (const [key, value] of seen) {
      const shown = /KEY|SECRET|PASSWORD/.test(key)
        ? value.slice(0, 8) + "…"
        : value.replace(/\/\/([^:]+):([^@]+)@/, "//$1:***@");
      console.log("  " + key.padEnd(22) + shown);
    }
  });
' "${TARGETS[@]}"

echo
echo "=== 健康检查 ==="
PORT="${PORT:-3000}"
# 用 node 发请求而不是 curl：本机若设了 HTTP_PROXY，curl 会走代理，
# 拿到的是代理的 502 "upstream connect failed"，看起来像服务挂了，其实没挂
node -e '
const http = require("http");
const port = Number(process.argv[1]);
const paths = ["/recycle/health", "/wechat/health", "/upload/health"];
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
