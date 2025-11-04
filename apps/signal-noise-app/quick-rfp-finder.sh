#!/bin/bash

# Quick RFP Finder - Processes larger batches to find real RFPs faster
echo "🚀 Quick RFP Finder - Starting Large Batch Analysis"
echo "Processing 50 entities at a time for faster RFP discovery"
echo ""

mkdir -p rfp-results
BATCH_SIZE=50
START_ENTITY_ID=0
BATCH_COUNT=0

# Function to run single batch and extract RFPs
run_batch() {
  local entity_start=$1
  local batch_size=$2
  local batch_num=$3
  
  echo "🔄 Batch $batch_num: Processing entities $entity_start to $((entity_start + batch_size - 1))"
  
  # Run analysis directly with curl and capture output
  local temp_file="rfp-results/batch-$batch_num-output.json"
  
  # Run the analysis with proper timeout handling
  curl -N "http://localhost:3005/api/claude-agent-demo/stream?service=reliable&query=Comprehensive%20RFP%20intelligence%20analysis&mode=batch&entityLimit=$batch_size&startEntityId=$entity_start" \
    -H "Accept: text/event-stream" \
    -H "Cache-Control: no-cache" \
    -H "Connection: keep-alive" \
    --max-time 180 \
    --silent \
    > "$temp_file" 2>&1
  
  # Extract and analyze results
  python3 << EOF
import json
import re
import sys
import os

def analyze_batch_output(file_path, batch_num):
    try:
        with open(file_path, 'r') as f:
            content = f.read()
        
        print(f"📊 Analyzing batch {batch_num} output...")
        
        # Look for final result events
        result_pattern = r'event: result\ndata: ({.*?"type":"final".*?})'
        matches = re.findall(result_pattern, content, re.DOTALL)
        
        rfps_found = []
        entities_processed = 0
        
        for match in matches:
            try:
                data = json.loads(match)
                results = data.get('data', {}).get('results', [])
                
                for result in results:
                    if 'analysis' in result:
                        analysis_text = result['analysis']
                        
                        # Enhanced RFP detection patterns
                        rfp_patterns = [
                            r'\b(RFP|Request for Proposal|tender|procurement|bid|contract|solicitation)\b',
                            r'\b(equipment|supplier|vendor|partner|sponsorship)\b.*\b(opportunity|needed|required|seeking)\b',
                            r'\$[\d,]+.*\b(budget|value|worth|cost)\b',
                            r'\b(deadline|submission|due|closing)\b.*\b(date|time)\b',
                            r'\b(quote|quotation|estimate|proposal)\b.*\b(required|needed)\b'
                        ]
                        
                        # Check if any RFP patterns match
                        rfp_score = 0
                        for pattern in rfp_patterns:
                            if re.search(pattern, analysis_text, re.IGNORECASE):
                                rfp_score += 1
                        
                        # Extract entity names from the analysis
                        entity_pattern = r'Analyzing [\d]+ sports entities for RFP opportunities: ([^.]+)'
                        entity_match = re.search(entity_pattern, analysis_text)
                        entities = entity_match.group(1) if entity_match else f"Entities {entity_start}-{entity_start + batch_size - 1}"
                        
                        # Look for specific RFP opportunities in the text
                        specific_rfps = []
                        
                        # Extract monetary values
                        money_pattern = r'\$[\d,]+|\£[\d,]+|\€[\d,]+|[\d,]+\s*(USD|GBP|EUR|dollars|pounds|euros)'
                        money_matches = re.findall(money_pattern, analysis_text)
                        
                        # Extract contact information
                        email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
                        email_matches = re.findall(email_pattern, analysis_text)
                        
                        # Extract tender/RFP IDs
                        tender_pattern = r'\b(RFP|Tender|Bid)-?[A-Z0-9-]+'
                        tender_matches = re.findall(tender_pattern, analysis_text, re.IGNORECASE)
                        
                        # High confidence RFP if multiple indicators found
                        if rfp_score >= 2 or (money_matches and (email_matches or tender_matches)):
                            rfps_found.append({
                                'batch': batch_num,
                                'entities': entities,
                                'analysis': analysis_text,
                                'rfpScore': rfp_score,
                                'monetaryValues': money_matches,
                                'contacts': email_matches,
                                'tenderIds': tender_matches,
                                'processingTime': data.get('data', {}).get('executionTime', 0),
                                'timestamp': data.get('timestamp', ''),
                                'extractedAt': '$(date -Iseconds)',
                                'entityStart': entity_start,
                                'confidence': 'HIGH' if rfp_score >= 3 else 'MEDIUM'
                            })
                            print(f"🎯 HIGH CONFIDENCE RFP FOUND in batch {batch_num}!")
                            print(f"   Entities: {entities}")
                            print(f"   Score: {rfp_score}, Values: {money_matches}, Contacts: {len(email_matches)}")
                            print(f"   Preview: {analysis_text[:200]}...")
                            print("")
                        
            except json.JSONDecodeError as e:
                print(f"JSON decode error in batch {batch_num}: {e}")
                continue
                
        return rfps_found
        
    except Exception as e:
        print(f"Error analyzing batch {batch_num}: {e}")
        return []

# Run the analysis
rfps = analyze_batch_output('$temp_file', $batch_num)

if rfps:
    # Load existing results
    try:
        with open('rfp-results.json', 'r') as f:
            existing_data = json.load(f)
    except:
        existing_data = {
            'rfpOpportunities': [],
            'analysisSummary': {
                'totalEntitiesProcessed': 0,
                'totalBatchesRun': 0,
                'analysisStartTime': '$(date -Iseconds)',
                'realRfpsFound': 0
            }
        }
    
    # Add new RFPs
    existing_data['rfpOpportunities'].extend(rfps)
    
    # Update summary
    summary = existing_data['analysisSummary']
    summary['totalEntitiesProcessed'] += $batch_size
    summary['totalBatchesRun'] = batch_num
    summary['realRfpsFound'] = len(existing_data['rfpOpportunities'])
    summary['lastRFPFound'] = '$(date -Iseconds)'
    
    # Save results
    with open('rfp-results.json', 'w') as f:
        json.dump(existing_data, f, indent=2)
    
    print(f"✅ SUCCESS! Found {len(rfps)} RFP opportunity(ies) in batch {batch_num}")
    print(f"📊 Total RFPs now: {len(existing_data['rfpOpportunities'])}")
    
    # Display found RFPs for immediate feedback
    for i, rfp in enumerate(rfps, 1):
        print(f"🎯 RFP #{i}:")
        print(f"   Entities: {rfp['entities']}")
        print(f"   Confidence: {rfp['confidence']}")
        print(f"   Value Indicators: {rfp['monetaryValues']}")
        print(f"   Contacts: {len(rfp['contacts'])} found")
        print(f"   Tender IDs: {rfp['tenderIds']}")
        print(f"   Preview: {rfp['analysis'][:150]}...")
        print("")
    
    sys.exit(1)  # Exit with success code to stop the script
else:
    print(f"ℹ️ No RFPs found in batch {batch_num}")
    sys.exit(0)  # Continue to next batch

EOF
  
  local exit_code=$?
  
  # Clean up temp file
  rm -f "$temp_file"
  
  return $exit_code
}

# Main loop
echo "🎯 Starting large batch RFP search..."
echo "Will process up to 500 entities across 10 batches"
echo ""

for batch in {1..10}; do
  CURRENT_START=$((START_ENTITY_ID + (batch - 1) * BATCH_SIZE))
  
  echo "🚀 Starting batch $batch of 10..."
  
  if run_batch $CURRENT_START $BATCH_SIZE $batch; then
    # RFP found - exit the loop
    echo ""
    echo "🎉 RFP DISCOVERY SUCCESSFUL!"
    echo "📄 Check rfp-results.json for complete details"
    echo ""
    
    # Show final summary
    if [ -f "rfp-results.json" ]; then
      echo "📊 Final Summary:"
      python3 << EOF
import json
try:
    with open('rfp-results.json', 'r') as f:
        data = json.load(f)
    
    summary = data.get('analysisSummary', {})
    rfps = data.get('rfpOpportunities', [])
    
    print(f"   Batches Processed: {summary.get('totalBatchesRun', 0)}")
    print(f"   Entities Analyzed: {summary.get('totalEntitiesProcessed', 0)}")
    print(f"   RFPs Found: {len(rfps)}")
    
    if rfps:
        print("")
        print("🎯 RFP Opportunities Ready for Card Display:")
        for i, rfp in enumerate(rfps, 1):
            print(f"   #{i}. {rfp.get('entities', 'Unknown')} [{rfp.get('confidence', 'UNKNOWN')}]")
            print(f"      Values: {rfp.get('monetaryValues', [])}")
            print(f"      Contacts: {len(rfp.get('contacts', []))} found")
            
except Exception as e:
    print(f"Error reading results: {e}")
EOF
    fi
    
    break
  else
    echo "Continuing to next batch..."
    echo ""
  fi
  
  # Safety check - don't exceed reasonable limits
  if [ $batch -eq 10 ]; then
    echo "⚠️ Reached maximum batch limit (10 batches, 500 entities)"
    echo "📄 Check rfp-results.json for any partial results"
    break
  fi
  
  # Brief pause between batches
  sleep 3
done

echo ""
echo "🏁 RFP search complete!"