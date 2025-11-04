#!/bin/bash

# Updated Production Deployment Script for Yellow Panther MCP System
# Builds locally and pushes to production server

set -e  # Exit on any error

echo "🚀 Building and Deploying Yellow Panther MCP System to Production"
echo "📍 Server: 13.60.60.60.50"
echo ""

# Configuration
SERVER_IP="13.60.60.50"
SSH_KEY="/Users/kieranmcfarlane/Downloads/panther_chat/yellowpanther.pem"
REMOTE_USER="ec2-user"
REMOTE_DIR="/home/ec2-user/yellow-panther-mcp"
LOCAL_DIR="/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app"

# Function to run SSH commands
run_ssh() {
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$REMOTE_USER@$SERVER_IP" "$1"
}

# Function to copy files via SCP
copy_file() {
    scp -i "$SSH_KEY" -o StrictHostKeyChecking=no "$1" "$REMOTE_USER@$SERVER_IP:$2"
}

# Function to copy directory via SCP
copy_dir() {
    scp -i "$SSH_KEY" -o StrictHostKeyChecking=no -r "$1" "$REMOTE_USER@$SERVER_IP:$2"
}

echo "🔐 Testing SSH connection..."
if ! run_ssh "echo 'SSH connection successful'"; then
    echo "❌ SSH connection failed. Please check your key and server access."
    exit 1
fi

echo "✅ SSH connection successful"
echo ""

echo "📦 Building application locally..."
cd "$LOCAL_DIR"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build the application
echo "🏗️ Building Next.js application..."
npm run build

echo "✅ Build completed"
echo ""

echo "📁 Preparing remote directory..."
run_ssh "mkdir -p $REMOTE_DIR/{logs,backup}"

# Backup existing deployment
echo "💾 Backing up existing deployment..."
run_ssh "if [ -d '$REMOTE_DIR/.next' ]; then
    tar -czf $REMOTE_DIR/backup/backup-$(date +%Y%m%d-%H%M%S).tar.gz -C $REMOTE_DIR .next src
    echo '✅ Backup created'
fi"

echo ""

echo "📁 Copying built application..."
copy_dir "$LOCAL_DIR/.next" "$REMOTE_DIR/"
copy_dir "$LOCAL_DIR/public" "$REMOTE_DIR/"
copy_file "$LOCAL_DIR/package.json" "$REMOTE_DIR/"
copy_file "$LOCAL_DIR/package-lock.json" "$REMOTE_DIR/"

echo "✅ Application files copied"
echo ""

echo "📝 Creating production scripts on server..."

# Create production startup script
cat > /tmp/production-start.sh << 'EOF'
#!/bin/bash

echo "🚀 Starting Yellow Panther MCP System in Production Mode"

# Set production environment
export NODE_ENV=production
export PORT=3005

# Kill any existing processes
echo "🛑 Stopping any existing processes..."
pkill -f "next-server" 2>/dev/null || true
pkill -f "node.*next" 2>/dev/null || true
pkill -f "npm start" 2>/dev/null || true

# Wait for processes to stop
sleep 3

# Start Next.js application in background
echo "🌐 Starting Next.js application..."
cd /home/ec2-user/yellow-panther-mcp
nohup npm start > logs/nextjs.log 2>&1 &
NEXTJS_PID=$!
echo $NEXTJS_PID > logs/nextjs.pid
echo "✅ Next.js started (PID: $NEXTJS_PID)"

# Wait for Next.js to start
sleep 10

# Test if application is running
echo "🧪 Testing application health..."
if curl -f http://localhost:3005/api/mcp-autonomous/test -X POST -H "Content-Type: application/json" -d '{"testType":"all"}' > /dev/null 2>&1; then
    echo "✅ Application is healthy and MCP integration working"
else
    echo "⚠️ Application started but test failed - check logs"
fi

echo ""
echo "🎉 Yellow Panther MCP System is running in production!"
echo "📊 Dashboard URL: http://13.60.60.50:3005/mcp-autonomous"
echo "📋 Logs: tail -f logs/nextjs.log"
echo ""
echo "🔧 Management Commands:"
echo "  Stop application: ./production-stop.sh"
echo "  Restart application: ./production-restart.sh"
echo "  View logs: tail -f logs/nextjs.log"
EOF

# Create production stop script
cat > /tmp/production-stop.sh << 'EOF'
#!/bin/bash

echo "🛑 Stopping Yellow Panther MCP System..."

# Stop Next.js
if [ -f logs/nextjs.pid ]; then
    PID=$(cat logs/nextjs.pid)
    if kill -0 $PID 2>/dev/null; then
        echo "🛑 Stopping Next.js (PID: $PID)..."
        kill $PID
        sleep 5
        if kill -0 $PID 2>/dev/null; then
            echo "⚡ Force killing Next.js..."
            kill -9 $PID
        fi
    fi
    rm -f logs/nextjs.pid
fi

# Kill any remaining processes
echo "🧹 Cleaning up remaining processes..."
pkill -f "next-server" 2>/dev/null || true
pkill -f "node.*next" 2>/dev/null || true
pkill -f "npm start" 2>/dev/null || true

echo "✅ Yellow Panther MCP System stopped"
EOF

# Create production restart script
cat > /tmp/production-restart.sh << 'EOF'
#!/bin/bash

echo "🔄 Restarting Yellow Panther MCP System..."
./production-stop.sh
sleep 3
./production-start.sh
EOF

# Copy scripts to server
copy_file "/tmp/production-start.sh" "$REMOTE_DIR/production-start.sh"
copy_file "/tmp/production-stop.sh" "$REMOTE_DIR/production-stop.sh"
copy_file "/tmp/production-restart.sh" "$REMOTE_DIR/production-restart.sh"

run_ssh "chmod +x $REMOTE_DIR/production-*.sh"

echo "✅ Production scripts created"
echo ""

echo "🔧 Installing dependencies on remote server..."
run_ssh "cd $REMOTE_DIR && npm install --production"

echo "✅ Dependencies installed"
echo ""

echo "🚀 Starting production application..."
run_ssh "cd $REMOTE_DIR && ./production-start.sh"

echo ""
echo "🎉 DEPLOYMENT COMPLETE!"
echo ""
echo "📊 Production Dashboard: http://13.60.60.50:3005/mcp-autonomous"
echo "🔧 SSH Management: ssh -i ~/Downloads/panther_chat/yellowpanther.pem ec2-user@13.60.60.50"
echo "📋 Server Commands:"
echo "  View logs: ssh -i ~/Downloads/panther_chat/yellowpanther.pem ec2-user@13.60.60.50 'cd /home/ec2-user/yellow-panther-mcp && tail -f logs/nextjs.log'"
echo "  Restart: ssh -i ~/Downloads/panther_chat/yellowpanther.pem ec2-user@13.60.60.50 'cd /home/ec2-user/yellow-panther-mcp && ./production-restart.sh'"
echo "  Stop: ssh -i ~/Downloads/panther_chat/yellowpanther.pem ec2-user@13.60.60.50 'cd /home/ec2-user/yellow-panther-mcp && ./production-stop.sh'"
echo ""
echo "🧪 Test MCP Tools:"
echo "  curl -X POST http://13.60.60.50:3005/api/mcp-autonomous/test \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"testType\":\"all\"}'"
echo ""

# Wait a moment for server to start
echo "⏳ Waiting for server to start..."
sleep 15

# Test the deployment
echo "🧪 Testing deployment..."
if curl -f "http://$SERVER_IP:3005/api/mcp-autonomous/test" -X POST -H "Content-Type: application/json" -d '{"testType":"all"}' --max-time 30 > /dev/null 2>&1; then
    echo "✅ Deployment test successful!"
else
    echo "⚠️ Deployment test failed - check server logs"
    echo "📋 SSH to server: ssh -i ~/Downloads/panther_chat/yellowpanther.pem ec2-user@$SERVER_IP 'cd /home/ec2-user/yellow-panther-mcp && tail -f logs/nextjs.log'"
fi

echo ""
echo "🎉 Yellow Panther MCP System deployed to production!"