# 🚀 Deploy Signal Noise App to EC2

Complete guide to build and deploy the Signal Noise App to your EC2 server using the `.pem` file.

## Prerequisites

- ✅ `yellowpanther.pem` file located at `/Users/kieranmcfarlane/Downloads/panther_chat/yellowpanther.pem`
- ✅ EC2 server at `13.60.60.50` accessible via SSH
- ✅ Node.js 18+ on EC2 (will be installed if missing)
- ✅ `.env.production` file configured

## Quick Deploy

```bash
cd apps/signal-noise-app
./deploy-ec2.sh
```

This will:
1. ✅ Test SSH connection
2. ✅ Copy application files to EC2
3. ✅ Install Node.js (if needed)
4. ✅ Install dependencies
5. ✅ Build Next.js app
6. ✅ Setup PM2 process manager
7. ✅ Start app on port 8001
8. ✅ Configure firewall

## What Gets Deployed

- **Files:** All source files except `node_modules` and `.next`
- **Port:** 8001 (production)
- **Process Manager:** PM2 (auto-restart on crash)
- **Directory:** `/home/ec2-user/signal-noise-app`
- **Logs:** `/home/ec2-user/signal-noise-app/logs/`

## Manual Deployment Steps

If you prefer to deploy manually:

### 1. Build Locally

```bash
cd apps/signal-noise-app
npm run build
```

### 2. Copy Files to EC2

```bash
# Using rsync (excludes node_modules and .next)
rsync -avz --exclude=node_modules --exclude=.next --exclude=.git \
  -e "ssh -i /Users/kieranmcfarlane/Downloads/panther_chat/yellowpanther.pem" \
  ./ ec2-user@13.60.60.50:/home/ec2-user/signal-noise-app/

# Copy production environment
scp -i /Users/kieranmcfarlane/Downloads/panther_chat/yellowpanther.pem \
  .env.production \
  ec2-user@13.60.60.50:/home/ec2-user/signal-noise-app/.env.local
```

### 3. SSH into EC2 and Setup

```bash
ssh -i /Users/kieranmcfarlane/Downloads/panther_chat/yellowpanther.pem \
  ec2-user@13.60.60.50
```

```bash
cd /home/ec2-user/signal-noise-app

# Install Node.js 18 if needed
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install dependencies
npm install

# Build application
npm run build
```

### 4. Start with PM2

```bash
# Install PM2 globally
sudo npm install -g pm2

# Create ecosystem config
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

# Setup auto-start on reboot
pm2 startup
# Then run the command it outputs
```

## Management Commands

### Check Status

```bash
ssh -i /Users/kieranmcfarlane/Downloads/panther_chat/yellowpanther.pem \
  ec2-user@13.60.60.50 'pm2 status'
```

### View Logs

```bash
ssh -i /Users/kieranmcfarlane/Downloads/panther_chat/yellowpanther.pem \
  ec2-user@13.60.60.50 'pm2 logs signal-noise-app'
```

### Restart Application

```bash
ssh -i /Users/kieranmcfarlane/Downloads/panther_chat/yellowpanther.pem \
  ec2-user@13.60.60.50 'pm2 restart signal-noise-app'
```

### Stop Application

```bash
ssh -i /Users/kieranmcfarlane/Downloads/panther_chat/yellowpanther.pem \
  ec2-user@13.60.60.50 'pm2 stop signal-noise-app'
```

### View Real-time Logs

```bash
ssh -i /Users/kieranmcfarlane/Downloads/panther_chat/yellowpanther.pem \
  ec2-user@13.60.60.50 'pm2 logs signal-noise-app --lines 100'
```

## Access Your Application

Once deployed, access your app at:

- **URL:** http://13.60.60.50:8001
- **Health Check:** http://13.60.60.50:8001/api/health

## Troubleshooting

### Port Already in Use

If port 8001 is taken:

```bash
ssh -i /Users/kieranmcfarlane/Downloads/panther_chat/yellowpanther.pem \
  ec2-user@13.60.60.50 'pm2 stop signal-noise-app'
```

### Application Not Starting

Check logs for errors:

```bash
ssh -i /Users/kieranmcfarlane/Downloads/panther_chat/yellowpanther.pem \
  ec2-user@13.60.60.50 'pm2 logs signal-noise-app --err'
```

### Rebuild Application

If you need to rebuild:

```bash
ssh -i /Users/kieranmcfarlane/Downloads/panther_chat/yellowpanther.pem \
  ec2-user@13.60.60.50 'cd /home/ec2-user/signal-noise-app && npm run build && pm2 restart signal-noise-app'
```

### Firewall Issues

Open port 8001 in AWS Security Group:
- Go to EC2 Console
- Select your instance
- Security Groups → Inbound Rules
- Add rule: Port 8001, Source 0.0.0.0/0

## Environment Variables

Ensure `.env.production` has all required variables:

- `NEO4J_URI` - Neo4j connection string
- `NEO4J_USERNAME` - Neo4j username
- `NEO4J_PASSWORD` - Neo4j password
- `BRIGHTDATA_API_TOKEN` - BrightData API key
- `PERPLEXITY_API_KEY` - Perplexity API key
- `CLAUDE_API_KEY` - Claude API key
- `SUPABASE_URL` - Supabase URL
- `SUPABASE_ANON_KEY` - Supabase anon key

## Next Steps

1. ✅ Verify app is running
2. ✅ Test all features
3. ✅ Setup domain name (optional)
4. ✅ Configure SSL/HTTPS (optional)
5. ✅ Setup monitoring (optional)

## Deployment Complete! 🎉

Your Signal Noise App is now running on EC2!

