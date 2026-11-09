#!/usr/bin/env bash
set -euo pipefail

# 每日 PostgreSQL 备份 → 阿里云 OSS，默认只保留 3 天。
#
# 推荐：在能访问库的机器上配 cron（可本机就是 root@192.168.3.98，
# 也可从运维机 SSH 过去 dump）。
#
# 用法：
#   # 在数据库机本地跑
#   ./scripts/infra/backup-postgres-to-oss.sh
#
#   # 从运维机经 SSH dump 再上传（线上库示例）
#   BACKUP_SSH=root@192.168.3.98 ./scripts/infra/backup-postgres-to-oss.sh
#
#   # 安装 crontab（每天 03:15）
#   BACKUP_SSH=root@192.168.3.98 ./scripts/infra/backup-postgres-to-oss.sh install-cron
#
# 环境变量（可放在仓库根 .env 或 BACKUP_ENV_FILE）：
#   OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET / OSS_BUCKET
#   OSS_REGION=oss-cn-hangzhou
#   OSS_ENDPOINT=https://oss-cn-hangzhou.aliyuncs.com
#   BACKUP_SSH=root@192.168.3.98        # 空=本机 pg_dump
#   BACKUP_SSH_OPTS="-o BatchMode=yes -o StrictHostKeyChecking=accept-new"
#   POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_HOST / POSTGRES_PORT
#   # SSH 模式下 POSTGRES_HOST 默认 127.0.0.1（远端本机）
#   BACKUP_DATABASES="nestjs docs wechat order agents recycle notify"
#   BACKUP_KEEP_DAYS=3
#   BACKUP_OSS_PREFIX=db-backups/nestjs-app
#   BACKUP_WORKDIR=/var/tmp/nestjs-pg-backup
#   BACKUP_CRON="15 3 * * *"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="${BACKUP_ENV_FILE:-${ROOT}/.env}"
OSS_HELPER="${ROOT}/scripts/infra/oss-backup.mjs"

load_env() {
  if [[ -f "${ENV_FILE}" ]]; then
    set -a
    # shellcheck disable=SC1090
    source <(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "${ENV_FILE}" | sed 's/\r$//')
    set +a
  fi
}

log() {
  printf '[pg-backup] %s\n' "$*"
}

die() {
  printf '[pg-backup] ERROR: %s\n' "$*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "需要命令: $1"
}

install_cron() {
  local marker="# nestjs-app postgres → oss backup"
  local schedule="${BACKUP_CRON:-15 3 * * *}"
  local log_file="${BACKUP_LOG:-${HOME}/nestjs-pg-backup.log}"
  local env_exports=(
    "BACKUP_ENV_FILE=${ENV_FILE}"
  )
  if [[ -n "${BACKUP_SSH:-}" ]]; then
    env_exports+=("BACKUP_SSH=${BACKUP_SSH}")
  fi
  if [[ -n "${BACKUP_KEEP_DAYS:-}" ]]; then
    env_exports+=("BACKUP_KEEP_DAYS=${BACKUP_KEEP_DAYS}")
  fi
  if [[ -n "${BACKUP_OSS_PREFIX:-}" ]]; then
    env_exports+=("BACKUP_OSS_PREFIX=${BACKUP_OSS_PREFIX}")
  fi

  local cron_line
  cron_line="${schedule} cd ${ROOT} && ${env_exports[*]} ${ROOT}/scripts/infra/backup-postgres-to-oss.sh >> ${log_file} 2>&1 ${marker}"

  local existing
  existing="$(crontab -l 2>/dev/null || true)"
  if printf '%s\n' "${existing}" | grep -F "${marker}" >/dev/null 2>&1; then
    existing="$(printf '%s\n' "${existing}" | grep -vF "${marker}")"
  fi
  {
    printf '%s\n' "${existing}"
    printf '%s\n' "${cron_line}"
  } | awk 'NF || !blank++' | crontab -

  log "已写入 crontab: ${cron_line}"
  log "日志: ${log_file}"
}

dump_one() {
  local db="$1"
  local out="$2"
  local host="$3"
  local port="${POSTGRES_PORT:-5432}"
  local user="${POSTGRES_USER:-nestjs}"
  local password="${POSTGRES_PASSWORD:-}"

  if [[ -n "${BACKUP_SSH}" ]]; then
    require_cmd ssh
    # 远端 pg_dump，自定义格式写到 stdout，本地落盘
    # shellcheck disable=SC2086
    ssh ${BACKUP_SSH_OPTS} "${BACKUP_SSH}" \
      "export PGPASSWORD=$(printf '%q' "${password}"); exec pg_dump -h $(printf '%q' "${host}") -p $(printf '%q' "${port}") -U $(printf '%q' "${user}") -d $(printf '%q' "${db}") --no-owner --no-acl -F c" \
      > "${out}"
  else
    require_cmd pg_dump
    export PGPASSWORD="${password}"
    pg_dump -h "${host}" -p "${port}" -U "${user}" -d "${db}" --no-owner --no-acl -F c -f "${out}"
  fi

  [[ -s "${out}" ]] || die "空备份: ${db}"
}

upload() {
  local file="$1"
  local key="$2"
  require_cmd node
  [[ -f "${OSS_HELPER}" ]] || die "缺少 ${OSS_HELPER}"
  node "${OSS_HELPER}" put "${file}" "${key}"
}

prune() {
  local prefix="$1"
  local keep="$2"
  node "${OSS_HELPER}" prune "${prefix}/" "${keep}"
}

main_backup() {
  load_env

  BACKUP_SSH="${BACKUP_SSH:-}"
  BACKUP_SSH_OPTS="${BACKUP_SSH_OPTS:--o BatchMode=yes -o StrictHostKeyChecking=accept-new}"
  local keep="${BACKUP_KEEP_DAYS:-3}"
  local prefix="${BACKUP_OSS_PREFIX:-db-backups/nestjs-app}"
  prefix="${prefix%/}"
  local workdir="${BACKUP_WORKDIR:-/var/tmp/nestjs-pg-backup}"
  local databases="${BACKUP_DATABASES:-nestjs docs wechat order agents recycle notify}"
  local stamp day
  stamp="$(date +%Y%m%d-%H%M%S)"
  day="$(date +%Y%m%d)"

  # SSH 到库机时，默认连远端本机 Postgres
  local host="${POSTGRES_HOST:-}"
  if [[ -z "${host}" ]]; then
    if [[ -n "${BACKUP_SSH}" ]]; then
      host="127.0.0.1"
    else
      host="127.0.0.1"
    fi
  fi

  [[ -n "${OSS_ACCESS_KEY_ID:-}" ]] || die "请配置 OSS_ACCESS_KEY_ID"
  [[ -n "${OSS_ACCESS_KEY_SECRET:-}" ]] || die "请配置 OSS_ACCESS_KEY_SECRET"
  [[ -n "${OSS_BUCKET:-}" ]] || die "请配置 OSS_BUCKET"
  require_cmd gzip

  if [[ -n "${BACKUP_SSH}" ]]; then
    log "经 SSH dump: ${BACKUP_SSH} (pg ${host}:${POSTGRES_PORT:-5432})"
  else
    log "本机 dump: ${host}:${POSTGRES_PORT:-5432}"
  fi

  mkdir -p "${workdir}"
  local run_dir="${workdir}/${stamp}"
  mkdir -p "${run_dir}"
  trap 'rm -rf "${run_dir}"' EXIT

  local db dump gz key
  for db in ${databases}; do
    dump="${run_dir}/${db}.dump"
    log "dump ${db} ..."
    dump_one "${db}" "${dump}" "${host}"
    gzip -f -9 "${dump}"
    gz="${dump}.gz"
    key="${prefix}/${day}/${db}-${stamp}.dump.gz"
    log "upload ${key}"
    upload "${gz}" "${key}"
  done

  log "prune keepDays=${keep} prefix=${prefix}/"
  prune "${prefix}" "${keep}"
  log "完成"
}

case "${1:-}" in
  install-cron)
    load_env
    install_cron
    ;;
  ""|run)
    main_backup
    ;;
  -h|--help|help)
    sed -n '2,45p' "$0"
    ;;
  *)
    die "未知参数: $1（用 run / install-cron）"
    ;;
esac
