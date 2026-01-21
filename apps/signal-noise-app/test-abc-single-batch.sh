#!/bin/bash
set -euo pipefail

# ==========================================================
# 🧪 Test Script for Multi-Strategy ABC System
# ----------------------------------------------------------
# Tests a single batch with all 3 strategies in parallel
# Verifies detection_strategy tagging and result aggregation
# ==========================================================

BASE_DIR="/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app"
LOG_DIR="$BASE_DIR/logs"
STAMP=$(date +"%Y%m%d_%H%M%S")
TEST_RUN_DIR="$LOG_DIR/test_abc_${STAMP}"

mkdir -p "$TEST_RUN_DIR"

echo "🧪 Testing Multi-Strategy ABC System"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📁 Test run directory: $TEST_RUN_DIR"
echo ""
echo "This test will:"
echo "  1. Run all 3 strategies on the same 300 entities (batch 1)"
echo "  2. Verify each strategy tags results with detection_strategy"
echo "  3. Generate ABC comparison report"
echo "  4. Show performance metrics"
echo ""
read -p "Press Enter to start test (or Ctrl+C to cancel)..."

echo ""
echo "🚀 Launching all 3 strategies in parallel..."
echo ""

# Launch Perplexity strategy
echo "🧠 Starting Perplexity-first strategy..."
bash "$BASE_DIR/run-rfp-monitor-perplexity.sh" "batch1" "$TEST_RUN_DIR" > "$TEST_RUN_DIR/batch_1_perplexity.log" 2>&1 &
PID_PERP=$!

# Launch LinkedIn strategy
echo "💼 Starting LinkedIn-first strategy..."
bash "$BASE_DIR/run-rfp-monitor-linkedin.sh" "batch1" "$TEST_RUN_DIR" > "$TEST_RUN_DIR/batch_1_linkedin.log" 2>&1 &
PID_LINK=$!

# Launch BrightData strategy
echo "🌐 Starting BrightData-first strategy..."
bash "$BASE_DIR/run-rfp-monitor-brightdata.sh" "batch1" "$TEST_RUN_DIR" > "$TEST_RUN_DIR/batch_1_brightdata.log" 2>&1 &
PID_BRIGHT=$!

echo ""
echo "⏳ Waiting for all strategies to complete (this may take 20-30 minutes)..."
echo "   🧠 Perplexity PID: $PID_PERP"
echo "   💼 LinkedIn PID: $PID_LINK"
echo "   🌐 BrightData PID: $PID_BRIGHT"
echo ""

# Wait for all strategies
wait $PID_PERP
EXIT_PERP=$?
echo "✅ Perplexity completed (exit code: $EXIT_PERP)"

wait $PID_LINK
EXIT_LINK=$?
echo "✅ LinkedIn completed (exit code: $EXIT_LINK)"

wait $PID_BRIGHT
EXIT_BRIGHT=$?
echo "✅ BrightData completed (exit code: $EXIT_BRIGHT)"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Strategy Results Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check Perplexity results
PERP_CLEAN="$LOG_DIR/rfp_results_batch1_perplexity_*_clean.json"
if ls $PERP_CLEAN 1> /dev/null 2>&1; then
  PERP_FILE=$(ls -t $PERP_CLEAN | head -1)
  PERP_RFPS=$(jq '.total_rfps_detected // 0' "$PERP_FILE" 2>/dev/null || echo 0)
  PERP_ENTITIES=$(jq '.entities_checked // 0' "$PERP_FILE" 2>/dev/null || echo 0)
  PERP_STRATEGY=$(jq -r '.detection_strategy // "not tagged"' "$PERP_FILE" 2>/dev/null || echo "not tagged")
  echo "🧠 Perplexity Strategy:"
  echo "   - RFPs Found: $PERP_RFPS"
  echo "   - Entities Checked: $PERP_ENTITIES"
  echo "   - Strategy Tag: $PERP_STRATEGY"
  echo "   - Result File: $(basename "$PERP_FILE")"
else
  echo "⚠️  Perplexity: No result file found"
fi

echo ""

# Check LinkedIn results
LINK_CLEAN="$LOG_DIR/rfp_results_batch1_linkedin_*_clean.json"
if ls $LINK_CLEAN 1> /dev/null 2>&1; then
  LINK_FILE=$(ls -t $LINK_CLEAN | head -1)
  LINK_RFPS=$(jq '.total_rfps_detected // 0' "$LINK_FILE" 2>/dev/null || echo 0)
  LINK_ENTITIES=$(jq '.entities_checked // 0' "$LINK_FILE" 2>/dev/null || echo 0)
  LINK_STRATEGY=$(jq -r '.detection_strategy // "not tagged"' "$LINK_FILE" 2>/dev/null || echo "not tagged")
  echo "💼 LinkedIn Strategy:"
  echo "   - RFPs Found: $LINK_RFPS"
  echo "   - Entities Checked: $LINK_ENTITIES"
  echo "   - Strategy Tag: $LINK_STRATEGY"
  echo "   - Result File: $(basename "$LINK_FILE")"
else
  echo "⚠️  LinkedIn: No result file found"
fi

echo ""

# Check BrightData results
BRIGHT_CLEAN="$LOG_DIR/rfp_results_batch1_brightdata_*_clean.json"
if ls $BRIGHT_CLEAN 1> /dev/null 2>&1; then
  BRIGHT_FILE=$(ls -t $BRIGHT_CLEAN | head -1)
  BRIGHT_RFPS=$(jq '.total_rfps_detected // 0' "$BRIGHT_FILE" 2>/dev/null || echo 0)
  BRIGHT_ENTITIES=$(jq '.entities_checked // 0' "$BRIGHT_FILE" 2>/dev/null || echo 0)
  BRIGHT_STRATEGY=$(jq -r '.detection_strategy // "not tagged"' "$BRIGHT_FILE" 2>/dev/null || echo "not tagged")
  echo "🌐 BrightData Strategy:"
  echo "   - RFPs Found: $BRIGHT_RFPS"
  echo "   - Entities Checked: $BRIGHT_ENTITIES"
  echo "   - Strategy Tag: $BRIGHT_STRATEGY"
  echo "   - Result File: $(basename "$BRIGHT_FILE")"
else
  echo "⚠️  BrightData: No result file found"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📈 Running ABC Aggregation..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Run aggregation
bash "$BASE_DIR/run-rfp-aggregate-abc.sh" "$TEST_RUN_DIR"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Test Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📁 Test artifacts:"
echo "   - Test directory: $TEST_RUN_DIR"
echo "   - Logs: $LOG_DIR"
echo ""
echo "📊 View comparison report:"
COMPARISON_FILE=$(ls -t "$TEST_RUN_DIR"/rfp_strategy_comparison_*.md 2>/dev/null | head -1)
if [ -n "$COMPARISON_FILE" ]; then
  echo "   cat $COMPARISON_FILE"
  echo ""
  echo "Preview:"
  head -50 "$COMPARISON_FILE"
else
  echo "   ⚠️  Comparison report not generated"
fi











