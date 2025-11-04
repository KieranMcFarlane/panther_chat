#!/bin/bash

# Quick Test Runner for Headless Claude Agent with 10 Entities
# 
# Usage:
#   ./run-headless-test.sh
#   ./run-headless-test.sh --setup
#   ./run-headless-test.sh --check-env

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
SETUP_ENV=false
CHECK_ENV=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --setup)
      SETUP_ENV=true
      shift
      ;;
    --check-env)
      CHECK_ENV=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--setup] [--check-env]"
      exit 1
      ;;
  esac
done

echo -e "${BLUE}🤖 Headless Claude Agent Test Runner${NC}"
echo "===================================="

# Function to check environment
check_environment() {
    echo -e "${BLUE}🔧 Checking environment configuration...${NC}"
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js not found${NC}"
        exit 1
    else
        echo -e "${GREEN}✅ Node.js: $(node --version)${NC}"
    fi
    
    # Check environment file
    if [ ! -f ".env.test" ]; then
        echo -e "${YELLOW}⚠️ .env.test file not found${NC}"
        
        if [ -f ".env.test.template" ]; then
            echo -e "${BLUE}📋 Creating .env.test from template...${NC}"
            cp .env.test.template .env.test
            echo -e "${YELLOW}⚠️ Please edit .env.test with your actual API keys${NC}"
        else
            echo -e "${RED}❌ No environment configuration found${NC}"
            exit 1
        fi
    fi
    
    # Source environment
    set -a
    source .env.test 2>/dev/null || echo -e "${YELLOW}⚠️ Could not source .env.test${NC}"
    set +a
    
    # Check required variables
    echo -e "${BLUE}🔑 Checking API keys...${NC}"
    
    if [ -z "$ANTHROPIC_API_KEY" ] || [ "$ANTHROPIC_API_KEY" = "sk-ant-your-actual-api-key-here" ]; then
        echo -e "${RED}❌ ANTHROPIC_API_KEY not configured${NC}"
        echo "Please edit .env.test and add your actual API key"
        exit 1
    else
        echo -e "${GREEN}✅ ANTHROPIC_API_KEY configured${NC}"
    fi
    
    if [ -z "$NEO4J_URI" ] || [ "$NEO4J_URI" = "neo4j+s://your-instance.databases.neo4j.io" ]; then
        echo -e "${RED}❌ NEO4J_URI not configured${NC}"
        echo "Please edit .env.test and add your Neo4j connection details"
        exit 1
    else
        echo -e "${GREEN}✅ NEO4J_URI configured${NC}"
    fi
    
    echo -e "${GREEN}✅ Environment check complete${NC}"
}

# Function to setup environment
setup_environment() {
    echo -e "${BLUE}🔧 Setting up test environment...${NC}"
    
    # Check if Node.js modules are installed
    if [ ! -d "node_modules" ]; then
        echo -e "${BLUE}📦 Installing Node.js dependencies...${NC}"
        npm install
    fi
    
    # Create environment file if it doesn't exist
    if [ ! -f ".env.test" ]; then
        if [ -f ".env.test.template" ]; then
            cp .env.test.template .env.test
            echo -e "${GREEN}✅ Created .env.test from template${NC}"
            echo -e "${YELLOW}⚠️ Please edit .env.test with your actual credentials${NC}"
        else
            echo -e "${RED}❌ No environment template found${NC}"
            exit 1
        fi
    fi
    
    # Create RUN_LOGS directory
    mkdir -p RUN_LOGS
    echo -e "${GREEN}✅ RUN_LOGS directory created${NC}"
    
    echo -e "${GREEN}✅ Environment setup complete${NC}"
}

# Function to run the test
run_test() {
    echo -e "${BLUE}🚀 Starting Headless Claude Agent Test...${NC}"
    echo ""
    
    # Load environment variables
    set -a
    source .env.test
    set +a
    
    echo -e "${BLUE}📊 Test Configuration:${NC}"
    echo "   Claude API: ${ANTHROPIC_BASE_URL:-'https://api.anthropic.com'}"
    echo "   Neo4j DB: ${NEO4J_URI}"
    echo "   Output: RUN_LOGS/"
    echo ""
    
    # Run the test
    if node test-headless-10-entities.js; then
        echo ""
        echo -e "${GREEN}🎉 Test completed successfully!${NC}"
        
        # Find the latest report
        latest_report=$(ls -t RUN_LOGS/HEADLESS_TEST_10_ENTITIES_*.md 2>/dev/null | head -1)
        
        if [ -n "$latest_report" ]; then
            echo -e "${GREEN}📁 Report generated: $latest_report${NC}"
            echo ""
            echo -e "${BLUE}📄 Report Preview:${NC}"
            echo "===================="
            head -20 "$latest_report"
            echo "===================="
            echo ""
            echo -e "${BLUE}💡 To view the full report:${NC}"
            echo "   cat $latest_report"
            echo ""
            echo -e "${BLUE}💡 To open in your default editor:${NC}"
            echo "   open $latest_report"
        fi
        
    else
        echo -e "${RED}❌ Test failed${NC}"
        echo "Please check the error messages above and your configuration"
        exit 1
    fi
}

# Main execution
main() {
    if [ "$CHECK_ENV" = true ]; then
        check_environment
    elif [ "$SETUP_ENV" = true ]; then
        setup_environment
    else
        # Run full check first
        check_environment
        echo ""
        run_test
    fi
}

# Handle interruption gracefully
trap 'echo -e "\n${YELLOW}⚠️ Test interrupted by user${NC}"; exit 130' INT

# Run main function
main

echo ""
echo "===================================="
echo -e "${GREEN}✅ Headless Claude Agent Test Complete!${NC}"