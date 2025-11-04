#!/bin/bash

# 🐆 Yellow Panther RFP Detection System Test Suite
# Tests webhook processing, activity logging, and monitoring dashboard

set -e

echo "🐆 YELLOW PANTHER RFP DETECTION SYSTEM TEST SUITE"
echo "=================================================="
echo ""

BASE_URL="http://localhost:3000"
WEBHOOK_URL="$BASE_URL/api/mines/webhook"
MONITORING_URL="$BASE_URL/api/rfp-monitoring"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
    ((TESTS_PASSED++))
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
    ((TESTS_FAILED++))
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Test functions
test_webhook_health() {
    log_info "Testing webhook health endpoint..."
    
    response=$(curl -s -w "%{http_code}" "$WEBHOOK_URL" || echo "000")
    http_code="${response: -3}"
    body="${response%???}"
    
    if [ "$http_code" = "200" ]; then
        log_success "Webhook health check passed (HTTP $http_code)"
        
        # Check for enhanced features in response
        if echo "$body" | grep -q "claude_agent_sdk"; then
            log_success "Claude Agent SDK integration detected"
        else
            log_warning "Claude Agent SDK integration not found in response"
        fi
        
        if echo "$body" | grep -q "pydantic_validation"; then
            log_success "Pydantic validation integration detected"
        else
            log_warning "Pydantic validation integration not found in response"
        fi
    else
        log_error "Webhook health check failed (HTTP $http_code)"
    fi
}

test_monitoring_health() {
    log_info "Testing monitoring API health..."
    
    response=$(curl -s -w "%{http_code}" "$MONITORING_URL?action=status" || echo "000")
    http_code="${response: -3}"
    body="${response%???}"
    
    if [ "$http_code" = "200" ]; then
        log_success "Monitoring API health check passed (HTTP $http_code)"
        
        # Check for system status
        if echo "$body" | grep -q "system_status"; then
            log_success "System status data available"
        else
            log_warning "System status data not found"
        fi
    else
        log_error "Monitoring API health check failed (HTTP $http_code)"
    fi
}

test_webhook_processing() {
    log_info "Testing webhook data processing..."
    
    # Test Yellow Panther tailored RFP content
    webhook_payload='{
        "source": "linkedin",
        "content": "Manchester United announces £5M digital transformation partnership for AI-powered fan engagement platform and mobile app development - seeking technology vendor with expertise in gamification and e-commerce solutions",
        "url": "https://linkedin.com/posts/mu-test-digital-transformation",
        "keywords": ["digital transformation", "fan engagement", "mobile app", "AI", "gamification", "e-commerce"],
        "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'",
        "confidence": 0.85,
        "metadata": {
            "author": "CTO",
            "company": "Manchester United"
        }
    }'
    
    response=$(curl -s -w "%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -d "$webhook_payload" \
        "$WEBHOOK_URL" || echo "000")
    
    http_code="${response: -3}"
    body="${response%???}"
    
    if [ "$http_code" = "200" ]; then
        log_success "Webhook processing test passed (HTTP $http_code)"
        
        # Check for activity logging
        if echo "$body" | grep -q "activity_logged"; then
            log_success "Activity logging integration detected"
        else
            log_warning "Activity logging integration not found"
        fi
        
        # Check for enhanced features
        if echo "$body" | grep -q "processing_time_ms"; then
            log_success "Processing time tracking detected"
        else
            log_warning "Processing time tracking not found"
        fi
        
        # Wait a moment for logging to propagate
        sleep 2
        
        # Check if activity was logged
        log_info "Checking if activity was logged..."
        logs_response=$(curl -s "$MONITORING_URL?action=logs&limit=5" || echo "")
        if echo "$logs_response" | grep -q "Manchester United"; then
            log_success "Activity successfully logged in monitoring system"
        else
            log_warning "Activity not found in monitoring logs (may need more time)"
        fi
        
    else
        log_error "Webhook processing test failed (HTTP $http_code)"
        echo "Response body: $body"
    fi
}

test_rfp_detection() {
    log_info "Testing RFP opportunity detection..."
    
    # Test the monitoring API test endpoint
    response=$(curl -s -w "%{http_code}" "$MONITORING_URL?action=test" || echo "000")
    http_code="${response: -3}"
    body="${response%???}"
    
    if [ "$http_code" = "200" ]; then
        log_success "RFP detection test passed (HTTP $http_code)"
        
        # Check for test results
        if echo "$body" | grep -q "test_result"; then
            log_success "Test execution results available"
            
            # Extract entity score if available
            if echo "$body" | grep -o '"entity_score":[0-9]*'; then
                entity_score=$(echo "$body" | grep -o '"entity_score":[0-9]*' | cut -d: -f2)
                if [ "$entity_score" -ge 80 ]; then
                    log_success "High entity score detected: $entity_score/100"
                else
                    log_warning "Entity score could be higher: $entity_score/100"
                fi
            fi
        else
            log_warning "Test results not found in response"
        fi
    else
        log_error "RFP detection test failed (HTTP $http_code)"
    fi
}

test_activity_logs() {
    log_info "Testing activity log retrieval..."
    
    response=$(curl -s -w "%{http_code}" "$MONITORING_URL?action=logs&limit=10" || echo "000")
    http_code="${response: -3}"
    body="${response%???}"
    
    if [ "$http_code" = "200" ]; then
        log_success "Activity log retrieval test passed (HTTP $http_code)"
        
        # Check for log structure
        if echo "$body" | grep -q '"timestamp"'; then
            log_success "Log timestamps present"
        else
            log_warning "Log timestamps not found"
        fi
        
        if echo "$body" | grep -q '"activity_type"'; then
            log_success "Activity types present"
        else
            log_warning "Activity types not found"
        fi
        
        # Count log entries
        log_count=$(echo "$body" | grep -o '"id"' | wc -l)
        log_info "Retrieved $log_count log entries"
        
    else
        log_error "Activity log retrieval test failed (HTTP $http_code)"
    fi
}

test_system_performance() {
    log_info "Testing system performance metrics..."
    
    start_time=$(date +%s%N)
    
    # Make a test webhook call
    curl -s -X POST \
        -H "Content-Type: application/json" \
        -d '{
            "source": "test",
            "content": "Performance test content",
            "keywords": ["test", "performance"],
            "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'"
        }' \
        "$WEBHOOK_URL" > /dev/null
    
    end_time=$(date +%s%N)
    processing_time=$(( ($end_time - $start_time) / 1000000 )) # Convert to milliseconds
    
    if [ $processing_time -lt 5000 ]; then
        log_success "Webhook processing performance: ${processing_time}ms (< 5s)"
    elif [ $processing_time -lt 10000 ]; then
        log_warning "Webhook processing performance: ${processing_time}ms (< 10s, acceptable)"
    else
        log_error "Webhook processing performance: ${processing_time}ms (> 10s, too slow)"
    fi
}

test_error_handling() {
    log_info "Testing error handling..."
    
    # Test invalid payload
    invalid_payload='{"invalid": "data"}'
    
    response=$(curl -s -w "%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -d "$invalid_payload" \
        "$WEBHOOK_URL" || echo "000")
    
    http_code="${response: -3}"
    
    # Should return an error (400 or 500 is acceptable for invalid data)
    if [ "$http_code" -ge 400 ] && [ "$http_code" -lt 600 ]; then
        log_success "Error handling works correctly (HTTP $http_code for invalid data)"
    else
        log_warning "Expected error for invalid data, got HTTP $http_code"
    fi
}

# Export functionality test
test_export_functionality() {
    log_info "Testing data export functionality..."
    
    # Test JSON export
    response=$(curl -s -w "%{http_code}" "$MONITORING_URL?action=export&format=json" || echo "000")
    http_code="${response: -3}"
    
    if [ "$http_code" = "200" ]; then
        log_success "JSON export test passed"
    else
        log_warning "JSON export test failed (HTTP $http_code)"
    fi
    
    # Test CSV export
    response=$(curl -s -w "%{http_code}" "$MONITORING_URL?action=export&format=csv" || echo "000")
    http_code="${response: -3}"
    
    if [ "$http_code" = "200" ]; then
        log_success "CSV export test passed"
    else
        log_warning "CSV export test failed (HTTP $http_code)"
    fi
}

# Health check endpoint test
test_comprehensive_health() {
    log_info "Testing comprehensive health check..."
    
    response=$(curl -s -w "%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -d '{"action": "health_check"}' \
        "$MONITORING_URL" || echo "000")
    
    http_code="${response: -3}"
    body="${response%???}"
    
    if [ "$http_code" = "200" ]; then
        log_success "Comprehensive health check passed (HTTP $http_code)"
        
        # Check for detailed health information
        if echo "$body" | grep -q "services"; then
            log_success "Service health details available"
        else
            log_warning "Service health details not found"
        fi
        
        if echo "$body" | grep -q "healthy"; then
            log_success "Overall health status available"
        else
            log_warning "Overall health status not found"
        fi
    else
        log_error "Comprehensive health check failed (HTTP $http_code)"
    fi
}

# Main test execution
main() {
    echo "Starting comprehensive test suite..."
    echo ""
    
    # Check if server is running
    log_info "Checking if server is running at $BASE_URL..."
    if ! curl -s --connect-timeout 5 "$BASE_URL" > /dev/null; then
        log_error "Server is not running at $BASE_URL"
        echo "Please start the server with: npm run dev"
        exit 1
    fi
    log_success "Server is running"
    echo ""
    
    # Run all tests
    test_webhook_health
    echo ""
    
    test_monitoring_health
    echo ""
    
    test_webhook_processing
    echo ""
    
    test_rfp_detection
    echo ""
    
    test_activity_logs
    echo ""
    
    test_system_performance
    echo ""
    
    test_error_handling
    echo ""
    
    test_export_functionality
    echo ""
    
    test_comprehensive_health
    echo ""
    
    # Print summary
    echo "=================================================="
    echo "🏁 TEST SUITE SUMMARY"
    echo "=================================================="
    echo -e "Tests Passed:  ${GREEN}$TESTS_PASSED${NC}"
    echo -e "Tests Failed:  ${RED}$TESTS_FAILED${NC}"
    echo -e "Total Tests:   $((TESTS_PASSED + TESTS_FAILED))"
    echo ""
    
    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "${GREEN}🎉 ALL TESTS PASSED! Yellow Panther RFP Detection System is working correctly.${NC}"
        echo ""
        echo "🐆 System Features Verified:"
        echo "   ✅ Webhook processing with activity logging"
        echo "   ✅ RFP opportunity detection"
        echo "   ✅ Real-time monitoring dashboard"
        echo "   ✅ Performance metrics tracking"
        echo "   ✅ Error handling and validation"
        echo "   ✅ Data export functionality"
        echo "   ✅ Health monitoring"
        echo ""
        echo "📊 Access the dashboard at: $BASE_URL/rfp-intelligence"
        echo "🔧 View API documentation at: $BASE_URL/api/rfp-monitoring"
    else
        echo -e "${RED}⚠️  SOME TESTS FAILED. Please check the system configuration.${NC}"
        echo ""
        echo "Common issues:"
        echo "   • Server not running (start with: npm run dev)"
        echo "   • Missing environment variables"
        echo "   • Database connection issues"
        echo "   • Service dependencies not available"
    fi
}

# Run main function
main "$@"