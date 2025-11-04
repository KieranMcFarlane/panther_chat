# �� Signal Noise App - Complete Deployment Guide

## Overview

This guide explains how to build and deploy the Signal Noise App to your EC2 server.

## What Gets Deployed

### Files Included in Deployment Package:
- ✅ **`.next/`** - Pre-built Next.js application (built locally)
- ✅ **`public/`** - Static assets (images, icons, etc.)
- ✅ **`package.json` & `package-lock.json`** - Dependencies list
- ✅ **`next.config.js`** - Next.js configuration
- ✅ **`tsconfig.json`** - TypeScript configuration
- ✅ **`.env.production`** - Production environment variables
- ✅ **`mcp-config.json` & `.mcp.json`** - MCP server configuration
- ✅ **`src/`** - Source code (needed for API routes)
- ✅ **`components/`** - React components (if exists)
- ✅ **`lib/`** - Library files (if exists)

### Files Excluded:
- ❌ `node_modules/` - Will be installed on server
- ❌ `.git/` - Not needed for production
- ❌ `*.md` - Documentation files
- ❌ `*.log` - Log files
- ❌ `.next/` is included (but built locally, not on server)

## Prerequisites

1. **Local Machine:**
   - Node.js 18+ installed
   - npm installed
   - SSH access to EC2 server
   - `.pem` file for EC2 authentication

2. **EC2 Server:**
   - Ubuntu/Debian-based Linux
   - SSH access configured
   - Port 8001 accessible (or your chosen port)

3. **Required Files:**
   - `yellowpanther.pem` at `/Users/kieranmcfarlane/Downloads/panther_chat/yellowpanther.pem`
   - `.env.production` configured with your API keys

## Quick Deployment

### Option 1: Automated Script (Recommended)

```bash
cd apps/signal-noise-app
./deploy-complete.sh
```

This script will:
1. ✅ Build the app locally (verifies it works)
2. ✅ Create a deployment package with all necessary files
3. ✅ Test SSH connection to server
4. ✅ Upload package to server
5. ✅ Install Node.js (if needed)
6. ✅ Install PM2 process manager (if needed)
7. ✅ Install dependencies on server
8. ✅ Configure PM2 to run the app
9. ✅ Start the application
10. ✅ Verify deployment

### Option 2: Manual Deployment

#### Step 1: Build Locally

```bash
cd apps/signal-noise-app
npm run build
```

Verify build succeeded:
```bash
ls -la .next/
```

#### Step 2: Create Deployment Package

```bash
tar -czf /tmp/deploy.tar.gz \
  .next/ \
  public/ \
  package.json \
  package-lock.json \
  next.config.js \
  tsconfig.json \
  .env.production \
  mcp-config.json \
  .mcp.json \
  src/
```

#### Step 3: Upload to Server

```bash
scp -i /Users/kieranmcfarlane/Downloads/panther_chat/yellowpanther.pem \
  /tmp/deploy.tar.gz \
  ec2-user@51.20.117.84:/tmp/
```

#### Step 4: Setup Server

SSH into server:
```bash
ssh -i /Users/kieranmcfarlane/Downloads/panther_chat/yellowpanther.pem \
  ec2-user@51.20.117.84
```

On the server:
```bash
# Create directory
mkdir -p /home/ec2-user/signal-noise-app
cd /home/ec2-user/signal-noise-app

# Extract files
tar -xzf /tmp/deploy.tar.gz
rm /tmp/deploy.tar.gz

# Install Node.js (if needed)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
sudo npm install -g pm2

# Install dependencies
npm install --production

# Copy environment file
cp .env.production .env.local

# Create PM2 config
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'signal-noise-app',
    script: 'npm',
    args: 'start',
    cwd: '/home/ec2-user/signal-noise-app',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 8001
    }
  }]
};
EOF

# Start app
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## Server Configuration

### Port Configuration

The app runs on **port 8001** by default. To change:

1. Update `PORT` in `deploy-complete.sh`
2. Update `package.json` start script: `"start": "next start -p YOUR_PORT"`
3. Update PM2 ecosystem config
4. Update AWS Security Group to allow your port

### Environment Variables

Ensure `.env.production` contains:

```bash
# Neo4j
NEO4J_URI=neo4j+s://your-instance.databases.neo4j.io
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-password

# Claude API
CLAUDE_API_KEY=your-key

# MCP Tools
BRIGHTDATA_API_KEY=your-key
PERPLEXITY_API_KEY=your-key

# Other API keys as needed
```

## Monitoring & Maintenance

### Check Application Status

```bash
ssh -i yellowpanther.pem ec2-user@51.20.117.84 'pm2 status'
```

### View Logs

```bash
ssh -i yellowpanther.pem ec2-user@51.20.117.84 'pm2 logs signal-noise-app'
```

### Restart Application

```bash
ssh -i yellowpanther.pem ec2-user@51.20.117.84 'pm2 restart signal-noise-app'
```

### Stop Application

```bash
ssh -i yellowpanther.pem ec2-user@51.20.117.84 'pm2 stop signal-noise-app'
```

## Troubleshooting

### Build Fails Locally

- Check Node.js version: `node --version` (should be 18+)
- Clear cache: `rm -rf .next node_modules && npm install`
- Check for TypeScript errors: `npm run build`

### Deployment Fails

- Verify SSH connection: `ssh -i yellowpanther.pem ec2-user@51.20.117.84`
- Check server has enough space: `df -h`
- Check server logs: `pm2 logs signal-noise-app`

### App Not Responding

- Check if app is running: `pm2 status`
- Check port is open: `curl http://localhost:8001`
- Check AWS Security Group allows port 8001
- View error logs: `pm2 logs signal-noise-app --err`

### Dependencies Issues

If you get "module not found" errors:
- Reinstall dependencies: `npm install --production`
- Check `package.json` has all required dependencies
- Verify `.next` folder contains the built app

## Updating the Deployment

To update after code changes:

1. Make your code changes
2. Run `./deploy-complete.sh` again
3. The script will rebuild and redeploy automatically

## Access the Application

After successful deployment:

**URL:** `http://51.20.117.84:8001`

Make sure:
- ✅ AWS Security Group allows inbound traffic on port 8001
- ✅ EC2 instance has a public IP
- ✅ Firewall (ufw) allows port 8001

## Notes

- The deployment script builds locally to catch errors early
- Only production dependencies are installed on the server
- PM2 ensures the app restarts automatically if it crashes
- PM2 is configured to start on server reboot