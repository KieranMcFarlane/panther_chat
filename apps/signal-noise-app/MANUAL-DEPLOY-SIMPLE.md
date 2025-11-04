# 🚀 Manual Deployment - Simple Steps

Since SSH is inconsistent, here's the simplest manual deployment approach.

## Option 1: Via AWS Console (Recommended)

### Step 1: Create Deployment Package

On your local machine:
```bash
cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app

# Create clean package
tar -czf deploy.tar.gz \
  src/ \
  public/ \
  components/ \
  lib/ \
  next.config.js \
  package.json \
  package-lock.json \
  tsconfig.json \
  .env.production
```

### Step 2: Upload via S3

```bash
# Create S3 bucket (one time)
aws s3 mb s3://yellow-panther-deployments --region eu-north-1

# Upload package
aws s3 cp deploy.tar.gz s3://yellow-panther-deployments/

# Generate pre-signed URL (valid for 1 hour)
aws s3 presign s3://yellow-panther-deployments/deploy.tar.gz --expires-in 3600
```

### Step 3: Deploy via AWS Console

1. Open AWS Console → EC2 → Connect to instance
2. Use **EC2 Instance Connect** (browser-based terminal)
3. Run these commands:

```bash
# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
sudo npm install -g pm2

# Download and extract deployment
cd /home/ec2-user
# Paste the S3 pre-signed URL from Step 2
curl -o deploy.tar.gz "<YOUR-PRE-SIGNED-URL-HERE>"
tar -xzf deploy.tar.gz
cd apps/signal-noise-app

# Install dependencies
npm install

# Build
npm run build

# Create environment
cp .env.production .env.local

# Create PM2 config
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'signal-noise-app',
    script: 'npm',
    args: 'start',
    cwd: '/home/ec2-user/apps/signal-noise-app',
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
pm2 startup
# Run the startup command it outputs

# Allow port 8001 in firewall
sudo ufw allow 8001/tcp || echo "UFW not installed"

# Test
curl http://localhost:8001
```

## Option 2: One-Liner via AWS Console

In EC2 Instance Connect terminal, paste this:

```bash
bash <(curl -s https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 18
nvm use 18
npm install -g pm2

cd /home/ec2-user
git clone https://github.com/YOUR-REPO/signal-noise-app.git || echo "No git, use S3 method"
cd signal-noise-app
npm install && npm run build
pm2 start npm --name "signal-noise-app" -- start
```

## Option 3: Use CloudFormation/CDK (Advanced)

If you want repeatable infrastructure, create a CloudFormation template or use AWS CDK.

## Quick Access

Once deployed, access your app at:
- **URL:** http://13.60.60.50:8001
- **Public DNS:** http://ec2-13-60-60-50.eu-north-1.compute.amazonaws.com:8001

## Security Notes

Make sure to:
1. Update Security Group to allow port 8001
2. Use `.env.production` for sensitive keys
3. Don't commit `.env` files to git
4. Set up proper IAM roles for EC2

## Monitoring

```bash
# Via EC2 Instance Connect
pm2 logs
pm2 status
pm2 restart signal-noise-app
```


