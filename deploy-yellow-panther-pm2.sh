#!/bin/bash

REMOTE_HOST="212.86.105.190"
REMOTE_PORT="3217"
REMOTE_DIR="/opt/yellow-panther-ai"

echo "🚀 Deploying Yellow Panther AI with PM2 on port $REMOTE_PORT..."

# Create the remote deployment script
cat > /tmp/pm2-deploy.sh << 'REMOTE_SCRIPT'
#!/bin/bash

echo "🔧 Setting up Yellow Panther AI with PM2..."

# Navigate to the project directory
cd /opt/yellow-panther-ai

# Create logs directory
mkdir -p logs

# Install PM2 globally if not already installed
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2..."
    npm install -g pm2
fi

# Kill any existing processes on port 3217
echo "🔄 Stopping existing processes..."
pkill -f "next.*3217" || true
pkill -f "node.*3217" || true
sleep 3

# Stop any existing PM2 processes for this app
pm2 stop yellow-panther-ai 2>/dev/null || true
pm2 delete yellow-panther-ai 2>/dev/null || true

# Check if node_modules exists, install if not
if [ ! -d "node_modules" ]; then
    echo "📦 Installing Node.js dependencies..."
    npm install
fi

# Create PM2 ecosystem file
cat > ecosystem.config.js << 'ECOSYSTEM'
module.exports = {
  apps: [{
    name: 'yellow-panther-ai',
    script: 'npm',
    args: 'run dev -- -p 3217 -H 0.0.0.0',
    cwd: '/opt/yellow-panther-ai',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: '3217',
      HOSTNAME: '0.0.0.0'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: '3217',
      HOSTNAME: '0.0.0.0'
    },
    error_file: '/opt/yellow-panther-ai/logs/err.log',
    out_file: '/opt/yellow-panther-ai/logs/out.log',
    log_file: '/opt/yellow-panther-ai/logs/combined.log',
    time: true,
    restart_delay: 4000,
    max_restarts: 10,
    min_uptime: '10s',
    max_memory_restart: '1G',
    watch: false,
    ignore_watch: ['node_modules', 'logs', '.next'],
    autorestart: true,
    exp_backoff_restart_delay: 100
  }]
}
ECOSYSTEM

# Start the application with PM2
echo "🎯 Starting Yellow Panther AI with PM2..."
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
echo "✅ PM2 startup script generated. Run the command above if needed."

# Wait for startup
echo "⏳ Waiting for application to start..."
sleep 15

# Test the application
echo "🧪 Testing application..."
if curl -s http://localhost:3217 > /dev/null; then
    echo "✅ Application is running successfully with PM2!"
    echo "🌐 Access URL: http://212.86.105.190:3217"
else
    echo "❌ Application failed to start"
    echo "📋 Recent logs:"
    pm2 logs yellow-panther-ai --lines 20
fi

# Check if port 3217 is open in firewall
echo "🔒 Checking firewall..."
if ufw status | grep -q "3217"; then
    echo "✅ Port 3217 is already open in firewall"
else
    echo "🔓 Opening port 3217 in firewall..."
    ufw allow 3217/tcp
fi

# Show PM2 status
echo "📊 PM2 Status:"
pm2 status

echo "🎉 PM2 deployment complete!"
REMOTE_SCRIPT

# Copy and execute the script on remote server
echo "📤 Copying PM2 deployment script to remote server..."
scp /tmp/pm2-deploy.sh root@$REMOTE_HOST:/tmp/

echo "🚀 Executing PM2 deployment on remote server..."
ssh root@$REMOTE_HOST "chmod +x /tmp/pm2-deploy.sh && /tmp/pm2-deploy.sh"

# Test the deployment
echo "🧪 Testing external access..."
sleep 5
if curl -s -o /dev/null -w "%{http_code}" http://$REMOTE_HOST:$REMOTE_PORT | grep -q "200"; then
    echo "✅ External access successful!"
else
    echo "❌ External access failed. Checking PM2 status..."
    ssh root@$REMOTE_HOST "pm2 status"
fi

echo ""
echo "🎉 PM2 Deployment Summary:"
echo "🌐 Yellow Panther AI Dashboard: http://$REMOTE_HOST:$REMOTE_PORT"
echo "🔧 Open WebUI (existing): http://$REMOTE_HOST:3000"
echo ""
echo "🔧 PM2 Management commands:"
echo "   • Status: ssh root@$REMOTE_HOST 'pm2 status'"
echo "   • Logs: ssh root@$REMOTE_HOST 'pm2 logs yellow-panther-ai'"
echo "   • Restart: ssh root@$REMOTE_HOST 'pm2 restart yellow-panther-ai'"
echo "   • Stop: ssh root@$REMOTE_HOST 'pm2 stop yellow-panther-ai'"
echo "   • Start: ssh root@$REMOTE_HOST 'pm2 start yellow-panther-ai'"
echo "   • Monitor: ssh root@$REMOTE_HOST 'pm2 monit'"
echo ""
echo "🧪 Test the dashboard:"
echo "   curl http://$REMOTE_HOST:$REMOTE_PORT" 