#!/bin/bash

# Manual Deployment Instructions for Signal Noise App on Port 7668
# Use this script if SSH connection to EC2 is not working

echo "📦 Creating deployment package for manual upload..."

# Create deployment package directory
DEPLOY_DIR="/tmp/signal-noise-deploy-7668"
rm -rf "$DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR"

# Copy all necessary files
cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app

# Copy application files (excluding large directories)
rsync -av --exclude=node_modules --exclude=.next --exclude=.git \
  --exclude=*.disabled --exclude=*.log --exclude=venv-* \
  --exclude=backend --exclude=*.pid --exclude='.DS_Store' \
  . "$DEPLOY_DIR/"

# Create deployment script for EC2
cat > "$DEPLOY_DIR/deploy-on-ec2.sh" << 'EOF'
#!/bin/bash

# Run this script on the EC2 instance to deploy the application
set -e

echo "🚀 Starting deployment on EC2 for port 7668..."

# Check if running as ec2-user
if [ "$EUID" -eq 0 ]; then
    echo "❌ Please run as ec2-user, not root"
    exit 1
fi

# Kill existing processes
echo "🔄 Stopping existing processes..."
sudo pkill -f "node.*next" || true
sudo pkill -f "npm.*start" || true
sudo pkill -f pm2 || true
sleep 2

# Kill processes on specific ports
sudo lsof -ti:3000 | xargs sudo kill -9 || true
sudo lsof -ti:8001 | xargs sudo kill -9 || true
sudo lsof -ti:7668 | xargs sudo kill -9 || true

# Clean up old deployment
echo "🧹 Cleaning up old deployment..."
sudo rm -rf /home/ec2-user/signal-noise-app
sudo mkdir -p /home/ec2-user/signal-noise-app
sudo chown ec2-user:ec2-user /home/ec2-user/signal-noise-app

# Move files to deployment directory
echo "📁 Moving files to deployment directory..."
cp -r * /home/ec2-user/signal-noise-app/
cd /home/ec2-user/signal-noise-app

# Install Node.js if not present
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build application
echo "🏗️ Building application..."
npm run build

# Create systemd service
echo "⚙️ Creating systemd service..."
sudo tee /etc/systemd/system/signal-noise-app.service > /dev/null << 'SERVICE_EOF'
[Unit]
Description=Signal Noise App
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/home/ec2-user/signal-noise-app
Environment=NODE_ENV=production
Environment=PORT=7668
Environment=HOSTNAME=0.0.0.0
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
SERVICE_EOF

# Start the service
echo "🚀 Starting the service..."
sudo systemctl daemon-reload
sudo systemctl enable signal-noise-app
sudo systemctl start signal-noise-app

# Configure firewall
echo "🔥 Configuring firewall..."
if command -v ufw &> /dev/null; then
    sudo ufw --force reset
    sudo ufw allow ssh
    sudo ufw allow 7668
    sudo ufw --force enable
elif command -v firewall-cmd &> /dev/null; then
    sudo firewall-cmd --permanent --add-port=7668/tcp
    sudo firewall-cmd --reload
else
    sudo iptables -C INPUT -p tcp --dport 7668 -j ACCEPT || sudo iptables -I INPUT -p tcp --dport 7668 -j ACCEPT
fi

# Show status
echo "📊 Service status:"
sudo systemctl status signal-noise-app --no-pager

echo "✅ Deployment completed!"
echo "🌐 Application should be available at: http://13.60.60.50:7668"
echo ""
echo "To check status: sudo systemctl status signal-noise-app"
echo "To view logs: sudo journalctl -u signal-noise-app -f"
echo "To restart: sudo systemctl restart signal-noise-app"
EOF

chmod +x "$DEPLOY_DIR/deploy-on-ec2.sh"

# Create README with instructions
cat > "$DEPLOY_DIR/README.md" << 'EOF'
# Signal Noise App Deployment - Port 7668

## Quick Deployment Steps

1. **Upload this entire directory to EC2:**
   ```bash
   # From your local machine (when SSH is working)
   scp -i your-key.pem -r /tmp/signal-noise-deploy-7668/* ec2-user@13.60.60.50:/home/ec2-user/
   ```

2. **Run the deployment script on EC2:**
   ```bash
   # SSH into EC2
   ssh -i your-key.pem ec2-user@13.60.60.50
   
   # Navigate to the files and run deployment
   cd /home/ec2-user
   chmod +x deploy-on-ec2.sh
   ./deploy-on-ec2.sh
   ```

3. **Access your application:**
   URL: http://13.60.60.50:7668

## What's Configured

- **Port**: 7668 (as requested)
- **Process**: Systemd service with auto-restart
- **Firewall**: Port 7668 opened
- **Environment**: Production configuration

## Service Management Commands

```bash
# Check status
sudo systemctl status signal-noise-app

# View logs
sudo journalctl -u signal-noise-app -f

# Restart service
sudo systemctl restart signal-noise-app

# Stop service
sudo systemctl stop signal-noise-app
```

## Features Deployed

- ✅ Fixed tab functionality for entity pages
- ✅ Sports Intelligence Dashboard
- ✅ RFP Intelligence System  
- ✅ Entity Browser with search
- ✅ AI-powered analysis
- ✅ Knowledge graph integration
- ✅ Real-time notifications

## Troubleshooting

If port 7668 is not accessible:
1. Check service status: `sudo systemctl status signal-noise-app`
2. Check firewall rules: `sudo ufw status` or `sudo iptables -L`
3. View logs: `sudo journalctl -u signal-noise-app -f`
4. Ensure AWS security group allows port 7668
EOF

echo "✅ Deployment package created at: $DEPLOY_DIR"
echo "📋 When SSH connection is restored, upload the package to EC2 and run deploy-on-ec2.sh"
echo "🌐 The application will run on: http://13.60.60.50:7668"