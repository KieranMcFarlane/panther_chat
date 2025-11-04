#!/bin/bash

# Claude Code Headless Test Script
# Quick test to verify MCP tools are working properly

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MCP_CONFIG="${SCRIPT_DIR}/mcp-config.json"
OUTPUT_DIR="${SCRIPT_DIR}/RUN_LOGS"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
TEST_FILE="${OUTPUT_DIR}/claude-code-test_${TIMESTAMP}.json"

mkdir -p "$OUTPUT_DIR"

echo "🧪 Claude Code Headless MCP Test"
echo "==============================="
echo "📁 Output: $TEST_FILE"
echo ""

# Verify MCP configuration
if [[ ! -f "$MCP_CONFIG" ]]; then
    echo "❌ MCP configuration not found: $MCP_CONFIG"
    exit 1
fi

echo "✅ MCP configuration found"
echo "🔧 Testing neo4j-mcp, brightData, perplexity-mcp tools"
echo ""

# Simple test to verify Claude can access MCP tools
echo "Test your MCP tool access by performing these simple tasks:

1. Use neo4j-mcp to query for exactly 1 sports entity name from the knowledge graph
2. Use brightData to perform a simple search for 'sports industry digital transformation'
3. Use perplexity-mcp to search for 'sports technology trends 2025'

Respond with a simple JSON test result:
{
  \"test_timestamp\": \"$(date -Iseconds)\",
  \"tools_tested\": {
    \"neo4j_mcp\": {\"status\": \"success\", \"entity_found\": \"entity_name_here\"},
    \"brightData\": {\"status\": \"success\", \"search_completed\": true},
    \"perplexity_mcp\": {\"status\": \"success\", \"search_completed\": true}
  },
  \"overall_status\": \"all_tools_working\"
}" | npx @anthropic-ai/claude-code \
    --print \
    --permission-mode acceptEdits \
    --allowedTools neo4j-mcp,brightData,perplexity-mcp \
    --output-format json \
    --mcp-config "$MCP_CONFIG" 2>&1 | tee "$TEST_FILE.raw"

if [[ $? -eq 0 ]]; then
    echo "✅ Test completed successfully"
    echo "📄 Raw output saved: $TEST_FILE.raw"
else
    echo "❌ Test failed"
    echo "Check $TEST_FILE.raw for error details"
fi