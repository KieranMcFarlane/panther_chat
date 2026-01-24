#!/bin/bash

# CopilotKit MCP Tool Binding Verification Script
# This script tests if MCP tools are being properly bound to the model

echo "═══════════════════════════════════════════════════════"
echo "🧪 CopilotKit MCP Tool Binding Verification"
echo "═══════════════════════════════════════════════════════"
echo ""

# Check if server is running
echo "📡 Checking if dev server is running..."
if ! curl -s http://localhost:3005 > /dev/null; then
  echo "❌ Dev server not running on port 3005"
  echo "   Start it with: npm run dev"
  exit 1
fi

echo "✅ Dev server is running"
echo ""

# Test 1: Simple query that should trigger tools
echo "🧪 Test 1: Sending query that should trigger graph search..."
echo ""

RESPONSE=$(curl -s -X POST http://localhost:3005/api/copilotkit \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "Search the graph for Arsenal and tell me what entities you find"
      }
    ],
    "stream": false
  }')

echo "Response received (first 500 chars):"
echo "$RESPONSE" | cut -c1-500
echo ""
echo "..."

# Test 2: Check server logs for tool binding
echo ""
echo "═══════════════════════════════════════════════════════"
echo "📋 Manual Log Check Instructions"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "Check your server logs for these SUCCESS indicators:"
echo ""
echo "✅ Tool extraction:"
echo "   🔧 Extracting MCP tools for model binding..."
echo "   ✅ Extracted X MCP tools for model"
echo "   🎯 Filtered to X allowed tools"
echo ""
echo "✅ Tool binding:"
echo "   🔧 Tools sent to model: mcp__graphiti__search_nodes, ..."
echo ""
echo "✅ Tool execution:"
echo "   🔧 TOOL CALLED: mcp__graphiti__search_nodes"
echo "   ✅ TOOL RESULT: mcp__graphiti__search_nodes"
echo ""
echo "✅ Summary:"
echo "   📊 TOOL EXECUTION SUMMARY"
echo "   Tools sent to model: X"
echo "   Tool calls made: X"
echo "   Tools called:"
echo "     1. tool_name"
echo ""
echo "═══════════════════════════════════════════════════════"
echo "🎯 SUCCESS Criteria"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "The fix is working if you see:"
echo "  1. ✅ Tools extracted from MCP servers"
echo "  2. ✅ Tools sent to model (not just mcpServers config)"
echo "  3. ✅ Tool calls made (> 0)"
echo "  4. ✅ Tool results returned"
echo ""
echo "If 'Tool calls made: 0' but tools were sent:"
echo "  • The model may have chosen not to use tools"
echo "  • Try a more explicit prompt like 'Use the search tool to...'"
echo ""
echo "═══════════════════════════════════════════════════════"
