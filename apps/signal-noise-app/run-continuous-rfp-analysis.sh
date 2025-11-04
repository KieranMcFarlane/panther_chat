#!/bin/bash

# Continuous RFP Analysis Script
# Runs batches until finding real RFPs and stores them in JSON

echo "🚀 Starting Continuous RFP Analysis..."
echo "Running batches until we find real RFP opportunities"
echo "Results will be stored in rfp-results.json"
echo ""

# Create results directory
mkdir -p rfp-results

# Initialize results file
echo '{"rfpOpportunities": [], "analysisSummary": {"totalEntitiesProcessed": 0, "totalBatchesRun": 0, "analysisStartTime": "'$(date -Iseconds)'", "realRfpsFound": 0}}' > rfp-results.json

BATCH_SIZE=10
START_ENTITY_ID=0
BATCH_COUNT=0
MAX_BATCHES=50  # Safety limit

while [ $BATCH_COUNT -lt $MAX_BATCHES ]; do
  BATCH_COUNT=$((BATCH_COUNT + 1))
  CURRENT_ENTITY_ID=$((START_ENTITY_ID + (BATCH_COUNT - 1) * BATCH_SIZE))
  
  echo "🔄 Batch $BATCH_COUNT: Processing entities $CURRENT_ENTITY_ID to $((CURRENT_ENTITY_ID + BATCH_SIZE - 1))"
  
  # Create temporary file for this batch results
  TEMP_FILE="rfp-results/batch-$BATCH_COUNT-temp.json"
  
  # Run the analysis and capture output
  curl -N "http://localhost:3005/api/claude-agent-demo/stream?service=reliable&query=Comprehensive%20RFP%20intelligence%20analysis&mode=batch&entityLimit=$BATCH_SIZE&startEntityId=$CURRENT_ENTITY_ID" \
    -H "Accept: text/event-stream" \
    -H "Cache-Control: no-cache" \
    -H "Connection: keep-alive" \
    --max-time 300 \
    --silent \
    > "$TEMP_FILE" 2>&1 &
  
  CURL_PID=$!
  
  # Show progress while running
  echo "⏳ Analyzing batch $BATCH_COUNT (PID: $CURL_PID)..."
  
  # Wait for completion with timeout
  timeout 300 tail -f /dev/null &
  WAIT_PID=$!
  
  # Monitor progress
  for i in {1..60}; do
    if ! kill -0 $CURL_PID 2>/dev/null; then
      break
    fi
    echo "⏳ Batch $BATCH_COUNT in progress... ($i/60 seconds)"
    sleep 5
  done
  
  # Kill curl if still running
  if kill -0 $CURL_PID 2>/dev/null; then
    echo "⚠️ Batch $BATCH_COUNT timeout, terminating..."
    kill $CURL_PID 2>/dev/null
    wait $CURL_PID 2>/dev/null
  fi
  
  kill $WAIT_PID 2>/dev/null 2>/dev/null
  
  # Check if we got meaningful results
  if [ -f "$TEMP_FILE" ]; then
    # Extract results from the SSE stream
    echo "📊 Processing batch $BATCH_COUNT results..."
    
    # Look for result events in the output
    if grep -q "event: result" "$TEMP_FILE"; then
      echo "✅ Batch $BATCH_COUNT completed successfully"
      
      # Extract the final results
      python3 << EOF
import json
import re
import sys

def extract_rfps_from_sse(file_path):
    rfps = []
    entities_processed = 0
    
    try:
        with open(file_path, 'r') as f:
            content = f.read()
            
        # Find result events
        result_matches = re.findall(r'event: result\ndata: ({.*?})\n\n', content, re.DOTALL)
        
        for match in result_matches:
            try:
                data = json.loads(match)
                if data.get('type') == 'final' and 'data' in data:
                    results = data['data'].get('results', [])
                    for result in results:
                        if 'analysis' in result:
                            analysis_text = result['analysis']
                            # Look for specific RFP indicators
                            rfp_indicators = ['tender', 'rfp', 'proposal', 'procurement', 'bid', 'contract', 'opportunity']
                            if any(indicator in analysis_text.lower() for indicator in rfp_indicators):
                                # Extract entities info
                                entities = result.get('entities', 'Unknown')
                                rfps.append({
                                    'batch': $BATCH_COUNT,
                                    'entities': entities,
                                    'analysis': analysis_text,
                                    'processingTime': result.get('processingTime', 0),
                                    'timestamp': data.get('timestamp', ''),
                                    'sessionId': data.get('data', {}).get('sessionId', ''),
                                    'extractedAt': '$(date -Iseconds)'
                                })
                                entities_processed += len(entities.split('-')) if '-' in str(entities) else 1
            except json.JSONDecodeError:
                continue
                
    except Exception as e:
        print(f"Error processing file: {e}")
        
    return rfps, entities_processed

# Process the file
rfps_found, entities_count = extract_rfps_from_sse('$TEMP_FILE')

# Load existing results
try:
    with open('rfp-results.json', 'r') as f:
        existing_data = json.load(f)
except:
    existing_data = {'rfpOpportunities': [], 'analysisSummary': {}}

# Update results
if rfps_found:
    print(f"🎯 Found {len(rfps_found)} RFP opportunities in batch $BATCH_COUNT!")
    for rfp in rfps_found:
        print(f"   - {rfp['entities']}: {rfp['analysis'][:100]}...")
    
    existing_data['rfpOpportunities'].extend(rfps_found)
    existing_data['analysisSummary']['realRfpsFound'] = len(existing_data['rfpOpportunities'])
    
# Update summary
summary = existing_data.get('analysisSummary', {})
summary['totalEntitiesProcessed'] = summary.get('totalEntitiesProcessed', 0) + entities_count
summary['totalBatchesRun'] = $BATCH_COUNT
summary['lastBatchTime'] = '$(date -Iseconds)'
existing_data['analysisSummary'] = summary

# Save updated results
with open('rfp-results.json', 'w') as f:
    json.dump(existing_data, f, indent=2)

print(f"📈 Total RFPs found so far: {len(existing_data['rfpOpportunities'])}")
print(f"📊 Total entities processed: {summary['totalEntitiesProcessed']}")

EOF
      
      # Check if we found RFPs
      RFP_COUNT=$(python3 -c "
import json
try:
    with open('rfp-results.json', 'r') as f:
        data = json.load(f)
    print(len(data.get('rfpOpportunities', [])))
except:
    print(0)
")
      
      if [ "$RFP_COUNT" -gt 0 ]; then
        echo ""
        echo "🎉 SUCCESS! Found $RFP_COUNT RFP opportunity(ies)!"
        echo "📄 Results saved to rfp-results.json"
        echo ""
        echo "📋 RFP Summary:"
        python3 << EOF
import json
try:
    with open('rfp-results.json', 'r') as f:
        data = json.load(f)
    
    summary = data.get('analysisSummary', {})
    rfps = data.get('rfpOpportunities', [])
    
    print(f"   Total Batches Run: {summary.get('totalBatchesRun', 0)}")
    print(f"   Total Entities Processed: {summary.get('totalEntitiesProcessed', 0)}")
    print(f"   Real RFPs Found: {len(rfps)}")
    print("")
    
    for i, rfp in enumerate(rfps, 1):
        print(f"   RFP #{i}:")
        print(f"   - Entities: {rfp.get('entities', 'Unknown')}")
        print(f"   - Extracted: {rfp.get('extractedAt', 'Unknown')}")
        print(f"   - Preview: {rfp.get('analysis', '')[:150]}...")
        print("")
        
except Exception as e:
    print(f"Error reading results: {e}")
EOF
        break
      else
        echo "ℹ️ No RFPs found in batch $BATCH_COUNT, continuing..."
      fi
      
    else
      echo "⚠️ No valid results in batch $BATCH_COUNT"
    fi
    
    # Clean up temp file
    rm -f "$TEMP_FILE"
  else
    echo "❌ Batch $BATCH_COUNT failed - no output file"
  fi
  
  echo ""
  
  # Check if we should continue
  if [ $BATCH_COUNT -ge $MAX_BATCHES ]; then
    echo "⚠️ Reached maximum batch limit ($MAX_BATCHES)"
    break
  fi
  
  # Brief pause between batches
  sleep 2
done

echo ""
echo "🏁 Analysis complete!"
echo "📄 Final results in rfp-results.json"

# Display final summary
if [ -f "rfp-results.json" ]; then
  echo ""
  echo "📊 Final Summary:"
  python3 << EOF
import json
try:
    with open('rfp-results.json', 'r') as f:
        data = json.load(f)
    
    summary = data.get('analysisSummary', {})
    rfps = data.get('rfpOpportunities', [])
    
    print(f"   Total Batches Run: {summary.get('totalBatchesRun', 0)}")
    print(f"   Total Entities Processed: {summary.get('totalEntitiesProcessed', 0)}")
    print(f"   Real RFPs Found: {len(rfps)}")
    
    if rfps:
        print("")
        print("🎯 RFP Opportunities Ready for Display:")
        for i, rfp in enumerate(rfps, 1):
            print(f"   #{i}. {rfp.get('entities', 'Unknown')} - {rfp.get('extractedAt', 'Unknown')[:10]}")
    else:
        print("   No RFPs found in this analysis run")
        
except Exception as e:
    print(f"Error reading final results: {e}")
EOF
fi