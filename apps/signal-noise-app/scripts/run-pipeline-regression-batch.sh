#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

TIMEOUT_SECONDS="${1:-2700}"
STAMP="$(date +%Y%m%d_%H%M%S)"
REPORT_DIR="backend/data/dossiers/run_reports"
mkdir -p "$REPORT_DIR"
TIER_SCORE="${PIPELINE_BATCH_TIER_SCORE:-35}"
MAX_ITERATIONS="${PIPELINE_BATCH_MAX_DISCOVERY_ITERATIONS:-5}"
USE_CANONICAL="${PIPELINE_USE_CANONICAL_ORCHESTRATOR:-false}"
USE_CACHE="${DOSSIER_USE_CACHE:-false}"
NEWS_MAX_QUERIES="${DOSSIER_RECENT_NEWS_MAX_QUERIES:-2}"
NEWS_RESULTS_PER_QUERY="${DOSSIER_RECENT_NEWS_RESULTS_PER_QUERY:-3}"
NEWS_MAX_ITEMS="${DOSSIER_RECENT_NEWS_MAX_ITEMS:-4}"
STRATEGIC_MAX_SEARCHES="${DOSSIER_STRATEGIC_MAX_SEARCHES:-2}"
STRATEGIC_RESULTS_PER_SEARCH="${DOSSIER_STRATEGIC_RESULTS_PER_SEARCH:-1}"
STRATEGIC_MAX_EVALS="${DOSSIER_STRATEGIC_MAX_EVALS:-4}"

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
  echo "==> Running ${ENTITY_NAME} (${ENTITY_ID})"
  set +e
  PIPELINE_USE_CANONICAL_ORCHESTRATOR="$USE_CANONICAL" \
  DOSSIER_USE_CACHE="$USE_CACHE" \
  DOSSIER_RECENT_NEWS_MAX_QUERIES="$NEWS_MAX_QUERIES" \
  DOSSIER_RECENT_NEWS_RESULTS_PER_QUERY="$NEWS_RESULTS_PER_QUERY" \
  DOSSIER_RECENT_NEWS_MAX_ITEMS="$NEWS_MAX_ITEMS" \
  DOSSIER_STRATEGIC_MAX_SEARCHES="$STRATEGIC_MAX_SEARCHES" \
  DOSSIER_STRATEGIC_RESULTS_PER_SEARCH="$STRATEGIC_RESULTS_PER_SEARCH" \
  DOSSIER_STRATEGIC_MAX_EVALS="$STRATEGIC_MAX_EVALS" \
  PYTHONPATH=backend \
  timeout "$TIMEOUT_SECONDS" \
    python3 run_fixed_dossier_pipeline.py \
      --entity-id "$ENTITY_ID" \
      --entity-name "$ENTITY_NAME" \
      --entity-type "$ENTITY_TYPE" \
      --tier-score "$TIER_SCORE" \
      --max-discovery-iterations "$MAX_ITERATIONS" \
      --template-id yellow_panther_agency \
      2>&1 | tee "$LOG_FILE"
  EXIT_CODE=${PIPESTATUS[0]}
  set -e

  REPORT_PATH="$(rg -o '"run_report_path":\s*"[^"]+"' "$LOG_FILE" | tail -n 1 | sed -E 's/.*"run_report_path":\s*"([^"]+)"/\1/')"
  if [[ -z "${REPORT_PATH}" ]]; then
    REPORT_PATH=""
  fi
  jq \
    --arg entity_id "$ENTITY_ID" \
    --arg entity_name "$ENTITY_NAME" \
    --arg entity_type "$ENTITY_TYPE" \
    --arg log_file "$LOG_FILE" \
    --arg report_path "$REPORT_PATH" \
    --argjson exit_code "$EXIT_CODE" \
    '. += [{"entity_id":$entity_id,"entity_name":$entity_name,"entity_type":$entity_type,"exit_code":$exit_code,"log_file":$log_file,"run_report_path":$report_path}]' \
    "$TMP_FILE" > "${TMP_FILE}.next"
  mv "${TMP_FILE}.next" "$TMP_FILE"
done

mv "$TMP_FILE" "$SUMMARY_FILE"
echo "Batch summary: $SUMMARY_FILE"
