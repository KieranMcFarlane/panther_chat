#!/bin/bash

# Complete deployment script for signal-noise-app
# Builds locally, packages, and deploys to EC2
set -e

EC2_USER="ubuntu"
EC2_HOST="46.62.243.243"
PEM_FILE="/Users/kieranmcfarlane/Downloads/panther_chat/yellowpanther.pem"
LOCAL_DIR="/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app"
REMOTE_DIR="/home/ubuntu/signal-noise-app"
TARBALL="/tmp/signal-noise-app-deploy.tar.gz"
NODE_VERSION="18"
PORT="4328"

echo "🚀 Complete Deployment: Signal Noise App"
echo "========================================"
echo "Server: $EC2_HOST"
echo "Port: $PORT"
echo ""

# Step 1: Verify local build
echo "📦 Step 1: Building application locally..."
cd "$LOCAL_DIR"

if [ ! -d ".next" ]; then
    echo "   Building Next.js application..."
    npm run build
else
    echo "   ⚠️  .next folder exists. Rebuilding to ensure latest version..."
    npm run build
fi

if [ ! -d ".next" ]; then
    echo "❌ Build failed! .next folder not found."
    exit 1
fi

echo "✅ Local build completed successfully"
echo ""

# Step 2: Create deployment package
echo "📦 Step 2: Creating deployment package..."
rm -f "$TARBALL"

# Essential files and directories needed for production:
# - .next/ (built Next.js app)
# - public/ (static assets)
# - package.json & package-lock.json (dependencies)
# - next.config.js (Next.js config)
# - tsconfig.json (TypeScript config)
# - .env.production (environment variables)
# - mcp-config.json & .mcp.json (MCP configuration)
# - src/ (source files - some APIs may need them)
# - components/ (if used)
# - lib/ (if used)

tar -czf "$TARBALL" \
    .next/ \
    public/ \
    package.json \
    package-lock.json \
    next.config.js \
    tsconfig.json \
    .env.production \
    mcp-config.json \
    .mcp.json \
    src/ \
    components/ \
    lib/ \
    2>/dev/null || {
    echo "⚠️  Some optional directories not found, continuing..."
    tar -czf "$TARBALL" \
        .next/ \
        public/ \
        package.json \
        package-lock.json \
        next.config.js \
        tsconfig.json \
        .env.production \
        mcp-config.json \
        .mcp.json
}

TARBALL_SIZE=$(du -h "$TARBALL" | awk '{print $1}')
echo "✅ Deployment package created: $TARBALL_SIZE"
echo ""

# Step 3: Test SSH connection
echo "🔑 Step 3: Testing SSH connection..."
if ssh -i "$PEM_FILE" -o StrictHostKeyChecking=no -o ConnectTimeout=10 "$EC2_USER@$EC2_HOST" "echo 'SSH OK'" 2>/dev/null; then
    echo "✅ SSH connection successful"
else
    echo "❌ SSH connection failed!"
    exit 1
fi
echo ""

# Step 4: Prepare remote server
echo "📁 Step 4: Preparing remote server..."
ssh -i "$PEM_FILE" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_HOST" "
    # Stop existing app if running
    pm2 stop signal-noise-app 2>/dev/null || true
    pm2 delete signal-noise-app 2>/dev/null || true
    
    # Create directory
    mkdir -p $REMOTE_DIR
    cd $REMOTE_DIR
    
    # Backup existing files (if any)
    if [ -f package.json ]; then
        mkdir -p ../signal-noise-app-backup
        mv * ../signal-noise-app-backup/ 2>/dev/null || true
    fi
"

echo "✅ Remote directory prepared"
echo ""

# Step 5: Upload deployment package
echo "📤 Step 5: Uploading deployment package..."
scp -i "$PEM_FILE" -o StrictHostKeyChecking=no "$TARBALL" "$EC2_USER@$EC2_HOST:/tmp/deploy.tar.gz"

echo "✅ Package uploaded"
echo ""

# Step 6: Extract and setup on remote
echo "🛠️  Step 6: Setting up application on server..."
ssh -i "$PEM_FILE" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_HOST" "
    set -e
    cd $REMOTE_DIR
    
    # Extract package
    echo '   Extracting files...'
    tar -xzf /tmp/deploy.tar.gz
    rm /tmp/deploy.tar.gz
    
    # Install/Update Node.js if needed
    if ! command -v node &> /dev/null || [ \"\$(node --version | cut -d'v' -f2 | cut -d'.' -f1)\" -lt \"$NODE_VERSION\" ]; then
        echo '   Installing Node.js $NODE_VERSION...'
        curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
    
    NODE_VERSION_INSTALLED=\$(node --version)
    echo \"   ✅ Node.js version: \$NODE_VERSION_INSTALLED\"
    
    # Install PM2 globally if needed
    if ! command -v pm2 &> /dev/null; then
        echo '   Installing PM2...'
        sudo npm install -g pm2
    fi
    
    # Install production dependencies only (since .next is already built)
    echo '   Installing dependencies...'
    npm install --production --no-optional
    
    # Copy environment file
    if [ -f .env.production ]; then
        cp .env.production .env.local
        echo '   ✅ Environment file configured'
    fi
    
    # Create PM2 ecosystem config
    echo '   Creating PM2 configuration...'
    cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'signal-noise-app',
    script: 'npm',
    args: 'start',
    cwd: '/home/ubuntu/signal-noise-app',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: $PORT
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
EOF
    
    # Create logs directory
    mkdir -p logs
    
    # Setup firewall rule
    echo '   Configuring firewall...'
    sudo ufw allow $PORT/tcp 2>/dev/null || echo '   ⚠️  UFW not available or already configured'
    
    echo '   ✅ Server setup completed'
"

echo ""
echo "✅ Server setup completed"
echo ""

# Step 7: Start application
echo "🚀 Step 7: Starting application..."
ssh -i "$PEM_FILE" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_HOST" "
    cd $REMOTE_DIR
    
    # Start with PM2
    pm2 start ecosystem.config.js
    pm2 save
    
    # Setup PM2 to start on boot
    pm2 startup | tail -n 1 | sudo bash 2>/dev/null || echo '   ⚠️  PM2 startup already configured'
    
    # Wait a moment for app to start
    sleep 3
    
    # Check status
    pm2 status
"

echo ""
echo "✅ Application started"
echo ""

# Step 8: Verify deployment
echo "🔍 Step 8: Verifying deployment..."
sleep 2

HTTP_CODE=$(ssh -i "$PEM_FILE" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_HOST" "curl -s -o /dev/null -w '%{http_code}' http://localhost:$PORT" || echo "000")

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "404" ]; then
    echo "✅ Application is responding (HTTP $HTTP_CODE)"
    echo ""
    echo "🎉 Deployment completed successfully!"
    echo ""
    echo "📍 Access your application at:"
    echo "   http://$EC2_HOST:$PORT"
    echo ""
    echo "📊 Monitor with:"
    echo "   ssh -i $PEM_FILE $EC2_USER@$EC2_HOST 'pm2 logs signal-noise-app'"
    echo ""
else
    echo "⚠️  Application may not be responding yet (HTTP $HTTP_CODE)"
    echo "   Check logs: ssh -i $PEM_FILE $EC2_USER@$EC2_HOST 'pm2 logs signal-noise-app'"
    echo ""
fi

# Cleanup
rm -f "$TARBALL"
echo "🧹 Local cleanup completed"
