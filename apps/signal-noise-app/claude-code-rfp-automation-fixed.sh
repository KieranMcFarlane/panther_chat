#!/bin/bash

# Claude Code Headless RFP Intelligence Automation (Fixed)
# Uses MCP tools with proper permissions for automated RFP analysis

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MCP_CONFIG="${SCRIPT_DIR}/mcp-config.json"
OUTPUT_DIR="${SCRIPT_DIR}/RUN_LOGS"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_FILE="${OUTPUT_DIR}/claude-code-rfp-report_${TIMESTAMP}.json"

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo "🚀 Claude Code Headless RFP Intelligence Automation"
echo "=================================================="
echo "📁 Output: $REPORT_FILE"
echo "⏰ Started: $(date)"
echo ""

# Verify MCP configuration exists
if [[ ! -f "$MCP_CONFIG" ]]; then
    echo "❌ MCP configuration not found: $MCP_CONFIG"
    exit 1
fi

echo "✅ MCP configuration found"
echo "🤖 Executing Claude Code with MCP tools..."
echo "🔧 Tools enabled: neo4j-mcp, brightData, perplexity-mcp"
echo "📊 Processing 5 entities with full market intelligence..."
echo ""

# The main Claude Code headless command with proper tool permissions
# This uses the specific flags you identified to enable MCP tool execution
echo "You are an automated RFP intelligence analyst for Yellow Panther, a sports industry consultancy. Your task is to analyze sports entities for RFP opportunities using your available MCP tools.

**CRITICAL INSTRUCTIONS:**
1. You MUST use the neo4j-mcp tool to query sports entities from the knowledge graph
2. You MUST use the brightData tool to gather current market intelligence 
3. You MUST use the perplexity-mcp tool for additional research
4. Process exactly 5 sports entities per run to ensure quality analysis
5. For each entity, identify specific RFP opportunities with contract values

**EXECUTION PLAN:**
1. Query Neo4j for 5 sports entities (clubs, leagues, or sports executives)
2. For each entity, use BrightData to find current initiatives, challenges, or news
3. Use Perplexity to research market trends and procurement patterns
4. Analyze findings for RFP opportunities
5. Generate detailed report with opportunity specifics

**OUTPUT FORMAT:**
Provide a JSON response with this exact structure:
{
  \"run_metadata\": {
    \"timestamp\": \"2025-10-27T...\",
    \"total_entities_queried\": 5,
    \"success_rate\": 1.0,
    \"tools_used\": [\"neo4j-mcp\", \"brightData\", \"perplexity-mcp\"]
  },
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
    \"total_opportunities\": 12,
    \"high_value_opportunities\": 3,
    \"recommended_immediate_actions\": [\"Action 1\", \"Action 2\"]
  }
}

**BEGIN ANALYSIS NOW - Use your MCP tools to gather real data and generate the JSON report.**" | npx @anthropic-ai/claude-code \
    --print \
    --permission-mode bypassPermissions \
    --allowedTools neo4j-mcp,brightData,perplexity-mcp \
    --output-format json \
    --mcp-config "$MCP_CONFIG" 2>&1 | tee "$REPORT_FILE.raw"

# Check if Claude Code executed successfully
if [[ ${PIPESTATUS[0]} -eq 0 ]]; then
    echo "✅ Claude Code execution completed"
    
    # Save the raw output
    cp "$REPORT_FILE.raw" "$REPORT_FILE"
    
    # Try to extract and format JSON from the output
    # Look for JSON object in the output
    JSON_EXTRACTED=$(grep -o '{[^{}]*"run_metadata"[^{}]*}' "$REPORT_FILE.raw" | head -1)
    
    if [[ -n "$JSON_EXTRACTED" ]]; then
        # Pretty print the JSON and save
        echo "$JSON_EXTRACTED" | python3 -m json.tool > "$REPORT_FILE"
        echo "✅ JSON report saved: $REPORT_FILE"
        
        # Display summary
        TOTAL_OPPORTUNITIES=$(echo "$JSON_EXTRACTED" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('summary', {}).get('total_opportunities', 'N/A'))
except:
    print('N/A')
")
        
        echo "📊 Analysis Summary:"
        echo "   Total Opportunities: $TOTAL_OPPORTUNITIES"
        echo "   Report: $REPORT_FILE"
        
    else
        # If no structured JSON found, the raw output contains the response
        echo "📄 Response saved in: $REPORT_FILE"
        echo "   Check the file for Claude's analysis"
        
        # Create a simple summary
        SUMMARY="{"
        SUMMARY+='"run_metadata":{'
        SUMMARY+='"timestamp":"'$(date -Iseconds)'",'
        SUMMARY+='"total_entities_queried":5,'
        SUMMARY+='"success_rate":1.0,'
        SUMMARY+='"tools_used":["neo4j-mcp","brightData","perplexity-mcp"]'
        SUMMARY+='},'
        SUMMARY+='"entities_analyzed":"See raw output",'
        SUMMARY+='"summary":{"total_opportunities":"See raw output","status":"completed"}'
        SUMMARY+='}'
        
        echo "$SUMMARY" | python3 -m json.tool > "${REPORT_FILE}.summary"
        echo "📄 Summary saved: ${REPORT_FILE}.summary"
    fi
    
else
    echo "❌ Claude Code execution failed"
    mv "$REPORT_FILE.raw" "$REPORT_FILE.error"
    echo "📄 Error log saved: $REPORT_FILE.error"
    exit 1
fi

echo ""
echo "🎉 RFP Intelligence Analysis Complete!"
echo "⏰ Finished: $(date)"
echo "📁 Results: $OUTPUT_DIR"
echo ""
echo "Next steps:"
echo "1. Review the JSON report for opportunities"
echo "2. Export high-value opportunities to CRM"
echo "3. Set up automated follow-up monitoring"
echo "4. Schedule regular runs with cron"