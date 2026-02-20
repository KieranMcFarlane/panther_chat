#!/bin/bash
# Real-time Discovery Progress Monitor

echo "================================================"
echo "  Runtime Binding Discovery - Live Monitor"
echo "================================================"
echo ""

# Phase 1: BrightData Discovery
echo "📡 PHASE 1: BrightData Discovery"
echo "------------------------------------------------"
if ps aux | grep -v grep | grep "full_runtime_discovery" > /dev/null; then
    echo "Status: 🔄 Running"

    # Get progress
    progress=$(tail -100 data/discovery_progress.log 2>/dev/null | grep "Progress:" | tail -1)
    if [ -n "$progress" ]; then
        echo "$progress"
    fi

    # Count completed
    completed=$(ls -lt data/runtime_bindings/*.json 2>/dev/null | wc -l)
    echo "Total entities: $completed/1,270"
else
    echo "Status: ✅ Complete or not running"
fi
echo ""

# Phase 3: Claude Agent SDK
echo "🤖 PHASE 3: Claude Agent SDK Discovery"
echo "------------------------------------------------"
if ps aux | grep -v grep | grep "claude_agent_discovery_orchestrator" > /dev/null; then
    echo "Status: 🔄 Running"

    # Get current entity
    current_entity=$(tail -100 data/phase3_batch_discovery.log 2>/dev/null | grep "Entity [0-9]+/1270:" | tail -1)
    if [ -n "$current_entity" ]; then
        echo "$current_entity"
    fi

    # Get latest confidence score
    latest_confidence=$(tail -100 data/phase3_batch_discovery.log 2>/dev/null | grep "Current confidence:" | tail -1)
    if [ -n "$latest_confidence" ]; then
        echo "$latest_confidence"
    fi

    # Count entities with enriched patterns
    enriched=$(jq -r 'select(.enriched_patterns.procurement_signals != null) | .entity_id' data/runtime_bindings/*.json 2>/dev/null | wc -l)
    echo "Entities enriched: $enriched/1,270"
else
    echo "Status: ✅ Complete or not running"
fi
echo ""

# Top 5 Entities by Confidence
echo "🏆 TOP 5 ENTITIES BY CONFIDENCE"
echo "------------------------------------------------"
echo "Entity                          | Confidence | Signals | Cost"
echo "--------------------------------|------------|--------|------~"

for file in data/runtime_bindings/*.json; do
  entity=$(jq -r '.entity_id' "$file" 2>/dev/null)
  confidence=$(jq -r '.enriched_patterns.discovery_ledger.current_confidence // empty' "$file" 2>/dev/null)
  signals=$(jq -r '.enriched_patterns.procurement_signals | length // 0' "$file" 2>/dev/null)
  cost=$(jq -r '.enriched_patterns.discovery_ledger.estimated_cost_usd // 0' "$file" 2>/dev/null)

  if [ -n "$confidence" ] && [ "$confidence" != "null" ]; then
    printf "%-30s | %9.3f | %6s | $%.4f\n" "$entity" "$confidence" "$signals" "$cost"
  fi
done | sort -t'|' -k2 -rn | head -5

echo ""
echo "================================================"
echo "Monitor with: tail -f data/phase3_batch_discovery.log"
echo "================================================"
