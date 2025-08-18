#!/bin/bash

echo "🔧 Fixing Yellow Panther AI on port 3217..."

# Server configuration
REMOTE_HOST="212.86.105.190"
REMOTE_PORT="3217"
REMOTE_DIR="/opt/yellow-panther-ai"

echo "📋 Target: $REMOTE_HOST:$REMOTE_PORT"

# Step 1: Check current status
echo "🔍 Checking current status..."
curl -s -o /dev/null -w "%{http_code}" http://$REMOTE_HOST:$REMOTE_PORT
STATUS=$?

if [ $STATUS -eq 0 ]; then
    echo "✅ Service is responding on port $REMOTE_PORT"
else
    echo "❌ Service not responding on port $REMOTE_PORT"
fi

# Step 2: Create a simple start script
echo "📝 Creating start script..."
cat > start-yellow-panther-3217.sh << 'SCRIPT'
#!/bin/bash
cd /opt/yellow-panther-ai

# Kill any existing processes on port 3217
pkill -f "next.*3217" || true
pkill -f "node.*3217" || true
sleep 2

# Start the application
export PORT=3217
nohup npm run dev -- -p 3217 -H 0.0.0.0 > yellow-panther-3217.log 2>&1 &
echo $! > yellow-panther-3217.pid
echo "🚀 Yellow Panther AI started on port 3217 (PID: $(cat yellow-panther-3217.pid))"
SCRIPT

chmod +x start-yellow-panther-3217.sh

echo "📤 Uploading start script to server..."
scp start-yellow-panther-3217.sh root@$REMOTE_HOST:/tmp/

echo "🚀 Starting service on remote server..."
ssh root@$REMOTE_HOST "cd $REMOTE_DIR && chmod +x /tmp/start-yellow-panther-3217.sh && /tmp/start-yellow-panther-3217.sh"

echo "⏳ Waiting for service to start..."
sleep 10

# Step 3: Test the deployment
echo "🧪 Testing deployment..."
if curl -s -o /dev/null -w "%{http_code}" http://$REMOTE_HOST:$REMOTE_PORT | grep -q "200"; then
    echo "✅ Yellow Panther AI is now running successfully on port $REMOTE_PORT"
    echo "🌐 Access URL: http://$REMOTE_HOST:$REMOTE_PORT"
else
    echo "❌ Service still not responding"
    echo "📋 Checking remote logs..."
    ssh root@$REMOTE_HOST "tail -20 $REMOTE_DIR/yellow-panther-3217.log"
fi

echo ""
echo "🔧 Useful commands:"
echo "   • View logs: ssh root@$REMOTE_HOST 'tail -f $REMOTE_DIR/yellow-panther-3217.log'"
echo "   • Stop service: ssh root@$REMOTE_HOST 'kill \$(cat $REMOTE_DIR/yellow-panther-3217.pid)'"
echo "   • Restart service: ssh root@$REMOTE_HOST 'cd $REMOTE_DIR && ./start-yellow-panther-3217.sh'"

# Cleanup
rm start-yellow-panther-3217.sh 