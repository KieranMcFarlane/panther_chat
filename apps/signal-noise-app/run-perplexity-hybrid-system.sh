#!/bin/bash

# 🎯 PERPLEXITY-FIRST HYBRID RFP DETECTION SYSTEM
# Intelligent discovery with BrightData fallback for maximum quality & cost efficiency

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🎯 PERPLEXITY-FIRST HYBRID RFP DETECTION SYSTEM${NC}"
echo "================================================"
echo ""
echo "🚀 Starting intelligent RFP discovery..."
echo "   - Phase 1: Perplexity LinkedIn-first discovery (35% success rate)"
echo "   - Phase 1B: BrightData targeted fallback (tiered approach)"
echo "   - Phase 2: Perplexity validation (quality assurance)"
echo "   - Phase 3: Competitive intelligence (high-fit only)"
echo "   - Phase 4: Enhanced fit scoring (Yellow Panther matrix)"
echo "   - Phase 5: Structured output + Supabase integration"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ Error: .env file not found${NC}"
    echo "Please create .env file with required API keys:"
    echo "  - PERPLEXITY_API_KEY"
    echo "  - BRIGHTDATA_API_TOKEN"
    echo "  - SUPABASE_URL + SUPABASE_ANON_KEY"
    exit 1
fi

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    echo "🔧 Activating virtual environment..."
    source venv/bin/activate
fi

# Check if required Python packages are installed
echo "📦 Checking dependencies..."
python3 -c "import httpx" 2>/dev/null || pip3 install httpx
python3 -c "from dotenv import load_dotenv" 2>/dev/null || pip3 install python-dotenv

# Parse command line arguments
LIMIT=300
SAMPLE_MODE=false
SAMPLE_SIZE=10

while [[ $# -gt 0 ]]; do
    case $1 in
        --sample)
            SAMPLE_MODE=true
            shift
            ;;
        --limit)
            LIMIT="$2"
            shift 2
            ;;
        --size)
            SAMPLE_SIZE="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --sample        Run in sample mode (10 entities)"
            echo "  --size N        Custom sample size (default: 10)"
            echo "  --limit N       Number of entities to check (default: 300)"
            echo "  --help          Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0 --sample"
            echo "  $0 --sample --size 5"
            echo "  $0 --limit 100"
            exit 0
            ;;
        *)
            echo -e "${RED}❌ Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

echo "📊 Configuration:"
echo "   - Sample Mode: $SAMPLE_MODE"
echo "   - Sample Size: $SAMPLE_SIZE"
echo "   - Entities to check: $LIMIT"
echo ""

# Run the Perplexity-first hybrid system
echo -e "${GREEN}🚀 Starting detection...${NC}"
echo ""

# Build command arguments
CMD_ARGS=""
if [ "$SAMPLE_MODE" = true ]; then
    CMD_ARGS="$CMD_ARGS --sample"
fi
CMD_ARGS="$CMD_ARGS --size $SAMPLE_SIZE"
CMD_ARGS="$CMD_ARGS --limit $LIMIT"

python3 backend/perplexity_first_hybrid_rfp_system.py $CMD_ARGS

# Check if the script ran successfully
if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Detection completed successfully!${NC}"
    echo ""
    echo "📁 Results saved to: data/ directory"
    echo ""
    
    # Find the latest result file
    LATEST_JSON=$(ls -t data/perplexity_hybrid_results_*.json 2>/dev/null | head -1)
    
    # Display summary from JSON file
    if [ -n "$LATEST_JSON" ]; then
        echo "📊 QUICK SUMMARY:"
        echo "=================="
        
        # Extract key metrics using jq or basic grep
        if command -v jq &> /dev/null; then
            jq -r '
                "Entities checked: \(.entities_checked)",
                "Total RFPs detected: \(.total_rfps_detected)",
                "Verified RFPs: \(.verified_rfps)",
                "Rejected RFPs: \(.rejected_rfps)",
                "",
                "💰 Cost Analysis:",
                "  Total cost: $\(.cost_comparison.total_cost)",
                "  Cost per verified RFP: $\(.cost_comparison.cost_per_verified_rfp)",
                "  Savings vs old system: $\(.cost_comparison.savings_vs_old_system)"
            ' "$LATEST_JSON"
        else
            echo "💡 Install jq for formatted summary: brew install jq"
            echo ""
            grep -o '"entities_checked":[0-9]*' "$LATEST_JSON" | head -1
            grep -o '"total_rfps_detected":[0-9]*' "$LATEST_JSON" | head -1
            grep -o '"verified_rfps":[0-9]*' "$LATEST_JSON" | head -1
        fi
        
        echo ""
        echo -e "${BLUE}🎯 Top Opportunities:${NC}"
        echo "====================="
        
        if command -v jq &> /dev/null; then
            jq -r '.highlights[] | "• \(.organization) - \(.summary_json.title) (Fit: \(.summary_json.fit_score)/100)"' "$LATEST_JSON" | head -5
        else
            echo "💡 Install jq for formatted output: brew install jq"
        fi
    fi
    
    echo ""
    echo -e "${GREEN}🎉 All done!${NC}"
    
else
    echo ""
    echo -e "${RED}❌ Detection failed. Check error messages above.${NC}"
    exit 1
fi