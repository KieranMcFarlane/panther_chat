#!/bin/bash
# Quick deployment script for Hetzner server
# Server: 46.62.243.243
# User: ubuntu

SERVER="ubuntu@46.62.243.243"
LOCAL_DIR="/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app"
TARBALL="/tmp/signal-noise-app-deploy.tar.gz"
REMOTE_DIR="/home/ubuntu/signal-noise-app"
PORT="4328"

echo "🚀 Deploying to Hetzner Server: 46.62.243.243"
echo ""

# Check if package exists, if not create it
if [ ! -f "$TARBALL" ]; then
    echo "📦 Creating deployment package..."
    cd "$LOCAL_DIR"
    npm run build
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
        lib/ 2>/dev/null || true
fi

echo "📤 Uploading package (you may need to enter password)..."
scp -o StrictHostKeyChecking=no "$TARBALL" "$SERVER:/tmp/deploy.tar.gz"

echo "🛠️ Setting up on server (you may need to enter password)..."
ssh -o StrictHostKeyChecking=no "$SERVER" << 'EOF'
cd ~
mkdir -p signal-noise-app
cd signal-noise-app
tar -xzf /tmp/deploy.tar.gz
rm /tmp/deploy.tar.gz

# Install Node.js if needed
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Install PM2
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
fi

# Install dependencies
npm install --production

# Copy env
cp .env.production .env.local 2>/dev/null || true

# Create PM2 config
cat > ecosystem.config.js << 'PM2EOF'
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
      PORT: 4328
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
PM2EOF

mkdir -p logs

# Start app
pm2 stop signal-noise-app 2>/dev/null || true
pm2 delete signal-noise-app 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup | tail -n 1 | sudo bash 2>/dev/null || true

# Open firewall
sudo ufw allow 4328/tcp 2>/dev/null || true

echo "✅ Deployment complete!"
pm2 status
EOF

echo ""
echo "🎉 Deployment finished!"
echo "📍 Access at: http://46.62.243.243:4328"
