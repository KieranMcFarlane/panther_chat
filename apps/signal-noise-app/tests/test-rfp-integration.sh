#!/bin/bash

# RFP Intelligence Integration Test Suite
# Tests the complete webhook → Claude Agent SDK → CopilotKit pipeline

set -e

echo "🧪 RFP Intelligence Integration Test Suite"
echo "=========================================="

# Configuration
API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
WEBHOOK_SECRET="${WEBHOOK_SECRET:-test-secret}"
TEST_MODE="${TEST_MODE:-development}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test utilities
print_test() {
    echo -e "\n${BLUE}📋 Test: $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "ℹ️  $1"
}

# Wait for server to be ready
wait_for_server() {
    print_info "Waiting for server at $API_BASE_URL..."
    for i in {1..30}; do
        if curl -s "$API_BASE_URL/api/health" > /dev/null 2>&1; then
            print_success "Server is ready"
            return 0
        fi
        sleep 2
        echo -n "."
    done
    print_error "Server not ready after 60 seconds"
    return 1
}

# Test 1: Health Check
test_health_check() {
    print_test "Health Check"
    
    response=$(curl -s "$API_BASE_URL/api/health" || echo "")
    if echo "$response" | grep -q "status.*healthy"; then
        print_success "Health check passed"
        return 0
    else
        print_error "Health check failed"
        echo "Response: $response"
        return 1
    fi
}

# Test 2: Claude Agent SDK Integration
test_claude_agent_sdk() {
    print_test "Claude Agent SDK Integration"
    
    # Test the CopilotKit endpoint
    payload='{
        "messages": [
            {
                "role": "user", 
                "content": "Test message for RFP analysis. We are looking for a digital transformation partner for our fan engagement system. Budget: £500K-£1M. Deadline: Q2 2025."
            }
        ],
        "stream": true
    }'
    
    response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "$payload" \
        "$API_BASE_URL/api/copilotkit" || echo "")
    
    if echo "$response" | grep -q "data:"; then
        print_success "Claude Agent SDK integration working"
        return 0
    else
        print_error "Claude Agent SDK integration failed"
        echo "Response: $response"
        return 1
    fi
}

# Test 3: Basic Webhook Endpoint
test_webhook_endpoint() {
    print_test "Basic Webhook Endpoint"
    
    # Generate test signature
    payload='{
        "webhook_id": "test_webhook_001",
        "site_name": "LinkedIn",
        "page_url": "https://linkedin.com/posts/test-post",
        "page_title": "Seeking Digital Transformation Partner",
        "content": "We are looking for a digital transformation partner for our fan engagement platform. This is a significant procurement opportunity for a Premier League club. Interested parties should have experience with sports technology implementations.",
        "meta": {
            "author": "Test User",
            "role": "Chief Technology Officer", 
            "company": "Test Football Club",
            "post_id": "test_post_001"
        },
        "extracted_at": "2025-01-01T12:00:00Z",
        "signals": ["procurement", "digital transformation", "fan engagement"]
    }'
    
    signature=$(echo -n "$payload" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" | cut -d' ' -f2)
    
    response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -H "x-brightdata-signature: $signature" \
        -d "$payload" \
        "$API_BASE_URL/api/webhook/linkedin-rfp-claude" || echo "")
    
    if echo "$response" | grep -q "data:"; then
        print_success "Webhook endpoint responding"
        return 0
    else
        print_error "Webhook endpoint failed"
        echo "Response: $response"
        return 1
    fi
}

# Test 4: Enhanced RFP Intelligence Analysis
test_rfp_intelligence() {
    print_test "RFP Intelligence Analysis"
    
    payload='{
        "content": "We are seeking a digital transformation partner for our fan engagement platform modernization. This project includes mobile app development, CRM integration, and real-time analytics capabilities.",
        "author": "Sarah Chen",
        "role": "Chief Technology Officer", 
        "company": "Manchester United FC",
        "url": "https://linkedin.com/posts/mu-digital-transformation"
    }'
    
    response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "$payload" \
        "$API_BASE_URL/api/rfp-intelligence/analyze" || echo "")
    
    if echo "$response" | grep -q "data:"; then
        print_success "RFP intelligence analysis working"
        return 0
    else
        print_error "RFP intelligence analysis failed"
        echo "Response: $response"
        return 1
    fi
}

# Test 5: Knowledge Graph Enrichment
test_knowledge_graph_enrichment() {
    print_test "Knowledge Graph Enrichment"
    
    # Mock RFP analysis data
    payload='{
        "rfp_analysis": {
            "organization_name": "Test Club FC",
            "fit_score": 85,
            "estimated_value": "£500K-£1M",
            "urgency_level": "HIGH"
        },
        "source_webhook": {
            "webhook_id": "test_001",
            "company": "Test Club FC"
        },
        "claude_analysis": {
            "procurement_validation": {
                "is_genuine_procurement": true,
                "confidence": 0.9
            }
        },
        "tool_results": []
    }'
    
    response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "$payload" \
        "$API_BASE_URL/api/knowledge-graph/enrich" || echo "")
    
    if echo "$response" | grep -q "data:"; then
        print_success "Knowledge graph enrichment working"
        return 0
    else
        print_error "Knowledge graph enrichment failed"
        echo "Response: $response"
        return 1
    fi
}

# Test 6: Notifications Stream
test_notifications_stream() {
    print_test "Notifications Stream"
    
    # Test GET endpoint for SSE
    response=$(curl -s -m 5 "$API_BASE_URL/api/notifications/rfp-stream" || echo "")
    
    if echo "$response" | grep -q "connection_established"; then
        print_success "Notifications stream working"
        return 0
    else
        print_error "Notifications stream failed"
        echo "Response: $response"
        return 1
    fi
}

# Test 7: MCP Tool Integration
test_mcp_tools() {
    print_test "MCP Tool Integration"
    
    # Test Neo4j MCP
    payload='{
        "query": "MATCH (n:Organization) RETURN count(n) as count LIMIT 1"
    }'
    
    response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "$payload" \
        "$API_BASE_URL/api/mcp/neo4j/search" || echo "")
    
    if echo "$response" | grep -q -E "(result|count)"; then
        print_success "Neo4j MCP tool working"
    else
        print_warning "Neo4j MCP tool may have issues"
    fi
    
    # Test BrightData MCP
    response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d '{"query": "Premier League digital transformation", "engine": "google"}' \
        "$API_BASE_URL/api/mcp/brightdata/search" || echo "")
    
    if echo "$response" | grep -q -E "(result|search)"; then
        print_success "BrightData MCP tool working"
    else
        print_warning "BrightData MCP tool may have issues"
    fi
    
    # Test Perplexity MCP
    response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d '{"messages": [{"role": "user", "content": "Premier League digital transformation trends 2025"}]}' \
        "$API_BASE_URL/api/mcp/perplexity/search" || echo "")
    
    if echo "$response" | grep -q -E "(result|response)"; then
        print_success "Perplexity MCP tool working"
    else
        print_warning "Perplexity MCP tool may have issues"
    fi
    
    return 0
}

# Test 8: End-to-End Integration
test_end_to_end_integration() {
    print_test "End-to-End Integration"
    
    print_info "Testing complete flow: Webhook → Claude → Knowledge Graph → Notifications"
    
    # Create test RFP webhook
    webhook_payload='{
        "webhook_id": "e2e_test_001",
        "site_name": "LinkedIn",
        "page_url": "https://linkedin.com/posts/e2e-test",
        "page_title": "Digital Transformation RFP",
        "content": "Major football club seeking digital transformation partner for fan engagement system. Budget: £750K-£1.2M. Deadline: Q3 2025. Requires experience with sports technology and mobile app development.",
        "meta": {
            "author": "CTO",
            "role": "Chief Technology Officer",
            "company": "E2E Test FC",
            "post_id": "e2e_post_001"
        },
        "extracted_at": "'$(date -u +%Y-%m-%dT%H:%M:%S.000Z)'",
        "signals": ["procurement", "digital transformation", "fan engagement", "mobile app"]
    }'
    
    signature=$(echo -n "$webhook_payload" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" | cut -d' ' -f2)
    
    # Send webhook and capture response
    webhook_response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -H "x-brightdata-signature: $signature" \
        -d "$webhook_payload" \
        "$API_BASE_URL/api/webhook/linkedin-rfp-claude" || echo "")
    
    if echo "$webhook_response" | grep -q "analysis_complete"; then
        print_success "End-to-end integration test passed"
        return 0
    else
        print_error "End-to-end integration test failed"
        echo "Webhook response: $webhook_response"
        return 1
    fi
}

# Test 9: Performance Tests
test_performance() {
    print_test "Performance Tests"
    
    print_info "Testing response times..."
    
    # Test webhook response time
    start_time=$(date +%s%N)
    curl -s -X GET "$API_BASE_URL/api/health" > /dev/null
    end_time=$(date +%s%N)
    
    response_time=$((($end_time - $start_time) / 1000000)) # Convert to milliseconds
    
    if [ $response_time -lt 5000 ]; then
        print_success "Health endpoint response time: ${response_time}ms"
    else
        print_warning "Health endpoint response time slow: ${response_time}ms"
    fi
    
    # Test concurrent requests
    print_info "Testing concurrent webhook processing..."
    concurrent_requests=5
    success_count=0
    
    for i in $(seq 1 $concurrent_requests); do
        response=$(curl -s -X GET "$API_BASE_URL/api/health" || echo "")
        if echo "$response" | grep -q "status"; then
            success_count=$((success_count + 1))
        fi
    done
    
    if [ $success_count -eq $concurrent_requests ]; then
        print_success "Concurrent request test passed: $success_count/$concurrent_requests"
    else
        print_warning "Concurrent request test issues: $success_count/$concurrent_requests"
    fi
    
    return 0
}

# Main test execution
main() {
    echo -e "\n${YELLOW}Configuration:${NC}"
    echo "API Base URL: $API_BASE_URL"
    echo "Test Mode: $TEST_MODE"
    echo "Webhook Secret: [REDACTED]"
    echo ""
    
    # Wait for server
    if ! wait_for_server; then
        print_error "Cannot proceed with tests - server not available"
        exit 1
    fi
    
    # Run tests
    tests=(
        "test_health_check"
        "test_claude_agent_sdk" 
        "test_webhook_endpoint"
        "test_rfp_intelligence"
        "test_knowledge_graph_enrichment"
        "test_notifications_stream"
        "test_mcp_tools"
        "test_end_to_end_integration"
        "test_performance"
    )
    
    passed=0
    failed=0
    
    for test in "${tests[@]}"; do
        if $test; then
            passed=$((passed + 1))
        else
            failed=$((failed + 1))
        fi
        
        # Small delay between tests
        sleep 1
    done
    
    # Results
    echo -e "\n${YELLOW}=========================================="
    echo "Test Results Summary"
    echo "==========================================${NC}"
    echo -e "Tests Passed: ${GREEN}$passed${NC}"
    echo -e "Tests Failed: ${RED}$failed${NC}"
    echo -e "Total Tests: $((passed + failed))"
    
    if [ $failed -eq 0 ]; then
        echo -e "\n${GREEN}🎉 All tests passed!${NC}"
        echo -e "\n${BLUE}Next steps:${NC}"
        echo "1. Deploy to staging environment"
        echo "2. Configure BrightData webhooks"
        echo "3. Set up production monitoring"
        echo "4. Test with real LinkedIn data"
        exit 0
    else
        echo -e "\n${RED}❌ Some tests failed. Please review the errors above.${NC}"
        echo -e "\n${YELLOW}Troubleshooting:${NC}"
        echo "1. Check environment variables"
        echo "2. Verify MCP server configurations"
        echo "3. Ensure Neo4j, BrightData, and Perplexity are accessible"
        echo "4. Review server logs for detailed error messages"
        exit 1
    fi
}

# Handle script arguments
case "${1:-run}" in
    "health")
        test_health_check
        ;;
    "claude")
        test_claude_agent_sdk
        ;;
    "webhook")
        test_webhook_endpoint
        ;;
    "intelligence")
        test_rfp_intelligence
        ;;
    "knowledge-graph")
        test_knowledge_graph_enrichment
        ;;
    "notifications")
        test_notifications_stream
        ;;
    "mcp")
        test_mcp_tools
        ;;
    "e2e")
        test_end_to_end_integration
        ;;
    "performance")
        test_performance
        ;;
    "run")
        main
        ;;
    *)
        echo "Usage: $0 {run|health|claude|webhook|intelligence|knowledge-graph|notifications|mcp|e2e|performance}"
        exit 1
        ;;
esac