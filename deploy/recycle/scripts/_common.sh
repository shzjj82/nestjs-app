# 本场景 bash 脚本共用：定位场景根目录、仓库根、环境文件、PM2 配置。
# 由 start.sh / reload.sh / db/switch.sh source，不要单独执行。
_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROFILE="$(cd "$_dir/.." && pwd)"
ROOT="$(cd "$PROFILE/../.." && pwd)"
unset _dir
cd "$ROOT"

ENV_FILE="${ENV_FILE:-$PROFILE/.env}"
ECOSYSTEM="$PROFILE/ecosystem.config.cjs"
BOOTSTRAP="$PROFILE/scripts/bootstrap.ts"
DB_TOOL="$PROFILE/db/tool.cjs"
RELOAD_SH="$PROFILE/scripts/reload.sh"

export PM2_HOME="${PM2_HOME:-$HOME/.pm2-nestjs}"
