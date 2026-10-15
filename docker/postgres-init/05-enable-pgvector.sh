#!/bin/bash
set -euo pipefail
# 新库启用 pgvector；agents 迁移也会 CREATE EXTENSION，此处提前装好避免启动竞态
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname agents <<-EOSQL
  CREATE EXTENSION IF NOT EXISTS vector;
EOSQL
