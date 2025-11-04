#!/bin/bash

# Claude Code 100 Entity RFP Intelligence Test
# Large-scale test with comprehensive logging and verification

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MCP_CONFIG="${SCRIPT_DIR}/mcp-config.json"
OUTPUT_DIR="${SCRIPT_DIR}/RUN_LOGS"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_FILE="${OUTPUT_DIR}/claude-code-100-entities_${TIMESTAMP}.json"
PROGRESS_LOG="${OUTPUT_DIR}/100-entities-progress_${TIMESTAMP}.log"
PERFORMANCE_LOG="${OUTPUT_DIR}/100-entities-performance_${TIMESTAMP}.log"

mkdir -p "$OUTPUT_DIR"

echo "🚀 Claude Code 100 Entity RFP Intelligence Test"
echo "================================================"
echo "📊 Target: 100 sports entities"
echo "📁 Report: $REPORT_FILE"
echo "📝 Progress: $PROGRESS_LOG"
echo "⚡ Performance: $PERFORMANCE_LOG"
echo "⏰ Started: $(date)"
echo ""

# Verify MCP configuration exists
if [[ ! -f "$MCP_CONFIG" ]]; then
    echo "❌ MCP configuration not found: $MCP_CONFIG" | tee -a "$PROGRESS_LOG"
    exit 1
fi

echo "✅ MCP configuration found" | tee -a "$PROGRESS_LOG"

# Start performance monitoring
echo "PERFORMANCE MONITORING STARTED" >> "$PERFORMANCE_LOG"
echo "Start Time: $(date -Iseconds)" >> "$PERFORMANCE_LOG"
echo "Target: 100 entities" >> "$PERFORMANCE_LOG"
echo "" >> "$PERFORMANCE_LOG"

# Function to log progress
log_progress() {
    echo "[$(date +'%H:%M:%S')] $1" | tee -a "$PROGRESS_LOG"
}

# Function to log performance metrics
log_performance() {
    echo "[$(date +'%H:%M:%S')] $1" >> "$PERFORMANCE_LOG"
}

log_progress "🔧 Initiating 100 entity RFP intelligence analysis..."
log_performance "Query initiated"

# The main Claude Code command for 100 entities
log_progress "🤖 Executing Claude Code with MCP tools..."
log_progress "📊 Processing 100 entities with full market intelligence..."

# Start timer
START_TIME=$(date +%s)

echo "You are an automated RFP intelligence analyst for Yellow Panther, a sports industry consultancy. Your task is to analyze sports entities for RFP opportunities using your available MCP tools.

**CRITICAL INSTRUCTIONS:**
1. You MUST use the neo4j-mcp tool to query sports entities from the knowledge graph
2. You MUST use the brightData tool to gather current market intelligence 
3. You MUST use the perplexity-mcp tool for additional research
4. Process exactly 100 sports entities in this run
5. For each entity, identify specific RFP opportunities with contract values
6. **IMPORTANT: Log your progress as you process entities**

**EXECUTION PLAN:**
1. Query Neo4j for 100 diverse sports entities (mix of clubs, leagues, venues, personnel)
2. Process entities in batches of 10 for quality control
3. For each entity, use BrightData to find current initiatives, challenges, or news
4. Use Perplexity to research market trends and procurement patterns
5. Log progress after each batch (e.g., \"Processed 10/100 entities\")
6. Analyze findings for RFP opportunities
7. Generate detailed report with opportunity specifics

**PROGRESS LOGGING REQUIREMENTS:**
- Log every 10 entities processed
- Note any entities where data enrichment fails
- Record total processing time
- Track tool usage and success rates

**OUTPUT FORMAT:**
Provide a JSON response with this exact structure:
{
  \"run_metadata\": {
    \"timestamp\": \"2025-10-27T...\",
    \"total_entities_queried\": 100,
    \"entities_processed\": 95,
    \"success_rate\": 0.95,
    \"processing_time_seconds\": 1800,
    \"tools_used\": [\"neo4j-mcp\", \"brightData\", \"perplexity-mcp\"],
    \"batches_completed\": 10
  },
  \"processing_log\": [
    \"Started processing 100 entities\",
    \"Batch 1/10: Processed 10 entities (FIVB, O'Higgins, Maccabi Tel Aviv...)\",
    \"Batch 2/10: Processed 20 entities (Brighton, Arsenal, Real Madrid...)\",
    ...
    \"Completed 100 entities in 28 minutes\"
  ],
  \"entities_analyzed\": [
    {
      \"entity_name\": \"Entity Name\",
      \"entity_type\": \"Club/League/Person\",
      \"sport\": \"Football/Golf/etc\",
      \"rfp_opportunities\": [
        {
          \"opportunity_type\": \"Digital Transformation\",
          \"description\": \"Specific opportunity description\",
          \"estimated_value\": {
            \"currency\": \"GBP\",
            \"min_value\": 250000,
            \"max_value\": 750000,
            \"confidence\": \"High\"
          },
          \"timing\": \"Immediate/3-6 months\",
          \"key_contacts\": [\"Director of Digital\", \"CEO\"],
          \"approach_strategy\": \"Specific recommended approach\"
        }
      ],
      \"market_intelligence\": {
        \"recent_developments\": [\"Key findings from BrightData\"],
        \"procurement_patterns\": [\"Insights from Perplexity\"],
        \"competitive_landscape\": \"Analysis summary\"
      },
      \"analysis_confidence\": 85
    }
  ],
  \"summary\": {
    \"total_opportunities\": 145,
    \"high_value_opportunities\": 31,
    \"opportunities_by_type\": {
      \"Digital Transformation\": 45,
      \"Stadium Technology\": 28,
      \"Fan Engagement\": 22,
      \"Data Analytics\": 18,
      \"Other\": 32
    },
    \"estimated_total_value\": {
      \"currency\": \"GBP\",
      \"min_total\": 15000000,
      \"max_total\": 45000000
    },
    \"recommended_immediate_actions\": [\"Action 1\", \"Action 2\"]
  }
}

**BEGIN ANALYSIS NOW - Process 100 entities and log your progress!**" | npx @anthropic-ai/claude-code \
    --print \
    --permission-mode bypassPermissions \
    --allowedTools neo4j-mcp,brightData,perplexity-mcp \
    --output-format json \
    --mcp-config "$MCP_CONFIG" 2>&1 | tee "$REPORT_FILE.raw"

# Capture exit code
CLAUDE_EXIT_CODE=${PIPESTATUS[0]}

# End timer
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

log_performance "Query completed"
log_performance "End Time: $(date -Iseconds)"
log_performance "Total Duration: ${DURATION} seconds"
log_performance "Exit Code: $CLAUDE_EXIT_CODE"

# Check if Claude Code executed successfully
if [[ $CLAUDE_EXIT_CODE -eq 0 ]]; then
    log_progress "✅ Claude Code execution completed successfully"
    log_progress "⏱️  Total time: ${DURATION} seconds"
    
    # Save the raw output
    cp "$REPORT_FILE.raw" "$REPORT_FILE"
    
    # Try to extract and analyze the JSON response
    log_progress "📊 Analyzing results..."
    
    # Extract key metrics from the response
    ENTITY_COUNT=$(grep -o '"total_entities_queried":[0-9]*' "$REPORT_FILE.raw" | head -1 | cut -d: -f2 || echo "N/A")
    PROCESSED_COUNT=$(grep -o '"entities_processed":[0-9]*' "$REPORT_FILE.raw" | head -1 | cut -d: -f2 || echo "N/A")
    SUCCESS_RATE=$(grep -o '"success_rate":[0-9.]*' "$REPORT_FILE.raw" | head -1 | cut -d: -f2 || echo "N/A")
    OPPORTUNITY_COUNT=$(grep -o '"total_opportunities":[0-9]*' "$REPORT_FILE.raw" | head -1 | cut -d: -f2 || echo "N/A")
    
    # Performance metrics
    log_progress "📈 Performance Metrics:"
    log_progress "   • Entities queried: $ENTITY_COUNT"
    log_progress "   • Entities processed: $PROCESSED_COUNT" 
    log_progress "   • Success rate: $SUCCESS_RATE"
    log_progress "   • Opportunities found: $OPPORTUNITY_COUNT"
    log_progress "   • Processing time: ${DURATION} seconds"
    log_progress "   • Avg time per entity: $(echo "scale=2; $DURATION / $ENTITY_COUNT" | bc -l 2>/dev/null || echo "N/A") seconds"
    
    # Log to performance file
    {
        echo "RESULTS SUMMARY:"
        echo "Entities Queried: $ENTITY_COUNT"
        echo "Entities Processed: $PROCESSED_COUNT"
        echo "Success Rate: $SUCCESS_RATE"
        echo "Opportunities Found: $OPPORTUNITY_COUNT"
        echo "Processing Time: ${DURATION} seconds"
        echo "Avg Time Per Entity: $(echo "scale=2; $DURATION / $ENTITY_COUNT" | bc -l 2>/dev/null || echo "N/A") seconds"
        echo ""
        echo "PERFORMANCE ANALYSIS:"
        echo "Throughput: $(echo "scale=2; $ENTITY_COUNT * 3600 / $DURATION" | bc -l 2>/dev/null || echo "N/A") entities/hour"
        echo "Efficiency: $(echo "scale=1; $SUCCESS_RATE * 100" | bc -l 2>/dev/null || echo "N/A")%"
    } >> "$PERFORMANCE_LOG"
    
    # Create a summary report
    SUMMARY_FILE="${OUTPUT_DIR}/100-entities-summary_${TIMESTAMP}.md"
    cat > "$SUMMARY_FILE" << EOF
# 100 Entity RFP Intelligence Test Summary

**Generated:** $(date)  
**Duration:** ${DURATION} seconds  
**Status:** SUCCESS

## Key Metrics
- **Entities Queried:** $ENTITY_COUNT
- **Entities Processed:** $PROCESSED_COUNT
- **Success Rate:** $SUCCESS_RATE
- **Opportunities Found:** $OPPORTUNITY_COUNT
- **Average Time/Entity:** $(echo "scale=2; $DURATION / $ENTITY_COUNT" | bc -l 2>/dev/null || echo "N/A") seconds

## Performance
- **Throughput:** $(echo "scale=2; $ENTITY_COUNT * 3600 / $DURATION" | bc -l 2>/dev/null || echo "N/A") entities/hour
- **Efficiency:** $(echo "scale=1; $SUCCESS_RATE * 100" | bc -l 2>/dev/null || echo "N/A")%

## Files Generated
- **Full Report:** \`$REPORT_FILE\`
- **Raw Output:** \`$REPORT_FILE.raw\`
- **Progress Log:** \`$PROGRESS_LOG\`
- **Performance Log:** \`$PERFORMANCE_LOG\`

## Verification Steps
1. [ ] Check entity count matches target (100)
2. [ ] Verify MCP tools were used (neo4j-mcp, brightData, perplexity-mcp)
3. [ ] Review processing logs for batch progress
4. [ ] Analyze opportunity quality and accuracy
5. [ ] Check performance metrics against expectations

## Next Steps
1. Review full JSON report for detailed opportunities
2. Export high-value opportunities to CRM
3. Set up automated monitoring for regular runs
4. Optimize batch size based on performance metrics
EOF

    log_progress "📄 Summary report created: $SUMMARY_FILE"
    
else
    log_progress "❌ Claude Code execution failed"
    log_progress "📄 Error details saved to: $REPORT_FILE.raw"
    
    # Log error details
    {
        echo "ERROR ANALYSIS:"
        echo "Exit Code: $CLAUDE_EXIT_CODE"
        echo "Duration: ${DURATION} seconds"
        echo ""
        echo "Possible Causes:"
        echo "- MCP tool timeout"
        echo "- Memory limits exceeded"
        echo "- Network connectivity issues"
        echo "- API rate limiting"
        echo "- Entity processing errors"
        echo ""
        echo "Troubleshooting Steps:"
        echo "1. Check raw output for specific error messages"
        echo "2. Verify MCP server connectivity"
        echo "3. Test with smaller entity count (10-50)"
        echo "4. Check Neo4j database performance"
        echo "5. Verify API credentials and rate limits"
    } >> "$PERFORMANCE_LOG"
    
    mv "$REPORT_FILE.raw" "$REPORT_FILE.error"
    exit 1
fi

log_progress "🎉 100 Entity RFP Intelligence Test Complete!"
log_progress "⏰ Finished: $(date)"
log_progress "📁 All logs: $OUTPUT_DIR"
log_progress "📊 Summary: $SUMMARY_FILE"

echo ""
echo "🎉 TEST COMPLETED!"
echo "=================="
echo "📊 Entities Processed: $ENTITY_COUNT / 100"
echo "⏱️  Duration: ${DURATION} seconds"
echo "🔍 Opportunities Found: $OPPORTUNITY_COUNT"
echo "📁 Summary Report: $SUMMARY_FILE"
echo ""
echo "📋 Verification Checklist:"
echo "1. Review progress log: $PROGRESS_LOG"
echo "2. Check performance metrics: $PERFORMANCE_LOG"
echo "3. Examine full results: $REPORT_FILE"
echo "4. Validate MCP tool usage in raw output"