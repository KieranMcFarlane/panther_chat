#!/bin/bash

# Claude Code Headless "Hello World" with MCP Test
# Simple test to verify Claude Code headless mode + MCP registration

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MCP_CONFIG="${SCRIPT_DIR}/mcp-config.json"
OUTPUT_DIR="${SCRIPT_DIR}/RUN_LOGS"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="${OUTPUT_DIR}/claude-headless-hello-world_${TIMESTAMP}.log"

mkdir -p "$OUTPUT_DIR"

echo "🧪 Claude Code Headless 'Hello World' + MCP Test"
echo "=============================================="
echo "📁 Log: $LOG_FILE"
echo "⏰ Started: $(date)"
echo ""

# Verify MCP configuration exists
if [[ ! -f "$MCP_CONFIG" ]]; then
    echo "❌ MCP configuration not found: $MCP_CONFIG" | tee -a "$LOG_FILE"
    exit 1
fi

echo "✅ MCP configuration found" | tee -a "$LOG_FILE"

# Test 1: Basic Hello World (no MCP tools)
echo ""
echo "📝 Test 1: Basic 'Hello World' (no MCP tools)" | tee -a "$LOG_FILE"
echo "---------------------------------------------" | tee -a "$LOG_FILE"

HELLO_RESULT=$(echo "Hello! Please respond with 'Hello from Claude Code headless mode!' and include the current timestamp." | npx @anthropic-ai/claude-code \
    --print \
    --output-format json \
    2>&1)

if [[ $? -eq 0 ]]; then
    echo "✅ Basic hello world test passed" | tee -a "$LOG_FILE"
    echo "$HELLO_RESULT" >> "$LOG_FILE"
else
    echo "❌ Basic hello world test failed" | tee -a "$LOG_FILE"
    echo "$HELLO_RESULT" >> "$LOG_FILE"
fi

# Test 2: MCP Tool Registration Check
echo ""
echo "🔧 Test 2: MCP Tool Registration Check" | tee -a "$LOG_FILE"
echo "---------------------------------------" | tee -a "$LOG_FILE"

MCP_TEST_RESULT=$(echo "Please check what MCP tools are available to you. List all MCP tools you can see, but do NOT execute them. Just report what tools are registered." | npx @anthropic-ai/claude-code \
    --print \
    --allowedTools neo4j-mcp,brightData,perplexity-mcp \
    --output-format json \
    --mcp-config "$MCP_CONFIG" \
    2>&1)

if [[ $? -eq 0 ]]; then
    echo "✅ MCP registration test passed" | tee -a "$LOG_FILE"
    echo "$MCP_TEST_RESULT" >> "$LOG_FILE"
else
    echo "❌ MCP registration test failed" | tee -a "$LOG_FILE"
    echo "$MCP_TEST_RESULT" >> "$LOG_FILE"
fi

# Test 3: Simple MCP Tool Execution
echo ""
echo "⚡ Test 3: Simple MCP Tool Execution" | tee -a "$LOG_FILE"
echo "--------------------------------------" | tee -a "$LOG_FILE"

SIMPLE_MCP_RESULT=$(echo "Use the neo4j-mcp tool to run a simple query: 'MATCH (e:Entity) RETURN count(e) as total_entities'. Just return the count." | npx @anthropic-ai/claude-code \
    --print \
    --permission-mode bypassPermissions \
    --allowedTools neo4j-mcp \
    --output-format json \
    --mcp-config "$MCP_CONFIG" \
    2>&1)

if [[ $? -eq 0 ]]; then
    echo "✅ Simple MCP execution test passed" | tee -a "$LOG_FILE"
    echo "$SIMPLE_MCP_RESULT" >> "$LOG_FILE"
else
    echo "❌ Simple MCP execution test failed" | tee -a "$LOG_FILE"
    echo "$SIMPLE_MCP_RESULT" >> "$LOG_FILE"
fi

# Test 4: Parse Results and Summarize
echo ""
echo "📊 Test 4: Results Summary" | tee -a "$LOG_FILE"
echo "--------------------------" | tee -a "$LOG_FILE"

# Extract key information from the JSON results
HELLO_SUCCESS=$(echo "$HELLO_RESULT" | jq -r '.type // "error"' 2>/dev/null || echo "error")
MCP_SUCCESS=$(echo "$MCP_TEST_RESULT" | jq -r '.type // "error"' 2>/dev/null || echo "error")
MCP_EXEC_SUCCESS=$(echo "$SIMPLE_MCP_RESULT" | jq -r '.type // "error"' 2>/dev/null || echo "error")

echo "Results Summary:" | tee -a "$LOG_FILE"
echo "• Basic Hello World: $HELLO_SUCCESS" | tee -a "$LOG_FILE"
echo "• MCP Registration: $MCP_SUCCESS" | tee -a "$LOG_FILE"
echo "• MCP Execution: $MCP_EXEC_SUCCESS" | tee -a "$LOG_FILE"

# Count total entities if MCP execution succeeded
if [[ "$MCP_EXEC_SUCCESS" == "result" ]]; then
    ENTITY_COUNT=$(echo "$SIMPLE_MCP_RESULT" | jq -r '.result // "Unable to extract"' 2>/dev/null || echo "Unable to extract")
    echo "• Total entities in Neo4j: $ENTITY_COUNT" | tee -a "$LOG_FILE"
fi

echo ""
echo "🎉 Claude Code Headless 'Hello World' Test Complete!" | tee -a "$LOG_FILE"
echo "⏰ Finished: $(date)" | tee -a "$LOG_FILE"
echo "📁 Full log: $LOG_FILE" | tee -a "$LOG_FILE"

# Final status
if [[ "$HELLO_SUCCESS" == "result" && "$MCP_SUCCESS" == "result" && "$MCP_EXEC_SUCCESS" == "result" ]]; then
    echo ""
    echo "🟢 ALL TESTS PASSED - Claude Code headless + MCP is working!" | tee -a "$LOG_FILE"
    exit 0
else
    echo ""
    echo "🟡 SOME TESTS FAILED - Check log for details" | tee -a "$LOG_FILE"
    exit 1
fi