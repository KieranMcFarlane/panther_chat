#!/bin/bash

# 🎯 Comprehensive RFP Monitoring System - Execution Script
# Following COMPLETE-RFP-MONITORING-SYSTEM.md specifications
# Digital-first strategy for Yellow Panther sports agency opportunities

echo "🎯 COMPREHENSIVE RFP MONITORING SYSTEM"
echo "Digital-First Strategy for Yellow Panther Sports Agency"
echo "======================================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed"
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  Warning: .env file not found"
    echo "📝 Creating .env file from example..."
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "✅ Created .env file - Please add your API keys"
    else
        echo "❌ Error: .env.example file not found"
        exit 1
    fi
fi

echo "🔧 Environment Setup"
echo "===================="
echo "Neo4j MCP: mcp__neo4j-mcp__execute_query"
echo "BrightData MCP: mcp__brightData__search_engine"
echo "Perplexity MCP: mcp__perplexity-mcp__chat_completion"
echo "Supabase MCP: mcp__supabase__execute_sql"
echo ""

echo "🚀 Starting RFP Monitoring..."
echo "=============================="
echo ""

# Run the comprehensive RFP monitor
node comprehensive-rfp-monitor.js

# Check exit code
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ RFP Monitoring completed successfully"
    echo ""
    echo "📊 Results Summary:"
    echo "==================="
    echo "- Check the latest rfp-monitoring-results-*.json file"
    echo "- Results also stored in Supabase 'rfp_opportunities' table"
    echo "- Only digital RFPs and signals included (no infrastructure)"
    echo ""
    
    # Show the latest results file
    latest_file=$(ls -t rfp-monitoring-results-*.json 2>/dev/null | head -1)
    if [ -f "$latest_file" ]; then
        echo "📁 Latest results: $latest_file"
        echo "📈 Quick summary:"
        node -e "
            const data = require('./${latest_file}');
            console.log('  Total RFPs Detected:', data.total_rfps_detected);
            console.log('  Entities Checked:', data.entities_checked);
            console.log('  Avg Confidence:', data.scoring_summary.avg_confidence);
            console.log('  Avg Fit Score:', data.scoring_summary.avg_fit_score);
            console.log('  Top Opportunity:', data.scoring_summary.top_opportunity);
        "
    fi
else
    echo ""
    echo "❌ RFP Monitoring failed"
    echo "📝 Check the error messages above"
    exit 1
fi