#!/bin/bash

# Quick test curl for RFP analysis
echo "🎯 Testing RFP Analysis with curl..."
echo ""

# Test with small batch first (3 entities)
echo "📡 Testing with 3 entities..."
curl -s -N "http://localhost:3005/api/claude-agent-demo/stream?service=reliable&query=Test%20RFP%20intelligence&mode=batch&entityLimit=3&startEntityId=0" | \
while IFS= read -r line; do
    if [[ $line == data:* ]]; then
        json_data="${line#data: }"
        
        if echo "$json_data" | grep -q "entity_search_start"; then
            entity=$(echo "$json_data" | jq -r '.message' 2>/dev/null || echo "Starting entity search")
            echo "🔍 $entity"
        elif echo "$json_data" | grep -q "entity_search_complete"; then
            entity=$(echo "$json_data" | jq -r '.message' 2>/dev/null || echo "Entity search complete")
            echo "✅ $entity"
        elif echo "$json_data" | grep -q "type.*result"; then
            echo "🎯 RFP Results Found!"
            echo "$json_data" | jq '.' 2>/dev/null || echo "$json_data"
        elif echo "$json_data" | grep -q "type.*completed"; then
            echo "🏁 Processing completed!"
        elif echo "$json_data" | grep -q "type.*error"; then
            echo "❌ Error occurred"
            echo "$json_data"
        fi
    fi
done

echo ""
echo "✅ Test completed!"