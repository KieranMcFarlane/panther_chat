#!/bin/bash

# 🎯 PERPLEXITY-FIRST HYBRID RFP MONITORING SYSTEM RUNNER
# Intelligent discovery with BrightData fallback for maximum quality & cost efficiency

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$SCRIPT_DIR/perplexity-hybrid-rfp-monitor.log"
OUTPUT_FILE="$SCRIPT_DIR/perplexity-hybrid-rfp-results.json"
NODE_SCRIPT="$SCRIPT_DIR/perplexity-hybrid-rfp-monitor.js"

# Logging function
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
}

info() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] INFO:${NC} $1"
}

# Display banner
display_banner() {
    clear
    echo -e "${BLUE}"
    cat << 'EOF'
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║  🎯 PERPLEXITY-FIRST HYBRID RFP DETECTION SYSTEM            ║
║  Intelligent Discovery with BrightData Fallback              ║
║                                                              ║
║  • Perplexity-First Approach (5-Priority Search)             ║
║  • Cost-Optimized BrightData Fallback                        ║
║  • AI-Powered Validation & Competitive Intelligence           ║
║  • Enhanced Yellow Panther Fit Scoring                       ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
    echo ""
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if Node.js is available
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed. Please install Node.js 18+ to continue."
        exit 1
    fi
    
    # Check if the script exists
    if [[ ! -f "$NODE_SCRIPT" ]]; then
        error "RFP monitoring script not found at: $NODE_SCRIPT"
        exit 1
    fi
    
    # Check if we're in the right directory
    if [[ ! -d "$SCRIPT_DIR/src" ]]; then
        warn "Not running from project root. Some features may not work properly."
    fi
    
    log "Prerequisites check passed"
}

# Validate environment variables
validate_environment() {
    log "Validating environment variables..."
    
    local required_vars=(
        "ANTHROPIC_API_KEY"
        "PERPLEXITY_API_KEY"
        "NEO4J_URI"
        "NEO4J_USERNAME"
        "NEO4J_PASSWORD"
    )
    
    local missing_vars=()
    local optional_vars=(
        "BRIGHTDATA_API_TOKEN"
        "SUPABASE_URL"
        "SUPABASE_ANON_KEY"
        "AWS_ACCESS_KEY_ID"
        "AWS_SECRET_ACCESS_KEY"
        "S3_BUCKET_NAME"
    )
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            missing_vars+=("$var")
        fi
    done
    
    for var in "${optional_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            warn "Optional environment variable $var is not set"
        fi
    done
    
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        error "Missing required environment variables:"
        printf '  %s\n' "${missing_vars[@]}"
        error "Please set these variables and try again."
        exit 1
    fi
    
    log "Environment validation passed"
}

# Display configuration summary
display_config_summary() {
    echo -e "${BLUE}Configuration Summary:${NC}"
    echo "  • Entity Batch Size: 10 entities per batch"
    echo "  • Total Entities to Process: 300 maximum"
    echo "  • High-Value Threshold: 80+ fit score for competitive intelligence"
    echo "  • Cost Optimization: 70% reduction vs BrightData-first approach"
    echo "  • Output File: $OUTPUT_FILE"
    echo "  • Log File: $LOG_FILE"
    echo ""
    
    echo -e "${BLUE}Expected Cost Breakdown:${NC}"
    echo "  • Perplexity Discovery: ~$0.01 per entity"
    echo "  • Perplexity Validation: ~$0.005 per validation"
    echo "  • BrightData Targeted: ~$0.005 per domain query"
    echo "  • BrightData Broad: ~$0.05 per broad search (last resort)"
    echo "  • Competitive Intelligence: ~$0.015 per high-value opportunity"
    echo ""
    
    echo -e "${BLUE}Phase 1: Perplexity Discovery (5-Priority Search)${NC}"
    echo "  1. LinkedIn Official Posts (35% success rate)"
    echo "  2. LinkedIn Job Postings (25% - early signals)"
    echo "  3. Tender Platforms (30% success rate)"
    echo "  4. Sports News Sites (20% - partnership signals)"
    echo "  5. LinkedIn Articles & Company Pages (15% success rate)"
    echo ""
    
    echo -e "${BLUE}Phase 1B: BrightData Fallback (Cost-Optimized)${NC}"
    echo "  • Tier 1: Known tender domains (targeted, $0.005)"
    echo "  • Tier 2: Sports industry news (targeted, $0.005)"
    echo "  • Tier 3: LinkedIn targeted search (targeted, $0.005)"
    echo "  • Tier 4: General web search (broad, $0.05 - last resort)"
    echo ""
}

# Run the RFP monitoring system
run_monitoring() {
    log "Starting Perplexity-First Hybrid RFP Monitoring System..."
    echo ""
    
    # Run the Node.js script
    cd "$SCRIPT_DIR"
    
    # Set environment variables for the script
    export NODE_ENV="${NODE_ENV:-production}"
    export RFP_LOG_LEVEL="${RFP_LOG_LEVEL:-INFO}"
    
    # Execute the monitoring script
    if node "$NODE_SCRIPT"; then
        echo ""
        log "RFP monitoring completed successfully!"
        
        # Display summary if output file exists
        if [[ -f "$OUTPUT_FILE" ]]; then
            echo ""
            echo -e "${GREEN}Results Summary:${NC}"
            
            # Extract key metrics from the JSON output
            if command -v jq &> /dev/null; then
                local total_entities=$(jq '.entities_checked' "$OUTPUT_FILE")
                local verified_rfps=$(jq '.verified_rfps' "$OUTPUT_FILE")
                local total_cost=$(jq '.cost_comparison.total_cost' "$OUTPUT_FILE")
                local savings=$(jq '.cost_comparison.savings_vs_old_system' "$OUTPUT_FILE")
                
                echo "  • Entities Processed: $total_entities"
                echo "  • Verified RFPs: $verified_rfps"
                echo "  • Total Cost: \$$total_cost"
                echo "  • Cost Savings: \$$savings vs BrightData-first approach"
            else
                echo "  Results saved to: $OUTPUT_FILE"
                echo "  Install jq for detailed summary: brew install jq"
            fi
            
            echo "  • Log file: $LOG_FILE"
        fi
    else
        error "RFP monitoring failed. Check log file for details: $LOG_FILE"
        exit 1
    fi
}

# Display real-time monitoring
monitor_progress() {
    if [[ ! -f "$LOG_FILE" ]]; then
        warn "No log file found for monitoring"
        return
    fi
    
    echo ""
    echo -e "${BLUE}Real-time Progress:${NC}"
    
    # Tail the log file with color coding
    tail -f "$LOG_FILE" | while read -r line; do
        if [[ $line == *"[SUCCESS]"* ]]; then
            echo -e "${GREEN}$line${NC}"
        elif [[ $line == *"[ERROR]"* ]]; then
            echo -e "${RED}$line${NC}"
        elif [[ $line == *"[WARNING]"* ]]; then
            echo -e "${YELLOW}$line${NC}"
        elif [[ $line == *"[INFO]"* ]]; then
            echo -e "${BLUE}$line${NC}"
        elif [[ $line == *"[ENTITY-START]"* ]]; then
            echo -e "${GREEN}$line${NC}"
        elif [[ $line == *"[ENTITY-PERPLEXITY-RFP]"* ]]; then
            echo -e "${GREEN}✅ $line${NC}"
        elif [[ $line == *"[ENTITY-BRIGHTDATA-DETECTED]"* ]]; then
            echo -e "${YELLOW}🔍 $line${NC}"
        elif [[ $line == *"[ENTITY-VERIFIED]"* ]]; then
            echo -e "${GREEN}🎯 $line${NC}"
        elif [[ $line == *"[ENTITY-REJECTED]"* ]]; then
            echo -e "${RED}❌ $line${NC}"
        elif [[ $line == *"[ENTITY-NONE]"* ]]; then
            echo -e "${BLUE}➖ $line${NC}"
        else
            echo "$line"
        fi
    done
}

# Clean up previous runs
cleanup() {
    log "Cleaning up previous run files..."
    
    # Backup previous results if they exist
    if [[ -f "$OUTPUT_FILE" ]]; then
        local timestamp=$(date '+%Y%m%d_%H%M%S')
        mv "$OUTPUT_FILE" "${OUTPUT_FILE}.${timestamp}.bak"
        log "Previous results backed up to: ${OUTPUT_FILE}.${timestamp}.bak"
    fi
    
    # Clear log file
    if [[ -f "$LOG_FILE" ]]; then
        > "$LOG_FILE"
        log "Log file cleared"
    fi
}

# Show help
show_help() {
    cat << EOF
🎯 PERPLEXITY-FIRST HYBRID RFP MONITORING SYSTEM

USAGE:
    $0 [OPTIONS]

OPTIONS:
    -h, --help          Show this help message
    -c, --clean         Clean up previous run files before starting
    -m, --monitor       Show real-time monitoring during execution
    -s, --summary       Display configuration summary only
    -e, --env-check     Only check environment variables

EXAMPLES:
    $0                  Run full RFP monitoring system
    $0 -c -m           Clean previous files and monitor in real-time
    $0 -s               Show configuration summary
    $0 -e               Check environment setup

ENVIRONMENT VARIABLES:
    ANTHROPIC_API_KEY    Claude API key (required)
    PERPLEXITY_API_KEY   Perplexity API key (required)
    NEO4J_URI           Neo4j database URI (required)
    NEO4J_USERNAME      Neo4j username (required)
    NEO4J_PASSWORD      Neo4j password (required)
    BRIGHTDATA_API_TOKEN BrightData API token (optional)
    SUPABASE_URL        Supabase project URL (optional)
    SUPABASE_ANON_KEY   Supabase anonymous key (optional)

COST OPTIMIZATION:
    This system uses a Perplexity-first approach with targeted BrightData
    fallback, achieving approximately 70% cost reduction vs traditional
    BrightData-first approaches while maintaining high detection quality.

EOF
}

# Main execution
main() {
    local clean=false
    local monitor=false
    local summary_only=false
    local env_check_only=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -c|--clean)
                clean=true
                shift
                ;;
            -m|--monitor)
                monitor=true
                shift
                ;;
            -s|--summary)
                summary_only=true
                shift
                ;;
            -e|--env-check)
                env_check_only=true
                shift
                ;;
            *)
                error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    display_banner
    
    if [[ "$env_check_only" == true ]]; then
        check_prerequisites
        validate_environment
        log "Environment check completed successfully!"
        exit 0
    fi
    
    if [[ "$summary_only" == true ]]; then
        display_config_summary
        exit 0
    fi
    
    check_prerequisites
    validate_environment
    
    if [[ "$clean" == true ]]; then
        cleanup
    fi
    
    display_config_summary
    
    if [[ "$monitor" == true ]]; then
        # Start monitoring in background
        run_monitoring &
        monitor_pid=$!
        
        # Start real-time monitoring
        monitor_progress
        
        # Wait for background process to complete
        wait $monitor_pid
    else
        run_monitoring
    fi
    
    echo ""
    log "RFP monitoring system execution complete!"
}

# Execute main function with all arguments
main "$@"