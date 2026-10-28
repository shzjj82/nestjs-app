#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# 切换到「另一套数据库」来验证回收服务。
#
#   ./scripts/recycle/switch-db.sh                 # 切到 *_v2（默认后缀）
#   ./scripts/recycle/switch-db.sh v3              # 切到 *_v3
#   ./scripts/recycle/switch-db.sh v2 --reset      # 先删掉 *_v2 再重建（真·从零）
#   ./scripts/recycle/switch-db.sh v2 --reload     # 切完顺便重载服务
#   ./scripts/recycle/switch-db.sh v2 --reload --bootstrap
#   ./scripts/recycle/switch-db.sh base            # 切回原始库名（不加后缀）
#
# 为什么要切库：
#   当前库里已经跑过一轮，留着订单 / 审批 / 目录种子等数据。再验证一遍时
#   新数据混在旧数据里看不出效果（"不知道这 11 单是刚才建的还是上次的"）。
#   换一套空库名，服务起来后会自己跑迁移 + 灌种子，看到的就是纯净结果。
#
# 三个库的关系：
#   USERCENTER_DATABASE_URL  -> usercenter（uc_*），启动时映射为进程内的 DATABASE_URL
#   RECYCLE_DATABASE_URL     -> recycle 库
#   WECHAT_DATABASE_URL      -> wechat 库
#
# 谁负责建库：recycle 与 wechat 服务启动时会自动 CREATE DATABASE；
#             usercenter 不会，所以主库由本脚本先建好。
# ============================================================================

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

ENV_FILE="${ENV_FILE:-.env.recycle}"
TOOL="scripts/recycle/db-tool.cjs"

SUFFIX="v2"
RESET=0
RELOAD=0
BOOTSTRAP=0
POSITIONAL=""

for arg in "$@"; do
  case "$arg" in
    --reset) RESET=1 ;;
    --reload) RELOAD=1 ;;
    --bootstrap) BOOTSTRAP=1 ;;
    --suffix=*) SUFFIX="${arg#*=}" ;;
    --env=*) ENV_FILE="${arg#*=}" ;;
    -h|--help) sed -n '2,30p' "$0"; exit 0 ;;
    -*) echo "未知参数: $arg" >&2; exit 1 ;;
    *) POSITIONAL="$arg" ;;
  esac
done
[[ -n "$POSITIONAL" ]] && SUFFIX="$POSITIONAL"

# base 表示切回不带后缀的原始库名
if [[ "$SUFFIX" == "base" || "$SUFFIX" == "-" ]]; then SUFFIX=""; fi
SUFFIX="${SUFFIX#_}"

if [[ -n "$SUFFIX" && ! "$SUFFIX" =~ ^[A-Za-z0-9]+$ ]]; then
  echo "后缀只允许字母数字，当前是: $SUFFIX" >&2
  exit 1
fi

echo "=== 切库 ==="
echo "env 文件: $ENV_FILE"
echo "库名后缀: ${SUFFIX:-（无，使用原始库名）}"

# ---------- 取当前连接串，据此推导目标库 ----------
CURRENT_URL="$(node "$TOOL" readenv --file "$ENV_FILE" --keys USERCENTER_DATABASE_URL,DATABASE_URL \
  | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const v=JSON.parse(d);console.log(v.USERCENTER_DATABASE_URL||v.DATABASE_URL||"")})')"

if [[ -z "$CURRENT_URL" ]]; then
  echo "  $ENV_FILE 里没有 USERCENTER_DATABASE_URL，改用默认值"
  CURRENT_URL="postgres://nestjs:nestjs@127.0.0.1:5432/nestjs"
fi

URLS=()
while IFS= read -r line; do URLS+=("$line"); done < <(node -e '
const url = process.argv[1];
const suffix = process.argv[2];
const build = (base) => {
  const u = new URL(url);
  u.pathname = "/" + base + (suffix ? "_" + suffix : "");
  return u.toString();
};
console.log(build("nestjs"));
console.log(build("recycle"));
console.log(build("wechat"));
' "$CURRENT_URL" "$SUFFIX")

MAIN_URL="${URLS[0]}"
RECYCLE_URL="${URLS[1]}"
WECHAT_URL="${URLS[2]}"
MAIN_DB="${MAIN_URL##*/}"
RECYCLE_DB="${RECYCLE_URL##*/}"
WECHAT_DB="${WECHAT_URL##*/}"

# ---------- 建库 / 重建 ----------
echo
echo "=== 准备数据库 ==="
if [[ "$RESET" == "1" ]]; then
  node "$TOOL" reset --admin "$CURRENT_URL" --dbs "$MAIN_DB,$RECYCLE_DB,$WECHAT_DB"
else
  node "$TOOL" ensure --admin "$CURRENT_URL" --dbs "$MAIN_DB,$RECYCLE_DB,$WECHAT_DB"
fi

# ---------- 写回 env ----------
echo
echo "=== 写入 $ENV_FILE ==="
node "$TOOL" writeenv --file "$ENV_FILE" \
  --set "USERCENTER_DATABASE_URL=$MAIN_URL,RECYCLE_DATABASE_URL=$RECYCLE_URL,WECHAT_DATABASE_URL=$WECHAT_URL"

# ---------- 现状 ----------
echo
node "$TOOL" report --urls "main=$MAIN_URL,recycle=$RECYCLE_URL,wechat=$WECHAT_URL"

# ---------- 后续动作 ----------
echo
if [[ "$RELOAD" == "1" ]]; then
  echo "=== 重载服务 ==="
  ENV_FILE="$ENV_FILE" bash scripts/recycle/reload.sh
else
  echo "接下来执行："
  echo "  npm run recycle:reload"
fi

if [[ "$BOOTSTRAP" == "1" ]]; then
  echo
  echo "=== 重新开通业务（新库里没有业务登记，必须跑一次）==="
  set -a
  # shellcheck disable=SC1090
  . "./$ENV_FILE"
  set +a
  npx ts-node -T -r tsconfig-paths/register scripts/recycle/bootstrap.ts
elif [[ "$RELOAD" == "1" ]]; then
  echo
  echo "⚠️  新库里没有业务登记与小程序配置，别忘了跑："
  echo "    set -a && . ./.env.recycle && set +a && npm run recycle:bootstrap"
fi

echo
echo "切库完成。当前指向："
echo "  usercenter -> $MAIN_DB"
echo "  recycle -> $RECYCLE_DB"
echo "  wechat  -> $WECHAT_DB"
