#!/bin/bash

# Deploy Yellow Panther AI to port 3217 (avoiding Open WebUI on 3000)
REMOTE_HOST="212.86.105.190"
REMOTE_PORT="3217"
REMOTE_DIR="/opt/yellow-panther-ai"

echo "🚀 Deploying Yellow Panther AI to port $REMOTE_PORT..."

# Step 1: SSH to remote server and prepare environment
ssh root@$REMOTE_HOST << 'REMOTE_SETUP'
echo "🔧 Installing Node.js dependencies..."
cd /opt/yellow-panther-ai

# Install dependencies if not already installed
if [ ! -d "node_modules" ]; then
    npm install
fi

# Kill any existing process on port 3217
pkill -f "next.*3217" || true
sleep 2

# Create a custom start script for port 3217
cat > start-port-3217.sh << 'SCRIPT'
#!/bin/bash
cd /opt/yellow-panther-ai
export PORT=3217
nohup npm run dev -- -p 3217 > yellow-panther-3217.log 2>&1 &
echo $! > yellow-panther-3217.pid
echo "🚀 Yellow Panther AI started on port 3217 (PID: $(cat yellow-panther-3217.pid))"
SCRIPT

chmod +x start-port-3217.sh
REMOTE_SETUP

# Step 2: Start the application on port 3217
echo "🎯 Starting Yellow Panther AI on port $REMOTE_PORT..."
ssh root@$REMOTE_HOST "cd $REMOTE_DIR && ./start-port-3217.sh"

# Step 3: Wait for startup and test
echo "⏳ Waiting for application to start..."
sleep 10

# Step 4: Test the deployment
echo "🧪 Testing deployment..."
STATUS=$(ssh root@$REMOTE_HOST "curl -s -o /dev/null -w '%{http_code}' http://localhost:$REMOTE_PORT")
if [ "$STATUS" = "200" ]; then
    echo "✅ Yellow Panther AI is running successfully on port $REMOTE_PORT"
else
    echo "❌ Application not responding on port $REMOTE_PORT (Status: $STATUS)"
    echo "📋 Checking logs..."
    ssh root@$REMOTE_HOST "tail -20 $REMOTE_DIR/yellow-panther-3217.log"
fi

# Step 5: Display access information
echo ""
echo "🎉 Deployment Complete!"
echo "🌐 Yellow Panther AI Dashboard: http://$REMOTE_HOST:$REMOTE_PORT"
echo "🔧 Open WebUI (existing): http://$REMOTE_HOST:3000"
echo ""
echo "🔧 Useful commands:"
echo "   • View logs: ssh root@$REMOTE_HOST 'tail -f $REMOTE_DIR/yellow-panther-3217.log'"
echo "   • Stop service: ssh root@$REMOTE_HOST 'kill \$(cat $REMOTE_DIR/yellow-panther-3217.pid)'"
echo "   • Restart service: ssh root@$REMOTE_HOST 'cd $REMOTE_DIR && ./start-port-3217.sh'"
echo ""
echo "🧪 Test the dashboard:"
echo "   curl http://$REMOTE_HOST:$REMOTE_PORT" 