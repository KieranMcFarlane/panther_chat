#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

TIMEOUT_SECONDS="${1:-2700}"
STAMP="$(date +%Y%m%d_%H%M%S)"
REPORT_DIR="backend/data/dossiers/run_reports"
mkdir -p "$REPORT_DIR"
TIER_SCORE="${PIPELINE_BATCH_TIER_SCORE:-35}"
MAX_ITERATIONS="${PIPELINE_BATCH_MAX_DISCOVERY_ITERATIONS:-}"
USE_CANONICAL="${PIPELINE_USE_CANONICAL_ORCHESTRATOR:-false}"
USE_CACHE="${DOSSIER_USE_CACHE:-false}"
NEWS_MAX_QUERIES="${DOSSIER_RECENT_NEWS_MAX_QUERIES:-2}"
NEWS_RESULTS_PER_QUERY="${DOSSIER_RECENT_NEWS_RESULTS_PER_QUERY:-3}"
NEWS_MAX_ITEMS="${DOSSIER_RECENT_NEWS_MAX_ITEMS:-4}"
STRATEGIC_MAX_SEARCHES="${DOSSIER_STRATEGIC_MAX_SEARCHES:-2}"
STRATEGIC_RESULTS_PER_SEARCH="${DOSSIER_STRATEGIC_RESULTS_PER_SEARCH:-1}"
STRATEGIC_MAX_EVALS="${DOSSIER_STRATEGIC_MAX_EVALS:-4}"
SECTION_TIMEOUT_SECONDS="${DOSSIER_SECTION_TIMEOUT_SECONDS:-40}"
PARALLEL_COLLECTION_TIMEOUT_SECONDS="${DOSSIER_PARALLEL_COLLECTION_TIMEOUT_SECONDS:-75}"
SECTION_BASELINE_MODE="${DOSSIER_SECTION_USE_DATA_DRIVEN_BASELINE:-true}"
DISCOVERY_EVAL_TIMEOUT_SECONDS="${DISCOVERY_EVALUATION_QUERY_TIMEOUT_SECONDS:-18}"
DISCOVERY_EVAL_TIMEOUT_RETRIES="${DISCOVERY_EVALUATION_TIMEOUT_MAX_RETRIES:-1}"
DISCOVERY_MAX_NO_PROGRESS="${DISCOVERY_MAX_CONSECUTIVE_NO_PROGRESS:-3}"

declare -a ENTITIES=(
  "coventry-city-fc|Coventry City FC|CLUB"
  "arsenal-fc|Arsenal FC|CLUB"
  "fiba|FIBA|FEDERATION"
)

SUMMARY_FILE="$REPORT_DIR/regression_batch_${STAMP}.json"
TMP_FILE="$(mktemp)"
echo "[]" > "$TMP_FILE"

for row in "${ENTITIES[@]}"; do
  IFS='|' read -r ENTITY_ID ENTITY_NAME ENTITY_TYPE <<< "$row"
  LOG_FILE="tmp_pipeline_batch_${ENTITY_ID}_${STAMP}.log"
  TEMPLATE_ID="$(PYTHONPATH=backend python3 - <<'PY' "$ENTITY_ID" "$ENTITY_NAME" "$ENTITY_TYPE"
from backend.hypothesis_driven_discovery import resolve_template_id
import sys
print(resolve_template_id(None, sys.argv[3], entity_id=sys.argv[1], entity_name=sys.argv[2]))
PY
)"
  ENTITY_MAX_ITERATIONS="$MAX_ITERATIONS"
  if [[ -z "$ENTITY_MAX_ITERATIONS" ]]; then
    ENTITY_MAX_ITERATIONS="$(PYTHONPATH=backend python3 - <<'PY' "$TEMPLATE_ID"
from backend.hypothesis_driven_discovery import get_template_recommended_hop_cap
import sys
print(get_template_recommended_hop_cap(sys.argv[1], fallback=5))
PY
)"
  fi
  echo "==> Running ${ENTITY_NAME} (${ENTITY_ID})"
  echo "    template=${TEMPLATE_ID} max_iterations=${ENTITY_MAX_ITERATIONS}"
  set +e
  CMD=(
    python3 run_fixed_dossier_pipeline.py
      --entity-id "$ENTITY_ID"
      --entity-name "$ENTITY_NAME"
      --entity-type "$ENTITY_TYPE"
      --tier-score "$TIER_SCORE"
      --template-id "$TEMPLATE_ID"
  )
  if [[ -n "$ENTITY_MAX_ITERATIONS" ]]; then
    CMD+=(--max-discovery-iterations "$ENTITY_MAX_ITERATIONS")
  fi
  PIPELINE_USE_CANONICAL_ORCHESTRATOR="$USE_CANONICAL" \
  DOSSIER_USE_CACHE="$USE_CACHE" \
  DOSSIER_RECENT_NEWS_MAX_QUERIES="$NEWS_MAX_QUERIES" \
  DOSSIER_RECENT_NEWS_RESULTS_PER_QUERY="$NEWS_RESULTS_PER_QUERY" \
  DOSSIER_RECENT_NEWS_MAX_ITEMS="$NEWS_MAX_ITEMS" \
  DOSSIER_STRATEGIC_MAX_SEARCHES="$STRATEGIC_MAX_SEARCHES" \
  DOSSIER_STRATEGIC_RESULTS_PER_SEARCH="$STRATEGIC_RESULTS_PER_SEARCH" \
  DOSSIER_STRATEGIC_MAX_EVALS="$STRATEGIC_MAX_EVALS" \
  DOSSIER_SECTION_TIMEOUT_SECONDS="$SECTION_TIMEOUT_SECONDS" \
  DOSSIER_PARALLEL_COLLECTION_TIMEOUT_SECONDS="$PARALLEL_COLLECTION_TIMEOUT_SECONDS" \
  DOSSIER_SECTION_GENERATION_TIMEOUT_SECONDS="$SECTION_TIMEOUT_SECONDS" \
  DOSSIER_SECTION_USE_DATA_DRIVEN_BASELINE="$SECTION_BASELINE_MODE" \
  DISCOVERY_EVALUATION_QUERY_TIMEOUT_SECONDS="$DISCOVERY_EVAL_TIMEOUT_SECONDS" \
  DISCOVERY_EVALUATION_TIMEOUT_MAX_RETRIES="$DISCOVERY_EVAL_TIMEOUT_RETRIES" \
  DISCOVERY_MAX_CONSECUTIVE_NO_PROGRESS="$DISCOVERY_MAX_NO_PROGRESS" \
  PYTHONPATH=backend \
  timeout "$TIMEOUT_SECONDS" \
    "${CMD[@]}" 2>&1 | tee "$LOG_FILE"
  EXIT_CODE=${PIPESTATUS[0]}
  set -e

  REPORT_PATH="$(python3 - <<'PY' "$LOG_FILE"
import re
import sys
from pathlib import Path

log_path = Path(sys.argv[1])
report_path = ""
for line in log_path.read_text(errors="ignore").splitlines():
    match = re.search(r'"run_report_path"\s*:\s*"([^"]+)"', line)
    if match:
        report_path = match.group(1)
print(report_path)
PY
)"
  if [[ -z "${REPORT_PATH}" ]]; then
    REPORT_PATH=""
  fi
  METRICS_JSON="$(python3 - <<'PY' "$REPORT_PATH"
import json
import sys
from pathlib import Path

path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("")
payload = {
    "final_confidence": None,
    "signals_discovered": None,
    "acceptance_gate_passed": None,
    "acceptance_gate_reasons": [],
    "llm_last_status": None,
    "parse_path": None,
    "import_context_failure": None,
    "llm_empty_response": None,
    "schema_gate_fallback": None,
    "low_signal_content": None,
    "entity_grounding_reject": None,
}
if path and path.exists():
    try:
        report = json.loads(path.read_text())
    except Exception:
        report = {}
    metrics = report.get("metrics", {}) if isinstance(report, dict) else {}
    failure_taxonomy = metrics.get("failure_taxonomy", {}) if isinstance(metrics, dict) else {}
    gate = report.get("acceptance_gate", {}) if isinstance(report, dict) else {}
    payload["final_confidence"] = metrics.get("final_confidence")
    payload["signals_discovered"] = metrics.get("signals_discovered")
    payload["acceptance_gate_passed"] = gate.get("passed")
    payload["acceptance_gate_reasons"] = gate.get("reasons") or []
    payload["llm_last_status"] = metrics.get("llm_last_status")
    payload["parse_path"] = metrics.get("parse_path")
    payload["import_context_failure"] = failure_taxonomy.get("import_context_failure")
    payload["llm_empty_response"] = failure_taxonomy.get("llm_empty_response")
    payload["schema_gate_fallback"] = failure_taxonomy.get("schema_gate_fallback")
    payload["low_signal_content"] = failure_taxonomy.get("low_signal_content")
    payload["entity_grounding_reject"] = failure_taxonomy.get("entity_grounding_reject")
print(json.dumps(payload))
PY
)"
  jq \
    --arg entity_id "$ENTITY_ID" \
    --arg entity_name "$ENTITY_NAME" \
    --arg entity_type "$ENTITY_TYPE" \
    --arg log_file "$LOG_FILE" \
    --arg report_path "$REPORT_PATH" \
    --argjson metrics "$METRICS_JSON" \
    --argjson exit_code "$EXIT_CODE" \
    '. += [{"entity_id":$entity_id,"entity_name":$entity_name,"entity_type":$entity_type,"exit_code":$exit_code,"log_file":$log_file,"run_report_path":$report_path} + $metrics]' \
    "$TMP_FILE" > "${TMP_FILE}.next"
  mv "${TMP_FILE}.next" "$TMP_FILE"
done

mv "$TMP_FILE" "$SUMMARY_FILE"
echo "Batch summary: $SUMMARY_FILE"
