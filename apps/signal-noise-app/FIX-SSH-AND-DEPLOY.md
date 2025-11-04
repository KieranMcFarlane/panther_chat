# Fix SSH and Deploy to EC2

## Problem
Port 22 is closed on the EC2 instance despite Security Group rules being open. This means:
1. OS-level firewall (ufw/firewall-cmd) may be blocking SSH
2. SSH daemon may not be running
3. IMDSv2 requirement may be interfering

## Solution 1: EC2 Instance Connect (Browser Terminal)

1. Go to EC2 Console → Select instance `i-01fea6aa56a8bb85b`
2. Click **Connect** → **EC2 Instance Connect** → **Connect**
3. In the browser terminal, run:

```bash
# Check SSH status
sudo systemctl status sshd
sudo systemctl enable sshd
sudo systemctl start sshd

# Check firewall
sudo ufw status
sudo firewall-cmd --list-all 2>/dev/null || echo "Using ufw"

# If ufw is active, ensure SSH is allowed
sudo ufw allow 22/tcp
sudo ufw allow 8001/tcp

# Restart SSH
sudo systemctl restart sshd

# Test SSH from another terminal
```

## Solution 2: Deploy via EC2 Instance Connect

Since SSH is blocked, use the browser terminal to deploy:

### Step 1: Prepare deployment package locally

```bash
cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app

# Create minimal deployment package
tar -czf /tmp/deploy-minimal.tar.gz \
  src/ components/ lib/ public/ \
  next.config.js package.json package-lock.json tsconfig.json \
  .env.production mcp-config.json .mcp.json postcss.config.js tailwind.config.ts
```

### Step 2: Upload via EC2 Instance Connect terminal

1. Open browser terminal via EC2 Instance Connect
2. Run these commands:

```bash
# Create app directory
mkdir -p /home/ec2-user/signal-noise-app
cd /home/ec2-user/signal-noise-app

# Create upload script (we'll paste files directly or use curl from S3)
```

### Step 3: Alternative - Use AWS S3 as intermediary

```bash
# Local machine - upload to S3
aws s3 cp /tmp/deploy-minimal.tar.gz s3://your-bucket-name/deploy.tar.gz

# Get pre-signed URL (valid for 1 hour)
aws s3 presign s3://your-bucket-name/deploy.tar.gz --expires-in 3600

# In EC2 Instance Connect browser terminal:
cd /home/ec2-user
curl -o deploy.tar.gz "<PASTE-PRE-SIGNED-URL-HERE>"
tar -xzf deploy.tar.gz -C signal-noise-app
cd signal-noise-app

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install dependencies
npm install

# Build
npm run build

# Setup PM2
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
    max_memory_restart: '1G',
    env: { NODE_ENV: 'production', PORT: 8001 }
  }]
};
EOF

# Start app
mkdir -p logs
pm2 start ecosystem.config.js
pm2 save

# Setup firewall
sudo ufw allow 8001/tcp
```

### Step 4: Verify

```bash
# Check PM2 status
pm2 status

# Check logs
pm2 logs signal-noise-app

# Test endpoint
curl http://localhost:8001/api/health
```

## Expected Result

App should be available at: `http://51.20.106.192:8001`

## Next Time: Fix SSH Properly

After deployment works, fix SSH so future deployments are easier:

```bash
# From EC2 Instance Connect terminal:
sudo apt update
sudo apt install -y openssh-server
sudo systemctl enable sshd
sudo systemctl start sshd
sudo ufw allow 22/tcp
sudo systemctl restart sshd
```


