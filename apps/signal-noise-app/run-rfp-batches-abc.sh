#!/bin/bash
set -euo pipefail

# ==========================================================
# 🟡 Yellow Panther | Multi-Strategy RFP Orchestrator (ABC Test v1.0)
# ----------------------------------------------------------
# - Runs 3 strategies in parallel per batch (Perplexity, LinkedIn, BrightData)
# - Same entities tested across all 3 strategies for A/B/C comparison
# - Auto-resume from checkpoints
# - Supabase progress sync
# ==========================================================

BASE_DIR="/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app"
LOG_DIR="$BASE_DIR/logs"
PROGRESS_FILE="$BASE_DIR/rfp-progress-abc.json"
STAMP=$(date +"%Y%m%d_%H%M%S")
RUN_DIR="$LOG_DIR/run_abc_${STAMP}"
mkdir -p "$LOG_DIR"
mkdir -p "$RUN_DIR"

# Define the three monitor scripts for parallel execution
MONITOR_PERPLEXITY="$BASE_DIR/run-rfp-monitor-perplexity.sh"
MONITOR_LINKEDIN="$BASE_DIR/run-rfp-monitor-linkedin.sh"
MONITOR_BRIGHTDATA="$BASE_DIR/run-rfp-monitor-brightdata.sh"

echo "🚀 Starting Multi-Strategy RFP Orchestration (ABC Test) @ $(date)" | tee -a "$LOG_DIR/test-cron.log"
echo "📁 Run output directory: $RUN_DIR" | tee -a "$LOG_DIR/test-cron.log"
echo "🎯 Testing 3 strategies per batch: Perplexity | LinkedIn | BrightData" | tee -a "$LOG_DIR/test-cron.log"

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

# --- Auto-detect entity count from Neo4j ---
echo "🔍 Detecting total entities in Neo4j..." | tee -a "$LOG_DIR/test-cron.log"

# Try to get entity count from Neo4j if credentials are available
TOTAL_ENTITIES=0
if command -v cypher-shell >/dev/null 2>&1 && [ -n "${NEO4J_URI:-}" ]; then
  TOTAL_ENTITIES=$(cypher-shell -a "$NEO4J_URI" -u "${NEO4J_USERNAME:-${NEO4J_USER:-neo4j}}" -p "$NEO4J_PASSWORD" \
    "MATCH (e:Entity) WHERE e.type IN ['Club','League','Federation','Tournament'] RETURN count(e) as total;" 2>/dev/null \
    | grep -E "^[0-9]+$" | head -1 || echo "0")
fi

# Fallback to environment variable or default
TOTAL_ENTITIES=${TOTAL_ENTITIES:-${ENTITY_COUNT:-4500}}

# Calculate required batches (50 entities per batch, round up)
BATCH_SIZE=50
TOTAL_BATCHES=$(( (TOTAL_ENTITIES + BATCH_SIZE - 1) / BATCH_SIZE ))

# Ensure at least 1 batch
if [ "$TOTAL_BATCHES" -lt 1 ]; then
  TOTAL_BATCHES=1
fi

echo "📊 Entity count: $TOTAL_ENTITIES | Required batches: $TOTAL_BATCHES (${BATCH_SIZE} entities/batch)" | tee -a "$LOG_DIR/test-cron.log"

MAX_PARALLEL=${MAX_PARALLEL:-2}  # Each batch runs 3 strategies, so 2 batches = 6 parallel processes
SUPABASE_URL="${SUPABASE_URL:-}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-}"
RESET_HOURS=${RESET_HOURS:-24}  # Reset progress after 24 hours from cycle start

# --- Parse command-line arguments ---
FORCE_RESET=false
for arg in "$@"; do
  case $arg in
    --reset|--fresh-start|--from-batch1)
      FORCE_RESET=true
      echo "🔄 Force reset flag detected — will start from batch 1" | tee -a "$LOG_DIR/test-cron.log"
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --reset, --fresh-start, --from-batch1  Force reset and start from batch 1"
      echo "  --help, -h                             Show this help message"
      echo ""
      echo "Environment variables:"
      echo "  TOTAL_BATCHES          Number of batches to process (default: auto-detect from Neo4j)"
      echo "  MAX_PARALLEL           Max concurrent batches (default: 3)"
      echo "  RESET_HOURS            Hours before auto-reset (default: 24)"
      echo "  RFP_MONITOR_SCRIPT     Path to monitor script (default: run-rfp-monitor-perplexity-linkedin.sh)"
      exit 0
      ;;
    *)
      echo "⚠️  Unknown argument: $arg (use --help for usage)" | tee -a "$LOG_DIR/test-cron.log"
      ;;
  esac
done

# --- Helper: Check if cycle should reset and reset if needed ---
check_and_reset_cycle() {
  local REASON=$1
  local CURRENT_EPOCH=$(date +%s)
  local RESET_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  
  echo "🔄 RESET CYCLE: $REASON" | tee -a "$LOG_DIR/test-cron.log"
  echo "   Previous cycle stats:" | tee -a "$LOG_DIR/test-cron.log"
  if [ -f "$PROGRESS_FILE" ]; then
    local prev_completed=$(jq '.completed_batches | length' "$PROGRESS_FILE" 2>/dev/null || echo "0")
    local prev_failed=$(jq '.failed_batches | length' "$PROGRESS_FILE" 2>/dev/null || echo "0")
    echo "   - Completed: $prev_completed/$TOTAL_BATCHES batches" | tee -a "$LOG_DIR/test-cron.log"
    echo "   - Failed: $prev_failed/$TOTAL_BATCHES batches" | tee -a "$LOG_DIR/test-cron.log"
  fi
  echo "   Starting new cycle at: $RESET_TIME (epoch: $CURRENT_EPOCH)" | tee -a "$LOG_DIR/test-cron.log"
  
  echo "{\"completed_batches\": [], \"failed_batches\": [], \"cycle_start_epoch\": $CURRENT_EPOCH, \"last_updated_epoch\": $CURRENT_EPOCH, \"reset_reason\": \"$REASON\", \"reset_time\": \"$RESET_TIME\"}" > "$PROGRESS_FILE"
}

# --- Initialize or load progress with improved 24h timeout check ---
RESET_PROGRESS=false
RESET_REASON=""

# If force reset flag is set, skip all checks and reset immediately
if [ "$FORCE_RESET" = true ]; then
  RESET_REASON="Force reset requested via --reset flag"
  RESET_PROGRESS=true
elif [ -f "$PROGRESS_FILE" ]; then
  # Check if cycle is complete (all batches done)
  COMPLETED_COUNT=$(jq '.completed_batches | length' "$PROGRESS_FILE" 2>/dev/null || echo "0")
  if [ "$COMPLETED_COUNT" -ge "$TOTAL_BATCHES" ]; then
    RESET_REASON="All batches completed"
    RESET_PROGRESS=true
  elif jq -e '.cycle_start_epoch' "$PROGRESS_FILE" >/dev/null 2>&1; then
    # Check cycle age from start time
    CYCLE_START=$(jq -r '.cycle_start_epoch' "$PROGRESS_FILE")
    CURRENT_EPOCH=$(date +%s)
    
    if [ "$CYCLE_START" -gt 0 ] 2>/dev/null; then
      CYCLE_AGE_SECONDS=$((CURRENT_EPOCH - CYCLE_START))
      CYCLE_AGE_HOURS=$((CYCLE_AGE_SECONDS / 3600))
      CYCLE_AGE_MINS=$(((CYCLE_AGE_SECONDS % 3600) / 60))
      
      if [ "$CYCLE_AGE_HOURS" -ge "$RESET_HOURS" ]; then
        RESET_REASON="Cycle timeout (${CYCLE_AGE_HOURS}h ${CYCLE_AGE_MINS}m old, >= ${RESET_HOURS}h)"
        RESET_PROGRESS=true
      else
        echo "📄 Resuming cycle: ${CYCLE_AGE_HOURS}h ${CYCLE_AGE_MINS}m old (${COMPLETED_COUNT}/$TOTAL_BATCHES batches completed)" | tee -a "$LOG_DIR/test-cron.log"
      fi
    else
      RESET_REASON="Invalid cycle_start_epoch in progress file"
      RESET_PROGRESS=true
    fi
  else
    # Old format progress file - migrate to new format
    echo "📝 Migrating progress file to new format (adding cycle_start_epoch)..." | tee -a "$LOG_DIR/test-cron.log"
    CURRENT_EPOCH=$(date +%s)
    LAST_UPDATED=$(jq -r '.last_updated_epoch // empty' "$PROGRESS_FILE" 2>/dev/null || echo "$CURRENT_EPOCH")
    jq --argjson cycle_start "${LAST_UPDATED:-$CURRENT_EPOCH}" --argjson last_updated "${LAST_UPDATED:-$CURRENT_EPOCH}" '
      .cycle_start_epoch = $cycle_start |
      .last_updated_epoch = $last_updated
    ' "$PROGRESS_FILE" > "${PROGRESS_FILE}.tmp" && mv "${PROGRESS_FILE}.tmp" "$PROGRESS_FILE"
    echo "✅ Progress file migrated successfully" | tee -a "$LOG_DIR/test-cron.log"
  fi
else
  RESET_REASON="No progress file found"
  RESET_PROGRESS=true
fi

if [ "$RESET_PROGRESS" = true ]; then
  check_and_reset_cycle "$RESET_REASON"
fi

# --- Helper: update local + Supabase progress ---
update_progress() {
  local BATCH_ID=$1
  local STATUS=$2
  local TMP="${PROGRESS_FILE}.tmp"

  local CURRENT_EPOCH=$(date +%s)
  # Update progress and preserve cycle_start_epoch
  jq --arg id "$BATCH_ID" --arg status "$STATUS" --argjson ts "$CURRENT_EPOCH" '
    if $status == "done" then
      .completed_batches += [$id] | .completed_batches |= unique
    else
      .failed_batches += [$id] | .failed_batches |= unique
    end |
    .last_updated_epoch = $ts |
    .cycle_start_epoch = (.cycle_start_epoch // $ts)
  ' "$PROGRESS_FILE" > "$TMP" && mv "$TMP" "$PROGRESS_FILE"

  # Check if all batches are complete
  local completed=$(jq '.completed_batches | length' "$PROGRESS_FILE")
  if [ "$completed" -ge "$TOTAL_BATCHES" ]; then
    echo "✅ Cycle complete: All $TOTAL_BATCHES batches finished!" | tee -a "$LOG_DIR/test-cron.log"
    echo "   Next run will reset and start a new cycle." | tee -a "$LOG_DIR/test-cron.log"
  fi

  # Push update to Supabase if configured
  if [[ -n "$SUPABASE_URL" && -n "$SUPABASE_ANON_KEY" ]]; then
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

# --- Run one batch with all 3 strategies in parallel ---
run_batch() {
  local BATCH_ID=$1
  local RANGE_START=$(( (BATCH_ID - 1) * 50 ))
  local RANGE_END=$(( RANGE_START + 49 ))

  echo "🟡 [Batch $BATCH_ID] Starting ABC test (entities ${RANGE_START}-${RANGE_END})..." | tee -a "$LOG_DIR/test-cron.log"
  echo "   🧠 Perplexity-first | 💼 LinkedIn-first | 🌐 BrightData-first" | tee -a "$LOG_DIR/test-cron.log"

  # Verify all monitor scripts exist
  for script in "$MONITOR_PERPLEXITY" "$MONITOR_LINKEDIN" "$MONITOR_BRIGHTDATA"; do
    if [ ! -f "$script" ]; then
      echo "❌ Monitor script not found: $script" | tee -a "$LOG_DIR/test-cron.log"
      return 1
    fi
  done

  # Launch all 3 strategies in parallel
  bash "$MONITOR_PERPLEXITY" "batch${BATCH_ID}" "$RUN_DIR" > "$RUN_DIR/batch_${BATCH_ID}_perplexity_${STAMP}.log" 2>&1 &
  local PID_PERP=$!
  echo "   🧠 Perplexity launched (PID $PID_PERP)" | tee -a "$LOG_DIR/test-cron.log"
  
  bash "$MONITOR_LINKEDIN" "batch${BATCH_ID}" "$RUN_DIR" > "$RUN_DIR/batch_${BATCH_ID}_linkedin_${STAMP}.log" 2>&1 &
  local PID_LINK=$!
  echo "   💼 LinkedIn launched (PID $PID_LINK)" | tee -a "$LOG_DIR/test-cron.log"
  
  bash "$MONITOR_BRIGHTDATA" "batch${BATCH_ID}" "$RUN_DIR" > "$RUN_DIR/batch_${BATCH_ID}_brightdata_${STAMP}.log" 2>&1 &
  local PID_BRIGHT=$!
  echo "   🌐 BrightData launched (PID $PID_BRIGHT)" | tee -a "$LOG_DIR/test-cron.log"

  # Wait for all 3 strategies to complete
  local EXIT_PERP EXIT_LINK EXIT_BRIGHT
  wait $PID_PERP; EXIT_PERP=$?
  wait $PID_LINK; EXIT_LINK=$?
  wait $PID_BRIGHT; EXIT_BRIGHT=$?

  # Report results
  echo "" | tee -a "$LOG_DIR/test-cron.log"
  echo "📊 [Batch $BATCH_ID] Strategy Results:" | tee -a "$LOG_DIR/test-cron.log"
  
  local ALL_SUCCESS=true
  if [ $EXIT_PERP -eq 0 ]; then
    echo "   ✅ Perplexity: Success" | tee -a "$LOG_DIR/test-cron.log"
  else
    echo "   ❌ Perplexity: Failed (exit $EXIT_PERP)" | tee -a "$LOG_DIR/test-cron.log"
    ALL_SUCCESS=false
  fi
  
  if [ $EXIT_LINK -eq 0 ]; then
    echo "   ✅ LinkedIn: Success" | tee -a "$LOG_DIR/test-cron.log"
  else
    echo "   ❌ LinkedIn: Failed (exit $EXIT_LINK)" | tee -a "$LOG_DIR/test-cron.log"
    ALL_SUCCESS=false
  fi
  
  if [ $EXIT_BRIGHT -eq 0 ]; then
    echo "   ✅ BrightData: Success" | tee -a "$LOG_DIR/test-cron.log"
  else
    echo "   ❌ BrightData: Failed (exit $EXIT_BRIGHT)" | tee -a "$LOG_DIR/test-cron.log"
    ALL_SUCCESS=false
  fi
  
  if [ "$ALL_SUCCESS" = true ]; then
    echo "✅ [Batch $BATCH_ID] All strategies completed successfully" | tee -a "$LOG_DIR/test-cron.log"
    update_progress "$BATCH_ID" "done"
  else
    echo "⚠️  [Batch $BATCH_ID] One or more strategies failed — check logs in $RUN_DIR" | tee -a "$LOG_DIR/test-cron.log"
    update_progress "$BATCH_ID" "fail"
  fi
  
  echo "🏁 [Batch $BATCH_ID] ABC test completed, returning..." | tee -a "$LOG_DIR/test-cron.log"
}

# --- Determine remaining batches ---
# Portable method that works with bash 3.x+ (no associative arrays needed)
COMPLETED_BATCHES_STR=$(jq -r '.completed_batches[]?' "$PROGRESS_FILE" 2>/dev/null | tr '\n' ' ')

# Helper function to check if batch is completed
is_batch_completed() {
  local batch_id=$1
  echo " $COMPLETED_BATCHES_STR " | grep -q " $batch_id "
  return $?
}

REMAINING_BATCHES=()
for ((i=1; i<=TOTAL_BATCHES; i++)); do
  if ! is_batch_completed "$i"; then
    REMAINING_BATCHES+=("$i")
  fi
done

if [ ${#REMAINING_BATCHES[@]} -eq 0 ]; then
  echo "✅ All batches already complete — skipping to ABC aggregation." | tee -a "$LOG_DIR/test-cron.log"
  if [ -f "$BASE_DIR/run-rfp-aggregate-abc.sh" ]; then
    bash "$BASE_DIR/run-rfp-aggregate-abc.sh" "$RUN_DIR" >> "$LOG_DIR/test-cron.log" 2>&1
  else
    echo "⚠️  ABC aggregation script not found" | tee -a "$LOG_DIR/test-cron.log"
  fi
  exit 0
fi

echo "📊 Remaining batches to run: ${REMAINING_BATCHES[*]}" | tee -a "$LOG_DIR/test-cron.log"
echo "📊 Total batches to process: ${#REMAINING_BATCHES[@]}" | tee -a "$LOG_DIR/test-cron.log"

# --- Run remaining batches (max parallel) ---
# Temporarily disable strict error handling for background job management
set +e

# Portable wait for any job (works with bash 3.x+)
wait_for_any_job() {
  local pids=("$@")
  while true; do
    for pid in "${pids[@]}"; do
      if ! kill -0 "$pid" 2>/dev/null; then
        # This PID has completed
        wait "$pid" 2>/dev/null || true
        return 0
      fi
    done
    sleep 0.5
  done
}

ACTIVE_PIDS=()
echo "🔄 Starting batch execution loop with MAX_PARALLEL=$MAX_PARALLEL" | tee -a "$LOG_DIR/test-cron.log"

for BATCH_ID in "${REMAINING_BATCHES[@]}"; do
  echo "🔄 [Loop iteration] Processing batch $BATCH_ID (ACTIVE=${#ACTIVE_PIDS[@]})" | tee -a "$LOG_DIR/test-cron.log"
  
  # Launch batch in background
  run_batch "$BATCH_ID" &
  BATCH_PID=$!
  ACTIVE_PIDS+=("$BATCH_PID")
  echo "🔄 [Batch $BATCH_ID] Launched in background (PID=$BATCH_PID)" | tee -a "$LOG_DIR/test-cron.log"
  
  # If we've reached the parallel limit, wait for one to complete
  if (( ${#ACTIVE_PIDS[@]} >= MAX_PARALLEL )); then
    echo "⏳ [Throttle] Reached MAX_PARALLEL=$MAX_PARALLEL, waiting for one batch to complete..." | tee -a "$LOG_DIR/test-cron.log"
    wait_for_any_job "${ACTIVE_PIDS[@]}"
    
    # Remove completed PIDs from tracking array
    NEW_ACTIVE_PIDS=()
    for pid in "${ACTIVE_PIDS[@]}"; do
      if kill -0 "$pid" 2>/dev/null; then
        NEW_ACTIVE_PIDS+=("$pid")
      fi
    done
    ACTIVE_PIDS=("${NEW_ACTIVE_PIDS[@]}")
    echo "✓ [Throttle] One batch completed, ACTIVE now=${#ACTIVE_PIDS[@]}, continuing..." | tee -a "$LOG_DIR/test-cron.log"
  fi
done

echo "⏳ Waiting for all remaining background batches to complete..." | tee -a "$LOG_DIR/test-cron.log"
wait || true
echo "✓ All background batches completed" | tee -a "$LOG_DIR/test-cron.log"

# Re-enable strict error handling
set -e

# --- Final aggregation and summary ---
sleep 1  # ensure file writes complete
TOTAL_DONE=$(jq '.completed_batches | length' "$PROGRESS_FILE")
TOTAL_FAIL=$(jq '.failed_batches | length' "$PROGRESS_FILE")

# Log cycle statistics
if jq -e '.cycle_start_epoch' "$PROGRESS_FILE" >/dev/null 2>&1; then
  CYCLE_START=$(jq -r '.cycle_start_epoch' "$PROGRESS_FILE")
  CURRENT_EPOCH=$(date +%s)
  CYCLE_DURATION=$((CURRENT_EPOCH - CYCLE_START))
  CYCLE_HOURS=$((CYCLE_DURATION / 3600))
  CYCLE_MINS=$(((CYCLE_DURATION % 3600) / 60))
  echo "⏱️  Cycle duration: ${CYCLE_HOURS}h ${CYCLE_MINS}m" | tee -a "$LOG_DIR/test-cron.log"
fi

echo "📊 Batch processing complete: ${TOTAL_DONE} succeeded, ${TOTAL_FAIL} failed." | tee -a "$LOG_DIR/test-cron.log"

if (( TOTAL_DONE > 0 )); then
  if (( TOTAL_DONE == TOTAL_BATCHES )); then
    echo "🎉 CYCLE COMPLETE: All $TOTAL_BATCHES batches finished successfully!" | tee -a "$LOG_DIR/test-cron.log"
    echo "   Next run will automatically start a new cycle from batch 1." | tee -a "$LOG_DIR/test-cron.log"
    echo "🧩 Running ABC strategy comparison aggregation..." | tee -a "$LOG_DIR/test-cron.log"
    if [ -f "$BASE_DIR/run-rfp-aggregate-abc.sh" ]; then
      bash "$BASE_DIR/run-rfp-aggregate-abc.sh" "$RUN_DIR" >> "$LOG_DIR/test-cron.log" 2>&1
    else
      echo "⚠️  ABC aggregation script not found" | tee -a "$LOG_DIR/test-cron.log"
    fi
  else
    echo "⚠️  Partial completion (${TOTAL_DONE}/$TOTAL_BATCHES) — rerun to process remaining batches." | tee -a "$LOG_DIR/test-cron.log"
  fi
else
  echo "⚠️  No successful batches — skipping aggregation." | tee -a "$LOG_DIR/test-cron.log"
fi

echo "🏁 All RFP batch processing complete @ $(date)" | tee -a "$LOG_DIR/test-cron.log"
echo "📁 Run output saved to: $RUN_DIR" | tee -a "$LOG_DIR/test-cron.log"

