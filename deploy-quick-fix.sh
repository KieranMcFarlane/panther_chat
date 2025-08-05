#!/bin/bash

echo "🚀 Yellow Panther AI - Quick Remote Deployment Fix"
echo "================================================="

REMOTE_HOST="212.86.105.190"
REMOTE_USER="root"
REMOTE_PATH="/opt/yellow-panther-ai"

echo "🔗 Connecting to ${REMOTE_HOST} and executing complete fix..."
echo "💡 This will ask for your password once and complete all steps"
echo ""

# Execute all commands in a single SSH session
ssh ${REMOTE_USER}@${REMOTE_HOST} << 'EOF'
echo "🏁 Starting deployment fix on remote server..."

# Navigate to project directory
cd /opt/yellow-panther-ai
echo "📁 Current directory: $(pwd)"

# Check Node.js status
echo "📦 Node.js version: $(node --version)"
echo "📦 npm version: $(npm --version)"

# Stop existing services
echo "🛑 Stopping existing services..."
pkill -f "next dev" || true
pkill -f "python.*rag" || true
sleep 2

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install --production
else
    echo "✅ Dependencies already installed"
fi

# Verify Next.js is available
echo "🔍 Next.js version: $(npx next --version)"

# Set correct backend URL for RAG proxy
echo "🔧 Setting RAG_BACKEND_URL=http://localhost:3000"
export RAG_BACKEND_URL="http://localhost:3000"

# Start Next.js backend
echo "🚀 Starting Next.js backend..."
nohup npm run dev > backend.log 2>&1 &
sleep 8

# Start RAG proxy
echo "🤖 Starting RAG proxy..."
nohup python3 openwebui-rag-proxy-dynamic.py > rag-proxy.log 2>&1 &
sleep 5

# Test services
echo "🧪 Testing services..."
NEXT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/chat || echo "000")
RAG_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8001/v1/models || echo "000")

echo "📊 Service Status:"
echo "   Next.js Backend: HTTP $NEXT_STATUS"
echo "   RAG Proxy: HTTP $RAG_STATUS"

# Show running processes
echo "🔍 Running processes:"
ps aux | grep -E "(next|python.*rag)" | grep -v grep || echo "No matching processes found"

echo ""
echo "✅ Remote deployment fix complete!"
echo "🌐 Yellow Panther AI should be accessible at http://212.86.105.190:3000"

EOF

echo ""
echo "🎯 Next Steps:"
echo "1. Test the system: http://212.86.105.190:3000"
echo "2. Search for Brighton decision makers"
echo "3. Start engaging with Paul Barber, David Weir, and Sam Jewell"
echo ""
echo "📞 Brighton Contact Summary:"
echo "   • Paul Barber (CEO) - Primary decision maker"
echo "   • David Weir (Technical Director) - Technical validation"  
echo "   • Sam Jewell (Head of Recruitment) - Mobile scouting focus"
echo ""
echo "🚀 Ready to win mobile app projects with Brighton & Hove Albion! 🐆" 