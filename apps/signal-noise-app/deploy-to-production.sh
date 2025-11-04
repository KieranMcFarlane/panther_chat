#!/bin/bash

# 📦 RFP Autonomous System - Deploy to Production Server
# ====================================================
# 
# Uploads all deployment files to production server and runs deployment
# Server: 13.60.60.50 | User: kieranmcfarlane

set -e

# Configuration
SERVER="13.60.60.50"
USER="kieranmcfarlane"
SSH_KEY="/Users/kieranmcfarlane/Downloads/panther_chat/yellowpanther.pem"
DEPLOY_DIR="/tmp"
LOCAL_DIR="production-deploy"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 RFP Autonomous System - Production Deployment${NC}"
echo "=============================================="
echo "Server: $SERVER"
echo "User: $USER"
echo "SSH Key: $SSH_KEY"
echo ""

# Function to print status
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️ $1${NC}"
}

# Check if SSH key exists
if [ ! -f "$SSH_KEY" ]; then
    print_error "SSH key not found: $SSH_KEY"
    echo "Please ensure the SSH key file exists and try again."
    exit 1
fi

# Check if deployment directory exists
if [ ! -d "$LOCAL_DIR" ]; then
    print_error "Deployment directory not found: $LOCAL_DIR"
    echo "Run this script from the root of the project directory."
    exit 1
fi

# Test SSH connection
print_info "Testing SSH connection..."
if ssh -i "$SSH_KEY" -o ConnectTimeout=10 -o StrictHostKeyChecking=no "$USER@$SERVER" "echo 'SSH connection successful'" > /dev/null 2>&1; then
    print_status "SSH connection successful"
else
    print_error "SSH connection failed"
    print_info "Please ensure:"
    echo "1. The server IP address is correct: $SERVER"
    echo "2. The username is correct: $USER"
    echo "3. The SSH key is properly configured on the server"
    echo "4. The public key is added to ~/.ssh/authorized_keys on the server"
    echo ""
    echo "Public key to add to server:"
    echo "----------------------------------------"
    ssh-keygen -y -f "$SSH_KEY"
    echo "----------------------------------------"
    exit 1
fi

# Upload deployment files
print_info "Uploading deployment files to server..."
scp -i "$SSH_KEY" -o StrictHostKeyChecking=no "$LOCAL_DIR"/* "$USER@$SERVER:$DEPLOY_DIR/"

if [ $? -eq 0 ]; then
    print_status "Files uploaded successfully"
else
    print_error "Failed to upload files"
    exit 1
fi

# Make deployment script executable on server
print_info "Setting up deployment script on server..."
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$USER@$SERVER" "chmod +x $DEPLOY_DIR/deploy-production.sh"

# Run deployment on server
print_info "Starting deployment on server..."
print_warning "This will take 10-15 minutes to complete..."
echo ""

ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$USER@$SERVER" "cd $DEPLOY_DIR && ./deploy-production.sh"

# Check deployment result
if [ $? -eq 0 ]; then
    print_status "Deployment completed successfully!"
    echo ""
    echo -e "${BLUE}🎉 Your Level 3 Autonomous RFP System is now live!${NC}"
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo "1. Configure environment variables on the server:"
    echo "   ssh -i $SSH_KEY $USER@$SERVER 'nano /opt/rfp-autonomous/.env.production'"
    echo ""
    echo "2. Set up your domain name and SSL:"
    echo "   ssh -i $SSH_KEY $USER@$SERVER 'sudo nano /etc/nginx/sites-available/rfp-autonomous'"
    echo "   ssh -i $SSH_KEY $USER@$SERVER 'sudo certbot --nginx -d your-domain.com'"
    echo ""
    echo "3. Configure databases (Supabase + Neo4j)"
    echo ""
    echo "4. Verify deployment:"
    echo "   curl http://$SERVER:3000/api/verification?check=all"
    echo ""
    echo -e "${BLUE}Useful commands:${NC}"
    echo "- Check status: ssh -i $SSH_KEY $USER@$SERVER 'pm2 status'"
    echo "- View logs: ssh -i $SSH_KEY $USER@$SERVER 'pm2 logs rfp-autonomous'"
    echo "- Monitoring: ssh -i $SSH_KEY $USER@$SERVER 'pm2 monit'"
else
    print_error "Deployment failed"
    print_info "Check the logs on the server for troubleshooting:"
    echo "ssh -i $SSH_KEY $USER@$SERVER 'tail -50 /var/log/rfp-autonomous-deploy.log'"
fi

echo ""
echo -e "${BLUE}Deployment completed at: $(date)${NC}"