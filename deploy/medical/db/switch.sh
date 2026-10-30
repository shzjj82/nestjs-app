#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# 切换到「另一套数据库」来验证中医服务。
#
#   ./deploy/medical/db/switch.sh                 # 切到 *_v2（默认后缀）
#   ./deploy/medical/db/switch.sh v3              # 切到 *_v3
#   ./deploy/medical/db/switch.sh v2 --reset      # 先删掉 *_v2 再重建
#   ./deploy/medical/db/switch.sh v2 --reload     # 切完顺便重载服务
#   ./deploy/medical/db/switch.sh v2 --reload --bootstrap
#   ./deploy/medical/db/switch.sh base            # 切回原始库名
# ============================================================================

# shellcheck source=../scripts/_common.sh
. "$(cd "$(dirname "$0")/../scripts" && pwd)/_common.sh"

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
    -h|--help) sed -n '2,16p' "$0"; exit 0 ;;
    -*) echo "未知参数: $arg" >&2; exit 1 ;;
    *) POSITIONAL="$arg" ;;
  esac
done
[[ -n "$POSITIONAL" ]] && SUFFIX="$POSITIONAL"

if [[ "$SUFFIX" == "base" || "$SUFFIX" == "-" ]]; then SUFFIX=""; fi
SUFFIX="${SUFFIX#_}"

if [[ -n "$SUFFIX" && ! "$SUFFIX" =~ ^[A-Za-z0-9]+$ ]]; then
  echo "后缀只允许字母数字，当前是: $SUFFIX" >&2
  exit 1
fi

echo "=== 切库 ==="
echo "env 文件: $ENV_FILE"
echo "库名后缀: ${SUFFIX:-（无，使用原始库名）}"

CURRENT_URL="$(node "$DB_TOOL" readenv --file "$ENV_FILE" --keys USERCENTER_DATABASE_URL,DATABASE_URL \
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
console.log(build("medical"));
' "$CURRENT_URL" "$SUFFIX")

MAIN_URL="${URLS[0]}"
MEDICAL_URL="${URLS[1]}"
MAIN_DB="${MAIN_URL##*/}"
MEDICAL_DB="${MEDICAL_URL##*/}"

echo
echo "=== 准备数据库 ==="
if [[ "$RESET" == "1" ]]; then
  node "$DB_TOOL" reset --admin "$CURRENT_URL" --dbs "$MAIN_DB,$MEDICAL_DB"
else
  node "$DB_TOOL" ensure --admin "$CURRENT_URL" --dbs "$MAIN_DB,$MEDICAL_DB"
fi

echo
echo "=== 写入 $ENV_FILE ==="
node "$DB_TOOL" writeenv --file "$ENV_FILE" \
  --set "USERCENTER_DATABASE_URL=$MAIN_URL,MEDICAL_DATABASE_URL=$MEDICAL_URL"

echo
node "$DB_TOOL" report --urls "main=$MAIN_URL,medical=$MEDICAL_URL"

echo
if [[ "$RELOAD" == "1" ]]; then
  echo "=== 重载服务 ==="
  ENV_FILE="$ENV_FILE" bash "$RELOAD_SH"
else
  echo "接下来执行："
  echo "  npm run medical:reload"
fi

if [[ "$BOOTSTRAP" == "1" ]]; then
  echo
  echo "=== 重新开通业务（新库里没有业务登记，必须跑一次）==="
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
  npx ts-node -T -r tsconfig-paths/register "$BOOTSTRAP"
elif [[ "$RELOAD" == "1" ]]; then
  echo
  echo "⚠️  新库里没有业务登记，别忘了跑："
  echo "    set -a && . ./deploy/medical/.env && set +a && npm run medical:bootstrap"
fi

echo
echo "切库完成。当前指向："
echo "  usercenter -> $MAIN_DB"
echo "  medical -> $MEDICAL_DB"
