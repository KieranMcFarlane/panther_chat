#!/bin/bash

# Test LinkedIn-First RFP Detection with 5 entities
# This script runs the RFP monitor in TEST_MODE to quickly verify the 3-phase system works

set -euo pipefail

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  🧪 LINKEDIN-FIRST TEST MODE (5 entities only)                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Navigate to script directory
cd "$(dirname "$0")"

# Set test mode
export TEST_MODE=true

# Run the monitor for batch1
echo "🚀 Starting test run..."
./run-rfp-monitor.sh batch1

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  📊 TEST RESULTS SUMMARY                                       ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Find latest result file
LATEST=$(ls -t logs/rfp_results_batch1_*_clean.json 2>/dev/null | head -1)

if [ -f "$LATEST" ]; then
  echo "📁 Results file: $LATEST"
  echo ""
  
  # Show key metrics
  echo "📈 Entities processed:"
  cat "$LATEST" | jq -r '.entities_checked // 0'
  echo ""
  
  echo "📊 Discovery breakdown:"
  cat "$LATEST" | jq -r '.discovery_breakdown // {}'
  echo ""
  
  echo "🔄 Phase progression:"
  cat "$LATEST" | jq -r '.phase_progression // {}'
  echo ""
  
  echo "🎯 RFPs detected:"
  cat "$LATEST" | jq -r '.total_rfps_detected // 0'
  echo ""
  
  echo "✅ Verified:"
  cat "$LATEST" | jq -r '.verified_rfps // 0'
  echo ""
  
  echo "❌ Rejected:"
  cat "$LATEST" | jq -r '.rejected_rfps // 0'
  echo ""
else
  echo "❌ No result file found. Check logs/test-cron.log for errors."
fi

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  🔍 DEBUG LOG (last 30 lines)                                  ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

if [ -f "logs/debug.log" ]; then
  tail -30 logs/debug.log
else
  echo "⚠️  No debug log found"
fi

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  📝 FULL LOG (last 50 lines)                                   ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

if [ -f "logs/test-cron.log" ]; then
  tail -50 logs/test-cron.log
else
  echo "⚠️  No test-cron log found"
fi

echo ""
echo "✅ Test complete!"











