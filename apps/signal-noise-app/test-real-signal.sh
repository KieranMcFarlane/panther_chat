#!/bin/bash
echo "🚀 Testing Yellow Panther Integration with Real Signal"
echo "=========================================================="
echo ""

# Send the signal
echo "📤 Sending signal to Ralph Loop..."
curl -s -X POST "http://localhost:8001/api/webhooks/signal" \
  -H "Content-Type: application/json" \
  -d @/tmp/test_signal_final.json > /tmp/ralph_result.json

echo "✅ Signal sent"
echo ""

# Show validation result
echo "📊 Validation Result:"
cat /tmp/ralph_result.json | python3 -m json.tool
echo ""

# Wait for processing
echo "⏳ Waiting for Ralph Loop processing..."
sleep 10

# Show Ralph Loop logs
echo ""
echo "📋 Ralph Loop Processing Logs:"
tail -100 /tmp/ralph_loop.log | grep -E "Pass|survived|Yellow Panther|webhook|Fit Score|Priority" | tail -30
echo ""

# Check if webhook was called
echo ""
echo "🌐 NextJS Webhook Logs (if signal validated):"
tail -20 /tmp/nextjs.log 2>/dev/null | grep -E "Yellow Panther|webhook|opportunity" || echo "No webhook activity yet (signal may have been rejected in Ralph Loop)"
