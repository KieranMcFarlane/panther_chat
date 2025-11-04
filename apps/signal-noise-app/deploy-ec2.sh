#!/bin/bash

# AWS EC2 Deployment Script for Signal Noise App
# Author: Claude Code Assistant
# Target: EC2 instance at 13.60.60.50

set -e

# Configuration
EC2_USER="ec2-user"
EC2_HOST="ec2-51-20-106-192.eu-north-1.compute.amazonaws.com"
PEM_FILE="/Users/kieranmcfarlane/Downloads/panther_chat/yellowpanther.pem"
LOCAL_DIR="/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app"
REMOTE_DIR="/home/ec2-user/signal-noise-app"
NODE_VERSION="18"

echo "🚀 Starting deployment to AWS EC2: $EC2_HOST"

# Step 1: Test SSH connection
echo "🔑 Testing SSH connection..."
ssh -i "$PEM_FILE" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_HOST" "echo 'SSH connection successful'"

# Step 2: Prepare remote directory
echo "📁 Preparing remote directory..."
ssh -i "$PEM_FILE" "$EC2_USER@$EC2_HOST" "
    rm -rf $REMOTE_DIR
    mkdir -p $REMOTE_DIR
"

# Step 3: Copy application files (excluding node_modules and .next)
echo "📦 Copying application files..."
rsync -avz --exclude=node_modules --exclude=.next --exclude=.git --exclude='*.disabled' \
  --exclude=venv-claude-sdk --exclude=pydantic-env --exclude='venv*' --exclude='pydantic*' \
  --exclude=logs --exclude='*.log' --exclude='.DS_Store' \
  --exclude='*.md' --exclude='*.sh' --exclude='*.test.*' --exclude='*.spec.*' \
  --exclude='DEPLOY-*.md' --exclude='MANUAL-DEPLOY*.md' --exclude='FIX-SSH*.md' \
  -e "ssh -i $PEM_FILE -o StrictHostKeyChecking=no" \
  "$LOCAL_DIR/" "$EC2_USER@$EC2_HOST:$REMOTE_DIR/"

# Step 4: Copy production environment file
echo "⚙️ Setting up production environment..."
scp -i "$PEM_FILE" "$LOCAL_DIR/.env.production" "$EC2_USER@$EC2_HOST:$REMOTE_DIR/.env.local"

# Step 5: Install dependencies and build on remote
echo "🛠️ Installing dependencies and building on remote..."
ssh -i "$PEM_FILE" "$EC2_USER@$EC2_HOST" "
    cd $REMOTE_DIR
    
    # Install Node.js if not present
    if ! command -v node &> /dev/null; then
        echo 'Installing Node.js...'
        curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
    
    # Verify Node.js version
    node --version
    npm --version
    
    # Install dependencies
    npm install
    
    # Build the application
    echo '🏗️ Building application...'
    npm run build
"

# Step 6: Set up PM2 for process management
echo "🔄 Setting up PM2 process management..."
ssh -i "$PEM_FILE" "$EC2_USER@$EC2_HOST" "
    cd $REMOTE_DIR
    
    # Install PM2 globally if not present
    if ! command -v pm2 &> /dev/null; then
        echo 'Installing PM2...'
        sudo npm install -g pm2
    fi
    
    # Create PM2 ecosystem file
    cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'signal-noise-app',
    script: 'npm',
    args: 'start',
    cwd: '/home/ec2-user/signal-noise-app',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 8001
    },
    error_file: '/home/ec2-user/signal-noise-app/logs/err.log',
    out_file: '/home/ec2-user/signal-noise-app/logs/out.log',
    log_file: '/home/ec2-user/signal-noise-app/logs/combined.log',
    time: true
  }]
};
EOF
    
    # Create logs directory
    mkdir -p logs
    
    # Stop existing process if running
    pm2 stop signal-noise-app || true
    pm2 delete signal-noise-app || true
    
    # Start the application
    echo '🚀 Starting application with PM2...'
    pm2 start ecosystem.config.js
    
    # Save PM2 configuration
    pm2 save
    
    # Setup PM2 startup script
    pm2 startup | tail -1 | bash
"

# Step 7: Configure firewall (if needed)
echo "🔥 Configuring firewall..."
ssh -i "$PEM_FILE" "$EC2_USER@$EC2_HOST" "
    # Allow port 8001 through firewall
    if command -v ufw &> /dev/null; then
        sudo ufw allow 8001
        sudo ufw reload
    elif command -v firewall-cmd &> /dev/null; then
        sudo firewall-cmd --permanent --add-port=8001/tcp
        sudo firewall-cmd --reload
    fi
"

echo "✅ Deployment completed successfully!"
echo "🌐 Your application should be available at: http://13.60.60.50:8001"
echo "📊 Check PM2 status: ssh -i $PEM_FILE $EC2_USER@$EC2_HOST 'pm2 status'"
echo "📋 View logs: ssh -i $PEM_FILE $EC2_USER@$EC2_HOST 'pm2 logs signal-noise-app'"