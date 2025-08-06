#!/bin/bash

echo "🚀 Yellow Panther AI - Remote Server Deployment Fix"
echo "==============================================="

REMOTE_HOST="212.86.105.190"
REMOTE_USER="root"
REMOTE_PATH="/opt/yellow-panther-ai"

echo "📋 Deployment Steps:"
echo "1. Check Node.js and npm installation"
echo "2. Install project dependencies"
echo "3. Restart backend services"
echo "4. Test API endpoints"
echo ""

# Function to run remote commands
run_remote() {
    echo "🔧 Executing on remote: $1"
    ssh ${REMOTE_USER}@${REMOTE_HOST} "$1"
}

# Check if we can connect
echo "🔗 Testing SSH connection to ${REMOTE_HOST}..."
if ssh -o ConnectTimeout=10 ${REMOTE_USER}@${REMOTE_HOST} "echo 'SSH Connection successful'"; then
    echo "✅ SSH connection established"
else
    echo "❌ SSH connection failed. Please ensure:"
    echo "   - SSH keys are set up correctly"
    echo "   - The server is accessible"
    echo "   - You have proper credentials"
    exit 1
fi

# Check Node.js and npm
echo ""
echo "📦 Checking Node.js and npm installation..."
run_remote "node --version && npm --version" || {
    echo "❌ Node.js/npm not found. Installing..."
    run_remote "curl -fsSL https://deb.nodesource.com/setup_18.x | bash -"
    run_remote "apt-get install -y nodejs"
}

# Navigate to project directory and check status
echo ""
echo "📁 Checking project directory..."
run_remote "cd ${REMOTE_PATH} && pwd && ls -la package.json"

# Install dependencies
echo ""
echo "📦 Installing project dependencies..."
run_remote "cd ${REMOTE_PATH} && npm install --production"

# Check if Next.js is now available
echo ""
echo "🔍 Verifying Next.js installation..."
run_remote "cd ${REMOTE_PATH} && npx next --version"

# Stop any running services
echo ""
echo "🛑 Stopping existing services..."
run_remote "pkill -f 'next dev' || true"
run_remote "pkill -f 'python.*rag' || true"

# Start services
echo ""
echo "🚀 Starting backend services..."
run_remote "cd ${REMOTE_PATH} && nohup npm run dev > backend.log 2>&1 &"
sleep 5

# Start RAG proxy
echo ""
echo "🤖 Starting RAG proxy..."
run_remote "cd ${REMOTE_PATH} && nohup python3 openwebui-rag-proxy-dynamic.py > rag-proxy.log 2>&1 &"
sleep 3

# Test endpoints
echo ""
echo "🧪 Testing API endpoints..."
run_remote "curl -s -o /dev/null -w 'Next.js Backend Status: %{http_code}\\n' http://localhost:3000/api/chat"
run_remote "curl -s -o /dev/null -w 'RAG Proxy Status: %{http_code}\\n' http://localhost:8001/v1/models"

echo ""
echo "✅ Remote deployment fix complete!"
echo ""
echo "🌐 Your Yellow Panther AI should now be accessible at:"
echo "   http://212.86.105.190:3000"
echo ""
echo "📊 To check logs:"
echo "   ssh ${REMOTE_USER}@${REMOTE_HOST} 'cd ${REMOTE_PATH} && tail -f backend.log'"
echo "   ssh ${REMOTE_USER}@${REMOTE_HOST} 'cd ${REMOTE_PATH} && tail -f rag-proxy.log'" 