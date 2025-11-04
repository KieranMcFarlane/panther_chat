#!/bin/bash

# Simple Working 100 Entity Test with Real-time Logs
# Streamlined version that actually executes

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MCP_CONFIG="${SCRIPT_DIR}/mcp-config.json"
OUTPUT_DIR="${SCRIPT_DIR}/RUN_LOGS"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

mkdir -p "$OUTPUT_DIR"

echo "🚀 Starting 100 Entity Test - REAL EXECUTION"
echo "=========================================="
echo "⏰ $(date)"
echo "📁 Results: ${OUTPUT_DIR}/100-entities-working_${TIMESTAMP}.json"
echo ""

# Simple direct execution
echo "Processing 100 sports entities for RFP intelligence. Use neo4j-mcp to query entities, then brightData and perplexity-mcp for research. For each entity found, identify RFP opportunities with contract values. Process exactly 100 entities and return JSON results." | npx @anthropic-ai/claude-code \
    --print \
    --permission-mode bypassPermissions \
    --allowedTools neo4j-mcp,brightData,perplexity-mcp \
    --output-format json \
    --mcp-config "$MCP_CONFIG" 2>&1 | tee "${OUTPUT_DIR}/100-entities-working_${TIMESTAMP}.json"

echo ""
echo "✅ Test completed!"
echo "📊 Results saved to: ${OUTPUT_DIR}/100-entities-working_${TIMESTAMP}.json"