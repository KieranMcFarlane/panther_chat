#!/bin/bash
# Quick test to verify Perplexity MCP is accessible to Claude

cd "$(dirname "$0")"

echo "🧪 Testing Perplexity MCP connection..."
echo ""

# Create minimal MCP config with ONLY Perplexity
cat > mcp-config-perplexity-only.json <<'EOF'
{
  "mcpServers": {
    "perplexity-mcp": {
      "command": "npx",
      "args": ["-y", "mcp-perplexity-search"],
      "env": {
        "PERPLEXITY_API_KEY": "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"
      }
    }
  }
}
EOF

echo "📋 Running Claude with ONLY Perplexity MCP..."
claude -p "Use the perplexity-mcp chat_completion tool to search for: 'NBA digital transformation projects 2024'. Tell me what you find." \
  --mcp-config mcp-config-perplexity-only.json \
  --permission-mode bypassPermissions \
  --output-format text 2>&1

rm -f mcp-config-perplexity-only.json
echo ""
echo "✅ Test complete"











