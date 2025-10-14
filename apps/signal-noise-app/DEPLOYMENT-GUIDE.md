# 🚀 Level 3 Autonomous RFP System - Production Deployment Guide

## Server Information
- **Server IP**: 13.60.60.50
- **User**: kieranmcfarlane
- **SSH Key**: `/Users/kieranmcfarlane/Downloads/panther_chat/yellowpanther.pem`
- **System**: Level 3 Autonomous RFP Intelligence

## 🔐 SSH Connection Troubleshooting

### Issue: Permission Denied (publickey,gssapi-keyex,gssapi-with-mic)

The SSH key is being rejected. This could be due to:

1. **Server SSH Configuration**: The server may not have the public key in `authorized_keys`
2. **SSH Key Format**: The key format may not be compatible
3. **Server SSH Settings**: Server may require specific SSH settings

### Solution 1: Copy Public Key to Server

```bash
# Extract public key from private key
ssh-keygen -y -f /Users/kieranmcfarlane/Downloads/panther_chat/yellowpanther.pem > /tmp/public_key.pub

# Display the public key (copy this output)
echo "=== PUBLIC KEY TO ADD TO SERVER ==="
cat /tmp/public_key.pub
echo "=================================="
```

### Solution 2: Manual Key Setup

If you have server access through other means (console access, etc.):

```bash
# On the server (13.60.60.50):
mkdir -p ~/.ssh
chmod 700 ~/.ssh
echo "YOUR_PUBLIC_KEY_HERE" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### Solution 3: Alternative Deployment Methods

1. **SCP File Transfer**:
```bash
# Copy deployment package directly
scp -i /Users/kieranmcfarlane/Downloads/panther_chat/yellowpanther.pem production-deploy/* kieranmcfarlane@13.60.60.50:/tmp/
```

2. **Git-based Deployment**:
```bash
# Deploy via git repository
git clone https://your-repo.git
cd your-repo
npm install
npm run build
npm run deploy:prod
```

3. **Manual Deployment**:
- Upload files via SFTP or file manager
- Use server console to run commands

## 📦 Deployment Files Created

The following deployment files have been prepared:

### Core Deployment Scripts
- `deploy-production.sh` - Main deployment script
- `ecosystem.config.js` - PM2 process management
- `nginx.conf` - Nginx reverse proxy configuration
- `.env.production.template` - Environment variables template

### Monitoring & Maintenance
- `scripts/monitor-system.sh` - System monitoring
- `scripts/backup-system.sh` - Automated backups
- `scripts/update-system.sh` - System updates
- `scripts/ssl-setup.sh` - SSL certificate setup

### Configuration Files
- `system-services/rfp-autonomous.service` - System service configuration
- `logrotate/rfp-autonomous` - Log rotation setup
- `monit/monitrc` - Service monitoring

## 🚀 Quick Start Deployment

### Option 1: Automated Deployment (Preferred)

```bash
# 1. Copy deployment files to server
scp -i /Users/kieranmcfarlane/Downloads/panther_chat/yellowpanther.pem \
   production-deploy/deploy-production.sh \
   kieranmcfarlane@13.60.60.50:/tmp/

# 2. Connect to server and run deployment
ssh -i /Users/kieranmcfarlane/Downloads/panther_chat/yellowpanther.pem \
   kieranmcfarlane@13.60.60.50 \
   "chmod +x /tmp/deploy-production.sh && /tmp/deploy-production.sh"
```

### Option 2: Step-by-Step Manual Deployment

```bash
# 1. Connect to server
ssh -i /Users/kieranmcfarlane/Downloads/panther_chat/yellowpanther.pem \
   kieranmcfarlane@13.60.60.50

# 2. Run these commands on the server:
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs npm nginx
sudo npm install -g pm2

# 3. Setup application
sudo mkdir -p /opt/rfp-autonomous
sudo chown kieranmcfarlane:kieranmcfarlane /opt/rfp-autonomous
cd /opt/rfp-autonomous

# 4. Copy your application files here (via git or scp)
# 5. Install dependencies
npm install
npm run build

# 6. Setup environment
cp .env.production.template .env.production
# Edit .env.production with your actual API keys

# 7. Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## 🔧 Environment Configuration

### Required Environment Variables

Update `.env.production` with your actual values:

```bash
# Claude Agent SDK
ANTHROPIC_API_KEY=your-anthropic-api-key
ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic

# Supabase Database
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-supabase-key

# Neo4j Knowledge Graph
NEO4J_URI=neo4j+s://your-neo4j-instance
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-neo4j-password

# MCP Tools
BRIGHTDATA_API_TOKEN=your-brightdata-token
PERPLEXITY_API_KEY=your-perplexity-key

# AWS S3 (for badges)
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-s3-bucket

# Security
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=$(openssl rand -base64 32)
BRIGHTDATA_WEBHOOK_SECRET=$(openssl rand -base64 32)
```

## 🏥 Verification & Testing

### 1. System Health Check

```bash
# Check application status
pm2 status
pm2 logs rfp-autonomous

# Check web application
curl http://localhost:3000/api/verification?check=all

# Check system services
sudo systemctl status nginx
```

### 2. Autonomous System Verification

```bash
# Test Claude Agent SDK
curl http://localhost:3000/api/verification?check=sdk

# Test MCP Tools
curl http://localhost:3000/api/verification?check=mcp

# Test Autonomous Workflow
curl http://localhost:3000/api/verification?check=autonomous
```

### 3. Dashboard Access

- **Main Application**: `http://your-domain.com`
- **Autonomous Dashboard**: `http://your-domain.com/level3-autonomous`
- **System Monitoring**: `http://your-domain.com/terminal`
- **API Verification**: `http://your-domain.com/api/verification?check=all`

## 🔍 Monitoring & Maintenance

### Real-time Monitoring

```bash
# Application logs
pm2 logs rfp-autonomous --lines 100

# System monitoring
pm2 monit

# System logs
tail -f /var/log/rfp-autonomous.log
```

### Automated Backups

```bash
# Manual backup
./scripts/backup-system.sh

# Check backup schedule
crontab -l
```

### System Updates

```bash
# Run system updates
./scripts/update-system.sh

# Update application
git pull origin main
npm install
npm run build
pm2 restart rfp-autonomous
```

## 🎯 Level 3 Autonomous Features

### Autonomous Workflow Status

The system includes these autonomous components:

1. **LinkedIn Monitor Agent**: Scans LinkedIn for RFP opportunities 24/7
2. **RFP Analysis Agent**: Analyzes opportunities using Claude AI
3. **Response Generator Agent**: Creates customized proposals
4. **Outreach Coordinator Agent**: Manages email campaigns
5. **Learning Agent**: Improves from outcomes and feedback

### Verification Commands

```bash
# Check autonomous agents status
curl http://localhost:3000/api/autonomous/status

# View recent autonomous activities
curl http://localhost:3000/api/autonomous/activities

# Check learning progress
curl http://localhost:3000/api/autonomous/learning
```

## 🚨 Troubleshooting

### Common Issues

1. **Application won't start**:
   ```bash
   pm2 logs rfp-autonomous
   # Check environment variables in .env.production
   ```

2. **Claude Agent SDK not working**:
   ```bash
   curl http://localhost:3000/api/verification?check=sdk
   # Verify ANTHROPIC_API_KEY is correct
   ```

3. **MCP Tools not connected**:
   ```bash
   curl http://localhost:3000/api/verification?check=mcp
   # Check MCP server configurations
   ```

4. **Database connection issues**:
   ```bash
   curl http://localhost:3000/api/verification?check=database
   # Verify database credentials and network access
   ```

### Performance Optimization

```bash
# Check memory usage
pm2 show rfp-autonomous

# Optimize PM2 configuration
pm2 delete rfp-autonomous
pm2 start ecosystem.config.js

# Restart services
sudo systemctl restart nginx
```

## 📞 Support

If you encounter issues:

1. Check logs: `pm2 logs rfp-autonomous`
2. Run verification: `curl http://localhost:3000/api/verification?check=all`
3. Check system status: `pm2 status`
4. Review this guide for common solutions

## 🎉 Success Criteria

Your Level 3 Autonomous RFP System is successfully deployed when:

- ✅ Application responds on port 3000
- ✅ Nginx reverse proxy is working
- ✅ PM2 processes are running stable
- ✅ Claude Agent SDK verification passes
- ✅ MCP tools are connected
- ✅ Autonomous agents are active
- ✅ Database connections work
- ✅ SSL certificate is installed (optional)
- ✅ System monitoring is active
- ✅ Backup scripts are scheduled

---

**Next Steps**: After successful deployment, access your autonomous dashboard and initialize the learning system with your first RFP analysis workflow.