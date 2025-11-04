#!/bin/bash
set -euo pipefail

# ==========================================================
# 🟡 Yellow Panther | RFP Batch Orchestrator (v6.0)
# ----------------------------------------------------------
# - Auto-resume from checkpoints
# - Supabase progress sync
# - Max 3 concurrent batches
# - Crash-safe and AWS-ready
# ==========================================================

BASE_DIR="/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app"
LOG_DIR="$BASE_DIR/logs"
PROGRESS_FILE="$BASE_DIR/rfp-progress.json"
STAMP=$(date +"%Y%m%d_%H%M%S")
mkdir -p "$LOG_DIR"

echo "🚀 Starting RFP batch orchestration @ $(date)" | tee -a "$LOG_DIR/test-cron.log"

# --- Safe .env loader ---
if [ -f "$BASE_DIR/.env" ]; then
  echo "📦 Loading environment variables from .env" | tee -a "$LOG_DIR/test-cron.log"
  while IFS='=' read -r key value; do
    [[ -z "$key" || "$key" =~ ^# ]] && continue
    value="${value%\"}"; value="${value#\"}"
    export "$key"="$value"
  done < "$BASE_DIR/.env"
else
  echo "⚠️  No .env file found — continuing with existing environment." | tee -a "$LOG_DIR/test-cron.log"
fi

TOTAL_BATCHES=${TOTAL_BATCHES:-15}
MAX_PARALLEL=${MAX_PARALLEL:-3}
SUPABASE_URL="${SUPABASE_URL:-}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-}"

# --- Initialize or load progress ---
if [ -f "$PROGRESS_FILE" ]; then
  echo "📄 Resuming from existing progress file..." | tee -a "$LOG_DIR/test-cron.log"
else
  echo '{"completed_batches": [], "failed_batches": []}' > "$PROGRESS_FILE"
  echo "🆕 Created new progress file." | tee -a "$LOG_DIR/test-cron.log"
fi

# --- Helper: update local + Supabase progress ---
update_progress() {
  local BATCH_ID=$1
  local STATUS=$2
  local TMP="${PROGRESS_FILE}.tmp"

  jq --arg id "$BATCH_ID" --arg status "$STATUS" '
    if $status == "done" then
      .completed_batches += [$id] | .completed_batches |= unique
    else
      .failed_batches += [$id] | .failed_batches |= unique
    end
  ' "$PROGRESS_FILE" > "$TMP" && mv "$TMP" "$PROGRESS_FILE"

  # Push update to Supabase if configured
  if [[ -n "$SUPABASE_URL" && -n "$SUPABASE_ANON_KEY" ]]; then
    local completed=$(jq '.completed_batches | length' "$PROGRESS_FILE")
    local failed=$(jq '.failed_batches | length' "$PROGRESS_FILE")
    curl -s -X POST "${SUPABASE_URL}/rest/v1/rfp_progress" \
      -H "apikey: $SUPABASE_ANON_KEY" \
      -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
      -H "Content-Type: application/json" \
      -d "{
        \"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",
        \"completed\": $completed,
        \"failed\": $failed,
        \"total\": $TOTAL_BATCHES
      }" >/dev/null 2>&1 && \
      echo "📡 Synced progress to Supabase ($completed/$TOTAL_BATCHES complete)" | tee -a "$LOG_DIR/test-cron.log"
  fi
}

# --- Run one batch safely ---
run_batch() {
  local BATCH_ID=$1
  local RANGE_START=$(( (BATCH_ID - 1) * 300 ))
  local RANGE_END=$(( RANGE_START + 299 ))

  echo "🟡 [Batch $BATCH_ID] Starting (entities ${RANGE_START}-${RANGE_END})..." | tee -a "$LOG_DIR/test-cron.log"

  if bash "$BASE_DIR/run-rfp-monitor.sh" "batch${BATCH_ID}" > "$LOG_DIR/batch_${BATCH_ID}_${STAMP}.log" 2>&1; then
    echo "✅ [Batch $BATCH_ID] Completed successfully." | tee -a "$LOG_DIR/test-cron.log"
    update_progress "$BATCH_ID" "done"
  else
    echo "❌ [Batch $BATCH_ID] Failed — see batch_${BATCH_ID}_${STAMP}.log" | tee -a "$LOG_DIR/test-cron.log"
    update_progress "$BATCH_ID" "fail"
  fi
}

# --- Determine remaining batches ---
mapfile -t COMPLETED_BATCHES < <(jq -r '.completed_batches[]?' "$PROGRESS_FILE")
declare -A COMPLETED_MAP
for id in "${COMPLETED_BATCHES[@]}"; do COMPLETED_MAP["$id"]=1; done

REMAINING_BATCHES=()
for ((i=1; i<=TOTAL_BATCHES; i++)); do
  if [[ -z "${COMPLETED_MAP[$i]+x}" ]]; then
    REMAINING_BATCHES+=("$i")
  fi
done

if [ ${#REMAINING_BATCHES[@]} -eq 0 ]; then
  echo "✅ All batches already complete — skipping to aggregation." | tee -a "$LOG_DIR/test-cron.log"
  bash "$BASE_DIR/run-rfp-aggregate.sh" >> "$LOG_DIR/test-cron.log" 2>&1
  exit 0
fi

echo "📊 Remaining batches to run: ${REMAINING_BATCHES[*]}" | tee -a "$LOG_DIR/test-cron.log"

# --- Run remaining batches (max parallel) ---
ACTIVE=0
for BATCH_ID in "${REMAINING_BATCHES[@]}"; do
  run_batch "$BATCH_ID" &
  ((ACTIVE++))
  if (( ACTIVE >= MAX_PARALLEL )); then
    wait -n
    ((ACTIVE--))
  fi
done
wait

# --- Final aggregation and summary ---
sleep 1  # ensure file writes complete
TOTAL_DONE=$(jq '.completed_batches | length' "$PROGRESS_FILE")
TOTAL_FAIL=$(jq '.failed_batches | length' "$PROGRESS_FILE")

echo "📊 All batches complete: ${TOTAL_DONE} succeeded, ${TOTAL_FAIL} failed." | tee -a "$LOG_DIR/test-cron.log"

if (( TOTAL_DONE > 0 )); then
  if (( TOTAL_DONE == TOTAL_BATCHES )); then
    echo "🧩 All batches completed successfully — running aggregation..." | tee -a "$LOG_DIR/test-cron.log"
    bash "$BASE_DIR/run-rfp-aggregate.sh" >> "$LOG_DIR/test-cron.log" 2>&1
  else
    echo "⚠️  Partial completion — rerun to process remaining batches." | tee -a "$LOG_DIR/test-cron.log"
  fi
else
  echo "⚠️  No successful batches — skipping aggregation." | tee -a "$LOG_DIR/test-cron.log"
fi

echo "🏁 All RFP batch processing complete @ $(date)" | tee -a "$LOG_DIR/test-cron.log"

