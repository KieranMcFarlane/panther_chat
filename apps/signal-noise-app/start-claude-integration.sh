#!/bin/bash

# FastAPI + Claude Agent SDK + CopilotKit Integration Startup Script

echo "🚀 Starting Claude Agent SDK + CopilotKit Integration..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if a port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to wait for server to start
wait_for_server() {
    local url=$1
    local service=$2
    echo -e "${YELLOW}Waiting for $service to start...${NC}"
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s "$url" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ $service is ready!${NC}"
            return 0
        fi
        echo -e "${YELLOW}Attempt $attempt/$max_attempts...${NC}"
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo -e "${RED}❌ $service failed to start${NC}"
    return 1
}

# Check if required dependencies are installed
echo -e "${BLUE}📦 Checking dependencies...${NC}"

# Check Python
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 is required but not installed${NC}"
    exit 1
fi

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is required but not installed${NC}"
    exit 1
fi

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo -e "${BLUE}🐍 Creating Python virtual environment...${NC}"
    python3 -m venv venv
fi

# Activate virtual environment
echo -e "${BLUE}🐍 Activating virtual environment...${NC}"
source venv/bin/activate

# Install Python dependencies
echo -e "${BLUE}📦 Installing Python dependencies...${NC}"
pip install -r requirements-webhook.txt

# Check Node modules
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}📦 Installing Node.js dependencies...${NC}"
    npm install
fi

# Check if ports are available
if check_port 8001; then
    echo -e "${RED}❌ Port 8001 is already in use. Please stop the service using this port.${NC}"
    exit 1
fi

if check_port 3005; then
    echo -e "${RED}❌ Port 3005 is already in use. Please stop the Next.js app.${NC}"
    exit 1
fi

# Check environment variables
echo -e "${BLUE}🔍 Checking environment configuration...${NC}"

# Load environment variables from .env file if it exists
if [ -f ".env" ]; then
    echo -e "${BLUE}📄 Loading environment variables from .env${NC}"
    export $(cat .env | grep -v '^#' | xargs)
fi

# Set custom API configuration
export ANTHROPIC_BASE_URL="https://api.z.ai/api/anthropic"
export ANTHROPIC_AUTH_TOKEN="c4b860075e254d219887557d13477116.e8Gtsb5sXuDggh2c"

echo -e "${BLUE}🔗 Using custom API configuration:${NC}"
echo -e "   Base URL: ${GREEN}${ANTHROPIC_BASE_URL}${NC}"
echo -e "   Auth Token: ${GREEN}${ANTHROPIC_AUTH_TOKEN:0:20}...${NC}"

# Verify the custom configuration is set
if [ -z "$ANTHROPIC_BASE_URL" ] || [ -z "$ANTHROPIC_AUTH_TOKEN" ]; then
    echo -e "${RED}❌ Custom API configuration not properly set${NC}"
    exit 1
else
    echo -e "${GREEN}✅ Custom API configuration loaded${NC}"
fi

# Check if .mcp.json exists for MCP configuration
if [ ! -f ".mcp.json" ]; then
    echo -e "${YELLOW}⚠️  .mcp.json not found. Using default MCP configuration.${NC}"
    echo "You can create one based on your existing .mcp.json file for proper MCP tool integration."
fi

# Start FastAPI webhook server
echo -e "${BLUE}🔧 Starting FastAPI webhook server on port 8001...${NC}"
python claude-webhook-server.py &
WEBHOOK_PID=$!

# Wait for FastAPI server to start
if ! wait_for_server "http://localhost:8001/health" "FastAPI Webhook Server"; then
    echo -e "${RED}❌ Failed to start FastAPI server${NC}"
    kill $WEBHOOK_PID 2>/dev/null
    exit 1
fi

# Start Next.js application
echo -e "${BLUE}🚀 Starting Next.js application on port 3005...${NC}"
npm run dev &
NEXTJS_PID=$!

# Wait for Next.js to start
if ! wait_for_server "http://localhost:3005" "Next.js Application"; then
    echo -e "${RED}❌ Failed to start Next.js application${NC}"
    kill $WEBHOOK_PID 2>/dev/null
    kill $NEXTJS_PID 2>/dev/null
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 Both servers are running successfully!${NC}"
echo ""
echo -e "${BLUE}📋 Services:${NC}"
echo -e "   • FastAPI Webhook Server: ${GREEN}http://localhost:8001${NC}"
echo -e "   • Next.js Application:    ${GREEN}http://localhost:3005${NC}"
echo ""
echo -e "${BLUE}🔗 Integration Flow:${NC}"
echo -e "   CopilotKit Chat Panel → Next.js Frontend → FastAPI Webhook → Claude Agent SDK → MCP Tools"
echo ""
echo -e "${BLUE}🧪 Testing the Integration:${NC}"
echo -e "   1. Open ${GREEN}http://localhost:3005${NC} in your browser"
echo -e "   2. Click the chat button (bottom-right corner)"
echo -e "   3. Try: ${YELLOW}\"Find Premier League clubs\"${NC}"
echo -e "   4. Try: ${YELLOW}\"Execute a Neo4j query\"${NC}"
echo -e "   5. Try: ${YELLOW}\"Search for sports business opportunities\"${NC}"
echo ""
echo -e "${BLUE}📝 Logs:${NC}"
echo -e "   • FastAPI logs: Check this terminal"
echo -e "   • Next.js logs: Check the browser console and Next.js terminal"
echo ""
echo -e "${YELLOW}⚠️  To stop both servers, press Ctrl+C${NC}"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Shutting down servers...${NC}"
    
    if [ ! -z "$WEBHOOK_PID" ]; then
        echo -e "${BLUE}   Stopping FastAPI server (PID: $WEBHOOK_PID)${NC}"
        kill $WEBHOOK_PID 2>/dev/null
    fi
    
    if [ ! -z "$NEXTJS_PID" ]; then
        echo -e "${BLUE}   Stopping Next.js server (PID: $NEXTJS_PID)${NC}"
        kill $NEXTJS_PID 2>/dev/null
    fi
    
    echo -e "${GREEN}✅ All servers stopped${NC}"
    exit 0
}

# Set up trap to cleanup on Ctrl+C
trap cleanup SIGINT

# Keep the script running
echo -e "${GREEN}✨ Integration is running! Press Ctrl+C to stop.${NC}"
echo ""

# Monitor the processes
while true; do
    if ! kill -0 $WEBHOOK_PID 2>/dev/null; then
        echo -e "${RED}❌ FastAPI server died unexpectedly${NC}"
        cleanup
    fi
    
    if ! kill -0 $NEXTJS_PID 2>/dev/null; then
        echo -e "${RED}❌ Next.js server died unexpectedly${NC}"
        cleanup
    fi
    
    sleep 5
done