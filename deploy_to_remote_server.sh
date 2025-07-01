#!/bin/bash

# Deploy Global Unified Sports Intelligence System to Remote Server with Ollama
# Usage: ./deploy_to_remote_server.sh <server_ip> <username>

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check arguments
if [ $# -lt 2 ]; then
    print_error "Usage: $0 <server_ip> <username>"
    print_error "Example: $0 192.168.1.100 ubuntu"
    exit 1
fi

SERVER_IP=$1
USERNAME=$2
SERVER_DIR="/home/$USERNAME/global-sports-intelligence"

print_status "🌍 Deploying Global Sports Intelligence System to Remote Server"
echo "Server: $USERNAME@$SERVER_IP"
echo "Target Directory: $SERVER_DIR"
echo "=================================================="

# Step 1: Check SSH connection
print_status "Checking SSH connection to $SERVER_IP..."
if ! ssh -o ConnectTimeout=10 -o BatchMode=yes $USERNAME@$SERVER_IP exit; then
    print_error "Cannot connect to $USERNAME@$SERVER_IP via SSH"
    print_error "Please ensure:"
    print_error "1. SSH key is configured"
    print_error "2. Server is accessible"
    print_error "3. Username is correct"
    exit 1
fi
print_success "SSH connection verified"

# Step 2: Check if Ollama is running on remote server
print_status "Checking Ollama installation on remote server..."
OLLAMA_STATUS=$(ssh $USERNAME@$SERVER_IP "curl -s http://localhost:11434/api/tags || echo 'FAILED'")
if [[ "$OLLAMA_STATUS" == "FAILED" ]]; then
    print_warning "Ollama not detected on remote server"
    print_status "Installing Ollama on remote server..."
    ssh $USERNAME@$SERVER_IP "curl -fsSL https://ollama.ai/install.sh | sh"
    print_success "Ollama installed"
else
    print_success "Ollama is running on remote server"
fi

# Step 3: Create deployment directory
print_status "Creating deployment directory..."
ssh $USERNAME@$SERVER_IP "mkdir -p $SERVER_DIR"

# Step 4: Copy project files
print_status "Copying project files to remote server..."
rsync -avz --progress \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='__pycache__' \
    --exclude='.env*' \
    --exclude='logs' \
    ./ $USERNAME@$SERVER_IP:$SERVER_DIR/

print_success "Project files copied"

# Step 5: Create remote environment configuration
print_status "Setting up remote environment configuration..."
ssh $USERNAME@$SERVER_IP "cat > $SERVER_DIR/.env.remote <<EOF
# Global Unified Sports Intelligence System - Remote Configuration
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=pantherpassword

# Ollama Configuration
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=o3-mini

# AI API Keys (optional - using Ollama instead)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# System Configuration
SYSTEM_NAME=Global Sports Intelligence
SYSTEM_VERSION=1.0.0
ENABLE_TECHNICAL_ANALYSIS=true
ENABLE_BUSINESS_INTELLIGENCE=true
ENABLE_PREMIER_LEAGUE_INTELLIGENCE=true
ENABLE_OLLAMA_INTEGRATION=true

# Server Configuration
SERVER_HOST=0.0.0.0
SERVER_PORT=8080
FASTAPI_HOST=0.0.0.0
FASTAPI_PORT=8000

# Logging Configuration
LOG_LEVEL=INFO
LOG_FORMAT=json
EOF"

# Step 6: Install Docker and Docker Compose on remote server
print_status "Installing Docker and Docker Compose on remote server..."
ssh $USERNAME@$SERVER_IP "
    # Update package index
    sudo apt-get update

    # Install required packages
    sudo apt-get install -y curl apt-transport-https ca-certificates gnupg lsb-release

    # Add Docker GPG key
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

    # Add Docker repository
    echo \"deb [arch=\$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu \$(lsb_release -cs) stable\" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

    # Update package index again
    sudo apt-get update

    # Install Docker
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io

    # Add user to docker group
    sudo usermod -aG docker $USERNAME

    # Install Docker Compose
    sudo curl -L \"https://github.com/docker/compose/releases/latest/download/docker-compose-\$(uname -s)-\$(uname -m)\" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose

    # Start and enable Docker
    sudo systemctl start docker
    sudo systemctl enable docker
"

print_success "Docker and Docker Compose installed"

# Step 7: Make scripts executable
print_status "Making scripts executable..."
ssh $USERNAME@$SERVER_IP "
    cd $SERVER_DIR
    chmod +x setup_global_unified_system.sh
    chmod +x manage_system.sh
"

print_success "🎉 Deployment completed!"
print_status "Next steps:"
echo "1. SSH into your server: ssh $USERNAME@$SERVER_IP"
echo "2. Navigate to project: cd $SERVER_DIR"
echo "3. Start the system: ./setup_global_unified_system.sh"
echo "4. Access via: http://$SERVER_IP:8080"
echo ""
print_warning "Note: You may need to log out and back in for Docker group permissions to take effect" 