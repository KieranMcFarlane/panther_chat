#!/bin/bash

###############################################################################
# 🎯 Enhanced Perplexity-First Hybrid RFP Detection System
# Intelligent discovery with BrightData fallback for maximum quality & cost efficiency
#
# Usage:
#   ./run-enhanced-perplexity-hybrid-system.sh [options]
#
# Options:
#   --max-entities N    Number of entities to check (default: 300)
#   --output FILE       Output file path (default: enhanced_perplexity_hybrid_results.json)
#   --verbose           Enable verbose logging
#   --dry-run           Show commands without executing
#   --help              Show this help message
#
# Example:
#   ./run-enhanced-perplexity-hybrid-system.sh --max-entities 100 --output results.json
#
###############################################################################

set -e  # Exit on error

# Default values
MAX_ENTITIES=300
OUTPUT_FILE="enhanced_perplexity_hybrid_results.json"
VERBOSE=false
DRY_RUN=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --max-entities)
            MAX_ENTITIES="$2"
            shift 2
            ;;
        --output)
            OUTPUT_FILE="$2"
            shift 2
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --max-entities N    Number of entities to check (default: 300)"
            echo "  --output FILE       Output file path (default: enhanced_perplexity_hybrid_results.json)"
            echo "  --verbose           Enable verbose logging"
            echo "  --dry-run           Show commands without executing"
            echo "  --help              Show this help message"
            echo ""
            echo "Example:"
            echo "  $0 --max-entities 100 --output results.json"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print banner
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}🎯 ENHANCED PERPLEXITY-FIRST HYBRID RFP DETECTION SYSTEM${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${GREEN}Configuration:${NC}"
echo -e "  Max Entities: ${YELLOW}${MAX_ENTITIES}${NC}"
echo -e "  Output File: ${YELLOW}${OUTPUT_FILE}${NC}"
echo -e "  Verbose: ${YELLOW}${VERBOSE}${NC}"
echo -e "  Dry Run: ${YELLOW}${DRY_RUN}${NC}"
echo ""

# Check if Python script exists
PYTHON_SCRIPT="enhanced_perplexity_hybrid_rfp_system.py"
if [ ! -f "$PYTHON_SCRIPT" ]; then
    echo -e "${RED}Error: Python script '$PYTHON_SCRIPT' not found!${NC}"
    exit 1
fi

# Build command
CMD="python3 $PYTHON_SCRIPT --max-entities $MAX_ENTITIES --output $OUTPUT_FILE"

if [ "$VERBOSE" = true ]; then
    CMD="$CMD --verbose"
fi

# Show command if dry run
if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}Dry run mode - command that would be executed:${NC}"
    echo "$CMD"
    exit 0
fi

# Execute command
echo -e "${BLUE}Starting RFP detection...${NC}"
echo ""
eval $CMD

# Check exit status
if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}✅ RFP Detection Completed Successfully!${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "Results saved to: ${YELLOW}${OUTPUT_FILE}${NC}"
    echo ""
    
    # Show quick stats if file exists
    if [ -f "$OUTPUT_FILE" ]; then
        echo -e "${BLUE}📊 Quick Statistics:${NC}"
        
        # Extract and display key metrics using jq if available
        if command -v jq &> /dev/null; then
            TOTAL_RFPS=$(jq -r '.total_rfps_detected' "$OUTPUT_FILE" 2>/dev/null || echo "N/A")
            VERIFIED_RFPS=$(jq -r '.verified_rfps' "$OUTPUT_FILE" 2>/dev/null || echo "N/A")
            ENTITIES_CHECKED=$(jq -r '.entities_checked' "$OUTPUT_FILE" 2>/dev/null || echo "N/A")
            TOTAL_COST=$(jq -r '.cost_comparison.total_cost' "$OUTPUT_FILE" 2>/dev/null || echo "N/A")
            
            echo -e "  Entities Checked: ${YELLOW}${ENTITIES_CHECKED}${NC}"
            echo -e "  Total RFPs Detected: ${YELLOW}${TOTAL_RFPS}${NC}"
            echo -e "  Verified RFPs: ${YELLOW}${VERIFIED_RFPS}${NC}"
            echo -e "  Total Cost: ${YELLOW}\$${TOTAL_COST}${NC}"
        else
            echo "  (Install jq for detailed statistics)"
        fi
    fi
    echo ""
else
    echo ""
    echo -e "${RED}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${RED}❌ RFP Detection Failed!${NC}"
    echo -e "${RED}═══════════════════════════════════════════════════════════════${NC}"
    exit 1
fi