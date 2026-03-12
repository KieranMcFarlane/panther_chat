#!/usr/bin/env bash
set -euo pipefail

PY_BIN="${PYTHON_BIN:-python3}"

echo "Pipeline runtime check"
echo "Using Python: ${PY_BIN}"

if ! command -v "${PY_BIN}" >/dev/null 2>&1; then
  echo "ERROR: Python interpreter not found: ${PY_BIN}"
  exit 2
fi

"${PY_BIN}" - <<'PY'
import importlib
import platform
import sys

print(f"Python version: {platform.python_version()}")
print(f"Executable: {sys.executable}")

modules = ["fastapi", "uvicorn", "httpx", "supabase", "dotenv"]
missing = []
for m in modules:
    try:
        importlib.import_module(m)
    except Exception as e:
        missing.append((m, str(e)))

if missing:
    print("ERROR: Missing or broken Python modules:")
    for name, err in missing:
        print(f" - {name}: {err[:200]}")
    raise SystemExit(3)

print("Python module checks passed.")
PY

echo "Runtime check passed."
