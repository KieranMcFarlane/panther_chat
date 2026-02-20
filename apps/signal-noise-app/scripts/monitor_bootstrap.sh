#!/bin/bash
# Monitor Full SDK Bootstrap Progress

echo "🚀 FULL SDK BOOTSTRAP MONITOR"
echo "================================"
echo ""

# Check if running
if [ -f /tmp/bootstrap.pid ]; then
    PID=$(cat /tmp/bootstrap.pid)
    if ps -p $PID > /dev/null; then
        echo "✅ Bootstrap is running (PID: $PID)"
        echo ""
    else
        echo "❌ Bootstrap process died"
        echo ""
    fi
else
    echo "❌ No PID file found"
    echo ""
fi

# Check checkpoint
if [ -f data/bootstrap_checkpoint.json ]; then
    echo "📍 Checkpoint Status:"
    jq -r '"Processed: \(.entity_count // 0) entities\nTotal cost: $\(.total_cost_usd // 0)\nLast update: \(.timestamp)"' data/bootstrap_checkpoint.json
    echo ""
fi

# Count bindings
BINDING_COUNT=$(ls -1 data/runtime_bindings/*.json 2>/dev/null | grep -v cache | wc -l | tr -d ' ')
echo "📊 Bindings: $BINDING_COUNT entities"
echo ""

# Recent log output
if [ -f /tmp/bootstrap_output.log ]; then
    echo "📝 Recent Log Output (last 30 lines):"
    echo "-----------------------------------"
    tail -30 /tmp/bootstrap_output.log
    echo ""
fi

# Cost estimate
if [ -f data/bootstrap_checkpoint.json ]; then
    PROCESSED=$(jq -r '.entity_count // 0' data/bootstrap_checkpoint.json)
    TOTAL=1268
    REMAINING=$((TOTAL - PROCESSED))
    CURRENT_COST=$(jq -r '.total_cost_usd // 0' data/bootstrap_checkpoint.json)
    AVG_COST=$(echo "scale=2; $CURRENT_COST / $PROCESSED" | bc 2>/dev/null || echo "0.75")
    EST_REMAINING=$(echo "scale=2; $REMAINING * $AVG_COST" | bc 2>/dev/null || echo "N/A")
    EST_TOTAL=$(echo "scale=2; $CURRENT_COST + $EST_REMAINING" | bc 2>/dev/null || echo "N/A")

    echo "💰 Cost Estimate:"
    echo "  Processed: $PROCESSED / $TOTAL entities"
    echo "  Current cost: $\($CURRENT_COST)"
    echo "  Avg cost/entity: $\($AVG_COST)"
    echo "  Est. remaining: $\($EST_REMAINING)"
    echo "  Est. total: $\($EST_TOTAL)"
    echo ""
fi

echo "================================"
echo "💡 Quick Commands:"
echo "  Watch logs:   tail -f /tmp/bootstrap_output.log"
echo "  Stop:         kill $(cat /tmp/bootstrap.pid 2>/dev/null || echo 'PID')"
echo "  Resume:       python scripts/full_sdk_bootstrap.py --resume --iterations 30"
