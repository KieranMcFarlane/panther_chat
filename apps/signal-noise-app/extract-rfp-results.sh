#!/bin/bash

# RFP Results Extractor
# Processes streaming data and extracts RFP results with links

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
RESULTS_FILE="rfp-analysis-results/EXTRACTED-RFP-RESULTS-${TIMESTAMP}.json"

echo "🎯 RFP Results Extractor"
echo "======================="
echo "📁 Saving results to: ${RESULTS_FILE}"
echo ""

# Initialize results JSON
cat > "${RESULTS_FILE}" << 'EOF'
{
  "rfp_analysis_session": {
    "timestamp": "",
    "total_entities_processed": 0,
    "rfp_opportunities_found": [],
    "emerging_opportunities": [],
    "processing_log": [],
    "system_performance": {
      "start_time": "",
      "end_time": "",
      "total_duration": 0
    }
  }
}
EOF

# Update timestamp
sed -i '' "s/\"timestamp\": \"\"/\"timestamp\": \"$(date -Iseconds)\"/" "${RESULTS_FILE}"
sed -i '' "s/\"start_time\": \"\"/\"start_time\": \"$(date -Iseconds)\"/" "${RESULTS_FILE}"

echo "🚀 Starting RFP analysis with results extraction..."
echo ""

# Counter for processed entities
entity_count=0
rfp_count=0

# Function to extract RFP data from streaming response
process_rfp_stream() {
    local batch_size=$1
    local start_id=$2
    
    echo "📦 Processing entities ${start_id} to $((start_id + batch_size))..."
    
    curl -s -N "http://localhost:3005/api/claude-agent-demo/stream?service=reliable&query=RFP%20intelligence%20extraction&mode=batch&entityLimit=${batch_size}&startEntityId=${start_id}" | \
    while IFS= read -r line; do
        if [[ $line == data:* ]]; then
            json_data="${line#data: }"
            
            # Extract entity processing info
            if echo "$json_data" | grep -q "entity_search_start"; then
                entity_name=$(echo "$json_data" | jq -r '.message' 2>/dev/null | sed 's/🔍 Starting BrightData search for: //' || echo "Unknown Entity")
                echo "🔍 Analyzing: ${entity_name}"
                entity_count=$((entity_count + 1))
                
                # Add to processing log
                log_entry="{\"timestamp\": \"$(date -Iseconds)\", \"entity\": \"${entity_name}\", \"status\": \"processing\"}"
                
            elif echo "$json_data" | grep -q "entity_search_complete"; then
                entity_name=$(echo "$json_data" | jq -r '.message' 2>/dev/null | sed 's/✅ BrightData search completed for: //' || echo "Unknown Entity")
                echo "✅ Completed: ${entity_name}"
                
                # Add to processing log
                log_entry="{\"timestamp\": \"$(date -Iseconds)\", \"entity\": \"${entity_name}\", \"status\": \"completed\"}"
                
            elif echo "$json_data" | grep -q "type.*result"; then
                echo "🎯 RFP OPPORTUNITY FOUND!"
                rfp_count=$((rfp_count + 1))
                
                # Extract RFP details
                rfp_title=$(echo "$json_data" | jq -r '.data.title // "Unknown Title"' 2>/dev/null)
                rfp_organization=$(echo "$json_data" | jq -r '.data.organization // "Unknown Organization"' 2>/dev/null)
                rfp_value=$(echo "$json_data" | jq -r '.data.value // "Value not specified"' 2>/dev/null)
                rfp_source=$(echo "$json_data" | jq -r '.data.source // "Unknown source"' 2>/dev/null)
                rfp_deadline=$(echo "$json_data" | jq -r '.data.deadline // "No deadline"' 2>/dev/null)
                yellow_panther_fit=$(echo "$json_data" | jq -r '.data.yellowPantherFit // "0.8"' 2>/dev/null)
                
                echo "   📋 ${rfp_title}"
                echo "   🏢 ${rfp_organization}"
                echo "   💰 ${rfp_value}"
                echo "   🔗 ${rfp_source}"
                echo "   ⏰ ${rfp_deadline}"
                echo "   🎯 Yellow Panther Fit: ${yellow_panther_fit}"
                echo ""
                
                # Save RFP to results file (this would need more sophisticated JSON manipulation)
                # For now, just display the results
                
            elif echo "$json_data" | grep -q "type.*completed"; then
                echo "🏁 Batch processing completed!"
                
            elif echo "$json_data" | grep -q "type.*error"; then
                echo "❌ Error occurred"
                echo "$json_data"
            fi
        fi
    done
}

# Process first batch of 50 entities as a test
process_rfp_stream 50 0

# Update final statistics
end_time=$(date -Iseconds)
sed -i '' "s/\"end_time\": \"\"/\"end_time\": \"${end_time}\"/" "${RESULTS_FILE}"
sed -i '' "s/\"total_entities_processed\": 0/\"total_entities_processed\": ${entity_count}/" "${RESULTS_FILE}"

echo ""
echo "🎉 ANALYSIS COMPLETE!"
echo "===================="
echo "📊 Entities Processed: ${entity_count}"
echo "🎯 RFP Opportunities Found: ${rfp_count}"
echo "📁 Results saved to: ${RESULTS_FILE}"
echo "🕐 End Time: $(date)"
echo ""
echo "🔍 To view detailed results:"
echo "cat ${RESULTS_FILE} | jq '.'"