#!/usr/bin/env bash
set -euo pipefail

backend_pid=""
frontend_pid=""
worker_pid=""
worker_supervisor_pid=""

worker_pid_file="tmp/entity-pipeline-worker.pid"
worker_supervisor_pid_file="tmp/entity-pipeline-worker-supervisor.pid"
worker_state_file="tmp/entity-pipeline-worker-state.json"
worker_log_file="tmp/entity-pipeline-worker.log"

export FASTAPI_URL="${FASTAPI_URL:-http://127.0.0.1:8000}"
export PYTHON_BACKEND_URL="${PYTHON_BACKEND_URL:-http://127.0.0.1:8000}"
export BRIGHTDATA_FASTMCP_HOST="${BRIGHTDATA_FASTMCP_HOST:-127.0.0.1}"
export BRIGHTDATA_FASTMCP_PORT=8014
export BRIGHTDATA_FASTMCP_URL="${BRIGHTDATA_FASTMCP_URL:-http://127.0.0.1:8014/mcp/}"

cleanup() {
  if [[ -n "${worker_supervisor_pid}" ]] && kill -0 "${worker_supervisor_pid}" 2>/dev/null; then
    kill "${worker_supervisor_pid}" 2>/dev/null || true
    wait "${worker_supervisor_pid}" 2>/dev/null || true
  elif [[ -f "${worker_supervisor_pid_file}" ]]; then
    local supervisor_pid
    supervisor_pid="$(cat "${worker_supervisor_pid_file}" 2>/dev/null || true)"
    if [[ -n "${supervisor_pid}" ]] && kill -0 "${supervisor_pid}" 2>/dev/null; then
      kill "${supervisor_pid}" 2>/dev/null || true
      wait "${supervisor_pid}" 2>/dev/null || true
    fi
  fi

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
    if "${PYTHON_BIN:-python3}" - <<'PY' >/dev/null 2>&1; then
import json
import sys
from urllib.request import urlopen

with urlopen("http://127.0.0.1:8000/health", timeout=2) as response:
    payload = json.loads(response.read().decode("utf-8"))
if payload.get("status") != "healthy" or payload.get("version") != "2.0.0":
    raise SystemExit(1)
with urlopen("http://127.0.0.1:8000/openapi.json", timeout=2) as response:
    openapi = json.loads(response.read().decode("utf-8"))
if "/api/pipeline/run-entity" not in (openapi.get("paths") or {}):
    raise SystemExit(1)
PY
      return 0
    fi

    sleep 1
  done

  echo "Backend failed to become ready on port 8000" >&2
  lsof -nP -iTCP:8000 -sTCP:LISTEN >&2 || true
  return 1
}

prewarm_entity_snapshot() {
  curl -sf 'http://127.0.0.1:3005/api/entities?page=1&limit=10&entityType=all&sortBy=name&sortOrder=asc' >/dev/null
  curl -sf 'http://127.0.0.1:3005/api/entities/summary' >/dev/null
}

start_worker_supervisor() {
  mkdir -p tmp
  : > "${worker_log_file}"

  if [[ -f "${worker_pid_file}" ]]; then
    local existing_pid
    existing_pid="$(cat "${worker_pid_file}" 2>/dev/null || true)"
    if [[ -n "${existing_pid}" ]] && kill -0 "${existing_pid}" 2>/dev/null; then
      worker_pid="${existing_pid}"
      return 0
    fi
  fi

  (
    worker_child_pid=""

    cleanup_worker_child() {
      if [[ -n "${worker_child_pid}" ]] && kill -0 "${worker_child_pid}" 2>/dev/null; then
        kill "${worker_child_pid}" 2>/dev/null || true
        wait "${worker_child_pid}" 2>/dev/null || true
      fi
    }

    trap cleanup_worker_child EXIT INT TERM

    while true; do
      cat > "${worker_state_file}" <<EOF
{
  "worker_process_state": "starting",
  "worker_pid": null,
  "worker_command": "npm run worker:entity-pipeline",
  "worker_state_path": "$(pwd)/${worker_state_file}",
  "worker_pid_path": "$(pwd)/${worker_pid_file}",
  "started_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "stopped_at": null,
  "updated_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "last_error": null
}
EOF

      PANTHER_CHAT_ALLOW_DIRECT_START=1 npm run worker:entity-pipeline > "${worker_log_file}" 2>&1 &
      worker_child_pid=$!
      worker_pid="${worker_child_pid}"
      echo "${worker_child_pid}" > "${worker_pid_file}"

      cat > "${worker_state_file}" <<EOF
{
  "worker_process_state": "running",
  "worker_pid": ${worker_child_pid},
  "worker_command": "npm run worker:entity-pipeline",
  "worker_state_path": "$(pwd)/${worker_state_file}",
  "worker_pid_path": "$(pwd)/${worker_pid_file}",
  "started_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "stopped_at": null,
  "updated_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "last_error": null
}
EOF

      if wait "${worker_child_pid}"; then
        exit_code=0
      else
        exit_code=$?
      fi
      worker_child_pid=""

      cat > "${worker_state_file}" <<EOF
{
  "worker_process_state": "crashed",
  "worker_pid": null,
  "worker_command": "npm run worker:entity-pipeline",
  "worker_state_path": "$(pwd)/${worker_state_file}",
  "worker_pid_path": "$(pwd)/${worker_pid_file}",
  "started_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "stopped_at": null,
  "updated_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "last_error": "worker exited with code ${exit_code}; restarting"
}
EOF

      echo "worker exited unexpectedly; restarting" >&2
      sleep 2
    done
  ) &

  worker_supervisor_pid=$!
  echo "${worker_supervisor_pid}" > "${worker_supervisor_pid_file}"
}

PANTHER_CHAT_ALLOW_DIRECT_START=1 npm run backend:dev &
backend_pid=$!

wait_for_backend
start_worker_supervisor

PANTHER_CHAT_ALLOW_DIRECT_START=1 npm run dev:frontend &
frontend_pid=$!

wait_for_frontend
prewarm_entity_snapshot

wait "${frontend_pid}"
