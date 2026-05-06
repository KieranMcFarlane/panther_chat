#!/usr/bin/env sh
set -eu

if [ "${1:-}" = "postgres" ]; then
  cert_file="${PGDATA:-/var/lib/postgresql/data}/server.crt"
  key_file="${PGDATA:-/var/lib/postgresql/data}/server.key"

  if [ ! -s "$cert_file" ] || [ ! -s "$key_file" ]; then
    openssl req \
      -new \
      -x509 \
      -days "${POSTGRES_SSL_DAYS:-3650}" \
      -nodes \
      -subj "/CN=${POSTGRES_SSL_CN:-oracle-postgres}" \
      -keyout "$key_file" \
      -out "$cert_file"
  fi

  chown postgres:postgres "$cert_file" "$key_file"
  chmod 0644 "$cert_file"
  chmod 0600 "$key_file"
fi

exec docker-entrypoint.sh "$@"
