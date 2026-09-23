#!/usr/bin/env bash
set -euo pipefail

# 在云服务器或本机安装 Mosquitto，不依赖 Docker。
# 用法：
#   sudo ./scripts/install-mosquitto.sh
#   sudo MQTT_BIND=127.0.0.1 ./scripts/install-mosquitto.sh   # 仅本机可连
#   sudo MQTT_BIND=0.0.0.0 ./scripts/install-mosquitto.sh     # 默认，允许远程连

MQTT_BIND="${MQTT_BIND:-0.0.0.0}"
MQTT_PORT="${MQTT_PORT:-1883}"

log() {
  printf '[mosquitto] %s\n' "$*"
}

write_config() {
  local dest="$1"
  mkdir -p "$(dirname "$dest")"
  cat >"$dest" <<EOF
listener ${MQTT_PORT} ${MQTT_BIND}
protocol mqtt
allow_anonymous true
persistence false
log_type error
log_type warning
log_type notice
log_type information
EOF
  log "已写入配置: ${dest}"
}

install_debian() {
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y mosquitto mosquitto-clients
  write_config /etc/mosquitto/conf.d/nestjs.conf
  systemctl enable mosquitto
  systemctl restart mosquitto
}

install_rhel() {
  if command -v dnf >/dev/null 2>&1; then
    dnf install -y epel-release || true
    dnf install -y mosquitto
  else
    yum install -y epel-release || true
    yum install -y mosquitto
  fi
  write_config /etc/mosquitto/conf.d/nestjs.conf
  systemctl enable mosquitto
  systemctl restart mosquitto
}

install_macos() {
  if ! command -v brew >/dev/null 2>&1; then
    echo "macOS 需要先安装 Homebrew" >&2
    exit 1
  fi
  brew list mosquitto >/dev/null 2>&1 || brew install mosquitto
  local prefix
  prefix="$(brew --prefix)"
  write_config "${prefix}/etc/mosquitto/mosquitto.conf"
  brew services restart mosquitto
}

if [[ "$(uname -s)" == "Darwin" ]]; then
  install_macos
elif [[ -f /etc/os-release ]]; then
  # shellcheck source=/dev/null
  . /etc/os-release
  case "${ID:-}" in
    ubuntu|debian)
      if [[ "${EUID}" -ne 0 ]]; then
        echo "请用 root 执行: sudo $0" >&2
        exit 1
      fi
      install_debian
      ;;
    centos|rhel|rocky|almalinux|anolis|alinux)
      if [[ "${EUID}" -ne 0 ]]; then
        echo "请用 root 执行: sudo $0" >&2
        exit 1
      fi
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

log "Mosquitto 已启动，监听 ${MQTT_BIND}:${MQTT_PORT}"
log "当前为匿名访问，公网请尽快加账号密码和安全组限制。"
log "本机探测: mosquitto_sub -h 127.0.0.1 -t '\$SYS/#' -C 1 || true"
