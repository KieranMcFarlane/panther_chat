#!/bin/bash

# 🚀 Production Deployment Guide - Level 3 Autonomous RFP System
# Server: 13.60.60.50 | User: kieranmcfarlane

echo "🚀 Production Deployment Guide"
echo "=========================="
echo "Server: 13.60.60.50"
echo "System: Level 3 Autonomous RFP Intelligence"
echo ""

# Create a comprehensive deployment script that can be run on the server
cat << 'EOF' > /tmp/deploy-production.sh

#!/bin/bash

# Production Deployment Script for Level 3 Autonomous RFP System
# Run this on the server: 13.60.60.50

set -e  # Exit on any error

echo "🚀 Starting Production Deployment"
echo "=============================="
echo "Time: $(date)"
echo "Server: $(hostname)"
echo "User: $(whoami)"
echo ""

# System Update
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js (if not installed)
echo "🟢 Installing Node.js..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "Node.js already installed: $(node --version)"
fi

# Install PM2 (Process Manager)
echo "🔧 Installing PM2..."
sudo npm install -g pm2

# Create application directory
echo "📁 Creating application directory..."
sudo mkdir -p /opt/rfp-autonomous
sudo chown kieranmcfarlane:kieranmcfarlane /opt/rfp-autonomous
cd /opt/rfp-autonomous

# Clone repository (you'll need to set this up)
echo "📥 Setting up application files..."
# Note: You'll need to copy your files here or set up git

# Install dependencies
echo "📦 Installing application dependencies..."
npm install

# Build application
echo "🔨 Building application..."
npm run build

# Environment Configuration
echo "⚙️ Setting up environment variables..."
cat << ENVEOF > .env.production
NODE_ENV=production
PORT=3000
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=$(openssl rand -base64 32)

# Claude Agent SDK
ANTHROPIC_API_KEY=your-anthropic-api-key
ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-supabase-key

# Neo4j
NEO4J_URI=neo4j+s://your-neo4j-instance
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-neo4j-password

# MCP Tools
BRIGHTDATA_API_TOKEN=your-brightdata-token
PERPLEXITY_API_KEY=your-perplexity-key

# AWS (if needed)
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-s3-bucket

# Database
DATABASE_URL=your-database-url

# Security
NEXTAUTH_SECRET=$(openssl rand -base64 32)
BRIGHTDATA_WEBHOOK_SECRET=$(openssl rand -base64 32)
ENVEOF

echo "🔐 Environment file created at .env.production"
echo "⚠️  IMPORTANT: Update the environment variables with your actual values!"

# PM2 Configuration
echo "📋 Setting up PM2 configuration..."
cat << PM2EOF > ecosystem.config.js
module.exports = {
  apps: [{
    name: 'rfp-autonomous',
    script: 'npm',
    args: 'start',
    cwd: '/opt/rfp-autonomous',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    instances: 2,
    exec_mode: 'cluster',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env_file: '.env.production',
    log_file: '/var/log/rfp-autonomous.log',
    out_file: '/var/log/rfp-autonomous-out.log',
    error_file: '/var/log/rfp-autonomous-error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true
  }]
};
PM2EOF

# Create log directory
echo "📝 Creating log directory..."
sudo mkdir -p /var/log
sudo chown kieranmcfarlane:kieranmcfarlane /var/log/rfp-autonomous*.log

# Setup firewall
echo "🔥 Setting up firewall..."
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3000/tcp
sudo ufw --force enable

# Setup Nginx (if you want reverse proxy)
echo "🌐 Setting up Nginx reverse proxy..."
sudo apt install -y nginx

cat << NGINXEOF > /tmp/rfp-autonomous-nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
NGINXEOF

# Save Nginx config for later
echo "📄 Nginx configuration saved to /tmp/rfp-autonomous-nginx"
echo "   To enable: sudo cp /tmp/rfp-autonomous-nginx /etc/nginx/sites-available/rfp-autonomous"
echo "   Then: sudo ln -s /etc/nginx/sites-available/rfp-autonomous /etc/nginx/sites-enabled/"
echo "   Finally: sudo nginx -t && sudo systemctl restart nginx"

# Setup SSL with Let's Encrypt (optional)
echo "🔒 SSL Setup (Let's Encrypt)..."
echo "   To enable SSL later:"
echo "   sudo apt install certbot python3-certbot-nginx"
echo "   sudo certbot --nginx -d your-domain.com"

# Start application with PM2
echo "🚀 Starting application..."
pm2 start ecosystem.config.js

# Save PM2 configuration
echo "💾 Saving PM2 configuration..."
pm2 save

# Setup PM2 startup
echo "🔄 Setting up PM2 startup..."
pm2 startup | tail -n 1
echo "   Run the command above as root to enable PM2 startup"

# Health check
echo "🏥 Running health check..."
sleep 10

if curl -f http://localhost:3000 > /dev/null; then
    echo "✅ Application is running on port 3000"
else
    echo "❌ Application failed to start"
    echo "Check logs: pm2 logs rfp-autonomous"
fi

echo ""
echo "🎉 Deployment Complete!"
echo "===================="
echo "Application URL: http://your-domain.com"
echo "Application URL (local): http://localhost:3000"
echo ""
echo "Management Commands:"
echo "  pm2 status                 - Check application status"
echo "  pm2 logs rfp-autonomous     - View application logs"
echo "  pm2 restart rfp-autonomous  - Restart application"
echo "  pm2 stop rfp-autonomous     - Stop application"
echo ""
echo "Monitoring:"
echo "  tail -f /var/log/rfp-autonomous.log    - Application logs"
echo "  sudo nginx -t                             - Test Nginx config"
echo "  sudo systemctl status nginx               - Check Nginx status"
echo ""
echo "Next Steps:"
echo "1. Update environment variables in .env.production"
echo "2. Configure your domain DNS to point to 13.60.60.50"
echo "3. Set up SSL certificate"
echo "4. Configure MCP servers (Neo4j, BrightData, Perplexity)"
echo "5. Initialize autonomous discovery workflow"
echo ""
echo "Verification:"
echo "1. curl http://localhost:3000/api/verification?check=all"
echo "2. Visit: http://your-domain.com/level3-autonomous"
echo "3. Monitor: pm2 monit"
echo ""

# Show system status
echo "📊 System Status:"
echo "Node.js: $(node --version)"
echo "NPM: $(npm --version)"
echo "PM2: $(pm2 --version)"
echo "Memory: $(free -h | grep '^Mem:' | awk '{print $3 "/" $2}')"
echo "Disk: $(df -h / | tail -1 | awk '{print $4 " / " $2}')"

EOF

echo "📋 Deployment script created at /tmp/deploy-production.sh"
echo ""
echo "🚀 To deploy to production server:"
echo ""
echo "1. Copy files to server:"
echo "   scp -i /Users/kieranmcfarlane/Downloads/panther_chat/yellowpanther.pem \\"
echo "      /tmp/deploy-production.sh kieranmcfarlane@13.60.60.50:/tmp/"
echo ""
echo "2. Connect to server:"
echo "   ssh -i /Users/kieranmcfarlane/Downloads/panther_chat/yellowpanther.pem kieranmcfarlane@13.60.60.50"
echo ""
echo "3. Run deployment:"
echo "   chmod +x /tmp/deploy-production.sh"
echo "   /tmp/deploy-production.sh"
echo ""
echo "4. Monitor deployment:"
echo "   pm2 logs rfp-autonomous"
echo "   curl http://localhost:3000/api/verification?check=all"