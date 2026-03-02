#!/usr/bin/env bash
set -euo pipefail

backend_pid=""
frontend_pid=""

cleanup() {
  if [[ -n "${frontend_pid}" ]] && kill -0 "${frontend_pid}" 2>/dev/null; then
    kill "${frontend_pid}" 2>/dev/null || true
    wait "${frontend_pid}" 2>/dev/null || true
  fi

  if [[ -n "${backend_pid}" ]] && kill -0 "${backend_pid}" 2>/dev/null; then
    kill "${backend_pid}" 2>/dev/null || true
    wait "${backend_pid}" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

wait_for_frontend() {
  for _ in $(seq 1 60); do
    if curl -sf http://127.0.0.1:3005/api/health >/dev/null; then
      return 0
    fi

    sleep 1
  done

  echo "Frontend failed to become ready on port 3005" >&2
  return 1
}

prewarm_entity_snapshot() {
  curl -sf 'http://127.0.0.1:3005/api/entities?page=1&limit=10&entityType=all&sortBy=name&sortOrder=asc' >/dev/null
  curl -sf 'http://127.0.0.1:3005/api/entities/summary' >/dev/null
}

npm run backend:dev &
backend_pid=$!

npm run dev &
frontend_pid=$!

wait_for_frontend
prewarm_entity_snapshot

wait "${frontend_pid}"
