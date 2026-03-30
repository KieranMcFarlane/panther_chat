# 🚀 Deploy Signal Noise App via AWS Session Manager

This guide walks you through deploying the application using AWS Systems Manager Session Manager, which bypasses SSH.

## 📋 Prerequisites

- ✅ AWS Console access
- ✅ EC2 instance running (i-01fea6aa56a8bb85b)
- ✅ Instance IP: 16.171.235.207
- ✅ Deployment package ready locally: `/tmp/signal-noise-app-deploy.tar.gz`

## 🎯 Step-by-Step Guide

### Step 1: Access AWS Session Manager

1. **Open AWS Console:**
   - Go to: https://console.aws.amazon.com/ec2/
   - Navigate to: **EC2 Dashboard** → **Instances**

2. **Select Your Instance:**
   - Find instance: `i-01fea6aa56a8bb85b`
   - Check it's in **"Running"** state

3. **Connect via Session Manager:**
   - Select the instance
   - Click **"Connect"** button (top right)
   - Choose **"Session Manager"** tab
   - Click **"Connect"**

4. **Terminal Opens:**
   - A browser-based terminal will open
   - You'll see a command prompt as `ec2-user@ip-172-31-17-16` (or similar)

---

### Step 2: Prepare Server Environment

Once connected via Session Manager, run these commands:

```bash
# Check current directory
pwd

# Navigate to home directory
cd ~

# Check if Node.js is installed
node --version || echo "Node.js not installed"

# Check if PM2 is installed
pm2 --version || echo "PM2 not installed"

# Create application directory
mkdir -p ~/signal-noise-app
cd ~/signal-noise-app
```

---

### Step 3: Upload Deployment Package

**Option A: Using SCP from your local machine (if SSH works)**

Open a **new terminal on your local machine** and run:

```bash
# Upload the deployment package
scp -i /Users/kieranmcfarlane/Downloads/panther_chat/yellowpanther.pem \
  /tmp/signal-noise-app-deploy.tar.gz \
  ec2-user@16.171.235.207:/home/ec2-user/signal-noise-app/deploy.tar.gz
```

**Option B: Create package directly on server (if SCP doesn't work)**

If you can't upload via SCP, you'll need to:
1. Upload files via AWS S3, or
2. Build directly on the server (slower)

For now, let's assume we'll use Option A. If that doesn't work, we'll use Option B.

---

### Step 4: Extract and Setup Application

Back in the **Session Manager terminal**, run:

```bash
cd ~/signal-noise-app

# Extract the deployment package
tar -xzf deploy.tar.gz
rm deploy.tar.gz

# Install Node.js if needed
if ! command -v node &> /dev/null; then
    echo "Installing Node.js 18..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Verify Node.js installation
node --version
npm --version

# Install PM2 globally if needed
if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    sudo npm install -g pm2
fi

# Install application dependencies
echo "Installing dependencies..."
npm install --production

# Copy environment file
if [ -f .env.production ]; then
    cp .env.production .env.local
    echo "✅ Environment file configured"
fi
```

---

### Step 5: Create PM2 Configuration

Create the PM2 ecosystem file:

```bash
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
      PORT: 4328
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
EOF

# Create logs directory
mkdir -p logs
```

---

### Step 6: Start the Application

```bash
# Stop any existing instance
pm2 stop signal-noise-app 2>/dev/null || true
pm2 delete signal-noise-app 2>/dev/null || true

# Start the application
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ec2-user --hp /home/ec2-user

# Check status
pm2 status

# View logs
pm2 logs signal-noise-app --lines 20
```

---

### Step 7: Configure Firewall

```bash
# Open port 4328 in firewall
sudo ufw allow 4328/tcp
sudo ufw status
```

---

### Step 8: Test the Application

```bash
# Test locally on server
curl http://localhost:4328

# Or check with netstat
netstat -tlnp | grep 4328
```

---

## 🔍 Troubleshooting

### If SCP Upload Fails

If you can't upload via SCP, we can build directly on the server:

1. **In Session Manager terminal:**
```bash
cd ~
mkdir -p signal-noise-app-source
cd signal-noise-app-source
```

2. **Upload source files via AWS S3 or manually copy files**

3. **Build on server:**
```bash
npm install
npm run build
npm start
```

### Check Application Status

```bash
# PM2 status
pm2 status

# View logs
pm2 logs signal-noise-app

# Restart if needed
pm2 restart signal-noise-app
```

### Check Port Accessibility

```bash
# Check if port is listening
sudo netstat -tlnp | grep 4328

# Test local connection
curl http://localhost:4328
```

---

## ✅ Verification

After deployment, verify:

1. **Application is running:**
   - `pm2 status` shows app as "online"

2. **Access from browser:**
   - URL: `http://16.171.235.207:4328`
   - Make sure AWS Security Group allows inbound traffic on port 4328

3. **Check logs:**
   - `pm2 logs signal-noise-app` shows no errors

---

## 📝 Quick Reference Commands

```bash
# Status
pm2 status

# Logs
pm2 logs signal-noise-app

# Restart
pm2 restart signal-noise-app

# Stop
pm2 stop signal-noise-app

# Monitor
pm2 monit
```

---

## 🎉 Success!

Once deployed, your application will be available at:
**http://16.171.235.207:4328**

Make sure your AWS Security Group allows inbound traffic on port 4328 from:
- `0.0.0.0/0` (all IPs), or
- Your specific IP address
