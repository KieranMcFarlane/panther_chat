#!/bin/bash

# Yellow Panther AI Frontend Deployment Script
# Deploys to 212.86.105.190:3005

echo "🐆 Yellow Panther AI - Frontend Deployment"
echo "=========================================="

SERVER="212.86.105.190"
PORT="3005"
REMOTE_DIR="/var/www/yellow-panther-frontend"
LOCAL_DIR="."

echo "📦 Preparing deployment package..."

# Create a temporary directory for deployment files
TEMP_DIR=$(mktemp -d)
echo "Using temporary directory: $TEMP_DIR"

# Copy essential files
echo "Copying frontend files..."
cp -r src/ $TEMP_DIR/
cp -r public/ $TEMP_DIR/ 2>/dev/null || echo "No public directory found"
cp package.json $TEMP_DIR/
cp package-lock.json $TEMP_DIR/ 2>/dev/null || echo "No package-lock.json found"
cp next.config.js $TEMP_DIR/ 2>/dev/null || echo "No next.config.js found"
cp tailwind.config.js $TEMP_DIR/ 2>/dev/null || echo "No tailwind.config.js found"
cp tsconfig.json $TEMP_DIR/ 2>/dev/null || echo "No tsconfig.json found"
cp .env.local $TEMP_DIR/ 2>/dev/null || echo "No .env.local found"
cp .env $TEMP_DIR/ 2>/dev/null || echo "No .env found"

# Create deployment commands
cat > $TEMP_DIR/deploy.sh << 'EOF'
#!/bin/bash
echo "🚀 Setting up Yellow Panther AI Frontend..."

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the application
echo "🔨 Building application..."
npm run build

# Install PM2 if not already installed
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2..."
    npm install -g pm2
fi

# Create PM2 ecosystem file
cat > ecosystem.config.js << 'EOFPM2'
module.exports = {
  apps: [{
    name: 'yellow-panther-frontend',
    script: 'npm',
    args: 'start',
    cwd: '/var/www/yellow-panther-frontend',
    env: {
      NODE_ENV: 'production',
      PORT: 3005
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    log_file: './logs/app.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
}
EOFPM2

# Create logs directory
mkdir -p logs

# Stop existing process if running
pm2 stop yellow-panther-frontend 2>/dev/null || echo "No existing process to stop"
pm2 delete yellow-panther-frontend 2>/dev/null || echo "No existing process to delete"

# Start the application
echo "🚀 Starting Yellow Panther AI Frontend on port 3005..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup

echo "✅ Deployment complete!"
echo "🌐 Frontend should be available at: http://212.86.105.190:3005"
echo "📊 Check status with: pm2 status"
echo "📋 View logs with: pm2 logs yellow-panther-frontend"
EOF

chmod +x $TEMP_DIR/deploy.sh

echo "🚀 Uploading to server..."
echo "Server: $SERVER"
echo "Target directory: $REMOTE_DIR"

# Upload files via SCP
echo "Uploading files..."
scp -r $TEMP_DIR/* root@$SERVER:$REMOTE_DIR/

echo "🔧 Executing deployment on server..."
ssh root@$SERVER "cd $REMOTE_DIR && chmod +x deploy.sh && ./deploy.sh"

# Cleanup
rm -rf $TEMP_DIR

echo ""
echo "🎉 Deployment Summary"
echo "===================="
echo "✅ Frontend deployed to: http://$SERVER:$PORT"
echo "📁 Remote directory: $REMOTE_DIR"
echo "🔍 Check deployment: ssh root@$SERVER 'pm2 status'"
echo ""
echo "🐆 Yellow Panther AI Sports Tender Discovery is now live!"
echo "Features deployed:"
echo "  • Sports Tender Discovery Dashboard"
echo "  • Intelligence & Analytics Hub Navigation"
echo "  • Premier League Intelligence Integration"
echo "  • Admin Dashboard Links"
echo "  • LinkedIn Network Analytics Access"
echo "  • Global Sports Database Navigation" 