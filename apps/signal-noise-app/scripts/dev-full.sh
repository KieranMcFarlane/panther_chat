#!/usr/bin/env bash
set -euo pipefail

backend_pid=""
frontend_pid=""
graphiti_mcp_pid=""
graphiti_mcp_enabled="0"
worker_pid=""
worker_supervisor_pid=""
recovery_supervisor_pid=""
NPM_BIN=""
NODE_BIN=""

worker_pid_file="tmp/entity-pipeline-worker.pid"
worker_supervisor_pid_file="tmp/entity-pipeline-worker-supervisor.pid"
worker_state_file="tmp/entity-pipeline-worker-state.json"
worker_log_file="tmp/entity-pipeline-worker.log"
backend_pid_file="tmp/dev-full-backend.pid"
frontend_pid_file="tmp/dev-full-frontend.pid"
graphiti_mcp_pid_file="tmp/graphiti-mcp.pid"
graphiti_mcp_log_file="tmp/graphiti-mcp.log"
graphiti_runtime_state_file="${GRAPHITI_RUNTIME_STATE_PATH:-tmp/graphiti-runtime-state.json}"

export SIGNAL_NOISE_BACKEND_PORT="${SIGNAL_NOISE_BACKEND_PORT:-8002}"
export GRAPHITI_MCP_PORT="${GRAPHITI_MCP_PORT:-8000}"
export GRAPHITI_REQUIRED="${GRAPHITI_REQUIRED:-0}"
export GRAPHITI_RUNTIME_STATE_PATH="${GRAPHITI_RUNTIME_STATE_PATH:-${graphiti_runtime_state_file}}"
export GRAPHITI_MCP_URL="${GRAPHITI_MCP_URL:-http://127.0.0.1:${GRAPHITI_MCP_PORT}/mcp/}"
export FALKORDB_URI="${FALKORDB_URI:-redis://localhost:6379}"
export FALKORDB_USER="${FALKORDB_USER:-}"
export FALKORDB_PASSWORD="${FALKORDB_PASSWORD:-}"
export FALKORDB_DATABASE="${FALKORDB_DATABASE:-sports_intelligence}"
export BACKEND_PORT="${BACKEND_PORT:-${SIGNAL_NOISE_BACKEND_PORT}}"
export FASTAPI_URL="${FASTAPI_URL:-http://127.0.0.1:${SIGNAL_NOISE_BACKEND_PORT}}"
export PYTHON_BACKEND_URL="${PYTHON_BACKEND_URL:-http://127.0.0.1:${SIGNAL_NOISE_BACKEND_PORT}}"
export BRIGHTDATA_FASTMCP_HOST="${BRIGHTDATA_FASTMCP_HOST:-127.0.0.1}"
export BRIGHTDATA_FASTMCP_PORT=8014
export BRIGHTDATA_FASTMCP_URL="${BRIGHTDATA_FASTMCP_URL:-http://127.0.0.1:8014/mcp/}"

resolve_npm_bin() {
  local candidate=""

  if candidate="$(command -v npm 2>/dev/null)"; then
    printf '%s\n' "${candidate}"
    return 0
  fi

  for candidate in /opt/homebrew/bin/npm /usr/local/bin/npm /usr/bin/npm; do
    if [[ -x "${candidate}" ]]; then
      printf '%s\n' "${candidate}"
      return 0
    fi
  done

  if command -v zsh >/dev/null 2>&1; then
    candidate="$(zsh -lic 'command -v npm 2>/dev/null || true' | tail -n 1 | tr -d '\r')"
    if [[ -n "${candidate}" ]] && [[ -x "${candidate}" ]]; then
      printf '%s\n' "${candidate}"
      return 0
    fi
  fi

  return 1
}

resolve_node_bin() {
  local candidate=""

  if candidate="$(command -v node 2>/dev/null)"; then
    printf '%s\n' "${candidate}"
    return 0
  fi

  for candidate in /opt/homebrew/bin/node /usr/local/bin/node /usr/bin/node; do
    if [[ -x "${candidate}" ]]; then
      printf '%s\n' "${candidate}"
      return 0
    fi
  done

  if [[ -n "${NPM_BIN}" ]]; then
    candidate="$(cd "$(dirname "${NPM_BIN}")" && pwd)/node"
    if [[ -x "${candidate}" ]]; then
      printf '%s\n' "${candidate}"
      return 0
    fi
  fi

  if command -v zsh >/dev/null 2>&1; then
    candidate="$(zsh -lic 'command -v node 2>/dev/null || true' | tail -n 1 | tr -d '\r')"
    if [[ -n "${candidate}" ]] && [[ -x "${candidate}" ]]; then
      printf '%s\n' "${candidate}"
      return 0
    fi
  fi

  return 1
}

NPM_BIN="${NPM_BIN:-}"
if [[ -z "${NPM_BIN}" ]]; then
  if ! NPM_BIN="$(resolve_npm_bin)"; then
    echo "Unable to locate npm for dev-full.sh; ensure Node.js is installed or available on PATH." >&2
    exit 1
  fi
fi
if [[ -z "${NODE_BIN}" ]]; then
  if ! NODE_BIN="$(resolve_node_bin)"; then
    echo "Unable to locate node for dev-full.sh; ensure Node.js is installed or available on PATH." >&2
    exit 1
  fi
fi
PATH="$(dirname "${NODE_BIN}")":"$(dirname "${NPM_BIN}")":${PATH:-/usr/bin:/bin}
export NPM_BIN
export NODE_BIN
export PATH

cleanup() {
  if [[ -n "${recovery_supervisor_pid}" ]] && kill -0 "${recovery_supervisor_pid}" 2>/dev/null; then
    kill "${recovery_supervisor_pid}" 2>/dev/null || true
    wait "${recovery_supervisor_pid}" 2>/dev/null || true
  fi

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
  elif [[ -f "${frontend_pid_file}" ]]; then
    local saved_frontend_pid
    saved_frontend_pid="$(cat "${frontend_pid_file}" 2>/dev/null || true)"
    if [[ -n "${saved_frontend_pid}" ]] && kill -0 "${saved_frontend_pid}" 2>/dev/null; then
      kill "${saved_frontend_pid}" 2>/dev/null || true
      wait "${saved_frontend_pid}" 2>/dev/null || true
    fi
  fi

  if [[ -n "${backend_pid}" ]] && kill -0 "${backend_pid}" 2>/dev/null; then
    kill "${backend_pid}" 2>/dev/null || true
    wait "${backend_pid}" 2>/dev/null || true
  elif [[ -f "${backend_pid_file}" ]]; then
    local saved_backend_pid
    saved_backend_pid="$(cat "${backend_pid_file}" 2>/dev/null || true)"
    if [[ -n "${saved_backend_pid}" ]] && kill -0 "${saved_backend_pid}" 2>/dev/null; then
      kill "${saved_backend_pid}" 2>/dev/null || true
      wait "${saved_backend_pid}" 2>/dev/null || true
    fi
  fi

  if [[ -n "${graphiti_mcp_pid}" ]] && kill -0 "${graphiti_mcp_pid}" 2>/dev/null; then
    kill "${graphiti_mcp_pid}" 2>/dev/null || true
    wait "${graphiti_mcp_pid}" 2>/dev/null || true
  elif [[ -f "${graphiti_mcp_pid_file}" ]]; then
    local saved_graphiti_mcp_pid
    saved_graphiti_mcp_pid="$(cat "${graphiti_mcp_pid_file}" 2>/dev/null || true)"
    if [[ -n "${saved_graphiti_mcp_pid}" ]] && kill -0 "${saved_graphiti_mcp_pid}" 2>/dev/null; then
      kill "${saved_graphiti_mcp_pid}" 2>/dev/null || true
      wait "${saved_graphiti_mcp_pid}" 2>/dev/null || true
    fi
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
import os
import sys
from urllib.request import urlopen

with urlopen(os.environ["FASTAPI_URL"] + "/health", timeout=2) as response:
    payload = json.loads(response.read().decode("utf-8"))
if payload.get("status") != "healthy" or payload.get("version") != "2.0.0":
    raise SystemExit(1)
with urlopen(os.environ["FASTAPI_URL"] + "/openapi.json", timeout=2) as response:
    openapi = json.loads(response.read().decode("utf-8"))
if "/api/pipeline/run-entity" not in (openapi.get("paths") or {}):
    raise SystemExit(1)
PY
      return 0
    fi

    sleep 1
  done

  echo "Backend failed to become ready on ${FASTAPI_URL}" >&2
  lsof -nP -iTCP:"${SIGNAL_NOISE_BACKEND_PORT}" -sTCP:LISTEN >&2 || true
  return 1
}

wait_for_graphiti_mcp() {
  for _ in $(seq 1 60); do
    if curl -sf "http://127.0.0.1:${GRAPHITI_MCP_PORT}/health" >/dev/null; then
      return 0
    fi

    sleep 1
  done

  echo "Graphiti MCP failed to become ready on ${GRAPHITI_MCP_URL}" >&2
  lsof -nP -iTCP:"${GRAPHITI_MCP_PORT}" -sTCP:LISTEN >&2 || true
  return 1
}

write_graphiti_runtime_state() {
  local mode="$1"
  local reason="$2"
  local reason_json="null"
  if [[ -n "${reason}" ]]; then
    reason_json="\"${reason}\""
  fi
  mkdir -p "$(dirname "${graphiti_runtime_state_file}")"
  cat > "${graphiti_runtime_state_file}" <<EOF
{
  "graphiti_runtime_mode": "${mode}",
  "graphiti_degraded_reason": ${reason_json},
  "falkordb_graph_available": $([[ "${mode}" == "ready" ]] && echo true || echo false),
  "graphiti_mcp_available": $([[ "${mode}" == "ready" ]] && echo true || echo false),
  "updated_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "next_recovery_action": "$([[ "${mode}" == "ready" ]] && echo "No action required." || echo "Point FALKORDB_URI at a real FalkorDB graph endpoint, then restart dev-full so Graphiti MCP can start.")"
}
EOF
}

check_falkordb_graph() {
  local graph_probe_output=""
  local redis_cli_args=("-u" "${FALKORDB_URI}")

  if ! command -v redis-cli >/dev/null 2>&1; then
    echo "FalkorDB graph preflight failed: redis-cli executable not found on PATH." >&2
    return 1
  fi

  if [[ -n "${FALKORDB_PASSWORD}" && "${FALKORDB_URI}" != *"@"* ]]; then
    redis_cli_args+=("--user" "${FALKORDB_USER:-default}" "--pass" "${FALKORDB_PASSWORD}")
  fi

  graph_probe_output="$(redis-cli "${redis_cli_args[@]}" GRAPH.QUERY "${FALKORDB_DATABASE}" "RETURN 1" 2>&1 || true)"
  if [[ "${graph_probe_output}" == *"ERR unknown command 'GRAPH.QUERY'"* ]] || [[ "${graph_probe_output}" == *"unknown command 'GRAPH.QUERY'"* ]]; then
    echo "FalkorDB graph module is not available at ${FALKORDB_URI}; Graphiti MCP requires FalkorDB, but this endpoint did not accept GRAPH.QUERY." >&2
    echo "${graph_probe_output}" >&2
    write_graphiti_runtime_state "degraded" "falkordb_graph_unavailable"
    if [[ "${GRAPHITI_REQUIRED}" == "1" ]]; then
      return 1
    fi
    return 1
  fi

  if [[ "${graph_probe_output}" == ERR* ]] || [[ "${graph_probe_output}" == *"NOAUTH"* ]] || [[ "${graph_probe_output}" == *"Authentication"* ]]; then
    echo "FalkorDB graph preflight failed for ${FALKORDB_URI}." >&2
    echo "${graph_probe_output}" >&2
    write_graphiti_runtime_state "degraded" "falkordb_probe_failed"
    if [[ "${GRAPHITI_REQUIRED}" == "1" ]]; then
      return 1
    fi
    return 1
  fi

  write_graphiti_runtime_state "ready" ""
  return 0
}

prewarm_entity_snapshot() {
  curl -sf 'http://127.0.0.1:3005/api/entities?page=1&limit=10&entityType=all&sortBy=name&sortOrder=asc' >/dev/null
  curl -sf 'http://127.0.0.1:3005/api/entities/summary' >/dev/null
}

start_graphiti_mcp() {
  mkdir -p tmp
  if wait_for_graphiti_mcp >/dev/null 2>&1; then
    return 0
  fi

  : > "${graphiti_mcp_log_file}"
  if ! command -v uv >/dev/null 2>&1; then
    echo "Graphiti MCP restart failed: uv executable not found on PATH" >&2
    rm -f "${graphiti_mcp_pid_file}"
    return 1
  fi

  (
    cd backend/graphiti_mcp_server_official
    uv run python main.py --transport http --host 0.0.0.0 --port "${GRAPHITI_MCP_PORT}" --database-provider falkordb
  ) > "${graphiti_mcp_log_file}" 2>&1 &
  graphiti_mcp_pid=$!
  echo "${graphiti_mcp_pid}" > "${graphiti_mcp_pid_file}"
  if ! wait_for_graphiti_mcp; then
    echo "Graphiti MCP restart failed: health checks failed" >&2
    rm -f "${graphiti_mcp_pid_file}"
    return 1
  fi
}

restart_graphiti_mcp() {
  if [[ -n "${graphiti_mcp_pid}" ]] && kill -0 "${graphiti_mcp_pid}" 2>/dev/null; then
    kill "${graphiti_mcp_pid}" 2>/dev/null || true
    wait "${graphiti_mcp_pid}" 2>/dev/null || true
  fi
  start_graphiti_mcp
}

start_backend() {
  mkdir -p tmp
  if ! [[ -x "${NPM_BIN}" ]]; then
    echo "backend restart failed: npm executable not found at ${NPM_BIN}" >&2
    rm -f "${backend_pid_file}"
    return 1
  fi
  PANTHER_CHAT_ALLOW_DIRECT_START=1 "${NPM_BIN}" run backend:dev &
  backend_pid=$!
  echo "${backend_pid}" > "${backend_pid_file}"
  if ! wait_for_backend; then
    echo "backend restart failed: backend failed readiness checks" >&2
    rm -f "${backend_pid_file}"
    return 1
  fi
}

restart_backend() {
  if [[ -n "${backend_pid}" ]] && kill -0 "${backend_pid}" 2>/dev/null; then
    kill "${backend_pid}" 2>/dev/null || true
    wait "${backend_pid}" 2>/dev/null || true
  fi
  start_backend
}

start_frontend() {
  mkdir -p tmp
  if ! [[ -x "${NPM_BIN}" ]]; then
    echo "frontend restart failed: npm executable not found at ${NPM_BIN}" >&2
    rm -f "${frontend_pid_file}"
    return 1
  fi
  PANTHER_CHAT_ALLOW_DIRECT_START=1 "${NPM_BIN}" run dev:frontend &
  frontend_pid=$!
  echo "${frontend_pid}" > "${frontend_pid_file}"
  if ! wait_for_frontend; then
    echo "frontend restart failed: frontend failed readiness checks" >&2
    rm -f "${frontend_pid_file}"
    return 1
  fi
  prewarm_entity_snapshot
}

restart_frontend() {
  if [[ -n "${frontend_pid}" ]] && kill -0 "${frontend_pid}" 2>/dev/null; then
    kill "${frontend_pid}" 2>/dev/null || true
    wait "${frontend_pid}" 2>/dev/null || true
  fi
  start_frontend
}

start_worker_supervisor() {
  mkdir -p tmp
  : > "${worker_log_file}"

  if ! [[ -x "${NPM_BIN}" ]]; then
    echo "worker restart failed: npm executable not found at ${NPM_BIN}" >&2
    rm -f "${worker_supervisor_pid_file}" "${worker_pid_file}"
    return 1
  fi

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
  "worker_command": "${NPM_BIN} run worker:entity-pipeline",
  "worker_state_path": "$(pwd)/${worker_state_file}",
  "worker_pid_path": "$(pwd)/${worker_pid_file}",
  "started_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "stopped_at": null,
  "updated_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "last_error": null
}
EOF

      PANTHER_CHAT_ALLOW_DIRECT_START=1 "${NPM_BIN}" run worker:entity-pipeline > "${worker_log_file}" 2>&1 &
      worker_child_pid=$!
      worker_pid="${worker_child_pid}"
      echo "${worker_child_pid}" > "${worker_pid_file}"

      cat > "${worker_state_file}" <<EOF
{
  "worker_process_state": "running",
  "worker_pid": ${worker_child_pid},
  "worker_command": "${NPM_BIN} run worker:entity-pipeline",
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
  "worker_command": "${NPM_BIN} run worker:entity-pipeline",
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

ensure_worker_supervisor_running() {
  if [[ -n "${worker_supervisor_pid}" ]] && kill -0 "${worker_supervisor_pid}" 2>/dev/null; then
    return 0
  fi
  if [[ -f "${worker_supervisor_pid_file}" ]]; then
    local existing_supervisor_pid
    existing_supervisor_pid="$(cat "${worker_supervisor_pid_file}" 2>/dev/null || true)"
    if [[ -n "${existing_supervisor_pid}" ]] && kill -0 "${existing_supervisor_pid}" 2>/dev/null; then
      worker_supervisor_pid="${existing_supervisor_pid}"
      return 0
    fi
  fi
  start_worker_supervisor
}

start_recovery_supervisor() {
  (
    while true; do
      if [[ "${graphiti_mcp_enabled}" == "1" ]] && ! wait_for_graphiti_mcp >/dev/null 2>&1; then
        echo "recovery supervisor: Graphiti MCP unhealthy; restarting Graphiti MCP" >&2
        restart_graphiti_mcp
      fi

      if ! wait_for_backend >/dev/null 2>&1; then
        echo "recovery supervisor: backend unhealthy; restarting backend and worker supervisor" >&2
        restart_backend
        ensure_worker_supervisor_running
      fi

      if ! curl -sf http://127.0.0.1:3005/api/health >/dev/null 2>&1; then
        echo "recovery supervisor: frontend unhealthy; restarting frontend" >&2
        restart_frontend
      fi

      ensure_worker_supervisor_running
      sleep 5
    done
  ) &
  recovery_supervisor_pid=$!
}
if check_falkordb_graph; then
  graphiti_mcp_enabled="1"
  start_graphiti_mcp
else
  graphiti_mcp_enabled="0"
  if [[ "${GRAPHITI_REQUIRED}" == "1" ]]; then
    exit 1
  fi
  echo "Graphiti MCP skipped; continuing in graphiti_runtime_mode=degraded." >&2
fi
start_backend
ensure_worker_supervisor_running
start_frontend
start_recovery_supervisor

wait "${recovery_supervisor_pid}"
