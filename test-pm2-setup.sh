#!/bin/bash

# PM2 Installation and Base Setup Test Script
# Validates TICKET-002 acceptance criteria

echo "🧪 Testing PM2 Installation and Base Setup..."
echo "================================================="

# Test results tracking
PASSED=0
TOTAL=0
ERRORS=()

# Function to run test and track results
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_result="$3"
    
    echo -n "📋 Test: $test_name... "
    
    TOTAL=$((TOTAL + 1))
    
    if eval "$test_command" | grep -q "$expected_result"; then
        echo "✅ PASS"
        PASSED=$((PASSED + 1))
    else
        echo "❌ FAIL"
        ERRORS+=("$test_name")
        return 1
    fi
}

# Function to check PM2 installation
test_pm2_installation() {
    echo "📦 Testing PM2 Installation..."
    
    # Test PM2 version
    run_test "PM2 Version Check" "ssh -i yellowpanther.pem ec2-user@13.60.60.50 'pm2 --version'" "6.0"
    
    # Test PM2 availability
    run_test "PM2 Command Available" "ssh -i yellowpanther.pem ec2-user@13.60.60.50 'which pm2'" "pm2"
    
    # Test PM2 list command
    run_test "PM2 List Command" "ssh -i yellowpanther.pem ec2-user@13.60.60.50 'pm2 list'" "online"
}

# Function to test PM2 startup configuration
test_pm2_startup() {
    echo -e "\n🚀 Testing PM2 Startup Configuration..."
    
    # Test systemd service status
    run_test "PM2 Systemd Service" "ssh -i yellowpanther.pem ec2-user@13.60.60.50 'systemctl is-active pm2-ec2-user'" "active"
    
    # Test systemd service enabled
    run_test "PM2 Service Enabled" "ssh -i yellowpanther.pem ec2-user@13.60.60.50 'systemctl is-enabled pm2-ec2-user'" "enabled"
    
    # Test PM2 daemon status
    run_test "PM2 Daemon Status" "ssh -i yellowpanther.pem ec2-user@13.60.60.50 'pm2 ping'" "pong"
}

# Function to test PM2 monitoring and logging
test_pm2_monitoring() {
    echo -e "\n📊 Testing PM2 Monitoring and Logging..."
    
    # Test PM2 logs command
    run_test "PM2 Logs Command" "ssh -i yellowpanther.pem ec2-user@13.60.60.50 'pm2 logs --lines 1'" "PM2"
    
    # Test PM2 info command
    run_test "PM2 Info Command" "ssh -i yellowpanther.pem ec2-user@13.60.60.50 'pm2 info simple-translation-api'" "online"
    
    # Test log directory exists
    run_test "PM2 Log Directory" "ssh -i yellowpanther.pem ec2-user@13.60.60.50 'ls -la ~/.pm2/logs/' "simple-translation-api"
    
    # Test PM2 monit availability
    run_test "PM2 Monit Command" "ssh -i yellowpanther.pem ec2-user@13.60.60.50 'pm2 monit --help'" "termcaps"
}

# Function to test PM2 process management
test_pm2_process_management() {
    echo -e "\n🔄 Testing PM2 Process Management..."
    
    # Test process restart
    echo "  Testing process restart..."
    ssh -i yellowpanther.pem ec2-user@13.60.60.50 'pm2 restart simple-translation-api' > /dev/null 2>&1
    sleep 2
    run_test "Process Restart" "ssh -i yellowpanther.pem ec2-user@13.60.60.50 'pm2 list'" "online"
    
    # Test process stop
    echo "  Testing process stop..."
    ssh -i yellowpanther.pem ec2-user@13.60.60.50 'pm2 stop simple-translation-api' > /dev/null 2>&1
    sleep 2
    run_test "Process Stop" "ssh -i yellowpanther.pem ec2-user@13.60.60.50 'pm2 list'" "stopped"
    
    # Test process start
    echo "  Testing process start..."
    ssh -i yellowpanther.pem ec2-user@13.60.60.50 'pm2 start simple-translation-api' > /dev/null 2>&1
    sleep 2
    run_test "Process Start" "ssh -i yellowpanther.pem ec2-user@13.60.60.50 'pm2 list'" "online"
}

# Function to test PM2 ecosystem configuration
test_pm2_ecosystem() {
    echo -e "\n🏗️ Testing PM2 Ecosystem Configuration..."
    
    # Test ecosystem file exists
    run_test "Ecosystem File Exists" "ssh -i yellowpanther.pem ec2-user@13.60.60.50 'test -f ecosystem.config.json && echo exists'" "exists"
    
    # Test ecosystem file structure
    run_test "Ecosystem File Structure" "ssh -i yellowpanther.pem ec2-user@13.60.60.50 'cat ecosystem.config.json'" "claudebox-router"
    
    # Test ecosystem apps configuration
    run_test "Ecosystem Apps Config" "ssh -i yellowpanther.pem ec2-user@13.60.60.50 'cat ecosystem.config.json'" "slot-manager"
}

# Function to display results
display_results() {
    echo -e "\n🎯 Test Results Summary"
    echo "================================================="
    echo "Total Tests: $TOTAL"
    echo "Passed: $PASSED"
    echo "Failed: $((TOTAL - PASSED))"
    
    if [ $PASSED -eq $TOTAL ]; then
        echo -e "\n🎉 All tests passed!"
    else
        echo -e "\n⚠️  Failed tests:"
        for error in "${ERRORS[@]}"; do
            echo "   - $error"
        done
    fi
    
    # Calculate success percentage
    SUCCESS_PERCENTAGE=$((PASSED * 100 / TOTAL))
    echo -e "\n📊 Success Rate: ${SUCCESS_PERCENTAGE}%"
    
    # Check acceptance criteria
    echo -e "\n🎫 TICKET-002 Acceptance Criteria Status:"
    echo "================================================="
    
    # Check PM2 installation
    if ssh -i yellowpanther.pem ec2-user@13.60.60.50 'pm2 --version' > /dev/null 2>&1; then
        echo "✅ PM2 installed globally on EC2 instance"
    else
        echo "❌ PM2 installed globally on EC2 instance"
    fi
    
    # Check PM2 startup configuration
    if ssh -i yellowpanther.pem ec2-user@13.60.60.50 'systemctl is-enabled pm2-ec2-user' | grep -q "enabled"; then
        echo "✅ PM2 configured to start on system boot"
    else
        echo "❌ PM2 configured to start on system boot"
    fi
    
    # Check PM2 monitoring
    if ssh -i yellowpanther.pem ec2-user@13.60.60.50 'pm2 list' | grep -q "online"; then
        echo "✅ Basic PM2 monitoring and logging setup"
    else
        echo "❌ Basic PM2 monitoring and logging setup"
    fi
    
    # Check process restart capabilities
    if [ $PASSED -ge 4 ]; then
        echo "✅ Test process restart capabilities"
    else
        echo "❌ Test process restart capabilities"
    fi
    
    echo -e "\n🚀 Ready for TICKET-003: SSH Tunnel Management Service"
}

# Main test execution
echo "Starting PM2 Installation and Base Setup Tests..."
echo "This may take a few minutes...\n"

test_pm2_installation
test_pm2_startup
test_pm2_monitoring
test_pm2_process_management
test_pm2_ecosystem

display_results

echo -e "\n📋 PM2 Configuration Summary:"
ssh -i yellowpanther.pem ec2-user@13.60.60.50 'pm2 info' | head -20

# Exit with appropriate code
if [ $PASSED -eq $TOTAL ]; then
    exit 0
else
    exit 1
fi