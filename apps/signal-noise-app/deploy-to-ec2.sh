#!/bin/bash

# AWS EC2 Deployment Script for Claude Agent SDK + FastAPI Backend
# Usage: ./deploy-to-ec2.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Your AWS EC2 Configuration
VPS_IP="13.60.60.50"
VPS_USER="ec2-user"
PEM_FILE="/Users/kieranmcfarlane/Downloads/panther_chat/yellowpanther.pem"
REMOTE_DIR="/home/ec2-user/claude-webhook-server"
SERVICE_PORT="8001"

echo -e "${BLUE}🚀 Deploying Claude Agent SDK Backend to AWS EC2${NC}"
echo "=" * 60
echo -e "${BLUE}EC2 IP:${NC} $VPS_IP"
echo -e "${BLUE}EC2 User:${NC} $VPS_USER"
echo -e "${BLUE}PEM File:${NC} $PEM_FILE"
echo -e "${BLUE}Remote Dir:${NC} $REMOTE_DIR"
echo "=" * 60

# Check if PEM file exists
if [ ! -f "$PEM_FILE" ]; then
    echo -e "${RED}❌ PEM file not found: $PEM_FILE${NC}"
    exit 1
fi

# Set PEM file permissions
chmod 600 "$PEM_FILE"

# Test SSH connection
echo -e "${BLUE}🔍 Testing SSH connection to EC2...${NC}"
if ! ssh -i "$PEM_FILE" -o ConnectTimeout=10 -o StrictHostKeyChecking=no "$VPS_USER@$VPS_IP" "echo 'SSH connection successful'"; then
    echo -e "${RED}❌ Failed to connect to EC2${NC}"
    echo -e "${YELLOW}Please check:${NC}"
    echo -e "  • EC2 IP address is correct: $VPS_IP"
    echo -e "  • EC2 instance is running and accessible"
    echo -e "  • PEM file is correct: $PEM_FILE"
    echo -e "  • Security groups allow SSH (port 22)"
    echo -e "  • User has SSH access: $VPS_USER"
    exit 1
fi

echo -e "${GREEN}✅ SSH connection successful${NC}"

# Create remote directory and setup
echo -e "${BLUE}📁 Setting up remote directory...${NC}"
ssh -i "$PEM_FILE" "$VPS_USER@$VPS_IP" << EOF
    # Create app directory in user home
    mkdir -p $REMOTE_DIR
    cd $REMOTE_DIR
    
    # Update system packages (using yum for Amazon Linux)
    sudo yum update -y
    
    # Install Python 3 and pip if not present
    if ! command -v python3 &> /dev/null; then
        sudo yum install python3 python3-pip -y
    fi
    
    # Install git if not present
    if ! command -v git &> /dev/null; then
        sudo yum install git -y
    fi
    
    # Install gcc for building Python packages
    sudo yum groupinstall "Development Tools" -y
    sudo yum install python3-devel -y
    
    echo "✅ Remote setup completed"
EOF

# Copy files to EC2
echo -e "${BLUE}📦 Copying application files to EC2...${NC}"

# Files to copy
FILES_TO_COPY=(
    "claude-webhook-server.py"
    "requirements-webhook.txt"
    ".env.example"
    ".mcp.json"
    "neo4j-mcp-server.js"
)

# Create temporary directory for packaging
TEMP_DIR="/tmp/claude-ec2-deploy-$(date +%s)"
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

# Create a startup script for EC2
cat > "$TEMP_DIR/start-server.sh" << 'EOF'
#!/bin/bash

# EC2 Server Startup Script
cd /home/ec2-user/claude-webhook-server

# Activate virtual environment
source venv/bin/activate

# Set environment variables
export ANTHROPIC_BASE_URL="https://api.z.ai/api/anthropic"
export ANTHROPIC_AUTH_TOKEN="c4b860075e254d219887557d13477116.e8Gtsb5sXuDggh2c"
export PORT="8001"
export HOST="0.0.0.0"

# Get EC2 public IP
EC2_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)

# Start the server
echo "🚀 Starting Claude Agent Webhook Server on EC2..."
echo "🔗 API: $ANTHROPIC_BASE_URL"
echo "🌐 Server will be available at: http://$EC2_IP:8001"

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
User=ec2-user
Group=ec2-user
WorkingDirectory=$REMOTE_DIR
Environment="PATH=$REMOTE_DIR/venv/bin"
ExecStart=$REMOTE_DIR/start-server.sh
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

# Environment variables
Environment="ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic"
Environment="ANTHROPIC_AUTH_TOKEN=c4b860075e254d219887557d13477116.e8Gtsb5sXuDggh2c"
Environment="PORT=8001"
Environment="HOST=0.0.0.0"

[Install]
WantedBy=multi-user.target
EOF

# Copy packaged files to EC2
scp -i "$PEM_FILE" -r "$TEMP_DIR"/* "$VPS_USER@$VPS_IP:$REMOTE_DIR/"

# Clean up temporary directory
rm -rf "$TEMP_DIR"

# Setup on EC2
echo -e "${BLUE}⚙️  Setting up application on EC2...${NC}"
ssh -i "$PEM_FILE" "$VPS_USER@$VPS_IP" << EOF
    cd $REMOTE_DIR
    
    # Create virtual environment
    python3 -m venv venv
    source venv/bin/activate
    
    # Upgrade pip
    pip install --upgrade pip
    
    # Install Python dependencies
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
ssh -i "$PEM_FILE" "$VPS_USER@$VPS_IP" << 'EOF'
    # Create service directory if it doesn't exist
    sudo mkdir -p /etc/systemd/system
    
    # Copy service file
    sudo cp /home/ec2-user/claude-webhook-server/claude-webhook.service /etc/systemd/system/
    
    # Reload systemd
    sudo systemctl daemon-reload
    
    # Enable and start service
    sudo systemctl enable claude-webhook
    sudo systemctl start claude-webhook
    
    # Check status
    sudo systemctl status claude-webhook --no-pager
    
    echo "✅ Service installed and started"
EOF

# Wait for server to start
echo -e "${BLUE}⏳ Waiting for server to start...${NC}"
sleep 15

# Test if server is running
echo -e "${BLUE}🧪 Testing server connection...${NC}"
if curl -s "http://$VPS_IP:8001/health" > /dev/null; then
    echo -e "${GREEN}✅ Server is running successfully!${NC}"
else
    echo -e "${YELLOW}⚠ Server might still be starting...${NC}"
    echo -e "You can check the status with: ssh -i $PEM_FILE $VPS_USER@$VPS_IP 'sudo systemctl status claude-webhook'"
fi

echo ""
echo -e "${GREEN}🎉 EC2 deployment completed successfully!${NC}"
echo ""
echo -e "${BLUE}📋 EC2 Server Information:${NC}"
echo -e "   • EC2 IP: ${GREEN}$VPS_IP${NC}"
echo -e "   • Server URL: ${GREEN}http://$VPS_IP:8001${NC}"
echo -e "   • Health Check: ${GREEN}http://$VPS_IP:8001/health${NC}"
echo -e "   • API Endpoint: ${GREEN}http://$VPS_IP:8001/webhook/chat${NC}"
echo ""
echo -e "${BLUE}🔧 Management Commands:${NC}"
echo -e "   • Check status: ${YELLOW}ssh -i $PEM_FILE $VPS_USER@$VPS_IP 'sudo systemctl status claude-webhook'${NC}"
echo -e "   • View logs: ${YELLOW}ssh -i $PEM_FILE $VPS_USER@$VPS_IP 'sudo journalctl -u claude-webhook -f'${NC}"
echo -e "   • Restart: ${YELLOW}ssh -i $PEM_FILE $VPS_USER@$VPS_IP 'sudo systemctl restart claude-webhook'${NC}"
echo -e "   • Stop: ${YELLOW}ssh -i $PEM_FILE $VPS_USER@$VPS_IP 'sudo systemctl stop claude-webhook'${NC}"
echo ""
echo -e "${BLUE}🔄 Next Steps:${NC}"
echo -e "   1. Update your Next.js app to use: ${YELLOW}http://$VPS_IP:8001${NC}"
echo -e "   2. Run: ${YELLOW}./configure-for-ec2.sh${NC}"
echo -e "   3. Start Next.js: ${YELLOW}npm run dev${NC}"
echo ""
echo -e "${YELLOW}⚠️  AWS Security Group Note:${NC}"
echo -e "   Make sure your EC2 security group allows inbound traffic on:"
echo -e "   • Port 22 (SSH) - should be open"
echo -e "   • Port 8001 (HTTP) - ${YELLOW}add this rule${NC}"
echo ""