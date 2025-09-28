# ClaudeBox Multi-Slot System - Troubleshooting Guide

## 🔍 Troubleshooting Overview

This guide provides comprehensive troubleshooting information for the ClaudeBox Multi-Slot System. It covers common issues, diagnostic procedures, and solutions for system administrators and users.

## 🚨 Emergency Procedures

### System Down - Immediate Actions
```bash
# 1. Check system status
pm2 status
sudo systemctl status nginx neo4j redis

# 2. Check resource usage
htop
df -h
free -m

# 3. Check application logs
pm2 logs claudebox-api --lines 100

# 4. Check system logs
sudo journalctl -xe --no-pager

# 5. Restart critical services
sudo systemctl restart nginx
sudo systemctl restart neo4j
pm2 restart all
```

### Database Failure Recovery
```bash
# 1. Check Neo4j status
sudo systemctl status neo4j

# 2. Check Neo4j logs
sudo tail -f /var/log/neo4j/debug.log

# 3. Restart Neo4j
sudo systemctl restart neo4j

# 4. If restart fails, try recovery
sudo systemctl stop neo4j
neo4j-admin check-consistency --database=neo4j
sudo systemctl start neo4j

# 5. Restore from backup if necessary
sudo systemctl stop neo4j
neo4j-admin restore --database=neo4j --from=/backup/path
sudo systemctl start neo4j
```

### Authentication Failure
```bash
# 1. Check Better Auth MCP connection
curl -X POST https://mcp.chonkie.ai/better-auth/better-auth-builder/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"health","id":1}'

# 2. Check session store
redis-cli ping
redis-cli info keys | grep session

# 3. Check JWT configuration
node -e "console.log(require('jsonwebtoken').decode('your_jwt_token'))"

# 4. Clear cache
redis-cli FLUSHDB
```

## 📊 Common Issues by Category

### 1. Authentication Issues

#### Problem: Users Cannot Login
**Symptoms:**
- Login page returns "Invalid credentials"
- Authentication loop
- Session not created

**Diagnosis:**
```bash
# Check authentication service logs
pm2 logs claudebox-auth

# Check Better Auth MCP connection
curl -X POST https://mcp.chonkie.ai/better-auth/better-auth-builder/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"health","id":1}'

# Check database connectivity
cypher-shell -u neo4j -p your_password -h localhost -P 7687 "MATCH (u:User) RETURN COUNT(u)"

# Check Redis connectivity
redis-cli ping
```

**Solutions:**
```bash
# 1. Restart authentication service
pm2 restart claudebox-auth

# 2. Verify Better Auth MCP configuration
# Check .env file for BETTER_AUTH_MCP_URL and BETTER_AUTH_API_KEY

# 3. Clear user sessions
redis-cli DEL "sessions:*"

# 4. Reset user passwords (if needed)
# Use admin interface to reset passwords
```

#### Problem: Sessions Expire Immediately
**Symptoms:**
- Users logged out immediately after login
- JWT tokens invalid
- Session cookies not persisting

**Diagnosis:**
```bash
# Check session configuration
grep -i session .env

# Check JWT secret
node -e "console.log(process.env.JWT_SECRET)"

# Check cookie configuration
grep -i cookie src/config/session.js

# Check system time
date
```

**Solutions:**
```bash
# 1. Update session configuration
echo "SESSION_TIMEOUT=86400000" >> .env

# 2. Regenerate JWT secret
echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env

# 3. Restart services
pm2 restart all

# 4. Check system time synchronization
sudo ntpdate pool.ntp.org
```

### 2. Slot Management Issues

#### Problem: Slots Won't Start
**Symptoms:**
- Slot creation fails
- Slots stuck in "creating" state
- No terminal access

**Diagnosis:**
```bash
# Check slot service logs
pm2 logs claudebox-slot

# Check resource availability
free -m
df -h

# Check slot registry
redis-cli GET "slots:registry"

# Check PM2 processes
pm2 status

# Check SSH connectivity
ssh -i /path/to/key user@host "echo 'SSH working'"
```

**Solutions:**
```bash
# 1. Check resource availability
if [ $(free -m | awk 'NR==2{printf "%.2f", $3*100/$2 }') -gt 90 ]; then
    echo "Memory usage too high"
    pm2 restart all
fi

# 2. Clear stuck slots
redis-cli DEL "slots:stuck"

# 3. Restart slot service
pm2 restart claudebox-slot

# 4. Check SSH key permissions
chmod 600 /path/to/ssh/key
```

#### Problem: Slots Disappear
**Symptoms:**
- Slots not listed in user dashboard
- Slot data missing from database
- Inconsistent slot state

**Diagnosis:**
```bash
# Check database consistency
cypher-shell -u neo4j -p your_password -h localhost -P 7687 \
  "MATCH (s:Slot) RETURN COUNT(s)"

# Check Redis cache
redis-cli KEYS "slots:*"

# Check service logs
pm2 logs claudebox-slot

# Check for data corruption
redis-cli --scan --pattern "slots:*" | xargs -I {} redis-cli GET {}
```

**Solutions:**
```bash
# 1. Rebuild slot registry
node scripts/rebuild-slot-registry.js

# 2. Clear cache
redis-cli FLUSHDB

# 3. Restore from backup
/usr/local/bin/claudebox-recover.sh 20250928_020000

# 4. Database repair
sudo systemctl stop neo4j
neo4j-admin check-consistency --database=neo4j
sudo systemctl start neo4j
```

### 3. Performance Issues

#### Problem: Slow Response Times
**Symptoms:**
- Terminal lag
- Slow API responses
- High latency

**Diagnosis:**
```bash
# Check system resources
htop
iostat -x 1 10
netstat -i

# Check application metrics
curl -s http://localhost:3000/metrics | grep -i duration

# Check database queries
cypher-shell -u neo4j -p your_password -h localhost -P 7687 \
  "EXPLAIN MATCH (u:User) RETURN u LIMIT 100"

# Check network connectivity
ping google.com
traceroute google.com
```

**Solutions:**
```bash
# 1. Optimize database
cypher-shell -u neo4j -p your_password -h localhost -P 7687 \
  "CREATE INDEX user_email_idx IF NOT EXISTS FOR (u:User) ON (u.email)"

# 2. Increase application instances
pm2 scale claudebox-api +2

# 3. Clear cache
redis-cli FLUSHDB

# 4. Optimize system
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
echo 'net.core.somaxconn=65536' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

#### Problem: High Memory Usage
**Symptoms:**
- System becoming unresponsive
- Memory allocation errors
- Services crashing

**Diagnosis:**
```bash
# Check memory usage
free -h
ps aux --sort=-%mem | head -10

# Check Node.js memory
node -e "console.log(process.memoryUsage())"

# Check garbage collection
node -e "global.gc(); console.log('GC completed')"

# Check memory leaks
pm2 monit
```

**Solutions:**
```bash
# 1. Restart memory-intensive services
pm2 restart claudebox-api

# 2. Configure memory limits
echo 'export NODE_OPTIONS="--max-old-space-size=4096"' >> ~/.bashrc

# 3. Add swap space if needed
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# 4. Monitor and optimize
pm2 monit
```

### 4. Network Issues

#### Problem: Connection Timeouts
**Symptoms:**
- "Connection refused" errors
- SSH tunnel failures
- Web terminal not responding

**Diagnosis:**
```bash
# Check network interfaces
ifconfig
ip addr show

# Check listening ports
netstat -tulpn | grep :3000
netstat -tulpn | grep :7687

# Check firewall
sudo ufw status
sudo iptables -L

# Check SSH tunnels
ps aux | grep ssh
```

**Solutions:**
```bash
# 1. Restart network services
sudo systemctl restart networking
sudo systemctl restart ssh

# 2. Check firewall rules
sudo ufw allow 3000/tcp
sudo ufw allow 7687/tcp
sudo ufw allow 7474/tcp

# 3. Rebuild SSH tunnels
# Kill existing tunnels
pkill -f "ssh -L"

# Create new tunnels
ssh -N -L 7681:localhost:7681 user@remote-host

# 4. Check DNS resolution
nslookup google.com
```

#### Problem: SSL Certificate Issues
**Symptoms:**
- Browser security warnings
- HTTPS not working
- Certificate validation errors

**Diagnosis:**
```bash
# Check certificate status
sudo certbot certificates

# Check certificate expiration
openssl x509 -in /etc/letsencrypt/live/api.claudebox.com/fullchain.pem -noout -dates

# Check Nginx configuration
nginx -t

# Check certificate chain
openssl s_client -connect api.claudebox.com:443 -showcerts
```

**Solutions:**
```bash
# 1. Renew certificates
sudo certbot renew

# 2. Force certificate renewal
sudo certbot certonly --force-renewal -d api.claudebox.com

# 3. Fix Nginx configuration
sudo nano /etc/nginx/sites-available/claudebox
sudo systemctl restart nginx

# 4. Check certificate permissions
sudo chmod 644 /etc/letsencrypt/live/api.claudebox.com/*
sudo chown -R www-data:www-data /etc/letsencrypt/live/api.claudebox.com/
```

## 🛠️ Advanced Troubleshooting

### 1. Database Issues

#### Neo4j Performance Problems
```bash
# Check Neo4j performance metrics
cypher-shell -u neo4j -p your_password -h localhost -P 7687 \
  "CALL dbms.procedures() YIELD name, signature \
   WHERE name STARTS WITH 'dbms.query' \
   RETURN name, signature"

# Check slow queries
cypher-shell -u neo4j -p your_password -h localhost -P 7687 \
  "CALL dbms.listQueries() YIELD query, elapsedTimeMillis \
   WHERE elapsedTimeMillis > 1000 \
   RETURN query, elapsedTimeMillis"

# Check cache usage
cypher-shell -u neo4j -p your_password -h localhost -P 7687 \
  "CALL dbms.listConfig() YIELD name, value \
   WHERE name CONTAINS 'cache' \
   RETURN name, value"
```

#### Database Lock Contention
```bash
# Check for locks
cypher-shell -u neo4j -p your_password -h localhost -P 7687 \
  "CALL dbms.listTransactions() YIELD transactionId, status \
   WHERE status = 'ACTIVE' \
   RETURN transactionId, status"

# Check long-running transactions
cypher-shell -u neo4j -p your_password -h localhost -P 7687 \
  "CALL dbms.listTransactions() YIELD transactionId, startTime, elapsedTime \
   WHERE elapsedTime > 30000 \
   RETURN transactionId, startTime, elapsedTime"

# Kill problematic transactions
cypher-shell -u neo4j -p your_password -h localhost -P 7687 \
  "CALL dbms.killTransaction('transaction-id')"
```

### 2. Application Performance

#### Memory Leaks
```bash
# Check Node.js memory usage
node -e "
const heapdump = require('heapdump');
const v8 = require('v8');
const stats = v8.getHeapStatistics();
console.log('Heap Statistics:', stats);
console.log('Memory Usage:', process.memoryUsage());
"

# Generate heap dump
node -e "
const heapdump = require('heapdump');
heapdump.writeSnapshot('/tmp/heapdump-' + Date.now() + '.heapsnapshot');
"

# Analyze heap dump
node -e "
const snapshot = require('/tmp/heapdump-123456789.heapsnapshot');
console.log('Snapshot loaded');
"
```

#### Event Loop Blocking
```bash
# Check event loop delay
node -e "
const now = Date.now();
setImmediate(() => {
  console.log('Event loop delay:', Date.now() - now, 'ms');
});
"

# Check active handles
node -e "
console.log('Active handles:', process._getActiveHandles().length);
console.log('Active requests:', process._getActiveRequests().length);
"
```

### 3. System-Level Issues

#### Disk Space Issues
```bash
# Check disk usage
df -h
du -sh /* | sort -rh

# Find large files
find / -type f -size +100M -exec ls -lh {} \;

# Clean up logs
sudo journalctl --vacuum-time=7d
sudo logrotate -f /etc/logrotate.conf

# Clean up temporary files
sudo rm -rf /tmp/*
sudo rm -rf /var/tmp/*
```

#### Process Management
```bash
# Check zombie processes
ps aux | awk '$8 ~ /^Z/ { print $2 }'

# Kill zombie processes
sudo kill -9 $(ps aux | awk '$8 ~ /^Z/ { print $2 }')

# Check process limits
ulimit -a

# Increase file descriptor limit
echo "* soft nofile 65536" | sudo tee -a /etc/security/limits.conf
echo "* hard nofile 65536" | sudo tee -a /etc/security/limits.conf
```

## 🔧 Maintenance Procedures

### 1. Regular Maintenance
```bash
# Daily maintenance script
cat > /usr/local/bin/claudebox-maintenance.sh << 'EOF'
#!/bin/bash

# Log rotation
pm2 rotate

# Clean up old logs
find /var/log -name "*.log" -mtime +30 -delete

# Check disk space
df -h | awk '$5 > 90 {print "WARNING: " $6 " is " $5 " full"}'

# Check memory usage
free -m | awk 'NR==2{printf "Memory Usage: %.2f%%\n", $3*100/$2}'

# Backup critical data
/usr/local/bin/claudebox-backup.sh

# Update system packages
sudo apt update
sudo apt upgrade -y

# Restart services if needed
if [ $(pm2 jlist | grep -c "errored") -gt 0 ]; then
    pm2 restart all
fi
EOF

# Make executable
sudo chmod +x /usr/local/bin/claudebox-maintenance.sh

# Add to cron
echo "0 3 * * * /usr/local/bin/claudebox-maintenance.sh" | sudo crontab -
```

### 2. Performance Monitoring
```bash
# Create performance monitoring script
cat > /usr/local/bin/claudebox-monitor.sh << 'EOF'
#!/bin/bash

# Collect system metrics
METRICS_FILE="/var/log/claudebox-metrics.log"
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

# CPU usage
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)

# Memory usage
MEM_USAGE=$(free | awk 'NR==2{printf "%.2f", $3*100/$2}')

# Disk usage
DISK_USAGE=$(df -h / | awk 'NR==2{print $5}' | cut -d'%' -f1)

# Active users
ACTIVE_USERS=$(redis-cli SCARD "active:users" 2>/dev/null || echo 0)

# Active slots
ACTIVE_SLOTS=$(redis-cli SCARD "active:slots" 2>/dev/null || echo 0)

# Log metrics
echo "$TIMESTAMP,CPU:$CPU_USAGE,MEM:$MEM_USAGE,DISK:$DISK_USAGE,USERS:$ACTIVE_USERS,SLOTS:$ACTIVE_SLOTS" >> $METRICS_FILE

# Check thresholds
if (( $(echo "$CPU_USAGE > 80" | bc -l) )); then
    echo "WARNING: High CPU usage: $CPU_USAGE%" | logger -t claudebox-monitor
fi

if (( $(echo "$MEM_USAGE > 80" | bc -l) )); then
    echo "WARNING: High memory usage: $MEM_USAGE%" | logger -t claudebox-monitor
fi

if [ "$DISK_USAGE" -gt 80 ]; then
    echo "WARNING: High disk usage: $DISK_USAGE%" | logger -t claudebox-monitor
fi
EOF

# Make executable
sudo chmod +x /usr/local/bin/claudebox-monitor.sh

# Add to cron (every 5 minutes)
echo "*/5 * * * * /usr/local/bin/claudebox-monitor.sh" | sudo crontab -
```

## 📊 Diagnostic Tools

### 1. Health Check Script
```bash
# Create comprehensive health check
cat > /usr/local/bin/claudebox-health.sh << 'EOF'
#!/bin/bash

echo "=== ClaudeBox Multi-Slot Health Check ==="
echo "Timestamp: $(date)"
echo

# System Health
echo "1. System Health:"
echo "   - CPU: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}')% used"
echo "   - Memory: $(free | awk 'NR==2{printf "%.2f%%", $3*100/$2}')% used"
echo "   - Disk: $(df -h / | awk 'NR==2{print $5}')% used"
echo "   - Load: $(uptime | awk -F'load average:' '{print $2}')"
echo

# Service Status
echo "2. Service Status:"
echo "   - Nginx: $(systemctl is-active nginx)"
echo "   - Neo4j: $(systemctl is-active neo4j)"
echo "   - Redis: $(systemctl is-active redis-server)"
echo "   - PM2: $(pm2 status | grep -E "(online|stopped)" | wc -l) processes"
echo

# Application Health
echo "3. Application Health:"
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "   - API: Healthy"
else
    echo "   - API: Unhealthy"
fi

if curl -s http://localhost:3000/metrics > /dev/null 2>&1; then
    echo "   - Metrics: Available"
else
    echo "   - Metrics: Unavailable"
fi
echo

# Database Health
echo "4. Database Health:"
if redis-cli ping > /dev/null 2>&1; then
    echo "   - Redis: Connected"
else
    echo "   - Redis: Disconnected"
fi

if cypher-shell -u neo4j -p your_password -h localhost -P 7687 "RETURN 1" > /dev/null 2>&1; then
    echo "   - Neo4j: Connected"
else
    echo "   - Neo4j: Disconnected"
fi
echo

# Resource Usage
echo "5. Resource Usage:"
echo "   - Active Users: $(redis-cli SCARD "active:users" 2>/dev/null || echo 0)"
echo "   - Active Slots: $(redis-cli SCARD "active:slots" 2>/dev/null || echo 0)"
echo "   - Total Slots: $(redis-cli SCARD "slots:all" 2>/dev/null || echo 0)"
echo

# Recent Errors
echo "6. Recent Errors:"
echo "   - Application Errors:"
pm2 logs claudebox-api --lines 10 --err 2>/dev/null | tail -5
echo "   - System Errors:"
sudo journalctl -u claudebox --since "1 hour ago" --no-pager | tail -5
echo

echo "=== Health Check Complete ==="
EOF

# Make executable
sudo chmod +x /usr/local/bin/claudebox-health.sh
```

### 2. Debug Mode Script
```bash
# Create debug mode script
cat > /usr/local/bin/claudebox-debug.sh << 'EOF'
#!/bin/bash

echo "=== ClaudeBox Debug Mode ==="
echo "WARNING: This will restart services in debug mode"
echo "Press Ctrl+C to exit"
echo

# Enable debug logging
export DEBUG=claudebox:*
export NODE_ENV=development

# Start services in debug mode
pm2 delete all
pm2 start src/app.js --name claudebox-debug --log-date-format="YYYY-MM-DD HH:mm:ss Z"
pm2 start src/worker.js --name claudebox-worker-debug --log-date-format="YYYY-MM-DD HH:mm:ss Z"

# Monitor logs
pm2 logs claudebox-debug
pm2 logs claudebox-worker-debug
EOF

# Make executable
sudo chmod +x /usr/local/bin/claudebox-debug.sh
```

## 📞 Getting Help

### When to Contact Support
- System down for more than 5 minutes
- Data corruption suspected
- Security breach detected
- Performance degradation affecting users
- Backup failures
- Unknown errors not covered in this guide

### Information to Provide
- Exact error messages
- Steps to reproduce the issue
- System specifications
- Recent changes made
- Log files (sanitized if necessary)
- Screenshots of the issue

### Support Channels
- **Emergency Support**: +1 (555) 999-9999
- **Technical Support**: tech-support@claudebox.com
- **Community Forum**: forum.claudebox.com
- **Documentation**: docs.claudebox.com
- **GitHub Issues**: github.com/claudebox/multi-slot/issues

---

*Last Updated: September 28, 2025*  
*Version: 1.0.0*