#!/bin/bash

# AWS EC2 Deployment Script for Signal Noise App
# Builds locally and deploys only .next folder to EC2
# Author: Claude Code Assistant

set -e

# Configuration
EC2_USER="ec2-user"
EC2_HOST="ec2-51-20-106-192.eu-north-1.compute.amazonaws.com"
PEM_FILE="/Users/kieranmcfarlane/Downloads/panther_chat/yellowpanther.pem"
LOCAL_DIR="/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app"
REMOTE_DIR="/home/ec2-user/signal-noise-app"

echo "🚀 Starting LOCAL BUILD + EC2 Deployment"
echo "Target: $EC2_HOST"
echo ""

# Step 1: Build locally
echo "🏗️  Building application locally..."
cd "$LOCAL_DIR"
npm run build

if [ ! -d ".next" ]; then
    echo "❌ Build failed - .next directory not found"
    exit 1
fi

echo "✅ Build completed successfully"
echo ""

# Step 2: Test SSH connection
echo "🔑 Testing SSH connection..."
ssh -i "$PEM_FILE" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_HOST" "echo 'SSH connection successful'"
echo ""

# Step 3: Prepare remote directory
echo "📁 Preparing remote directory..."
ssh -i "$PEM_FILE" "$EC2_USER@$EC2_HOST" "
    mkdir -p $REMOTE_DIR
    mkdir -p $REMOTE_DIR/logs
"
echo ""

# Step 4: Copy only essential files
echo "📦 Copying files to EC2..."

# Copy built application
echo "  → Copying .next build..."
rsync -avz --progress \
  -e "ssh -i $PEM_FILE -o StrictHostKeyChecking=no" \
  "$LOCAL_DIR/.next/" "$EC2_USER@$EC2_HOST:$REMOTE_DIR/.next/"

# Copy static files
echo "  → Copying public directory..."
rsync -avz --exclude='.DS_Store' \
  -e "ssh -i $PEM_FILE -o StrictHostKeyChecking=no" \
  "$LOCAL_DIR/public/" "$EC2_USER@$EC2_HOST:$REMOTE_DIR/public/"

# Copy essential config files
echo "  → Copying configuration files..."
scp -i "$PEM_FILE" "$LOCAL_DIR/package.json" "$EC2_USER@$EC2_HOST:$REMOTE_DIR/"
scp -i "$PEM_FILE" "$LOCAL_DIR/package-lock.json" "$EC2_USER@$EC2_HOST:$REMOTE_DIR/"
scp -i "$PEM_FILE" "$LOCAL_DIR/next.config.js" "$EC2_USER@$EC2_HOST:$REMOTE_DIR/"
scp -i "$PEM_FILE" "$LOCAL_DIR/.env.production" "$EC2_USER@$EC2_HOST:$REMOTE_DIR/.env.local"
echo ""

# Step 5: Install production dependencies and setup PM2
echo "🔄 Setting up PM2 process management..."
ssh -i "$PEM_FILE" "$EC2_USER@$EC2_HOST" "
    cd $REMOTE_DIR
    
    # Install production dependencies only (no dev deps)
    echo '📦 Installing production dependencies...'
    npm ci --omit=dev --legacy-peer-deps || npm install --omit=dev --legacy-peer-deps
    
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
    
    # Stop existing process if running
    pm2 stop signal-noise-app || true
    pm2 delete signal-noise-app || true
    
    # Start the application
    echo '🚀 Starting application with PM2...'
    pm2 start ecosystem.config.js
    
    # Save PM2 configuration
    pm2 save
    
    # Setup PM2 startup script
    PM2_STARTUP=\$(pm2 startup | grep -o 'sudo.*' || echo '')
    if [ ! -z \"\$PM2_STARTUP\" ]; then
        echo \"Running: \$PM2_STARTUP\"
        eval \"\$PM2_STARTUP\"
    fi
"
echo ""

# Step 6: Configure firewall
echo "🔥 Configuring firewall..."
ssh -i "$PEM_FILE" "$EC2_USER@$EC2_HOST" "
    # Allow port 8001 through firewall
    if command -v ufw &> /dev/null; then
        sudo ufw allow 8001/tcp || true
        sudo ufw reload || true
    elif command -v firewall-cmd &> /dev/null; then
        sudo firewall-cmd --permanent --add-port=8001/tcp || true
        sudo firewall-cmd --reload || true
    fi
"
echo ""

# Step 7: Wait and test
echo "⏳ Waiting for application to start..."
sleep 5

echo "🧪 Testing application..."
ssh -i "$PEM_FILE" "$EC2_USER@$EC2_HOST" "
    curl -f http://localhost:8001 >/dev/null 2>&1 && echo '✅ Application is running!' || echo '⚠️  Application may still be starting...'
"

echo ""
echo "✅ Deployment completed successfully!"
echo ""
echo "📊 Application Information:"
echo "  • URL: http://51.20.106.192:8001"
echo "  • Public DNS: http://ec2-51-20-106-192.eu-north-1.compute.amazonaws.com:8001"
echo ""
echo "🔧 Management Commands:"
echo "  • Check status: ssh -i $PEM_FILE $EC2_USER@$EC2_HOST 'pm2 status'"
echo "  • View logs: ssh -i $PEM_FILE $EC2_USER@$EC2_HOST 'pm2 logs signal-noise-app'"
echo "  • Restart: ssh -i $PEM_FILE $EC2_USER@$EC2_HOST 'pm2 restart signal-noise-app'"
echo "  • Stop: ssh -i $PEM_FILE $EC2_USER@$EC2_HOST 'pm2 stop signal-noise-app'"
echo ""
echo "⚠️  Don't forget to allow port 8001 in AWS Security Group!"
















