#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# 重新加载环境变量并重启中医服务。
#
#   ./deploy/medical/scripts/reload.sh            # 重载全部 4 个服务
#   ./deploy/medical/scripts/reload.sh medical    # 只重载 medical
# ============================================================================

# shellcheck source=_common.sh
. "$(cd "$(dirname "$0")" && pwd)/_common.sh"

if [[ -f "$ENV_FILE" ]]; then
  echo "加载环境变量: $ENV_FILE"
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
else
  echo "未找到 $ENV_FILE，将只使用当前 shell 的环境变量" >&2
fi

if [[ -n "${USERCENTER_DATABASE_URL:-}" ]]; then
  DATABASE_URL="$USERCENTER_DATABASE_URL"
fi
export DATABASE_URL="${DATABASE_URL:-}"
export USERCENTER_DATABASE_URL="${USERCENTER_DATABASE_URL:-$DATABASE_URL}"
export MEDICAL_DATABASE_URL="${MEDICAL_DATABASE_URL:-}"

if [[ $# -gt 0 ]]; then
  TARGETS=("$@")
else
  TARGETS=(gateway usercenter upload medical)
fi

echo "重载服务: ${TARGETS[*]}"

for service in "${TARGETS[@]}"; do
  pm2 delete "$service" >/dev/null 2>&1 || true
done
pm2 delete /usercenter-/ >/dev/null 2>&1 || true
sleep 3
pm2 start "$ECOSYSTEM" --only "$(IFS=,; echo "${TARGETS[*]}")"
pm2 save

echo
echo "等待服务接入 MQTT ..."
sleep 12

echo
echo "=== 校验：进程内实际生效的值 ==="
pm2 jlist 2>/dev/null | node -e '
  const wanted = ["MEDICAL_DATABASE_URL", "DATABASE_URL", "MQTT_URL", "AUTH_SECRET"];
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
