#!/bin/bash

# Terminal Startup Script for EC2 Connection
# This script starts ttyd to connect to your EC2 instance

set -e

# Configuration
EC2_HOST="13.60.60.50"
EC2_USER="ec2-user"
KEY_PATH="/Users/kieranmcfarlane/Downloads/panther_chat/yellowpanther.pem"
TTYD_PORT="7681"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🚀 Starting Terminal for EC2 Connection${NC}"
echo -e "${BLUE}=========================================${NC}"

# Check if ttyd is installed
if ! command -v ttyd &> /dev/null; then
    echo -e "${RED}❌ ttyd is not installed${NC}"
    echo -e "${YELLOW}Installing ttyd...${NC}"
    brew install ttyd
fi

# Check if key file exists
if [ ! -f "$KEY_PATH" ]; then
    echo -e "${RED}❌ SSH key not found at: $KEY_PATH${NC}"
    exit 1
fi

# Set correct permissions for key file
chmod 600 "$KEY_PATH"

# Kill any existing ttyd process on port 7681
echo -e "${YELLOW}🔍 Checking for existing ttyd processes...${NC}"
pkill -f "ttyd.*7681" || true

# Start ttyd
echo -e "${GREEN}🚀 Starting ttyd on port $TTYD_PORT${NC}"
echo -e "${GREEN}📡 Connecting to $EC2_USER@$EC2_HOST${NC}"
echo -e "${BLUE}=========================================${NC}"

# Start ttyd with SSH connection to EC2
ttyd -p "$TTYD_PORT" \
    -W \
    --prefer-dark-theme \
    ssh -i "$KEY_PATH" \
    -o StrictHostKeyChecking=no \
    -o UserKnownHostsFile=/dev/null \
    "$EC2_USER@$EC2_HOST"

echo -e "${GREEN}✅ Terminal started successfully${NC}"
echo -e "${YELLOW}💡 Access at: http://localhost:$TTYD_PORT${NC}"
echo -e "${YELLOW}💡 Press Ctrl+C to stop the terminal${NC}"