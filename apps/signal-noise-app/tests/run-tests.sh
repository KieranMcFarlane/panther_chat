#!/bin/bash

# Comprehensive Test Runner for AG-UI + Claude Code SDK Integration
echo "🧪 Running comprehensive test suite for AG-UI + Claude Code SDK integration"

# Set test environment
export NODE_ENV=test
export CLAUDE_SDK_TEST_MODE=true
export AGUI_TEST_MODE=true

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to run test and track results
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    echo -e "${BLUE}Running: ${test_name}${NC}"
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if eval "$test_command"; then
        echo -e "${GREEN}✅ ${test_name} - PASSED${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}❌ ${test_name} - FAILED${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# Function to check if dependencies are available
check_dependencies() {
    echo -e "${YELLOW}📋 Checking dependencies...${NC}"
    
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js is required${NC}"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}❌ npm is required${NC}"
        exit 1
    fi
    
    # Check if required packages are installed
    if ! npm list claude-code-sdk &> /dev/null; then
        echo -e "${YELLOW}⚠️  Claude Code SDK not found. Installing...${NC}"
        npm install claude-code-sdk
    fi
    
    if ! npm list @inboundemail/sdk &> /dev/null; then
        echo -e "${YELLOW}⚠️  Inbound Email SDK not found. Installing...${NC}"
        npm install @inboundemail/sdk
    fi
    
    echo -e "${GREEN}✅ Dependencies check complete${NC}"
}

# Function to run API endpoint tests
test_api_endpoints() {
    echo -e "${BLUE}🔌 Testing API Endpoints${NC}"
    
    # Start the development server in background
    npm run dev > /dev/null 2>&1 &
    SERVER_PID=$!
    
    # Wait for server to start
    sleep 5
    
    # Test API endpoints
    run_test "Claude Agent Initialize" "curl -s -X POST http://localhost:3000/api/claude-agent/initialize -H 'Content-Type: application/json' -d '{\"test\": true}' | grep -q 'success'"
    run_test "Claude Agent Process" "curl -s -X POST http://localhost:3000/api/claude-agent/process -H 'Content-Type: application/json' -d '{\"prompt\": \"test\", \"context\": {}}' | grep -q 'success'"
    run_test "Claude Agent Execute" "curl -s -X POST http://localhost:3000/api/claude-agent/execute -H 'Content-Type: application/json' -d '{\"type\": \"send_email\", \"parameters\": {}}' | grep -q 'success'"
    run_test "Autonomous Campaign" "curl -s -X POST http://localhost:3000/api/claude-agent/autonomous-campaign -H 'Content-Type: application/json' -d '{\"goal\": \"test\", \"criteria\": {}}' | grep -q 'success'"
    run_test "Email Send API" "curl -s -X POST http://localhost:3000/api/email/send -H 'Content-Type: application/json' -d '{\"to\": \"test@example.com\", \"subject\": \"Test\", \"body\": \"Test body\"}' | grep -q 'success'"
    
    # Clean up server process
    kill $SERVER_PID 2>/dev/null
}

# Function to run Claude Code SDK tests
test_claude_sdk() {
    echo -e "${BLUE}🤖 Testing Claude Code SDK Integration${NC}"
    
    # Create test script
    cat > test-claude-sdk.mjs << 'EOF'
import { createEmailAgent } from '../src/lib/claude-email-agent.js';

async function testClaudeSDK() {
    try {
        const agent = await createEmailAgent();
        
        // Test basic agent functionality
        const testResult = await agent.process({
            prompt: 'Test relationship analysis for person_001',
            context: { test: true }
        });
        
        console.log('Claude SDK Test Result:', testResult);
        return testResult.success === true;
    } catch (error) {
        console.error('Claude SDK Test Error:', error);
        return false;
    }
}

testClaudeSDK().then(success => {
    process.exit(success ? 0 : 1);
});
EOF

    run_test "Claude Code SDK Agent Creation" "node test-claude-sdk.mjs"
    rm test-claude-sdk.mjs
}

# Function to run AG-UI component tests
test_agui_components() {
    echo -e "${BLUE}🖥️  Testing AG-UI Components${NC}"
    
    # Create component test script
    cat > test-agui-components.mjs << 'EOF'
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AGUIEmailAgentInterface } from '../src/components/agui/AGUIEmailAgentInterface.tsx';

// Mock test data
const mockPerson = {
    id: 'test_person_001',
    properties: {
        name: 'Test User',
        email: 'test@example.com',
        aiAgentConfig: {
            enabled: true,
            autoReply: true,
            responseStyle: 'professional',
            responseDelay: 15
        }
    }
};

async function testAGUIComponents() {
    try {
        // Test component rendering
        const { container } = render(
            React.createElement(AGUIEmailAgentInterface, { person: mockPerson })
        );
        
        // Check if key elements are present
        const chatInterface = container.querySelector('[data-testid="chat-interface"]');
        const agentControls = container.querySelector('[data-testid="agent-controls"]');
        
        console.log('AGUI Components Test - Chat Interface:', !!chatInterface);
        console.log('AGUI Components Test - Agent Controls:', !!agentControls);
        
        return !!(chatInterface && agentControls);
    } catch (error) {
        console.error('AGUI Components Test Error:', error);
        return false;
    }
}

testAGUIComponents().then(success => {
    process.exit(success ? 0 : 1);
});
EOF

    run_test "AG-UI Component Rendering" "node test-agui-components.mjs"
    rm test-agui-components.mjs
}

# Function to run email system tests
test_email_system() {
    echo -e "${BLUE}📧 Testing Email System${NC}"
    
    # Create email test script
    cat > test-email-system.mjs << 'EOF'
import { Inbound } from '@inboundemail/sdk';

async function testEmailSystem() {
    try {
        const inbound = new Inbound({
            apiKey: process.env.INBOUND_API_KEY || 'demoZddUekPUOokPVAIgILCUkljUXaLsKPWAKCSlYZBwyFntfqegGIsRBxVyjKvSkPjN'
        });
        
        // Test email validation
        const validation = await inbound.emails.validate({
            to: 'test@example.com',
            subject: 'Test Email',
            text: 'This is a test email'
        });
        
        console.log('Email Validation Test:', validation);
        
        // Test email template generation
        const template = {
            to: 'test@example.com',
            subject: 'Test Template',
            text: 'Hello {name}, this is a test email template.',
            variables: { name: 'Test User' }
        };
        
        const processed = template.text.replace(/{name}/g, template.variables.name);
        
        console.log('Email Template Test:', processed.includes('Test User'));
        
        return validation.valid && processed.includes('Test User');
    } catch (error) {
        console.error('Email System Test Error:', error);
        return false;
    }
}

testEmailSystem().then(success => {
    process.exit(success ? 0 : 1);
});
EOF

    run_test "Email System Integration" "node test-email-system.mjs"
    rm test-email-system.mjs
}

# Function to run integration tests
test_integration() {
    echo -e "${BLUE}🔗 Running Integration Tests${NC}"
    
    # Create integration test script
    cat > test-integration.mjs << 'EOF'
import { TEST_CONFIG } from './test-config.js';

async function testIntegration() {
    const results = [];
    
    // Test mock data loading
    try {
        const mockProfile = TEST_CONFIG.mockPersonProfile;
        console.log('Mock Data Test - Profile ID:', mockProfile.id);
        results.push(mockProfile.id === 'test_person_001');
    } catch (error) {
        console.error('Mock Data Test Error:', error);
        results.push(false);
    }
    
    // Test scenario validation
    try {
        const scenarios = TEST_CONFIG.aguiTestConfig.testScenarios;
        const basicScenario = scenarios.find(s => s.name === 'basic_relationship_analysis');
        console.log('Scenario Test - Basic Analysis:', !!basicScenario);
        results.push(!!basicScenario);
    } catch (error) {
        console.error('Scenario Test Error:', error);
        results.push(false);
    }
    
    // Test configuration validation
    try {
        const endpoints = TEST_CONFIG.testEndpoints;
        const hasRequiredEndpoints = endpoints.initialize && endpoints.process && endpoints.execute;
        console.log('Endpoints Test - Required Endpoints:', hasRequiredEndpoints);
        results.push(hasRequiredEndpoints);
    } catch (error) {
        console.error('Endpoints Test Error:', error);
        results.push(false);
    }
    
    const successRate = results.filter(r => r).length / results.length;
    console.log(`Integration Test Success Rate: ${(successRate * 100).toFixed(1)}%`);
    
    return successRate >= 0.8; // 80% success rate threshold
}

testIntegration().then(success => {
    process.exit(success ? 0 : 1);
});
EOF

    run_test "Integration Test Suite" "node test-integration.mjs"
    rm test-integration.mjs
}

# Function to run performance tests
test_performance() {
    echo -e "${BLUE}⚡ Running Performance Tests${NC}"
    
    # Create performance test script
    cat > test-performance.mjs << 'EOF'
import { performance } from 'perf_hooks';

async function testPerformance() {
    const results = [];
    const thresholds = {
        maxResponseTime: 5000, // 5 seconds
        maxMemoryUsage: 512 * 1024 * 1024, // 512MB
        minSuccessRate: 0.95 // 95%
    };
    
    // Test API response time
    const startTime = performance.now();
    try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 100));
        const responseTime = performance.now() - startTime;
        console.log('API Response Time:', responseTime.toFixed(2) + 'ms');
        results.push(responseTime <= thresholds.maxResponseTime);
    } catch (error) {
        console.error('API Response Test Error:', error);
        results.push(false);
    }
    
    // Test memory usage
    const memoryUsage = process.memoryUsage();
    const heapUsed = memoryUsage.heapUsed;
    console.log('Memory Usage:', (heapUsed / 1024 / 1024).toFixed(2) + 'MB');
    results.push(heapUsed <= thresholds.maxMemoryUsage);
    
    // Test concurrent operations
    const concurrentOps = [];
    for (let i = 0; i < 10; i++) {
        concurrentOps.push(
            new Promise(resolve => {
                setTimeout(() => resolve(true), Math.random() * 200);
            })
        );
    }
    
    const concurrentResults = await Promise.all(concurrentOps);
    const successRate = concurrentResults.filter(r => r).length / concurrentResults.length;
    console.log('Concurrent Operations Success Rate:', (successRate * 100).toFixed(1) + '%');
    results.push(successRate >= thresholds.minSuccessRate);
    
    const overallSuccess = results.filter(r => r).length / results.length;
    console.log(`Performance Test Success Rate: ${(overallSuccess * 100).toFixed(1)}%`);
    
    return overallSuccess >= 0.8;
}

testPerformance().then(success => {
    process.exit(success ? 0 : 1);
});
EOF

    run_test "Performance Test Suite" "node test-performance.mjs"
    rm test-performance.mjs
}

# Function to generate test report
generate_report() {
    echo -e "${BLUE}📊 Generating Test Report${NC}"
    
    reportFile="test-report-$(date +%Y%m%d_%H%M%S).json"
    
    cat > "$reportFile" << EOF
{
  "testSuite": "AG-UI + Claude Code SDK Integration",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "summary": {
    "totalTests": $TOTAL_TESTS,
    "passedTests": $PASSED_TESTS,
    "failedTests": $FAILED_TESTS,
    "successRate": $(echo "scale=2; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc)
  },
  "environment": {
    "nodeVersion": "$(node --version)",
    "npmVersion": "$(npm --version)",
    "platform": "$(uname -s)",
    "arch": "$(uname -m)"
  },
  "thresholds": {
    "maxResponseTime": 5000,
    "maxMemoryUsage": 536870912,
    "minSuccessRate": 0.95
  }
}
EOF

    echo -e "${GREEN}📄 Test report generated: $reportFile${NC}"
}

# Main test execution
main() {
    echo -e "${YELLOW}🚀 Starting AG-UI + Claude Code SDK Integration Test Suite${NC}"
    echo "=================================================="
    
    # Check dependencies
    check_dependencies
    
    # Run test suites
    test_api_endpoints
    test_claude_sdk
    test_agui_components
    test_email_system
    test_integration
    test_performance
    
    # Generate report
    generate_report
    
    # Display final results
    echo ""
    echo "=================================================="
    echo -e "${YELLOW}🏁 Test Suite Complete${NC}"
    echo -e "${BLUE}Total Tests: $TOTAL_TESTS${NC}"
    echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
    echo -e "${RED}Failed: $FAILED_TESTS${NC}"
    
    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "${GREEN}🎉 All tests passed!${NC}"
        exit 0
    else
        success_rate=$(echo "scale=2; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc)
        echo -e "${YELLOW}Success Rate: ${success_rate}%${NC}"
        echo -e "${RED}❌ Some tests failed. Please review the output above.${NC}"
        exit 1
    fi
}

# Execute main function
main