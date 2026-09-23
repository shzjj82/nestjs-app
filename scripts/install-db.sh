#!/usr/bin/env bash
set -euo pipefail

# 无 Docker 时一次性安装 PostgreSQL + Redis。
# 用法：
#   sudo ./scripts/install-db.sh
#   ./scripts/install-db.sh    # macOS / 已具备权限时

ROOT="$(cd "$(dirname "$0")" && pwd)"

"${ROOT}/install-postgres.sh"
"${ROOT}/install-redis.sh"
