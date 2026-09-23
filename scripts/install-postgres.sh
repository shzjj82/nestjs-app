#!/usr/bin/env bash
set -euo pipefail

# 在云服务器或本机安装 PostgreSQL，不依赖 Docker。
# 用法：
#   sudo ./scripts/install-postgres.sh
#   sudo PG_BIND=127.0.0.1 ./scripts/install-postgres.sh   # 仅本机可连（默认）
#   sudo PG_BIND=0.0.0.0 ./scripts/install-postgres.sh     # 允许远程连
#
# 环境变量：
#   POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB / POSTGRES_PORT / PG_BIND

PG_BIND="${PG_BIND:-127.0.0.1}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-nestjs}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-nestjs}"
POSTGRES_DB="${POSTGRES_DB:-nestjs}"

log() {
  printf '[postgres] %s\n' "$*"
}

require_root_on_linux() {
  if [[ "${EUID}" -ne 0 ]]; then
    echo "请用 root 执行: sudo $0" >&2
    exit 1
  fi
}

quote_literal() {
  printf "%s" "$1" | sed "s/'/''/g"
}

ensure_role_and_db() {
  local psql_cmd="$1"
  local user_lit password_lit db_ident
  user_lit="$(quote_literal "${POSTGRES_USER}")"
  password_lit="$(quote_literal "${POSTGRES_PASSWORD}")"
  db_ident="${POSTGRES_DB}"

  ${psql_cmd} -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${user_lit}') THEN
    CREATE ROLE "${POSTGRES_USER}" LOGIN PASSWORD '${password_lit}';
  ELSE
    ALTER ROLE "${POSTGRES_USER}" WITH LOGIN PASSWORD '${password_lit}';
  END IF;
END
\$\$;
SQL

  if ! ${psql_cmd} -tAc "SELECT 1 FROM pg_database WHERE datname = '${db_ident}'" | grep -q 1; then
    ${psql_cmd} -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"${POSTGRES_DB}\" OWNER \"${POSTGRES_USER}\";"
  else
    ${psql_cmd} -v ON_ERROR_STOP=1 -c "ALTER DATABASE \"${POSTGRES_DB}\" OWNER TO \"${POSTGRES_USER}\";"
  fi
}

configure_listen() {
  local psql_cmd="$1"
  local listen="${PG_BIND}"
  if [[ "${listen}" == "0.0.0.0" ]]; then
    listen="*"
  fi

  ${psql_cmd} -v ON_ERROR_STOP=1 -c "ALTER SYSTEM SET listen_addresses = '${listen}';"
  ${psql_cmd} -v ON_ERROR_STOP=1 -c "ALTER SYSTEM SET port = ${POSTGRES_PORT};"

  local hba
  hba="$(${psql_cmd} -tAc 'SHOW hba_file')"
  hba="${hba//[$'\t\r\n ']/}"
  if [[ -n "${hba}" && -f "${hba}" ]]; then
    if ! grep -qE '^host[[:space:]]+all[[:space:]]+all[[:space:]]+0\.0\.0\.0/0' "${hba}"; then
      if [[ "${PG_BIND}" == "0.0.0.0" ]]; then
        printf '\nhost all all 0.0.0.0/0 scram-sha-256\n' >>"${hba}"
      fi
    fi
    if ! grep -qE '^host[[:space:]]+all[[:space:]]+all[[:space:]]+127\.0\.0\.1/32' "${hba}"; then
      printf '\nhost all all 127.0.0.1/32 scram-sha-256\n' >>"${hba}"
    fi
  fi
}

install_debian() {
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y postgresql postgresql-contrib
  systemctl enable postgresql
  systemctl start postgresql
  ensure_role_and_db "sudo -u postgres psql"
  configure_listen "sudo -u postgres psql"
  systemctl restart postgresql
}

install_rhel() {
  if command -v dnf >/dev/null 2>&1; then
    dnf install -y postgresql-server postgresql
  else
    yum install -y postgresql-server postgresql
  fi
  if [[ ! -f /var/lib/pgsql/data/PG_VERSION ]]; then
    postgresql-setup --initdb || /usr/bin/postgresql-setup --initdb
  fi
  systemctl enable postgresql
  systemctl start postgresql
  ensure_role_and_db "sudo -u postgres psql"
  configure_listen "sudo -u postgres psql"
  systemctl restart postgresql
}

install_macos() {
  if ! command -v brew >/dev/null 2>&1; then
    echo "macOS 需要先安装 Homebrew" >&2
    exit 1
  fi

  brew list postgresql@16 >/dev/null 2>&1 || brew install postgresql@16
  brew services start postgresql@16

  local prefix bin
  prefix="$(brew --prefix postgresql@16)"
  bin="${prefix}/bin"
  export PATH="${bin}:${PATH}"

  local retries=0
  until pg_isready -h 127.0.0.1 >/dev/null 2>&1; do
    retries=$((retries + 1))
    if [[ "${retries}" -gt 30 ]]; then
      echo "PostgreSQL 启动超时" >&2
      exit 1
    fi
    sleep 1
  done

  ensure_role_and_db "psql -d postgres"
  configure_listen "psql -d postgres"
  brew services restart postgresql@16
}

if [[ "$(uname -s)" == "Darwin" ]]; then
  install_macos
elif [[ -f /etc/os-release ]]; then
  # shellcheck source=/dev/null
  . /etc/os-release
  case "${ID:-}" in
    ubuntu|debian)
      require_root_on_linux
      install_debian
      ;;
    centos|rhel|rocky|almalinux|anolis|alinux)
      require_root_on_linux
      install_rhel
      ;;
    *)
      echo "暂不支持的发行版: ${ID:-unknown}" >&2
      exit 1
      ;;
  esac
else
  echo "无法识别操作系统" >&2
  exit 1
fi

log "PostgreSQL 已启动，监听 ${PG_BIND}:${POSTGRES_PORT}"
log "库: ${POSTGRES_DB}  用户: ${POSTGRES_USER}"
log "DATABASE_URL=postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:${POSTGRES_PORT}/${POSTGRES_DB}"
if [[ "${PG_BIND}" == "0.0.0.0" ]]; then
  log "当前允许远程连接，公网请尽快改强密码并限制安全组。"
fi
