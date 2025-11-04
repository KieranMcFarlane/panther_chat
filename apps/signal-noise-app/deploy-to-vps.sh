#!/bin/bash

# VPS Deployment Script for Claude Agent SDK + FastAPI Backend
# Usage: ./deploy-to-vps.sh [VPS_IP] [VPS_USER]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default configuration
VPS_IP=${1:-"YOUR_VPS_IP"}
VPS_USER=${2:-"root"}
PEM_FILE="/Users/kieranmcfarlane/Downloads/panther_chat/yellowpanther.pem"
APP_NAME="claude-webhook-server"
REMOTE_DIR="/opt/$APP_NAME"
SERVICE_PORT="8001"

echo -e "${BLUE}🚀 Deploying Claude Agent SDK Backend to VPS${NC}"
echo "=" * 50
echo -e "${BLUE}VPS IP:${NC} $VPS_IP"
echo -e "${BLUE}VPS User:${NC} $VPS_USER"
echo -e "${BLUE}PEM File:${NC} $PEM_FILE"
echo -e "${BLUE}Remote Dir:${NC} $REMOTE_DIR"
echo "=" * 50

# Check if PEM file exists
if [ ! -f "$PEM_FILE" ]; then
    echo -e "${RED}❌ PEM file not found: $PEM_FILE${NC}"
    exit 1
fi

# Set PEM file permissions
chmod 600 "$PEM_FILE"

# Test SSH connection
echo -e "${BLUE}🔍 Testing SSH connection to VPS...${NC}"
if ! ssh -i "$PEM_FILE" -o ConnectTimeout=10 -o StrictHostKeyChecking=no "$VPS_USER@$VPS_IP" "echo 'SSH connection successful'"; then
    echo -e "${RED}❌ Failed to connect to VPS${NC}"
    echo -e "${YELLOW}Please check:${NC}"
    echo -e "  • VPS IP address is correct: $VPS_IP"
    echo -e "  • VPS is running and accessible"
    echo -e "  • PEM file is correct: $PEM_FILE"
    echo -e "  • User has SSH access: $VPS_USER"
    exit 1
fi

echo -e "${GREEN}✅ SSH connection successful${NC}"

# Create remote directory and setup
echo -e "${BLUE}📁 Setting up remote directory...${NC}"
ssh -i "$PEM_FILE" "$VPS_USER@$VPS_IP" << EOF
    # Create app directory
    sudo mkdir -p $REMOTE_DIR
    sudo chown \$USER:\$USER $REMOTE_DIR
    cd $REMOTE_DIR
    
    # Update system packages
    sudo apt update && sudo apt upgrade -y
    
    # Install Python and pip if not present
    if ! command -v python3 &> /dev/null; then
        sudo apt install python3 python3-pip python3-venv -y
    fi
    
    # Install git if not present
    if ! command -v git &> /dev/null; then
        sudo apt install git -y
    fi
    
    echo "✅ Remote setup completed"
EOF

# Copy files to VPS
echo -e "${BLUE}📦 Copying application files to VPS...${NC}"

# Files to copy
FILES_TO_COPY=(
    "claude-webhook-server.py"
    "requirements-webhook.txt"
    ".env.example"
    ".mcp.json"
    "neo4j-mcp-server.js"
)

# Create temporary directory for packaging
TEMP_DIR="/tmp/claude-deploy-$(date +%s)"
mkdir -p "$TEMP_DIR"

# Copy files that exist
for file in "${FILES_TO_COPY[@]}"; do
    if [ -f "$file" ]; then
        cp "$file" "$TEMP_DIR/"
        echo -e "${GREEN}  ✓ $file${NC}"
    else
        echo -e "${YELLOW}  ⚠ $file not found, skipping${NC}"
    fi
done

# Create a startup script for VPS
cat > "$TEMP_DIR/start-server.sh" << 'EOF'
#!/bin/bash

# VPS Server Startup Script
cd /opt/claude-webhook-server

# Activate virtual environment
source venv/bin/activate

# Set environment variables
export ANTHROPIC_BASE_URL="https://api.z.ai/api/anthropic"
export ANTHROPIC_AUTH_TOKEN="c4b860075e254d219887557d13477116.e8Gtsb5sXuDggh2c"
export PORT="8001"
export HOST="0.0.0.0"

# Start the server
echo "🚀 Starting Claude Agent Webhook Server on VPS..."
echo "🔗 API: $ANTHROPIC_BASE_URL"
echo "🌐 Server will be available at: http://$(curl -s ifconfig.me):8001"

exec uvicorn claude-webhook-server:app --host 0.0.0.0 --port 8001
EOF

chmod +x "$TEMP_DIR/start-server.sh"

# Create systemd service file
cat > "$TEMP_DIR/claude-webhook.service" << EOF
[Unit]
Description=Claude Agent Webhook Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$REMOTE_DIR
Environment="PATH=$REMOTE_DIR/venv/bin"
ExecStart=$REMOTE_DIR/start-server.sh
Restart=always
RestartSec=10

# Environment variables
Environment="ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic"
Environment="ANTHROPIC_AUTH_TOKEN=c4b860075e254d219887557d13477116.e8Gtsb5sXuDggh2c"
Environment="PORT=8001"
Environment="HOST=0.0.0.0"

[Install]
WantedBy=multi-user.target
EOF

# Copy packaged files to VPS
scp -i "$PEM_FILE" -r "$TEMP_DIR"/* "$VPS_USER@$VPS_IP:$REMOTE_DIR/"

# Clean up temporary directory
rm -rf "$TEMP_DIR"

# Setup on VPS
echo -e "${BLUE}⚙️  Setting up application on VPS...${NC}"
ssh -i "$PEM_FILE" "$VPS_USER@$VPS_IP" << EOF
    cd $REMOTE_DIR
    
    # Create virtual environment
    python3 -m venv venv
    source venv/bin/activate
    
    # Install Python dependencies
    pip install --upgrade pip
    pip install -r requirements-webhook.txt
    
    # Make scripts executable
    chmod +x start-server.sh
    
    # Create .env file with custom API configuration
    cat > .env << 'ENVEOF'
ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic
ANTHROPIC_AUTH_TOKEN=c4b860075e254d219887557d13477116.e8Gtsb5sXuDggh2c
NEO4J_URI=neo4j+s://demo.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=
NEO4J_DATABASE=neo4j
PORT=8001
HOST=0.0.0.0
ENVEOF
    
    echo "✅ Dependencies installed and configured"
EOF

# Install and start systemd service
echo -e "${BLUE}🔧 Installing systemd service...${NC}"
ssh -i "$PEM_FILE" "$VPS_USER@$VPS_IP" << EOF
    # Copy service file
    sudo cp $REMOTE_DIR/claude-webhook.service /etc/systemd/system/
    
    # Reload systemd
    sudo systemctl daemon-reload
    
    # Enable and start service
    sudo systemctl enable claude-webhook
    sudo systemctl start claude-webhook
    
    # Check status
    sudo systemctl status claude-webhook --no-pager
    
    echo "✅ Service installed and started"
EOF

# Get VPS public IP
VPS_PUBLIC_IP=$(ssh -i "$PEM_FILE" "$VPS_USER@$VPS_IP" "curl -s ifconfig.me")

# Wait for server to start
echo -e "${BLUE}⏳ Waiting for server to start...${NC}"
sleep 10

# Test if server is running
echo -e "${BLUE}🧪 Testing server connection...${NC}"
if curl -s "http://$VPS_PUBLIC_IP:8001/health" > /dev/null; then
    echo -e "${GREEN}✅ Server is running successfully!${NC}"
else
    echo -e "${YELLOW}⚠ Server might still be starting...${NC}"
    echo -e "You can check the status with: ssh -i $PEM_FILE $VPS_USER@$VPS_IP 'sudo systemctl status claude-webhook'"
fi

echo ""
echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo ""
echo -e "${BLUE}📋 VPS Server Information:${NC}"
echo -e "   • VPS IP: ${GREEN}$VPS_PUBLIC_IP${NC}"
echo -e "   • Server URL: ${GREEN}http://$VPS_PUBLIC_IP:8001${NC}"
echo -e "   • Health Check: ${GREEN}http://$VPS_PUBLIC_IP:8001/health${NC}"
echo -e "   • API Endpoint: ${GREEN}http://$VPS_PUBLIC_IP:8001/webhook/chat${NC}"
echo ""
echo -e "${BLUE}🔧 Management Commands:${NC}"
echo -e "   • Check status: ${YELLOW}ssh -i $PEM_FILE $VPS_USER@$VPS_IP 'sudo systemctl status claude-webhook'${NC}"
echo -e "   • View logs: ${YELLOW}ssh -i $PEM_FILE $VPS_USER@$VPS_IP 'sudo journalctl -u claude-webhook -f'${NC}"
echo -e "   • Restart: ${YELLOW}ssh -i $PEM_FILE $VPS_USER@$VPS_IP 'sudo systemctl restart claude-webhook'${NC}"
echo -e "   • Stop: ${YELLOW}ssh -i $PEM_FILE $VPS_USER@$VPS_IP 'sudo systemctl stop claude-webhook'${NC}"
echo ""
echo -e "${BLUE}🔄 Next Steps:${NC}"
echo -e "   1. Update your Next.js app to use: ${YELLOW}http://$VPS_PUBLIC_IP:8001${NC}"
echo -e "   2. Update CopilotKit route in: ${YELLOW}src/app/api/copilotkit/route.ts${NC}"
echo -e "   3. Change CLAUDE_WEBHOOK_URL to your VPS IP"
echo ""