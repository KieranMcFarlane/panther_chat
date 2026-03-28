#!/usr/bin/env bash
set -euo pipefail

backend_url="${FASTAPI_URL:-${PYTHON_BACKEND_URL:-http://127.0.0.1:8000}}"
worker_pid_file="tmp/entity-pipeline-worker.pid"

if ! curl -sf "${backend_url%/}/health" >/dev/null; then
  echo "Backend health check failed at ${backend_url%/}/health" >&2
  exit 1
fi

if [[ ! -f "${worker_pid_file}" ]]; then
  echo "Pipeline worker pid file is missing: ${worker_pid_file}" >&2
  exit 1
fi

worker_pid="$(cat "${worker_pid_file}" 2>/dev/null || true)"
if [[ -z "${worker_pid}" ]]; then
  echo "Pipeline worker pid file is empty: ${worker_pid_file}" >&2
  exit 1
fi

if ! kill -0 "${worker_pid}" 2>/dev/null; then
  echo "Pipeline worker is not running: pid ${worker_pid}" >&2
  exit 1
fi

echo "Pipeline runtime healthy: backend reachable and worker ${worker_pid} alive."
