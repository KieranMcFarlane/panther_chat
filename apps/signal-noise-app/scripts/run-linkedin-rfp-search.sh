#!/bin/bash

# LinkedIn RFP Search with Claude Agent SDK + BrightData MCP
# This script sets up the environment and runs headless LinkedIn RFP discovery

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
VENV_DIR="$PROJECT_DIR/venv-claude-sdk"

# Logging function
log() {
    echo -e "${GREEN}[$(date '+%H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check Python virtual environment
    if [ ! -d "$VENV_DIR" ]; then
        error "Python virtual environment not found at $VENV_DIR"
        info "Creating virtual environment..."
        python3 -m venv "$VENV_DIR"
        source "$VENV_DIR/bin/activate"
        pip install claude-agent-sdk requests
    else
        info "Using existing virtual environment at $VENV_DIR"
    fi
    
    # Check required environment variables
    if [ -z "$ANTHROPIC_API_KEY" ]; then
        error "ANTHROPIC_API_KEY environment variable is required"
        info "Set it with: export ANTHROPIC_API_KEY=your_key_here"
        exit 1
    fi
    
    if [ -z "$BRIGHTDATA_TOKEN" ]; then
        warn "BRIGHTDATA_TOKEN not set. LinkedIn search may not work."
        info "Set it with: export BRIGHTDATA_TOKEN=your_token_here"
    fi
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        error "Node.js is required but not installed"
        exit 1
    fi
    
    # Check MCP server file
    MCP_SERVER="$PROJECT_DIR/src/mcp-brightdata-server.js"
    if [ ! -f "$MCP_SERVER" ]; then
        error "BrightData MCP server not found at $MCP_SERVER"
        exit 1
    fi
    
    log "Prerequisites check completed"
}

# Create environment file for MCP server
create_mcp_env() {
    local env_file="$PROJECT_DIR/.mcp-env"
    cat > "$env_file" << EOF
# BrightData MCP Environment
BRIGHTDATA_TOKEN=${BRIGHTDATA_TOKEN:-""}
BRIGHTDATA_ZONE=${BRIGHTDATA_ZONE:-"linkedin_posts_monitor"}
EOF
    log "Created MCP environment file at $env_file"
}

# Run the LinkedIn RFP search
run_linkedin_search() {
    log "Starting LinkedIn RFP search with Claude Agent SDK..."
    
    # Activate virtual environment
    source "$VENV_DIR/bin/activate"
    
    # Set environment for the script
    export ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY"
    export BRIGHTDATA_TOKEN="$BRIGHTDATA_TOKEN"
    export BRIGHTDATA_ZONE="$BRIGHTDATA_ZONE"
    
    # Run the search script
    cd "$PROJECT_DIR"
    
    log "Executing: python3 scripts/claude-agent-linkedin-rfp-search.py"
    python3 scripts/claude-agent-linkedin-rfp-search.py
    
    local exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        log "LinkedIn RFP search completed successfully!"
        
        # Show results if any were created
        RESULTS_DIR="$PROJECT_DIR/logs"
        if [ -d "$RESULTS_DIR" ]; then
            LATEST_RESULT=$(ls -t "$RESULTS_DIR"/linkedin-rfp-search-*.json 2>/dev/null | head -1)
            if [ -f "$LATEST_RESULT" ]; then
                log "Latest results saved to: $LATEST_RESULT"
                
                # Show summary
                COUNT=$(jq '.search_metadata.total_results // 0' "$LATEST_RESULT" 2>/dev/null || echo "unknown")
                log "Found $COUNT RFP opportunities"
                
                # Show first few results
                if command -v jq &> /dev/null && [ "$COUNT" -gt 0 ]; then
                    info "Sample results:"
                    jq -r '.results[:3] | to_entries[] | "  \(.key + 1). \(.value.organization // "Unknown") - \(.value.title // "No title")"' "$LATEST_RESULT" 2>/dev/null || true
                fi
            fi
        fi
    else
        error "LinkedIn RFP search failed with exit code $exit_code"
        exit $exit_code
    fi
}

# Main execution
main() {
    log "🚀 LinkedIn RFP Search - Claude Agent SDK + BrightData MCP"
    log "======================================================"
    
    check_prerequisites
    create_mcp_env
    run_linkedin_search
    
    log "✅ Process completed!"
}

# Help function
show_help() {
    cat << EOF
LinkedIn RFP Search with Claude Agent SDK + BrightData MCP

USAGE:
    $0 [OPTIONS]

DESCRIPTION:
    This script runs a headless LinkedIn RFP search using Claude Agent SDK 
    and BrightData MCP integration, similar to the CopilotKit setup 
    but operating without a UI.

ENVIRONMENT VARIABLES:
    ANTHROPIC_API_KEY    Required - Your Claude API key
    BRIGHTDATA_TOKEN    Optional - Your BrightData API token for LinkedIn access
    BRIGHTDATA_ZONE     Optional - BrightData zone name (default: linkedin_posts_monitor)

EXAMPLES:
    # Basic usage
    $0
    
    # With environment variables
    export ANTHROPIC_API_KEY="your_key_here"
    export BRIGHTDATA_TOKEN="your_brightdata_token"
    $0

OUTPUT:
    Results are saved to logs/linkedin-rfp-search-YYYYMMDD-HHMMSS.json

EOF
}

# Parse command line arguments
case "${1:-}" in
    -h|--help)
        show_help
        exit 0
        ;;
    "")
        main
        ;;
    *)
        error "Unknown option: $1"
        show_help
        exit 1
        ;;
esac