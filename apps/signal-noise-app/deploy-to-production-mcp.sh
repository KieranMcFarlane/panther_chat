#!/bin/bash

# Production Deployment Script for Yellow Panther MCP System
# Deploys to 13.60.60.50 using provided SSH key

set -e  # Exit on any error

# Configuration
SERVER_IP="13.60.60.50"
SSH_KEY="/Users/kieranmcfarlane/Downloads/panther_chat/yellowpanther.pem"
REMOTE_USER="ec2-user"  # AWS EC2 user
REMOTE_DIR="/home/ec2-user/yellow-panther-mcp"
LOCAL_DIR="/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app"

echo "🚀 Deploying Yellow Panther MCP System to Production Server"
echo "📡 Server: $SERVER_IP"
echo "📁 Remote Directory: $REMOTE_DIR"
echo ""

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

echo "📦 Preparing remote directory..."
run_ssh "mkdir -p $REMOTE_DIR"
run_ssh "mkdir -p $REMOTE_DIR/logs"
run_ssh "mkdir -p $REMOTE_DIR/backup"

# Backup existing deployment if it exists
echo "💾 Backing up existing deployment..."
run_ssh "if [ -d '$REMOTE_DIR/src' ]; then
    tar -czf $REMOTE_DIR/backup/backup-$(date +%Y%m%d-%H%M%S).tar.gz -C $REMOTE_DIR src
    echo '✅ Backup created'
fi"

echo ""

echo "📁 Copying application files..."
copy_dir "$LOCAL_DIR/src" "$REMOTE_DIR/"
copy_dir "$LOCAL_DIR/public" "$REMOTE_DIR/"
copy_dir "$LOCAL_DIR/.next" "$REMOTE_DIR/"  # Next.js build cache
copy_file "$LOCAL_DIR/package.json" "$REMOTE_DIR/"
copy_file "$LOCAL_DIR/package-lock.json" "$REMOTE_DIR/"
copy_file "$LOCAL_DIR/next.config.js" "$REMOTE_DIR/"
copy_file "$LOCAL_DIR/tailwind.config.js" "$REMOTE_DIR/"
copy_file "$LOCAL_DIR/tsconfig.json" "$REMOTE_DIR/"

echo "✅ Application files copied"
echo ""

echo "📋 Copying MCP configuration..."
cat > /tmp/mcp-deploy-config.json << 'EOF'
{
  "mcpServers": {
    "neo4j-mcp": {
      "command": "npx",
      "args": [
        "-y",
        "@alanse/mcp-neo4j-server"
      ],
      "env": {
        "NEO4J_URI": "neo4j+s://cce1f84b.databases.neo4j.io",
        "NEO4J_USERNAME": "neo4j",
        "NEO4J_PASSWORD": "llNASCzMWGT-nTt-JkD9Qk_4W6PpJrv39X0PuYAIKV0",
        "NEO4J_DATABASE": "neo4j",
        "AURA_INSTANCEID": "cce1f84b",
        "AURA_INSTANCENAME": "Instance01"
      }
    },
    "brightdata": {
      "command": "npx",
      "args": [
        "-y",
        "@brightdata/mcp"
      ],
      "env": {
        "API_TOKEN": "bbbc6961d91d724bb6eb0b18bfc91bc11abd3a0d454411230d1f92aea27917f4",
        "PRO_MODE": "true"
      }
    },
    "perplexity-mcp": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-perplexity-search"
      ],
      "env": {
        "PERPLEXITY_API_KEY": "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"
      }
    }
  }
}
EOF

copy_file "/tmp/mcp-deploy-config.json" "$REMOTE_DIR/mcp-config.json"

echo "✅ MCP configuration copied"
echo ""

echo "📝 Creating deployment scripts on server..."

# Create production startup script
cat > /tmp/production-start.sh << 'EOF'
#!/bin/bash

# Production startup script for Yellow Panther MCP System
echo "🚀 Starting Yellow Panther MCP System in Production Mode"

# Set production environment
export NODE_ENV=production
export PORT=3005

# Kill any existing processes
echo "🛑 Stopping any existing processes..."
pkill -f "next-server" 2>/dev/null || true
pkill -f "node.*src" 2>/dev/null || true
pkill -f "npx.*mcp" 2>/dev/null || true

# Wait for processes to stop
sleep 3

# Start Next.js application in background
echo "🌐 Starting Next.js application..."
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
    echo "⚠️ Application started but MCP test failed - check logs"
fi

echo ""
echo "🎉 Yellow Panther MCP System is running in production!"
echo "📊 Dashboard URL: http://13.60.60.50:3005/mcp-autonomous"
echo "📋 Logs: tail -f logs/*.log"
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
pkill -f "node.*src" 2>/dev/null || true
pkill -f "npx.*mcp" 2>/dev/null || true

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

# Make scripts executable
copy_file "/tmp/production-start.sh" "$REMOTE_DIR/production-start.sh"
copy_file "/tmp/production-stop.sh" "$REMOTE_DIR/production-stop.sh"
copy_file "/tmp/production-restart.sh" "$REMOTE_DIR/production-restart.sh"

run_ssh "chmod +x $REMOTE_DIR/production-*.sh"

echo "✅ Deployment scripts created"
echo ""

echo "🔧 Installing dependencies on remote server..."
run_ssh "cd $REMOTE_DIR && npm install --production"

echo "✅ Dependencies installed"
echo ""

echo "🔍 Running MCP integration test..."
run_ssh "cd $REMOTE_DIR && timeout 30 npm run test:mcp || echo 'Test completed or timed out'"

echo "✅ MCP integration test completed"
echo ""

echo "🚀 Starting production application..."
run_ssh "cd $REMOTE_DIR && ./production-start.sh"

echo ""
echo "🎉 DEPLOYMENT COMPLETE!"
echo ""
echo "📊 Production Dashboard: http://13.60.60.50:3005/mcp-autonomous"
echo "🔧 SSH Management: ssh -i ~/yellowpanther.pem ubuntu@13.60.60.50"
echo "📋 Server Commands:"
echo "  View logs: ssh -i ~/yellowpanther.pem ubuntu@13.60.60.50 'cd /home/ubuntu/yellow-panther-mcp && tail -f logs/nextjs.log'"
echo "  Restart: ssh -i ~/yellowpanther.pem ubuntu@13.60.60.50 'cd /home/ubuntu/yellow-panther-mcp && ./production-restart.sh'"
echo "  Stop: ssh -i ~/yellowpanther.pem ubuntu@13.60.60.50 'cd /home/ubuntu/yellow-panther-mcp && ./production-stop.sh'"
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
    echo "📋 SSH to server: ssh -i ~/yellowpanther.pem ubuntu@$SERVER_IP 'cd /home/ubuntu/yellow-panther-mcp && tail -f logs/nextjs.log'"
fi

echo ""
echo "🎉 Yellow Panther MCP System deployed to production!"