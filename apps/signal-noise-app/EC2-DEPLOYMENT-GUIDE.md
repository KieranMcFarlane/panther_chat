# AWS EC2 Deployment Guide for Claude Agent SDK Backend

This guide helps you deploy the FastAPI backend with Claude Agent SDK to your AWS EC2 instance.

## Your EC2 Configuration

- **Host**: 13.60.60.50
- **User**: ec2-user  
- **PEM File**: `/Users/kieranmcfarlane/Downloads/panther_chat/yellowpanther.pem`
- **Path**: `/home/ec2-user/`

## Quick Deployment

### 1. Deploy to EC2

```bash
# Deploy to your specific EC2 instance
./deploy-to-ec2.sh
```

### 2. Configure Next.js for EC2

```bash
# Update Next.js to use EC2 backend
./configure-for-ec2.sh
```

### 3. Test the Connection

```bash
# Test EC2 connection
node test-ec2-connection.js

# Start Next.js app
npm run dev
```

## AWS Security Group Configuration

**Important**: You need to add an inbound rule to your EC2 security group:

1. **Go to AWS Console → EC2 → Security Groups**
2. **Select your instance's security group**
3. **Add inbound rule**:
   - **Type**: HTTP
   - **Port**: 8001
   - **Source**: 0.0.0.0/0 (for all access) or your specific IP
4. **Save the rule**

## What Gets Deployed

### System Setup (Amazon Linux)

**System Packages:**
- Python 3.8+
- pip
- Development Tools (gcc, python3-devel)
- git

**Python Packages:**
- fastapi==0.104.1
- uvicorn[standard]==0.24.0
- pydantic==2.5.0
- httpx==0.25.2
- claude-agent-sdk==0.1.1
- python-dotenv==1.0.0

### Service Configuration

**Systemd Service:**
- User: `ec2-user`
- Working directory: `/home/ec2-user/claude-webhook-server`
- Auto-start on boot
- Auto-restart on failure
- Runs on port 8001

## File Structure on EC2

```
/home/ec2-user/claude-webhook-server/
├── claude-webhook-server.py      # Main FastAPI application
├── requirements-webhook.txt      # Python dependencies
├── .env                         # Environment variables
├── .mcp.json                   # MCP configuration (if exists)
├── neo4j-mcp-server.js         # Neo4j MCP server (if exists)
├── start-server.sh             # Startup script
├── venv/                       # Python virtual environment
└── claude-webhook.service      # Systemd service file
```

## Service Management

```bash
# Connect to EC2
ssh -i /Users/kieranmcfarlane/Downloads/panther_chat/yellowpanther.pem ec2-user@13.60.60.50

# Service management
sudo systemctl status claude-webhook      # Check status
sudo systemctl restart claude-webhook    # Restart
sudo systemctl stop claude-webhook       # Stop
sudo systemctl start claude-webhook      # Start
sudo journalctl -u claude-webhook -f     # View logs
```

## Environment Variables

The deployed server uses your custom API configuration:

```bash
ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic
ANTHROPIC_AUTH_TOKEN=c4b860075e254d219887557d13477116.e8Gtsb5sXuDggh2c
NEO4J_URI=neo4j+s://demo.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_DATABASE=neo4j
PORT=8001
HOST=0.0.0.0
```

## Troubleshooting

### Connection Issues

**If Next.js can't connect to EC2:**

1. **Check AWS Security Group:**
   ```bash
   # Make sure port 8001 is open in your security group
   # Go to AWS Console → EC2 → Security Groups → Edit inbound rules
   ```

2. **Check service status:**
   ```bash
   ssh -i yellowpanther.pem ec2-user@13.60.60.50 "sudo systemctl status claude-webhook"
   ```

3. **Check firewall:**
   ```bash
   # Amazon Linux usually doesn't have local firewall, but check:
   ssh -i yellowpanther.pem ec2-user@13.60.60.50 "sudo iptables -L"
   ```

### Service Issues

**If service fails to start:**

1. **View logs:**
   ```bash
   ssh -i yellowpanther.pem ec2-user@13.60.60.50 "sudo journalctl -u claude-webhook -n 50"
   ```

2. **Manual test:**
   ```bash
   ssh -i yellowpanther.pem ec2-user@13.60.60.50 "cd /home/ec2-user/claude-webhook-server && source venv/bin/activate && python claude-webhook-server.py"
   ```

### Network Issues

**Check network connectivity:**

```bash
# From your local machine
curl http://13.60.60.50:8001/health

# From EC2 instance
ssh -i yellowpanther.pem ec2-user@13.60.60.50 "curl http://localhost:8001/health"
```

## Monitoring

### Health Check

```bash
# Check if server is responding
curl http://13.60.60.50:8001/health

# Expected response:
# {"status":"healthy","mcp_servers":1}
```

### Log Monitoring

```bash
# Follow logs in real-time
ssh -i yellowpanther.pem ec2-user@13.60.60.50 "sudo journalctl -u claude-webhook -f"
```

### Performance Monitoring

```bash
# Check system resources
ssh -i yellowpanther.pem ec2-user@13.60.60.50 "top"

# Check network connections
ssh -i yellowpanther.pem ec2-user@13.60.60.50 "netstat -tlnp | grep 8001"
```

## Integration Flow

Once deployed, your integration flow will be:

```
CopilotKit Chat Panel → Next.js (localhost:3005) → EC2 Backend (13.60.60.50:8001) → Claude Agent SDK → Custom API (z.ai)
```

## Example Complete Deployment

```bash
# 1. Deploy to EC2
./deploy-to-ec2.sh

# 2. Configure Next.js
./configure-for-ec2.sh

# 3. Test connection
node test-ec2-connection.js

# 4. Start Next.js with EC2 backend
npm run dev

# 5. Test the complete integration at http://localhost:3005
```

## SSL/HTTPS (Optional for Production)

For production deployment, consider setting up SSL:

```bash
# Install certbot on EC2
ssh -i yellowpanther.pem ec2-user@13.60.60.50 "sudo yum install certbot python3-certbot-nginx -y"

# Generate SSL certificate (requires domain name)
# sudo certbot --nginx -d your-domain.com
```

## Cost Optimization

- **EC2 Instance Type**: Consider t3.micro or t3.small for development
- **Elastic IP**: Use Elastic IP for consistent public IP
- **Monitoring**: Set up CloudWatch alarms for monitoring
- **Auto-scaling**: Consider auto-scaling groups for production

Your EC2 backend is now configured and ready to deploy with your specific AWS configuration!