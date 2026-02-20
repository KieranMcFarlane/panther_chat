#!/bin/bash

# Perplexity-First Hybrid RFP Detection System Execution Script
# 
# This script runs the complete 5-phase hybrid RFP detection system with MCP integration
#
# Usage:
#   ./run-perplexity-mcp-hybrid-rfp-system.sh [options]
#
# Options:
#   --sample              Run in sample mode (test with limited entities)
#   --size N              Number of entities to process in sample mode (default: 10)
#   --limit N             Maximum entities to query from database (default: 300)
#   --help                Show this help message
#
# Examples:
#   ./run-perplexity-mcp-hybrid-rfp-system.sh --sample --size 5
#   ./run-perplexity-mcp-hybrid-rfp-system.sh --limit 100

set -e  # Exit on error

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Default configuration
SAMPLE_MODE=false
SAMPLE_SIZE=10
ENTITY_LIMIT=300
SHOW_HELP=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --sample)
            SAMPLE_MODE=true
            shift
            ;;
        --size)
            SAMPLE_SIZE="$2"
            shift 2
            ;;
        --limit)
            ENTITY_LIMIT="$2"
            shift 2
            ;;
        --help)
            SHOW_HELP=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Show help if requested
if [ "$SHOW_HELP" = true ]; then
    echo "Perplexity-First Hybrid RFP Detection System Execution Script"
    echo ""
    echo "Usage:"
    echo "  $0 [options]"
    echo ""
    echo "Options:"
    echo "  --sample              Run in sample mode (test with limited entities)"
    echo "  --size N              Number of entities to process in sample mode (default: 10)"
    echo "  --limit N             Maximum entities to query from database (default: 300)"
    echo "  --help                Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --sample --size 5"
    echo "  $0 --limit 100"
    echo ""
    exit 0
fi

# Print configuration
echo "🎯 Perplexity-First Hybrid RFP Detection System"
echo "================================================"
echo ""
echo "Configuration:"
echo "  Sample Mode: $SAMPLE_MODE"
echo "  Sample Size: $SAMPLE_SIZE"
echo "  Entity Limit: $ENTITY_LIMIT"
echo ""

# Check required environment variables
echo "🔍 Checking environment variables..."

# Check Perplexity API key
if [ -z "$PERPLEXITY_API_KEY" ]; then
    echo "⚠️  WARNING: PERPLEXITY_API_KEY not set"
    echo "   System will run with mock data"
    echo "   Set PERPLEXITY_API_KEY in .env for real detection"
else
    echo "✅ PERPLEXITY_API_KEY found"
fi

# Check Supabase access token
if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
    echo "⚠️  WARNING: SUPABASE_ACCESS_TOKEN not set"
    echo "   System will use mock entity data"
    echo "   Set SUPABASE_ACCESS_TOKEN in .env for real entity queries"
else
    echo "✅ SUPABASE_ACCESS_TOKEN found"
fi

# Check BrightData API token
if [ -z "$BRIGHTDATA_API_TOKEN" ]; then
    echo "⚠️  WARNING: BRIGHTDATA_API_TOKEN not set"
    echo "   System will run with Perplexity-only mode"
    echo "   Set BRIGHTDATA_API_TOKEN in .env for BrightData fallback"
else
    echo "✅ BRIGHTDATA_API_TOKEN found"
fi

echo ""

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "❌ ERROR: Python 3 not found"
    echo "   Please install Python 3.8+ to run this system"
    exit 1
fi

echo "✅ Python 3 found: $(python3 --version)"

# Check if required packages are installed
echo "📦 Checking Python dependencies..."

REQUIRED_PACKAGES=("asyncio" "aiohttp" "python-dotenv" "requests")
MISSING_PACKAGES=()

for package in "${REQUIRED_PACKAGES[@]}"; do
    if ! python3 -c "import $package" 2>/dev/null; then
        MISSING_PACKAGES+=("$package")
    fi
done

if [ ${#MISSING_PACKAGES[@]} -gt 0 ]; then
    echo "⚠️  WARNING: Missing Python packages: ${MISSING_PACKAGES[*]}"
    echo "   Installing missing packages..."
    pip install "${MISSING_PACKAGES[@]}" || {
        echo "❌ ERROR: Failed to install required packages"
        echo "   Please run: pip install ${MISSING_PACKAGES[*]}"
        exit 1
    }
fi

echo "✅ All required Python packages installed"
echo ""

# Create data directory if it doesn't exist
mkdir -p data

# Build command arguments
CMD_ARGS=""
if [ "$SAMPLE_MODE" = true ]; then
    CMD_ARGS="$CMD_ARGS --sample"
fi

if [ "$SAMPLE_SIZE" != "10" ]; then
    CMD_ARGS="$CMD_ARGS --size $SAMPLE_SIZE"
fi

if [ "$ENTITY_LIMIT" != "300" ]; then
    CMD_ARGS="$CMD_ARGS --limit $ENTITY_LIMIT"
fi

# Run the system
echo "🚀 Starting Perplexity-First Hybrid RFP Detection System..."
echo ""

# Run the Python script
python3 backend/perplexity_mcp_hybrid_rfp_system.py $CMD_ARGS

# Check exit status
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ System execution completed successfully!"
    echo ""
    echo "📁 Results saved to data/ directory:"
    echo "   - perplexity_mcp_hybrid_results_*.json (raw JSON data)"
    echo "   - perplexity_mcp_hybrid_report_*.txt (human-readable report)"
    echo ""
else
    echo ""
    echo "❌ System execution failed!"
    echo "   Check the logs for details: perplexity_mcp_hbrid_rfp_system.log"
    echo ""
    exit 1
fi