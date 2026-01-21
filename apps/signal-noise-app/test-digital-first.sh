# Quick test of Digital-First RFP detection with run-rfp-monitor.sh

set -e

BASE_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$BASE_DIR/logs"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  🧪 TESTING: Digital-First RFP Detection (5 entities)         ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Run with TEST_MODE for 5 entities
export TEST_MODE=true
export SEARCH_MODE=granular

"$BASE_DIR/run-rfp-monitor.sh" batch1

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  📊 TEST RESULTS                                               ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Find latest result
LATEST_RESULT=$(ls -t "$LOG_DIR"/rfp_results_batch1_*_clean.json 2>/dev/null | head -1)

if [ -f "$LATEST_RESULT" ]; then
  echo "📁 Results: $(basename "$LATEST_RESULT")"
  echo ""
  echo "🎯 Digital RFPs Detected:"
  jq -r '.highlights[]? | "  ✅ \(.organization) - \(.summary_json.title) (Fit: \(.summary_json.fit_score))"' "$LATEST_RESULT" 2>/dev/null || echo "  None found"
  echo ""
  echo "📊 Summary:"
  jq '{
    total_rfps: .total_rfps_detected,
    entities_checked: .entities_checked,
    avg_fit_score: .scoring_summary.avg_fit_score,
    quality: .quality_metrics
  }' "$LATEST_RESULT" 2>/dev/null || echo "  Unable to parse results"
else
  echo "⚠️  No results found"
fi

echo ""
echo "✅ Test complete!"











