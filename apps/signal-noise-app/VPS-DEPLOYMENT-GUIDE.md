# VPS Deployment Guide for Claude Agent SDK Backend

This guide helps you deploy the FastAPI backend with Claude Agent SDK to your VPS using the provided PEM file.

## Prerequisites

- VPS with Ubuntu/Debian OS
- SSH access with the provided PEM file
- Python 3.8+ support on VPS
- Internet connectivity

## Quick Deployment

### 1. Deploy to VPS

```bash
# Basic usage (replace with your VPS IP)
./deploy-to-vps.sh YOUR_VPS_IP

# With custom user (if not root)
./deploy-to-vps.sh YOUR_VPS_IP ubuntu

# Example:
./deploy-to-vps.sh 123.45.67.89
```

### 2. Configure Next.js for VPS

```bash
# Update Next.js to use VPS backend
./configure-for-vps.sh YOUR_VPS_IP

# Example:
./configure-for-vps.sh 123.45.67.89
```

### 3. Test the Connection

```bash
# Test VPS connection
node test-vps-connection.js

# Start Next.js app
npm run dev
```

## Detailed Steps

### Step 1: VPS Deployment

The deployment script will:

1. **Test SSH connection** to your VPS
2. **Setup remote directory** `/opt/claude-webhook-server`
3. **Install dependencies** (Python, pip, system packages)
4. **Copy application files** to VPS
5. **Create virtual environment** and install Python packages
6. **Setup systemd service** for auto-restart
7. **Start the server** with your custom API configuration

### Step 2: What Gets Installed

**System Packages:**
- Python 3.8+
- pip
- virtual environment tools
- git

**Python Packages** (from requirements-webhook.txt):
- fastapi==0.104.1
- uvicorn[standard]==0.24.0
- pydantic==2.5.0
- httpx==0.25.2
- claude-agent-sdk==0.1.1
- python-dotenv==1.0.0

**Systemd Service:**
- Auto-start on boot
- Auto-restart on failure
- Logging with journalctl
- Runs on port 8001

### Step 3: Configuration

The deployed server will use your custom API configuration:

```bash
ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic
ANTHROPIC_AUTH_TOKEN=c4b860075e254d219887557d13477116.e8Gtsb5sXuDggh2c
```

### Step 4: VPS Service Management

Once deployed, you can manage the service with these commands:

```bash
# Connect to VPS
ssh -i /Users/kieranmcfarlane/Downloads/panther_chat/yellowpanther.pem root@YOUR_VPS_IP

# Check service status
sudo systemctl status claude-webhook

# View live logs
sudo journalctl -u claude-webhook -f

# Restart service
sudo systemctl restart claude-webhook

# Stop service
sudo systemctl stop claude-webhook

# Start service
sudo systemctl start claude-webhook
```

## File Structure on VPS

```
/opt/claude-webhook-server/
├── claude-webhook-server.py      # Main FastAPI application
├── requirements-webhook.txt      # Python dependencies
├── .env                         # Environment variables
├── .mcp.json                   # MCP configuration (if exists)
├── neo4j-mcp-server.js         # Neo4j MCP server (if exists)
├── start-server.sh             # Startup script
└── venv/                       # Python virtual environment
```

## Security Configuration

The deployment includes:

### Firewall Configuration

Make sure port 8001 is open on your VPS:

```bash
# Check firewall status
sudo ufw status

# Allow port 8001 if needed
sudo ufw allow 8001/tcp

# Enable firewall if not active
sudo ufw enable
```

### SSL/HTTPS (Optional)

For production, consider setting up SSL:

```bash
# Install certbot
sudo apt install certbot

# Generate SSL certificate
sudo certbot certonly --standalone -d your-domain.com

# Configure nginx reverse proxy with SSL
# (See nginx configuration section below)
```

## Troubleshooting

### Connection Issues

**If Next.js can't connect to VPS:**

1. **Check if VPS service is running:**
   ```bash
   ssh -i yellowpanther.pem root@VPS_IP "sudo systemctl status claude-webhook"
   ```

2. **Check port accessibility:**
   ```bash
   # From your local machine
   telnet VPS_IP 8001
   
   # From VPS
   ssh -i yellowpanther.pem root@VPS_IP "netstat -tlnp | grep 8001"
   ```

3. **Check firewall:**
   ```bash
   ssh -i yellowpanther.pem root@VPS_IP "sudo ufw status"
   ```

### Service Issues

**If service fails to start:**

1. **Check logs:**
   ```bash
   ssh -i yellowpanther.pem root@VPS_IP "sudo journalctl -u claude-webhook -n 50"
   ```

2. **Check Python environment:**
   ```bash
   ssh -i yellowpanther.pem root@VPS_IP "cd /opt/claude-webhook-server && source venv/bin/activate && python claude-webhook-server.py"
   ```

3. **Check dependencies:**
   ```bash
   ssh -i yellowpanther.pem root@VPS_IP "cd /opt/claude-webhook-server && source venv/bin/activate && pip list"
   ```

### Performance Issues

**Monitor server performance:**

```bash
# Check system resources
ssh -i yellowpanther.pem root@VPS_IP "htop"

# Check service logs for errors
ssh -i yellowpanther.pem root@VPS_IP "sudo journalctl -u claude-webhook -f"

# Monitor network connections
ssh -i yellowpanther.pem root@VPS_IP "netstat -an | grep 8001"
```

## Production Optimizations

### Nginx Reverse Proxy

For production, consider adding Nginx:

```nginx
# /etc/nginx/sites-available/claude-webhook
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Monitoring

Add monitoring for production:

```bash
# Create monitoring script
cat > /opt/claude-webhook-server/monitor.sh << 'EOF'
#!/bin/bash
if ! curl -s http://localhost:8001/health > /dev/null; then
    echo "$(date): Server is down, restarting..." >> /var/log/claude-webhook-monitor.log
    sudo systemctl restart claude-webhook
fi
EOF

# Add to crontab for monitoring every 5 minutes
# */5 * * * * /opt/claude-webhook-server/monitor.sh
```

## Integration with Next.js

Once deployed, your integration flow will be:

```
CopilotKit Chat Panel → Next.js (localhost:3005) → VPS Backend (YOUR_VPS_IP:8001) → Claude Agent SDK → Custom API
```

The Next.js app will automatically route all CopilotKit requests to your VPS backend where they'll be processed by the Claude Agent SDK with your custom API configuration.

## Example Deployment

```bash
# 1. Deploy to your VPS (replace 123.45.67.89 with your VPS IP)
./deploy-to-vps.sh 123.45.67.89

# 2. Configure Next.js to use VPS
./configure-for-vps.sh 123.45.67.89

# 3. Test the connection
node test-vps-connection.js

# 4. Start Next.js
npm run dev

# 5. Test the complete integration at http://localhost:3005
```

Your backend is now running on the VPS with your custom API configuration and auto-restart capabilities!