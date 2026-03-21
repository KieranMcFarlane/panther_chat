#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

TIMEOUT_SECONDS="${1:-2700}"
STAMP="$(date +%Y%m%d_%H%M%S)"
REPORT_DIR="backend/data/dossiers/run_reports"
mkdir -p "$REPORT_DIR"
PIPELINE_LEAN_VERIFY="${PIPELINE_LEAN_VERIFY:-false}"
PIPELINE_LEAN_VERIFY_NORMALIZED="$(printf '%s' "$PIPELINE_LEAN_VERIFY" | tr '[:upper:]' '[:lower:]')"
TIER_SCORE="${PIPELINE_BATCH_TIER_SCORE:-35}"
MAX_ITERATIONS="${PIPELINE_BATCH_MAX_DISCOVERY_ITERATIONS:-5}"
USE_CANONICAL="${PIPELINE_USE_CANONICAL_ORCHESTRATOR:-true}"
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
DISCOVERY_EVAL_TIMEOUT_RETRIES="${DISCOVERY_EVALUATION_TIMEOUT_MAX_RETRIES:-2}"
DISCOVERY_MAX_NO_PROGRESS="${DISCOVERY_MAX_CONSECUTIVE_NO_PROGRESS:-3}"
DISCOVERY_POLICY_EVIDENCE_FIRST="${DISCOVERY_POLICY_EVIDENCE_FIRST:-true}"
DISCOVERY_ENGINE="${DISCOVERY_ENGINE:-v2}"
DISCOVERY_V2_LLM_EVAL_ENABLED="${DISCOVERY_V2_LLM_EVAL_ENABLED:-true}"
DISCOVERY_SHADOW_ENGINE="${DISCOVERY_SHADOW_ENGINE:-legacy}"
DISCOVERY_MAX_EVALS_PER_HOP="${DISCOVERY_MAX_EVALS_PER_HOP:-2}"
DISCOVERY_PER_ITERATION_TIMEOUT_SECONDS="${DISCOVERY_PER_ITERATION_TIMEOUT_SECONDS:-30}"
DISCOVERY_URL_REPEAT_MAX_HITS="${DISCOVERY_URL_REPEAT_MAX_HITS:-2}"
DISCOVERY_MAX_HOPS="${DISCOVERY_MAX_HOPS:-5}"
DISCOVERY_MAX_RETRIES="${DISCOVERY_MAX_RETRIES:-2}"
DISCOVERY_MAX_SAME_DOMAIN_REVISITS="${DISCOVERY_MAX_SAME_DOMAIN_REVISITS:-2}"
DOSSIER_COLLECT_PARALLEL_LEADERSHIP="${DOSSIER_COLLECT_PARALLEL_LEADERSHIP:-false}"
DOSSIER_RUN_POST_COLLECTION_ENRICHMENT="${DOSSIER_RUN_POST_COLLECTION_ENRICHMENT:-false}"

if [[ "$PIPELINE_LEAN_VERIFY_NORMALIZED" == "true" ]]; then
  MAX_ITERATIONS="${PIPELINE_BATCH_MAX_DISCOVERY_ITERATIONS:-3}"
  NEWS_MAX_QUERIES="${DOSSIER_RECENT_NEWS_MAX_QUERIES:-1}"
  NEWS_RESULTS_PER_QUERY="${DOSSIER_RECENT_NEWS_RESULTS_PER_QUERY:-2}"
  NEWS_MAX_ITEMS="${DOSSIER_RECENT_NEWS_MAX_ITEMS:-3}"
  STRATEGIC_MAX_SEARCHES="${DOSSIER_STRATEGIC_MAX_SEARCHES:-1}"
  STRATEGIC_RESULTS_PER_SEARCH="${DOSSIER_STRATEGIC_RESULTS_PER_SEARCH:-1}"
  STRATEGIC_MAX_EVALS="${DOSSIER_STRATEGIC_MAX_EVALS:-2}"
  SECTION_TIMEOUT_SECONDS="${DOSSIER_SECTION_TIMEOUT_SECONDS:-25}"
  PARALLEL_COLLECTION_TIMEOUT_SECONDS="${DOSSIER_PARALLEL_COLLECTION_TIMEOUT_SECONDS:-45}"
  DISCOVERY_EVAL_TIMEOUT_SECONDS="${DISCOVERY_EVALUATION_QUERY_TIMEOUT_SECONDS:-12}"
  DISCOVERY_EVAL_TIMEOUT_RETRIES="${DISCOVERY_EVALUATION_TIMEOUT_MAX_RETRIES:-1}"
  DISCOVERY_MAX_NO_PROGRESS="${DISCOVERY_MAX_CONSECUTIVE_NO_PROGRESS:-2}"
  DISCOVERY_MAX_EVALS_PER_HOP="${DISCOVERY_MAX_EVALS_PER_HOP:-1}"
  DISCOVERY_PER_ITERATION_TIMEOUT_SECONDS="${DISCOVERY_PER_ITERATION_TIMEOUT_SECONDS:-20}"
  DISCOVERY_MAX_HOPS="${DISCOVERY_MAX_HOPS:-3}"
  DISCOVERY_MAX_RETRIES="${DISCOVERY_MAX_RETRIES:-1}"
  DISCOVERY_MAX_SAME_DOMAIN_REVISITS="${DISCOVERY_MAX_SAME_DOMAIN_REVISITS:-1}"
  DOSSIER_COLLECT_PARALLEL_LEADERSHIP="${DOSSIER_COLLECT_PARALLEL_LEADERSHIP:-false}"
  DOSSIER_RUN_POST_COLLECTION_ENRICHMENT="${DOSSIER_RUN_POST_COLLECTION_ENRICHMENT:-false}"
fi

declare -a ENTITIES=(
  "coventry-city-fc|Coventry City FC|CLUB"
  "arsenal-fc|Arsenal FC|CLUB"
  "fiba|FIBA|FEDERATION"
)

SUMMARY_FILE="${BATCH_SUMMARY_PATH:-$REPORT_DIR/regression_batch_${STAMP}.json}"
TMP_FILE="$(mktemp)"
echo "[]" > "$TMP_FILE"

for row in "${ENTITIES[@]}"; do
  IFS='|' read -r ENTITY_ID ENTITY_NAME ENTITY_TYPE <<< "$row"
  LOG_FILE="tmp_pipeline_batch_${ENTITY_ID}_${STAMP}.log"
  ENTITY_MAX_ITERATIONS="$MAX_ITERATIONS"
  echo "==> Running ${ENTITY_NAME} (${ENTITY_ID})"
  echo "    discovery_engine=${DISCOVERY_ENGINE} max_iterations=${ENTITY_MAX_ITERATIONS} lean_verify=${PIPELINE_LEAN_VERIFY}"
  set +e
  CMD=(
    python3 run_fixed_dossier_pipeline.py
      --entity-id "$ENTITY_ID"
      --entity-name "$ENTITY_NAME"
      --entity-type "$ENTITY_TYPE"
      --tier-score "$TIER_SCORE"
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
  DOSSIER_COLLECT_PARALLEL_LEADERSHIP="$DOSSIER_COLLECT_PARALLEL_LEADERSHIP" \
  DOSSIER_RUN_POST_COLLECTION_ENRICHMENT="$DOSSIER_RUN_POST_COLLECTION_ENRICHMENT" \
  DISCOVERY_EVALUATION_QUERY_TIMEOUT_SECONDS="$DISCOVERY_EVAL_TIMEOUT_SECONDS" \
  DISCOVERY_EVALUATION_TIMEOUT_MAX_RETRIES="$DISCOVERY_EVAL_TIMEOUT_RETRIES" \
  DISCOVERY_MAX_CONSECUTIVE_NO_PROGRESS="$DISCOVERY_MAX_NO_PROGRESS" \
  DISCOVERY_POLICY_EVIDENCE_FIRST="$DISCOVERY_POLICY_EVIDENCE_FIRST" \
  DISCOVERY_ENGINE="$DISCOVERY_ENGINE" \
  DISCOVERY_V2_LLM_EVAL_ENABLED="$DISCOVERY_V2_LLM_EVAL_ENABLED" \
  DISCOVERY_SHADOW_ENGINE="$DISCOVERY_SHADOW_ENGINE" \
  DISCOVERY_MAX_EVALS_PER_HOP="$DISCOVERY_MAX_EVALS_PER_HOP" \
  DISCOVERY_PER_ITERATION_TIMEOUT_SECONDS="$DISCOVERY_PER_ITERATION_TIMEOUT_SECONDS" \
  DISCOVERY_ITERATION_TIMEOUT_SECONDS="$DISCOVERY_PER_ITERATION_TIMEOUT_SECONDS" \
  DISCOVERY_URL_REPEAT_MAX_HITS="$DISCOVERY_URL_REPEAT_MAX_HITS" \
  DISCOVERY_MAX_HOPS="$DISCOVERY_MAX_HOPS" \
  DISCOVERY_MAX_RETRIES="$DISCOVERY_MAX_RETRIES" \
  DISCOVERY_MAX_SAME_DOMAIN_REVISITS="$DISCOVERY_MAX_SAME_DOMAIN_REVISITS" \
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
    "supabase_write_failure": None,
    "falkordb_write_failure": None,
    "dual_write_incomplete": None,
    "dual_write_ok": None,
    "persistence_status": None,
    "accepted_empty_evidence_count": None,
    "synthetic_url_attempt_count": None,
    "length_stop_count": None,
    "schema_fail_count": None,
    "empty_content_count": None,
    "strict_eval_metrics_by_model": None,
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
    payload["supabase_write_failure"] = failure_taxonomy.get("supabase_write_failure")
    payload["falkordb_write_failure"] = failure_taxonomy.get("falkordb_write_failure")
    payload["dual_write_incomplete"] = failure_taxonomy.get("dual_write_incomplete")
    payload["dual_write_ok"] = metrics.get("dual_write_ok")
    payload["persistence_status"] = metrics.get("persistence_status")
    payload["accepted_empty_evidence_count"] = metrics.get("accepted_empty_evidence_count")
    payload["synthetic_url_attempt_count"] = metrics.get("synthetic_url_attempt_count")
    payload["length_stop_count"] = metrics.get("length_stop_count")
    payload["schema_fail_count"] = metrics.get("schema_fail_count")
    payload["empty_content_count"] = metrics.get("empty_content_count")
    payload["strict_eval_metrics_by_model"] = metrics.get("strict_eval_metrics_by_model")
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
