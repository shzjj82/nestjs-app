#!/usr/bin/env bash
set -euo pipefail

# 在云服务器或本机安装 Redis，不依赖 Docker。
# 用法：
#   sudo ./scripts/install-redis.sh
#   sudo REDIS_BIND=127.0.0.1 ./scripts/install-redis.sh   # 仅本机可连（默认）
#   sudo REDIS_BIND=0.0.0.0 ./scripts/install-redis.sh     # 允许远程连
#
# 环境变量：
#   REDIS_BIND / REDIS_PORT

REDIS_BIND="${REDIS_BIND:-127.0.0.1}"
REDIS_PORT="${REDIS_PORT:-6379}"

log() {
  printf '[redis] %s\n' "$*"
}

require_root_on_linux() {
  if [[ "${EUID}" -ne 0 ]]; then
    echo "请用 root 执行: sudo $0" >&2
    exit 1
  fi
}

write_snippet() {
  local dest="$1"
  mkdir -p "$(dirname "$dest")"
  cat >"${dest}" <<EOF
bind ${REDIS_BIND}
port ${REDIS_PORT}
protected-mode yes
appendonly yes
daemonize no
EOF
  log "已写入配置: ${dest}"
}

enable_include() {
  local main_conf="$1"
  local snippet="$2"
  if [[ ! -f "${main_conf}" ]]; then
    return 0
  fi
  if ! grep -qF "include ${snippet}" "${main_conf}"; then
    printf '\ninclude %s\n' "${snippet}" >>"${main_conf}"
  fi
}

install_debian() {
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y redis-server
  write_snippet /etc/redis/nestjs.conf
  enable_include /etc/redis/redis.conf /etc/redis/nestjs.conf
  systemctl enable redis-server
  systemctl restart redis-server
}

install_rhel() {
  if command -v dnf >/dev/null 2>&1; then
    dnf install -y redis
  else
    yum install -y redis
  fi
  write_snippet /etc/redis/nestjs.conf
  if [[ -f /etc/redis/redis.conf ]]; then
    enable_include /etc/redis/redis.conf /etc/redis/nestjs.conf
  elif [[ -f /etc/redis.conf ]]; then
    enable_include /etc/redis.conf /etc/redis/nestjs.conf
  fi
  systemctl enable redis
  systemctl restart redis
}

install_macos() {
  if ! command -v brew >/dev/null 2>&1; then
    echo "macOS 需要先安装 Homebrew" >&2
    exit 1
  fi
  brew list redis >/dev/null 2>&1 || brew install redis
  local prefix
  prefix="$(brew --prefix)"
  write_snippet "${prefix}/etc/redis-nestjs.conf"
  brew services stop redis >/dev/null 2>&1 || true
  if command -v redis-server >/dev/null 2>&1; then
    brew services start redis
    # Homebrew 默认服务读自己的 redis.conf；覆盖 bind/port 用我们的片段重启一次
    brew services stop redis >/dev/null 2>&1 || true
  fi
  redis-server "${prefix}/etc/redis-nestjs.conf" --daemonize yes
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

log "Redis 已启动，监听 ${REDIS_BIND}:${REDIS_PORT}"
log "REDIS_URL=redis://127.0.0.1:${REDIS_PORT}"
if [[ "${REDIS_BIND}" == "0.0.0.0" ]]; then
  log "当前允许远程连接，公网请尽快加密码并限制安全组。"
fi
log "本机探测: redis-cli -h 127.0.0.1 -p ${REDIS_PORT} ping || true"
