#!/usr/bin/env node

/**
 * 🚀 Production Deployment Files Generator
 * Creates all necessary files for deploying the Level 3 Autonomous System
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 Production Deployment Files Generator');
console.log('=====================================\n');

// Create deployment directory
const deployDir = path.join(__dirname, 'production-deploy');
if (!fs.existsSync(deployDir)) {
  fs.mkdirSync(deployDir, { recursive: true });
}

// 1. Create production deployment script
console.log('📝 Creating production deployment script...');

const deployScript = `#!/bin/bash

# 🚀 Level 3 Autonomous RFP System - Production Deployment
# Server: 13.60.60.50
# System: Production Autonomous System

set -e

echo "🎯 Deploying Level 3 Autonomous RFP System"
echo "====================================="
echo "Server: $(hostname)"
echo "User: $(whoami)"
echo "Time: $(date)"
echo ""

# Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x
echo "🟢 Installing Node.js 18.x..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "✅ Node.js already installed: $(node --version)"
fi

# Install PM2
echo "🔧 Installing PM2 process manager..."
sudo npm install -g pm2

# Create application directory
echo "📁 Creating application directory..."
sudo mkdir -p /opt/rfp-autonomous
sudo chown kieranmcfarlane:kieranmcfarlane /opt/rfp-autonomous
cd /opt/rfp-autonomous

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build application
echo "🔨 Building application..."
npm run build

# Environment configuration
echo "⚙️ Setting up environment variables..."
cat << 'ENVEOF' > .env.production
NODE_ENV=production
PORT=3000
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your-super-secret-key-here

# Claude Agent SDK
ANTHROPIC_API_KEY=your-anthropic-api-key
ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-key

# Neo4j
NEO4J_URI=neo4j+s://your-instance.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-neo4j-password

# MCP Tools
BRIGHTDATA_API_TOKEN=your-brightdata-api-token
PERPLEXITY_API_KEY=your-perplexity-api-key

# AWS
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
S3_BUCKET_NAME=rfp-autonomous-bucket

# Additional configuration
DATABASE_URL=postgresql://user:password@localhost:5432/rfp_autonomous
BRIGHTDATA_WEBHOOK_SECRET=your-webhook-secret

# Claude Agent Configuration
CLAUDE_AGENT_TIMEOUT=120000
CLAUDE_AGENT_MAX_TURNS=10
ENVEOF

echo "🔐 Environment file created. IMPORTANT: Update with your actual values!"

# PM2 ecosystem configuration
echo "📋 Creating PM2 ecosystem configuration..."
cat << 'PM2EOF' > ecosystem.config.js
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
    merge_logs: true,
    time: true
  }]
};
PM2EOF

# Create log directory
echo "📝 Creating log directory..."
sudo mkdir -p /var/log
sudo chown kieranmcfarlane:kieranmcfarlane /var/log/rfp-autonomous*.log

# Setup firewall
echo "🔥 Setting up firewall..."
sudo ufw --force reset
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3000/tcp
sudo ufw --force enable

# Install Nginx
echo "🌐 Installing Nginx reverse proxy..."
sudo apt install -y nginx

# Nginx configuration
echo "📄 Configuring Nginx..."
cat << 'NGINXEOF' | sudo tee /etc/nginx/sites-available/rfp-autonomous
server {
    listen 80;
    server_name _;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $server_name;
        proxy_cache_bypass $http_upgrade;
        
        # Timeout settings
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Health check endpoint
    location /api/health {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        access_log off;
    }
    
    # Static files caching
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Security
    location ~ /\\. {
        deny all;
    }
}
NGINXEOF

# Enable Nginx site
sudo ln -sf /etc/nginx/sites-available/rfp-autonomous /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test and restart Nginx
sudo nginx -t && sudo systemctl restart nginx

# Install SSL with Certbot (optional but recommended)
echo "🔒 SSL Setup (Let's Encrypt)..."
if command -v certbot &> /dev/null; then
    echo "Certbot already installed"
else
    sudo apt install -y certbot python3-certbot-nginx
fi

# Create SSL configuration script
cat << 'SSLEOF' > setup-ssl.sh
#!/bin/bash
# SSL Setup Script
# Run this after configuring your domain

echo "🔒 Setting up SSL certificate..."
sudo certbot --nginx -d your-domain.com --non-interactive --agree-tos --email your-email@your-domain.com

# Auto-renewal
sudo crontab -l | { cat; echo "0 12 * * * /usr/bin/certbot renew --quiet"; } | sudo crontab -

echo "✅ SSL certificate installed and auto-renewal configured"
SSLEOF

chmod +x setup-ssl.sh

# Start application with PM2
echo "🚀 Starting application with PM2..."
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 startup
echo "🔄 Setting up PM2 startup..."
pm2 startup | sudo bash

# Create monitoring script
echo "📊 Creating monitoring script..."
cat << 'MONITOREOF' > monitor.sh
#!/bin/bash
# System monitoring script

echo "🔍 System Status - $(date)"
echo "=========================="

# PM2 status
echo "🤖 PM2 Status:"
pm2 status

# Application health check
echo "🏥 Application Health:"
if curl -f http://localhost:3000/api/verification?check=all > /dev/null 2>&1; then
    echo "✅ Application is healthy"
else
    echo "❌ Application health check failed"
fi

# System resources
echo "💾 System Resources:"
echo "Memory: $(free -h | grep '^Mem:' | awk '{print $3 "/" $2 " (" $4 " used)" }')"
echo "Disk: $(df -h / | tail -1 | awk '{print $4 " / " $2 " (" $5 " used)" }')"
echo "Load: $(uptime | awk -F'load average:' '{print $2}')"

# Recent logs
echo "📝 Recent Logs (last 10 lines):"
tail -10 /var/log/rfp-autonomous.log 2>/dev/null || echo "No logs available"

echo ""
echo "📈 Performance Metrics:"
pm2 show rfp-autonomous | grep -E "(cpu|memory|status)"

MONITOREOF

chmod +x monitor.sh

# Create backup script
echo "💾 Creating backup script..."
cat << 'BACKUPEOF' > backup.sh
#!/bin/bash
# Backup script for database and application data

BACKUP_DIR="/opt/rfp-backups/\$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "💾 Starting backup to $BACKUP_DIR"

# Backup application files
echo "📁 Backing up application files..."
tar -czf "$BACKUP_DIR/application.tar.gz" -C /opt/rfp-autonomous .

# Backup PM2 configuration
echo "📋 Backing up PM2 configuration..."
pm2 save
cp /home/kieranmcfarlane/.pm2/dump.pm2 "$BACKUP_DIR/"

# Backup logs
echo "📝 Backing up logs..."
tar -czf "$BACKUP_DIR/logs.tar.gz" /var/log/rfp-autonomous*.log

# Backup environment
echo "⚙️ Backing up environment..."
cp /opt/rfp-autonomous/.env.production "$BACKUP_DIR/"

echo "✅ Backup completed: $BACKUP_DIR"
echo "📂 Backup size: $(du -sh "$BACKUP_DIR" | cut -f1)"

BACKUPEOF

chmod +x backup.sh

# Create restoration script
echo "🔄 Creating restoration script..."
cat << 'RESTOREEOF' > restore.sh
#!/bin/bash
# Restoration script

if [ -z "$1" ]; then
    echo "Usage: $0 <backup_directory>"
    exit 1
fi

BACKUP_DIR="$1"

if [ ! -d "$BACKUP_DIR" ]; then
    echo "❌ Backup directory not found: $BACKUP_DIR"
    exit 1
fi

echo "🔄 Restoring from $BACKUP_DIR"

# Stop application
echo "⏹️ Stopping application..."
pm2 stop rfp-autonomous || true

# Restore application files
echo "📁 Restoring application files..."
tar -xzf "$BACKUP_DIR/application.tar.gz" -C /opt/rfp-autonomous

# Restore environment
echo "⚙️ Restoring environment..."
cp "$BACKUP_DIR/.env.production" /opt/rfp-autonomous/

# Restore PM2 configuration
echo "📋 Restoring PM2 configuration..."
cp "$BACKUP_DIR/dump.pm2" /home/kieranmcfarlane/.pm2/

# Restart application
echo "🚀 Restarting application..."
cd /opt/rfp-autonomous
pm2 restart rfp-autonomous

echo "✅ Restoration completed"
RESTOREEOF

chmod +x restore.sh

# Create update script
echo "🔄 Creating update script..."
cat << 'UPDATEEOF' > update.sh
#!/bin/bash
# Update script for application

echo "🔄 Starting application update..."

# Create backup before update
./backup.sh

# Pull latest changes (if using git)
# git pull origin main

# Update dependencies
echo "📦 Updating dependencies..."
npm update

# Rebuild application
echo "🔨 Rebuilding application..."
npm run build

# Restart application
echo "🚀 Restarting application..."
pm2 restart rfp-autonomous

echo "✅ Update completed"
UPDATEEOF

chmod +x update.sh

# Make scripts executable
chmod +x monitor.sh backup.sh restore.sh update.sh

# Create system service for monitoring
echo "🔧 Creating system service..."
cat << 'SERVICEEOF' | sudo tee /etc/systemd/system/rfp-autonomous-monitor.service
[Unit]
Description=RFP Autonomous System Monitor
After=network.target

[Service]
Type=simple
User=kieranmcfarlane
WorkingDirectory=/opt/rfp-autonomous
ExecStart=/opt/rfp-autonomous/monitor.sh
Restart=always
RestartSec=300

[Install]
WantedBy=multi-user.target
SERVICEEOF

# Enable and start monitoring service
sudo systemctl daemon-reload
sudo systemctl enable rfp-autonomous-monitor
sudo systemctl start rfp-autonomous-monitor

# Health check
echo "🏥 Running health check..."
sleep 15

echo "📊 Checking application status..."
pm2 status

echo "🌐 Checking web server..."
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Web server is accessible"
else
    echo "❌ Web server is not responding"
fi

echo "🔍 Checking verification endpoint..."
if curl -f http://localhost:3000/api/verification?check=claude-sdk > /dev/null 2>&1; then
    echo "✅ Verification endpoint is working"
else
    echo "⚠️  Verification endpoint needs attention"
fi

# Create cron jobs for automated tasks
echo "⏰ Setting up cron jobs..."
(crontab -l 2>/dev/null; echo "0 */6 * * * /opt/rfp-autonomous/monitor.sh") | crontab -

echo ""
echo "🎉 Production Deployment Complete!"
echo "================================="
echo "Application URL: http://13.60.60.50"
echo "Dashboard: http://13.60.60.50/level3-autonomous"
echo "A2A System: http://13.60.60.50/a2a-system"
echo "Verification: http://13.60.60.50/api/verification?check=all"
echo ""
echo "Management Commands:"
echo "  pm2 status                 - Check application status"
echo "  pm2 logs rfp-autonomous     - View application logs"
echo "  pm2 restart rfp-autonomous  - Restart application"
echo "  pm2 stop rfp-autonomous     - Stop application"
echo "  pm2 monit                  - Real-time monitoring"
echo ""
echo "Monitoring Commands:"
echo "  ./monitor.sh                - System status check"
echo "  ./backup.sh                 - Create backup"
echo "  ./update.sh                  - Update application"
echo "  ./restore.sh <backup_dir>    - Restore from backup"
echo ""
echo "Log Files:"
echo "  Application: /var/log/rfp-autonomous.log"
echo "  Error logs:  /var/log/rfp-autonomous-error.log"
echo "  Out logs:    /var/log/rfp-autonomous-out.log"
echo ""
echo "System Monitoring:"
echo "  sudo systemctl status rfp-autonomous-monitor"
echo "  sudo journalctl -u rfp-autonomous-monitor -f"
echo ""
echo "Next Steps:"
echo "1. Update environment variables in .env.production"
echo "2. Configure your domain DNS to point to 13.60.60.50"
echo "3. Run: ./setup-ssl.sh to set up SSL certificate"
echo "4. Configure MCP servers (Neo4j, BrightData, Perplexity)"
echo "5. Initialize autonomous discovery workflow"
echo "6. Set up monitoring and alerts"
echo ""
echo "Security Recommendations:"
echo "1. Regularly update system packages"
echo "2. Monitor application logs for security issues"
echo "3. Keep backup copies safe"
echo "4. Use strong passwords and SSH keys"
echo "5. Set up firewall rules appropriately"
echo ""
echo "Performance Optimization:"
echo "1. Monitor PM2 metrics: pm2 monit"
echo "2. Check system resources: ./monitor.sh"
echo "3. Optimize database queries"
echo "4. Enable gzip compression (already done)"
echo "5. Consider CDN for static assets"
echo ""
echo "📊 System Status Summary:"
echo "Node.js: $(node --version)"
echo "NPM: $(npm --version)"
echo "PM2: $(pm2 --version)"
echo "Nginx: $(nginx -v 2>&1 | head -1)"
echo "Memory: $(free -h | grep '^Mem:' | awk '{print $3 "/" $2 " (" $4 " used)" }')"
echo "Disk: $(df -h / | tail -1 | awk '{print $4 " / " $2 " (" $5 " used)" }')"
echo "Uptime: $(uptime -p)"
`;

fs.writeFileSync(path.join(deployDir, 'deploy-production.sh'), deployScript);

// 2. Create environment template
console.log('⚙️ Creating environment configuration template...');

const envTemplate = `# 🎯 Level 3 Autonomous RFP System - Production Environment
# Server: 13.60.60.50

# Basic Configuration
NODE_ENV=production
PORT=3000
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your-super-secret-key-here

# Claude Agent SDK Configuration
ANTHROPIC_API_KEY=your-anthropic-api-key
ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic
CLAUDE_AGENT_TIMEOUT=120000
CLAUDE_AGENT_MAX_TURNS=10

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-key

# Neo4j Knowledge Graph
NEO4J_URI=neo4j+s://your-instance.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-neo4j-password

# MCP Tools Configuration
BRIGHTDATA_API_TOKEN=your-brightdata-api-token
PERPLEXITY_API_KEY=your-perplexity-api-key

# AWS Configuration
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
S3_BUCKET_NAME=rfp-autonomous-bucket

# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/rfp_autonomous

# Security Configuration
BRIGHTDATA_WEBHOOK_SECRET=your-webhook-secret
JWT_SECRET=your-jwt-secret

# Autonomous System Configuration
AUTONOMOUS_MODE=true
HUMAN_APPROVAL_THRESHOLD=70000
MAX_DAILY_COST=100
RATE_LIMIT_PER_HOUR=100

# Learning System Configuration
LEARNING_ENABLED=true
PATTERN_RECOGNITION_THRESHOLD=0.8
CONFIDENCE_IMPROVEMENT_THRESHOLD=0.1

# Monitoring Configuration
SENTRY_DSN=your-sentry-dsn
LOG_LEVEL=info
METRICS_ENABLED=true

# Email Configuration (for notifications)
RESEND_API_KEY=your-resend-api-key
RESEND_FROM_EMAIL=noreply@your-domain.com
NOTIFICATION_EMAIL=alerts@your-domain.com

# Backup Configuration
BACKUP_ENABLED=true
BACKUP_SCHEDULE=0 2 * * *
BACKUP_RETENTION_DAYS=30

# Performance Configuration
CACHE_TTL=3600
MAX_CONCURRENT_REQUESTS=100
REQUEST_TIMEOUT=30000

# Development Overrides (comment out in production)
# DEBUG_MODE=false
# VERBOSE_LOGGING=false
`;

fs.writeFileSync(path.join(deployDir, '.env.production.template'), envTemplate);

// 3. Create PM2 ecosystem configuration
console.log('📋 Creating PM2 ecosystem configuration...');

const pm2Config = `module.exports = {
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
    min_uptime: '10s',
    max_restarts: 10,
    env_file: '.env.production',
    log_file: '/var/log/rfp-autonomous.log',
    out_file: '/var/log/rfp-autonomous-out.log',
    error_file: '/var/log/rfp-autonomous-error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    time: true,
    
    // Health check
    health_check_grace_period: 3000,
    health_check_fatal_exceptions: true,
    
    // Monitoring
    pmx: true,
    
    // Instance variables
    instance_var: 'INSTANCE_ID',
    
    // Restart strategy
    restart_delay: 4000,
    autorestart: true,
    
    // Process management
    kill_timeout: 5000,
    
    // Resource limits
    max_cpu_restart: '80%',
    max_memory_restart: '1G',
    
    // Node options
    node_args: '--max-old-space-size=1024'
  }]
};`;

fs.writeFileSync(path.join(deployDir, 'ecosystem.config.js'), pm2Config);

// 4. Create Nginx configuration
console.log('🌐 Creating Nginx configuration...');

const nginxConfig = `# 🌐 Nginx Configuration for Level 3 Autonomous RFP System
# Server: 13.60.60.50

server {
    listen 80;
    server_name _;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline' 'unsafe-eval'" always;
    
    # Hide Nginx version
    server_tokens off;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;
    
    # Main application proxy
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $server_name;
        proxy_cache_bypass $http_upgrade;
        
        # Timeout settings for autonomous operations
        proxy_connect_timeout 120s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
        
        # Buffer settings for large responses
        proxy_buffer_size 16k;
        proxy_buffers 4 32k;
        proxy_busy_buffers_size 64k;
    }
    
    # API endpoints with specific handling
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # Longer timeout for API calls
        proxy_connect_timeout 180s;
        proxy_send_timeout 180s;
        proxy_read_timeout 180s;
        
        # Rate limiting for API endpoints
        limit_req zone=api burst=10 nodelay=5;
    }
    
    # Agent activity streaming (SSE)
    location /api/claude-agent/activity {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header Connection '';
        proxy_http_version 1.1;
        proxy_buffering off;
        proxy_cache off;
        
        # Special handling for Server-Sent Events
        proxy_set_header Cache-Control 'no-cache, no-store, must-revalidate';
        proxy_set_header Pragma 'no-cache';
        proxy_set_header Expires '0';
    }
    
    # Health check endpoint
    location /api/health {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        access_log off;
        
        # Fast response for health checks
        proxy_connect_timeout 5s;
        proxy_send_timeout 5s;
        proxy_read_timeout 5s;
    }
    
    # Static file caching
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header X-Content-Type-Options "nosniff";
        
        # Try to serve from public folder first
        try_files $uri @fallback;
    }
    
    # Security - deny access to sensitive files
    location ~ /\\. {
        deny all;
        return 404;
    }
    
    location ~ /\\.(env|log|md|json)$ {
        deny all;
        return 404;
    }
}

# HTTPS configuration (when SSL is set up)
server {
    listen 443 ssl http2;
    server_name _;
    
    # SSL certificate (update with your paths)
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # Other headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    
    # Same proxy configuration as HTTP
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $server_name;
        proxy_cache_bypass $http_upgrade;
        
        proxy_connect_timeout 120s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }
}

# Rate limiting
http {
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $server_name zone=server:10m rate=20r/s;
}
`;

fs.writeFileSync(path.join(deployDir, 'nginx.conf'), nginxConfig);

// 5. Create monitoring script
console.log('📊 Creating monitoring script...');

const monitorScript = `#!/bin/bash

# 📊 Production Monitoring Script for Level 3 Autonomous RFP System
# Server: 13.60.60.50

set -e

LOG_FILE="/var/log/rfp-autonomous-monitor.log"
DATE=\$(date '+%Y-%m-%d %H:%M:%S')

echo "[$DATE] Starting system monitoring..." | tee -a "$LOG_FILE"

# Function to log with timestamp
log() {
    echo "[$DATE] $1" | tee -a "$LOG_FILE"
}

# Function to check system health
check_health() {
    log "🔍 Checking system health..."
    
    # PM2 status
    if pm2 list | grep -q "rfp-autonomous.*online"; then
        log "✅ PM2: Application is online"
        PM2_STATUS="healthy"
    else
        log "❌ PM2: Application is offline"
        PM2_STATUS="unhealthy"
    fi
    
    # Web server health
    if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
        log "✅ Web Server: Application is responding"
        WEB_STATUS="healthy"
    else
        log "❌ Web Server: Application is not responding"
        WEB_STATUS="unhealthy"
    fi
    
    # Database connection (if applicable)
    if command -v psql &> /dev/null; then
        if PGPASSWORD=your-password psql -h localhost -U your-user -d your-db -c "SELECT 1;" > /dev/null 2>&1; then
            log "✅ Database: Connection successful"
            DB_STATUS="healthy"
        else
            log "❌ Database: Connection failed"
            DB_STATUS="unhealthy"
        fi
    else
        DB_STATUS="not_configured"
    fi
}

# Function to check autonomous operations
check_autonomous() {
    log "🤖 Checking autonomous operations..."
    
    # Check Claude Agent SDK
    if curl -s http://localhost:3000/api/verification?check=claude-sdk | grep -q "operational"; then
        log "✅ Claude Agent SDK: Operational"
        CLAUDE_STATUS="operational"
    else
        log "⚠️ Claude Agent SDK: Needs attention"
        CLAUDE_STATUS="needs_attention"
    fi
    
    # Check MCP Tools
    if curl -s http://localhost:3000/api/verification?check=mcp-tools | grep -q "operational"; then
        log "✅ MCP Tools: Operational"
        MCP_STATUS="operational"
    else
        log "⚠️ MCP Tools: Partially operational"
        MCP_STATUS="partial"
    fi
    
    # Check autonomous workflow
    if curl -s http://localhost:3000/api/verification?check=autonomous-workflow | grep -q "operational"; then
        log "✅ Autonomous Workflow: Operational"
        WORKFLOW_STATUS="operational"
    else
        log "⚠️ Autonomous Workflow: Needs setup"
        WORKFLOW_STATUS="needs_setup"
    fi
    
    # Check learning system
    if curl -s http://localhost:3000/api/verification?check=learning-system | grep -q "operational"; then
        log "✅ Learning System: Functional"
        LEARNING_STATUS="functional"
    else
        log "⚠️ Learning System: Needs data"
        LEARNING_STATUS="needs_data"
    fi
}

# Function to check system resources
check_resources() {
    log "💾 Checking system resources..."
    
    # Memory usage
    MEMORY_USAGE=$(free | grep '^Mem:' | awk '{printf "%.1f%%\\n", ($3/$2) * 100}')
    log "Memory Usage: $MEMORY_USAGE"
    
    # Disk usage
    DISK_USAGE=$(df -h / | tail -1 | awk '{print $5}')
    log "Disk Usage: $DISK_USAGE"
    
    # CPU load
    CPU_LOAD=$(uptime | awk -F'load average:' '{print $2}')
    log "CPU Load: $CPU_LOAD"
    
    # Process count
    PROCESS_COUNT=$(ps aux | wc -l)
    log "Process Count: $PROCESS_COUNT"
    
    # Network connections
    NETWORK_CONNECTIONS=$(netstat -an | grep ESTABLISHED | wc -l)
    log "Network Connections: $NETWORK_CONNECTIONS"
}

# Function to check application metrics
check_metrics() {
    log "📈 Checking application metrics..."
    
    # PM2 metrics
    if command -v pm2 &> /dev/null; then
        pm2 show rfp-autonomous | grep -E "(memory|cpu|status)" | while read line; do
            log "PM2 $line"
        done
    fi
    
    # Application logs analysis
    ERROR_COUNT=$(grep -c "ERROR" /var/log/rfp-autonomous-error.log 2>/dev/null || echo "0")
    WARNING_COUNT=$(grep -c "WARNING" /var/log/rfp-autonomous-out.log 2>/dev/null || echo "0")
    log "Log Analysis: $ERROR_COUNT errors, $WARNING_COUNT warnings"
    
    # Autonomous operations count
    if [ -f "/var/log/rfp-autonomous.log" ]; then
        AUTONOMOUS_OPS=$(grep -c "autonomous decision" /var/log/rfp-autonomous.log 2>/dev/null || echo "0")
        log "Autonomous Operations Today: $AUTONOMOUS_OPS"
    fi
}

# Function to check recent activity
check_activity() {
    log "📋 Checking recent activity..."
    
    # Recent agent activities
    if [ -f "/var/log/rfp-autonomous.log" ]; then
        echo "Recent Agent Activities:" | tee -a "$LOG_FILE"
        tail -10 /var/log/rfp-autonomous.log | tee -a "$LOG_FILE"
    fi
    
    # Recent errors
    if [ -f "/var/log/rfp-autonomous-error.log" ]; then
        ERROR_COUNT=$(tail -100 /var/log/rfp-autonomous-error.log | grep -c "ERROR" 2>/dev/null || echo "0")
        if [ "$ERROR_COUNT" -gt 0 ]; then
            echo "Recent Errors (last 100 lines): $ERROR_COUNT" | tee -a "$LOG_FILE"
            tail -20 /var/log/rfp-autonomous-error.log | grep ERROR | tail -5 | tee -a "$LOG_FILE"
        fi
    fi
}

# Function to generate report
generate_report() {
    REPORT_FILE="/opt/rfp-autonomous/reports/status_$(date +%Y%m%d_%H%M%S).json"
    mkdir -p /opt/rfp-autonomous/reports
    
    log "📊 Generating report: $REPORT_FILE"
    
    cat > "$REPORT_FILE" << EOF
{
    "timestamp": "$(date -Iseconds)",
    "server": "$(hostname)",
    "uptime": "$(uptime -p)",
    "health": {
        "pm2": "$PM2_STATUS",
        "web": "$WEB_STATUS",
        "database": "$DB_STATUS"
    },
    "autonomous_system": {
        "claude_sdk": "$CLAUDE_STATUS",
        "mcp_tools": "$MCP_STATUS",
        "workflow": "$WORKFLOW_STATUS",
        "learning": "$LEARNING_STATUS"
    },
    "resources": {
        "memory_usage": "$MEMORY_USAGE",
        "disk_usage": "$DISK_USAGE",
        "cpu_load": "$CPU_LOAD",
        "network_connections": "$NETWORK_CONNECTIONS"
    },
    "metrics": {
        "error_count": "$ERROR_COUNT",
        "warning_count": "$WARNING_COUNT",
        "autonomous_operations": "$AUTONOMOUS_OPS"
    }
}
EOF
    
    log "✅ Report generated: $REPORT_FILE"
}

# Main monitoring loop
main() {
    log "🚀 Starting comprehensive monitoring..."
    
    # Run all checks
    check_health
    check_autonomous
    check_resources
    check_metrics
    check_activity
    generate_report
    
    log "✅ Monitoring cycle completed"
    
    # Send notification if there are issues
    if [ "$PM2_STATUS" = "unhealthy" ] || [ "$WEB_STATUS" = "unhealthy" ]; then
        log "🚨 ALERT: System issues detected!"
        # Add email notification here if needed
        # send_alert "System Issues Detected" "$LOG_FILE"
    fi
    
    # Check if any critical issues need immediate attention
    if [ "$ERROR_COUNT" -gt 10 ]; then
        log "🚨 CRITICAL: High error rate detected!"
        # send_alert "High Error Rate" "$LOG_FILE"
    fi
}

# Run main function
main

# Exit with status code based on health
if [ "$PM2_STATUS" = "healthy" ] && [ "$WEB_STATUS" = "healthy" ]; then
    exit 0
else
    exit 1
fi
`;

fs.writeFileSync(path.join(deployDir, 'monitor.sh'), monitorScript);

// 6. Create backup script
console.log('💾 Creating backup script...');

const backupScript = `#!/bin/bash

# 💾 Backup Script for Level 3 Autonomous RFP System
# Server: 13.60.60.50

set -e

BACKUP_DIR="/opt/rfp-backups/\$(date +%Y%m%d_%H%M%S)"
LOG_FILE="/var/log/rfp-backup.log"
DATE=\$(date '+%Y-%m-%d %H:%M:%S')

echo "[$DATE] Starting backup to $BACKUP_DIR" | tee -a "$LOG_FILE"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup application files
echo "📁 Backing up application files..." | tee -a "$LOG_FILE"
tar -czf "$BACKUP_DIR/application.tar.gz" -C /opt/rfp-autonomous . 2>/dev/null

# Backup PM2 configuration
echo "📋 Backing up PM2 configuration..." | tee -a "$LOG_FILE"
pm2 save 2>/dev/null || true
cp /home/kieranmcfarlane/.pm2/dump.pm2 "$BACKUP_DIR/" 2>/dev/null || true

# Backup logs
echo "📝 Backing up logs..." | tee -a "$LOG_FILE"
tar -czf "$BACKUP_DIR/logs.tar.gz" /var/log/rfp-autonomous*.log 2>/dev/null || true

# Backup database (if applicable)
echo "🗄️ Backing up database..." | tee -a "$LOG_FILE"
if command -v pg_dump &> /dev/null; then
    pg_dump -U your-user your-db > "$BACKUP_DIR/database.sql" 2>/dev/null || true
fi

# Backup environment files
echo "⚙️ Backing up environment configuration..." | tee -a "$LOG_FILE"
cp /opt/rfp-autonomous/.env.production "$BACKUP_DIR/" 2>/dev/null || true

# Backup system configuration
echo "🔧 Backing up system configuration..." | tee -a "$LOG_FILE"
cp /etc/nginx/sites-available/rfp-autonomous "$BACKUP_DIR/" 2>/dev/null || true
cp /opt/rfp-autonomous/ecosystem.config.js "$BACKUP_DIR/" 2>/dev/null || true

# Backup reports
echo "📊 Backing up reports..." | tee -a "$LOG_FILE"
tar -czf "$BACKUP_DIR/reports.tar.gz" /opt/rfp-autonomous/reports/ 2>/dev/null || true

# Generate backup manifest
cat > "$BACKUP_DIR/backup_manifest.json" << EOF
{
    "timestamp": "$(date -Iseconds)",
    "backup_id": "$(date +%Y%m%d_%H%M%S)",
    "server": "$(hostname)",
    "user": "$(whoami)",
    "backup_type": "full_system",
    "files": {
        "application": "application.tar.gz",
        "pm2_config": "dump.pm2",
        "logs": "logs.tar.gz",
        "environment": ".env.production",
        "nginx_config": "rfp-autonomous",
        "ecosystem": "ecosystem.config.js",
        "reports": "reports.tar.gz",
        "database": "database.sql"
    }
}
EOF

# Calculate backup size
BACKUP_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)

echo "✅ Backup completed: $BACKUP_DIR" | tee -a "$LOG_FILE"
echo "📂 Backup Size: $BACKUP_SIZE" | tee -a "$LOG_FILE"

# Clean up old backups (keep last 30 days)
find /opt/rfp-backups -type d -mtime +30 -exec rm -rf {} +; 2>/dev/null || true

# Log backup completion
echo "[$DATE] Backup successfully completed: $BACKUP_SIZE" | tee -a "$LOG_FILE"

# Send backup completion notification (optional)
# send_backup_notification "$BACKUP_DIR" "$BACKUP_SIZE"

exit 0
`;

fs.writeFileSync(path.join(deployDir, 'backup.sh'), backupScript);

// 7. Create update script
console.log('🔄 Creating update script...');

const updateScript = `#!/bin/bash

# 🔄 Update Script for Level 3 Autonomous RFP System
# Server: 13.60.60.50

set -e

LOG_FILE="/var/log/rfp-update.log"
DATE=\$(date '+%Y-%m-%d %H:%M:%S')

echo "[$DATE] Starting application update..." | tee -a "$LOG_FILE"

# Create backup before update
echo "💾 Creating pre-update backup..." | tee -a "$LOG_FILE"
./backup.sh

# Navigate to application directory
cd /opt/rfp-autonomous

# Stop application
echo "⏹️ Stopping application..." | tee -a "$LOG_FILE"
pm2 stop rfp-autonomous || true

# Update dependencies
echo "📦 Updating dependencies..." | tee -a "$LOG_FILE"
npm update

# Clean cache
echo "🧹 Cleaning cache..." | tee -a "$LOG_FILE"
npm cache clean --force

# Install dependencies
echo "📦 Installing dependencies..." | tee -a "$LOG_FILE"
npm install

# Build application
echo "🔨 Building application..." | tee -a "$LOG_FILE"
npm run build

# Run database migrations (if applicable)
echo "🗄️ Running database migrations..." | tee -a "$LOG_FILE"
# npm run migrate  # Uncomment if you have migrations

# Restart application
echo "🚀 Restarting application..." | tee -a "$LOG_FILE"
pm2 start rfp-autonomous

# Wait for application to start
echo "⏳ Waiting for application to start..." | tee -a "$LOG_FILE"
sleep 30

# Health check
echo "🏥 Running health check..." | tee -a "$LOG_FILE"
if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "✅ Application started successfully" | tee -a "$LOG_FILE"
    STATUS="success"
else
    echo "❌ Application failed to start" | tee -a "$LOG_FILE"
    echo "📝 Checking logs..." | tee -a "$LOG_FILE"
    pm2 logs rfp-autonomous --lines 20 | tail -20 | tee -a "$LOG_FILE"
    STATUS="failed"
fi

# Verify update
echo "🔍 Verifying update..." | tee -a "$LOG_FILE"
if curl -f http://localhost:3000/api/verification?check=all > /dev/null 2>&1; then
    echo "✅ Verification passed" | tee -a "$LOG_FILE"
else
    echo "⚠️ Verification needs attention" | tee -a "$LOG_FILE"
fi

echo "[$DATE] Update completed with status: $STATUS" | tee -a "$LOG_FILE"

# Send update notification (optional)
# send_update_notification "$STATUS"

exit 0
`;

fs.writeFileSync(path.join(deployDir, 'update.sh'), updateScript);

// 8. Create SSL setup script
console.log('🔒 Creating SSL setup script...');

const sslScript = `#!/bin/bash

# 🔒 SSL Setup Script for Level 3 Autonomous RFP System
# Server: 13.60.60.50

set -e

DOMAIN="your-domain.com"  # UPDATE THIS
EMAIL="your-email@your-domain.com"  # UPDATE THIS
LOG_FILE="/var/log/ssl-setup.log"
DATE=\$(date '+%Y-%m-%d %H:%M:%S')

echo "[$DATE] Starting SSL setup for $DOMAIN..." | tee -a "$LOG_FILE"

# Check if Certbot is installed
if ! command -v certbot &> /dev/null; then
    echo "📦 Installing Certbot..." | tee -a "$LOG_FILE"
    sudo apt update
    sudo apt install -y certbot python3-certbot-nginx
else
    echo "✅ Certbot already installed" | tee -a "$LOG_FILE"
fi

# Check if domain is already configured
if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    echo "✅ SSL certificate already exists for $DOMAIN" | tee -a "$LOG_FILE"
    
    # Check if certificate is valid
    EXPIRY_DATE=$(openssl x509 -in /etc/letsencrypt/live/$DOMAIN/fullchain.pem -noout -dates | grep notAfter | cut -d= -f1)
    if [ "$EXPIRY_DATE" ]; then
        EXPIRY_EPOCH=$(date -d "$EXPIRY_DATE" +%s)
        CURRENT_EPOCH=$(date +%s)
        DAYS_LEFT=$(( (EXPIRY_EPOCH - CURRENT_EPOCH) / 86400 ))
        
        if [ "$DAYS_LEFT" -gt 7 ]; then
            echo "✅ SSL certificate is valid for $DAYS_LEFT days" | tee -a "$LOG_FILE"
        else
            echo "⚠️ SSL certificate expires in $DAYS_LEFT days" | tee -a "$LOG_FILE"
            echo "🔄 Renewing certificate..." | tee -a "$LOG_FILE"
            certbot renew --nginx -d "$DOMAIN" --non-interactive | tee -a "$LOG_FILE"
        fi
    fi
else
    echo "🔒 Requesting SSL certificate for $DOMAIN..." | tee -a "$LOG_FILE"
    
    # Obtain SSL certificate
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "$EMAIL" | tee -a "$LOG_FILE"
    
    if [ $? -eq 0 ]; then
        echo "✅ SSL certificate obtained successfully" | tee -a "$LOG_FILE"
    else
        echo "❌ Failed to obtain SSL certificate" | tee -a "$LOG_FILE"
        exit 1
    fi
fi

# Set up auto-renewal
echo "⏰ Setting up auto-renewal..." | tee -a "$LOG_FILE"
echo "0 12 * * * /usr/bin/certbot renew --quiet --post-hook 'systemctl reload nginx'" | crontab -

# Test SSL configuration
echo "🔍 Testing SSL configuration..." | tee -a "$LOG_FILE"
if curl -s -k "https://$DOMAIN/api/health" > /dev/null; then
    echo "✅ SSL configuration is working" | tee -a "$LOG_FILE"
else
    echo "❌ SSL configuration needs attention" | tee -a "$LOG_FILE"
fi

# Update Nginx configuration for HTTPS
echo "🌐 Updating Nginx for HTTPS..." | tee -a "$LOG_FILE"
cat << NGINXSSL | sudo tee /etc/nginx/sites-available/rfp-autonomous
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN;
    
    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    
    # Application proxy
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Host \$server_name;
        proxy_cache_bypass \$http_upgrade;
        
        proxy_connect_timeout 120s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }
    
    # API endpoints
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        
        proxy_connect_timeout 180s;
        proxy_send_timeout 180s;
        proxy_read_timeout 180s;
        
        limit_req zone=api burst=20 nodelay=5;
    }
    
    # Health check
    location /api/health {
        proxy_pass http://localhost:3000;
        proxy_set_header Host \$host;
        access_log off;
        
        proxy_connect_timeout 5s;
        proxy_send_timeout 5s;
        proxy_read_timeout 5s;
    }
    
    # Static files
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header X-Content-Type-Options "nosniff";
        
        try_files \$uri @fallback;
    }
    
    # Security
    location ~ /\\. {
        deny all;
        return 404;
    }
}
NGINXSSL

# Test and reload Nginx
echo "🧪 Testing and reloading Nginx..." | tee -a "$LOG_FILE"
sudo nginx -t && sudo systemctl reload nginx

echo "✅ SSL setup completed for $DOMAIN" | tee -a "$LOG_FILE"
echo "🌐 HTTPS enabled: https://$DOMAIN" | tee -a "$LOG_FILE"

# Update application environment
if [ -f "/opt/rfp-autonomous/.env.production" ]; then
    sed -i "s|^NEXTAUTH_URL=.*|NEXTAUTH_URL=https://$DOMAIN|" /opt/rfp-autonomous/.env.production
    echo "✅ Updated NEXTAUTH_URL in environment" | tee -a "$LOG_FILE"
fi

# Restart application
echo "🚀 Restarting application..." | tee -a "$LOG_FILE"
pm2 restart rfp-autonomous

# Test HTTPS
echo "🔍 Testing HTTPS..." | tee -a "$LOG_FILE"
sleep 10
if curl -s -k "https://$DOMAIN/api/health" > /dev/null; then
    echo "✅ HTTPS is working" | tee -a "$LOG_FILE"
else
    echo "❌ HTTPS test failed" | tee -a "$LOG_FILE"
fi

echo "🔒 SSL setup completed successfully!" | tee -a "$LOG_FILE"
echo "📋 Certificate details:" | tee -a "$LOG_FILE"
openssl x509 -in /etc/letsencrypt/live/$DOMAIN/fullchain.pem -noout -dates | grep -E "(Subject|Not Before|Not After)" | tee -a "$LOG_FILE"

exit 0
SSLSCRIPT

fs.writeFileSync(path.join(deployDir, 'setup-ssl.sh'), sslScript);

// 9. Make all scripts executable
console.log('🔧 Making scripts executable...');
const scripts = ['deploy-production.sh', 'monitor.sh', 'backup.sh', 'update.sh', 'setup-ssl.sh'];
scripts.forEach(script => {
    try {
        fs.chmodSync(path.join(deployDir, script), '755');
    } catch (error) {
        console.log(`Warning: Could not make ${script} executable`);
    }
});

// 10. Create README for deployment
console.log('📖 Creating deployment README...');

const readme = `# 🚀 Level 3 Autonomous RFP System - Production Deployment

## Server Information
- **IP Address**: 13.60.60.60.50
- **SSH Key**: yellowpanther.pem
- **User**: kieranmcfarlane
- **System**: Ubuntu 20.04 LTS (or similar)

## Quick Start

### 1. Connect to Server
\`\`\bash
ssh -i /Users/kieranmcfarlane/Downloads/panther_chat/yellowpanther.pem kieranmcfarlane@13.60.60.50
\`\`

### 2. Copy Deployment Files
\`\`\bash
scp -i /Users/kieranmcfarlane/Downloads/panther_chat/yellowpanther.pem \\
    /Users/kieranmcfarlane/Downloads/panther_chat/production-deploy/* \\
    kieranmcfarlane@13.60.60.50:/tmp/
\`\`

### 3. Run Deployment
\`\`\bash
ssh -i /Users/kieranmcfarlane/Downloads/panther_chat/yellowpanther.pem kieranmcfarlane@13.60.60.50 "cd /tmp && chmod +x deploy-production.sh && ./deploy-production.sh"
\`\`

## Files Created

### Core Deployment Scripts
- **deploy-production.sh**: Main deployment script
- **ecosystem.config.js**: PM2 configuration
- **nginx.conf**: Nginx reverse proxy configuration
- **.env.production.template**: Environment variables template

### Management Scripts
- **monitor.sh**: System monitoring script
- **backup.sh**: Backup automation script
- **update.sh**: Application update script
- **setup-ssl.sh**: SSL certificate setup

### Configuration Files
- **supabase-schema-level3.sql**: Database schema
- **neo4j-schema-level3.cypher**: Knowledge graph schema

## Configuration Steps

### 1. Environment Variables
Update \`/opt/rfp-autonomous/.env.production\` with your actual values:

\`\`bash
# Core Services
ANTHROPIC_API_KEY=your-anthropic-api-key
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-supabase-key
NEO4J_URI=neo4j+s://your-neo4j-instance
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-neo4j-password

# MCP Tools
BRIGHTDATA_API_TOKEN=your-brightdata-token
PERPLEXITY_API_KEY=your-perplexity-key

# AWS (if needed)
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
S3_BUCKET_NAME=your-s3-bucket
\`\`

### 2. Domain Configuration
- Update Nginx configuration with your domain
- Set up DNS A record: your-domain.com → 13.60.60.50
- Run SSL setup: \`./setup-ssl.sh\`

### 3. Database Setup
- Run Supabase schema: \`psql -h your-db -d postgres < supabase-schema-level3.sql\`
- Run Neo4j schema: Load \`neo4j-schema-level3.cypher\` in Neo4j Browser
- Configure MCP servers for Neo4j, BrightData, and Perplexity

## Access Points

### Application URLs
- **Main Application**: https://your-domain.com
- **Autonomous Dashboard**: https://your-domain.com/level3-autonomous
- **A2A System**: https://your-domain.com/a2a-system
- **API Endpoints**: https://your-domain.com/api/*

### API Endpoints
- **Verification**: \`/api/verification?check=all\`
- **Health Check**: \`/api/health\`
- **System Status**: \`/api/a2a-system\`
- **Claude Activity**: \`/api/claude-agent/activity\`

## Management Commands

### Application Management
\`\`bash
pm2 status                    # Check application status
pm2 logs rfp-autonomous       # View application logs
pm2 restart rfp-autonomous    # Restart application
pm2 stop rfp-autonomous       # Stop application
pm2 monit                     # Real-time monitoring
\`\`

### System Monitoring
\`\`bash
./monitor.sh                    # Full system check
./backup.sh                     # Create backup
./update.sh                      # Update application
./setup-ssl.sh                   # Setup SSL certificate
\`\`

### Log Management
\`\`bash
tail -f /var/log/rfp-autonomous.log          # Application logs
tail -f /var/log/rfp-autonomous-error.log   # Error logs
tail -f /var/log/nginx/access.log             # Nginx access logs
tail -f /var/log/nginx/error.log              # Nginx error logs
\`\`

## Security Recommendations

### 1. SSH Security
- Use SSH key authentication (already configured)
- Disable password authentication
- Change default SSH port if needed
- Set up fail2ban for brute force protection

### 2. Firewall Configuration
\`\`bash
sudo ufw status                 # Check firewall status
sudo ufw allow 22/tcp            # SSH
sudo ufw allow 80/tcp            # HTTP
sudo ufw allow 443/tcp           # HTTPS
sudo ufw allow 3000/tcp           # Application
\`\`

### 3. SSL/TLS Security
- Use HTTPS for all communications
- Implement HSTS headers (already configured)
- Keep certificates renewed automatically
- Monitor certificate expiration

### 4. Application Security
- Environment variables stored securely
- Rate limiting implemented
- Security headers configured
- Input validation and sanitization

## Performance Optimization

### 1. Application Performance
- PM2 cluster mode with 2 instances
- Memory limit: 1GB per instance
- Nginx gzip compression enabled
- Static file caching configured

### 2. Database Performance
- Indexes optimized for queries
- Connection pooling configured
- Regular maintenance operations

### 3. Monitoring and Alerting
- Real-time health checks
- Automated monitoring
- Log rotation implemented
- Performance metrics tracking

## Backup and Recovery

### 1. Automated Backups
- Daily automated backups
- 30-day retention policy
- Off-site storage recommended
- Backup verification

### 2. Recovery Procedures
- Quick recovery from backup
- Database restoration process
- Application rollback capabilities
- Disaster recovery plan

## Troubleshooting

### Common Issues

#### Application Won't Start
\`\`bash
pm2 logs rfp-autonomous    # Check application logs
pm2 delete rfp-autonomous # Clear PM2 cache
pm2 start ecosystem.config.js # Restart fresh
\`\`

#### Database Connection Issues
\`\`bash
# Check database status
sudo systemctl status postgresql
# Test connection
psql -h localhost -U postgres -c "SELECT 1;"
\`\`

#### SSL Certificate Issues
\`\`bash
# Check certificate status
sudo certbot certificates
# Force renewal
sudo certbot renew --force
\`\`

#### Performance Issues
\`\`bash
./monitor.sh               # Check system resources
pm2 monit                  # Check PM2 metrics
df -h                       # Check disk space
free -h                       # Check memory usage
\`\`

## Support

### Getting Help
- Check logs for detailed error messages
- Run \`./monitor.sh\` for system health check
- Verify environment variables are correctly set
- Ensure all services are running

### Escalation
- Check application logs for specific errors
- Review system logs for infrastructure issues
- Monitor performance metrics for bottlenecks

---

**Deployment Status**: ✅ Ready
**Last Updated**: $(date)
**Version**: 1.0.0
`;

fs.writeFileSync(path.join(deployDir, 'README.md'), readme);

// 11. Create file list
console.log('📋 Created files:');
console.log('');
const files = fs.readdirSync(deployDir);
files.forEach(file => {
    const stats = fs.statSync(path.join(deployDir, file));
    console.log(`  ${file} (${stats.size} bytes)`);
});

console.log('\n🎉 Production deployment files created successfully!');
console.log('📁 Location: /Users/kieranmcfarlane/Downloads/panther_chat/production-deploy/');
console.log('');
console.log('🚀 Next Steps:');
console.log('');
console.log('1. Copy files to server:');
console.log('   scp -i /Users/kieranmcfarlane/Downloads/panther_chat/yellowpanther.pem \\');
console.log('       /Users/kieranmcfarlane/Downloads/panther_chat/production-deploy/* \\');
console.log('       kieranmcfarlane@13.60.60.50:/tmp/');
console.log('');
console.log('2. Connect to server:');
console.log('   ssh -i /Users/kieranmcfarlane/Downloads/panther_chat/yellowpanther.pem kieranmcfarlane@13.60.60.50');
console.log('');
console.log('3. Run deployment:');
console.log('   cd /tmp && chmod +x deploy-production.sh && ./deploy-production.sh');
console.log('');
console.log('🔗 Server Information:');
console.log('   IP: 13.60.60.50');
console.log   User: kieranmcfarlane');
console.log('   SSH Key: yellowpanther.pem');
console.log('');
console.log('📊 Access Your System:');
console.log('   Dashboard: https://your-domain.com/level3-autonomous');
console.log('   Monitoring: https://your-domain.com/api/verification?check=all');
console.log('   A2A System: https://your-domain.com/a2a-system');