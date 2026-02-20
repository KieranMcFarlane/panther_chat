#!/bin/bash
# 🎯 Enhanced Perplexity-First Hybrid RFP Detection System v2.0
# Execution script for comprehensive RFP monitoring with all 5 phases

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_SCRIPT="${SCRIPT_DIR}/enhanced_perplexity_hybrid_rfp_system.py"
LOG_DIR="${SCRIPT_DIR}/logs"
RESULTS_DIR="${SCRIPT_DIR}/results"

# Create necessary directories
mkdir -p "${LOG_DIR}"
mkdir -p "${RESULTS_DIR}"

# Function to print colored messages
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to show usage
show_usage() {
    cat << USAGE
🎯 Enhanced Perplexity-First Hybrid RFP Detection System v2.0

Usage: $0 [OPTIONS]

Options:
    -e, --entities N        Maximum entities to check (default: 300)
    -o, --output FILE       Output JSON file path
    -v, --verbose           Enable verbose logging
    -h, --help             Show this help message

Examples:
    # Run with default settings (300 entities)
    $0

    # Check 50 entities with verbose output
    $0 -e 50 -v

    # Quick test with 5 entities
    $0 -e 5 -v

USAGE
}

# Function to run detection system
run_detection() {
    local max_entities=$1
    local output_file=$2
    local verbose=$3
    
    print_info "🎯 Starting Enhanced Perplexity-First Hybrid RFP Detection System v2.0"
    print_info "Entities to check: ${max_entities}"
    print_info "Output file: ${output_file}"
    echo ""
    
    # Build command arguments
    local_args="--max-entities ${max_entities} --output ${output_file}"
    if [ "$verbose" = "true" ]; then
        local_args="${local_args} --verbose"
    fi
    
    # Run Python script
    python3 "${PYTHON_SCRIPT}" ${local_args}
    
    # Capture exit code
    local exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        echo ""
        print_success "RFP detection completed successfully!"
    else
        print_error "RFP detection failed with exit code ${exit_code}"
        exit $exit_code
    fi
}

# Main script execution
main() {
    local max_entities=300
    local output_file=""
    local verbose=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--entities)
                max_entities="$2"
                shift 2
                ;;
            -o|--output)
                output_file="$2"
                shift 2
                ;;
            -v|--verbose)
                verbose=true
                shift
                ;;
            -h|--help)
                show_usage
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    # Generate default output filename with timestamp if not specified
    if [ -z "${output_file}" ]; then
        local timestamp=$(date +"%Y%m%d_%H%M%S")
        output_file="${RESULTS_DIR}/enhanced_results_${timestamp}.json"
    fi
    
    # Create output directory if it doesn't exist
    local output_dir=$(dirname "${output_file}")
    mkdir -p "${output_dir}"
    
    # Run system
    run_detection "${max_entities}" "${output_file}" "${verbose}"
}

# Run main function
main "$@"
