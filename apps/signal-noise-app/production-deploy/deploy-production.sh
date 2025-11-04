#!/bin/bash

# 🚀 Level 3 Autonomous RFP System - One-Click Production Deployment
# Server: 13.60.60.50 | User: kieranmcfarlane
# System: Fully Autonomous RFP Intelligence with Claude Agent SDK

set -e  # Exit on any error

echo "🚀 Level 3 Autonomous RFP System - Production Deployment"
echo "========================================================"
echo "Time: $(date)"
echo "Server: $(hostname)"
echo "User: $(whoami)"
echo "System: Level 3 Autonomous RFP Intelligence"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging
LOG_FILE="/var/log/rfp-autonomous-deploy.log"
exec > >(tee -a "$LOG_FILE")
exec 2>&1

echo -e "${BLUE}📋 Deployment Plan:${NC}"
echo "1. System Update & Dependencies"
echo "2. Application Setup & Build"
echo "3. Environment Configuration"
echo "4. Database Setup (Supabase + Neo4j)"
echo "5. Autonomous Agent Configuration"
echo "6. Process Management (PM2)"
echo "7. Web Server Setup (Nginx)"
echo "8. SSL Certificate"
echo "9. Monitoring & Backup"
echo "10. System Verification"
echo ""

# Function to print status
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️ $1${NC}"
}

# Step 1: System Update & Dependencies
echo -e "${BLUE}📦 Step 1: System Update & Dependencies${NC}"
echo "============================================="

# Update system
print_info "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js if not present
if ! command -v node &> /dev/null; then
    print_info "Installing Node.js 18.x..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    print_status "Node.js already installed: $(node --version)"
fi

# Install essential tools
print_info "Installing essential tools..."
sudo apt install -y build-essential git nginx certbot python3-certbot-nginx htop ncdu unzip

# Install PM2 globally
print_info "Installing PM2 process manager..."
sudo npm install -g pm2

# Install PM2 startup script
pm2 startup | tail -n 1 > /tmp/pm2-startup-command
print_status "PM2 installed and startup script prepared"

print_status "Step 1 completed: System updated and dependencies installed"
echo ""

# Step 2: Application Setup & Build
echo -e "${BLUE}📁 Step 2: Application Setup & Build${NC}"
echo "========================================"

# Create application directory
print_info "Creating application directory..."
sudo mkdir -p /opt/rfp-autonomous
sudo chown kieranmcfarlane:kieranmcfarlane /opt/rfp-autonomous
cd /opt/rfp-autonomous

print_info "Current directory: $(pwd)"

# Check if application files exist
if [ ! -f "package.json" ]; then
    print_warning "Application files not found!"
    print_info "You need to upload your application files to /opt/rfp-autonomous"
    print_info "Options:"
    echo "  1. Git clone: git clone <your-repo-url> ."
    echo "  2. SCP upload: scp -r app/* kieranmcfarlane@13.60.60.50:/opt/rfp-autonomous/"
    echo "  3. Manual upload via SFTP/file manager"
    echo ""
    read -p "Press Enter to continue when files are uploaded..." || true
    
    if [ ! -f "package.json" ]; then
        print_error "package.json not found! Please upload application files first."
        exit 1
    fi
fi

print_status "Application files found"

# Install dependencies
print_info "Installing Node.js dependencies..."
npm install

# Build application
print_info "Building Next.js application..."
npm run build

print_status "Step 2 completed: Application built successfully"
echo ""

# Step 3: Environment Configuration
echo -e "${BLUE}⚙️ Step 3: Environment Configuration${NC}"
echo "====================================="

# Create environment file from template
if [ -f ".env.production.template" ]; then
    print_info "Creating environment file from template..."
    cp .env.production.template .env.production
else
    print_info "Creating environment file..."
    cat > .env.production << ENVEOF
NODE_ENV=production
PORT=3000

# Claude Agent SDK
ANTHROPIC_API_KEY=your-anthropic-api-key-here
ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic

# Supabase Database
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url-here
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key-here

# Neo4j Knowledge Graph
NEO4J_URI=neo4j+s://your-neo4j-instance-here
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-neo4j-password-here

# MCP Tools
BRIGHTDATA_API_TOKEN=your-brightdata-token-here
PERPLEXITY_API_KEY=your-perplexity-key-here

# AWS S3 (for badges)
AWS_ACCESS_KEY_ID=your-aws-access-key-here
AWS_SECRET_ACCESS_KEY=your-aws-secret-key-here
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-s3-bucket-name-here

# Email Service
RESEND_API_KEY=your-resend-api-key-here
RESEND_FROM_EMAIL=noreply@your-domain.com

# Authentication & Security
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=$(openssl rand -base64 32)
BRIGHTDATA_WEBHOOK_SECRET=$(openssl rand -base64 32)

# Autonomous System Configuration
AUTONOMOUS_MODE_ENABLED=true
LEARNING_ENABLED=true
OUTREACH_ENABLED=true
MONITORING_ENABLED=true
ENVEOF
fi

print_status "Environment file created"
print_warning "⚠️ IMPORTANT: Edit .env.production with your actual API keys!"
print_info "File location: /opt/rfp-autonomous/.env.production"

print_status "Step 3 completed: Environment configured"
echo ""

# Step 4: Database Setup
echo -e "${BLUE}🗄️ Step 4: Database Setup${NC}"
echo "============================="

print_info "Database setup instructions:"
echo "1. Supabase: Apply the schema from supabase-schema-level3.sql"
echo "2. Neo4j: Run the Cypher commands from neo4j-schema-level3.cypher"
echo ""

if [ -f "supabase-schema-level3.sql" ]; then
    print_info "Supabase schema found: supabase-schema-level3.sql"
    print_info "Apply this to your Supabase project"
fi

if [ -f "neo4j-schema-level3.cypher" ]; then
    print_info "Neo4j schema found: neo4j-schema-level3.cypher"
    print_info "Run these commands in your Neo4j browser"
fi

print_status "Step 4 completed: Database schema prepared"
echo ""

# Step 5: Autonomous Agent Configuration
echo -e "${BLUE}🤖 Step 5: Autonomous Agent Configuration${NC}"
echo "=============================================="

print_info "Configuring autonomous agents..."

# Create autonomous configuration
mkdir -p config/autonomous
cat > config/autonomous/agents-config.json << AGENTSEOF
{
  "version": "3.0",
  "agents": {
    "linkedin_monitor": {
      "enabled": true,
      "schedule": "*/5 * * * *",
      "mcp_tools": ["brightdata", "perplexity"]
    },
    "rfp_analyzer": {
      "enabled": true,
      "model": "claude-3-sonnet-20240229",
      "mcp_tools": ["neo4j", "perplexity"]
    },
    "response_generator": {
      "enabled": true,
      "model": "claude-3-sonnet-20240229",
      "templates_path": "templates/responses"
    },
    "outreach_coordinator": {
      "enabled": true,
      "email_service": "resend",
      "schedule": "0 9,14,18 * * *"
    },
    "learning_agent": {
      "enabled": true,
      "feedback_loop": true,
      "model_retention_days": 30
    }
  },
  "workflow": {
    "discovery_to_analysis_time": "5m",
    "analysis_to_response_time": "15m",
    "response_to_outreach_time": "30m"
  }
}
AGENTSEOF

print_status "Autonomous agent configuration created"

print_status "Step 5 completed: Autonomous agents configured"
echo ""

# Step 6: Process Management (PM2)
echo -e "${BLUE}🔧 Step 6: Process Management (PM2)${NC}"
echo "======================================="

# Create PM2 ecosystem configuration
print_info "Creating PM2 ecosystem configuration..."

cat > ecosystem.config.js << PM2EOF
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
sudo mkdir -p /var/log
sudo touch /var/log/rfp-autonomous*.log
sudo chown kieranmcfarlane:kieranmcfarlane /var/log/rfp-autonomous*.log

print_status "PM2 configuration created"

print_status "Step 6 completed: Process management configured"
echo ""

# Step 7: Web Server Setup (Nginx)
echo -e "${BLUE}🌐 Step 7: Web Server Setup (Nginx)${NC}"
echo "======================================"

print_info "Configuring Nginx reverse proxy..."

# Create Nginx configuration
sudo tee /etc/nginx/sites-available/rfp-autonomous > /dev/null << NGINXEOF
server {
    listen 80;
    server_name _;  # Replace with your domain
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
    
    # Rate limiting
    limit_req_zone \$binary_remote_addr zone=api:10m rate=10r/s;
    
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
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # API rate limiting
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # Static file caching
    location /_next/static/ {
        proxy_pass http://localhost:3000;
        proxy_cache_valid 200 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Health check endpoint
    location /health {
        proxy_pass http://localhost:3000/api/health;
        access_log off;
    }
}
NGINXEOF

# Enable the site
sudo ln -sf /etc/nginx/sites-available/rfp-autonomous /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

print_status "Nginx configured successfully"

print_status "Step 7 completed: Web server configured"
echo ""

# Step 8: SSL Certificate
echo -e "${BLUE}🔒 Step 8: SSL Certificate Setup${NC}"
echo "=================================="

print_info "SSL setup instructions:"
echo "1. Replace 'server_name _;' with your actual domain in /etc/nginx/sites-available/rfp-autonomous"
echo "2. Run: sudo certbot --nginx -d your-domain.com"
echo "3. SSL certificate will be automatically configured"
echo ""

# Check if certbot is ready
if command -v certbot &> /dev/null; then
    print_status "Certbot is ready for SSL setup"
else
    print_warning "Certbot not found. SSL setup will need to be done manually."
fi

print_status "Step 8 completed: SSL certificate preparation ready"
echo ""

# Step 9: Monitoring & Backup
echo -e "${BLUE}📊 Step 9: Monitoring & Backup Setup${NC}"
echo "====================================="

# Create monitoring script
print_info "Creating monitoring script..."

sudo tee /usr/local/bin/rfp-monitor > /dev/null << 'MONITOREOF'
#!/bin/bash

# RFP Autonomous System Monitor
LOG_FILE="/var/log/rfp-autonomous-monitor.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

# Check PM2 processes
PM2_STATUS=$(pm2 jlist | jq length 2>/dev/null || echo "0")
if [ "$PM2_STATUS" -eq 0 ]; then
    echo "[$DATE] ERROR: No PM2 processes running" >> $LOG_FILE
    pm2 restart rfp-autonomous
fi

# Check disk space
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 80 ]; then
    echo "[$DATE] WARNING: Disk usage at ${DISK_USAGE}%" >> $LOG_FILE
fi

# Check memory usage
MEM_USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
if [ "$MEM_USAGE" -gt 80 ]; then
    echo "[$DATE] WARNING: Memory usage at ${MEM_USAGE}%" >> $LOG_FILE
fi

# Check application health
if ! curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "[$DATE] ERROR: Application health check failed" >> $LOG_FILE
    pm2 restart rfp-autonomous
fi

echo "[$DATE] Monitor check completed" >> $LOG_FILE
MONITOREOF

sudo chmod +x /usr/local/bin/rfp-monitor

# Create backup script
sudo tee /usr/local/bin/rfp-backup > /dev/null << 'BACKUPEOF'
#!/bin/bash

# RFP Autonomous System Backup
BACKUP_DIR="/opt/backups/rfp-autonomous"
DATE=$(date '+%Y%m%d_%H%M%S')
BACKUP_FILE="backup_${DATE}.tar.gz"

mkdir -p $BACKUP_DIR

# Backup application files
tar -czf "${BACKUP_DIR}/${BACKUP_FILE}" \
    /opt/rfp-autonomous \
    --exclude=node_modules \
    --exclude=.next \
    --exclude=*.log

# Keep only last 7 days of backups
find $BACKUP_DIR -name "backup_*.tar.gz" -mtime +7 -delete

echo "Backup completed: ${BACKUP_DIR}/${BACKUP_FILE}"
BACKUPEOF

sudo chmod +x /usr/local/bin/rfp-backup

# Setup cron jobs
print_info "Setting up cron jobs..."
(crontab -l 2>/dev/null; echo "*/5 * * * * /usr/local/bin/rfp-monitor") | crontab -
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/rfp-backup") | crontab -

print_status "Monitoring and backup scripts created and scheduled"

print_status "Step 9 completed: Monitoring and backup configured"
echo ""

# Step 10: System Verification
echo -e "${BLUE}🏥 Step 10: System Verification${NC}"
echo "==============================="

# Start application
print_info "Starting application with PM2..."
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Wait for application to start
print_info "Waiting for application to start..."
sleep 15

# Health check
print_info "Performing health checks..."

# Check if application is responding
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    print_status "✅ Application is responding on port 3000"
else
    print_error "❌ Application is not responding on port 3000"
    print_info "Check logs: pm2 logs rfp-autonomous"
fi

# Check PM2 status
PM2_STATUS=$(pm2 status | grep 'rfp-autonomous' | grep -c 'online')
if [ "$PM2_STATUS" -gt 0 ]; then
    print_status "✅ PM2 processes are running"
else
    print_error "❌ PM2 processes are not running"
fi

# Check Nginx status
if systemctl is-active --quiet nginx; then
    print_status "✅ Nginx is running"
else
    print_error "❌ Nginx is not running"
fi

# Restart Nginx to apply configuration
sudo systemctl restart nginx
sudo systemctl enable nginx

print_status "Step 10 completed: System verification finished"
echo ""

# Deployment Summary
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo "========================"
echo ""
echo -e "${BLUE}📊 System Status:${NC}"
echo "Node.js: $(node --version)"
echo "NPM: $(npm --version)"
echo "PM2: $(pm2 --version)"
echo "Nginx: $(nginx -v 2>&1 | cut -d' ' -f3)"
echo "Memory: $(free -h | grep '^Mem:' | awk '{print $3 "/" $2}')"
echo "Disk: $(df -h / | tail -1 | awk '{print $4 " / " $2}')"
echo ""
echo -e "${BLUE}🔗 Application URLs:${NC}"
echo "Local: http://localhost:3000"
echo "Health: http://localhost:3000/api/health"
echo "Verification: http://localhost:3000/api/verification?check=all"
echo "Autonomous Dashboard: http://localhost:3000/level3-autonomous"
echo ""
echo -e "${BLUE}📋 Management Commands:${NC}"
echo "pm2 status                 - Check application status"
echo "pm2 logs rfp-autonomous     - View application logs"
echo "pm2 restart rfp-autonomous  - Restart application"
echo "pm2 stop rfp-autonomous     - Stop application"
echo "pm2 monit                  - Monitor with real-time stats"
echo ""
echo -e "${BLUE}📊 Monitoring:${NC}"
echo "tail -f /var/log/rfp-autonomous.log           - Application logs"
echo "tail -f /var/log/rfp-autonomous-monitor.log   - Monitoring logs"
echo "sudo systemctl status nginx                   - Nginx status"
echo "sudo nginx -t                                 - Test Nginx config"
echo ""
echo -e "${BLUE}🔧 Maintenance:${NC}"
echo "rfp-monitor                                      - Run system monitor"
echo "rfp-backup                                       - Create backup"
echo "crontab -l                                      - View scheduled tasks"
echo ""
echo -e "${YELLOW}⚠️ IMPORTANT NEXT STEPS:${NC}"
echo "1. Edit /opt/rfp-autonomous/.env.production with your API keys"
echo "2. Configure your domain name in Nginx configuration"
echo "3. Set up SSL certificate: sudo certbot --nginx -d your-domain.com"
echo "4. Apply database schemas (Supabase + Neo4j)"
echo "5. Initialize autonomous agents with: curl http://localhost:3000/api/autonomous/init"
echo ""
echo -e "${GREEN}🎯 Level 3 Autonomous RFP System is ready!${NC}"
echo "============================================="
echo ""

# Show system status
echo -e "${BLUE}📈 Final System Status:${NC}"
echo "PM2 Processes:"
pm2 status
echo ""
echo "Application Health (last 5 lines):"
pm2 logs rfp-autonomous --lines 5 --nostream
echo ""
echo "Deployment completed at: $(date)"
echo "Log file location: $LOG_FILE"