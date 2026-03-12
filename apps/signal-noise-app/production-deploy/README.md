# 🚀 Level 3 Autonomous RFP System - Production Deployment

## 📋 Overview

This is the complete production deployment package for the **Level 3 Autonomous RFP Intelligence System** - a 24/7 self-operating business intelligence platform that automatically discovers, analyzes, and responds to RFP opportunities using AI agents.

### System Features

- **🤖 Fully Autonomous**: 24/7 operation with self-adjusting strategies
- **🧠 AI-Powered**: Claude Agent SDK with advanced reasoning capabilities
- **📊 Multi-Source Monitoring**: LinkedIn, government portals, web scraping
- **🔗 Graph Intelligence**: FalkorDB-backed relationship mapping and analysis
- **📈 Learning System**: Continuous improvement from outcomes
- **📧 Intelligent Outreach**: AI-generated personalized responses
- **🔄 Real-time Processing**: Live streaming and instant notifications

## 📦 Package Contents

```
production-deploy/
├── deploy-production.sh           # Main deployment script
├── ecosystem.config.js            # PM2 process configuration
├── nginx.conf                     # Nginx reverse proxy config
├── .env.production.template        # Environment variables template
├── supabase-schema-level3.sql     # Database schema
├── neo4j-schema-level3.cypher     # Knowledge graph schema
├── scripts/
│   ├── monitor-system.sh          # System monitoring script
│   └── backup-system.sh           # Automated backup script
├── README.md                      # This file
└── ../legacy/neo4j/docs/DEPLOYMENT-GUIDE.md  # Historical deployment guide
```

## ⚡ Quick Deployment

### Prerequisites

- Ubuntu 20.04+ or Debian 11+ server
- SSH access with sudo privileges
- Domain name (optional, for SSL)

### One-Command Deployment

```bash
# 1. Upload files to server
scp -i /path/to/your/key.pem production-deploy/* user@your-server:/tmp/

# 2. Connect and run deployment
ssh -i /path/to/your/key.pem user@your-server
cd /tmp
chmod +x deploy-production.sh
./deploy-production.sh
```

### Manual Deployment

```bash
# 1. Git clone (recommended)
git clone <your-repository-url> /opt/rfp-autonomous
cd /opt/rfp-autonomous

# 2. Install dependencies
npm install
npm run build

# 3. Configure environment
cp .env.production.template .env.production
# Edit .env.production with your API keys

# 4. Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# 5. Setup Nginx
sudo cp nginx.conf /etc/nginx/sites-available/rfp-autonomous
sudo ln -s /etc/nginx/sites-available/rfp-autonomous /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx

# 6. Setup monitoring
sudo cp scripts/monitor-system.sh /usr/local/bin/rfp-monitor
sudo cp scripts/backup-system.sh /usr/local/bin/rfp-backup
sudo chmod +x /usr/local/bin/rfp-*

# 7. Setup cron jobs
crontab -e
# Add these lines:
# */5 * * * * /usr/local/bin/rfp-monitor
# 0 2 * * * /usr/local/bin/rfp-backup
```

## 🔧 Configuration

### Environment Variables

Edit `.env.production` with your actual values:

```bash
# Claude Agent SDK
ANTHROPIC_API_KEY=your-anthropic-api-key
ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic

# Supabase Database
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# FalkorDB Graph
FALKORDB_URI=redis://your-instance
FALKORDB_USER=default
FALKORDB_PASSWORD=your-password
FALKORDB_DATABASE=sports_intelligence

# MCP Tools
BRIGHTDATA_API_TOKEN=your-brightdata-token
PERPLEXITY_API_KEY=your-perplexity-key

# AWS S3 (Badges)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-bucket

# Email Service
RESEND_API_KEY=your-resend-key
RESEND_FROM_EMAIL=noreply@your-domain.com

# Security
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=$(openssl rand -base64 32)
```

### Database Setup

#### Supabase Setup

1. Create a new Supabase project
2. Run the schema: `supabase-schema-level3.sql`
3. Get connection details and update environment

#### FalkorDB Setup

1. Create or provision a FalkorDB instance
2. Run the graph schema or import flow that matches your deployment
3. Update environment with connection details

## 🏥 Verification

### System Health Check

```bash
# Check application status
pm2 status

# Check web application
curl http://localhost:3000/api/health

# Full system verification
curl http://localhost:3000/api/verification?check=all
```

### Autonomous System Test

```bash
# Test Claude Agent SDK
curl http://localhost:3000/api/verification?check=sdk

# Test MCP Tools
curl http://localhost:3000/api/verification?check=mcp

# Test Autonomous Agents
curl http://localhost:3000/api/verification?check=autonomous
```

## 📊 Monitoring

### Real-time Monitoring

```bash
# PM2 monitoring dashboard
pm2 monit

# Application logs
pm2 logs rfp-autonomous

# System monitoring logs
tail -f /var/log/rfp-autonomous-monitor.log

# Nginx access logs
sudo tail -f /var/log/nginx/access.log
```

### Dashboard URLs

- **Main Application**: `http://your-domain.com`
- **Autonomous Dashboard**: `http://your-domain.com/level3-autonomous`
- **System Terminal**: `http://your-domain.com/terminal`
- **API Verification**: `http://your-domain.com/api/verification?check=all`

## 🔒 SSL Setup

### Automatic SSL with Let's Encrypt

```bash
# Replace domain in nginx.conf first
sudo nano /etc/nginx/sites-available/rfp-autonomous
# Change 'server_name _;' to 'server_name your-domain.com;'

# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Verify auto-renewal
sudo systemctl status certbot.timer
```

## 🚨 Troubleshooting

### Common Issues

#### Application Won't Start

```bash
# Check PM2 logs
pm2 logs rfp-autonomous

# Check environment variables
pm2 env rfp-autonomous

# Check Node.js version
node --version  # Should be 18.x or higher
```

#### Database Connection Issues

```bash
# Test database connections
curl http://localhost:3000/api/verification?check=database

# Check network connectivity
ping your-database-host.com
```

#### High Memory Usage

```bash
# Check memory usage
pm2 show rfp-autonomous

# Restart if needed
pm2 restart rfp-autonomous

# Adjust PM2 configuration
nano ecosystem.config.js
# Change max_memory_restart if needed
```

#### Autonomous Agents Not Working

```bash
# Check API keys are correct
grep ANTHROPIC_API_KEY .env.production

# Test Claude SDK directly
curl -X POST http://localhost:3000/api/claude-agent/test \
  -H "Content-Type: application/json" \
  -d '{"test": true}'

# Check MCP server status
curl http://localhost:3000/api/verification?check=mcp
```

### Performance Optimization

```bash
# Check system resources
htop
df -h
free -h

# Optimize PM2
pm2 delete rfp-autonomous
pm2 start ecosystem.config.js

# Clear Node.js cache
pm2 restart rfp-autonomous
```

## 📈 Scaling

### Horizontal Scaling

```bash
# Increase PM2 instances
nano ecosystem.config.js
# Change 'instances: 2' to desired number

# Restart with new configuration
pm2 delete rfp-autonomous
pm2 start ecosystem.config.js
```

### Database Scaling

- **Supabase**: Upgrade to larger compute tier
- **FalkorDB**: Scale graph capacity or add memory
- **Redis**: Add caching layer for frequent queries

## 🔄 Updates

### Application Updates

```bash
# Update application code
cd /opt/rfp-autonomous
git pull origin main
npm install
npm run build

# Restart with zero downtime
pm2 reload rfp-autonomous
```

### System Updates

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Update Node.js to latest 18.x
sudo apt install --only-upgrade nodejs npm

# Restart services
sudo systemctl restart nginx
pm2 restart rfp-autonomous
```

## 📞 Support

### Log Analysis

```bash
# Recent application logs
pm2 logs rfp-autonomous --lines 50

# System monitoring logs
tail -n 100 /var/log/rfp-autonomous-monitor.log

# Nginx errors
sudo tail -n 50 /var/log/nginx/error.log
```

### Performance Metrics

```bash
# PM2 metrics
pm2 show rfp-autonomous

# System metrics
df -h
free -h
uptime

# Application metrics
curl http://localhost:3000/api/metrics
```

## 🎯 Success Criteria

Your Level 3 Autonomous System is working when:

- ✅ **Application**: Responds on port 3000 with health checks passing
- ✅ **Autonomous Agents**: Claude Agent SDK and MCP tools operational  
- ✅ **Database**: Supabase and FalkorDB connections working
- ✅ **Monitoring**: System monitoring and backups scheduled
- ✅ **Web Server**: Nginx reverse proxy serving traffic
- ✅ **Learning**: Autonomous agents learning from outcomes
- ✅ **Outreach**: Intelligent email generation and sending
- ✅ **Discovery**: Continuous RFP opportunity monitoring

## 📚 Next Steps

1. **Configure API Keys**: Update `.env.production` with actual values
2. **Set Up Domain**: Configure DNS and SSL certificate
3. **Initialize Learning**: Seed with historical data for better AI performance
4. **Customize Agents**: Adjust autonomous behavior for your specific needs
5. **Monitor Performance**: Set up alerts and notifications
6. **Scale Resources**: Adjust based on usage patterns

---

**🎉 Congratulations!** Your Level 3 Autonomous RFP System is now ready to transform your business development process with 24/7 intelligent automation.

For the archived Neo4j-era deployment notes, see [`../legacy/neo4j/docs/DEPLOYMENT-GUIDE.md`](/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/legacy/neo4j/docs/DEPLOYMENT-GUIDE.md).
