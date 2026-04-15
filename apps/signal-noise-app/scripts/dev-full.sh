#!/usr/bin/env bash
set -euo pipefail

backend_pid=""
frontend_pid=""
worker_pid=""

worker_pid_file="tmp/entity-pipeline-worker.pid"
worker_state_file="tmp/entity-pipeline-worker-state.json"
worker_log_file="tmp/entity-pipeline-worker.log"

cleanup() {
  if [[ -n "${worker_pid}" ]] && kill -0 "${worker_pid}" 2>/dev/null; then
    kill "${worker_pid}" 2>/dev/null || true
    wait "${worker_pid}" 2>/dev/null || true
  elif [[ -f "${worker_pid_file}" ]]; then
    local pid
    pid="$(cat "${worker_pid_file}" 2>/dev/null || true)"
    if [[ -n "${pid}" ]] && kill -0 "${pid}" 2>/dev/null; then
      kill "${pid}" 2>/dev/null || true
      wait "${pid}" 2>/dev/null || true
    fi
  fi

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

wait_for_backend() {
  for _ in $(seq 1 60); do
    if curl -sf http://127.0.0.1:8000/health >/dev/null; then
      return 0
    fi

    sleep 1
  done

  echo "Backend failed to become ready on port 8000" >&2
  return 1
}

prewarm_entity_snapshot() {
  curl -sf 'http://127.0.0.1:3005/api/entities?page=1&limit=10&entityType=all&sortBy=name&sortOrder=asc' >/dev/null
  curl -sf 'http://127.0.0.1:3005/api/entities/summary' >/dev/null
}

start_worker() {
  mkdir -p tmp

  if [[ -f "${worker_pid_file}" ]]; then
    local existing_pid
    existing_pid="$(cat "${worker_pid_file}" 2>/dev/null || true)"
    if [[ -n "${existing_pid}" ]] && kill -0 "${existing_pid}" 2>/dev/null; then
      worker_pid="${existing_pid}"
      return 0
    fi
  fi

  npm run worker:entity-pipeline > "${worker_log_file}" 2>&1 &
  worker_pid=$!
  echo "${worker_pid}" > "${worker_pid_file}"
  cat > "${worker_state_file}" <<EOF
{
  "worker_process_state": "starting",
  "worker_pid": ${worker_pid},
  "worker_command": "npm run worker:entity-pipeline",
  "worker_state_path": "$(pwd)/${worker_state_file}",
  "worker_pid_path": "$(pwd)/${worker_pid_file}",
  "started_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "stopped_at": null,
  "updated_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "last_error": null
}
EOF
}

npm run backend:dev &
backend_pid=$!

wait_for_backend
start_worker

npm run dev &
frontend_pid=$!

wait_for_frontend
prewarm_entity_snapshot

wait "${frontend_pid}"
