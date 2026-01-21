#!/bin/bash
#
# Test Perplexity-First + LinkedIn (5 entities)
#

cd "$(dirname "$0")"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  🧪 TESTING: Perplexity-First + LinkedIn (5 entities)         ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Run test
TEST_MODE=true ./run-rfp-monitor-perplexity-linkedin.sh batch1

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  📊 TEST RESULTS                                               ║"
echo "╚════════════════════════════════════════════════════════════════╝"

LATEST=$(ls -t logs/rfp_results_batch1_*_clean.json 2>/dev/null | head -1)

if [[ -f "$LATEST" ]]; then
  echo ""
  echo "📁 Results: $(basename "$LATEST")"
  echo ""
  
  echo "🎯 Discovery Metrics:"
  jq '.discovery_metrics' "$LATEST"
  echo ""
  
  echo "📈 RFPs Found:"
  jq '{total: .total_rfps_detected, verified: .verified_rfps, rejected: .rejected_rfps}' "$LATEST"
  echo ""
  
  echo "✅ Verified Opportunities:"
  jq -r '.highlights[] | select(.validation_status == "VERIFIED") | "  • \(.organization): \(.summary_json.title) (fit: \(.summary_json.fit_score)%)"' "$LATEST"
  echo ""
  
  echo "💰 Cost Analysis:"
  jq '{estimated_cost: .discovery_metrics.estimated_cost, savings_vs_old: .discovery_metrics.cost_savings_vs_old_system}' "$LATEST"
  echo ""
else
  echo "❌ No results file found"
fi

echo "✅ Test complete!"











