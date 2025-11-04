# ClaudeBox Multi-Slot System - Deployment Guide

## 🚀 Deployment Overview

This guide provides comprehensive instructions for deploying the ClaudeBox Multi-Slot System to production environments. The deployment process involves setting up infrastructure, configuring services, and ensuring high availability and security.

## 📋 Prerequisites

### System Requirements
- **CPU**: 8 cores minimum (16+ recommended)
- **RAM**: 16GB minimum (32GB+ recommended)
- **Storage**: 500GB SSD minimum (1TB+ recommended)
- **Network**: 1Gbps minimum (10Gbps recommended)
- **OS**: Ubuntu 22.04 LTS or later

### Software Requirements
- **Node.js**: 18.x or later
- **PM2**: 5.x or later
- **Docker**: 24.x or later
- **Neo4j**: 5.x or later
- **Nginx**: 1.18 or later
- **Redis**: 6.x or later

### Domain and SSL
- Registered domain name
- SSL/TLS certificates (Let's Encrypt recommended)
- DNS configuration for subdomains

## 🏗️ Architecture Overview

### Production Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Load Balancer │    │   Application   │    │   Database      │
│     (Nginx)     │────│    Servers      │────│    (Neo4j)      │
└─────────────────┘    │   (Cluster)     │    └─────────────────┘
                       └─────────────────┘
                              │
                       ┌─────────────────┐
                       │   Monitoring    │
                       │   (Prometheus)  │
                       └─────────────────┘
```

### Service Components
1. **Load Balancer**: Nginx for traffic distribution
2. **Application Servers**: Node.js cluster with PM2
3. **Database**: Neo4j for data persistence
4. **Cache**: Redis for session storage and caching
5. **Monitoring**: Prometheus and Grafana for metrics
6. **Logging**: ELK stack for log aggregation

## 🔧 Infrastructure Setup

### 1. Server Preparation
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y curl wget git nginx software-properties-common

# Add Node.js repository
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Redis
sudo apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Install Neo4j
wget -O - https://debian.neo4j.com/neotechnology.gpg.key | sudo apt-key add -
echo 'deb https://debian.neo4j.com stable latest' | sudo tee /etc/apt/sources.list.d/neo4j.list
sudo apt update
sudo apt install -y neo4j
```

### 2. Database Setup
```bash
# Configure Neo4j
sudo nano /etc/neo4j/neo4j.conf

# Add these configurations:
dbms.default_listen_address=0.0.0.0
dbms.connector.bolt.listen_address=0.0.0.0:7687
dbms.connector.http.listen_address=0.0.0.0:7474
dbms.memory.heap.initial_size=512m
dbms.memory.heap.max_size=2G
dbms.memory.pagecache.size=1G

# Start Neo4j
sudo systemctl restart neo4j
sudo systemctl enable neo4j

# Verify Neo4j is running
sudo systemctl status neo4j
```

### 3. Application Setup
```bash
# Clone repository
git clone https://github.com/claudebox/multi-slot.git
cd multi-slot

# Install dependencies
npm install

# Build application
npm run build

# Create environment file
cp .env.example .env
nano .env

# Environment configuration:
NODE_ENV=production
PORT=3000
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_neo4j_password
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_jwt_secret_here
SESSION_SECRET=your_session_secret_here
ENCRYPTION_KEY=your_encryption_key_here
BETTER_AUTH_MCP_URL=https://mcp.chonkie.ai/better-auth/better-auth-builder/mcp
BETTER_AUTH_API_KEY=your_better_auth_api_key
```

## 🚀 Deployment Process

### 1. Application Deployment
```bash
# Create PM2 ecosystem configuration
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [
    {
      name: 'claudebox-api',
      script: 'src/app.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '1G'
    },
    {
      name: 'claudebox-worker',
      script: 'src/worker.js',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/worker-err.log',
      out_file: './logs/worker-out.log',
      log_file: './logs/worker-combined.log',
      autorestart: true
    },
    {
      name: 'claudebox-monitor',
      script: 'src/monitor.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/monitor-err.log',
      out_file: './logs/monitor-out.log',
      autorestart: true
    }
  ]
};
EOF

# Create log directories
mkdir -p logs

# Start application
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup
```

### 2. Nginx Configuration
```bash
# Create Nginx configuration
cat > /etc/nginx/sites-available/claudebox << EOF
server {
    listen 80;
    server_name api.claudebox.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.claudebox.com;
    
    ssl_certificate /etc/letsencrypt/live/api.claudebox.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.claudebox.com/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    
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
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
    
    # Rate limiting
    limit_req_zone \$binary_remote_addr zone=api:10m rate=100r/s;
    limit_req zone=api burst=50 nodelay;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
}
EOF

# Enable site
ln -s /etc/nginx/sites-available/claudebox /etc/nginx/sites-enabled/

# Test Nginx configuration
nginx -t

# Restart Nginx
systemctl restart nginx
```

### 3. SSL Certificate Setup
```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d api.claudebox.com

# Test auto-renewal
sudo certbot renew --dry-run
```

### 4. Monitoring Setup
```bash
# Install Prometheus
sudo apt install -y prometheus prometheus-node-exporter

# Configure Prometheus
cat > /etc/prometheus/prometheus.yml << EOF
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'claudebox-api'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
    scrape_interval: 30s

  - job_name: 'node'
    static_configs:
      - targets: ['localhost:9100']

  - job_name: 'redis'
    static_configs:
      - targets: ['localhost:6379']

  - job_name: 'neo4j'
    static_configs:
      - targets: ['localhost:7474']
EOF

# Start Prometheus
sudo systemctl start prometheus
sudo systemctl enable prometheus

# Install Grafana
sudo apt install -y software-properties-common
sudo add-apt-repository "deb https://packages.grafana.com/oss/deb stable main"
sudo apt update
sudo apt install -y grafana

# Start Grafana
sudo systemctl start grafana-server
sudo systemctl enable grafana-server
```

## 🔒 Security Configuration

### 1. Firewall Setup
```bash
# Install UFW
sudo apt install -y ufw

# Configure firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
sudo ufw allow 3000/tcp  # Application
sudo ufw allow 7474/tcp  # Neo4j HTTP
sudo ufw allow 7687/tcp  # Neo4j Bolt
sudo ufw allow 6379/tcp  # Redis

# Enable firewall
sudo ufw enable
```

### 2. Application Security
```bash
# Create dedicated user for application
sudo useradd -m -s /bin/bash claudebox
sudo usermod -aG docker claudebox

# Set proper permissions
sudo chown -R claudebox:claudebox /path/to/claudebox
sudo chmod -R 755 /path/to/claudebox

# Configure apparmor for application
cat > /etc/apparmor.d/claudebox << EOF
profile claudebox {
  # Allow network access
  network inet stream,
  network inet6 stream,
  
  # Allow file access in application directory
  /path/to/claudebox/** r,
  /path/to/claudebox/** w,
  
  # Allow access to specific ports
  /etc/passwd r,
  /etc/group r,
  /proc/** r,
}
EOF

# Load apparmor profile
sudo apparmor_parser -r /etc/apparmor.d/claudebox
```

### 3. Database Security
```bash
# Secure Neo4j
sudo nano /etc/neo4j/neo4j.conf

# Add security configurations:
dbms.security.auth_enabled=true
dbms.security.procedures.unrestricted=apoc.*
dbms.security.procedures.allowlist=apoc.*
dbms.connector.bolt.tls_level=OPTIONAL

# Set strong password for Neo4j
sudo -u neo4j cypher-shell -u neo4j -p neo4j "CALL dbms.security.changePassword('your_strong_password')"
```

## 📊 Backup and Recovery

### 1. Automated Backup Script
```bash
# Create backup script
cat > /usr/local/bin/claudebox-backup.sh << EOF
#!/bin/bash

BACKUP_DIR="/backup/claudebox"
DATE=\$(date +%Y%m%d_%H%M%S)
BACKUP_PATH="\$BACKUP_DIR/\$DATE"

# Create backup directory
mkdir -p \$BACKUP_PATH

# Backup Neo4j
sudo -u neo4j neo4j-admin backup --database=neo4j --to=\$BACKUP_PATH/neo4j --compress

# Backup application data
tar -czf \$BACKUP_PATH/app-data.tar.gz /path/to/claudebox/data

# Backup configuration files
tar -czf \$BACKUP_PATH/config.tar.gz /path/to/claudebox/.env /etc/nginx/sites-available/claudebox

# Upload to cloud storage (optional)
# aws s3 sync \$BACKUP_PATH s3://your-backup-bucket/claudebox/\$DATE

# Remove old backups (keep last 30 days)
find \$BACKUP_DIR -type d -mtime +30 -exec rm -rf {} \;

echo "Backup completed: \$BACKUP_PATH"
EOF

# Make script executable
sudo chmod +x /usr/local/bin/claudebox-backup.sh

# Setup cron job for daily backups
echo "0 2 * * * /usr/local/bin/claudebox-backup.sh" | sudo crontab -
```

### 2. Recovery Procedure
```bash
# Create recovery script
cat > /usr/local/bin/claudebox-recover.sh << EOF
#!/bin/bash

BACKUP_DATE=\$1
BACKUP_DIR="/backup/claudebox/\$BACKUP_DATE"

if [ ! -d "\$BACKUP_DIR" ]; then
    echo "Backup directory not found: \$BACKUP_DIR"
    exit 1
fi

# Stop services
pm2 stop all
sudo systemctl stop nginx
sudo systemctl stop neo4j

# Restore Neo4j
sudo -u neo4j neo4j-admin restore --database=neo4j --from=\$BACKUP_DIR/neo4j

# Restore application data
tar -xzf \$BACKUP_DIR/app-data.tar.gz -C /

# Restore configuration
tar -xzf \$BACKUP_DIR/config.tar.gz -C /

# Start services
sudo systemctl start neo4j
sudo systemctl start nginx
pm2 start all

echo "Recovery completed from: \$BACKUP_DATE"
EOF

# Make script executable
sudo chmod +x /usr/local/bin/claudebox-recover.sh
```

## 🚀 Scaling and Load Balancing

### 1. Horizontal Scaling
```bash
# Create additional application servers
# Follow the same setup process on each server

# Configure load balancing
cat > /etc/nginx/sites-available/claudebox-lb << EOF
upstream claudebox_backend {
    least_conn;
    server server1.claudebox.com:3000 weight=3;
    server server2.claudebox.com:3000 weight=3;
    server server3.claudebox.com:3000 weight=2;
    keepalive 32;
}

server {
    listen 80;
    server_name api.claudebox.com;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.claudebox.com;
    
    ssl_certificate /etc/letsencrypt/live/api.claudebox.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.claudebox.com/privkey.pem;
    
    location / {
        proxy_pass http://claudebox_backend;
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
EOF
```

### 2. Database Scaling
```bash
# Setup Neo4j cluster for high availability
# Configure causal clustering
cat > /etc/neo4j/neo4j.conf << EOF
# Causal clustering configuration
dbms.mode= CORE
dbms.clustering.minimum_core_cluster_size_at_startup=3
dbms.clustering.minimum_core_cluster_size=3
dbms.clustering.random_seed_server_id=1
dbms.clustering.server_id=1
causal_clustering.initial_discovery_members=server1.claudebox.com:5000,server2.claudebox.com:5000,server3.claudebox.com:5000
dbms.connectors.default_listen_address=0.0.0.0
dbms.connector.bolt.listen_address=0.0.0.0:7687
dbms.connector.http.listen_address=0.0.0.0:7474
dbms.security.auth_enabled=true
EOF
```

## 🔍 Monitoring and Alerting

### 1. Health Check Endpoints
```javascript
// src/health.js
const express = require('express');
const router = express.Router();

router.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date(),
      version: process.env.npm_package_version || '1.0.0',
      checks: {
        database: await checkDatabase(),
        redis: await checkRedis(),
        memory: checkMemory(),
        disk: checkDisk()
      }
    };
    
    const isHealthy = Object.values(health.checks).every(check => check.status === 'healthy');
    health.status = isHealthy ? 'healthy' : 'unhealthy';
    
    res.status(isHealthy ? 200 : 503).json(health);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date(),
      error: error.message
    });
  }
});

async function checkDatabase() {
  try {
    const result = await neo4jDriver.executeQuery('RETURN 1');
    return { status: 'healthy', responseTime: result.result.consume().resultAvailableAfter };
  } catch (error) {
    return { status: 'unhealthy', error: error.message };
  }
}

async function checkRedis() {
  try {
    const result = await redisClient.ping();
    return { status: 'healthy', responseTime: result };
  } catch (error) {
    return { status: 'unhealthy', error: error.message };
  }
}

function checkMemory() {
  const used = process.memoryUsage();
  const total = require('os').totalmem();
  const usage = (used.heapUsed / total) * 100;
  
  return {
    status: usage > 90 ? 'unhealthy' : 'healthy',
    usage: usage,
    heapUsed: used.heapUsed,
    total: total
  };
}

function checkDisk() {
  const fs = require('fs');
  const disk = require('diskusage');
  
  try {
    const info = disk.checkSync('/');
    const usage = (info.used / info.total) * 100;
    
    return {
      status: usage > 90 ? 'unhealthy' : 'healthy',
      usage: usage,
      used: info.used,
      total: info.total,
      available: info.available
    };
  } catch (error) {
    return { status: 'unhealthy', error: error.message };
  }
}

module.exports = router;
```

### 2. Metrics Collection
```javascript
// src/metrics.js
const promClient = require('prom-client');

// Create metrics
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5, 10]
});

const activeSlots = new promClient.Gauge({
  name: 'claudebox_active_slots',
  help: 'Number of active slots',
  labelNames: ['user_id', 'status']
});

const resourceUsage = new promClient.Gauge({
  name: 'claudebox_resource_usage',
  help: 'Resource usage metrics',
  labelNames: ['slot_id', 'resource_type']
});

// Middleware to collect metrics
function metricsMiddleware(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration
      .labels(req.method, req.route.path, res.statusCode)
      .observe(duration);
  });
  
  next();
}

// Function to update slot metrics
function updateSlotMetrics(slots) {
  activeSlots.reset();
  
  slots.forEach(slot => {
    activeSlots.labels(slot.userId, slot.status).inc();
    
    if (slot.resourceUsage) {
      resourceUsage
        .labels(slot.id, 'cpu')
        .set(slot.resourceUsage.cpu);
      resourceUsage
        .labels(slot.id, 'memory')
        .set(slot.resourceUsage.memory);
      resourceUsage
        .labels(slot.id, 'storage')
        .set(slot.resourceUsage.storage);
    }
  });
}

module.exports = {
  metricsMiddleware,
  updateSlotMetrics,
  httpRequestDuration,
  activeSlots,
  resourceUsage
};
```

## 🚨 Troubleshooting

### Common Issues and Solutions

#### 1. Application Won't Start
```bash
# Check logs
pm2 logs claudebox-api

# Check Node.js version
node --version

# Check port availability
netstat -tulpn | grep :3000

# Check dependencies
npm list --depth=0
```

#### 2. Database Connection Issues
```bash
# Check Neo4j status
sudo systemctl status neo4j

# Check Neo4j logs
sudo tail -f /var/log/neo4j/debug.log

# Test connection
cypher-shell -u neo4j -p your_password -h localhost -P 7687 "RETURN 1"
```

#### 3. Performance Issues
```bash
# Check system resources
htop
df -h
free -m

# Check application metrics
curl http://localhost:3000/metrics

# Check PM2 status
pm2 monit
```

### Log Analysis
```bash
# View application logs
pm2 logs claudebox-api

# View Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# View system logs
sudo journalctl -u nginx -f
sudo journalctl -u neo4j -f
```

## 📋 Deployment Checklist

### Pre-Deployment
- [ ] Server meets minimum requirements
- [ ] Domain name configured
- [ ] SSL certificates obtained
- [ ] Database credentials prepared
- [ ] Environment variables configured
- [ ] Backup strategy in place

### Deployment Process
- [ ] Application code deployed
- [ ] Dependencies installed
- [ ] Database configured
- [ ] Services started
- [ ] Load balancer configured
- [ ] SSL certificates installed
- [ ] Monitoring setup
- [ ] Backup jobs scheduled

### Post-Deployment
- [ ] Health checks passing
- [ ] Metrics collecting
- [ ] Alerts configured
- [ ] Performance verified
- [ ] Security scans completed
- [ ] Documentation updated
- [ ] Team notified

---

## 📞 Support

For deployment assistance, please contact:
- **Technical Support**: tech-support@claudebox.com
- **Emergency Support**: +1 (555) 999-9999
- **Documentation**: docs.claudebox.com
- **Community**: deploy-forum.claudebox.com

---

*Last Updated: September 28, 2025*  
*Version: 1.0.0*