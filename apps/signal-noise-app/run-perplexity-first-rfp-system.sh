#!/bin/bash

# 🎯 PERPLEXITY-FIRST HYBRID RFP DETECTION SYSTEM
# Intelligent discovery with BrightData fallback for maximum quality & cost efficiency

set -e

# Configuration
MAX_ENTITIES=${MAX_ENTITIES:-300}
OUTPUT_FILE=${OUTPUT_FILE:-""}
VERBOSE=${VERBOSE:-""}
TIMEOUT_SECONDS=120

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    log_error "Python 3 is not installed or not in PATH"
    exit 1
fi

# Check if the main script exists
MAIN_SCRIPT="run_perplexity_first_rfp_system.py"
if [ ! -f "$MAIN_SCRIPT" ]; then
    log_error "Main script not found: $MAIN_SCRIPT"
    log_info "Please create the script first"
    exit 1
fi

# Print banner
echo -e "${MAGENTA}"
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║   🎯 PERPLEXITY-FIRST HYBRID RFP DETECTION SYSTEM            ║"
echo "║   Intelligent Discovery with BrightData Fallback             ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Main execution
main() {
    log_info "🎯 PERPLEXITY-FIRST HYBRID RFP DETECTION SYSTEM"
    log_info "Starting RFP detection process..."
    log_info "Maximum entities to check: $MAX_ENTITIES"
    log_info "Python script: $MAIN_SCRIPT"
    echo ""
    
    # Build command arguments
    CMD_ARGS=""
    
    if [ -n "$MAX_ENTITIES" ]; then
        CMD_ARGS="$CMD_ARGS --max-entities $MAX_ENTITIES"
    fi
    
    if [ -n "$OUTPUT_FILE" ]; then
        CMD_ARGS="$CMD_ARGS --output $OUTPUT_FILE"
    fi
    
    if [ -n "$VERBOSE" ]; then
        CMD_ARGS="$CMD_ARGS --verbose"
    fi
    
    # Run the Python script
    log_info "Executing: python3 $MAIN_SCRIPT $CMD_ARGS"
    echo ""
    
    if python3 $MAIN_SCRIPT $CMD_ARGS; then
        echo ""
        log_success "RFP detection completed successfully!"
        
        # Find the most recent results file
        LATEST_JSON=$(ls -t rfp_detection_results_*.json 2>/dev/null | head -n 1)
        
        if [ -n "$LATEST_JSON" ]; then
            log_success "Results saved to: $LATEST_JSON"
            
            # Display summary
            echo ""
            echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
            echo -e "${CYAN}QUICK SUMMARY${NC}"
            echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
            
            # Extract and display key metrics using jq if available
            if command -v jq &> /dev/null; then
                echo "Total entities checked: $(jq '.entities_checked' $LATEST_JSON)"
                echo "Total RFPs detected: $(jq '.total_rfps_detected' $LATEST_JSON)"
                echo "Verified RFPs: $(jq '.verified_rfps' $LATEST_JSON)"
                echo "Verification rate: $(jq '.quality_metrics.verified_rate' $LATEST_JSON)"
                echo "Average confidence: $(jq '.scoring_summary.avg_confidence' $LATEST_JSON)"
                echo "Average fit score: $(jq '.scoring_summary.avg_fit_score' $LATEST_JSON)"
                echo "Total cost: \$$(jq '.cost_comparison.total_cost' $LATEST_JSON)"
                echo "Cost per verified RFP: \$$(jq '.cost_comparison.cost_per_verified_rfp' $LATEST_JSON)"
                echo "Savings vs old system: \$$(jq '.cost_comparison.savings_vs_old_system' $LATEST_JSON)"
            else
                log_warning "jq not installed - install jq for detailed JSON viewing"
                echo "Install jq: brew install jq (macOS) or apt install jq (Linux)"
            fi
            
            echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
        fi
        
        exit 0
    else
        log_error "RFP detection failed!"
        exit 1
    fi
}

# Run main function
main "$@"