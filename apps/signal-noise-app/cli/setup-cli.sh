#!/bin/bash

# Quick Setup Script for RFP Intelligence CLI
# 
# Usage:
#   ./setup-cli.sh
#   ./setup-cli.sh --test
#   ./setup-cli.sh --glm

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
USE_GLM=false
TEST_CONNECTION=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --glm)
      USE_GLM=true
      shift
      ;;
    --test)
      TEST_CONNECTION=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

echo -e "${BLUE}🚀 RFP Intelligence CLI Setup${NC}"
echo "=================================="

# Check if .env exists
if [ ! -f "cli/.env" ]; then
  echo -e "${YELLOW}📋 Creating .env file from template...${NC}"
  cp cli/.env.template cli/.env
  echo -e "${YELLOW}⚠️  Please edit cli/.env with your actual API keys${NC}"
else
  echo -e "${GREEN}✅ .env file already exists${NC}"
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo -e "${BLUE}📦 Installing dependencies...${NC}"
  npm install
fi

# Create logs directory
mkdir -p cli/logs

# Test configuration
echo -e "${BLUE}🧪 Testing configuration...${NC}"

# Source environment variables
set -a
source cli/.env 2>/dev/null || echo -e "${YELLOW}⚠️  Could not source .env file${NC}"
set +a

# Check required API keys
if [ -z "$ANTHROPIC_API_KEY" ] || [ "$ANTHROPIC_API_KEY" = "sk-ant-your-actual-key-here" ]; then
  echo -e "${RED}❌ ANTHROPIC_API_KEY not configured in cli/.env${NC}"
  echo "Please edit cli/.env and add your API key"
  exit 1
fi

echo -e "${GREEN}✅ API key configured${NC}"

# Test connection if requested
if [ "$TEST_CONNECTION" = true ]; then
  echo -e "${BLUE}🧪 Testing API connection...${NC}"
  
  if [ "$USE_GLM" = true ]; then
    node cli/run-blueprint.ts --test-connection --model glm-4-6
  else
    node cli/run-blueprint.ts --test-connection
  fi
else
  echo -e "${BLUE}💡 Run with --test to verify API connection${NC}"
fi

# Cron setup instructions
echo -e "${BLUE}⏰ Cron Setup Instructions:${NC}"
echo "Add to your crontab with: crontab -e"
echo ""
if [ "$USE_GLM" = true ]; then
  echo "# RFP Intelligence with GLM 4.6 (every 6 hours)"
  echo "0 */6 * * * cd $(pwd) && /usr/bin/node cli/run-blueprint.ts --model glm-4-6 >> cli/logs/cron.log 2>&1"
else
  echo "# RFP Intelligence with Claude (every 6 hours)"
  echo "0 */6 * * * cd $(pwd) && /usr/bin/node cli/run-blueprint.ts >> cli/logs/cron.log 2>&1"
fi

echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo "Usage examples:"
echo "  node cli/run-blueprint.ts                    # Run with Claude"
echo "  node cli/run-blueprint.ts --model glm-4-6    # Run with GLM 4.6"
echo "  node cli/run-blueprint.ts --test-connection  # Test API connection"
echo ""
echo -e "${BLUE}📁 Logs will be saved to RUN_LOGS/${NC}"