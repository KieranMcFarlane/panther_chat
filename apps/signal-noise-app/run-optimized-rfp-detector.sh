#!/bin/bash

# Optimized RFP Detection Runner
# Economical 3-entity batch processing with strict digital-only filtering

echo "🎯 Starting Optimized RFP Detection System"
echo "📋 Features:"
echo "  - Economical 3-entity batch processing"
echo "  - Strict digital-only filtering (no stadiums, hospitality, apparel)"
echo "  - Real URL validation (no fabricated URLs)"
echo "  - Perplexity MCP integration"
echo "  - Memory-optimized processing"
echo ""

# Check if required tools are available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed"
    exit 1
fi

# Check if MCP tools are configured (environment variables)
if [[ -z "$ANTHROPIC_API_KEY" ]]; then
    echo "⚠️  ANTHROPIC_API_KEY not set - required for Perplexity MCP"
fi

if [[ -z "$NEO4J_URI" ]]; then
    echo "⚠️  NEO4J_URI not set - required for Neo4j MCP"
fi

echo ""
echo "🚀 Running optimized RFP detector..."
echo "📊 Log file: optimized-rfp-detector.log"
echo "💾 Results file: optimized-rfp-results.json"
echo ""

# Run the optimized detector
node optimized-rfp-detector.js

# Check exit code
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ RFP detection completed successfully!"
    echo "📄 Results saved to: optimized-rfp-results.json"
    echo "📋 Logs available in: optimized-rfp-detector.log"
else
    echo ""
    echo "❌ RFP detection failed. Check logs for details."
    exit 1
fi