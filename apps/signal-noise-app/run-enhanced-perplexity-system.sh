#!/bin/bash

# Enhanced Perplexity-First Hybrid RFP Detection System
# Execution script with proper environment setup

echo "🎯 ENHANCED PERPLEXITY-FIRST HYBRID RFP DETECTION SYSTEM"
echo "======================================================"
echo ""

# Check required environment variables
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found"
    echo "Please create .env file with required variables:"
    echo "  - PERPLEXITY_API_KEY"
    echo "  - SUPABASE_URL"
    echo "  - SUPABASE_ACCESS_TOKEN"
    echo "  - BRIGHTDATA_API_TOKEN (optional)"
    exit 1
fi

# Activate Python virtual environment if it exists
if [ -d venv ]; then
    echo "🔧 Activating virtual environment..."
    source venv/bin/activate
elif [ -d .venv ]; then
    echo "🔧 Activating virtual environment..."
    source .venv/bin/activate
fi

# Install required dependencies
echo "📦 Installing required dependencies..."
pip install -q httpx supabase python-dotenv beautifulsoup4 2>/dev/null

# Check if BrightData SDK is available
if pip show brightdata > /dev/null 2>&1; then
    echo "✅ BrightData SDK installed"
else
    echo "⚠️  BrightData SDK not found (optional, fallback will be used)"
fi

# Parse command line arguments
MAX_ENTITIES=${1:-300}
OUTPUT_FILE=${2:-"enhanced_perplexity_hybrid_results.json"}
VERBOSE=${3:-""}

echo ""
echo "🚀 Starting RFP Detection..."
echo "   Max entities: $MAX_ENTITIES"
echo "   Output file: $OUTPUT_FILE"
echo ""

# Run the enhanced system
if [ -n "$VERBOSE" ]; then
    python enhanced_perplexity_hybrid_rfp_system_v2.py \
        --max-entities $MAX_ENTITIES \
        --output "$OUTPUT_FILE" \
        --verbose
else
    python enhanced_perplexity_hybrid_rfp_system_v2.py \
        --max-entities $MAX_ENTITIES \
        --output "$OUTPUT_FILE"
fi

echo ""
echo "✅ Detection complete!"
echo "📁 Results saved to: $OUTPUT_FILE"
echo ""
echo "📊 Quick Summary:"
if [ -f "$OUTPUT_FILE" ]; then
    python -c "
import json
import sys
with open('$OUTPUT_FILE', 'r') as f:
    data = json.load(f)
    print(f\"  Entities checked: {data['entities_checked']}\")
    print(f\"  Total RFPs detected: {data['total_rfps_detected']}\")
    print(f\"  Verified RFPs: {data['verified_rfps']}\")
    print(f\"  Rejected RFPs: {data['rejected_rfps']}\")
    print(f\"  Total cost: \${data['cost_comparison']['total_cost']:.2f}\")
"
else
    echo "  ⚠️  Output file not found"
fi

echo ""
echo "💡 Next steps:"
echo "  1. Review results in $OUTPUT_FILE"
echo "  2. Check highlights array for verified opportunities"
echo "  3. Analyze competitive_intel for sales insights"
echo "  4. Use cost_comparison to report ROI"