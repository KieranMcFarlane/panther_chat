#!/bin/bash

# Simple AWS EC2 Deployment Script
set -e

EC2_USER="ec2-user"
EC2_HOST="13.60.60.50"
PEM_FILE="/Users/kieranmcfarlane/Downloads/panther_chat/yellowpanther.pem"
LOCAL_DIR="/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app"

echo "🚀 Quick deploy to AWS EC2: $EC2_HOST"

# Create a minimal deployment package
echo "📦 Creating deployment package..."
cd "$LOCAL_DIR"

# Create a tarball with essential files only
tar -czf deployment.tar.gz \
  --exclude=node_modules \
  --exclude=.next \
  --exclude=.git \
  --exclude=*.disabled \
  --exclude=*.log \
  --exclude=venv-* \
  --exclude=backend \
  .

# Copy the tarball to EC2
echo "📤 Uploading deployment package..."
scp -i "$PEM_FILE" -o ConnectTimeout=30 deployment.tar.gz "$EC2_USER@$EC2_HOST:/tmp/"

# Extract and deploy on EC2
echo "🛠️ Deploying on remote server..."
ssh -i "$PEM_FILE" -o ConnectTimeout=30 "$EC2_USER@$EC2_HOST" << 'DEPLOY_EOF'
cd /tmp
tar -xzf deployment.tar.gz
rm -rf /home/ec2-user/signal-noise-app
mkdir -p /home/ec2-user/signal-noise-app
mv * /home/ec2-user/signal-noise-app/
cd /home/ec2-user/signal-noise-app

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Build if needed
if [ ! -d ".next" ]; then
    echo "Building application..."
    npm run build
fi

# Start with PM2
if command -v pm2 &> /dev/null; then
    echo "Starting with PM2..."
    pm2 stop signal-noise-app || true
    pm2 delete signal-noise-app || true
    pm2 start "npm start" --name signal-noise-app
    pm2 save
else
    echo "Starting with nohup..."
    nohup npm start > app.log 2>&1 &
fi

echo "✅ Deployment completed!"
DEPLOY_EOF

# Clean up local tarball
rm -f deployment.tar.gz

echo "🌐 Application should be available at: http://13.60.60.50:3000"
