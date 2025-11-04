#!/bin/bash

# Direct RFP Processing Script
# This bypasses the complex frontend and directly triggers the working backend

echo "🚀 Starting Direct RFP Intelligence Processing..."
echo "📡 This uses the working backend directly without frontend complexity"

# Process 3 entities with real BrightData searches
curl -s -N "http://localhost:3005/api/claude-agent-demo/stream?service=reliable&query=Persistent%20RFP%20intelligence&mode=batch&entityLimit=3&startEntityId=0" | while read line; do
  if [[ $line == data:* ]]; then
    # Extract JSON part
    json_data="${line#data: }"
    
    # Parse and display key information
    if echo "$json_data" | grep -q "entity_search_start"; then
      entity=$(echo "$json_data" | jq -r '.message' 2>/dev/null || echo "Processing entity...")
      echo "🔍 $entity"
    elif echo "$json_data" | grep -q "entity_search_complete"; then
      entity=$(echo "$json_data" | jq -r '.message' 2>/dev/null || echo "Completed entity")
      echo "✅ $entity"
    elif echo "$json_data" | grep -q "type.*result"; then
      echo "🎯 RFP Results Found!"
      echo "$json_data" | jq '.' 2>/dev/null || echo "$json_data"
    elif echo "$json_data" | grep -q "type.*completed"; then
      echo "🏁 Processing completed!"
    elif echo "$json_data" | grep -q "type.*error"; then
      echo "❌ Error occurred"
    fi
  fi
done

echo "✨ Direct RFP processing complete!"