#!/bin/bash

# Test script to verify CopilotKit tool calling is working
# This script tests the fix for the Claude Agent SDK bug where tools weren't being invoked

echo "═════════════════════════════════════════════════════════"
echo "🧪 CopilotKit Tool Calling Test"
echo "═════════════════════════════════════════════════════════"
echo ""
echo "Testing: /api/copilotkit endpoint with tool use"
echo "Expected: Tool should be called (search_nodes)"
echo ""

RESPONSE=$(curl -s -X POST http://localhost:3005/api/copilotkit \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role":"user","content":"Search for Arsenal and tell me what you find"}
    ],
    "stream": false
  }')

echo "Response:"
echo "$RESPONSE" | grep -o '{"type":"tool"' && echo "✅ TOOL WAS CALLED" || echo "❌ NO TOOL CALL DETECTED"
echo ""

# Check for tool result
echo "$RESPONSE" | grep -o '{"type":"tool_result"' && echo "✅ TOOL RESULT RECEIVED" || echo "❌ NO TOOL RESULT"
echo ""

# Check for actual content
if echo "$RESPONSE" | grep -q "Arsenal"; then
  echo "✅ RESPONSE CONTAINS DATA"
else
  echo "❌ RESPONSE MISSING DATA"
fi

echo ""
echo "═════════════════════════════════════════════════════════"
echo "Full response (first 500 chars):"
echo "$RESPONSE" | head -c 500
echo ""
echo "═════════════════════════════════════════════════════════"
