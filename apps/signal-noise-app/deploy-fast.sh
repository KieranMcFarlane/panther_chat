#!/bin/bash

# Fast deployment - copy pre-built tarball to EC2
set -e

EC2_USER="ec2-user"
EC2_HOST="51.20.117.84"
PEM_FILE="/Users/kieranmcfarlane/Downloads/panther_chat/yellowpanther.pem"
REMOTE_DIR="/home/ec2-user/signal-noise-app"
TARBALL="/tmp/deploy-minimal.tar.gz"
NODE_VERSION="18"

echo "🚀 Fast deployment to AWS EC2: $EC2_HOST"

# Create local tarball
echo "📦 Creating deployment tarball..."
cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app
tar -czf "$TARBALL" --exclude='*.md' --exclude='*.sh' --exclude='*.log' \
  --exclude='node_modules' --exclude='.next' --exclude='.git' \
  --exclude='venv*' --exclude='pydantic*' --exclude='logs' \
  --exclude='*.test.*' --exclude='*.spec.*' \
  src/ components/ lib/ public/ next.config.js package.json \
  package-lock.json tsconfig.json .env.production mcp-config.json .mcp.json

echo "✅ Tarball created: $(ls -lh $TARBALL | awk '{print $5}')"

# Test SSH
echo "🔑 Testing SSH..."
ssh -i "$PEM_FILE" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_HOST" "echo 'SSH OK'"

# Prepare remote
echo "📁 Preparing remote directory..."
ssh -i "$PEM_FILE" "$EC2_USER@$EC2_HOST" "
    rm -rf $REMOTE_DIR
    mkdir -p $REMOTE_DIR
"

# Upload tarball
echo "📤 Uploading tarball..."
scp -i "$PEM_FILE" "$TARBALL" "$EC2_USER@$EC2_HOST:/tmp/deploy.tar.gz"

# Extract and build on remote
echo "🛠️ Extracting and building on remote..."
ssh -i "$PEM_FILE" "$EC2_USER@$EC2_HOST" "
    cd $REMOTE_DIR
    
    # Extract
    tar -xzf /tmp/deploy.tar.gz
    rm /tmp/deploy.tar.gz
    
    # Install Node.js if needed
    if ! command -v node &> /dev/null; then
        echo 'Installing Node.js...'
        curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
    
    # Install dependencies
    npm install --production=false
    
    # Build
    echo '🏗️ Building application...'
    npm run build
"

# Setup PM2
echo "🔄 Setting up PM2..."
ssh -i "$PEM_FILE" "$EC2_USER@$EC2_HOST" "
    cd $REMOTE_DIR
    
    if ! command -v pm2 &> /dev/null; then
        sudo npm install -g pm2
    fi
    
    # Create ecosystem config
    cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'signal-noise-app',
    script: 'npm',
    args: 'start',
    cwd: '/home/ec2-user/signal-noise-app',
    instances: 1,
    autorestart: true,
    max_memory_restart: '1G',
    env: { NODE_ENV: 'production', PORT: 8001 }
  }]
};
EOF
    
    mkdir -p logs
    pm2 stop signal-noise-app || true
    pm2 delete signal-noise-app || true
    pm2 start ecosystem.config.js
    pm2 save
"

# Configure firewall
echo "🔥 Configuring firewall..."
ssh -i "$PEM_FILE" "$EC2_USER@$EC2_HOST" "
    sudo ufw allow 8001/tcp || echo 'UFW not configured'
"

echo "✅ Deployment complete!"
echo "🌐 App available at: http://$EC2_HOST:8001"
echo "📊 PM2 status: ssh -i $PEM_FILE $EC2_USER@$EC2_HOST 'pm2 status'"

