#!/bin/bash
# Test BrightData → Ralph Loop integration

echo "🧪 Testing BrightData → Ralph Loop Integration"
echo "═════════════════════════════════════════════════"

# Start Ralph Loop if not running
if ! curl -s http://localhost:8001/health > /dev/null; then
  echo "⚠️  Ralph Loop not running. Starting..."
  ./scripts/start-ralph-loop.sh &
  sleep 5
fi

# Run BrightData scraper
echo ""
echo "📡 Running BrightData scraper with Ralph Loop validation..."
node production-brightdata-rfp-detector.js

echo ""
echo "═════════════════════════════════════════════════"
echo "✅ Integration test complete"
echo ""
echo "Expected output:"
echo "  [RALPH-LOOP-VALIDATED] - Signals that passed 3-pass validation"
echo "  [RALPH-LOOP-REJECTED] - Signals that failed validation"
echo "  [RALPH-LOOP-ERROR] - Validation errors"
