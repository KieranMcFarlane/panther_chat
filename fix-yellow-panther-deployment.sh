#!/bin/bash

REMOTE_HOST="212.86.105.190"
REMOTE_PORT="3217"
REMOTE_DIR="/opt/yellow-panther-ai"

echo "🔧 Fixing Yellow Panther AI deployment on port $REMOTE_PORT..."

# Create a comprehensive deployment script
cat > /tmp/deploy-remote.sh << 'REMOTE_SCRIPT'
#!/bin/bash

echo "🚀 Starting Yellow Panther AI deployment..."

# Navigate to the project directory
cd /opt/yellow-panther-ai

# Kill any existing processes on port 3217
echo "🔄 Stopping existing processes..."
pkill -f "next.*3217" || true
pkill -f "node.*3217" || true
sleep 3

# Check if node_modules exists, install if not
if [ ! -d "node_modules" ]; then
    echo "📦 Installing Node.js dependencies..."
    npm install
fi

# Create the startup script
cat > start-port-3217.sh << 'SCRIPT'
#!/bin/bash
cd /opt/yellow-panther-ai
export PORT=3217
export HOSTNAME=0.0.0.0
echo "🚀 Starting Yellow Panther AI on port 3217..."
nohup npm run dev -- -p 3217 -H 0.0.0.0 > yellow-panther-3217.log 2>&1 &
echo $! > yellow-panther-3217.pid
echo "✅ Started with PID: $(cat yellow-panther-3217.pid)"
SCRIPT

chmod +x start-port-3217.sh

# Start the application
echo "🎯 Starting application..."
./start-port-3217.sh

# Wait for startup
echo "⏳ Waiting for application to start..."
sleep 15

# Test the application
echo "🧪 Testing application..."
if curl -s http://localhost:3217 > /dev/null; then
    echo "✅ Application is running successfully!"
    echo "🌐 Access URL: http://212.86.105.190:3217"
else
    echo "❌ Application failed to start"
    echo "📋 Recent logs:"
    tail -20 yellow-panther-3217.log
fi

# Check if port 3217 is open in firewall
echo "🔒 Checking firewall..."
if ufw status | grep -q "3217"; then
    echo "✅ Port 3217 is already open in firewall"
else
    echo "🔓 Opening port 3217 in firewall..."
    ufw allow 3217/tcp
fi

echo "🎉 Deployment complete!"
REMOTE_SCRIPT

# Copy and execute the script on remote server
echo "📤 Copying deployment script to remote server..."
scp /tmp/deploy-remote.sh root@$REMOTE_HOST:/tmp/

echo "🚀 Executing deployment on remote server..."
ssh root@$REMOTE_HOST "chmod +x /tmp/deploy-remote.sh && /tmp/deploy-remote.sh"

# Test the deployment
echo "🧪 Testing external access..."
sleep 5
if curl -s -o /dev/null -w "%{http_code}" http://$REMOTE_HOST:$REMOTE_PORT | grep -q "200"; then
    echo "✅ External access successful!"
else
    echo "❌ External access failed. Checking status..."
    ssh root@$REMOTE_HOST "netstat -tlnp | grep 3217"
fi

echo ""
echo "🎉 Deployment Summary:"
echo "🌐 Yellow Panther AI Dashboard: http://$REMOTE_HOST:$REMOTE_PORT"
echo "🔧 Open WebUI (existing): http://$REMOTE_HOST:3000"
echo ""
echo "🔧 Management commands:"
echo "   • View logs: ssh root@$REMOTE_HOST 'tail -f $REMOTE_DIR/yellow-panther-3217.log'"
echo "   • Stop service: ssh root@$REMOTE_HOST 'kill \$(cat $REMOTE_DIR/yellow-panther-3217.pid)'"
echo "   • Restart service: ssh root@$REMOTE_HOST 'cd $REMOTE_DIR && ./start-port-3217.sh'" 