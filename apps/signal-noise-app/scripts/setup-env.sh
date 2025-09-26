#!/bin/bash

# Environment Setup Script for Signal Noise App AWS Deployment
# This script helps you configure environment variables

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}⚙️  Signal Noise App - Environment Setup${NC}"
echo -e "${BLUE}========================================${NC}"

# Check if .env file exists
if [ -f ".env" ]; then
    echo -e "${YELLOW}⚠️  .env file already exists. Do you want to overwrite it? (y/N)${NC}"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Keeping existing .env file${NC}"
        exit 0
    fi
fi

echo -e "${YELLOW}🔧 Setting up environment variables...${NC}"

# Create .env file
cat > .env << 'EOF'
# Neo4j AuraDB Configuration
NEO4J_URI=neo4j+s://your-aura-instance.databases.neo4j.io
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-aura-password

# Redis Configuration
REDIS_PASSWORD=your-redis-password
REDIS_URL=redis://:your-redis-password@localhost:6379/0

# API Keys
CLAUDE_API_KEY=your-claude-api-key
PERPLEXITY_API_KEY=your-perplexity-api-key
BRIGHTDATA_API_KEY=your-brightdata-api-key

# Environment
ENVIRONMENT=production

# Application Settings
LOG_LEVEL=INFO
WORKER_CONCURRENCY=2
MAX_WORKERS=4

# AWS Specific Settings
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
EOF

echo -e "${GREEN}✅ .env file created successfully!${NC}"
echo -e ""
echo -e "${YELLOW}📝 Please edit the .env file with your actual values:${NC}"
echo -e "${BLUE}   nano .env${NC}"
echo -e ""
echo -e "${YELLOW}🔑 Required API Keys:${NC}"
echo -e "${BLUE}   - CLAUDE_API_KEY: Get from https://console.anthropic.com${NC}"
echo -e "${BLUE}   - PERPLEXITY_API_KEY: Get from https://www.perplexity.ai/settings${NC}"
echo -e "${BLUE}   - BRIGHTDATA_API_KEY: Get from https://brightdata.com/dashboard${NC}"
echo -e ""
echo -e "${YELLOW}🗄️  Database Configuration:${NC}"
echo -e "${BLUE}   - NEO4J_URI: Your Neo4j AuraDB connection string${NC}"
echo -e "${BLUE}   - NEO4J_USER: Usually 'neo4j'${NC}"
echo -e "${BLUE}   - NEO4J_PASSWORD: Your AuraDB password${NC}"
echo -e ""
echo -e "${YELLOW}🔒 Security:${NC}"
echo -e "${BLUE}   - REDIS_PASSWORD: Create a strong password for Redis${NC}"
echo -e "${BLUE}   - AWS credentials: If using AWS services${NC}"
echo -e ""
echo -e "${GREEN}✅ After editing, your app will be ready for production!${NC}"
