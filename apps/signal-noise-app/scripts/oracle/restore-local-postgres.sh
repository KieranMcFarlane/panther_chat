#!/usr/bin/env bash
set -euo pipefail

app_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
env_file="${app_dir}/.env.oracle"
source_url="${SOURCE_DATABASE_URL:-postgresql:///signal_noise_app?host=/tmp}"
stamp="$(date +%Y%m%d_%H%M%S)"
backup_dir="${app_dir}/backups/oracle"
dump_file="${backup_dir}/local_source_${stamp}.dump"

if [[ ! -f "${env_file}" ]]; then
  echo "Missing ${env_file}. Copy .env.oracle.example to .env.oracle and fill it first." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
. "${env_file}"
set +a

: "${POSTGRES_DB:=signal_noise_app}"
: "${POSTGRES_USER:=panther_staging}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required in .env.oracle}"

mkdir -p "${backup_dir}"

echo "Creating local source dump at ${dump_file}"
pg_dump --format=custom --no-owner --no-acl --file="${dump_file}" "${source_url}"

echo "Waiting for Oracle Postgres container"
docker compose -f "${app_dir}/docker-compose.oracle.yml" --env-file "${env_file}" up -d postgres
docker compose -f "${app_dir}/docker-compose.oracle.yml" --env-file "${env_file}" exec -T postgres pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}"

target_url="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:5432/${POSTGRES_DB}?sslmode=require"

echo "Restoring local dump into Oracle Postgres"
PGPASSWORD="${POSTGRES_PASSWORD}" pg_restore \
  --dbname="${target_url}" \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  "${dump_file}"

echo "Checking key row counts"
PGPASSWORD="${POSTGRES_PASSWORD}" psql "${target_url}" <<'SQL'
select 'rfp_opportunities_unified' as table_name, count(*) from rfp_opportunities_unified
union all select 'canonical_entities', count(*) from canonical_entities
union all select 'entity_dossiers', count(*) from entity_dossiers
union all select 'graphiti_dossier_ingestions', count(*) from graphiti_dossier_ingestions
union all select 'graphiti_materialized_opportunities', count(*) from graphiti_materialized_opportunities;
SQL

echo "Restore complete. Dump kept at ${dump_file}"
